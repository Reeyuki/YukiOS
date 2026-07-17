export class PathResolver {
  constructor(config) {
    this.CONFIG = config;
  }

  join(...parts) {
    return parts.join("/").replace(/\/+/g, "/");
  }

  dirname(path) {
    return path.split("/").slice(0, -1).join("/") || "/";
  }

  basename(path) {
    const parts = path.split("/");
    return parts[parts.length - 1] || "";
  }

  normalizePath(path) {
    if (typeof path === "string") return path.split("/").filter(Boolean);
    if (Array.isArray(path))
      return path.flatMap((p) => (typeof p === "string" ? p.split("/").filter(Boolean) : p ? [p] : []));
    return [];
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

  resolveUserPath(path = []) {
    if (typeof path === "string") {
      if (path.startsWith("/")) return path;
      path = [path];
    }
    const norm = this.normalizePath(path);
    const fullPath = this.join("/", ...norm);
    if (fullPath === this.CONFIG.ROOT || fullPath.startsWith(this.CONFIG.ROOT + "/")) {
      return fullPath;
    }
    return this.join(this.CONFIG.ROOT, ...norm);
  }
}
