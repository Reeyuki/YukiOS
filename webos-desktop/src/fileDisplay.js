import { FileKind } from "./fs.js";
import { os } from "./os/index.js";
import { StorageKeys } from "./StorageKeys.js";
import { ROM_EXTS } from "./shared/coreMap.js";
import { resolveIconUrl } from "./shared/assetResolver.js";
import { formatSize } from "./utils/utils.js";

const RECENT_FILES_MAX = 20;

export function trackRecentFile(name, path) {
  try {
    const recent = os.storage.get(StorageKeys.recentFiles) || [];
    const key = Array.isArray(path) ? path.join("/") : path;
    const existing = recent.findIndex((f) => f.name === name && f.path === key);
    if (existing !== -1) recent.splice(existing, 1);
    recent.unshift({ name, path: key, kind: fileKindFromName(name), timestamp: Date.now() });
    if (recent.length > RECENT_FILES_MAX) recent.length = RECENT_FILES_MAX;
    os.storage.set(StorageKeys.recentFiles, recent);
  } catch (e) {
    console.error("[FileDisplay] trackRecentFile error:", e);
  }
}

export const IMAGE_EXTS = [
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "bmp",
  "svg",
  "avif",
  "ico",
  "heic",
  "heif",
  "tiff",
  "tif",
  "raw",
  "cr2",
  "nef",
  "dng",
  "arw",
  "psd",
  "ai",
  "eps"
];
export const VIDEO_EXTS = [
  "mp4",
  "webm",
  "ogv",
  "mov",
  "mkv",
  "avi",
  "m4v",
  "wmv",
  "flv",
  "hevc",
  "mpg",
  "mpeg",
  "m2ts",
  "ts",
  "3gp",
  "asf"
];
export const AUDIO_EXTS = [
  "mp3",
  "ogg",
  "wav",
  "flac",
  "aac",
  "m4a",
  "opus",
  "wma",
  "alac",
  "mid",
  "midi",
  "aiff",
  "caf"
];
export const OFFICE_EXTS = [
  "docx",
  "doc",
  "xlsx",
  "xls",
  "sldx",
  "csv",
  "odt",
  "ods",
  "pdf",
  "odp",
  "pptx",
  "ppt",
  "odg",
  "ott",
  "ots",
  "otp",
  "vsd",
  "vsdx",
  "pub",
  "xps",
  "wpd",
  "rtfx"
];
export const ZIP_EXTS = [
  "zip",
  "gz",
  "tgz",
  "tar",
  "rar",
  "7z",
  "bz2",
  "xz",
  "lz",
  "lzma",
  "zst",
  "cab",
  "iso",
  "dmg",
  "pak"
];
export const EXE_EXTS = ["exe", "msi", "com", "bat", "cmd", "jsdos"];
export const SWF_EXTS = ["swf"];
export const MODEL3D_EXTS = ["obj", "gltf", "glb", "fbx", "dae", "3ds", "usdz", "stl", "ply", "x", "blend"];

export const EBOOK_EXTS = ["epub", "mobi", "azw", "azw3", "fb2"];
export const FONT_EXTS = ["ttf", "otf", "woff", "woff2"];
export const DISK_EXTS = ["vhd", "vhdx", "vmdk", "img", "qcow2"];
export const SHORTCUT_EXTS = ["torrent", "url", "webloc", "lnk", "desktop"];

export const HTML_EXTS = ["html", "htm", "xhtml"];
export const MARKDOWN_EXTS = ["md", "markdown"];
export const TEXT_EXTS = [
  "txt",
  "js",
  "json",
  "css",
  "xml",
  "yaml",
  "yml",
  "ini",
  "cfg",
  "log",
  "rtf",
  "ts",
  "tsx",
  "jsx",
  "mjs",
  "cjs",
  "sh",
  "bash",
  "zsh",
  "env",
  "sql",
  "py",
  "java",
  "cs",
  "cpp",
  "c",
  "h",
  "hpp",
  "go",
  "rs",
  "php",
  "scala",
  "sc",
  "lua",
  "elm",
  "nim",
  "asm",
  "v",
  "zig",
  "astro",
  "solid",
  "mdx",
  "jsonc",
  "toml",
  "conf",
  "config"
];

