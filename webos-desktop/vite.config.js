import { defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { viteSingleFile } from "vite-plugin-singlefile";
import { systemLibraryPlugin } from "./plugins/systemLibraryPlugin.js";
import { iconRegistryPlugin } from "./plugins/iconRegistryPlugin.js";
import { papirusDataPlugin } from "./plugins/papirusDataPlugin.js";
import { execSync, spawnSync } from "child_process";
import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync } from "fs";
import { resolve, join, dirname } from "path";
import dns from "dns";

dns.setDefaultResultOrder("verbatim");

const commitHash = (() => {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "unknown";
  }
})();

const readmeContent = readFileSync(
  resolve(process.cwd(), "../README.md"),
  "utf-8",
);

function normalizeRepoUrl(repository) {
  let url =
    typeof repository === "string" ? repository : repository && repository.url;
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

function readPackageMeta(pkgPath) {
  try {
    return JSON.parse(readFileSync(pkgPath, "utf-8"));
  } catch {
    return null;
  }
}
function collectPackageLicenses() {
  const entries = [];

  try {
    const pkgJson = JSON.parse(
      readFileSync(resolve(process.cwd(), "package.json"), "utf-8"),
    );

    for (const [name, spec] of Object.entries(pkgJson.dependencies || {})) {
      const meta = readPackageMeta(
        resolve(process.cwd(), "node_modules", name, "package.json"),
      );

      let version = spec;
      let license = "Unknown";
      let repo = "";

      if (meta) {
        if (meta.version) version = meta.version;

        if (typeof meta.license === "string") license = meta.license;
        else if (meta.license && meta.license.type) license = meta.license.type;
        else if (Array.isArray(meta.licenses)) {
          license = meta.licenses.map((l) => l.type || l).join(", ");
        }

        repo = normalizeRepoUrl(meta.repository);
      }

      entries.push({ name, version, license, repo });
    }
  } catch (err) {
    console.warn("Failed to collect package licenses:", err.message);
  }

  entries.push({
    name: "hatsune-miku-windows-linux-cursors",
    version: "git",
    license: "Fan art (non-commercial)",
    repo: "https://github.com/supermariofps/hatsune-miku-windows-linux-cursors",
  });

  entries.push({
    name: "win11react",
    version: "0.1.1",
    license: "CC0-1.0",
    repo: "https://github.com/blueedgetechno/win11React",
  });

  entries.push({
    name: "neko",
    version: "git",
    license: "BSD-2-Clause",
    repo: "https://github.com/crgimenes/neko",
  });

  entries.sort((a, b) => a.name.localeCompare(b.name));

  return entries;
}

const packageLicenses = collectPackageLicenses();

const isDevBuild = process.env.VITE_DEV_BUILD === "true";
const isSingleFile = process.env.VITE_SINGLE_FILE === "true";
const isVisualize = process.env.VITE_VISUALIZE === "true";
const isElectronBuild = process.env.VITE_ELECTRON === "true";
const DISABLE_STEAM_NEWS_FETCH = true;

const CDN_BASE = "https://gcore.jsdelivr.net/gh/NaoTomori1/yukios@main/";
const outDir = resolve(__dirname, "dist");
const staticDir = resolve(__dirname, "../static");
const remoteDir = resolve(__dirname, "remote");

const MIME_MAP = {
  html: "text/html",
  png: "image/png",
  jpg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  js: "application/javascript",
  css: "text/css",
  wasm: "application/wasm",
};

function serveDir(basePath, dir) {
  return (req, res, next) => {
    const filePath = join(
      dir,
      req.url.replace(new RegExp("^" + basePath), "") || "index.html",
    );
    try {
      const content = readFileSync(filePath);
      const ext = filePath.split(".").pop();
      res.setHeader(
        "Content-Type",
        MIME_MAP[ext] || "application/octet-stream",
      );
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      res.end(content);
    } catch {
      next();
    }
  };
}

function serveStaticDev() {
  return {
    name: "serve-static-dev",
    configureServer(server) {
      server.middlewares.use("/static/", serveDir("/static/", staticDir));
      server.middlewares.use("/remote/", serveDir("/remote/", remoteDir));
    },
  };
}

function faviconBundlePlugin() {
  return {
    name: "favicon-bundle",
    async buildStart() {
      const favDir = resolve(process.cwd(), "../static/icons/favicons");
      const { existsSync, readdirSync } = await import("fs");
      const count = existsSync(favDir)
        ? readdirSync(favDir).filter((f) => f.endsWith(".webp")).length
        : 0;
      if (count < 36) {
        try {
          const { spawnSync } = await import("child_process");
          console.log(
            `[favicon-bundle] Found ${count}/36 favicons, fetching...`,
          );
          const res = spawnSync("node", ["scripts/fetchFavicons.js"], {
            stdio: "inherit",
            cwd: process.cwd(),
          });
          if (res.status !== 0)
            console.warn(
              "[favicon-bundle] fetch failed, continuing with fallback",
            );
          else console.log("[favicon-bundle] favicons ready");
        } catch (e) {
          console.warn("[favicon-bundle] error", e.message);
        }
      } else {
        console.log(`[favicon-bundle] ${count} favicons cached, skip fetch`);
      }
    },
  };
}

function steamNewsData() {
  const FALLBACK_ICON = "fab fa-steam";
  const OUTPUT_PATH = resolve(process.cwd(), "src/games/steamNewsData.js");
  const FEED_TIMEOUT_MS = 10000;
  const FEEDS = [
    { url: "https://store.steampowered.com/feeds/news.xml", source: "News" },
    {
      url: "https://store.steampowered.com/feeds/newreleases.xml",
      source: "New Releases",
    },
    {
      url: "https://store.steampowered.com/feeds/specials.xml",
      source: "Sales",
    },
  ];

  function parseRssItems(xml) {
    const items = [];
    const itemRegex = /<item\b[^>]*>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
      const block = match[1];
      const titleMatch = block.match(
        /<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([\s\S]*?)<\/title>/,
      );
      const descMatch = block.match(
        /<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>|<description>([\s\S]*?)<\/description>/,
      );
      const encodedMatch = block.match(
        /<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/,
      );
      const pubDateMatch = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
      const enclosureMatch = block.match(/<enclosure[^>]*url="([^"]+)"/);
      const mediaContentMatch = block.match(/<media:content[^>]*url="([^"]+)"/);
      const rawDesc =
        (descMatch && (descMatch[1] || descMatch[2])) ||
        (encodedMatch && encodedMatch[1]) ||
        "";
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
        description: plainDesc,
      });
    }
    return items;
  }

  async function fetchFeedItems(feed) {
    try {
      const resp = await fetch(feed.url, {
        signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
      });
      if (!resp.ok) {
        console.warn(`Steam feed ${feed.source} responded ${resp.status}`);
        return [];
      }
      return parseRssItems(await resp.text());
    } catch (err) {
      console.warn(`Steam feed ${feed.source} failed: ${err.message}`);
      return [];
    }
  }

  return {
    name: "steam-news-data",
    async buildStart() {
      if (DISABLE_STEAM_NEWS_FETCH) {
        console.log(
          "Steam news fetch disabled, keeping existing steamNewsData.js",
        );
        return;
      }
      const CACHE_FILE = resolve(
        process.cwd(),
        "node_modules/.cache/steam-news.json",
      );
      const CACHE_TTL = 60 * 60 * 1000;
      let allItems = [];

      try {
        if (existsSync(CACHE_FILE)) {
          const cached = JSON.parse(readFileSync(CACHE_FILE, "utf-8"));
          if (Date.now() - cached.timestamp < CACHE_TTL) {
            console.log(
              `Using cached steam news (${cached.items.length} items)`,
            );
            allItems = cached.items;
          } else {
            console.log("Steam news cache expired, refetching...");
          }
        }
      } catch {
        console.log("Steam news cache invalid, refetching...");
      }

      if (allItems.length === 0) {
        allItems = (await Promise.all(FEEDS.map(fetchFeedItems))).flat();
        console.log(`Fetched ${allItems.length} steam news items`);

        if (allItems.length > 0) {
          try {
            mkdirSync(dirname(CACHE_FILE), { recursive: true });
            writeFileSync(
              CACHE_FILE,
              JSON.stringify({ timestamp: Date.now(), items: allItems }),
              "utf-8",
            );
            console.log("Steam news cache saved");
          } catch (err) {
            console.error("Failed to save steam news cache:", err.message);
          }
        } else {
          console.warn(
            "Steam news fetch returned no items, keeping existing cache untouched",
          );
        }
      }

      if (allItems.length === 0 && existsSync(OUTPUT_PATH)) {
        console.log(
          "Steam news unavailable, keeping previously generated file",
        );
        return;
      }

      const items = [
        ...allItems
          .filter((item) => !/(team fortress 2)/i.test(item.title || ""))
          .map((item) => ({
            image: item.image || FALLBACK_ICON,
            title: item.title || "",
            description: (item.description || "").slice(0, 320),
            date: item.pubDate
              ? new Date(item.pubDate).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })
              : "Recent",
          })),
      ];

      const content = `// Auto-generated by vite.config.js steamNewsData plugin
export const STEAM_NEWS_ITEMS = ${JSON.stringify(items, null, 2)};
`;

      let existingContent = null;
      try {
        existingContent = readFileSync(OUTPUT_PATH, "utf-8");
      } catch {}
      if (existingContent === content) return;

      writeFileSync(OUTPUT_PATH, content, "utf-8");
    },
  };
}

