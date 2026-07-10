import { StorageKeys, os } from "../framework.js";
import { inferKind, mimeFromName } from "../shared/fileKindDetector.js";
import { resolveIconUrl } from "../shared/assetResolver.js";

const MOUNTS_BASE = "Mounts";
const HANDLE_DB = "yukios-mount-handles";
const HANDLE_STORE = "handles";

export class MountManager {
  constructor() {
    this.mounts = new Map();
    this.root = "";
    this.isReady = false;
  }

  get ready() {
    return this.isReady;
  }

  setRoot(root) {
    this.root = root;
  }

  async init() {
    try {
      const stored = os.storage.get(StorageKeys.storageMounts);
      if (Array.isArray(stored)) {
        const handleEntries = await this.loadAllHandles();
        const handleMap = new Map();
        for (const entry of handleEntries) {
          if (entry && entry.mountPoint && entry.handle) {
            handleMap.set(entry.mountPoint, entry.handle);
          }
        }
        for (const entry of stored) {
          if (!entry.label || !entry.mountPoint) continue;
          const handle = handleMap.get(entry.mountPoint);
          if (!handle) {
            console.warn(`[MountManager] No stored handle for mount "${entry.label}", skipping`);
            continue;
          }
          try {
            const perm = await handle.queryPermission({ mode: "readwrite" });
            if (perm !== "granted") {
              const result = await handle.requestPermission({ mode: "readwrite" });
              if (result !== "granted") {
                console.warn(`[MountManager] Permission denied for mount "${entry.label}", skipping`);
                continue;
              }
            }
            this.mounts.set(entry.mountPoint, { label: entry.label, handle, mountPoint: entry.mountPoint });
          } catch (e) {
            console.warn(`[MountManager] Failed to restore mount "${entry.label}":`, e);
          }
        }
      }
      this.isReady = true;
      console.log(`[MountManager] Initialized with ${this.mounts.size} mount(s)`);
    } catch (e) {
      console.warn("[MountManager] Init error:", e);
      this.isReady = true;
    }
  }

  async pickDirectory() {
    if (!window.showDirectoryPicker) {
      throw new Error("File System Access API not supported in this browser");
    }
    return await window.showDirectoryPicker({ mode: "readwrite" });
  }

  registerMount(handle, label) {
    const mountPoint = `${MOUNTS_BASE}/${this.sanitizeLabel(label)}`;
    if (this.mounts.has(mountPoint)) {
      throw new Error(`A mount named "${label}" already exists`);
    }
    this.mounts.set(mountPoint, { label, handle, mountPoint });
    this.persist();
    return mountPoint;
  }

  unmount(labelOrMountPoint) {
    let key = null;
    for (const [mp, entry] of this.mounts) {
      if (mp === labelOrMountPoint || entry.label === labelOrMountPoint) {
        key = mp;
        break;
      }
    }
    if (!key) return false;
    this.mounts.delete(key);
    this.persist();
    return true;
  }

  getMounts() {
    return Array.from(this.mounts.values()).map(({ label, mountPoint }) => ({ label, mountPoint }));
  }

  isMountedPath(absolutePath) {
    if (!this.root || !this.mounts.size) return false;
    for (const mountPoint of this.mounts.keys()) {
      const fullMountPath = this.root + "/" + mountPoint;
      if (absolutePath === fullMountPath || absolutePath.startsWith(fullMountPath + "/")) {
        return true;
      }
    }
    return false;
  }

  resolveMount(absolutePath) {
    if (!this.root || !this.mounts.size) return null;
    for (const [mountPoint, entry] of this.mounts) {
      const fullMountPath = this.root + "/" + mountPoint;
      if (absolutePath === fullMountPath) {
        return { mount: entry, relativePath: "" };
      }
      if (absolutePath.startsWith(fullMountPath + "/")) {
        return { mount: entry, relativePath: absolutePath.slice(fullMountPath.length + 1) };
      }
    }
    return null;
  }

  async readdir(mount, relPath) {
    const dirHandle = relPath ? await this.getDirHandle(mount.handle, relPath) : mount.handle;
    const result = {};
    for await (const entry of dirHandle.values()) {
      if (entry.kind === "directory") {
        result[entry.name] = {};
      } else {
        const kind = inferKind(entry.name);
        result[entry.name] = {
          type: "file",
          kind,
          icon: resolveIconUrl("static/icons/file.webp"),
          faIcon: null,
          content: "",
          size: 0
        };
      }
    }
    return result;
  }

  async readFile(mount, relPath) {
    const fileHandle = await this.getFileHandle(mount.handle, relPath);
    const file = await fileHandle.getFile();
    return await file.text();
  }

  async readFileBinary(mount, relPath) {
    const fileHandle = await this.getFileHandle(mount.handle, relPath);
    const file = await fileHandle.getFile();
    return file.type ? file : new Blob([file], { type: mimeFromName(relPath.split("/").pop() || "") });
  }

  async writeFile(mount, relPath, content) {
    const fileHandle = await this.getFileHandle(mount.handle, relPath, true);
    const writable = await fileHandle.createWritable();
    try {
      await writable.write(content);
    } finally {
      await writable.close();
    }
  }

