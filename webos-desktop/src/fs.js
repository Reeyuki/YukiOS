import BrowserFS from "browserfs";

export const FileKind = { TEXT: "text", IMAGE: "image", VIDEO: "video", ROM: "rom", OTHER: "other" };

export const defaultStorage = {
  home: {
    reeyuki: {
      Desktop: {},
      Documents: {
        "INFO.txt": {
          type: "file",
          content:
            "This is an example text file.\n\nYou can edit this file using the Text Editor app.\n\nTry creating your own files by:\n1. Opening the Text Editor\n2. Writing your content\n3. Clicking Save As and entering a filename\n\nHave fun exploring YukiOS!",
          kind: FileKind.TEXT,
          icon: "/static/icons/notepad.webp"
        }
      },
      Pictures: {
        Wallpapers: {
          "wallpaper1.webp": {
            type: "file",
            content: "/static/wallpapers/wallpaper1.webp",
            kind: FileKind.IMAGE,
            icon: "/static/wallpapers/wallpaper1.webp"
          },
          "wallpaper2.webp": {
            type: "file",
            content: "/static/wallpapers/wallpaper2.webp",
            kind: FileKind.IMAGE,
            icon: "/static/wallpapers/wallpaper2.webp"
          },
          "wallpaper3.webp": {
            type: "file",
            content: "/static/wallpapers/wallpaper3.webp",
            kind: FileKind.IMAGE,
            icon: "/static/wallpapers/wallpaper3.webp"
          },
          "wallpaper4.webp": {
            type: "file",
            content: "/static/wallpapers/wallpaper4.webp",
            kind: FileKind.IMAGE,
            icon: "/static/wallpapers/wallpaper4.webp"
          },
          "wallpaper5.webp": {
            type: "file",
            content: "/static/wallpapers/wallpaper5.webp",
            kind: FileKind.IMAGE,
            icon: "/static/wallpapers/wallpaper5.webp"
          },
          "wallpaper6.webp": {
            type: "file",
            content: "/static/wallpapers/wallpaper6.webp",
            kind: FileKind.IMAGE,
            icon: "/static/wallpapers/wallpaper6.webp"
          },
          "wallpaper7.webp": {
            type: "file",
            content: "/static/wallpapers/wallpaper7.webp",
            kind: FileKind.IMAGE,
            icon: "/static/wallpapers/wallpaper7.webp"
          },
          "wallpaper8.webp": {
            type: "file",
            content: "/static/wallpapers/wallpaper8.webp",
            kind: FileKind.IMAGE,
            icon: "/static/wallpapers/wallpaper8.webp"
          },
          "wallpaper9.webp": {
            type: "file",
            content: "/static/wallpapers/wallpaper9.webp",
            kind: FileKind.IMAGE,
            icon: "/static/wallpapers/wallpaper9.webp"
          },
          "wallpaper10.webp": {
            type: "file",
            content: "/static/wallpapers/wallpaper10.webp",
            kind: FileKind.IMAGE,
            icon: "/static/wallpapers/wallpaper10.webp"
          },
          "wallpaper11.webp": {
            type: "file",
            content: "/static/wallpapers/wallpaper11.webp",
            kind: FileKind.IMAGE,
            icon: "/static/wallpapers/wallpaper11.webp"
          },
          "wallpaper12.png": {
            type: "file",
            content: "/static/wallpapers/wallpaper12.png",
            kind: FileKind.IMAGE,
            icon: "/static/wallpapers/wallpaper12.png"
          },
          "wallpaper13.png": {
            type: "file",
            content: "/static/wallpapers/wallpaper13.png",
            kind: FileKind.IMAGE,
            icon: "/static/wallpapers/wallpaper13.png"
          },
          "nier.mp4": {
            type: "file",
            content: "https://motionbgs.com/media/4348/2b-in-nier-automata.1920x1080.mp4",
            kind: FileKind.VIDEO,
            icon: "/static/wallpapers/nier.webp"
          },
          "stormworld.mp4": {
            type: "file",
            content: "https://motionbgs.com/media/8008/above-the-stormworld.3840x2160.mp4",
            kind: FileKind.VIDEO,
            icon: "/static/wallpapers/nier.webp"
          }
        }
      },
      Music: {},
      Videos: {}
    }
  }
};