function staticCdnRewrite() {
  return {
    name: "static-cdn-rewrite",
    closeBundle() {
      if (isSingleFile || isElectronBuild) return;
      const fp = resolve(outDir, "index.html");
      if (!existsSync(fp)) {
        console.warn(`[static-cdn-rewrite] ${fp} not found, skipping rewrite`);
        return;
      }
      const html = readFileSync(fp, "utf-8");
      const out = html.replace(
        /(src|href)="(static\/|src\/styles\/)/g,
        (_, attr, path) => `${attr}="${CDN_BASE}${path}`,
      );
      writeFileSync(fp, out);
    },
  };
}

function removeCosmicFolder() {
  return {
    name: "remove-cosmic-folder",
    closeBundle() {
      const cosmicPath = resolve(outDir, "skybox/cosmic.exr");
      if (existsSync(cosmicPath)) {
        rmSync(cosmicPath, { force: true });
      }
    },
  };
}

function copyRemoteClient() {
  return {
    name: "copy-remote-client",
    closeBundle() {
      const dstDir = resolve(outDir, "remote");
      mkdirSync(dstDir, { recursive: true });
      for (const file of ["index.html", "client.js", "RemoteClientCore.js"]) {
        const src = join(remoteDir, file);
        if (existsSync(src)) {
          writeFileSync(join(dstDir, file), readFileSync(src));
          console.log(`Copied remote/${file} → dist/remote/${file}`);
        }
      }
    },
  };
}

