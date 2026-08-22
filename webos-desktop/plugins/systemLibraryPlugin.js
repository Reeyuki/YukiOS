import { readdirSync, readFileSync, writeFileSync, statSync, mkdirSync, existsSync } from "fs";
import { resolve, relative, join, dirname, sep } from "path";

const projectRoot = process.cwd();
const sourceDir = resolve(projectRoot, "src");
const generatedDir = resolve(sourceDir, "generated");
const manifestPath = resolve(generatedDir, "systemLibraryManifest.js");
const overridesCachePath = resolve(projectRoot, "node_modules/.cache/yukios-system-overrides.json");
const OVERRIDES_ROUTE = "/__yukios-overrides";

const overrideStore = new Map();

function collectSourceFiles(currentDir, excludedDirs) {
  let dirEntries;
  try {
    dirEntries = readdirSync(currentDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const collected = [];
  for (const dirEntry of dirEntries) {
    const fullPath = join(currentDir, dirEntry.name);
    if (dirEntry.isDirectory()) {
      if (dirEntry.name === "__tests__" || excludedDirs.has(fullPath)) continue;
      collected.push(...collectSourceFiles(fullPath, excludedDirs));
      continue;
    }
    if (!dirEntry.isFile()) continue;
    if (!/\.(js|css)$/.test(dirEntry.name)) continue;
    if (/\.test\.js$/.test(dirEntry.name) || /\.spec\.js$/.test(dirEntry.name)) continue;
    collected.push(fullPath);
  }
  return collected;
}

function regenerateSystemLibraryManifest() {
  const excludedDirs = new Set([generatedDir]);
  const sourceFiles = collectSourceFiles(sourceDir, excludedDirs);
  const entries = [];
  for (const filePath of sourceFiles) {
    const stats = statSync(filePath);
    entries.push({
      path: relative(sourceDir, filePath).split(sep).join("/"),
      bytes: stats.size,
      mtime: Math.round(stats.mtimeMs)
    });
  }
  entries.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const serialized = `export const SYSTEM_LIBRARY_FILES = ${JSON.stringify(entries)};\n`;
  let existingContent = "";
  try {
    existingContent = readFileSync(manifestPath, "utf-8");
  } catch {
    existingContent = "";
  }
  if (existingContent !== serialized) {
    mkdirSync(dirname(manifestPath), { recursive: true });
    writeFileSync(manifestPath, serialized, "utf-8");
  }
}

function loadPersistedOverrides() {
  try {
    if (!existsSync(overridesCachePath)) return;
    const parsed = JSON.parse(readFileSync(overridesCachePath, "utf-8"));
    for (const [filePath, content] of Object.entries(parsed)) {
      if (typeof content === "string") overrideStore.set(filePath, content);
    }
  } catch {
    overrideStore.clear();
  }
}

function persistOverrides() {
  try {
    mkdirSync(dirname(overridesCachePath), { recursive: true });
    writeFileSync(overridesCachePath, JSON.stringify(Object.fromEntries(overrideStore)), "utf-8");
  } catch {}
}

function normalizeModuleId(moduleId) {
  let normalizedId = moduleId.split("?")[0];
  while (normalizedId.startsWith("\0")) {
    normalizedId = normalizedId.slice(1);
  }
  return normalizedId;
}

function toRootRelativePosixPath(absolutePath) {
  return relative(projectRoot, absolutePath).split(sep).join("/");
}

function readJsonBody(req) {
  return new Promise((resolveBody) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      try {
        resolveBody(JSON.parse(raw));
      } catch {
        resolveBody(null);
      }
    });
    req.on("error", () => resolveBody(null));
  });
}

function sendJson(res, payload) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

export function systemLibraryPlugin() {
  return {
    name: "yukios-system-library",
    buildStart() {
      regenerateSystemLibraryManifest();
    },
    load(id) {
      const normalizedId = normalizeModuleId(id);
      const absoluteId = resolve(normalizedId);
      const rootRelativePath = toRootRelativePosixPath(absoluteId);
      if (!rootRelativePath.startsWith("src/")) return null;
      if (!overrideStore.has(rootRelativePath)) return null;
      return { code: overrideStore.get(rootRelativePath), map: null };
    },
    configureServer(server) {
      loadPersistedOverrides();

      function invalidateModuleTree(rootRelativePath) {
        const absolutePath = resolve(projectRoot, rootRelativePath);
        const modulesToInvalidate = new Set();
        try {
          const moduleById = server.moduleGraph.getModuleById(absolutePath);
          if (moduleById) modulesToInvalidate.add(moduleById);
        } catch {}
        try {
          const modulesByFile = server.moduleGraph.getModulesByFile(absolutePath);
          if (Array.isArray(modulesByFile)) {
            for (const mod of modulesByFile) modulesToInvalidate.add(mod);
          }
        } catch {}
        for (const mod of modulesToInvalidate) {
          try {
            server.moduleGraph.invalidateModule(mod);
          } catch {}
        }
        server.ws.send({ type: "full-reload" });
      }

      server.middlewares.use(async (req, res, next) => {
        const requestUrl = req.url || "";
        if (!requestUrl.startsWith(OVERRIDES_ROUTE)) return next();
        const routePath = requestUrl.slice(OVERRIDES_ROUTE.length);
        if (routePath && routePath !== "/" ) return next();

        if (req.method === "GET") {
          sendJson(res, { overrides: Object.fromEntries(overrideStore) });
          return;
        }

        const body = await readJsonBody(req);
        if (!body || typeof body.path !== "string") {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: false, error: "invalid body" }));
          return;
        }

        if (req.method === "POST" && typeof body.content === "string") {
          overrideStore.set(body.path, body.content);
          persistOverrides();
          invalidateModuleTree(body.path);
          sendJson(res, { ok: true });
          return;
        }

        if (req.method === "DELETE") {
          overrideStore.delete(body.path);
          persistOverrides();
          invalidateModuleTree(body.path);
          sendJson(res, { ok: true });
          return;
        }

        return next();
      });
    }
  };
}
