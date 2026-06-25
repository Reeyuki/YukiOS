import { CDN_BASES, resolveIconUrl } from "./shared/assetResolver.js";
import { audioMixer } from "./audioMixer.js";
import { StorageAdapter } from "./fs/StorageAdapter.js";
import { MetadataManager } from "./fs/MetadataManager.js";
import { PathResolver } from "./fs/PathResolver.js";
import { FileKindDetector, FileKind } from "./fs/FileKindDetector.js";
import { BlobStorage } from "./fs/BlobStorage.js";
import { TrashManager } from "./fs/TrashManager.js";

import { StorageKeys, os } from "./framework.js";
export { FileKind };

import { DEFAULT_WALLPAPER_FILES, WALLPAPER_STATIC_DIR } from "./wallpaperConfig.js";

const DEFAULT_STATICALLY_GH_BASE = CDN_BASES.MAIN;
export { DEFAULT_WALLPAPER_FILES, WALLPAPER_STATIC_DIR as DEFAULT_WALLPAPER_STATIC_DIR };

function defaultWallpaperUrl(nameOrPath) {
  if (typeof nameOrPath !== "string") return nameOrPath;
  if (nameOrPath.startsWith("http://") || nameOrPath.startsWith("https://")) return nameOrPath;
  if (nameOrPath.startsWith(WALLPAPER_STATIC_DIR)) return `${DEFAULT_STATICALLY_GH_BASE}${nameOrPath}`;
  return `${DEFAULT_STATICALLY_GH_BASE}${WALLPAPER_STATIC_DIR}${nameOrPath}`;
}

const WALLPAPER_STATICALLY_GH_BASE = CDN_BASES.MAIN;
function isBlob(obj) {
  if (!obj) return false;
  return (
    obj instanceof Blob ||
    (typeof obj === "object" &&
      typeof obj.size === "number" &&
      typeof obj.type === "string" &&
      typeof obj.slice === "function")
  );
}

