import { resolveGhUrl, resolveNpmUrl } from "./assetResolver.js";
export const CDN_CONFIG = {
  repos: {
    get games() {
      return {
        base: resolveGhUrl("https://cdn.jsdelivr.net/gh/Reeyuki/yukios-games@main"),
        archiveBase: resolveGhUrl(
          "https://cdn.jsdelivr.net/gh/Reeyuki/yukios-games@1a4843dd9c0eb267d802625234e54fd6f9a6c9b7"
        ),
        ref: "main"
      };
    },
    get main() {
      return {
        base: resolveGhUrl("https://cdn.jsdelivr.net/gh/Reeyuki/yukios@main"),
        ref: "main"
      };
    },
    get npm() {
      return {
        base: resolveNpmUrl("https://cdn.jsdelivr.net/npm")
      };
    }
  },

  libraries: {
    mammoth: {
      version: "1.12.0",
      path: "mammoth@1.12.0/mammoth.browser.min.js"
    },
    xlsx: {
      version: "0.18.5",
      path: "xlsx@0.18.5/dist/xlsx.full.min.js"
    },
    handsontable: {
      version: "12.4.0",
      js: "handsontable@12.4.0/dist/handsontable.full.min.js",
      css: "handsontable@12.4.0/dist/handsontable.full.min.css"
    },
    pdfjs: {
      version: "3.11.174",
      js: "pdfjs-dist@3.11.174/build/pdf.min.js",
      viewer: "pdfjs-dist@3.11.174/web/pdf_viewer.min.js",
      viewerCss: "pdfjs-dist@3.11.174/web/pdf_viewer.min.css",
      worker: "pdfjs-dist@3.11.174/build/pdf.worker.min.js"
    },
    jszip: {
      version: "3.10.1",
      path: "jszip@3.10.1/dist/jszip.min.js"
    },
    docx: {
      version: "8.5.0",
      path: "docx@8.5.0/build/index.js"
    },
    clippyjs: {
      version: "latest",
      module: "clippyjs/dist/index.mjs",
      agents: "clippyjs/dist/agents/index.mjs"
    },
    monaco: {
      version: "0.45.0",
      loader: "monaco-editor@0.45.0/min/vs/loader.js",
      vs: "monaco-editor@0.45.0/min/vs"
    },
    ruffle: {
      version: "0.2.0-nightly.2026.5.15",
      path: "@ruffle-rs/ruffle@0.2.0-nightly.2026.5.15/ruffle.js"
    },
    emulatorjs: {
      version: "stable",
      loader: "https://cdn.emulatorjs.org/stable/data/loader.js",
      data: "https://cdn.emulatorjs.org/stable/data/"
    },
    three: {
      version: "0.160.0",
      base: "https://esm.sh/three@0.160.0"
    },
    "7z-wasm": {
      version: "1.2.0",
      path: "7z-wasm@1.2.0/7zz.es6.js",
      wasm: "7z-wasm@1.2.0/7zz.wasm"
    },
    "archive-wasm": {
      version: "1.7.0",
      path: "archive-wasm@1.7.0/dist/archive-wasm.umd.cjs"
    },
    emojiMart: {
      version: "latest",
      path: "emoji-mart@latest/dist/browser.js"
    },
    pyodide: {
      version: "0.25.0",
      module: "pyodide/v0.25.0/full/pyodide.mjs"
    }
  }
};

export function getLibraryUrl(libraryName, type = "path") {
  const lib = CDN_CONFIG.libraries[libraryName];
  if (!lib) return null;

  if (libraryName === "three") {
    return lib.base;
  }

  const path = lib[type] || lib.path;
  if (!path) return null;

  if (libraryName === "ruffle") {
    return `https://unpkg.com/@ruffle-rs/ruffle/ruffle.js`;
  }

  if (libraryName === "7z-wasm") {
    return `https://unpkg.com/${path}`;
  }

  if (libraryName === "clippyjs") {
    return `https://esm.sh/${path}`;
  }

  if (libraryName === "docx") {
    return `https://esm.sh/docx@8.5.0`;
  }

  const npmBase = CDN_CONFIG.repos.npm.base;
  return npmBase.endsWith("/") ? `${npmBase}${path}` : `${npmBase}/${path}`;
}