  async deleteFile(mount, relPath) {
    const dir = this.parentPath(relPath);
    const name = this.baseName(relPath);
    const dirHandle = dir ? await this.getDirHandle(mount.handle, dir) : mount.handle;
    await dirHandle.removeEntry(name);
  }

  async deleteDirectory(mount, relPath) {
    const dir = this.parentPath(relPath);
    const name = this.baseName(relPath);
    const dirHandle = dir ? await this.getDirHandle(mount.handle, dir) : mount.handle;
    await dirHandle.removeEntry(name, { recursive: true });
  }

  async rename(mount, oldRelPath, newRelPath) {
    const oldDir = this.parentPath(oldRelPath);
    const oldName = this.baseName(oldRelPath);
    const newDir = this.parentPath(newRelPath);
    const newName = this.baseName(newRelPath);
    const oldDirHandle = oldDir ? await this.getDirHandle(mount.handle, oldDir) : mount.handle;
    const newDirHandle = newDir ? await this.getDirHandle(mount.handle, newDir) : mount.handle;
    try {
      const handle = await oldDirHandle.getFileHandle(oldName);
      if (oldDir === newDir) {
        await handle.move(newDirHandle, newName);
      } else {
        const file = await handle.getFile();
        const newHandle = await newDirHandle.getFileHandle(newName, { create: true });
        const writable = await newHandle.createWritable();
        try {
          await writable.write(await file.arrayBuffer());
        } finally {
          await writable.close();
        }
        await oldDirHandle.removeEntry(oldName);
      }
    } catch {
      const handle = await oldDirHandle.getDirectoryHandle(oldName);
      if (oldDir === newDir) {
        await handle.move(newDirHandle, newName);
      } else {
        await this.copyDirectory(handle, newDirHandle, newName);
        await oldDirHandle.removeEntry(oldName, { recursive: true });
      }
    }
  }

  async mkdir(mount, relPath) {
    const parts = relPath.split("/").filter(Boolean);
    let current = mount.handle;
    for (const part of parts) {
      current = await current.getDirectoryHandle(part, { create: true });
    }
  }

  async exists(mount, relPath) {
    try {
      const fileHandle = await this.getFileHandle(mount.handle, relPath);
      await fileHandle.getFile();
      return true;
    } catch {
      try {
        await this.getDirHandle(mount.handle, relPath);
        return true;
      } catch {
        return false;
      }
    }
  }

  async isFile(mount, relPath) {
    try {
      const fileHandle = await this.getFileHandle(mount.handle, relPath);
      await fileHandle.getFile();
      return true;
    } catch {
      return false;
    }
  }

  sanitizeLabel(label) {
    return label.replace(/[^a-zA-Z0-9_\-. ]/g, "_").trim();
  }

  async getFileHandle(dirHandle, relPath, create = false) {
    const parts = relPath.split("/").filter(Boolean);
    const name = parts.pop();
    let current = dirHandle;
    for (const part of parts) {
      current = await current.getDirectoryHandle(part, { create });
    }
    return await current.getFileHandle(name, { create });
  }

  async getDirHandle(dirHandle, relPath) {
    const parts = relPath.split("/").filter(Boolean);
    let current = dirHandle;
    for (const part of parts) {
      current = await current.getDirectoryHandle(part, { create: true });
    }
    return current;
  }

  parentPath(path) {
    const parts = path.split("/").filter(Boolean);
    parts.pop();
    return parts.join("/");
  }

  baseName(path) {
    const parts = path.split("/").filter(Boolean);
    return parts[parts.length - 1] || "";
  }

  async persist() {
    const meta = [];
    for (const [, entry] of this.mounts) {
      meta.push({ label: entry.label, mountPoint: entry.mountPoint });
    }
    os.storage.set(StorageKeys.storageMounts, meta);
    const db = await this.openDB();
    const tx = db.transaction(HANDLE_STORE, "readwrite");
    const store = tx.objectStore(HANDLE_STORE);
    store.clear();
    for (const [, entry] of this.mounts) {
      store.put({ mountPoint: entry.mountPoint, handle: entry.handle });
    }
    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async loadAllHandles() {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(HANDLE_STORE, "readonly");
      const request = tx.objectStore(HANDLE_STORE).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(HANDLE_DB, 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(HANDLE_STORE)) {
          db.createObjectStore(HANDLE_STORE, { keyPath: "mountPoint" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async copyDirectory(sourceHandle, destParentHandle, newName) {
    const destHandle = await destParentHandle.getDirectoryHandle(newName, { create: true });
    for await (const entry of sourceHandle.values()) {
      if (entry.kind === "directory") {
        await this.copyDirectory(entry, destHandle, entry.name);
      } else {
        const file = await entry.getFile();
        const newFileHandle = await destHandle.getFileHandle(entry.name, { create: true });
        const writable = await newFileHandle.createWritable();
        try {
          await writable.write(await file.arrayBuffer());
        } finally {
          await writable.close();
        }
      }
    }
  }
}
