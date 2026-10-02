import { defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { viteSingleFile } from "vite-plugin-singlefile";
import { systemLibraryPlugin } from "./plugins/systemLibraryPlugin.js";
import { iconRegistryPlugin } from "./plugins/iconRegistryPlugin.js";
import { papirusDataPlugin } from "./plugins/papirusDataPlugin.js";
import { execSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  createReadStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import dns from "node:dns";

dns.setDefaultResultOrder("verbatim");

/* -------------------------------------------------------------------------- */
/*  Paths & flags                                                             */
/* -------------------------------------------------------------------------- */

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(ROOT, "dist");
const STATIC_DIR = resolve(ROOT, "../static");
const REMOTE_DIR = resolve(ROOT, "remote");

const isDevBuild = process.env.VITE_DEV_BUILD === "true";
const isSingleFile = process.env.VITE_SINGLE_FILE === "true";
const isVisualize = process.env.VITE_VISUALIZE === "true";
const isElectronBuild = process.env.VITE_ELECTRON === "true";

// Override with VITE_CDN_BASE (must end with "/") to pin a commit or switch repos.
const CDN_BASE = process.env.VITE_CDN_BASE || "https://cdn.jsdelivr.net/gh/NaoTomori1/yukios@main/";

const MIN_FAVICON_COUNT = 36;

/* -------------------------------------------------------------------------- */
/*  Build-time metadata                                                       */
/* -------------------------------------------------------------------------- */

const commitHash = (() => {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "unknown";
  }
})();

const readmeContent = (() => {
  try {
    return readFileSync(resolve(ROOT, "../README.md"), "utf-8");
  } catch {
    console.warn("[config] ../README.md not found, embedding empty README");
    return "";
  }
})();

function normalizeRepoUrl(repository) {
  let url = typeof repository === "string" ? repository : repository && repository.url;
  if (!url) return "";
  url = url
    .replace(/^git\+/, "")
    .replace(/^git:\/\//, "https://")
    .replace(/^git@([^:]+):/, "https://$1/")
    .replace(/^github:/, "https://github.com/")
    .replace(/\.git$/, "");
  if (/^[A-Za-z0-9-]+\/[\w.-]+$/.test(url)) {
    url = `https://github.com/${url}`;
  }
  return /^https?:\/\//.test(url) ? url : "";
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

function collectPackageLicenses() {
  const pkgJson = readJson(resolve(ROOT, "package.json"));
  if (!pkgJson) {
    console.warn("[config] Failed to read package.json for license collection");
    return [];
  }

  const entries = Object.entries(pkgJson.dependencies || {}).map(([name, spec]) => {
    const meta = readJson(resolve(ROOT, "node_modules", name, "package.json"));
    let version = spec;
    let license = "Unknown";
    let repo = "";
    if (meta) {
      if (meta.version) version = meta.version;
      if (typeof meta.license === "string") license = meta.license;
      else if (meta.license && meta.license.type) license = meta.license.type;
      else if (Array.isArray(meta.licenses)) license = meta.licenses.map((l) => l.type || l).join(", ");
      repo = normalizeRepoUrl(meta.repository);
    }
    return { name, version, license, repo };
  });

  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

const packageLicenses = collectPackageLicenses();

/* -------------------------------------------------------------------------- */
/*  Dev-server static file serving                                            */
/* -------------------------------------------------------------------------- */

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".wasm": "application/wasm",
  ".swf": "application/x-shockwave-flash"
};

/**
 * Builds a connect middleware that serves files from disk.
 * Each route is `{ prefix, dir, strip }`:
 *  - `prefix` is matched against the full request path (e.g. "/static/" or "/features.html")
 *  - `strip: true` removes the prefix before resolving the file inside `dir`
 * Query strings are ignored, paths are decoded, and anything that escapes `dir` is rejected.
 */
function createFileServer(routes) {
  return (req, res, next) => {
    let pathname;
    try {
      pathname = decodeURIComponent((req.originalUrl || req.url || "/").split("?")[0]);
    } catch {
      return next();
    }

    const route = routes.find((r) => (r.prefix.endsWith("/") ? pathname.startsWith(r.prefix) : pathname === r.prefix));
    if (!route) return next();

    const relative = route.strip ? pathname.slice(route.prefix.length) : pathname.slice(1);
    let target = resolve(route.dir, relative);
    if (target !== route.dir && !target.startsWith(route.dir + sep)) return next();

    try {
      if (statSync(target).isDirectory()) target = join(target, "index.html");
      if (!statSync(target).isFile()) return next();
    } catch {
      return next();
    }

    res.setHeader("Content-Type", MIME_TYPES[extname(target).toLowerCase()] || "application/octet-stream");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    createReadStream(target)
      .on("error", () => next())
      .pipe(res);
  };
}

function serveStaticDev() {
  return {
    name: "serve-static-dev",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(
        createFileServer([
          { prefix: "/static/", dir: STATIC_DIR, strip: true },
          { prefix: "/remote/", dir: REMOTE_DIR, strip: true }
        ])
      );
    }
  };
}

/* -------------------------------------------------------------------------- */
/*  Plugins                                                                   */
/* -------------------------------------------------------------------------- */

function faviconBundlePlugin() {
  return {
    name: "favicon-bundle",
    buildStart() {
      const favDir = resolve(STATIC_DIR, "icons/favicons");
      const count = existsSync(favDir) ? readdirSync(favDir).filter((f) => f.endsWith(".webp")).length : 0;

      if (count >= MIN_FAVICON_COUNT) {
        console.log(`[favicon-bundle] ${count} favicons cached, skip fetch`);
        return;
      }

      console.log(`[favicon-bundle] Found ${count}/${MIN_FAVICON_COUNT} favicons, fetching...`);
      const res = spawnSync(process.execPath, ["scripts/fetchFavicons.js"], { stdio: "inherit", cwd: ROOT });
      if (res.status !== 0) console.warn("[favicon-bundle] fetch failed, continuing with fallback");
      else console.log("[favicon-bundle] favicons ready");
    }
  };
}

const STEAM_FALLBACK_ICON = "fab fa-steam";
const STEAM_FEEDS = [
  { url: "https://store.steampowered.com/feeds/news.xml", source: "News" },
  { url: "https://store.steampowered.com/feeds/newreleases.xml", source: "New Releases" },
  { url: "https://store.steampowered.com/feeds/specials.xml", source: "Sales" }
];
const STEAM_FETCH_TIMEOUT_MS = 10_000;
const STEAM_CACHE_TTL_MS = 60 * 60 * 1000;

function parseRssItems(xml) {
  const items = [];
  const itemRegex = /<item\b[^>]*>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const titleMatch = block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([\s\S]*?)<\/title>/);
    const descMatch = block.match(
      /<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>|<description>([\s\S]*?)<\/description>/
    );
    const encodedMatch = block.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/);
    const pubDateMatch = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
    const enclosureMatch = block.match(/<enclosure[^>]*url="([^"]+)"/);
    const mediaContentMatch = block.match(/<media:content[^>]*url="([^"]+)"/);
    const rawDesc = (descMatch && (descMatch[1] || descMatch[2])) || (encodedMatch && encodedMatch[1]) || "";
    const imgInDescMatch = rawDesc.match(/<img[^>]*src="([^"]+)"/);
    const plainDesc = rawDesc
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\]\]>\s*$/, "")
      .trim();

    items.push({
      title: ((titleMatch && (titleMatch[1] || titleMatch[2])) || "").trim(),
      pubDate: ((pubDateMatch && pubDateMatch[1]) || "").trim(),
      image:
        (enclosureMatch && enclosureMatch[1]) ||
        (mediaContentMatch && mediaContentMatch[1]) ||
        (imgInDescMatch && imgInDescMatch[1]) ||
        "",
      description: plainDesc
    });
  }
  return items;
}

