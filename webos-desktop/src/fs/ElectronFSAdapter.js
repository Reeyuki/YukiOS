export class ElectronFSAdapter {
  constructor(config) {
    this.CONFIG = config;
    this.resolveFs = null;
    this.fsReady = new Promise((res) => {
      this.resolveFs = res;
    });
    this.fs = null;
  }

  async initFS(sessionKey = "guest") {
    try {
      const result = await window.electronAPI.electronFs.init(sessionKey);
      if (!result.success) throw new Error(result.error || "FS init failed");
      this.fs = { type: "electron" };
      this.homeDir = result.homeDir || null;
      if (this.resolveFs) this.resolveFs();
    } catch (e) {
      console.error("ElectronFSAdapter init failed:", e);
      if (this.resolveFs) this.resolveFs();
    }
    return this.fsReady;
  }

  async p(method, ...args) {
    await this.fsReady;
    const ef = window.electronAPI.electronFs;
    switch (method) {
      case "writeFile": {
        const [path, content] = args;
        await ef.writeFile(path, content);
        return;
      }
      case "mkdir": {
        const [path, options] = args;
        await ef.mkdir(path, options?.recursive || false);
        return;
      }
      case "unlink": {
        const [path] = args;
        await ef.unlink(path);
        return;
      }
      case "rmdir": {
        const [path] = args;
        await ef.rmdir(path);
        return;
      }
      case "rename": {
        const [oldPath, newPath] = args;
        await ef.rename(oldPath, newPath);
        return;
      }
      default:
        throw new Error(`Unknown storage method: ${method}`);
    }
  }

  async pRead(method, ...args) {
    await this.fsReady;
    const ef = window.electronAPI.electronFs;
    switch (method) {
      case "readFile": {
        const [path, encoding] = args;
        const wantsBinary = !encoding || encoding === "binary";
        const result = await ef.readFile(path, wantsBinary ? "binary" : "utf8");
        if (!result.success) throw new Error(result.error);
        if (wantsBinary || result.encoding === "base64") {
          const bytes = Uint8Array.from(atob(result.data), (c) => c.charCodeAt(0));
          return bytes;
        }
        return result.data;
      }
      case "readdir": {
        const [path] = args;
        const result = await ef.readdir(path);
        if (!result.success) throw new Error(result.error);
        return result.entries;
      }
      default:
        throw new Error(`Unknown storage read method: ${method}`);
    }
  }

  async pStat(path) {
    await this.fsReady;
    const result = await window.electronAPI.electronFs.stat(path);
    if (!result.success) throw new Error(result.error);
    const s = result.stat;
    return {
      isDirectory: () => s.isDirectory,
      isFile: () => s.isFile,
      size: s.size,
      mtimeMs: s.mtimeMs,
      birthtimeMs: s.birthtimeMs
    };
  }

  async safeWriteFile(path, content) {
    await this.fsReady;
    try {
      await this.p("writeFile", path, content);
    } catch (e) {
      console.warn(`safeWriteFile failed for ${path}:`, e);
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

  async exists(path) {
    await this.fsReady;
    try {
      await this.pStat(path);
      return true;
    } catch {
      return false;
    }
  }

  async readFile(path, encoding = "utf8") {
    return await this.pRead("readFile", path, encoding);
  }

  async writeFile(path, content) {
    await this.p("writeFile", path, content);
  }

  async mkdir(path, options = {}) {
    await this.p("mkdir", path, options);
  }

  async readdir(path) {
    return await this.pRead("readdir", path);
  }

  async unlink(path) {
    await this.p("unlink", path);
  }

  async rmdir(path) {
    await this.p("rmdir", path);
  }

  async rename(oldPath, newPath) {
    await this.p("rename", oldPath, newPath);
  }

  statSync(path) {
    throw new Error("statSync not available in Electron mode");
  }

  async statAsync(path) {
    return await this.pStat(path);
  }

  async clearIndexedDB() {}
}