const BINARY_OFFICE_EXTS = ["pdf", "docx", "xlsx", "xls", "pptx", "ppt"];

const LARGE_FILE_THRESHOLD = 1024 * 1024;

const VIDEO_MIME_MAP = {
  mp4: "video/mp4",
  webm: "video/webm",
  ogv: "video/ogg",
  mov: "video/quicktime",
  mkv: "video/x-matroska",
  avi: "video/x-msvideo",
  m4v: "video/x-m4v",
  wmv: "video/x-ms-wmv",
  flv: "video/x-flv",
  hevc: "video/hevc",
  mpg: "video/mpeg",
  mpeg: "video/mpeg",
  m2ts: "video/mp2t",
  ts: "video/mp2t",
  "3gp": "video/3gpp",
  asf: "video/x-ms-asf"
};

export function getExt(name) {
  return name.split(".").pop().toLowerCase();
}

export function fileKindFromName(name) {
  const ext = getExt(name);
  if (IMAGE_EXTS.includes(ext)) return FileKind.IMAGE;
  if (VIDEO_EXTS.includes(ext)) return FileKind.VIDEO;
  if (AUDIO_EXTS.includes(ext)) return FileKind.AUDIO ?? FileKind.OTHER;
  if (ROM_EXTS.includes(ext)) return FileKind.ROM;
  if (SWF_EXTS.includes(ext)) return FileKind.OTHER;
  if (ZIP_EXTS.includes(ext)) return FileKind.OTHER;
  if (EBOOK_EXTS.includes(ext)) return FileKind.OTHER;
  if (FONT_EXTS.includes(ext)) return FileKind.OTHER;
  if (DISK_EXTS.includes(ext)) return FileKind.OTHER;
  if (SHORTCUT_EXTS.includes(ext)) return FileKind.OTHER;
  if (HTML_EXTS.includes(ext)) return FileKind.HTML ?? FileKind.TEXT;
  if (MARKDOWN_EXTS.includes(ext)) return FileKind.TEXT;
  if (TEXT_EXTS.includes(ext)) return FileKind.TEXT;
  return FileKind.OTHER;
}

export function isHtmlFile(name) {
  return HTML_EXTS.includes(getExt(name));
}
export function isMarkdownFile(name) {
  return MARKDOWN_EXTS.includes(getExt(name));
}
export function isRomFile(name) {
  return ROM_EXTS.includes(getExt(name));
}
export function isImageFile(name) {
  return IMAGE_EXTS.includes(getExt(name));
}
export function isVideoFile(name) {
  return VIDEO_EXTS.includes(getExt(name));
}
export function isAudioFile(name) {
  return AUDIO_EXTS.includes(getExt(name));
}
export function isOfficeFile(name) {
  return OFFICE_EXTS.includes(getExt(name));
}
export function isZipFile(name) {
  return ZIP_EXTS.includes(getExt(name));
}
export function isExeFile(name) {
  return EXE_EXTS.includes(getExt(name));
}
export function isSwfFile(name) {
  return SWF_EXTS.includes(getExt(name));
}
export function isModel3DFile(name) {
  return MODEL3D_EXTS.includes(getExt(name));
}
export function isBinaryOfficeFile(name) {
  return BINARY_OFFICE_EXTS.includes(getExt(name));
}
export function isEbookFile(name) {
  return EBOOK_EXTS.includes(getExt(name));
}
export function isFontFile(name) {
  return FONT_EXTS.includes(getExt(name));
}
export function isDiskFile(name) {
  return DISK_EXTS.includes(getExt(name));
}
export function isShortcutFile(name) {
  return SHORTCUT_EXTS.includes(getExt(name));
}
export function isMediaFile(name) {
  return isImageFile(name) || isVideoFile(name);
}
export function isJsonFile(name) {
  return getExt(name) === "json";
}
export function isCodeFile(name) {
  return [
    "ts",
    "tsx",
    "jsx",
    "mjs",
    "cjs",
    "js",
    "css",
    "py",
    "java",
    "cs",
    "cpp",
    "c",
    "h",
    "hpp",
    "go",
    "rs",
    "php",
    "sh",
    "bash",
    "zsh",
    "sql",
    "env",
    "scss",
    "sass",
    "less",
    "vue",
    "svelte",
    "kt",
    "kts",
    "swift",
    "rb",
    "dart",
    "toml",
    "properties",
    "ini",
    "cfg",
    "lock",
    "dockerfile",
    "makefile",
    "yml",
    "yaml",
    "scala",
    "sc",
    "lua",
    "elm",
    "nim",
    "asm",
    "v",
    "zig",
    "astro",
    "solid",
    "mdx",
    "jsonc",
    "conf",
    "config"
  ].includes(getExt(name));
}
export function isWallpaperPath(path) {
  return (
    Array.isArray(path) &&
    path.length >= 2 &&
    path[path.length - 2] === "Pictures" &&
    path[path.length - 1] === "Wallpapers"
  );
}