async function fetchSteamFeed(feed) {
  try {
    const resp = await fetch(feed.url, { signal: AbortSignal.timeout(STEAM_FETCH_TIMEOUT_MS) });
    if (!resp.ok) return [];
    return parseRssItems(await resp.text());
  } catch {
    return [];
  }
}

function steamNewsData() {
  const OUTPUT_PATH = resolve(ROOT, "src/games/steamNewsData.js");
  const CACHE_FILE = resolve(ROOT, "node_modules/.cache/steam-news.json");

  return {
    name: "steam-news-data",
    async buildStart() {
      let allItems = [];

      const cached = readJson(CACHE_FILE);
      if (cached && Array.isArray(cached.items) && Date.now() - cached.timestamp < STEAM_CACHE_TTL_MS) {
        console.log(`[steam-news] Using cached news (${cached.items.length} items)`);
        allItems = cached.items;
      }

      if (allItems.length === 0) {
        allItems = (await Promise.all(STEAM_FEEDS.map(fetchSteamFeed))).flat();
        console.log(`[steam-news] Fetched ${allItems.length} items`);

        // Never cache a failed/empty fetch, otherwise an outage sticks for the whole TTL.
        if (allItems.length > 0) {
          try {
            mkdirSync(dirname(CACHE_FILE), { recursive: true });
            writeFileSync(CACHE_FILE, JSON.stringify({ timestamp: Date.now(), items: allItems }), "utf-8");
          } catch (err) {
            console.warn("[steam-news] Failed to save cache:", err.message);
          }
        }
      }

      // Offline or blocked: keep the last generated file instead of overwriting it with nothing.
      if (allItems.length === 0 && existsSync(OUTPUT_PATH)) {
        console.warn("[steam-news] No data available, keeping existing steamNewsData.js");
        return;
      }

      const items = allItems
        .filter((item) => !/(team fortress 2)/i.test(item.title || ""))
        .map((item) => ({
          image: item.image || STEAM_FALLBACK_ICON,
          title: item.title || "",
          description: (item.description || "").slice(0, 320),
          date: item.pubDate
            ? new Date(item.pubDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
            : "Recent"
        }));

      const content = `// Auto-generated by vite.config.js steamNewsData plugin
export const STEAM_NEWS_ITEMS = ${JSON.stringify(items, null, 2)};
`;

      // Only touch the file when it actually changed (avoids dirty git state and needless HMR).
      const previous = existsSync(OUTPUT_PATH) ? readFileSync(OUTPUT_PATH, "utf-8") : null;
      if (previous !== content) writeFileSync(OUTPUT_PATH, content, "utf-8");
    }
  };
}

function staticCdnRewrite() {
  return {
    name: "static-cdn-rewrite",
    apply: "build",
    closeBundle() {
      if (isSingleFile || isElectronBuild) return;
      const fp = resolve(OUT_DIR, "index.html");
      if (!existsSync(fp)) {
        console.warn(`[static-cdn-rewrite] ${fp} not found, skipping rewrite`);
        return;
      }
      const html = readFileSync(fp, "utf-8");
      const out = html.replace(
        /(src|href)="(static\/|src\/styles\/)/g,
        (_, attr, path) => `${attr}="${CDN_BASE}${path}`
      );
      writeFileSync(fp, out);
    }
  };
}

function removeCosmicSkybox() {
  return {
    name: "remove-cosmic-skybox",
    apply: "build",
    closeBundle() {
      rmSync(resolve(OUT_DIR, "skybox/cosmic.exr"), { force: true });
    }
  };
}

function copyRemoteClient() {
  return {
    name: "copy-remote-client",
    apply: "build",
    closeBundle() {
      const dstDir = resolve(OUT_DIR, "remote");
      mkdirSync(dstDir, { recursive: true });
      for (const file of ["index.html", "client.js", "RemoteClientCore.js"]) {
        const src = join(REMOTE_DIR, file);
        if (existsSync(src)) {
          copyFileSync(src, join(dstDir, file));
          console.log(`[copy-remote-client] remote/${file} → dist/remote/${file}`);
        }
      }
    }
  };
}

function pageGenerator() {
  let isBuild = false;
  return {
    name: "page-generator",
    configResolved(config) {
      isBuild = config.command === "build";
    },
    closeBundle() {
      // closeBundle also fires when the dev server shuts down, so only generate on real builds.
      if (!isBuild || isDevBuild) return;
      const result = spawnSync(process.execPath, ["scripts/generateSitemap.js"], { cwd: ROOT, stdio: "inherit" });
      if (result.status !== 0) throw new Error("Page generation failed");
    },
    configureServer(server) {
      server.middlewares.use(
        createFileServer([
          { prefix: "/features.html", dir: OUT_DIR },
          { prefix: "/apps.html", dir: OUT_DIR },
          { prefix: "/games.html", dir: OUT_DIR },
          { prefix: "/404.html", dir: OUT_DIR },
          { prefix: "/sitemap.xml", dir: OUT_DIR },
          { prefix: "/app/", dir: OUT_DIR },
          { prefix: "/class/", dir: OUT_DIR },
          { prefix: "/games/", dir: OUT_DIR },
          { prefix: "/feature/", dir: OUT_DIR }
        ])
      );
    }
  };
}

function bundleStats() {
  return {
    name: "bundle-stats",
    apply: "build",
    generateBundle(_opts, bundle) {
      const lines = [];
      for (const [fileName, info] of Object.entries(bundle)) {
        if (info.type === "chunk") {
          const total = info.code.length;
          const rows = Object.entries(info.modules)
            .sort(([, a], [, b]) => b.renderedLength - a.renderedLength)
            .map(([modPath, mod]) => {
              const size = mod.renderedLength || 0;
              const pct = ((size / total) * 100).toFixed(2);
              return `${String(pct).padStart(6)}% ${String(size).padStart(9)} B  ${modPath}`;
            });
          lines.push(`\n=== ${fileName} (${total} B) ===`, ...rows);
        } else {
          lines.push(`\n--- ${fileName} (${info.source.length} B) ---`);
        }
      }
      this.emitFile({ type: "asset", fileName: "bundle-stats.txt", source: lines.join("\n") });
    }
  };
}

const plugins = [
  nodePolyfills({
    include: ["buffer", "process", "stream", "path", "util", "timers", "crypto"],
    globals: { Buffer: true, global: true, process: true },
    protocolImports: true
  }),
  serveStaticDev(),
  steamNewsData(),
  systemLibraryPlugin(),
  iconRegistryPlugin(),
  papirusDataPlugin(),
  faviconBundlePlugin()
];

if (isSingleFile) plugins.unshift(viteSingleFile());
if (isVisualize) plugins.push(bundleStats());

plugins.push(staticCdnRewrite(), removeCosmicSkybox(), pageGenerator(), copyRemoteClient());

/* -------------------------------------------------------------------------- */
/*  Config                                                                    */
/* -------------------------------------------------------------------------- */

const output = {
  entryFileNames: "assets/[name].[hash].js",
  chunkFileNames: "assets/[name].[hash].js",
  assetFileNames: "assets/[name].[hash][extname]",
  ...(isSingleFile && { inlineDynamicImports: true })
};

export default defineConfig({
  base: isSingleFile || isElectronBuild ? "./" : "/",
  plugins,
  server: {
    host: "127.0.0.1",
    warmup: {
      clientFiles: [
        "./src/main.js",
        "./src/SessionManager.js",
        "./src/framework.js",
        "./src/os/index.js",
        "./src/utils/utils.js",
        "./src/games/games.js",
        "./src/games/gamesList.js"
      ]
    },
    // Required for SharedArrayBuffer / WebContainer. Production hosting must send the same headers.
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Resource-Policy": "cross-origin"
    }
  },
  optimizeDeps: {
    include: [
      "monaco-editor",
      "three",
      "pdfjs-dist",
      "marked",
      "gsap",
      "xlsx",
      "docx",
      "html2canvas-pro",
      "webtorrent",
      "vite-plugin-node-polyfills/shims/buffer"
    ]
  },
  define: {
    __GIT_COMMIT__: JSON.stringify(commitHash),
    __README_CONTENT__: JSON.stringify(readmeContent),
    __SINGLE_FILE__: isSingleFile,
    __PACKAGE_LICENSES__: JSON.stringify(packageLicenses)
  },
  build: {
    // NOTE: `outDir` previously sat at the top level of the config, where Vite ignores it.
    outDir: OUT_DIR,
    emptyOutDir: true,
    target: "esnext",
    minify: isDevBuild ? false : "esbuild",
    sourcemap: false,
    cssMinify: isDevBuild ? false : "esbuild",
    cssCodeSplit: !isSingleFile,
    modulePreload: !isDevBuild,
    reportCompressedSize: !isDevBuild,
    assetsInlineLimit: 0,
    rollupOptions: {
      treeshake: !isDevBuild,
      external: isSingleFile ? ["7z-wasm", "archive-wasm", "clippyjs", /^clippyjs\/.*/] : [],
      output
    }
  },
  esbuild: {
    legalComments: "inline"
  }
});
