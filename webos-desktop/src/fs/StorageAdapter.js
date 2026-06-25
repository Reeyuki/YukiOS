import IndexedDBFS from "./IndexedDBFS.js";

export class StorageAdapter {
  constructor(config) {
    this.CONFIG = config;
    this.fs = null;
    this._resolveFs = null;
    this.fsReady = new Promise((res) => {
      this._resolveFs = res;
    });
  }

  p(method, ...args) {
    return this.fsReady.then(() => {
      return new Promise((res, rej) => {
        this.fs[method](...args, (err) => (err ? rej(err) : res()));
      });
    });
  }

  async safeWriteFile(path, content) {
    await this.fsReady;
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
    return this.fsReady.then(() => {
      return new Promise((res, rej) => {
        this.fs[method](...args, (err, data) => (err ? rej(err) : res(data)));
      });
    });
  }

  pStat(path) {
    return this.fsReady.then(() => {
      return new Promise((res, rej) => {
        this.fs.stat(path, (e, s) => (e ? rej(e) : res(s)));
      });
    });
  }

  async initFS(sessionKey = "guest") {
    const attemptInit = () => {
      IndexedDBFS.configure(
        {
          fs: "IndexedDB",
          options: {}
        },
        async (e) => {
          if (e) {
            console.error("IndexedDBFS initialization failed:", e);
            try {
              await this._clearIndexedDB();
              console.log("Cleared IndexedDB, retrying initialization...");
              setTimeout(attemptInit, 100);
            } catch (clearErr) {
              console.error("Failed to clear IndexedDB:", clearErr);
              if (this._resolveFs) this._resolveFs();
            }
            return;
          }
          this.fs = IndexedDBFS.BFSRequire("fs");
          if (this._resolveFs) this._resolveFs();
        }
      );
    };
    attemptInit();
    return this.fsReady;
  }

  async _clearIndexedDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.deleteDatabase("IndexedDB");
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => {
        console.warn("IndexedDB deletion blocked, will retry on next reload");
        resolve();
      };
    });
  }

  async exists(path) {
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
    if (!this.fs) {
      throw new Error("Filesystem not initialized. Call initFS() first.");
    }
    return this.fs.statSync(path);
  }
}