export function resolveFileIcon(name) {
  if (isImageFile(name)) return "@content";
  if (isVideoFile(name)) return resolveIconUrl("static/icons/obs.webp");
  if (isAudioFile(name)) return resolveIconUrl("static/icons/spot.webp");
  if (isRomFile(name)) return "rom";
  if (isSwfFile(name)) return resolveIconUrl("static/icons/flash.webp");
  if (isModel3DFile(name)) return resolveIconUrl("static/icons/3dmodel.webp");
  if (isZipFile(name)) return resolveIconUrl("static/icons/zip.webp");
  if (isExeFile(name)) return resolveIconUrl("static/icons/jsdos.webp");
  if (isOfficeFile(name)) return resolveIconUrl("static/icons/office.webp");
  if (isEbookFile(name)) return resolveIconUrl("static/icons/office.webp");
  if (isFontFile(name)) return resolveIconUrl("static/icons/office.webp");
  if (isDiskFile(name)) return resolveIconUrl("static/icons/zip.webp");
  if (isShortcutFile(name)) return resolveIconUrl("static/icons/notepad.webp");
  if (isHtmlFile(name)) return resolveIconUrl("static/icons/firefox.webp");
  if (isJsonFile(name)) return resolveIconUrl("static/icons/json.webp");
  return resolveIconUrl("static/icons/notepad.webp");
}

export function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

