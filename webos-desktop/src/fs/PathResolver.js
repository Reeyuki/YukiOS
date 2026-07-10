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
    const rootParts = this.CONFIG.ROOT.split("/").filter(Boolean);
    if (norm.length >= rootParts.length && norm.slice(0, rootParts.length).join("/") === rootParts.join("/")) {
      return this.join("/", ...norm);
    }
    return this.join("/", ...rootParts, ...norm);
  }
}
