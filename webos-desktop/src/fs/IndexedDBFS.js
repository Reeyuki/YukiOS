const DB_NAME = "yukios-fs";
const STORE_NAME = "files";
const DB_VERSION = 1;

let db = null;
let cache = new Map();

function promisify(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains(STORE_NAME)) {
        d.createObjectStore(STORE_NAME, { keyPath: "path" });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

function txPut(doc) {
  const tx = db.transaction(STORE_NAME, "readwrite");
  const result = promisify(tx.objectStore(STORE_NAME).put(doc));
  tx.onerror = (e) => {
    throw e.target.error;
  };
  return result;
}

function txDel(path) {
  const tx = db.transaction(STORE_NAME, "readwrite");
  const result = promisify(tx.objectStore(STORE_NAME).delete(path));
  return result;
}

async function txGet(path) {
  const tx = db.transaction(STORE_NAME, "readonly");
  const result = promisify(tx.objectStore(STORE_NAME).get(path));
  return result;
}

async function pathExistsInDB(path) {
  try {
    const d = await txGet(path);
    return d !== undefined;
  } catch {
    return false;
  }
}

function n(path) {
  if (!path || typeof path !== "string") return "/";
  const norm = "/" + path.split("/").filter(Boolean).join("/");
  return norm || "/";
}

class Stats {
  constructor(doc) {
    this.fileType = doc.type === "file";
    this.directoryType = doc.type === "directory";
    this.size = doc.size || 0;
    this.mtime = new Date(doc.mtime || Date.now());
    this.ctime = new Date(doc.ctime || Date.now());
    this.mode = this.directoryType ? 0o777 : 0o666;
  }
  isFile() {
    return this.fileType;
  }
  isDirectory() {
    return this.directoryType;
  }
}

function doc(path, type, content) {
  const d = {
    path: n(path),
    type,
    content:
      content instanceof Uint8Array
        ? content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength)
        : (content ?? null),
    size: content instanceof Uint8Array ? content.length : typeof content === "string" ? content.length : 0,
    mtime: Date.now(),
    ctime: Date.now()
  };
  return d;
}

async function mkdirRecursive(p) {
  const parts = n(p).split("/").filter(Boolean);
  let acc = "";
  for (const part of parts) {
    acc += "/" + part;
    if (!cache.has(acc)) {
      const existsInDB = await pathExistsInDB(acc);
      if (!existsInDB) {
        const d = doc(acc, "directory");
        cache.set(acc, d);
      } else {
        const existing = await txGet(acc);
        if (existing) {
          cache.set(acc, existing);
        }
      }
    }
  }
}

function getDirectChildren(p) {
  const prefix = n(p);
  const prefixSlash = prefix === "/" ? "" : prefix + "/";
  const seen = new Set();
  const result = [];
  for (const path of cache.keys()) {
    if (path === prefix) continue;
    if (path.startsWith(prefixSlash)) {
      const rest = path.slice(prefixSlash.length);
      const child = rest.split("/")[0];
      if (child && !seen.has(child)) {
        seen.add(child);
        result.push(child);
      }
    }
  }
  return result;
}