export function buildFileIconHTML(name, { thumbnailSrc = null, size = 64, radius = 8, storedIcon = null } = {}) {
  const s = `width:${size}px;height:${size}px;border-radius:${radius}px;`;
  const iconSource = thumbnailSrc || storedIcon;

  if (iconSource && typeof iconSource === "string" && (iconSource.startsWith("fa") || iconSource.includes(" fa-"))) {
    return `<div style="${s}display:flex;align-items:center;justify-content:center;font-size:${Math.round(
      size * 0.44
    )}px;color:var(--brand);background:var(--brand-dim);border:1px solid var(--glass-border);"><i class="${iconSource}"></i></div>`;
  }

  if (isHtmlFile(name)) {
    return `<div style="${s}display:flex;align-items:center;justify-content:center;font-size:${Math.round(
      size * 0.5
    )}px;color:#519aba;background:#1e1e1e;border:1px solid #333;"><i class="fas fa-snowflake"></i></div>`;
  }
  if (isMarkdownFile(name)) {
    return `<div style="${s}display:flex;align-items:center;justify-content:center;font-size:${Math.round(
      size * 0.5
    )}px;color:#519aba;background:#1e1e1e;border:1px solid #333;"><i class="fab fa-markdown"></i></div>`;
  }
  if (isRomFile(name)) {
    return `<div style="${s}display:flex;align-items:center;justify-content:center;font-size:${Math.round(
      size * 0.44
    )}px;color:var(--brand);"><i class="fas fa-gamepad"></i></div>`;
  }
  if (isSwfFile(name)) {
    return `<img src="${resolveIconUrl("static/icons/flash.webp")}" style="${s}object-fit:cover;">`;
  }
  if (isModel3DFile(name)) {
    return `<img src="${resolveIconUrl("static/icons/3dmodel.webp")}" style="${s}object-fit:cover;">`;
  }
  if (isZipFile(name)) {
    return `<img src="${resolveIconUrl("static/icons/zip.webp")}" style="${s}object-fit:cover;">`;
  }
  if (isExeFile(name)) {
    return `<img src="${resolveIconUrl("static/icons/jsdos.webp")}" style="${s}object-fit:cover;">`;
  }
  if (isAudioFile(name)) {
    return `<img src="${resolveIconUrl("static/icons/spot.webp")}" style="${s}object-fit:cover;">`;
  }
  if (isJsonFile(name)) {
    return `<img src="${resolveIconUrl("static/icons/notepad.webp")}" style="${s}object-fit:cover;">`;
  }
  if (isCodeFile(name)) {
    return `<div style="${s}display:flex;align-items:center;justify-content:center;font-size:${Math.round(
      size * 0.44
    )}px;color:#569cd6;background:#1e1e1e;border:1px solid #333;"><i class="fas fa-code"></i></div>`;
  }
  if (isImageFile(name) && thumbnailSrc && thumbnailSrc !== "@content") {
    return `<img src="${thumbnailSrc}" style="${s}object-fit:cover;">`;
  }
  if (isVideoFile(name)) {
    return `<div style="${s}display:flex;align-items:center;justify-content:center;background:#111;font-size:${Math.round(
      size * 0.44
    )}px;color:#aaa;"><i class="fas fa-film"></i></div>`;
  }
  if (isOfficeFile(name)) {
    return `<img src="${resolveIconUrl("static/icons/office.webp")}" style="${s}object-fit:cover;">`;
  }
  if (isEbookFile(name)) {
    return `<div style="${s}display:flex;align-items:center;justify-content:center;font-size:${Math.round(
      size * 0.44
    )}px;color:#ff6b6b;background:#1e1e1e;border:1px solid #333;"><i class="fas fa-book"></i></div>`;
  }
  if (isFontFile(name)) {
    return `<div style="${s}display:flex;align-items:center;justify-content:center;font-size:${Math.round(
      size * 0.44
    )}px;color:#4ecdc4;background:#1e1e1e;border:1px solid #333;"><i class="fas fa-font"></i></div>`;
  }
  if (isDiskFile(name)) {
    return `<div style="${s}display:flex;align-items:center;justify-content:center;font-size:${Math.round(
      size * 0.44
    )}px;color:#f39c12;background:#1e1e1e;border:1px solid #333;"><i class="fas fa-hdd"></i></div>`;
  }
  if (storedIcon && storedIcon !== "@content" && storedIcon !== "rom") {
    return `<img src="${resolveIconUrl(storedIcon)}" style="${s}object-fit:cover;">`;
  }
  if (isShortcutFile(name)) {
    return `<div style="${s}display:flex;align-items:center;justify-content:center;font-size:${Math.round(
      size * 0.44
    )}px;color:#9b59b6;background:#1e1e1e;border:1px solid #333;"><i class="fas fa-link"></i></div>`;
  }
  return `<img src="${resolveIconUrl("static/icons/notepad.webp")}" style="${s}object-fit:cover;">`;
}

export function openMediaViewer(name, src, kind, windowManager) {
  const isVideo = kind === FileKind.VIDEO || isVideoFile(name);
  const isAudio = kind === FileKind.AUDIO || isAudioFile(name);

  const [width, height] = isAudio ? ["400px", "120px"] : ["500px", "400px"];
  const icon = isAudio ? resolveIconUrl("static/icons/spot.webp") : resolveIconUrl("static/icons/file.webp");

  let media;
  if (isVideo) {
    media = `<video src="${src}" crossorigin="anonymous" controls autoplay loop style="max-width:100%;max-height:100%"></video>`;
  } else if (isAudio) {
    media = `<audio src="${src}" crossorigin="anonymous" controls autoplay style="width:90%"></audio>`;
  } else {
    media = `<img src="${src}" style="max-width:100%;max-height:100%">`;
  }

  const winId = `media-${Date.now()}`;
  const win = os.window.create(winId, name, width, height, {
    icon,
    autoMount: false
  });

  const headerHtml = `
    <div class="window-header">
      <span><img src="${icon}" style="width:20px;height:20px;margin-right:6px;vertical-align:middle;">${name}</span>
      ${os.window.getWindowControls(icon)}
    </div>
  `;
  win.innerHTML =
    headerHtml +
    `
    <div class="window-content" style="width:100%; height:100%; overflow:hidden;">
      <div style="display:flex;justify-content:center;align-items:center;height:100%;background:#111;">
        ${media}
      </div>
    </div>
  `;

  const desktop = document.querySelector("#desktop");
  if (desktop) desktop.appendChild(win);
  if (windowManager) {
    windowManager.makeDraggable(win);
    windowManager.makeResizable(win);
    windowManager.setupWindowControls(win);
  }
  os.window.addToTaskbar(winId, name, icon);
  os.window.focus(win);
  requestAnimationFrame(() => (win.style.opacity = ""));
}

