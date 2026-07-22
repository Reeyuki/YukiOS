import { defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { viteSingleFile } from "vite-plugin-singlefile";
import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { resolve, join } from "path";

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

const CDN_BASE = "https://cdn.jsdelivr.net/gh/Reeyuki/yukios@main/";
const outDir = resolve(__dirname, "dist");
const staticDir = resolve(__dirname, "../static");

function serveStaticDev() {
  return {
    name: "serve-static-dev",
    configureServer(server) {
      server.middlewares.use("/static/", (req, res, next) => {
        const filePath = join(staticDir, req.url.replace(/^\/static\//, ""));
        try {
          const content = readFileSync(filePath);
          const ext = filePath.split(".").pop();
          const mimes = {
            png: "image/png",
            jpg: "image/jpeg",
            gif: "image/gif",
            svg: "image/svg+xml",
            ico: "image/x-icon",
            js: "application/javascript",
            css: "text/css"
          };
          res.setHeader("Content-Type", mimes[ext] || "application/octet-stream");
          res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
          res.end(content);
        } catch {
          next();
        }
      });
    }
  };
}

function staticCdnRewrite() {
  return {
    name: "static-cdn-rewrite",
    closeBundle() {
      if (isSingleFile) return;
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

const plugins = [
  nodePolyfills({
    include: ["buffer", "process", "stream", "path", "util", "timers"],
    globals: { Buffer: true, global: true, process: true },
    protocolImports: true
  }),
  serveStaticDev()
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

export default defineConfig({
  base: isSingleFile ? "./" : "/",
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
    assetsInlineLimit: isSingleFile ? 100000000 : 4096,
    rollupOptions: {
      treeshake: !isDevBuild,
      external: isSingleFile ? ["three", /^three\/.*/, "7z-wasm", "archive-wasm", "clippyjs", /^clippyjs\/.*/] : [],
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
