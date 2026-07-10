import * as git from "isomorphic-git";
import http from "isomorphic-git/http/web";

export class GitManager {
  constructor(fsManager) {
    this.fsManager = fsManager;
    this.storage = fsManager.storage;
    this._fs = null;
  }

  createFS() {
    if (this._fs) return this._fs;
    const storage = this.storage;

    const fs = {
      promises: {
        readFile: async (path, opts) => {
          const isUtf8 = opts === "utf8" || (opts && opts.encoding === "utf8");
          if (isUtf8) return await storage.pRead("readFile", path, "utf8");
          return await storage.pRead("readFile", path);
        },
        writeFile: async (path, data) => {
          if (data instanceof Uint8Array) {
            await storage.p("writeFile", path, data);
          } else if (typeof data === "string") {
            await storage.p("writeFile", path, data);
          } else {
            await storage.p("writeFile", path, new Uint8Array(data));
          }
        },
        unlink: async (path) => {
          await storage.p("unlink", path);
        },
        readdir: async (path) => {
          return await storage.pRead("readdir", path);
        },
        mkdir: async (path, opts) => {
          await storage.p("mkdir", path, opts || {});
        },
        rmdir: async (path) => {
          await storage.p("rmdir", path);
        },
        stat: async (path) => {
          const r = await storage.pStat(path);
          return {
            isDirectory: () => r.isDirectory(),
            isFile: () => r.isFile(),
            isSymbolicLink: () => false,
            size: r.size,
            mtime: r.mtime instanceof Date ? r.mtime : new Date(r.mtime),
            ctime: r.ctime instanceof Date ? r.ctime : new Date(r.ctime),
            mode: r.mode
          };
        },
        lstat: async (path) => {
          return await fs.promises.stat(path);
        },
        symlink: async () => {},
        readlink: async () => new Uint8Array(0),
        rename: async (oldPath, newPath) => {
          await storage.p("rename", oldPath, newPath);
        }
      }
    };

    this._fs = fs;
    return fs;
  }

  get fs() {
    return this.createFS();
  }

  async clone(url, dir, onProgress, depth) {
    const opts = {
      fs: this.fs,
      http,
      dir,
      url,
      corsProxy: "https://cors.isomorphic-git.org",
      onProgress
    };
    if (depth > 0) opts.depth = depth;
    return await git.clone(opts);
  }

  async init(dir) {
    const exists = await this.storage.exists(dir);
    if (!exists) {
      await this.storage.mkdir(dir, { recursive: true });
    }
    return await git.init({ fs: this.fs, dir });
  }

  async add(dir, filepath) {
    return await git.add({ fs: this.fs, dir, filepath });
  }

  async remove(dir, filepath) {
    return await git.remove({ fs: this.fs, dir, filepath });
  }

  async commit(dir, message, author) {
    return await git.commit({ fs: this.fs, dir, author, message });
  }

  async status(dir, filepath) {
    return await git.status({ fs: this.fs, dir, filepath });
  }

  async statusMatrix(dir) {
    return await git.statusMatrix({ fs: this.fs, dir });
  }

  async log(dir, options = {}) {
    return await git.log({ fs: this.fs, dir, ...options });
  }

  async branch(dir, name) {
    return await git.branch({ fs: this.fs, dir, ref: name });
  }

  async listBranches(dir) {
    return await git.listBranches({ fs: this.fs, dir });
  }

  async currentBranch(dir) {
    return await git.currentBranch({ fs: this.fs, dir });
  }

  async checkout(dir, ref) {
    return await git.checkout({ fs: this.fs, dir, ref });
  }

  async pull(dir, author, onAuth, onProgress) {
    return await git.pull({
      fs: this.fs,
      http,
      dir,
      author,
      corsProxy: "https://cors.isomorphic-git.org",
      onAuth,
      onProgress
    });
  }

  async push(dir, onAuth, onProgress) {
    return await git.push({
      fs: this.fs,
      http,
      dir,
      corsProxy: "https://cors.isomorphic-git.org",
      onAuth,
      onProgress
    });
  }

  async fetch(dir, onAuth, onProgress) {
    return await git.fetch({
      fs: this.fs,
      http,
      dir,
      corsProxy: "https://cors.isomorphic-git.org",
      onAuth,
      onProgress
    });
  }

  async listRemotes(dir) {
    return await git.listRemotes({ fs: this.fs, dir });
  }

  async addRemote(dir, remote, url) {
    return await git.addRemote({ fs: this.fs, dir, remote, url });
  }

  async deleteRemote(dir, remote) {
    return await git.deleteRemote({ fs: this.fs, dir, remote });
  }

  async listFiles(dir, ref) {
    return await git.listFiles({ fs: this.fs, dir, ref });
  }

  async diff(dir) {
    const matrix = await this.statusMatrix(dir);
    const files = matrix.filter(([, head, workdir]) => head !== workdir);
    return files.map(([filepath]) => filepath);
  }

  async stash(dir) {
    return await git.stash({ fs: this.fs, dir });
  }

  async stashPop(dir) {
    return await git.stash({ fs: this.fs, dir, action: "pop" });
  }

  async findRoot(dir) {
    return await git.findRoot({ fs: this.fs, dir });
  }

  async resolveRef(dir, ref) {
    return await git.resolveRef({ fs: this.fs, dir, ref });
  }

  lsFiles(dir, ref) {
    return this.listFiles(dir, ref);
  }

  async isIgnored(dir, filepath) {
    return await git.isIgnored({ fs: this.fs, dir, filepath });
  }
}