function base64ToBlob(dataURL) {
  const [header, b64] = dataURL.split(",");
  const mime = header.match(/:(.*?);/)[1];
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: mime });
}

function audioExtToMime(name) {
  const map = {
    mp3: "audio/mpeg",
    ogg: "audio/ogg",
    wav: "audio/wav",
    flac: "audio/flac",
    aac: "audio/aac",
    m4a: "audio/mp4",
    opus: "audio/opus",
    wma: "audio/x-ms-wma",
    alac: "audio/alac",
    mid: "audio/midi",
    midi: "audio/midi",
    aiff: "audio/aiff",
    caf: "audio/x-caf"
  };
  return map[getExt(name)] ?? "audio/octet-stream";
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getContentSize(content) {
  if (!content) return 0;
  if (typeof content === "string") return new Blob([content]).size;
  if (content instanceof Blob) return content.size;
  if (content instanceof ArrayBuffer) return content.byteLength;
  return 0;
}

async function confirmLargeFile(name, size) {
  const sizeStr = formatFileSize(size);
  return os.dialog.confirm(
    "Large File Warning",
    `The file "${name}" is quite large (${sizeStr}).\n\nOpening it in Notepad may cause performance issues.\n\nDo you want to continue?`,
    "Continue",
    "Cancel"
  );
}

async function _openModelFile(name, path, fs, appLauncher) {
  try {
    const model3dApp = appLauncher?.model3dApp;
    if (model3dApp) {
      let arrayBuffer = null;
      try {
        const blob = await fs.readBinaryFile(path, name);
        if (blob && blob.size > 0) {
          arrayBuffer = await blob.arrayBuffer();
        } else {
          const content = await fs.getFileContent(path, name);
          if (content instanceof Blob) {
            arrayBuffer = await content.arrayBuffer();
          } else if (content instanceof ArrayBuffer) {
            arrayBuffer = content;
          } else if (typeof content === "string") {
            arrayBuffer = new TextEncoder().encode(content).buffer;
          }
        }
      } catch (e) {
        console.error("Error loading 3D file content:", e);
      }
      model3dApp.open({
        title: name,
        filePath: path,
        fileName: name,
        fileData: arrayBuffer
      });
    } else {
      os.dialog.alert("Can't Open", "Yuki Blender isn't available right now.");
    }
  } catch (err) {
    console.error("[FileDisplay] _openModelFile error:", err);
  }
}

async function _openExecutable(name, path, jsDosApp) {
  try {
    jsDosApp.launchExe(name, path);
  } catch (err) {
    console.error("[FileDisplay] _openExecutable error:", err);
  }
}

async function _openSwfFile(name, path, fs, appLauncher) {
  try {
    const ruffleApp = appLauncher?.ruffleApp;
    if (!ruffleApp) return;
    let arrayBuffer = null;

    const blob = await fs.readBinaryFile(path, name);
    if (blob && blob.size > 0) {
      arrayBuffer = await blob.arrayBuffer();
    } else {
      const content = await fs.getFileContent(path, name);
      if (content instanceof Blob && content.size > 0) {
        arrayBuffer = await content.arrayBuffer();
      } else if (content instanceof ArrayBuffer && content.byteLength > 0) {
        arrayBuffer = content;
      } else if (typeof content === "string" && content) {
        arrayBuffer = content.startsWith("data:")
          ? await base64ToBlob(content).arrayBuffer()
          : Uint8Array.from(content, (c) => c.charCodeAt(0)).buffer;
      }
    }

    if (!arrayBuffer) return;
    const displayName = name
      .replace(/\.[^.]+$/, "")
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    ruffleApp._launchRuffle(displayName, name, arrayBuffer);
  } catch (err) {
    console.error("[FileDisplay] _openSwfFile error:", err);
  }
}

async function _openRomFile(name, path, appLauncher) {
  try {
    const emulatorApp = appLauncher?.emulatorApp;
    if (emulatorApp) {
      emulatorApp.launchROM(name, path);
    } else {
      os.dialog.alert("Can't Open", "ROM emulation isn't available right now.");
    }
  } catch (err) {
    console.error("[FileDisplay] _openRomFile error:", err);
  }
}

async function _openMediaFile(name, path, fs, windowManager) {
  try {
    const ext = getExt(name);

    const IMAGE_MIME_MAP = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      bmp: "image/bmp",
      svg: "image/svg+xml",
      avif: "image/avif",
      ico: "image/x-icon",
      tif: "image/tiff",
      tiff: "image/tiff",
      heic: "image/heic",
      heif: "image/heif",
      raw: "image/raw",
      cr2: "image/x-canon-cr2",
      nef: "image/x-nikon-nef",
      dng: "image/x-adobe-dng",
      arw: "image/x-sony-arw",
      psd: "image/vnd.adobe.photoshop",
      ai: "application/postscript",
      eps: "application/postscript"
    };

    const kind = isVideoFile(name) ? FileKind.VIDEO : isAudioFile(name) ? FileKind.AUDIO : FileKind.IMAGE;

    const mime = isAudioFile(name)
      ? audioExtToMime(name)
      : isVideoFile(name)
        ? (VIDEO_MIME_MAP[getExt(name)] ?? "application/octet-stream")
        : (IMAGE_MIME_MAP[ext] ?? "application/octet-stream");

    const getMediaSrc = async (b) => {
      const typedBlob = b.type ? b : new Blob([b], { type: mime });
      return await readFileAsDataURL(typedBlob);
    };

    const blob = await fs.readBinaryFile(path, name);
    if (blob && blob.size > 0) {
      openMediaViewer(name, await getMediaSrc(blob), kind, windowManager);
      return;
    }
    const content = await fs.getFileContent(path, name);
    if (content instanceof Blob && content.size > 0) {
      openMediaViewer(name, await getMediaSrc(content), kind, windowManager);
      return;
    }
    if (typeof content === "string" && content) {
      let src;
      if (content.startsWith("http") || content.startsWith("/") || content.startsWith("data:")) {
        src = content;
      } else {
        const typedBlob = new Blob([Uint8Array.from(content, (c) => c.charCodeAt(0))], { type: mime });
        src = await getMediaSrc(typedBlob);
      }
      openMediaViewer(name, src, kind, windowManager);
    }
  } catch (err) {
    console.error("[FileDisplay] _openMediaFile error:", err);
  }
}