export class FileSystemManager {
  constructor() {
    this.CONFIG = {
      GRID_SIZE: 80,
      ROOT: "/home/reeyuki",
      META_FILE: ".meta.json",
      LEGACY_KEY: "desktopOS_fileSystem"
    };
    this.fsReady = this.initFS();
    this.desktopUI = null;
  }

  setDesktopUI(desktopUI) {
    this.desktopUI = desktopUI;
  }

  isDesktopPath(path) {
    const desktopPath = this.join(this.CONFIG.ROOT, "Desktop");
    const resolvedPath = this.resolveDir(path);
    return resolvedPath === desktopPath || resolvedPath.startsWith(desktopPath + "/");
  }

  async notifyDesktopChange(path) {
    if (this.desktopUI && this.isDesktopPath(path)) {
      await this.desktopUI.loadDesktopItems();
    }
  }

  p(method, ...args) {
    return new Promise((res, rej) => {
      this.fs[method](...args, (err) => (err ? rej(err) : res()));
    });
  }

  pRead(method, ...args) {
    return new Promise((res, rej) => {
      this.fs[method](...args, (err, data) => (err ? rej(err) : res(data)));
    });
  }

  pStat(path) {
    return new Promise((res, rej) => {
      this.fs.stat(path, (e, s) => (e ? rej(e) : res(s)));
    });
  }

  async initFS() {
    return new Promise((resolve) => {
      BrowserFS.configure({ fs: "IndexedDB", options: {} }, async () => {
        this.fs = BrowserFS.BFSRequire("fs");
        await this.initBlobDB();
        await this.migrateIfNeeded();
        await this.ensureDefaults();
        resolve();
      });
    });
  }

  initBlobDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("fs-blobs-db", 1);
      req.onupgradeneeded = (e) => {
        e.target.result.createObjectStore("blobs", { keyPath: "path" });
      };
      req.onsuccess = (e) => {
        this.blobDB = e.target.result;
        resolve();
      };
      req.onerror = (e) => reject(e);
    });
  }

  async migrateIfNeeded() {
    const rootExists = await this.exists(this.CONFIG.ROOT);
    if (rootExists) return;
    const legacyExists = await this.exists(this.CONFIG.LEGACY_KEY);
    if (!legacyExists) return;
    const raw = await this.readFile(this.CONFIG.LEGACY_KEY);
    const legacyFS = JSON.parse(raw);
    await this.createFromObject(legacyFS, "/");
    await this.p("unlink", this.CONFIG.LEGACY_KEY);
  }

  async ensureDefaults() {
    await this.createFromObject(defaultStorage, "/");
  }

  async createFromObject(obj, basePath) {
    for (const key in obj) {
      const value = obj[key];
      const fullPath = this.join(basePath, key);
      if (value.type === "file") {
        await this.p("mkdir", this.dirname(fullPath), { recursive: true }).catch(() => {});
        const exists = await this.exists(fullPath);
        if (!exists) await this.p("writeFile", fullPath, value.content ?? "");
        await this.writeMeta(this.dirname(fullPath), key, value);
      } else {
        await this.p("mkdir", fullPath, { recursive: true }).catch(() => {});
        await this.createFromObject(value, fullPath);
      }
    }
  }

  join(...parts) {
    return parts.join("/").replace(/\/+/g, "/");
  }

  dirname(path) {
    return path.split("/").slice(0, -1).join("/") || "/";
  }

  _acquireMeta(dir) {
    if (!this._metaLocks) this._metaLocks = new Map();
    const prev = this._metaLocks.get(dir) ?? Promise.resolve();
    let release;
    const next = new Promise((res) => {
      release = res;
    });
    this._metaLocks.set(
      dir,
      prev.then(() => next)
    );
    return prev.then(() => release);
  }

  async readMeta(dir) {
    const metaPath = this.join(dir, this.CONFIG.META_FILE);
    try {
      const data = await this.pRead("readFile", metaPath, "utf8");
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  async writeMeta(dir, name, data) {
    const release = await this._acquireMeta(dir);
    try {
      const metaPath = this.join(dir, this.CONFIG.META_FILE);
      const meta = await this.readMeta(dir);
      meta[name] = { kind: data.kind, icon: data.icon };
      if (data.faIcon) meta[name].faIcon = data.faIcon;
      if (data.size != null) meta[name].size = data.size;
      if (data.faIcon) meta[name].faIcon = data.faIcon;
      await this.p("writeFile", metaPath, JSON.stringify(meta));
    } finally {
      release();
    }
  }

  async removeMeta(dir, name) {
    const release = await this._acquireMeta(dir);
    try {
      const metaPath = this.join(dir, this.CONFIG.META_FILE);
      const meta = await this.readMeta(dir);
      delete meta[name];
      await this.p("writeFile", metaPath, JSON.stringify(meta));
    } finally {
      release();
    }
  }

  normalizePath(path) {
    if (typeof path === "string") return path.split("/").filter(Boolean);
    return Array.isArray(path) ? path.filter(Boolean) : [];
  }

  resolvePath(input, currentPath = []) {
    const parts = typeof input === "string" ? input.split("/") : [];
    let path = input.startsWith("/") ? [] : [...currentPath];
    for (const part of parts) {
      if (!part || part === ".") continue;
      if (part === "..") path.pop();
      else path.push(part);
    }
    return path;
  }

  inferKind(fileName) {
    const ext = fileName.split(".").pop().toLowerCase();
    if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return FileKind.IMAGE;
    if (["txt", "js", "json", "md", "html", "css"].includes(ext)) return FileKind.TEXT;
    if (["mp4", "webm", "mov", "avi", "mkv"].includes(ext)) return FileKind.VIDEO;
    return FileKind.OTHER;
  }

  resolveDir(path = []) {
    if (typeof path === "string") {
      if (path.startsWith("/")) return path;
      path = [path];
    }
    return this.join("/", ...this.CONFIG.ROOT.split("/").filter(Boolean), ...this.normalizePath(path));
  }

  async ensureFolder(path) {
    await this.fsReady;
    const dir = this.resolveDir(path);
    await this.p("mkdir", dir, { recursive: true }).catch(() => {});
  }

  async getFolder(path) {
    await this.fsReady;
    const dir = this.resolveDir(path);

    let entries;
    try {
      entries = await new Promise((res, rej) => {
        this.fs.readdir(dir, (e, list) => (e ? rej(e) : res(list)));
      });
    } catch {
      throw new Error(`Invalid path: ${JSON.stringify(path)}`);
    }

    const meta = await this.readMeta(dir);
    const result = {};

    for (const name of entries) {
      if (name === this.CONFIG.META_FILE) continue;
      const full = this.join(dir, name);
      const stat = await this.pStat(full);
      if (stat.isDirectory()) {
        result[name] = {};
      } else {
        const kind = meta[name]?.kind ?? this.inferKind(name);
        const icon = meta[name]?.icon ?? "/static/icons/file.webp";
        const faIcon = meta[name]?.faIcon ?? null;
        result[name] = { type: "file", kind, icon, faIcon, content: "" };
      }
    }

    return result;
  }

  async getUniqueFileName(path, name) {
    await this.fsReady;
    const dir = this.resolveDir(path);
    const dotIndex = name.lastIndexOf(".");
    const hasExt = dotIndex > 0;
    const base = hasExt ? name.slice(0, dotIndex) : name;
    const ext = hasExt ? name.slice(dotIndex) : "";
    let candidate = name;
    let counter = 1;
    while (await this.exists(this.join(dir, candidate))) {
      candidate = `${base} (${counter})${ext}`;
      counter++;
    }
    return candidate;
  }

  async createFile(path, name, content = "", kind = null, icon = null, faIcon = null) {
    await this.fsReady;
    const uniqueName = await this.getUniqueFileName(path, name);
    const dir = this.resolveDir(path);
    const filePath = this.join(dir, uniqueName);
    const fileKind = kind || this.inferKind(uniqueName);
    const fileIcon = icon || (fileKind === FileKind.TEXT ? "/static/icons/notepad.webp" : "/static/icons/file.webp");
    await this.p("mkdir", dir, { recursive: true }).catch(() => {});
    await this.p("writeFile", filePath, content);
    await this.writeMeta(dir, uniqueName, { kind: fileKind, icon: fileIcon, faIcon });
    await this.notifyDesktopChange(path);
    return uniqueName;
  }

  async createFolder(path, name) {
    await this.fsReady;
    const uniqueName = await this.getUniqueFileName(path, name);
    const dir = this.join(this.resolveDir(path), uniqueName);
    await this.p("mkdir", dir, { recursive: true });
    await this.notifyDesktopChange(path);
    return uniqueName;
  }

  async deleteItem(path, name) {
    await this.fsReady;
    const dir = this.resolveDir(path);
    const target = this.join(dir, name);
    const stat = await this.pStat(target);
    if (stat.isDirectory()) {
      await this.deleteDirectoryRecursive(target);
    } else {
      await this.p("unlink", target);
      await this.removeMeta(dir, name);
    }
    await this.notifyDesktopChange(path);
  }

  async deleteDirectoryRecursive(dirPath) {
    const entries = await this.pRead("readdir", dirPath);
    for (const entry of entries) {
      const fullPath = this.join(dirPath, entry);
      const stat = await this.pStat(fullPath);
      if (stat.isDirectory()) {
        await this.deleteDirectoryRecursive(fullPath);
      } else {
        await this.p("unlink", fullPath);
      }
    }
    await this.p("rmdir", dirPath);
  }

  async renameItem(path, oldName, newName) {
    await this.fsReady;
    const dir = this.resolveDir(path);
    if (oldName !== newName && (await this.exists(this.join(dir, newName)))) {
      throw new Error(`A file or folder named "${newName}" already exists.`);
    }
    await this.p("rename", this.join(dir, oldName), this.join(dir, newName));
    const release = await this._acquireMeta(dir);
    try {
      const meta = await this.readMeta(dir);
      if (meta[oldName]) {
        meta[newName] = meta[oldName];
        delete meta[oldName];
        await this.p("writeFile", this.join(dir, this.CONFIG.META_FILE), JSON.stringify(meta));
      }
    } finally {
      release();
    }
    await this.notifyDesktopChange(path);
  }

  async updateFile(path, name, content) {
    await this.fsReady;
    const dir = this.resolveDir(path);
    const filePath = this.join(dir, name);
    const exists = await this.exists(filePath);
    if (!exists) {
      const kind = this.inferKind(name);
      const icon = kind === FileKind.TEXT ? "/static/icons/notepad.webp" : "/static/icons/file.webp";
      await this.createFile(path, name, content, kind, icon);
    } else {
      await this.p("writeFile", filePath, content);
      await this.notifyDesktopChange(path);
    }
  }

  async getFileContent(path, name) {
    await this.fsReady;
    try {
      return await this.pRead("readFile", this.join(this.resolveDir(path), name), "utf8");
    } catch {
      return "";
    }
  }

  async getFileKind(path, name) {
    await this.fsReady;
    const meta = await this.readMeta(this.resolveDir(path));
    return meta[name]?.kind ?? null;
  }

  async getFileIcon(path, name) {
    await this.fsReady;
    const meta = await this.readMeta(this.resolveDir(path));
    return meta[name]?.icon ?? null;
  }

  async getFileFaIcon(path, name) {
    await this.fsReady;
    const meta = await this.readMeta(this.resolveDir(path));
    return meta[name]?.faIcon ?? null;
  }

  isFile(path, name) {
    try {
      return this.fs.statSync(this.join(this.resolveDir(path), name)).isFile();
    } catch {
      return false;
    }
  }

  async writeFile(filePath, content) {
    await this.p("writeFile", filePath, content);
  }

  async readFile(filePath) {
    return await this.pRead("readFile", filePath, "utf8");
  }

  async exists(filePath) {
    try {
      await this.pStat(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async writeBinaryFile(folderPath, name, blob, kind = null, icon = null) {
    await this.fsReady;
    const uniqueName = await this.getUniqueFileName(folderPath, name);
    const dir = this.resolveDir(folderPath);
    const fullPath = this.join(dir, uniqueName);
    const inferredKind = kind || this.inferKind(name);

    let defaultIcon = "/static/icons/file.webp";
    if (inferredKind === FileKind.IMAGE) defaultIcon = "fas fa-image";
    if (inferredKind === FileKind.VIDEO) defaultIcon = "fas fa-film";
    if (inferredKind === FileKind.TEXT) defaultIcon = "/static/icons/notepad.webp";

    const fileKind = inferredKind;
    const fileIcon = icon || defaultIcon;

    await this.p("mkdir", dir, { recursive: true }).catch(() => {});
    await this.p("writeFile", fullPath, "");
    const fileSize = blob instanceof Blob ? blob.size : 0;
    await this.writeMeta(dir, uniqueName, { kind: fileKind, icon: fileIcon, size: fileSize });

    await new Promise((resolve, reject) => {
      const tx = this.blobDB.transaction("blobs", "readwrite");
      tx.objectStore("blobs").put({ path: fullPath, blob });
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });

    await this.notifyDesktopChange(folderPath);
    return uniqueName;
  }

  async readBinaryFile(folderPath, name) {
    await this.fsReady;
    const fullPath = this.join(this.resolveDir(folderPath), name);
    return new Promise((resolve, reject) => {
      const tx = this.blobDB.transaction("blobs", "readonly");
      const req = tx.objectStore("blobs").get(fullPath);
      req.onsuccess = () => resolve(req.result?.blob ?? null);
      req.onerror = reject;
    });
  }

  async deleteBinaryFile(folderPath, name) {
    await this.fsReady;
    const dir = this.resolveDir(folderPath);
    const fullPath = this.join(dir, name);

    await this.p("unlink", fullPath).catch(() => {});
    await this.removeMeta(dir, name);

    await new Promise((resolve, reject) => {
      const tx = this.blobDB.transaction("blobs", "readwrite");
      tx.objectStore("blobs").delete(fullPath);
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });

    await this.notifyDesktopChange(folderPath);
  }

  async renameBinaryFile(folderPath, oldName, newName) {
    await this.fsReady;
    const dir = this.resolveDir(folderPath);
    const oldPath = this.join(dir, oldName);
    const newPath = this.join(dir, newName);

    if (oldName !== newName && (await this.exists(newPath))) {
      throw new Error(`A file named "${newName}" already exists.`);
    }

    await this.p("rename", oldPath, newPath);

    const release = await this._acquireMeta(dir);
    try {
      const meta = await this.readMeta(dir);
      if (meta[oldName]) {
        meta[newName] = meta[oldName];
        delete meta[oldName];
        await this.p("writeFile", this.join(dir, this.CONFIG.META_FILE), JSON.stringify(meta));
      }
    } finally {
      release();
    }

    await new Promise((resolve, reject) => {
      const tx = this.blobDB.transaction("blobs", "readwrite");
      const store = tx.objectStore("blobs");
      const req = store.get(oldPath);
      req.onsuccess = () => {
        if (req.result) {
          store.delete(oldPath);
          store.put({ path: newPath, blob: req.result.blob });
        }
        resolve();
      };
      req.onerror = reject;
    });

    await this.notifyDesktopChange(folderPath);
  }
}
