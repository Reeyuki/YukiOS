import BrowserFS from "browserfs";
import { CDN_BASES, resolveWallpaperUrl } from "./shared/assetResolver.js";

export const FileKind = { TEXT: "text", IMAGE: "image", VIDEO: "video", AUDIO: "audio", ROM: "rom", OTHER: "other" };

const DEFAULT_STATICALLY_GH_BASE = CDN_BASES.MAIN;
const DEFAULT_WALLPAPER_STATIC_DIR = "/static/wallpapers/";
const DEFAULT_WALLPAPER_FILES = [
  "wallpaper1.webp",
  "wallpaper2.webp",
  "wallpaper3.webp",
  "wallpaper4.webp",
  "wallpaper5.webp",
  "wallpaper6.webp",
  "wallpaper7.webp",
  "wallpaper8.webp",
  "wallpaper9.webp",
  "wallpaper10.webp",
  "wallpaper11.webp",
  "wallpaper12.png",
  "wallpaper13.png"
];

function defaultWallpaperUrl(nameOrPath) {
  if (typeof nameOrPath !== "string") return nameOrPath;
  if (nameOrPath.startsWith("http://") || nameOrPath.startsWith("https://")) return nameOrPath;
  if (nameOrPath.startsWith(DEFAULT_WALLPAPER_STATIC_DIR)) return `${DEFAULT_STATICALLY_GH_BASE}${nameOrPath}`;
  return `${DEFAULT_STATICALLY_GH_BASE}${DEFAULT_WALLPAPER_STATIC_DIR}${nameOrPath}`;
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

function resolveWallpaperCdnUrl(url) {
  return resolveWallpaperUrl(url);
}

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
          icon: "static/icons/notepad.webp"
        }
      },
      Pictures: {
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
          "nier.mp4": {
            type: "file",
            content: "https://motionbgs.com/media/4348/2b-in-nier-automata.1920x1080.mp4",
            kind: FileKind.VIDEO,
            icon: defaultWallpaperUrl("nier.webp")
          },
          "stormworld.mp4": {
            type: "file",
            content: "https://motionbgs.com/media/8008/above-the-stormworld.3840x2160.mp4",
            kind: FileKind.VIDEO,
            icon: defaultWallpaperUrl("nier.webp")
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

  async safeWriteFile(path, content) {
    try {
      if (content instanceof Uint8Array) {
        await this.p("writeFile", path, content);
      } else if (typeof content === "string") {
        await this.p("writeFile", path, content);
      } else if (content && content.buffer) {
        await this.p("writeFile", path, new Uint8Array(content.buffer));
      } else {
        const bytes = new Uint8Array(content || []);
        await this.p("writeFile", path, bytes);
      }
    } catch (e) {
      console.warn(`safeWriteFile failed for ${path}, trying alternative approach:`, e);
      try {
        if (content instanceof Uint8Array) {
          const text = new TextDecoder("utf-8", { fatal: false }).decode(content);
          await this.p("writeFile", path, text);
        } else if (typeof content === "string") {
          await this.p("writeFile", path, content);
        } else {
          await this.p("writeFile", path, String(content || ""));
        }
      } catch (e2) {
        console.error(`All write attempts failed for ${path}:`, e2);
        throw e2;
      }
    }
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
        await this.ensureDefaults();
        resolve();
      });
    });
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
        const fullPath = this.join(dirPath, name);
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

        const blob = await this._getBlobByFullPath(fullPath).catch(() => null);
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
      throw new Error("Invalid snapshot format.");
    }
    if (snapshot.root !== this.CONFIG.ROOT) {
      throw new Error(`Snapshot root mismatch. Expected ${this.CONFIG.ROOT}, got ${snapshot.root}.`);
    }

    if (wipe) {
      await this._clearBlobStore();
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
      await this.p("mkdir", this.dirname(f.path), { recursive: true }).catch(() => {});
      const bytes = this._base64ToUint8(f.dataB64 || "");
      if (f.isBlob) {
        try {
          await this.safeWriteFile(f.path, new Uint8Array([0]));
          const mime = typeof f.mime === "string" && f.mime ? f.mime : "application/octet-stream";
          await this._putBlob(f.path, new Blob([bytes], { type: mime }));
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

  _clearBlobStore() {
    return new Promise((resolve) => {
      if (!this.blobDB) return resolve();
      try {
        const tx = this.blobDB.transaction("blobs", "readwrite");
        tx.objectStore("blobs").clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
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

  async ensureDefaults() {
    await this.createFromObject(defaultStorage, "/");
    await this.migrateDefaultWallpapers();
  }

  async migrateDefaultWallpapers() {
    const folderPath = ["Pictures", "Wallpapers"];
    const dir = this.resolveDir(folderPath);

    for (const name of DEFAULT_WALLPAPER_FILES) {
      const fullPath = this.join(dir, name);
      const exists = await this.exists(fullPath);
      if (!exists) continue;

      let current;
      try {
        current = await this.pRead("readFile", fullPath, "utf8");
      } catch {
        continue;
      }

      const oldRelative = `${DEFAULT_WALLPAPER_STATIC_DIR}${name}`;
      if (current === oldRelative) {
        await this.p("writeFile", fullPath, defaultWallpaperUrl(name));
      }
    }
  }

  async createFromObject(obj, basePath) {
    for (const key in obj) {
      const value = obj[key];
      const fullPath = this.join(basePath, key);
      if (value.type === "file") {
        await this.p("mkdir", this.dirname(fullPath), { recursive: true }).catch(() => {});
        const exists = await this.exists(fullPath);
        if (!exists) {
          await this.p("writeFile", fullPath, value.content ?? "");
        }
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
    if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "avif"].includes(ext)) return FileKind.IMAGE;
    if (["txt", "js", "json", "md", "html", "css", "xml", "yaml", "yml", "ini", "cfg", "log"].includes(ext))
      return FileKind.TEXT;
    if (["mp4", "webm", "ogv", "mov"].includes(ext)) return FileKind.VIDEO;
    if (["mp3", "ogg", "wav", "flac", "aac", "m4a", "opus", "wma"].includes(ext)) return FileKind.AUDIO;
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
    const segments = dir.split("/").filter(Boolean);
    let current = "";
    for (const seg of segments) {
      current += "/" + seg;
      await this.p("mkdir", current, { recursive: true }).catch(() => {});
    }
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
        const icon = resolveWallpaperCdnUrl(meta[name]?.icon) ?? "static/icons/file.webp";
        const faIcon = meta[name]?.faIcon ?? null;
        result[name] = { type: "file", kind, icon, faIcon, content: "" };
      }
    }

    return result;
  }

  async readTextFile(path, name) {
    await this.fsReady;
    const dir = this.resolveDir(path);
    const fullPath = this.join(dir, name);
    try {
      return await this.pRead("readFile", fullPath, "utf8");
    } catch {
      return null;
    }
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
    const fileIcon = icon || (fileKind === FileKind.TEXT ? "static/icons/notepad.webp" : "static/icons/file.webp");
    await this.p("mkdir", dir, { recursive: true }).catch(() => {});
    if (isBlob(content)) {
      const typedBlob = content.type ? content : new Blob([content], { type: this._mimeFromName(uniqueName) });
      await this.p("writeFile", filePath, "");
      await this.writeMeta(dir, uniqueName, { kind: fileKind, icon: fileIcon, faIcon, size: typedBlob.size });
      await this._putBlob(filePath, typedBlob);
    } else {
      await this.p("writeFile", filePath, content);
      await this.writeMeta(dir, uniqueName, { kind: fileKind, icon: fileIcon, faIcon });
    }
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
      await this._deleteBlobByFullPath(this.join(dir, name));
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
        await this._deleteBlobByFullPath(fullPath);
      }
    }
    await this.p("rmdir", dirPath);
  }

  async renameItem(path, oldName, newName) {
    await this.fsReady;
    const dir = this.resolveDir(path);
    const oldPath = this.join(dir, oldName);
    const newPath = this.join(dir, newName);

    if (oldName !== newName && (await this.exists(newPath))) {
      throw new Error(`A file or folder named "${newName}" already exists.`);
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

    await this._renameBlobByFullPath(oldPath, newPath);
    await this.notifyDesktopChange(path);
  }

  async updateFile(path, name, content, meta = {}) {
    await this.fsReady;
    const dir = this.resolveDir(path);
    const filePath = this.join(dir, name);
    const exists = await this.exists(filePath);
    if (!exists) {
      const kind = this.inferKind(name);
      const icon = kind === FileKind.TEXT ? "static/icons/notepad.webp" : "static/icons/file.webp";
      await this.createFile(path, name, content, kind, icon);
    } else if (isBlob(content)) {
      const typedBlob = content.type ? content : new Blob([content], { type: this._mimeFromName(name) });
      await this.p("writeFile", filePath, "");
      await this._putBlob(filePath, typedBlob);
      await this.notifyDesktopChange(path);
    } else {
      await this.p("writeFile", filePath, content);
      await this.notifyDesktopChange(path);
    }
  }

  _mimeFromName(name) {
    const ext = name.split(".").pop().toLowerCase();
    const map = {
      mp3: "audio/mpeg",
      ogg: "audio/ogg",
      wav: "audio/wav",
      flac: "audio/flac",
      aac: "audio/aac",
      m4a: "audio/mp4",
      opus: "audio/opus",
      wma: "audio/x-ms-wma",
      mp4: "video/mp4",
      webm: "video/webm",
      ogv: "video/ogg",
      mov: "video/quicktime",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      bmp: "image/bmp",
      svg: "image/svg+xml",
      avif: "image/avif",
      pdf: "application/pdf",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      doc: "application/msword",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      xls: "application/vnd.ms-excel",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ppt: "application/vnd.ms-powerpoint",
      zip: "application/zip",
      gz: "application/gzip",
      tar: "application/x-tar",
      rar: "application/vnd.rar",
      "7z": "application/x-7z-compressed"
    };
    return map[ext] ?? "application/octet-stream";
  }

  _isBinaryName(name) {
    const ext = name.split(".").pop().toLowerCase();
    const textExts = new Set([
      "txt",
      "js",
      "json",
      "css",
      "xml",
      "yaml",
      "yml",
      "ini",
      "cfg",
      "log",
      "md",
      "markdown",
      "html",
      "htm",
      "csv",
      "rtf",
      "ts",
      "jsx",
      "tsx",
      "sh",
      "bat",
      "py",
      "rb",
      "php",
      "desktop"
    ]);
    return !textExts.has(ext);
  }

  async getFileContent(path, name) {
    await this.fsReady;
    const dir = this.resolveDir(path);
    const fullPath = this.join(dir, name);

    const blob = await this._getBlobByFullPath(fullPath);
    if (blob) {
      return blob.type ? blob : new Blob([blob], { type: this._mimeFromName(name) });
    }

    try {
      const text = await this.pRead("readFile", fullPath, "utf8");
      if (!text) {
        const entries = await this.pRead("readdir", dir).catch(() => []);
        console.warn(`getFileContent: "${name}" is empty in "${dir}". Available:`, entries);
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
      return resolveWallpaperCdnUrl(text);
    } catch {
      const entries = await this.pRead("readdir", dir).catch(() => []);
      console.warn(`getFileContent: "${name}" not found in "${dir}". Available:`, entries);
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

  async exists(path) {
    try {
      await this.pStat(path);
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
    const fileKind = kind || this.inferKind(name);

    const iconMap = {
      [FileKind.IMAGE]: "@content",
      [FileKind.VIDEO]: "/static/icons/obs.webp",
      [FileKind.AUDIO]: "/static/icons/spot.webp",
      [FileKind.TEXT]: "static/icons/notepad.webp"
    };
    const fileIcon = icon || iconMap[fileKind] || "static/icons/file.webp";
    const fileSize = isBlob(blob) ? blob.size : 0;

    await this.p("mkdir", dir, { recursive: true }).catch(() => {});
    const typedBlob = isBlob(blob) && !blob.type ? new Blob([blob], { type: this._mimeFromName(name) }) : blob;
    await this.p("writeFile", fullPath, "");
    await this.writeMeta(dir, uniqueName, { kind: fileKind, icon: fileIcon, size: fileSize });
    await this._putBlob(fullPath, typedBlob);
    await this.notifyDesktopChange(folderPath);
    return uniqueName;
  }
  async readBinaryFile(folderPath, name) {
    await this.fsReady;
    const dir = this.resolveDir(folderPath);
    const fullPath = this.join(dir, name);
    const blob = await this._getBlobByFullPath(fullPath);
    if (!blob) {
      const entries = await this.pRead("readdir", dir).catch(() => []);
      console.warn(`readBinaryFile: "${name}" not found in "${dir}". Available:`, entries);
      return null;
    }
    return blob.type ? blob : new Blob([blob], { type: this._mimeFromName(name) });
  }

  async deleteBinaryFile(folderPath, name) {
    await this.fsReady;
    const dir = this.resolveDir(folderPath);
    const fullPath = this.join(dir, name);
    await this.p("unlink", fullPath).catch(() => {});
    await this.removeMeta(dir, name);
    await this._deleteBlobByFullPath(fullPath);
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

    await this._renameBlobByFullPath(oldPath, newPath);
    await this.notifyDesktopChange(folderPath);
  }

  _putBlob(fullPath, blob) {
    return new Promise((resolve, reject) => {
      const tx = this.blobDB.transaction("blobs", "readwrite");
      tx.objectStore("blobs").put({ path: fullPath, blob });
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
  }

  _getBlobByFullPath(fullPath) {
    return new Promise((resolve, reject) => {
      const tx = this.blobDB.transaction("blobs", "readonly");
      const req = tx.objectStore("blobs").get(fullPath);
      req.onsuccess = () => resolve(req.result?.blob ?? null);
      req.onerror = reject;
    });
  }

  _deleteBlobByFullPath(fullPath) {
    return new Promise((resolve, reject) => {
      const tx = this.blobDB.transaction("blobs", "readwrite");
      tx.objectStore("blobs").delete(fullPath);
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
  }

  _renameBlobByFullPath(oldPath, newPath) {
    return new Promise((resolve, reject) => {
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
  }
}
