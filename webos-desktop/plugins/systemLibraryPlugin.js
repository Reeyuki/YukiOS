import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, posix, relative, resolve, sep } from "node:path";

const OVERRIDES_ROUTE = "/__yukios-overrides";
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MANIFEST_DEBOUNCE_MS = 200;

/* -------------------------------------------------------------------------- */
/*  Source manifest                                                           */
/* -------------------------------------------------------------------------- */

function isTestFile(name) {
  return /\.(test|spec)\.js$/.test(name);
}

function collectSourceFiles(dir, generatedDir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const collected = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || fullPath === generatedDir) continue;
      collected.push(...collectSourceFiles(fullPath, generatedDir));
    } else if (entry.isFile() && /\.(js|css)$/.test(entry.name) && !isTestFile(entry.name)) {
      collected.push(fullPath);
    }
  }
  return collected;
}

/* -------------------------------------------------------------------------- */
/*  Override endpoint helpers                                                 */
/* -------------------------------------------------------------------------- */

/** Overrides may only target real-looking files under src/ (never generated output or anything outside). */
function isValidOverridePath(value) {
  return (
    typeof value === "string" &&
    !value.includes("\0") &&
    !value.includes("\\") &&
    posix.normalize(value) === value &&
    value.startsWith("src/") &&
    !value.startsWith("src/generated/") &&
    /\.(js|css)$/.test(value)
  );
}

/**
 * Blocks cross-site requests. A malicious web page can make your browser POST to this dev endpoint
 * (a simple request needs no CORS preflight), which would let it inject code into your dev build.
 * Browsers always attach Origin / Sec-Fetch-Site to such requests, so we reject anything that isn't same-origin.
 */
function isSameOriginRequest(req) {
  const site = req.headers["sec-fetch-site"];
  if (site && site !== "same-origin" && site !== "none") return false;

  const origin = req.headers.origin;
  if (origin) {
    try {
      return new URL(origin).host === req.headers.host;
    } catch {
      return false; // e.g. Origin: null from sandboxed frames
    }
  }
  return true;
}

function readJsonBody(req) {
  return new Promise((done) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) tooLarge = true;
      else chunks.push(chunk);
    });
    req.on("end", () => {
      if (tooLarge) return done({ tooLarge: true });
      try {
        done({ body: JSON.parse(Buffer.concat(chunks).toString("utf-8")) });
      } catch {
        done({ body: null });
      }
    });
    req.on("error", () => done({ body: null }));
  });
}

function sendJson(res, status, payload, extraHeaders = {}) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  for (const [name, value] of Object.entries(extraHeaders)) res.setHeader(name, value);
  res.end(JSON.stringify(payload));
}

function normalizeModuleId(moduleId) {
  let id = moduleId.split("?")[0];
  while (id.startsWith("\0")) id = id.slice(1);
  return id;
}

/* -------------------------------------------------------------------------- */
/*  Plugin                                                                    */
/* -------------------------------------------------------------------------- */