async function _openOfficeFile(name, path, fs, officeApp, notepadApp) {
  try {
    if (!officeApp) {
      const content = await fs.getFileContent(path, name);
      notepadApp.open(name, content, path);
      return;
    } else {
      const blob = await fs.readBinaryFile(path, name);
      if (blob && blob.size > 0) {
        officeApp.loadContent(name, await blob.arrayBuffer(), path);
      } else {
        officeApp.loadContent(name, await fs.getFileContent(path, name), path);
      }
      return;
    }
  } catch (err) {
    console.error("[FileDisplay] _openOfficeFile error:", err);
  }
}

async function _openMarkdown(name, path, content, markdownApp, notepadApp) {
  try {
    if (markdownApp) {
      markdownApp.open(name, content, path);
    } else {
      notepadApp.open(name, content, path);
    }
  } catch (err) {
    console.error("[FileDisplay] _openMarkdown error:", err);
  }
}

async function _openHtmlFile(name, path, content, browserApp, notepadApp) {
  try {
    if (browserApp) {
      browserApp.openHtml(content, name, path);
    } else {
      notepadApp.open(name, content, path);
    }
  } catch (err) {
    console.error("[FileDisplay] _openHtmlFile error:", err);
  }
}

async function _openTextFile(name, path, content, notepadApp) {
  try {
    const size = getContentSize(content);
    if (size > LARGE_FILE_THRESHOLD) {
      const confirmed = await confirmLargeFile(name, size);
      if (!confirmed) return;
    }
    notepadApp.open(name, content, path);
  } catch (err) {
    console.error("[FileDisplay] _openTextFile error:", err);
  }
}

