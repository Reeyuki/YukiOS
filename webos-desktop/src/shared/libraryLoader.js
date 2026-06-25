export async function loadBundledLibrary(name) {
  if (!__SINGLE_FILE__) {
    throw new Error("Bundled library loading not available outside single-file mode");
  }

  switch (name) {
    case "7z-wasm": {
      const mod = await import("7z-wasm");
      return mod;
    }
    case "archive-wasm": {
      const mod = await import("archive-wasm");
      return mod;
    }
    case "webtorrent": {
      const mod = await import("webtorrent");
      window.WebTorrent = mod.default || mod;
      return mod;
    }
    case "three": {
      const mod = await import("three");
      return mod;
    }
    case "three/GLTFLoader": {
      const mod = await import("three/examples/jsm/loaders/GLTFLoader.js");
      return mod;
    }
    case "three/OBJLoader": {
      const mod = await import("three/examples/jsm/loaders/OBJLoader.js");
      return mod;
    }
    case "three/FBXLoader": {
      const mod = await import("three/examples/jsm/loaders/FBXLoader.js");
      return mod;
    }
    case "three/ColladaLoader": {
      const mod = await import("three/examples/jsm/loaders/ColladaLoader.js");
      return mod;
    }
    case "three/TDSLoader": {
      const mod = await import("three/examples/jsm/loaders/TDSLoader.js");
      return mod;
    }
    case "three/STLLoader": {
      const mod = await import("three/examples/jsm/loaders/STLLoader.js");
      return mod;
    }
    case "three/PLYLoader": {
      const mod = await import("three/examples/jsm/loaders/PLYLoader.js");
      return mod;
    }
    case "three/OrbitControls": {
      const mod = await import("three/examples/jsm/controls/OrbitControls.js");
      return mod;
    }
    case "three/TransformControls": {
      const mod = await import("three/examples/jsm/controls/TransformControls.js");
      return mod;
    }
    case "three/GLTFExporter": {
      const mod = await import("three/examples/jsm/exporters/GLTFExporter.js");
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
      const mod = await import("clippyjs");
      return mod;
    }
    case "mammoth": {
      const mod = await import("mammoth");
      window.mammoth = mod;
      return;
    }
    case "xlsx": {
      const mod = await import("xlsx");
      window.XLSX = mod;
      return;
    }
    case "handsontable": {
      await import("handsontable/dist/handsontable.full.min.css");
      const mod = await import("handsontable");
      window.Handsontable = mod.default || mod;
      return;
    }
    case "pdfjs-dist": {
      const mod = await import("pdfjs-dist");
      window.pdfjsLib = mod;
      return;
    }
    case "jszip": {
      const mod = await import("jszip");
      window.JSZip = mod;
      return;
    }
    case "docx": {
      const mod = await import("docx");
      window.docx = mod;
      return;
    }
    case "fontawesome": {
      await import("@fortawesome/fontawesome-free/js/all.js");
      return;
    }
    default:
      console.warn(`[libraryLoader] Unknown bundled library: ${name}`);
      return null;
  }
}