export function systemLibraryPlugin() {
  let root = process.cwd();
  const overrideStore = new Map();

  const sourceDir = () => resolve(root, "src");
  const generatedDir = () => resolve(sourceDir(), "generated");
  const manifestPath = () => resolve(generatedDir(), "systemLibraryManifest.js");
  const overridesCachePath = () => resolve(root, "node_modules/.cache/yukios-system-overrides.json");

  const toRootRelativePosixPath = (absolutePath) => relative(root, absolutePath).split(sep).join("/");

  function regenerateManifest() {
    const entries = [];
    for (const filePath of collectSourceFiles(sourceDir(), generatedDir())) {
      try {
        const stats = statSync(filePath);
        entries.push({
          path: relative(sourceDir(), filePath).split(sep).join("/"),
          bytes: stats.size,
          mtime: Math.round(stats.mtimeMs)
        });
      } catch {
        // file vanished between readdir and stat
      }
    }
    entries.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

    const serialized = `export const SYSTEM_LIBRARY_FILES = ${JSON.stringify(entries)};\n`;
    let existing = "";
    try {
      existing = readFileSync(manifestPath(), "utf-8");
    } catch {}
    if (existing !== serialized) {
      mkdirSync(dirname(manifestPath()), { recursive: true });
      writeFileSync(manifestPath(), serialized, "utf-8");
    }
  }

  function loadPersistedOverrides() {
    try {
      if (!existsSync(overridesCachePath())) return;
      const parsed = JSON.parse(readFileSync(overridesCachePath(), "utf-8"));
      for (const [filePath, content] of Object.entries(parsed)) {
        if (isValidOverridePath(filePath) && typeof content === "string") overrideStore.set(filePath, content);
      }
    } catch {
      overrideStore.clear();
    }
  }

  function persistOverrides() {
    try {
      mkdirSync(dirname(overridesCachePath()), { recursive: true });
      writeFileSync(overridesCachePath(), JSON.stringify(Object.fromEntries(overrideStore)), "utf-8");
    } catch (err) {
      console.warn(`[system-library] could not persist overrides: ${err.message}`);
    }
  }

  return {
    name: "yukios-system-library",

    configResolved(config) {
      root = config.root;
    },

    buildStart() {
      regenerateManifest();
    },

    // Serves edited source from the override store instead of disk (dev server only; the store is empty in builds).
    load(id) {
      if (overrideStore.size === 0) return null;
      const rootRelativePath = toRootRelativePosixPath(resolve(normalizeModuleId(id)));
      if (!rootRelativePath.startsWith("src/") || !overrideStore.has(rootRelativePath)) return null;
      return { code: overrideStore.get(rootRelativePath), map: null };
    },

    configureServer(server) {
      loadPersistedOverrides();
      if (overrideStore.size > 0) {
        console.warn(
          `[system-library] ${overrideStore.size} persisted source override(s) are active and replace files on disk. ` +
            `Delete node_modules/.cache/yukios-system-overrides.json to reset.`
        );
      }

      function invalidateModuleTree(rootRelativePath) {
        const absolutePath = resolve(root, rootRelativePath);
        const modules = new Set();
        try {
          const byId = server.moduleGraph.getModuleById(absolutePath);
          if (byId) modules.add(byId);
        } catch {}
        try {
          for (const mod of server.moduleGraph.getModulesByFile(absolutePath) ?? []) modules.add(mod);
        } catch {}
        for (const mod of modules) {
          try {
            server.moduleGraph.invalidateModule(mod);
          } catch {}
        }
        server.ws.send({ type: "full-reload" });
      }

      // Keep the manifest in sync when source files are added or removed while the dev server runs.
      let manifestTimer = null;
      const onSourceListChange = (file) => {
        const abs = resolve(file);
        if (!abs.startsWith(sourceDir() + sep) || abs.startsWith(generatedDir() + sep)) return;
        if (!/\.(js|css)$/.test(abs) || isTestFile(abs)) return;
        clearTimeout(manifestTimer);
        manifestTimer = setTimeout(regenerateManifest, MANIFEST_DEBOUNCE_MS);
      };
      server.watcher.on("add", onSourceListChange);
      server.watcher.on("unlink", onSourceListChange);
      server.httpServer?.once("close", () => clearTimeout(manifestTimer));

      server.middlewares.use(async (req, res, next) => {
        const requestUrl = req.url || "";
        if (!requestUrl.startsWith(OVERRIDES_ROUTE)) return next();
        const routePath = requestUrl.slice(OVERRIDES_ROUTE.length).split("?")[0];
        if (routePath && routePath !== "/") return next();

        if (!isSameOriginRequest(req)) {
          return sendJson(res, 403, { ok: false, error: "cross-origin request rejected" });
        }

        if (req.method === "GET") {
          return sendJson(res, 200, { overrides: Object.fromEntries(overrideStore) });
        }

        if (req.method !== "POST" && req.method !== "DELETE") {
          return sendJson(res, 405, { ok: false, error: "method not allowed" }, { Allow: "GET, POST, DELETE" });
        }

        const { body, tooLarge } = await readJsonBody(req);
        if (tooLarge) return sendJson(res, 413, { ok: false, error: "payload too large" });
        if (!body || !isValidOverridePath(body.path)) {
          return sendJson(res, 400, { ok: false, error: "invalid body or path" });
        }

        if (req.method === "POST") {
          if (typeof body.content !== "string")
            return sendJson(res, 400, { ok: false, error: "content must be a string" });
          overrideStore.set(body.path, body.content);
        } else {
          overrideStore.delete(body.path);
        }

        persistOverrides();
        invalidateModuleTree(body.path);
        return sendJson(res, 200, { ok: true });
      });
    }
  };
}
