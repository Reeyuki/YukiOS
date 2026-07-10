export class MetadataManager {
  constructor(storageAdapter, config) {
    this.storage = storageAdapter;
    this.CONFIG = config;
    this.metaLocks = new Map();
  }

  acquireMeta(dir) {
    const prev = this.metaLocks.get(dir) ?? Promise.resolve();
    let release;
    const next = new Promise((res) => {
      release = res;
    });
    this.metaLocks.set(
      dir,
      prev.then(() => next)
    );
    return prev.then(() => release);
  }

  async readMeta(dir) {
    const metaPath = this.join(dir, this.CONFIG.META_FILE);
    try {
      const data = await this.storage.pRead("readFile", metaPath, "utf8");
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  async writeMeta(dir, name, data) {
    const release = await this.acquireMeta(dir);
    try {
      const metaPath = this.join(dir, this.CONFIG.META_FILE);
      const meta = await this.readMeta(dir);
      meta[name] = { kind: data.kind, icon: data.icon };
      if (data.faIcon) meta[name].faIcon = data.faIcon;
      if (data.size != null) meta[name].size = data.size;
      await this.storage.p("writeFile", metaPath, JSON.stringify(meta));
    } finally {
      release();
    }
  }

  async removeMeta(dir, name) {
    const release = await this.acquireMeta(dir);
    try {
      const metaPath = this.join(dir, this.CONFIG.META_FILE);
      const meta = await this.readMeta(dir);
      delete meta[name];
      await this.storage.p("writeFile", metaPath, JSON.stringify(meta));
    } finally {
      release();
    }
  }

  join(...parts) {
    return parts.join("/").replace(/\/+/g, "/");
  }
}
