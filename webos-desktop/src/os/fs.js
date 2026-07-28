export class FileSystemAPI {
  constructor(fileSystemManager) {
    this.fs = fileSystemManager;
  }

  async resolve(path) {
    await this.fs.fsReady;
    return Array.isArray(path) ? path.join("/") : path;
  }

  async read(path, options = {}) {
    const pathStr = await this.resolve(path);
    const fullPath = this.fs.resolveUserPath(pathStr);

    if (options.encoding === "binary") {
      return await this.fs.pRead("readFile", fullPath);
    }
    return await this.fs.pRead("readFile", fullPath, "utf8");
  }

  async write(path, content, options = {}) {
    const pathStr = await this.resolve(path);
    const fullPath = this.fs.resolveUserPath(pathStr);
    const dir = this.fs.dirname(fullPath);

    await this.fs.ensureFolder(this.fs.dirname(pathStr));

    if (options.encoding === "binary" || content instanceof Uint8Array) {
      await this.fs.safeWriteFile(fullPath, content);
    } else {
      await this.fs.safeWriteFile(fullPath, content);
    }

    if (options.kind || options.icon) {
      await this.fs.writeMeta(dir, this.fs.basename(pathStr), {
        kind: options.kind,
        icon: options.icon
      });
    }

    await this.fs.notifyDesktopChange(pathStr);
  }

  async readdir(path) {
    const pathStr = await this.resolve(path);
    return await this.fs.getFolder(pathStr);
  }

  async getFolder(path) {
    return await this.readdir(path);
  }

  async mkdir(path) {
    const pathStr = await this.resolve(path);
    await this.fs.ensureFolder(pathStr);
  }

  async delete(path, name) {
    const pathStr = await this.resolve(path);

    if (name) {
      await this.fs.deleteItem(pathStr, name);
    } else {
      const dir = this.fs.dirname(pathStr);
      const basename = this.fs.basename(pathStr);
      await this.fs.deleteItem(dir, basename);
    }
  }

  async exists(path) {
    const pathStr = await this.resolve(path);
    const fullPath = this.fs.resolveUserPath(pathStr);
    return await this.fs.exists(fullPath);
  }

  async copy(source, destination) {
    const sourceStr = await this.resolve(source);
    const destStr = await this.resolve(destination);

    const sourcePath = this.fs.resolveUserPath(sourceStr);
    const destPath = this.fs.resolveUserPath(destStr);

    const content = await this.fs.pRead("readFile", sourcePath);
    await this.fs.ensureFolder(this.fs.dirname(destStr));
    await this.fs.safeWriteFile(destPath, content);
  }

  async rename(oldPath, newPath) {
    const oldStr = await this.resolve(oldPath);
    const newStr = await this.resolve(newPath);

    const oldDir = this.fs.dirname(oldStr);
    const oldName = this.fs.basename(oldStr);
    const newDir = this.fs.dirname(newStr);
    const newName = this.fs.basename(newStr);

    if (oldDir === newDir) {
      await this.fs.renameItem(oldDir, oldName, newName);
    } else {
      await this.copy(oldStr, newStr);
      await this.delete(oldStr);
    }
  }

  async getMetadata(path, name) {
    await this.fs.fsReady;
    const dir = this.fs.resolveUserPath(path);
    const meta = await this.fs.readMeta(dir);
    return meta[name] || {};
  }

  async calcDirSize(path) {
    let size = 0;
    let files = 0;
    let dirs = 0;
    try {
      const entries = await this.readdir(path);
      const pathStr = await this.resolve(path);
      for (const [name, entry] of Object.entries(entries)) {
        if (entry.type === "file") {
          files++;
          size += entry.size ?? 0;
        } else {
          dirs++;
          const sub = await this.calcDirSize(this.fs.paths.join(pathStr, name));
          size += sub.size;
          files += sub.files;
          dirs += sub.dirs;
        }
      }
    } catch {}
    return { size, files, dirs };
  }

  async writeMeta(path, name, data) {
    const pathStr = await this.resolve(path);
    await this.fs.writeMeta(pathStr, name, data);
  }

  inferKind(filename) {
    return this.fs.inferKind(filename);
  }

  async isFile(path) {
    const pathStr = await this.resolve(path);
    const fullPath = this.fs.resolveUserPath(pathStr);
    const dir = this.fs.dirname(fullPath);
    const basename = this.fs.basename(fullPath);
    const folder = await this.fs.getFolder(dir);
    const item = folder[basename];
    return item && item.type === "file";
  }

  async getFileKind(path) {
    const pathStr = await this.resolve(path);
    const fullPath = this.fs.resolveUserPath(pathStr);
    const dir = this.fs.dirname(fullPath);
    const basename = this.fs.basename(fullPath);
    const meta = await this.fs.readMeta(dir);
    return meta[basename]?.kind;
  }

  async getFileIcon(path) {
    const pathStr = await this.resolve(path);
    const fullPath = this.fs.resolveUserPath(pathStr);
    const dir = this.fs.dirname(fullPath);
    const basename = this.fs.basename(fullPath);
    const meta = await this.fs.readMeta(dir);
    return meta[basename]?.icon;
  }

  async writeBinaryFile(path, name, blob, kind, icon) {
    const pathStr = await this.resolve(path);
    return await this.fs.writeBinaryFile(pathStr, name, blob, kind, icon);
  }

  async readBinaryFile(path, name) {
    const pathStr = await this.resolve(path);
    return await this.fs.readBinaryFile(pathStr, name);
  }

  async deleteBinaryFile(path, name) {
    const pathStr = await this.resolve(path);
    await this.fs.deleteBinaryFile(pathStr, name);
  }

  async renameBinaryFile(path, oldName, newName) {
    const pathStr = await this.resolve(path);
    await this.fs.renameBinaryFile(pathStr, oldName, newName);
  }

  async createFile(path, name, content, kind, icon, faIcon) {
    const pathStr = await this.resolve(path);
    return await this.fs.createFile(pathStr, name, content, kind, icon, faIcon);
  }

  async createFolder(path, name) {
    const pathStr = await this.resolve(path);
    return await this.fs.createFolder(pathStr, name);
  }

  async deleteItem(path, name) {
    const pathStr = await this.resolve(path);
    await this.fs.deleteItem(pathStr, name);
  }

  async renameItem(path, oldName, newName) {
    const pathStr = await this.resolve(path);
    await this.fs.renameItem(pathStr, oldName, newName);
  }

  async updateFile(path, name, content, meta) {
    const pathStr = await this.resolve(path);
    await this.fs.updateFile(pathStr, name, content);
    if (meta?.kind || meta?.icon) {
      const dir = this.fs.resolveUserPath(pathStr);
      await this.fs.writeMeta(dir, name, { kind: meta.kind, icon: meta.icon });
    }
  }

  async trashFile(path, name) {
    const pathStr = await this.resolve(path);
    if (name) {
      return await this.fs.trash.moveToTrash(pathStr, name);
    }
    const dir = this.fs.dirname(pathStr);
    const basename = this.fs.basename(pathStr);
    return await this.fs.trash.moveToTrash(dir, basename);
  }

  async getTrashItems() {
    await this.fs.fsReady;
    return await this.fs.trash.getItems();
  }

  async restoreTrashItem(id) {
    await this.fs.fsReady;
    return await this.fs.trash.restoreItem(id);
  }

  async restoreAllTrashItems() {
    await this.fs.fsReady;
    return await this.fs.trash.restoreAll();
  }

  async deleteTrashItem(id) {
    await this.fs.fsReady;
    await this.fs.trash.deletePermanently(id);
  }

  async emptyTrash() {
    await this.fs.fsReady;
    await this.fs.trash.emptyTrash();
  }

  async getTrashCount() {
    await this.fs.fsReady;
    return await this.fs.trash.getItemCount();
  }

  dirname(path) {
    return this.fs.dirname(path);
  }

  basename(path) {
    return this.fs.basename(path);
  }

  resolveUserPath(path) {
    return this.fs.resolveUserPath(path);
  }

  join(...parts) {
    return this.fs.paths.join(...parts);
  }

  async setSession(name) {
    await this.fs.setSession?.(name);
  }

  async getFileContent(path, name) {
    return await this.fs.getFileContent(path, name);
  }

  async getUniqueFileName(path, name) {
    const pathStr = await this.resolve(path);
    return await this.fs.getUniqueFileName(pathStr, name);
  }

  async pickDirectory() {
    return await this.fs.mountManager.pickDirectory();
  }

  registerMount(handle, label) {
    return this.fs.mountManager.registerMount(handle, label);
  }

  unmount(label) {
    this.fs.mountManager.unmount(label);
  }

  getMounts() {
    return this.fs.getAllMounts();
  }

  async mountISO(path, name) {
    const pathStr = await this.resolve(path);
    return await this.fs.mountISO(pathStr, name);
  }

  unmountISO(label) {
    return this.fs.unmountISO(label);
  }

  getISOMounts() {
    return this.fs.getISOMounts();
  }
}
