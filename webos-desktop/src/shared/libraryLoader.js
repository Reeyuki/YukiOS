import { getLibraryUrl } from "./cdnConfig.js";

export async function loadBundledLibrary(name) {
  if (!__SINGLE_FILE__) {
    throw new Error("Bundled library loading not available outside single-file mode");
  }

  switch (name) {
    case "7z-wasm": {
      const libUrl = getLibraryUrl("7z-wasm");
      const mod = await import(/* @vite-ignore */ `${libUrl}`);
      return mod;
    }
    case "archive-wasm": {
      const libUrl = getLibraryUrl("archive-wasm");
      const mod = await import(/* @vite-ignore */ `${libUrl}`);
      return mod;
    }
    case "webtorrent": {
      const mod = await import("webtorrent");
      window.WebTorrent = mod.default || mod;
      return mod;
    }
    case "three": {
      const libUrl = getLibraryUrl("three");
      const mod = await import(/* @vite-ignore */ `${libUrl}`);
      return mod;
    }
    case "three/GLTFLoader": {
      const baseUrl = getLibraryUrl("three");
      const mod = await import(/* @vite-ignore */ `${baseUrl}/examples/jsm/loaders/GLTFLoader.js`);
      return mod;
    }
    case "three/OBJLoader": {
      const baseUrl = getLibraryUrl("three");
      const mod = await import(/* @vite-ignore */ `${baseUrl}/examples/jsm/loaders/OBJLoader.js`);
      return mod;
    }
    case "three/FBXLoader": {
      const baseUrl = getLibraryUrl("three");
      const mod = await import(/* @vite-ignore */ `${baseUrl}/examples/jsm/loaders/FBXLoader.js`);
      return mod;
    }
    case "three/ColladaLoader": {
      const baseUrl = getLibraryUrl("three");
      const mod = await import(/* @vite-ignore */ `${baseUrl}/examples/jsm/loaders/ColladaLoader.js`);
      return mod;
    }
    case "three/TDSLoader": {
      const baseUrl = getLibraryUrl("three");
      const mod = await import(/* @vite-ignore */ `${baseUrl}/examples/jsm/loaders/TDSLoader.js`);
      return mod;
    }
    case "three/STLLoader": {
      const baseUrl = getLibraryUrl("three");
      const mod = await import(/* @vite-ignore */ `${baseUrl}/examples/jsm/loaders/STLLoader.js`);
      return mod;
    }
    case "three/PLYLoader": {
      const baseUrl = getLibraryUrl("three");
      const mod = await import(/* @vite-ignore */ `${baseUrl}/examples/jsm/loaders/PLYLoader.js`);
      return mod;
    }
    case "three/OrbitControls": {
      const baseUrl = getLibraryUrl("three");
      const mod = await import(/* @vite-ignore */ `${baseUrl}/examples/jsm/controls/OrbitControls.js`);
      return mod;
    }
    case "three/TransformControls": {
      const baseUrl = getLibraryUrl("three");
      const mod = await import(/* @vite-ignore */ `${baseUrl}/examples/jsm/controls/TransformControls.js`);
      return mod;
    }
    case "three/GLTFExporter": {
      const baseUrl = getLibraryUrl("three");
      const mod = await import(/* @vite-ignore */ `${baseUrl}/examples/jsm/exporters/GLTFExporter.js`);
      return mod;
    }
    case "@ruffle-rs/ruffle": {
      await import("@ruffle-rs/ruffle");
      return;
    }
    case "html2canvas-pro": {
      const mod = await import("html2canvas-pro");
      window.html2canvas = mod.default || mod;
      return mod;
    }
    case "html2canvas": {
      const mod = await import("html2canvas");
      window.html2canvas = mod.default || mod;
      return mod;
    }
    case "emoji-mart": {
      await import("emoji-mart");
      return;
    }
    case "clippyjs": {
      const libUrl = getLibraryUrl("clippyjs", "module");
      const mod = await import(/* @vite-ignore */ `${libUrl}`);
      return mod;
    }
    case "mammoth": {
      const mod = await import("mammoth");
      window.mammoth = mod;
      return mod;
    }
    case "xlsx": {
      const mod = await import("xlsx");
      window.XLSX = mod;
      return mod;
    }
    case "handsontable": {
      await import("handsontable/dist/handsontable.full.min.css");
      const mod = await import("handsontable");
      window.Handsontable = mod.default || mod;
      return mod;
    }
    case "pdfjs-dist": {
      const mod = await import("pdfjs-dist");
      window.pdfjsLib = mod;
      return mod;
    }
    case "jszip": {
      const mod = await import("jszip");
      window.JSZip = mod;
      return mod;
    }
    case "docx": {
      const mod = await import("docx");
      window.docx = mod;
      return mod;
    }
    case "fontawesome": {
      await import("@fortawesome/fontawesome-free/js/all.js");
      return;
    }
    case "vanta": {
      await import("vanta");
      return;
    }
    default:
      console.warn(`[libraryLoader] Unknown bundled library: ${name}`);
      return null;
  }
}