export const defaultStorage = {
  home: {
    reeyuki: {
      Desktop: {},
      Documents: {
        "INFO.txt": {
          type: "file",
          content: "Welcome aboard!\n\nYou can write and save text files using the Notepad app.",
          kind: FileKind.TEXT,
          icon: "static/icons/notepad.webp"
        },
        "YukiOS.md": {
          type: "file",
          content: typeof __README_CONTENT__ !== "undefined" ? __README_CONTENT__ : "# YukiOS\n",
          kind: FileKind.TEXT,
          icon: "static/icons/notepad.webp"
        }
      },
      Music: {
        "new_look_mii_maker_lofi_mix.mp3": {
          type: "file",
          content: resolveIconUrl("static/audio/new_look_mii_maker_lofi_mix.mp3"),
          kind: FileKind.AUDIO,
          icon: resolveIconUrl("static/audio/new_look_mii_maker_lofi_mix.mp3")
        }
      },
      Pictures: {
        "gandalf.gif": {
          type: "file",
          content: resolveIconUrl("static/gandalf.gif"),
          kind: FileKind.IMAGE,
          icon: resolveIconUrl("static/gandalf.gif")
        },
        Wallpapers: {
          "wallpaper1.webp": {
            type: "file",
            content: defaultWallpaperUrl("wallpaper1.webp"),
            kind: FileKind.IMAGE,
            icon: defaultWallpaperUrl("wallpaper1.webp")
          },
          "wallpaper2.webp": {
            type: "file",
            content: defaultWallpaperUrl("wallpaper2.webp"),
            kind: FileKind.IMAGE,
            icon: defaultWallpaperUrl("wallpaper2.webp")
          },
          "wallpaper3.webp": {
            type: "file",
            content: defaultWallpaperUrl("wallpaper3.webp"),
            kind: FileKind.IMAGE,
            icon: defaultWallpaperUrl("wallpaper3.webp")
          },
          "wallpaper4.webp": {
            type: "file",
            content: defaultWallpaperUrl("wallpaper4.webp"),
            kind: FileKind.IMAGE,
            icon: defaultWallpaperUrl("wallpaper4.webp")
          },
          "wallpaper5.webp": {
            type: "file",
            content: defaultWallpaperUrl("wallpaper5.webp"),
            kind: FileKind.IMAGE,
            icon: defaultWallpaperUrl("wallpaper5.webp")
          },
          "wallpaper6.webp": {
            type: "file",
            content: defaultWallpaperUrl("wallpaper6.webp"),
            kind: FileKind.IMAGE,
            icon: defaultWallpaperUrl("wallpaper6.webp")
          },
          "wallpaper7.webp": {
            type: "file",
            content: defaultWallpaperUrl("wallpaper7.webp"),
            kind: FileKind.IMAGE,
            icon: defaultWallpaperUrl("wallpaper7.webp")
          },
          "wallpaper8.webp": {
            type: "file",
            content: defaultWallpaperUrl("wallpaper8.webp"),
            kind: FileKind.IMAGE,
            icon: defaultWallpaperUrl("wallpaper8.webp")
          },
          "wallpaper9.webp": {
            type: "file",
            content: defaultWallpaperUrl("wallpaper9.webp"),
            kind: FileKind.IMAGE,
            icon: defaultWallpaperUrl("wallpaper9.webp")
          },
          "wallpaper10.webp": {
            type: "file",
            content: defaultWallpaperUrl("wallpaper10.webp"),
            kind: FileKind.IMAGE,
            icon: defaultWallpaperUrl("wallpaper10.webp")
          },
          "wallpaper11.webp": {
            type: "file",
            content: defaultWallpaperUrl("wallpaper11.webp"),
            kind: FileKind.IMAGE,
            icon: defaultWallpaperUrl("wallpaper11.webp")
          },
          "wallpaper12.png": {
            type: "file",
            content: defaultWallpaperUrl("wallpaper12.png"),
            kind: FileKind.IMAGE,
            icon: defaultWallpaperUrl("wallpaper12.png")
          },
          "wallpaper13.png": {
            type: "file",
            content: defaultWallpaperUrl("wallpaper13.png"),
            kind: FileKind.IMAGE,
            icon: defaultWallpaperUrl("wallpaper13.png")
          },
          "mint.webp": {
            type: "file",
            content: defaultWallpaperUrl("mint.webp"),
            kind: FileKind.IMAGE,
            icon: defaultWallpaperUrl("mint.webp")
          },
          "redwin10.jpg": {
            type: "file",
            content: defaultWallpaperUrl("redwin10.jpg"),
            kind: FileKind.IMAGE,
            icon: defaultWallpaperUrl("redwin10.jpg")
          },
          "win7.webp": {
            type: "file",
            content: defaultWallpaperUrl("win7.webp"),
            kind: FileKind.IMAGE,
            icon: defaultWallpaperUrl("win7.webp")
          },
          "win10.webp": {
            type: "file",
            content: defaultWallpaperUrl("win10.webp"),
            kind: FileKind.IMAGE,
            icon: defaultWallpaperUrl("win10.webp")
          },
          "win11.webp": {
            type: "file",
            content: defaultWallpaperUrl("win11.webp"),
            kind: FileKind.IMAGE,
            icon: defaultWallpaperUrl("win11.webp")
          },
          "xp.webp": {
            type: "file",
            content: defaultWallpaperUrl("xp.webp"),
            kind: FileKind.IMAGE,
            icon: defaultWallpaperUrl("xp.webp")
          }
        }
      },
      Videos: {}
    }
  }
};

export class FileSystemManager {
  constructor() {
    this.CONFIG = {
      GRID_SIZE: 80,
      ROOT: "/home/guest",
      USER_BASE: "/ys/users",
      META_FILE: ".meta.json"
    };
    this.sessionKey = "guest";
    this.desktopUI = null;

    this.storage = new StorageAdapter(this.CONFIG);
    this.metadata = new MetadataManager(this.storage, this.CONFIG);
    this.paths = new PathResolver(this.CONFIG);
    this.detector = new FileKindDetector();
    this.blobs = new BlobStorage();
    this.trash = new TrashManager(this);

    this.fsReady = this.storage.fsReady;
    this._resolveFs = this.storage._resolveFs;
  }