const fs = {
  writeFile(path, content, encoding, cb) {
    if (typeof encoding === "function") {
      cb = encoding;
      encoding = null;
    }
    try {
      const np = n(path);
      const d = doc(np, "file", content);
      cache.set(np, d);
      txPut(d)
        .then(() => {
          d.persisted = true;
          cb(null);
        })
        .catch(cb);
    } catch (e) {
      cb(e);
    }
  },

  readFile(path, encoding, cb) {
    if (typeof encoding === "function") {
      cb = encoding;
      encoding = null;
    }
    const np = n(path);
    const d = cache.get(np);
    if (!d)
      return cb(Object.assign(new Error(`ENOENT: no such file or directory, open '${path}'`), { code: "ENOENT" }));
    try {
      let content = d.content;
      if (content instanceof ArrayBuffer) {
        const uint8 = new Uint8Array(content);
        content = encoding ? new TextDecoder().decode(uint8) : uint8;
      }
      cb(null, content);
    } catch (e) {
      cb(e);
    }
  },

  mkdir(path, options, cb) {
    if (typeof options === "function") {
      cb = options;
      options = {};
    }

    const doMkdir = async () => {
      try {
        const np = n(path);

        if (cache.has(np)) {
          const existing = cache.get(np);
          if (existing.type === "file") {
            return cb(Object.assign(new Error(`EEXIST: file already exists, mkdir '${path}'`), { code: "EEXIST" }));
          }
          return cb(null);
        }

        const existsInDB = await pathExistsInDB(np);
        if (existsInDB) {
          const existing = await txGet(np);
          if (existing) {
            cache.set(np, existing);
            if (existing.type === "file") {
              return cb(Object.assign(new Error(`EEXIST: file already exists, mkdir '${path}'`), { code: "EEXIST" }));
            }
            return cb(null);
          }
        }

        if (options.recursive) {
          await mkdirRecursive(np);
        } else {
          const parent = n(np.substring(0, np.lastIndexOf("/")));
          if (!cache.has(parent)) {
            const parentExists = await pathExistsInDB(parent);
            if (!parentExists) {
              return cb(
                Object.assign(new Error(`ENOENT: no such parent directory, mkdir '${path}'`), { code: "ENOENT" })
              );
            }
            const parentDoc = await txGet(parent);
            if (parentDoc) cache.set(parent, parentDoc);
          }
          const d = doc(np, "directory");
          cache.set(np, d);
        }

        const allNew = [];
        for (const [p, d] of cache) {
          if (!d.persisted) allNew.push(d);
        }
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        for (const d of allNew) {
          store.put(d);
          d.persisted = true;
        }
        tx.oncomplete = () => cb(null);
        tx.onerror = (e) => cb(e.target.error);
      } catch (e) {
        cb(e);
      }
    };

    doMkdir();
  },

  readdir(path, cb) {
    try {
      const children = getDirectChildren(n(path));
      cb(null, children);
    } catch (e) {
      cb(e);
    }
  },

  unlink(path, cb) {
    try {
      const np = n(path);
      cache.delete(np);
      txDel(np)
        .then(() => cb(null))
        .catch(cb);
    } catch (e) {
      cb(e);
    }
  },

  rmdir(path, cb) {
    try {
      const np = n(path);
      const children = getDirectChildren(np);
      if (children.length > 0)
        return cb(Object.assign(new Error(`ENOTEMPTY: directory not empty, rmdir '${path}'`), { code: "ENOTEMPTY" }));
      cache.delete(np);
      txDel(np)
        .then(() => cb(null))
        .catch(cb);
    } catch (e) {
      cb(e);
    }
  },

  rename(oldPath, newPath, cb) {
    try {
      const oldN = n(oldPath);
      const newN = n(newPath);
      const toUpdate = [];
      for (const [p, d] of cache) {
        if (p === oldN || p.startsWith(oldN + "/")) {
          toUpdate.push({ old: p, doc: d });
        }
      }
      if (toUpdate.length === 0)
        return cb(
          Object.assign(new Error(`ENOENT: no such file or directory, rename '${oldPath}'`), { code: "ENOENT" })
        );
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      for (const { old: op, doc: d } of toUpdate) {
        const newDoc = { ...d, path: op.replace(oldN, newN), mtime: Date.now() };
        store.delete(op);
        store.put(newDoc);
        cache.delete(op);
        cache.set(newDoc.path, newDoc);
      }
      tx.oncomplete = () => cb(null);
      tx.onerror = (e) => cb(e.target.error);
    } catch (e) {
      cb(e);
    }
  },

  stat(path, cb) {
    try {
      const np = n(path);
      if (np === "/") {
        return cb(null, new Stats({ type: "directory", path: "/", mtime: Date.now(), ctime: Date.now(), size: 0 }));
      }
      const d = cache.get(np);
      if (!d)
        return cb(Object.assign(new Error(`ENOENT: no such file or directory, stat '${path}'`), { code: "ENOENT" }));
      cb(null, new Stats(d));
    } catch (e) {
      cb(e);
    }
  },

  statSync(path) {
    const np = n(path);
    if (np === "/") return new Stats({ type: "directory", path: "/", mtime: Date.now(), ctime: Date.now(), size: 0 });
    const d = cache.get(np);
    if (!d) throw Object.assign(new Error(`ENOENT: no such file or directory, stat '${path}'`), { code: "ENOENT" });
    return new Stats(d);
  },

  async statAsync(path) {
    const np = n(path);
    if (np === "/") return new Stats({ type: "directory", path: "/", mtime: Date.now(), ctime: Date.now(), size: 0 });

    let d = cache.get(np);
    if (!d) {
      try {
        d = await txGet(np);
        if (d) {
          cache.set(np, d);
        }
      } catch (e) {}
    }

    if (!d) throw Object.assign(new Error(`ENOENT: no such file or directory, stat '${path}'`), { code: "ENOENT" });
    return new Stats(d);
  }
};

export default {
  configure(config, cb) {
    openDB()
      .then(async (database) => {
        db = database;
        const tx = db.transaction(STORE_NAME, "readonly");
        const all = await promisify(tx.objectStore(STORE_NAME).getAll());
        cache.clear();
        for (const doc of all) {
          doc.persisted = true;
          cache.set(doc.path, doc);
        }
        cb(null);
      })
      .catch((err) => cb(err));
  },
  BFSRequire(module) {
    if (module === "fs") return fs;
    throw new Error(`Module '${module}' not available`);
  }
};