function removeBoxedWineDist() {
  return {
    name: "remove-boxedwine-dist",
    closeBundle() {
      rmSync(resolve(outDir, "static/apps/boxedwine"), {
        recursive: true,
        force: true,
      });
    },
  };
}

function pageGenerator() {
  function runGenerator() {
    const result = spawnSync("node", ["scripts/generateSitemap.js"], {
      cwd: __dirname,
      stdio: "inherit",
    });
    if (result.status !== 0) {
      throw new Error("Page generation failed");
    }
  }
  return {
    name: "page-generator",
    closeBundle() {
      if (isDevBuild) return;
      runGenerator();
    },
    configureServer(server) {
      server.middlewares.use("/features.html", serveDir("/", outDir));
      server.middlewares.use("/apps.html", serveDir("/", outDir));
      server.middlewares.use("/games.html", serveDir("/", outDir));
      server.middlewares.use("/404.html", serveDir("/", outDir));
      server.middlewares.use("/sitemap.xml", serveDir("/", outDir));
      server.middlewares.use("/app/", serveDir("/app/", outDir));
      server.middlewares.use("/class/", serveDir("/class/", outDir));
      server.middlewares.use("/games/", serveDir("/games/", outDir));
      server.middlewares.use("/feature/", serveDir("/feature/", outDir));
    },
  };
}

const plugins = [
  nodePolyfills({
    include: ["buffer", "process", "stream", "path", "util", "timers"],
    globals: { Buffer: true, global: true, process: true },
    protocolImports: true,
  }),
  serveStaticDev(),
  steamNewsData(),
  systemLibraryPlugin(),
  iconRegistryPlugin(),
  papirusDataPlugin(),
  faviconBundlePlugin(),
];
if (isSingleFile) {
  plugins.unshift(viteSingleFile());
}
if (isVisualize) {
  plugins.push({
    name: "bundle-stats",
    generateBundle(opts, bundle) {
      const lines = [];
      for (const [fileName, info] of Object.entries(bundle)) {
        if (info.type === "chunk") {
          const total = info.code.length;
          const sorted = Object.entries(info.modules)
            .sort(([, a], [, b]) => b.renderedLength - a.renderedLength)
            .map(([modPath, mod]) => {
              const size = mod.renderedLength || 0;
              const pct = ((size / total) * 100).toFixed(2);
              return `${String(pct).padStart(6)}% ${String(size).padStart(9)} B  ${modPath}`;
            });
          lines.push(`\n=== ${fileName} (${total} B) ===`);
          lines.push(...sorted);
        }
        if (info.type === "asset") {
          lines.push(`\n--- ${fileName} (${info.source.length} B) ---`);
        }
      }
      writeFileSync(
        resolve(outDir, "bundle-stats.txt"),
        lines.join("\n"),
        "utf-8",
      );
    },
  });
}
plugins.push(staticCdnRewrite());
plugins.push(removeCosmicFolder());
plugins.push(pageGenerator());
plugins.push(copyRemoteClient());
plugins.push(removeBoxedWineDist());

const baseOutput = {
  entryFileNames: "assets/[name].[hash].js",
  chunkFileNames: "assets/[name].[hash].js",
  assetFileNames: "assets/[name].[hash][extname]",
};
if (isSingleFile) {
  baseOutput.inlineDynamicImports = true;
}

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
        "./src/games/gamesList.js",
      ],
    },
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Resource-Policy": "cross-origin",
    },
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
      "vite-plugin-node-polyfills/shims/buffer",
    ],
  },
  define: {
    __GIT_COMMIT__: JSON.stringify(commitHash),
    __README_CONTENT__: JSON.stringify(readmeContent),
    __SINGLE_FILE__: isSingleFile,
    __PACKAGE_LICENSES__: JSON.stringify(packageLicenses),
  },
  build: {
    outDir,
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
      external: isSingleFile
        ? [
            "7z-wasm",
            "archive-wasm",
            "clippyjs",
            /^clippyjs\/.*/,
            "eruda",
            "html2canvas-pro",
            "isomorphic-git",
            /^isomorphic-git\/.*/,
            "@webcontainer/api",
          ]
        : [],
      output: baseOutput,
    },
  },
  esbuild: {
    legalComments: "inline",
  },
});