export async function openFileWith({
  name,
  path,
  fs,
  notepadApp,
  browserApp,
  windowManager,
  officeApp,
  markdownApp,
  jsDosApp,
  appLauncher
}) {
  try {
    if (isZipFile(name)) return;
    trackRecentFile(name, path);
    console.log("Open file with: ", name, path);

    if (isModel3DFile(name)) return _openModelFile(name, path, fs, appLauncher);
    if (
      isExeFile(name) ||
      name.toLowerCase().endsWith(".jsdos") ||
      name.toLowerCase().endsWith(".com") ||
      name.toLowerCase().endsWith(".bat")
    )
      return _openExecutable(name, path, jsDosApp);
    if (isSwfFile(name)) return _openSwfFile(name, path, fs, appLauncher);
    if (isRomFile(name)) return _openRomFile(name, path, appLauncher);
    if (isVideoFile(name) || isAudioFile(name) || isImageFile(name))
      return _openMediaFile(name, path, fs, windowManager);
    if (isOfficeFile(name)) return _openOfficeFile(name, path, fs, officeApp, notepadApp);

    const content = await fs.getFileContent(path, name);

    if (isMarkdownFile(name)) return _openMarkdown(name, path, content, markdownApp, notepadApp);
    if (isHtmlFile(name)) return _openHtmlFile(name, path, content, browserApp, notepadApp);
    return _openTextFile(name, path, content, notepadApp);
  } catch (err) {
    console.error("[FileDisplay] openFileWith error:", err);
    os.notify.send("File Display", `Failed to open ${name}`, { type: "error" });
  }
}

function _resolveDesktopIconFromDOM(name) {
  const label = name.replace(/\.desktop$/i, "");
  const desktop = document.getElementById("desktop");
  if (!desktop) return null;
  const iconEl = desktop.querySelector(
    `.icon.selectable[data-file-name="${CSS.escape(name)}"], .icon.selectable[data-folder-name="${CSS.escape(name)}"]`
  );
  if (iconEl) {
    const img = iconEl.querySelector("img");
    if (img) return img.getAttribute("src") || null;
    const faIcon = iconEl.querySelector("i");
    if (faIcon) return faIcon.className;
    return null;
  }
  const labelIcon = Array.from(desktop.querySelectorAll(".icon.selectable")).find(
    (el) => el.querySelector("div, span")?.textContent?.trim() === label
  );
  if (labelIcon) {
    const img = labelIcon.querySelector("img");
    if (img) return img.getAttribute("src") || null;
    const faIcon = labelIcon.querySelector("i");
    if (faIcon) return faIcon.className;
  }
  return null;
}

function _stripext(name) {
  return SHORTCUT_EXTS.some((ext) => name.toLowerCase().endsWith(`.${ext}`))
    ? name.slice(0, name.lastIndexOf("."))
    : name;
}

