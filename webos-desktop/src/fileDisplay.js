import { FileKind } from "./fs.js";
import { desktop } from "./desktop.js";
export const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "avif"];
export const VIDEO_EXTS = ["mp4", "webm", "ogv", "mov"];
export const OFFICE_EXTS = [
  "docx",
  "doc",
  "xlsx",
  "xls",
  "slx",
  "csv",
  "odt",
  "ods",
  "pdf",
  "odp",
  "pptx",
  "ppt",
  "rtf"
];

import { ROM_EXTS, detectCore } from "./shared/coreMap.js";
export { ROM_EXTS };

export const HTML_EXTS = ["html", "htm"];
export const TEXT_EXTS = ["txt", "js", "json", "md", "css"];

export function getExt(name) {
  return name.split(".").pop().toLowerCase();
}

export function fileKindFromName(name) {
  const ext = getExt(name);
  if (IMAGE_EXTS.includes(ext)) return FileKind.IMAGE;
  if (VIDEO_EXTS.includes(ext)) return FileKind.VIDEO;
  if (ROM_EXTS.includes(ext)) return FileKind.ROM;
  if (HTML_EXTS.includes(ext)) return FileKind.HTML ?? FileKind.TEXT;
  if (TEXT_EXTS.includes(ext)) return FileKind.TEXT;
  return FileKind.OTHER;
}

export function isHtmlFile(name) {
  return HTML_EXTS.includes(getExt(name));
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

export function isOfficeFile(name) {
  return OFFICE_EXTS.includes(getExt(name));
}

export function isMediaFile(name) {
  return isImageFile(name) || isVideoFile(name);
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
  if (isVideoFile(name)) return "/static/icons/obs.webp";
  if (isRomFile(name)) return "rom";
  if (isOfficeFile(name)) return "/static/icons/office.webp";
  if (isHtmlFile(name)) return "/static/icons/firefox.webp";
  return "/static/icons/notepad.webp";
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
  if (isHtmlFile(name)) {
    return `<img src="/static/icons/firefox.webp" style="${s}object-fit:cover;">`;
  }
  if (isRomFile(name)) {
    return `<div style="${s}display:flex;align-items:center;justify-content:center;font-size:${Math.round(size * 0.44)}px;color:#6677dd;"><i class="fas fa-gamepad"></i></div>`;
  }
  if (isImageFile(name) && thumbnailSrc) {
    return `<img src="${thumbnailSrc}" style="${s}object-fit:cover;">`;
  }
  if (isVideoFile(name)) {
    return `<div style="${s}display:flex;align-items:center;justify-content:center;background:#111;font-size:${Math.round(size * 0.44)}px;color:#aaa;"><i class="fas fa-film"></i></div>`;
  }
  if (isOfficeFile(name)) {
    return `<img src="/static/icons/office.webp" style="${s}object-fit:cover;">`;
  }
  if (storedIcon && storedIcon !== "@content" && storedIcon !== "rom") {
    return `<img src="${storedIcon}" style="${s}object-fit:cover;">`;
  }
  return `<img src="/static/icons/notepad.webp" style="${s}object-fit:cover;">`;
}

export function openMediaViewer(name, src, kind, windowManager) {
  const win = windowManager.createWindow(`media-${Date.now()}`, name, "500px", "400px");
  const isVideo = kind === FileKind.VIDEO || isVideoFile(name);
  const media = isVideo
    ? `<video src="${src}" controls autoplay loop style="max-width:100%;max-height:100%"></video>`
    : `<img src="${src}" style="max-width:100%;max-height:100%">`;
  win.innerHTML = `
    <div class="window-header">
      <span>${name}</span>
      ${windowManager.getWindowControls()}
    </div>
    <div style="display:flex;justify-content:center;align-items:center;height:calc(100% - 30px);background:#111;">
      ${media}
    </div>
  `;
  desktop.appendChild(win);
  windowManager.makeDraggable(win);
  windowManager.makeResizable(win);
  windowManager.setupWindowControls(win);
  windowManager.addToTaskbar(win.id, name, "/static/icons/files.webp");
}

function base64ToBlob(dataURL) {
  const [header, b64] = dataURL.split(",");
  const mime = header.match(/:(.*?);/)[1];
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: mime });
}

export async function openFileWith({ name, path, fs, notepadApp, emulatorApp, browserApp, windowManager, officeApp }) {
  if (isRomFile(name)) {
    if (!emulatorApp) return;
    const dataUrl = await fs.getFileContent(path, name);
    const blob = await fetch(dataUrl).then((r) => r.blob());
    const file = new File([blob], name, { type: "application/octet-stream" });
    emulatorApp._launchRom(file, detectCore(name));
    return;
  }

  if (isVideoFile(name)) {
    const folderPath = Array.isArray(path) ? path.join("/") : path;
    const blobFromDB = fs.readBinaryFile ? await fs.readBinaryFile(folderPath, name) : null;
    if (blobFromDB) {
      openMediaViewer(name, URL.createObjectURL(blobFromDB), FileKind.VIDEO, windowManager);
      return;
    }
    const raw = await fs.getFileContent(path, name);
    if (!raw) return;
    if (raw.startsWith("data:")) {
      const blob = base64ToBlob(raw);
      const src = URL.createObjectURL(blob);
      openMediaViewer(name, src, FileKind.VIDEO, windowManager);
      return;
    }
    openMediaViewer(name, raw, FileKind.VIDEO, windowManager);
    return;
  }

  if (isOfficeFile(name)) {
    if (!officeApp) {
      console.warn("openFileWith: officeApp not provided for", name, "— falling through to notepad");
    } else {
      const content = await fs.getFileContent(path, name);
      officeApp.loadContent(name, content, path);
      return;
    }
  }

  const content = await fs.getFileContent(path, name);
  if (isHtmlFile(name)) {
    if (browserApp) {
      browserApp.openHtml(content, name, path);
    } else {
      notepadApp.open(name, content, path);
    }
    return;
  }
  if (isImageFile(name)) {
    openMediaViewer(name, content, FileKind.IMAGE, windowManager);
    return;
  }
  notepadApp.open(name, content, path);
}
