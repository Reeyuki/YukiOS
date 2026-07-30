import { defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { viteSingleFile } from "vite-plugin-singlefile";
import { execSync, spawnSync } from "child_process";
import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync } from "fs";
import { resolve, join, dirname } from "path";

const commitHash = (() => {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "unknown";
  }
})();

const readmeContent = readFileSync(resolve(process.cwd(), "../README.md"), "utf-8");

const isDevBuild = process.env.VITE_DEV_BUILD === "true";
const isSingleFile = process.env.VITE_SINGLE_FILE === "true";
const isVisualize = process.env.VITE_VISUALIZE === "true";
const isElectronBuild = process.env.VITE_ELECTRON === "true";

const CDN_BASE = "https://cdn.jsdelivr.net/gh/Reeyuki/yukios@main/";
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
  wasm: "application/wasm"
};

function serveDir(basePath, dir) {
  return (req, res, next) => {
    const filePath = join(dir, req.url.replace(new RegExp("^" + basePath), "") || "index.html");
    try {
      const content = readFileSync(filePath);
      const ext = filePath.split(".").pop();
      res.setHeader("Content-Type", MIME_MAP[ext] || "application/octet-stream");
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
    }
  };
}

function steamNewsData() {
  const FALLBACK_ICON = "https://cdn.jsdelivr.net/gh/Reeyuki/yukios@main/static/icons/steam.webp";
  const OUTPUT_PATH = resolve(process.cwd(), "src/games/steamNewsData.js");
  const FEEDS = [
    { url: "https://store.steampowered.com/feeds/news.xml", source: "News" },
    { url: "https://store.steampowered.com/feeds/newreleases.xml", source: "New Releases" },
    { url: "https://store.steampowered.com/feeds/specials.xml", source: "Sales" }
  ];

  function parseRssItems(xml) {
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
      const block = match[1];
      const titleMatch = block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([\s\S]*?)<\/title>/);
      const descMatch = block.match(
        /<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>|<description>([\s\S]*?)<\/description>/
      );
      const pubDateMatch = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
      const enclosureMatch = block.match(/<enclosure[^>]*url="([^"]+)"/);
      const mediaContentMatch = block.match(/<media:content[^>]*url="([^"]+)"/);
      const rawDesc = (descMatch && (descMatch[1] || descMatch[2])) || "";
      const imgInDescMatch = rawDesc.match(/<img[^>]*src="([^"]+)"/);

      items.push({
        title: ((titleMatch && (titleMatch[1] || titleMatch[2])) || "").trim(),
        pubDate: ((pubDateMatch && pubDateMatch[1]) || "").trim(),
        image:
          (enclosureMatch && enclosureMatch[1]) ||
          (mediaContentMatch && mediaContentMatch[1]) ||
          (imgInDescMatch && imgInDescMatch[1]) ||
          ""
      });
    }
    return items;
  }

  return {
    name: "steam-news-data",
    async buildStart() {
      const CACHE_FILE = resolve(process.cwd(), "node_modules/.cache/steam-news.json");
      const CACHE_TTL = 60 * 60 * 1000;
      let allItems = [];

      try {
        if (existsSync(CACHE_FILE)) {
          const cached = JSON.parse(readFileSync(CACHE_FILE, "utf-8"));
          if (Date.now() - cached.timestamp < CACHE_TTL) {
            console.log(`Using cached steam news (${cached.items.length} items)`);
            allItems = cached.items;
          } else {
            console.log("Steam news cache expired, refetching...");
          }
        }
      } catch {
        console.log("Steam news cache invalid, refetching...");
      }

      if (allItems.length === 0) {
        try {
          const results = await Promise.all(
            FEEDS.map(async (feed) => {
              try {
                const resp = await fetch(feed.url);
                if (!resp.ok) return [];
                const xml = await resp.text();
                return parseRssItems(xml);
              } catch {
                return [];
              }
            })
          );

          allItems = results.flat();

          console.log(`Fetched ${allItems.length} steam news items`);
        } catch (err) {
          console.error("Failed to fetch steam news:", err.message);
        }

        try {
          mkdirSync(dirname(CACHE_FILE), { recursive: true });
          writeFileSync(CACHE_FILE, JSON.stringify({ timestamp: Date.now(), items: allItems }), "utf-8");
          console.log("Steam news cache saved");
        } catch (err) {
          console.error("Failed to save steam news cache:", err.message);
        }
      }

      const items = allItems.map((item) => ({
        image: item.image || FALLBACK_ICON,
        title: item.title || "",
        date: item.pubDate
          ? new Date(item.pubDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
          : "Recent"
      }));

      const content = `// Auto-generated by vite.config.js steamNewsData plugin
export const STEAM_NEWS_ITEMS = ${JSON.stringify(items, null, 2)};
`;

      writeFileSync(OUTPUT_PATH, content, "utf-8");
    }
  };
}

function staticCdnRewrite() {
  return {
    name: "static-cdn-rewrite",
    closeBundle() {
      if (isSingleFile || isElectronBuild) return;
      const fp = resolve(outDir, "index.html");
      const html = readFileSync(fp, "utf-8");
      const out = html.replace(
        /(src|href)="(static\/|src\/styles\/)/g,
        (_, attr, path) => `${attr}="${CDN_BASE}${path}`
      );
      writeFileSync(fp, out);
    }
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
    }
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
    }
  };
}

function pageGenerator() {
  function runGenerator() {
    const result = spawnSync("node", ["scripts/generateSitemap.js"], {
      cwd: __dirname,
      stdio: "inherit"
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
    }
  };
}

const plugins = [
  nodePolyfills({
    include: ["buffer", "process", "stream", "path", "util", "timers"],
    globals: { Buffer: true, global: true, process: true },
    protocolImports: true
  }),
  serveStaticDev(),
  steamNewsData()
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
      writeFileSync(resolve(outDir, "bundle-stats.txt"), lines.join("\n"), "utf-8");
    }
  });
}
plugins.push(staticCdnRewrite());
plugins.push(removeCosmicFolder());
plugins.push(pageGenerator());
plugins.push(copyRemoteClient());

export default defineConfig({
  base: isSingleFile || isElectronBuild ? "./" : "/",
  outDir,
  plugins,
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Resource-Policy": "cross-origin"
    }
  },
  define: {
    __GIT_COMMIT__: JSON.stringify(commitHash),
    __README_CONTENT__: JSON.stringify(readmeContent),
    __SINGLE_FILE__: isSingleFile
  },
  build: {
    target: "esnext",
    minify: isDevBuild ? false : "esbuild",
    sourcemap: false,
    cssMinify: isDevBuild ? false : "esbuild",
    cssCodeSplit: !isSingleFile,
    modulePreload: !isDevBuild,
    reportCompressedSize: !isDevBuild,
    assetsInlineLimit: 100000,
    rollupOptions: {
      treeshake: !isDevBuild,
      external: isSingleFile ? ["7z-wasm", "archive-wasm", "clippyjs", /^clippyjs\/.*/] : [],
      output: {
        inlineDynamicImports: isSingleFile,
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]",
        manualChunks: isSingleFile ? undefined : undefined
      }
    }
  },
  esbuild: {
    legalComments: "inline"
  }
});
