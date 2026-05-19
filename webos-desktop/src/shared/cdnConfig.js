import { resolveGhUrl, resolveNpmUrl } from "./assetResolver.js";
export const CDN_CONFIG = {
  repos: {
    get games() {
      return {
        base: resolveGhUrl("https://cdn.jsdelivr.net/gh/Reeyuki/yukios-games@main"),
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
        base: resolveNpmUrl("https://cdn.jsdelivr.net/npm/")
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
      version: "9.6.1",
      path: "docx@9.6.1/build/index.js"
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
    }
  }
};

export function getLibraryUrl(libraryName, type = "path") {
  const lib = CDN_CONFIG.libraries[libraryName];
  if (!lib) return null;

  const path = lib[type] || lib.path;
  if (!path) return null;

  if (libraryName === "ruffle") {
    return `https://unpkg.com/@ruffle-rs/ruffle/ruffle.js`;
  }

  return `${CDN_CONFIG.repos.npm.base}/${path}`;
}

export function getRepoUrl(repoName, path) {
  const repo = CDN_CONFIG.repos[repoName];
  if (!repo) return null;

  return `${repo.base}${path}`;
}