export async function showFileProperties(path, name, isFolder, onRename = null) {
  const { os } = await import("./os/index.js");
  try {
    const displayLabel = isFolder ? name : _stripext(name);
    const iconSrc = isFolder ? "static/icons/file.webp" : _resolveDesktopIconFromDOM(name) || resolveFileIcon(name);
    const size = isFolder ? "--" : await _getItemSize(path);
    let type = isFolder ? "Folder" : fileKindFromName(name);
    const { FileKind } = await import("./fs.js");
    if (typeof type !== "string") {
      type =
        type === FileKind.TEXT
          ? "Text"
          : type === FileKind.IMAGE
            ? "Image"
            : type === FileKind.VIDEO
              ? "Video"
              : type === FileKind.AUDIO
                ? "Audio"
                : type === FileKind.ROM
                  ? "ROM"
                  : type === FileKind.HTML
                    ? "HTML"
                    : "File";
    }
    if (type === "other" && isShortcutFile(name)) type = "Shortcut";
    const location = Array.isArray(path) ? path.join("/") : path;
    const modified = await _getModifiedDate(path);

    const title = `Properties: ${displayLabel}`;
    const propsWin = os.window.create(`${Date.now()}-props`, title, "400px", "auto");

    propsWin.innerHTML = `
      <div class="window-header"><span>${title}</span>
        ${os.window.getWindowControls()}
      </div>
      <div class="window-content" style="padding:20px;">
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;">
          <img src="${iconSrc}" style="width:48px;height:48px;object-fit:cover;border-radius:6px;">
          <div style="flex:1;">
            <input id="props-rename-input" type="text" value="${displayLabel}" style="font-size:18px;font-weight:600;padding:4px;border-radius:6px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.1);color:inherit;width:100%;">
            <div style="opacity:0.7;font-size:13px;margin-top:4px;">${type}</div>
          </div>
        </div>

        <div style="border-bottom:1px solid rgba(255,255,255,0.1);margin-bottom:16px;"></div>

        <div style="margin-bottom:16px;">
          <div style="font-size:13px;font-weight:600;margin-bottom:8px;opacity:0.9;">Details</div>
          <div style="display:grid;grid-template-columns:120px 1fr;gap:8px;font-size:13px;">
            <div style="opacity:0.7;">Type:</div><div>${type}</div>
            <div style="opacity:0.7;">Location:</div><div>${location}</div>
            <div style="opacity:0.7;">Size:</div><div>${size}</div>
            <div style="opacity:0.7;">Modified:</div><div>${modified}</div>
          </div>
        </div>
      </div>
    `;

    const renameInput = propsWin.querySelector("#props-rename-input");

    renameInput.onkeydown = async (e) => {
      if (e.key === "Enter") {
        const newName = renameInput.value.trim();
        const shortcutExt = SHORTCUT_EXTS.find((e) => name.toLowerCase().endsWith(`.${e}`));
        const targetName = shortcutExt ? `${newName}.${shortcutExt}` : newName;
        if (!newName || targetName === name) return;

        try {
          await os.fs.rename(path.slice(0, -1), name, targetName);
          os.notify.send(`Renamed to "${newName}"`);
          os.window.close(propsWin);
          if (onRename) onRename();
        } catch (err) {
          os.dialog.alert("Error", err.message || "Failed to rename");
        }
      }
    };
  } catch (err) {
    console.error("Properties error:", err);
    os.dialog.alert("Error", "Failed to show properties");
  }
}

async function _getItemSize(path) {
  const { os } = await import("./os/index.js");
  try {
    const pathStr = Array.isArray(path) ? path.join("/") : path;
    const dirPath = pathStr.substring(0, pathStr.lastIndexOf("/")) || "";
    const fileName = pathStr.substring(pathStr.lastIndexOf("/") + 1);

    const meta = await os.fs.getMetadata(dirPath, fileName);
    if (meta.size !== undefined && meta.size !== null) {
      return formatSize(meta.size);
    }

    const text = await os.fs.read(path);
    if (typeof text === "string" && text) {
      return formatSize(new Blob([text]).size);
    }
    const content = await os.fs.read(path, { encoding: "binary" });
    const bytes = content instanceof Uint8Array ? content.length : new Blob([content]).size;
    return formatSize(bytes);
  } catch {
    return "Unknown";
  }
}

async function _getModifiedDate(path) {
  try {
    return new Date().toLocaleString();
  } catch {
    return "Unknown";
  }
}

export function decodeDataURLContent(content) {
  if (!content) return "";
  if (content.startsWith("data:")) {
    try {
      const base64Match = content.match(/^data:[^;]+;base64,(.+)$/);
      if (base64Match && base64Match[1]) return atob(base64Match[1]);
      const plainMatch = content.match(/^data:[^,]+,(.+)$/);
      if (plainMatch && plainMatch[1]) return decodeURIComponent(plainMatch[1]);
    } catch (err) {
      return content;
    }
  }
  return content;
}

export function generateThumbnail(src, maxDimension = 128) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const { width, height } = img;
      if (width <= maxDimension && height <= maxDimension) {
        resolve(src);
        return;
      }
      try {
        const scale = Math.min(maxDimension / width, maxDimension / height);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      } catch {
        resolve(src);
      }
    };
    img.onerror = () => resolve(src);
    if (src instanceof Blob) {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target.result;
      };
      reader.onerror = () => resolve(src);
      reader.readAsDataURL(src);
    } else {
      img.src = src;
    }
  });
}
