import { generateId } from "../utils/utils.js";

export class TrashManager {
  constructor(fsManager) {
    this.fs = fsManager;
    this.storage = fsManager.storage;
    this.paths = fsManager.paths;
    this.metadata = fsManager.metadata;
    this.blobs = fsManager.blobs;
    this.config = fsManager.CONFIG;
    this.TRASH_DIR_NAME = ".trash";
    this.MANIFEST_NAME = ".trash.json";
    this.trashDirResolved = null;
  }

  trashDir() {
    if (!this.trashDirResolved) {
      this.trashDirResolved = this.paths.join("/", this.config.ROOT, this.TRASH_DIR_NAME);
    }
    return this.trashDirResolved;
  }

  manifestPath() {
    return this.paths.join(this.trashDir(), this.MANIFEST_NAME);
  }

  async init() {
    const trashDir = this.trashDir();
    const exists = await this.storage.exists(trashDir);
    if (!exists) {
      await this.storage.mkdir(trashDir, { recursive: true });
    }
    const manifestExists = await this.storage.exists(this.manifestPath());
    if (!manifestExists) {
      await this.storage.writeFile(this.manifestPath(), "[]");
    }
  }

  async loadManifest() {
    try {
      const raw = await this.storage.readFile(this.manifestPath(), "utf8");
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  async saveManifest(items) {
    await this.storage.writeFile(this.manifestPath(), JSON.stringify(items, null, 2));
  }

  async moveToTrash(path, name) {
    const dir = this.paths.resolveUserPath(path);
    const targetPath = this.paths.join(dir, name);
    const stat = await this.storage.pStat(targetPath);
    const isDirectory = stat.isDirectory();

    const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
    const baseName = name.includes(".") ? name.slice(0, name.lastIndexOf(".")) : name;
    const timestamp = Date.now();
    const trashedName = `${baseName}_${timestamp}${ext}`;
    const trashPath = this.paths.join(this.trashDir(), trashedName);

    const kind = await this.getKind(dir, name);

    if (isDirectory) {
      const blobPaths = [];
      const walk = async (d) => {
        const entries = await this.storage.readdir(d);
        for (const entry of entries) {
          if (entry === this.config.META_FILE || entry === this.MANIFEST_NAME) continue;
          const full = this.paths.join(d, entry);
          const s = await this.storage.pStat(full);
          if (s.isDirectory()) {
            await walk(full);
          } else {
            const blob = await this.blobs.getBlobByFullPath(full);
            if (blob) blobPaths.push(full);
          }
        }
      };
      await walk(targetPath);

      await this.storage.rename(targetPath, trashPath);

      for (const oldBlobPath of blobPaths) {
        const newBlobPath = oldBlobPath.replace(targetPath, trashPath);
        await this.blobs.renameBlobByFullPath(oldBlobPath, newBlobPath);
      }
    } else {
      await this.metadata.removeMeta(dir, name);

      await this.storage.rename(targetPath, trashPath);
      await this.blobs.renameBlobByFullPath(targetPath, trashPath);
    }

    let size = 0;
    try {
      if (isDirectory) {
        size = await this.calcDirSize(trashPath);
      } else {
        const s = await this.storage.pStat(trashPath);
        size = s.size || 0;
      }
    } catch {}

    const entry = {
      id: generateId("trash_"),
      originalPath: Array.isArray(path) ? [...path] : [path],
      originalName: name,
      trashedName,
      type: isDirectory ? "folder" : "file",
      kind: kind || null,
      deletedAt: Date.now(),
      size
    };

    const items = await this.loadManifest();
    items.push(entry);
    await this.saveManifest(items);

    await this.fs.notifyDesktopChange(path);

    return entry;
  }

  async restoreItem(id) {
    const items = await this.loadManifest();
    const idx = items.findIndex((e) => e.id === id);
    if (idx === -1) throw new Error(`Trash entry "${id}" not found`);

    const entry = items[idx];
    const trashPath = this.paths.join(this.trashDir(), entry.trashedName);
    const targetDir = this.paths.resolveUserPath(entry.originalPath);
    const targetPath = this.paths.join(targetDir, entry.originalName);

    const targetDirExists = await this.storage.exists(targetDir);
    if (!targetDirExists) {
      await this.storage.mkdir(targetDir, { recursive: true });
    }

    const targetExists = await this.storage.exists(targetPath);
    let finalName = entry.originalName;
    if (targetExists) {
      const ext = entry.originalName.includes(".") ? entry.originalName.slice(entry.originalName.lastIndexOf(".")) : "";
      const base = entry.originalName.includes(".")
        ? entry.originalName.slice(0, entry.originalName.lastIndexOf("."))
        : entry.originalName;
      let counter = 1;
      while (await this.storage.exists(this.paths.join(targetDir, finalName))) {
        finalName = `${base} (${counter})${ext}`;
        counter++;
      }
    }

    const finalTargetPath = this.paths.join(targetDir, finalName);

    if (entry.type === "folder") {
      const blobPaths = [];
      const walk = async (d) => {
        const entries = await this.storage.readdir(d);
        for (const eName of entries) {
          if (eName === this.config.META_FILE || eName === this.MANIFEST_NAME) continue;
          const full = this.paths.join(d, eName);
          const s = await this.storage.pStat(full);
          if (s.isDirectory()) {
            await walk(full);
          } else {
            const blob = await this.blobs.getBlobByFullPath(full);
            if (blob) blobPaths.push(full);
          }
        }
      };
      await walk(trashPath);

      await this.storage.rename(trashPath, finalTargetPath);

      for (const oldBlobPath of blobPaths) {
        const newBlobPath = oldBlobPath.replace(trashPath, finalTargetPath);
        await this.blobs.renameBlobByFullPath(oldBlobPath, newBlobPath);
      }
    } else {
      const metaDir = this.paths.dirname(finalTargetPath);
      const metaName = this.paths.basename(finalTargetPath);
      const stat = await this.storage.pStat(trashPath);
      await this.metadata.writeMeta(metaDir, metaName, {
        kind: entry.kind,
        size: stat.size || 0
      });

      await this.storage.rename(trashPath, finalTargetPath);
      await this.blobs.renameBlobByFullPath(trashPath, finalTargetPath);
    }

    items.splice(idx, 1);
    await this.saveManifest(items);

    await this.fs.notifyDesktopChange(entry.originalPath);
    if (finalName !== entry.originalName) {
      return { restoredName: finalName, originalName: entry.originalName };
    }
    return { restoredName: finalName };
  }

  async restoreAll() {
    const items = await this.loadManifest();
    const results = [];
    for (const entry of [...items]) {
      try {
        const result = await this.restoreItem(entry.id);
        results.push({ name: entry.originalName, success: true, ...result });
      } catch (err) {
        results.push({ name: entry.originalName, success: false, error: err.message });
      }
    }
    return results;
  }

  async deletePermanently(id) {
    const items = await this.loadManifest();
    const idx = items.findIndex((e) => e.id === id);
    if (idx === -1) throw new Error(`Trash entry "${id}" not found`);

    const entry = items[idx];
    const trashPath = this.paths.join(this.trashDir(), entry.trashedName);

    const trashExists = await this.storage.exists(trashPath);
    if (trashExists) {
      const stat = await this.storage.pStat(trashPath);
      if (stat.isDirectory()) {
        await this.deleteDirectoryRecursive(trashPath);
      } else {
        await this.storage.unlink(trashPath);
        await this.blobs.deleteBlobByFullPath(trashPath);
      }
    }

    items.splice(idx, 1);
    await this.saveManifest(items);
  }

  async emptyTrash() {
    const items = await this.loadManifest();
    for (const entry of items) {
      const trashPath = this.paths.join(this.trashDir(), entry.trashedName);
      const exists = await this.storage.exists(trashPath);
      if (!exists) continue;
      const stat = await this.storage.pStat(trashPath);
      if (stat.isDirectory()) {
        await this.deleteDirectoryRecursive(trashPath);
      } else {
        await this.storage.unlink(trashPath);
        await this.blobs.deleteBlobByFullPath(trashPath);
      }
    }
    await this.saveManifest([]);
  }

  async getItems() {
    return this.loadManifest();
  }

  async getItemCount() {
    const items = await this.loadManifest();
    return items.length;
  }

  async getKind(dir, name) {
    try {
      const meta = await this.metadata.readMeta(dir);
      return meta[name]?.kind || null;
    } catch {
      return null;
    }
  }

  async calcDirSize(dirPath) {
    let total = 0;
    try {
      const entries = await this.storage.readdir(dirPath);
      for (const entry of entries) {
        if (entry === this.config.META_FILE || entry === this.MANIFEST_NAME) continue;
        const full = this.paths.join(dirPath, entry);
        const s = await this.storage.pStat(full);
        if (s.isDirectory()) {
          total += await this.calcDirSize(full);
        } else {
          total += s.size || 0;
        }
      }
    } catch {}
    return total;
  }

  async deleteDirectoryRecursive(dirPath) {
    const entries = await this.storage.readdir(dirPath);
    for (const entry of entries) {
      if (entry === this.config.META_FILE || entry === this.MANIFEST_NAME) continue;
      const fullPath = this.paths.join(dirPath, entry);
      const stat = await this.storage.pStat(fullPath);
      if (stat.isDirectory()) {
        await this.deleteDirectoryRecursive(fullPath);
      } else {
        await this.storage.unlink(fullPath);
        await this.blobs.deleteBlobByFullPath(fullPath);
      }
    }
    await this.storage.rmdir(dirPath);
  }
}
