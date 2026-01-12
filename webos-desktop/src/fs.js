import BrowserFS from "browserfs";

const CONFIG = {
  GRID_SIZE: 80,
  STORAGE_KEY: "desktopOS_fileSystem"
};

export const FileKind = {
  IMAGE: "image",
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
        }
      },
      Music: {}
    }
  }
};

function mergeDefaults(defaults, target) {
  for (const key in defaults) {
    if (!(key in target)) {
      target[key] = defaults[key];
    } else if (typeof defaults[key] === "object" && defaults[key] !== null && !Array.isArray(defaults[key])) {
      mergeDefaults(defaults[key], target[key]);
    }
  }
  return target;
}

export class FileSystemManager {
  constructor() {
    this.fsReady = this.initFS();
  }

  async initFS() {
    return new Promise((resolve) => {
      BrowserFS.configure({ fs: "IndexedDB", options: {} }, () => {
        this.fs = BrowserFS.BFSRequire("fs");
        this.loadFromStorage();
        resolve();
      });
    });
  }

  async loadFromStorage() {
    const exists = await this.exists(CONFIG.STORAGE_KEY);
    if (!exists) {
      await this.writeFile(CONFIG.STORAGE_KEY, JSON.stringify(defaultStorage));
      this.fileSystem = JSON.parse(JSON.stringify(defaultStorage));
    } else {
      const stored = await this.readFile(CONFIG.STORAGE_KEY);
      const storedFS = JSON.parse(stored);
      this.fileSystem = mergeDefaults(defaultStorage, storedFS);
      await this.saveToStorage();
    }
  }

  async saveToStorage() {
    await this.writeFile(CONFIG.STORAGE_KEY, JSON.stringify(this.fileSystem));
  }

  normalizePath(path) {
    if (typeof path === "string") return path.split("/").filter((p) => p);
    return Array.isArray(path) ? path.filter((p) => p) : [];
  }

  getFolder(path) {
    const folders = this.normalizePath(path);
    return folders.reduce((acc, name) => {
      if (!acc[name]) throw new Error(`Invalid path: ${name}`);
      return acc[name];
    }, this.fileSystem);
  }

  inferKind(fileName) {
    const ext = fileName.split(".").pop().toLowerCase();
    if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return FileKind.IMAGE;
    if (["txt", "js", "json", "md", "html", "css"].includes(ext)) return FileKind.TEXT;
    return FileKind.OTHER;
  }

  async createFile(path, name, content = "", kind = null, icon = null) {
    await this.fsReady;
    const folder = this.getFolder(path);
    const fileKind = kind || this.inferKind(name);
    const fileIcon = icon || (fileKind === FileKind.TEXT ? "/static/icons/notepad.webp" : "/static/icons/file.png");
    folder[name] = { type: "file", content, kind: fileKind, icon: fileIcon };
    await this.saveToStorage();
  }

  async createFolder(path, name) {
    await this.fsReady;
    const folder = this.getFolder(path);
    folder[name] = {};
    await this.saveToStorage();
  }

  async deleteItem(path, name) {
    await this.fsReady;
    const folder = this.getFolder(path);
    delete folder[name];
    await this.saveToStorage();
  }

  async renameItem(path, oldName, newName) {
    await this.fsReady;
    const folder = this.getFolder(path);
    folder[newName] = folder[oldName];
    delete folder[oldName];
    await this.saveToStorage();
  }

  async updateFile(path, name, content) {
    await this.fsReady;
    const folder = this.getFolder(path);
    if (folder[name]?.type === "file") folder[name].content = content;
    else {
      const kind = this.inferKind(name);
      const icon = kind === FileKind.TEXT ? "/static/icons/notepad.webp" : "/static/icons/file.png";
      folder[name] = { type: "file", content, kind, icon };
    }
    await this.saveToStorage();
  }

  async getFileContent(path, name) {
    await this.fsReady;
    const folder = this.getFolder(path);
    return folder[name]?.type === "file" ? folder[name].content : "";
  }

  async getFileKind(path, name) {
    await this.fsReady;
    const folder = this.getFolder(path);
    return folder[name]?.type === "file" ? folder[name].kind : null;
  }

  async getFileIcon(path, name) {
    await this.fsReady;
    const folder = this.getFolder(path);
    return folder[name]?.type === "file" ? folder[name].icon : null;
  }

  async isFile(path, name) {
    await this.fsReady;
    const folder = this.getFolder(path);
    return folder[name]?.type === "file";
  }

  async writeFile(filePath, content) {
    return new Promise((res, rej) => {
      this.fs.writeFile(filePath, content, (err) => {
        if (err) rej(err);
        else res();
      });
    });
  }

  async readFile(filePath) {
    return new Promise((res, rej) => {
      this.fs.readFile(filePath, "utf8", (err, data) => {
        if (err) rej(err);
        else res(data);
      });
    });
  }

  async exists(filePath) {
    return new Promise((resolve) => {
      this.fs.exists(filePath, (exists) => resolve(exists));
    });
  }
}