  _uint8ToBase64(uint8) {
    const bytes = uint8 instanceof Uint8Array ? uint8 : new Uint8Array(uint8);
    const chunkSize = 0x8000;
    let binary = "";
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  _base64ToUint8(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  setDesktopUI(desktopUI) {
    this.desktopUI = desktopUI;
  }

  isDesktopPath(path) {
    const desktopPath = this.paths.join(this.CONFIG.ROOT, "Desktop");
    const resolvedPath = this.paths.resolveUserPath(path);
    return resolvedPath === desktopPath || resolvedPath.startsWith(desktopPath + "/");
  }

  async notifyDesktopChange(path) {
    if (this.desktopUI && this.isDesktopPath(path)) {
      await this.desktopUI.loadDesktopItems();
    }
  }

  p(method, ...args) {
    return this.storage.p(method, ...args);
  }

  async safeWriteFile(path, content) {
    return this.storage.safeWriteFile(path, content);
  }

  pRead(method, ...args) {
    return this.storage.pRead(method, ...args);
  }

  pStat(path) {
    return this.storage.pStat(path);
  }

  async initFS(sessionKey = "guest") {
    this.sessionKey = sessionKey;
    this.CONFIG.ROOT = `${this.CONFIG.USER_BASE}/${sessionKey}`;

    if (this.storage.fs) return this.fsReady;

    const attemptInit = async () => {
      try {
        await this.storage.initFS(sessionKey);
        await this.blobs.initBlobDB();
        await this.ensureDefaults();
        await this.trash.init();
      } catch (e) {
        console.error("BrowserFS initialization failed:", e);
        try {
          await this.storage._clearIndexedDB();
          console.log("Cleared IndexedDB, retrying initialization...");
          setTimeout(attemptInit, 100);
        } catch (clearErr) {
          console.error("Failed to clear IndexedDB:", clearErr);
        }
      }
    };
    attemptInit();
    return this.fsReady;
  }

  async setSession(sessionKey) {
    this.sessionKey = sessionKey;
    this.CONFIG.ROOT = `${this.CONFIG.USER_BASE}/${sessionKey}`;
    if (this.storage.fs) {
      await this.ensureDefaults();
    } else {
      await this.initFS(sessionKey);
    }
    if (this.desktopUI) {
      await this.desktopUI.loadDesktopItems();
    }
  }

  async exportSnapshot() {
    await this.fsReady;

    const root = this.CONFIG.ROOT;
    const entries = [];

    const normalizeBytes = (data) => {
      if (!data) return new Uint8Array();
      if (data instanceof Uint8Array) return data;
      if (data.buffer && typeof data.byteLength === "number") {
        return new Uint8Array(data.buffer, data.byteOffset || 0, data.byteLength);
      }
      if (data instanceof ArrayBuffer) return new Uint8Array(data);
      try {
        return new Uint8Array(data);
      } catch {
        return new Uint8Array();
      }
    };

    const walk = async (dirPath) => {
      entries.push({ type: "dir", path: dirPath });
      let names = [];
      try {
        names = await this.pRead("readdir", dirPath);
      } catch {
        return;
      }

      for (const name of names) {
        const fullPath = this.paths.join(dirPath, name);
        let stat;
        try {
          stat = await this.pStat(fullPath);
        } catch {
          continue;
        }
        if (stat.isDirectory()) {
          await walk(fullPath);
          continue;
        }

        const blob = await this.blobs._getBlobByFullPath(fullPath).catch(() => null);
        if (blob) {
          const bytes = new Uint8Array(await blob.arrayBuffer());
          entries.push({
            type: "file",
            path: fullPath,
            isBlob: true,
            mime: blob.type || "application/octet-stream",
            dataB64: this._uint8ToBase64(bytes)
          });
          continue;
        }

        let data;
        try {
          data = await this.pRead("readFile", fullPath);
        } catch {
          data = null;
        }
        const bytes = normalizeBytes(data);
        entries.push({
          type: "file",
          path: fullPath,
          isBlob: false,
          dataB64: this._uint8ToBase64(bytes)
        });
      }
    };

    await walk(root);
    return { version: 1, root, entries, createdAt: Date.now() };
  }

  async importSnapshot(snapshot, { wipe = true } = {}) {
    await this.fsReady;
    if (!snapshot || snapshot.version !== 1 || !Array.isArray(snapshot.entries) || typeof snapshot.root !== "string") {
      audioMixer().playCriticalWarning();
      throw new Error("Invalid snapshot format.");
    }
    if (snapshot.root !== this.CONFIG.ROOT) {
      audioMixer().playCriticalWarning();
      throw new Error(`Snapshot root mismatch. Expected ${this.CONFIG.ROOT}, got ${snapshot.root}.`);
    }

    if (wipe) {
      await this.blobs._clearBlobStore();
      const rootStatOk = await this.exists(this.CONFIG.ROOT).catch(() => false);
      if (rootStatOk) {
        await this.deleteDirectoryRecursive(this.CONFIG.ROOT).catch(() => {});
      }
      await this.p("mkdir", this.CONFIG.ROOT, { recursive: true }).catch(() => {});
    }

    const dirs = snapshot.entries.filter((e) => e && e.type === "dir" && typeof e.path === "string");
    const files = snapshot.entries.filter((e) => e && e.type === "file" && typeof e.path === "string");

    dirs.sort((a, b) => a.path.length - b.path.length);
    for (const d of dirs) {
      await this.p("mkdir", d.path, { recursive: true }).catch(() => {});
    }

    for (const f of files) {
      await this.p("mkdir", this.paths.dirname(f.path), { recursive: true }).catch(() => {});
      const bytes = this._base64ToUint8(f.dataB64 || "");
      if (f.isBlob) {
        try {
          await this.safeWriteFile(f.path, new Uint8Array([0]));
          const mime = typeof f.mime === "string" && f.mime ? f.mime : "application/octet-stream";
          await this.blobs._putBlob(f.path, new Blob([bytes], { type: mime }));
        } catch (e) {
          console.warn(`Failed to import blob file ${f.path}:`, e);
          await this.safeWriteFile(f.path, bytes);
        }
      } else {
        await this.safeWriteFile(f.path, bytes);
      }
    }

    await this.ensureDefaults().catch(() => {});
    await this.notifyDesktopChange(["Desktop"]).catch(() => {});
  }

  async ensureDefaults() {
    const defaultsCreatedKey = StorageKeys.defaultsCreatedPrefix + this.sessionKey;
    if (os.storage.get(defaultsCreatedKey) === "true") {
      const homeExists = await this.exists(this.CONFIG.ROOT);
      if (homeExists) {
        return;
      }
    }

    const userHome = {
      [this.sessionKey]: defaultStorage.home.reeyuki
    };
    const sessionDefaultStorage = {
      ys: {
        users: userHome
      }
    };

    await this.createFromObject(sessionDefaultStorage, "/");
    await this.migrateDefaultWallpapers();
    os.storage.set(defaultsCreatedKey, "true");
  }

  async migrateDefaultWallpapers() {
    const migrationKey = StorageKeys.wallpaperMigratedPrefix + this.sessionKey;
    if (os.storage.get(migrationKey) === "true") {
      return;
    }

    const folderPath = ["Pictures", "Wallpapers"];
    const dir = this.paths.resolveUserPath(folderPath);

    for (const name of DEFAULT_WALLPAPER_FILES) {
      const fullPath = this.paths.join(dir, name);
      const exists = await this.exists(fullPath);
      if (!exists) continue;

      let current;
      try {
        current = await this.pRead("readFile", fullPath, "utf8");
      } catch {
        continue;
      }

      const oldRelative = `${WALLPAPER_STATIC_DIR}${name}`;
      if (current === oldRelative) {
        await this.p("writeFile", fullPath, defaultWallpaperUrl(name));
      }
    }
    os.storage.set(migrationKey, "true");
  }

  async createFromObject(obj, basePath) {
    for (const key in obj) {
      const value = obj[key];
      const fullPath = this.paths.join(basePath, key);
      if (value.type === "file") {
        const exists = await this.exists(fullPath);
        if (!exists) {
          await this.p("mkdir", this.paths.dirname(fullPath), { recursive: true }).catch(() => {});
          await this.p("writeFile", fullPath, value.content ?? "");
          await this.metadata.writeMeta(this.paths.dirname(fullPath), key, {
            ...value,
            size: (value.content ?? "").length
          });
        } else {
        }
      } else {
        const exists = await this.exists(fullPath);
        if (!exists) {
          await this.p("mkdir", fullPath, { recursive: true }).catch(() => {});
        }
        await this.createFromObject(value, fullPath);
      }
    }
  }

  join(...parts) {
    return this.paths.join(...parts);
  }

  dirname(path) {
    return this.paths.dirname(path);
  }

  basename(path) {
    return this.paths.basename(path);
  }

  async readMeta(dir) {
    return this.metadata.readMeta(dir);
  }

  async writeMeta(dir, name, data) {
    return this.metadata.writeMeta(dir, name, data);
  }

  async removeMeta(dir, name) {
    return this.metadata.removeMeta(dir, name);
  }

  normalizePath(path) {
    return this.paths.normalizePath(path);
  }

  resolvePath(input, currentPath = []) {
    return this.paths.resolvePath(input, currentPath);
  }

  inferKind(fileName) {
    return this.detector.inferKind(fileName);
  }

  resolveUserPath(path = []) {
    return this.paths.resolveUserPath(path);
  }

  async ensureFolder(path) {
    await this.fsReady;
    const dir = this.paths.resolveUserPath(path);
    const segments = dir.split("/").filter(Boolean);
    let current = "";
    for (const seg of segments) {
      current += "/" + seg;
      await this.p("mkdir", current, { recursive: true }).catch(() => {});
    }
  }

  async getFolder(path) {
    await this.fsReady;
    const dir = this.paths.resolveUserPath(path);

    let entries;
    try {
      entries = await this.storage.readdir(dir);
    } catch {
      try {
        await this.ensureFolder(path);
        entries = await this.storage.readdir(dir);
      } catch (err) {
        console.warn(`Filesystem recovery failed for ${dir}:`, err);
        return {};
      }
    }

    const meta = await this.readMeta(dir);
    const result = {};

    for (const name of entries) {
      if (name === this.CONFIG.META_FILE) continue;
      if (name === ".trash" && dir === this.CONFIG.ROOT) continue;
      const full = this.paths.join(dir, name);
      let stat;
      try {
        stat = await this.pStat(full);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        result[name] = {};
      } else {
        const kind = meta[name]?.kind ?? this.inferKind(name);
        const icon = resolveIconUrl(meta[name]?.icon) ?? "static/icons/file.webp";
        const faIcon = meta[name]?.faIcon ?? null;
        result[name] = { type: "file", kind, icon, faIcon, content: "", size: meta[name]?.size ?? 0 };
      }
    }

    return result;
  }

  async readTextFile(path, name) {
    await this.fsReady;
    const dir = this.paths.resolveUserPath(path);
    const fullPath = this.paths.join(dir, name);
    try {
      return await this.pRead("readFile", fullPath, "utf8");
    } catch {
      return null;
    }
  }

  async getUniqueFileName(path, name) {
    await this.fsReady;
    const dir = this.paths.resolveUserPath(path);
    const dotIndex = name.lastIndexOf(".");
    const hasExt = dotIndex > 0;
    const base = hasExt ? name.slice(0, dotIndex) : name;
    const ext = hasExt ? name.slice(dotIndex) : "";
    let candidate = name;
    let counter = 1;
    while (await this.exists(this.paths.join(dir, candidate))) {
      candidate = `${base} (${counter})${ext}`;
      counter++;
    }
    return candidate;
  }

  async createFile(path, name, content = "", kind = null, icon = null, faIcon = null) {
    await this.fsReady;
    const uniqueName = await this.getUniqueFileName(path, name);
    const dir = this.paths.resolveUserPath(path);
    const filePath = this.paths.join(dir, uniqueName);
    const fileKind = kind || this.inferKind(uniqueName);
    const fileIcon = icon || (fileKind === FileKind.TEXT ? "static/icons/notepad.webp" : "static/icons/file.webp");
    await this.p("mkdir", dir, { recursive: true }).catch(() => {});
    if (isBlob(content)) {
      const typedBlob = content.type ? content : new Blob([content], { type: this.detector._mimeFromName(uniqueName) });
      await this.p("writeFile", filePath, "");
      await this.metadata.writeMeta(dir, uniqueName, { kind: fileKind, icon: fileIcon, faIcon, size: typedBlob.size });
      await this.blobs._putBlob(filePath, typedBlob);
    } else {
      await this.p("writeFile", filePath, content);
      await this.metadata.writeMeta(dir, uniqueName, { kind: fileKind, icon: fileIcon, faIcon, size: content.length });
    }
    await this.notifyDesktopChange(path);
    return uniqueName;
  }

  async createFolder(path, name) {
    await this.fsReady;
    const uniqueName = await this.getUniqueFileName(path, name);
    const dir = this.paths.join(this.paths.resolveUserPath(path), uniqueName);
    await this.p("mkdir", dir, { recursive: true });
    await this.notifyDesktopChange(path);
    return uniqueName;
  }

  async deleteItem(path, name) {
    await this.fsReady;
    const dir = this.paths.resolveUserPath(path);
    const target = this.paths.join(dir, name);
    const stat = await this.pStat(target);
    if (stat.isDirectory()) {
      await this.deleteDirectoryRecursive(target);
    } else {
      await this.p("unlink", target);
      await this.metadata.removeMeta(dir, name);
      await this.blobs._deleteBlobByFullPath(this.paths.join(dir, name));
    }
    await this.notifyDesktopChange(path);
  }

  async deleteDirectoryRecursive(dirPath) {
    const entries = await this.pRead("readdir", dirPath);
    for (const entry of entries) {
      const fullPath = this.paths.join(dirPath, entry);
      const stat = await this.pStat(fullPath);
      if (stat.isDirectory()) {
        await this.deleteDirectoryRecursive(fullPath);
      } else {
        await this.p("unlink", fullPath);
        await this.blobs._deleteBlobByFullPath(fullPath);
      }
    }
    await this.p("rmdir", dirPath);
  }

  async renameItem(path, oldName, newName, skipNotify = false) {
    await this.fsReady;
    const dir = this.paths.resolveUserPath(path);
    const oldPath = this.paths.join(dir, oldName);
    const newPath = this.paths.join(dir, newName);

    if (oldName !== newName && (await this.exists(newPath))) {
      throw new Error(`A file or folder named "${newName}" already exists.`);
    }

    await this.p("rename", oldPath, newPath);

    const release = await this.metadata._acquireMeta(dir);
    try {
      const meta = await this.readMeta(dir);
      if (meta[oldName]) {
        meta[newName] = meta[oldName];
        delete meta[oldName];
        await this.p("writeFile", this.paths.join(dir, this.CONFIG.META_FILE), JSON.stringify(meta));
      }
    } finally {
      release();
    }

    await this.blobs._renameBlobByFullPath(oldPath, newPath);
    if (!skipNotify) await this.notifyDesktopChange(path);
  }

  async updateFile(path, name, content, meta = {}) {
    await this.fsReady;
    const dir = this.paths.resolveUserPath(path);
    const filePath = this.paths.join(dir, name);
    const exists = await this.exists(filePath);
    if (!exists) {
      const kind = this.inferKind(name);
      const icon = kind === FileKind.TEXT ? "static/icons/notepad.webp" : "static/icons/file.webp";
      await this.createFile(path, name, content, kind, icon);
    } else if (isBlob(content)) {
      const typedBlob = content.type ? content : new Blob([content], { type: this.detector._mimeFromName(name) });
      await this.p("writeFile", filePath, "");
      await this.blobs._putBlob(filePath, typedBlob);
      await this.metadata.writeMeta(dir, name, { size: typedBlob.size });
      await this.notifyDesktopChange(path);
    } else {
      await this.p("writeFile", filePath, content);
      await this.metadata.writeMeta(dir, name, { size: content.length });
      await this.notifyDesktopChange(path);
    }
  }

  _mimeFromName(name) {
    return this.detector._mimeFromName(name);
  }

  _isBinaryName(name) {
    return this.detector._isBinaryName(name);
  }

  async getFileContent(path, name) {
    await this.fsReady;
    const dir = this.paths.resolveUserPath(path);
    const fullPath = this.paths.join(dir, name);

    const blob = await this.blobs._getBlobByFullPath(fullPath);
    if (blob) {
      return blob.type ? blob : new Blob([blob], { type: this.detector._mimeFromName(name) });
    }

    try {
      const text = await this.pRead("readFile", fullPath, "utf8");

      if (!text) {
        return "";
      }
      if (
        typeof text === "string" &&
        this._isBinaryName(name) &&
        !text.startsWith("data:") &&
        !text.startsWith("http") &&
        !text.startsWith("/")
      ) {
        return null;
      }
      if (text.startsWith("data:") || text.startsWith("http") || text.startsWith("/")) {
        return resolveIconUrl(text);
      }
      return text;
    } catch (e) {
      const entries = await this.pRead("readdir", dir).catch(() => []);
      return "";
    }
  }

  async getFileKind(path, name) {
    await this.fsReady;
    const meta = await this.readMeta(this.paths.resolveUserPath(path));
    return meta[name]?.kind ?? null;
  }

  async getFileIcon(path, name) {
    await this.fsReady;
    const meta = await this.readMeta(this.paths.resolveUserPath(path));
    return meta[name]?.icon ?? null;
  }

  async getFileFaIcon(path, name) {
    await this.fsReady;
    const meta = await this.readMeta(this.paths.resolveUserPath(path));
    return meta[name]?.faIcon ?? null;
  }

  isFile(path, name) {
    try {
      return this.storage.statSync(this.paths.join(this.paths.resolveUserPath(path), name)).isFile();
    } catch {
      return false;
    }
  }

  async writeFile(filePath, content) {
    await this.storage.writeFile(filePath, content);
  }

  async readFile(filePath) {
    return await this.storage.readFile(filePath);
  }

  async exists(path) {
    return this.storage.exists(path);
  }

  async writeBinaryFile(folderPath, name, blob, kind = null, icon = null) {
    await this.fsReady;
    const uniqueName = await this.getUniqueFileName(folderPath, name);
    const dir = this.paths.resolveUserPath(folderPath);
    const fullPath = this.paths.join(dir, uniqueName);
    const fileKind = kind || this.inferKind(name);

    const iconMap = {
      [FileKind.IMAGE]: "@content",
      [FileKind.VIDEO]: "fas fa-camera",
      [FileKind.AUDIO]: "/static/icons/spot.webp",
      [FileKind.TEXT]: "static/icons/notepad.webp"
    };
    const fileIcon = icon || iconMap[fileKind] || "static/icons/file.webp";
    const fileSize = isBlob(blob) ? blob.size : 0;

    await this.p("mkdir", dir, { recursive: true }).catch(() => {});
    const typedBlob = isBlob(blob) && !blob.type ? new Blob([blob], { type: this.detector._mimeFromName(name) }) : blob;
    await this.p("writeFile", fullPath, "");
    await this.metadata.writeMeta(dir, uniqueName, { kind: fileKind, icon: fileIcon, size: fileSize });
    await this.blobs._putBlob(fullPath, typedBlob);
    await this.notifyDesktopChange(folderPath);
    return uniqueName;
  }

  async readBinaryFile(folderPath, name) {
    await this.fsReady;
    const dir = this.paths.resolveUserPath(folderPath);
    const fullPath = this.paths.join(dir, name);
    const blob = await this.blobs._getBlobByFullPath(fullPath);
    if (!blob) {
      return null;
    }
    return blob.type ? blob : new Blob([blob], { type: this.detector._mimeFromName(name) });
  }

  async deleteBinaryFile(folderPath, name) {
    await this.fsReady;
    const dir = this.paths.resolveUserPath(folderPath);
    const fullPath = this.paths.join(dir, name);
    await this.p("unlink", fullPath).catch(() => {});
    await this.metadata.removeMeta(dir, name);
    await this.blobs._deleteBlobByFullPath(fullPath);
    await this.notifyDesktopChange(folderPath);
  }

  async renameBinaryFile(folderPath, oldName, newName) {
    await this.fsReady;
    const dir = this.paths.resolveUserPath(folderPath);
    const oldPath = this.paths.join(dir, oldName);
    const newPath = this.paths.join(dir, newName);

    if (oldName !== newName && (await this.exists(newPath))) {
      throw new Error(`A file named "${newName}" already exists.`);
    }

    await this.p("rename", oldPath, newPath);

    const release = await this.metadata._acquireMeta(dir);
    try {
      const meta = await this.readMeta(dir);
      if (meta[oldName]) {
        meta[newName] = meta[oldName];
        delete meta[oldName];
        await this.p("writeFile", this.paths.join(dir, this.CONFIG.META_FILE), JSON.stringify(meta));
      }
    } finally {
      release();
    }

    await this.blobs._renameBlobByFullPath(oldPath, newPath);
    await this.notifyDesktopChange(folderPath);
  }
}
