import { FileKind } from "./fs.js";
import { resolveIconUrl } from "./assetUrl.js";
import { customAlert } from "./shared/dialogs.js";
import { WindowHelper } from "./utils/WindowHelper.js";

export const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "avif", "ico"];
export const VIDEO_EXTS = ["mp4", "webm", "ogv", "mov", "mkv", "avi", "m4v", "wmv", "flv"];
export const AUDIO_EXTS = ["mp3", "ogg", "wav", "flac", "aac", "m4a", "opus", "wma"];
export const OFFICE_EXTS = ["docx", "doc", "xlsx", "xls", "slx", "csv", "odt", "ods", "pdf", "odp", "pptx", "ppt"];
export const ZIP_EXTS = ["zip", "gz", "tgz", "tar", "rar", "7z", "bz2", "xz"];
export const EXE_EXTS = ["exe", "msi", "com", "bat", "cmd", "jsdos"];
export const SWF_EXTS = ["swf"];

import { ROM_EXTS } from "./shared/coreMap.js";
export { ROM_EXTS };

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
  "php"
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
  flv: "video/x-flv"
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
export function isBinaryOfficeFile(name) {
  return BINARY_OFFICE_EXTS.includes(getExt(name));
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
    "yaml"
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
  if (isZipFile(name)) return resolveIconUrl("static/icons/zip.webp");
  if (isExeFile(name)) return resolveIconUrl("static/icons/jsdos.webp");
  if (isOfficeFile(name)) return resolveIconUrl("static/icons/office.webp");
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
    )}px;color:#8090ff;background:rgba(128,144,255,0.15);border:1px solid rgba(128,144,255,0.2);"><i class="${iconSource}"></i></div>`;
  }

  if (isHtmlFile(name)) {
    return `<img src="${resolveIconUrl("static/icons/firefox.webp")}" style="${s}object-fit:cover;">`;
  }
  if (isMarkdownFile(name)) {
    return `<div style="${s}display:flex;align-items:center;justify-content:center;font-size:${Math.round(
      size * 0.5
    )}px;color:#519aba;background:#1e1e1e;border:1px solid #333;"><i class="fab fa-markdown"></i></div>`;
  }
  if (isRomFile(name)) {
    return `<div style="${s}display:flex;align-items:center;justify-content:center;font-size:${Math.round(
      size * 0.44
    )}px;color:#6677dd;"><i class="fas fa-gamepad"></i></div>`;
  }
  if (isSwfFile(name)) {
    return `<img src="${resolveIconUrl("static/icons/flash.webp")}" style="${s}object-fit:cover;">`;
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
  if (storedIcon && storedIcon !== "@content" && storedIcon !== "rom") {
    return `<img src="${resolveIconUrl(storedIcon)}" style="${s}object-fit:cover;">`;
  }
  return `<img src="${resolveIconUrl("static/icons/notepad.webp")}" style="${s}object-fit:cover;">`;
}

export function openMediaViewer(name, src, kind, windowManager) {
  const isVideo = kind === FileKind.VIDEO || isVideoFile(name);
  const isAudio = kind === FileKind.AUDIO || isAudioFile(name);

  const [width, height] = isAudio ? ["400px", "120px"] : ["500px", "400px"];
  const windowHelper = new WindowHelper(windowManager);

  let media;
  if (isVideo) {
    media = `<video src="${src}" controls autoplay loop style="max-width:100%;max-height:100%"></video>`;
  } else if (isAudio) {
    media = `<audio src="${src}" controls autoplay style="width:90%"></audio>`;
  } else {
    media = `<img src="${src}" style="max-width:100%;max-height:100%">`;
  }

  const content = `
    <div style="display:flex;justify-content:center;align-items:center;height:calc(100% - 30px);background:#111;">
      ${media}
    </div>
  `;

  const win = windowHelper.createAndMountWindow(`media-${Date.now()}`, name, content, width, height, {
    icon: isAudio ? resolveIconUrl("static/icons/spot.webp") : resolveIconUrl("static/icons/file.webp")
  });
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
    wma: "audio/x-ms-wma"
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
  return confirm(
    `The file "${name}" is quite large (${sizeStr}).\n\nOpening it in Notepad may cause performance issues.\n\nDo you want to continue?`
  );
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
  if (isZipFile(name)) return;
  console.log("Open file with: ", name, path);

  if (isExeFile(name)) {
    if (!jsDosApp) return;
    jsDosApp.launchExe(name, path);
    return;
  }

  if (isSwfFile(name)) {
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
    return;
  }

  if (isRomFile(name)) {
    const emulatorApp = appLauncher?.emulatorApp;
    if (emulatorApp) {
      emulatorApp.launchROM(name, path);
    } else {
      customAlert("ROM emulation is not available.");
    }
    return;
  }

  if (isVideoFile(name) || isAudioFile(name) || isImageFile(name)) {
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
      tiff: "image/tiff"
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
    return;
  }

  if (isOfficeFile(name)) {
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
  }

  const content = await fs.getFileContent(path, name);

  if (isMarkdownFile(name)) {
    if (markdownApp) {
      markdownApp.open(name, content, path);
    } else {
      notepadApp.open(name, content, path);
    }
    return;
  }

  if (isHtmlFile(name)) {
    if (browserApp) {
      browserApp.openHtml(content, name, path);
    } else {
      notepadApp.open(name, content, path);
    }
    return;
  }
  const size = getContentSize(content);
  if (size > LARGE_FILE_THRESHOLD) {
    const confirmed = await confirmLargeFile(name, size);
    if (!confirmed) return;
  }
  notepadApp.open(name, content, path);
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
