import BrowserFS from "browserfs";

const CONFIG = {
  GRID_SIZE: 80,
  ROOT: "/home/reeyuki",
  META_FILE: ".meta.json",
  LEGACY_KEY: "desktopOS_fileSystem"
};

export const FileKind = {
  IMAGE: "image",
  VIDEO: "VIDEO",
  TEXT: "text",
  OTHER: "other"
};

export const defaultStorage = {
  home: {
    reeyuki: {
      Documents: {
        "INFO.txt": {
          type: "file",
          content: "Files you saved in notepad get saved in your browser session.",
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
          "nier.mp4": {
            type: "file",
            content: "https://motionbgs.com/media/4348/2b-in-nier-automata.1920x1080.mp4",
            kind: FileKind.VIDEO,
            icon: "/static/wallpapers/nier.webp"
          }
        }
      },
      Music: {},
      Games: {}
    }
  }
};

export class FileSystemManager {
  constructor() {
    this.fsReady = this.initFS();
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
        await this.migrateIfNeeded();
        await this.ensureDefaults();
        resolve();
      });
    });
  }

  async migrateIfNeeded() {
    const rootExists = await this.exists(CONFIG.ROOT);
    if (rootExists) return;
    const legacyExists = await this.exists(CONFIG.LEGACY_KEY);
    if (!legacyExists) return;
    const raw = await this.readFile(CONFIG.LEGACY_KEY);
    const legacyFS = JSON.parse(raw);
    await this.createFromObject(legacyFS, "/");
    await this.p("unlink", CONFIG.LEGACY_KEY);
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

  async readMeta(dir) {
    const metaPath = this.join(dir, CONFIG.META_FILE);
    try {
      const data = await this.pRead("readFile", metaPath, "utf8");
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  async writeMeta(dir, name, data) {
    const metaPath = this.join(dir, CONFIG.META_FILE);
    const meta = await this.readMeta(dir);
    meta[name] = { kind: data.kind, icon: data.icon };
    await this.p("writeFile", metaPath, JSON.stringify(meta));
  }

  async removeMeta(dir, name) {
    const metaPath = this.join(dir, CONFIG.META_FILE);
    const meta = await this.readMeta(dir);
    delete meta[name];
    await this.p("writeFile", metaPath, JSON.stringify(meta));
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
    return FileKind.OTHER;
  }
  resolveDir(path = []) {
    if (typeof path === "string") path = [path];
    return this.join("/", ...CONFIG.ROOT.split("/").filter(Boolean), ...this.normalizePath(path));
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
      throw new Error("Invalid path");
    }

    const meta = await this.readMeta(dir);
    const result = {};

    for (const name of entries) {
      if (name === CONFIG.META_FILE) continue;
      const full = this.join(dir, name);
      const stat = await this.pStat(full);
      if (stat.isDirectory()) {
        result[name] = {};
      } else {
        const kind = meta[name]?.kind ?? this.inferKind(name);
        const icon = meta[name]?.icon ?? "/static/icons/file.webp";
        let content = "";
        try {
          content = await this.pRead("readFile", full, "utf8");
        } catch (e) {
          console.error(e);
        }
        result[name] = { type: "file", kind, icon, content };
      }
    }

    return result;
  }
  async createFile(path, name, content = "", kind = null, icon = null) {
    await this.fsReady;
    const dir = this.resolveDir(path);
    const filePath = this.join(dir, name);
    const fileKind = kind || this.inferKind(name);
    const fileIcon = icon || (fileKind === FileKind.TEXT ? "/static/icons/notepad.webp" : "/static/icons/file.webp");
    await this.p("mkdir", dir, { recursive: true }).catch(() => {});
    await this.p("writeFile", filePath, content);
    await this.writeMeta(dir, name, { kind: fileKind, icon: fileIcon });
  }

  async createFolder(path, name) {
    await this.fsReady;
    const dir = this.join(this.resolveDir(path), name);
    await this.p("mkdir", dir, { recursive: true });
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
    await this.p("rename", this.join(dir, oldName), this.join(dir, newName));
    const meta = await this.readMeta(dir);
    if (meta[oldName]) {
      meta[newName] = meta[oldName];
      delete meta[oldName];
      await this.p("writeFile", this.join(dir, CONFIG.META_FILE), JSON.stringify(meta));
    }
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
}
