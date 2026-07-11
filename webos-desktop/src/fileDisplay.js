import { FileKind } from "./shared/fileKindDetector.js";
import { os, StorageKeys } from "./framework.js";
import { ROM_EXTS } from "./shared/coreMap.js";
import { resolveIconUrl } from "./shared/assetResolver.js";
import { formatSize } from "./utils/utils.js";
import {
  getExt,
  fileKindFromName,
  isImageFile,
  isVideoFile,
  isAudioFile,
  isOfficeFile,
  isZipFile,
  isExeFile,
  isSwfFile,
  isModel3DFile,
  isEbookFile,
  isFontFile,
  isDiskFile,
  isShortcutFile,
  isHtmlFile,
  isMarkdownFile,
  isJsonFile,
  isCodeFile,
  IMAGE_EXTS,
  VIDEO_EXTS,
  AUDIO_EXTS,
  ZIP_EXTS,
  EXE_EXTS,
  SWF_EXTS,
  MODEL3D_EXTS,
  EBOOK_EXTS,
  FONT_EXTS,
  DISK_EXTS,
  SHORTCUT_EXTS,
  HTML_EXTS,
  MARKDOWN_EXTS,
  TEXT_EXTS,
  CODE_EXTS,
  VIDEO_MIME_MAP,
  IMAGE_MIME_MAP,
  OFFICE_EXTS
} from "./shared/fileKindDetector.js";

export {
  getExt,
  fileKindFromName,
  isImageFile,
  isVideoFile,
  isOfficeFile,
  isZipFile,
  isExeFile,
  isSwfFile,
  readFontBlob,
  OFFICE_EXTS
};

const RECENT_FILES_MAX = 20;

function trackRecentFile(name, path) {
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

const LARGE_FILE_THRESHOLD = 1024 * 1024;

function isRomFile(name) {
  return ROM_EXTS.includes(getExt(name));
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
  if (isFontFile(name)) return "fas fa-font";
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
  let iconSource = thumbnailSrc || storedIcon;

  if (iconSource && typeof iconSource === "string") {
    if (iconSource.startsWith("fa-") && !iconSource.includes(" ")) {
      iconSource = "fas " + iconSource;
    }
    if (iconSource.startsWith("fa") || iconSource.includes(" fa-")) {
      return `<div style="${s}display:flex;align-items:center;justify-content:center;font-size:${Math.round(
        size * 0.44
      )}px;color:var(--brand);background:var(--brand-dim);border:1px solid var(--glass-border);"><i class="${iconSource}"></i></div>`;
    }
  }

  if (isHtmlFile(name)) {
    return `<div style="${s}display:flex;align-items:center;justify-content:center;font-size:${Math.round(
      size * 0.5
    )}px;color:var(--brand);background:var(--surface-1);border:1px solid var(--glass-border);"><img src="${resolveIconUrl("static/icons/firefox.webp")}" style="${s}object-fit:cover;"></div>`;
  }
  if (isMarkdownFile(name)) {
    return `<div style="${s}display:flex;align-items:center;justify-content:center;font-size:${Math.round(
      size * 0.5
    )}px;color:var(--brand);background:var(--surface-1);border:1px solid var(--glass-border);"><i class="fab fa-markdown"></i></div>`;
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
    )}px;color:var(--brand);background:var(--surface-1);border:1px solid var(--glass-border);"><i class="fas fa-code"></i></div>`;
  }
  if (isImageFile(name) && thumbnailSrc && thumbnailSrc !== "@content") {
    return `<img src="${thumbnailSrc}" style="${s}object-fit:cover;">`;
  }
  if (isVideoFile(name)) {
    return `<div style="${s}display:flex;align-items:center;justify-content:center;background:var(--bg-primary);font-size:${Math.round(
      size * 0.44
    )}px;color:var(--text-muted);"><i class="fas fa-film"></i></div>`;
  }
  if (isOfficeFile(name)) {
    return `<img src="${resolveIconUrl("static/icons/office.webp")}" style="${s}object-fit:cover;">`;
  }
  if (isEbookFile(name)) {
    return `<div style="${s}display:flex;align-items:center;justify-content:center;font-size:${Math.round(
      size * 0.44
    )}px;color:var(--error);background:var(--surface-1);border:1px solid var(--glass-border);"><i class="fas fa-book"></i></div>`;
  }
  if (isFontFile(name)) {
    return `<div style="${s}display:flex;align-items:center;justify-content:center;font-size:${Math.round(
      size * 0.44
    )}px;color:var(--brand);background:var(--surface-1);border:1px solid var(--glass-border);"><i class="fas fa-font"></i></div>`;
  }
  if (isDiskFile(name)) {
    return `<div style="${s}display:flex;align-items:center;justify-content:center;font-size:${Math.round(
      size * 0.44
    )}px;color:var(--brand);background:var(--surface-1);border:1px solid var(--glass-border);"><i class="fas fa-hdd"></i></div>`;
  }
  if (storedIcon && storedIcon !== "@content" && storedIcon !== "rom") {
    return `<img src="${resolveIconUrl(storedIcon)}" style="${s}object-fit:cover;">`;
  }
  if (isShortcutFile(name)) {
    return `<div style="${s}display:flex;align-items:center;justify-content:center;font-size:${Math.round(
      size * 0.44
    )}px;color:var(--brand);background:var(--surface-1);border:1px solid var(--glass-border);"><i class="fas fa-link"></i></div>`;
  }
  return `<img src="${resolveIconUrl("static/icons/notepad.webp")}" style="${s}object-fit:cover;">`;
}

function setupImageViewer(win) {
  const container = win.querySelector(".img-viewer-container");
  const img = container.querySelector("img");
  const controls = container.querySelector(".img-viewer-controls");
  const zoomInBtn = controls.querySelector(".img-zoom-in");
  const zoomOutBtn = controls.querySelector(".img-zoom-out");
  const fullscreenBtn = container.querySelector(".img-fullscreen-btn");

  let scale = 1;
  let tx = 0;
  let ty = 0;
  let fitScale = 1;
  let isPanning = false;
  let panStartX = 0;
  let panStartY = 0;
  let startTX = 0;
  let startTY = 0;

  function update() {
    img.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  }

  function calcFitScale() {
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    if (!nw || !nh) return 1;
    return Math.min(cw / nw, ch / nh, 1);
  }

  function fitToContainer() {
    fitScale = calcFitScale();
    scale = fitScale;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    tx = (cw - img.naturalWidth * scale) / 2;
    ty = (ch - img.naturalHeight * scale) / 2;
    img.style.removeProperty("max-width");
    img.style.removeProperty("max-height");
    update();
  }

  function zoomAt(newScale, cx, cy) {
    const rect = container.getBoundingClientRect();
    const originX = cx - rect.left;
    const originY = cy - rect.top;
    const oldScale = scale;
    scale = Math.max(0.1, Math.min(10, newScale));
    tx = originX - (originX - tx) * (scale / oldScale);
    ty = originY - (originY - ty) * (scale / oldScale);
    update();
  }

  function applyImageReady() {
    img.style.removeProperty("opacity");
    fitToContainer();
    update();
  }

  img.onload = applyImageReady;
  if (img.complete && img.naturalWidth > 0) applyImageReady();

  container.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1 / 1.1 : 1.1;
      zoomAt(scale * factor, e.clientX, e.clientY);
    },
    { passive: false }
  );

  img.addEventListener("dblclick", (e) => {
    e.stopPropagation();
    const atFit = Math.abs(scale - fitScale) < 0.01;
    if (atFit) {
      const rect = container.getBoundingClientRect();
      scale = 1;
      tx = (rect.width - img.naturalWidth) / 2;
      ty = (rect.height - img.naturalHeight) / 2;
      update();
    } else {
      fitToContainer();
    }
  });

  img.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    isPanning = true;
    panStartX = e.clientX;
    panStartY = e.clientY;
    startTX = tx;
    startTY = ty;
    img.classList.add("dragging");
  });

  document.addEventListener("mousemove", (e) => {
    if (!isPanning) return;
    tx = startTX + (e.clientX - panStartX);
    ty = startTY + (e.clientY - panStartY);
    update();
  });

  document.addEventListener("mouseup", () => {
    if (isPanning) {
      isPanning = false;
      img.classList.remove("dragging");
    }
  });

  zoomInBtn.addEventListener("click", () => {
    const rect = container.getBoundingClientRect();
    zoomAt(scale * 1.5, rect.left + rect.width / 2, rect.top + rect.height / 2);
  });

  zoomOutBtn.addEventListener("click", () => {
    const rect = container.getBoundingClientRect();
    zoomAt(scale / 1.5, rect.left + rect.width / 2, rect.top + rect.height / 2);
  });

  fullscreenBtn.addEventListener("click", () => {
    os.window.maximize(win);
  });

  const ro = new ResizeObserver(() => {
    if (Math.abs(scale - fitScale) < 0.01) fitToContainer();
  });
  ro.observe(container);
}

export function openMediaViewer(name, src, kind, windowManager) {
  const isVideo = kind === FileKind.VIDEO || isVideoFile(name);
  const isAudio = kind === FileKind.AUDIO || isAudioFile(name);
  const isImage = !isVideo && !isAudio;

  const [width, height] = isAudio ? ["400px", "120px"] : ["500px", "400px"];
  const icon = isAudio ? resolveIconUrl("static/icons/spot.webp") : resolveIconUrl("static/icons/file.webp");

  let media;
  if (isVideo) {
    media = `<video src="${src}" crossorigin="anonymous" controls autoplay loop style="max-width:100%;max-height:100%"></video>`;
  } else if (isAudio) {
    media = `<audio src="${src}" crossorigin="anonymous" controls autoplay style="width:90%"></audio>`;
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

  if (isImage) {
    win.innerHTML =
      headerHtml +
      `
      <div class="window-content" style="width:100%;height:100%;overflow:hidden;padding:0;">
        <div class="img-viewer-container">
          <img src="${src}" style="opacity:0;">
          <div class="img-viewer-controls">
            <button class="img-zoom-out" title="Zoom Out"><i class="fas fa-search-minus"></i></button>
            <button class="img-zoom-in" title="Zoom In"><i class="fas fa-search-plus"></i></button>
          </div>
          <div class="img-viewer-fullscreen">
            <button class="img-fullscreen-btn" title="Fullscreen"><i class="fas fa-arrows-alt"></i></button>
          </div>
        </div>
      </div>
    `;
  } else {
    win.innerHTML =
      headerHtml +
      `
      <div class="window-content" style="width:100%;height:100%;overflow:hidden;">
        <div style="display:flex;justify-content:center;align-items:center;height:100%;background:var(--bg-primary);">
          ${media}
        </div>
      </div>
    `;
  }

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

  if (isImage) setupImageViewer(win);
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

async function openModelFile(name, path, fs, appLauncher) {
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
    console.error("[FileDisplay] openModelFile error:", err);
  }
}

async function openExecutable(name, path, jsDosApp) {
  try {
    jsDosApp.launchExe(name, path);
  } catch (err) {
    console.error("[FileDisplay] openExecutable error:", err);
  }
}

async function openSwfFile(name, path, fs, appLauncher) {
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
    ruffleApp.launchRuffle(displayName, name, arrayBuffer);
  } catch (err) {
    console.error("[FileDisplay] openSwfFile error:", err);
  }
}

async function openRomFile(name, path, appLauncher) {
  try {
    const emulatorApp = appLauncher?.emulatorApp;
    if (emulatorApp) {
      emulatorApp.launchROM(name, path);
    } else {
      os.dialog.alert("Can't Open", "ROM emulation isn't available right now.");
    }
  } catch (err) {
    console.error("[FileDisplay] openRomFile error:", err);
  }
}

async function openMediaFile(name, path, fs, windowManager) {
  try {
    const ext = getExt(name);

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
    console.error("[FileDisplay] openMediaFile error:", err);
  }
}

async function openOfficeFile(name, path, fs, officeApp, notepadApp) {
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
    console.error("[FileDisplay] openOfficeFile error:", err);
  }
}

async function openMarkdown(name, path, content, markdownApp, notepadApp) {
  try {
    if (markdownApp) {
      markdownApp.open(name, content, path);
    } else {
      notepadApp.open(name, content, path);
    }
  } catch (err) {
    console.error("[FileDisplay] openMarkdown error:", err);
  }
}

async function openHtmlFile(name, path, content, browserApp, notepadApp) {
  try {
    if (browserApp) {
      browserApp.openHtml(content, name, path);
    } else {
      notepadApp.open(name, content, path);
    }
  } catch (err) {
    console.error("[FileDisplay] openHtmlFile error:", err);
  }
}

async function openTextFile(name, path, content, notepadApp) {
  try {
    const size = getContentSize(content);
    if (size > LARGE_FILE_THRESHOLD) {
      const confirmed = await confirmLargeFile(name, size);
      if (!confirmed) return;
    }
    notepadApp.open(name, content, path);
  } catch (err) {
    console.error("[FileDisplay] openTextFile error:", err);
  }
}

async function readFontBlob(name, path, fs) {
  const blob = await fs.readBinaryFile(path, name);
  if (blob && blob.size) return blob;
  const content = await fs.getFileContent(path, name);
  if (content instanceof Blob && content.size) return content;
  if (typeof content === "string" && content) {
    if (content.startsWith("data:") || content.startsWith("http://") || content.startsWith("https://")) {
      try {
        const resp = await fetch(content);
        if (resp.ok) return resp.blob();
      } catch {}
    }
    const bytes = Uint8Array.from(content, (c) => c.charCodeAt(0));
    return new Blob([bytes], { type: "application/octet-stream" });
  }
  return null;
}

async function openFontFile(name, path, fs) {
  try {
    const blob = await readFontBlob(name, path, fs);
    if (!blob || !blob.size) return os.dialog.alert("Error", "Could not read font file");
    const ext = getExt(name);
    const formatMap = { ttf: "truetype", otf: "opentype", woff: "woff", woff2: "woff2" };
    const format = formatMap[ext] || "truetype";
    const fontFamily = name.replace(/\.[^.]+$/, "");
    const fontUrl = URL.createObjectURL(blob);

    const style = document.createElement("style");
    style.id = "font-preview-" + Date.now();
    style.textContent = `@font-face { font-family: 'FontPreview'; src: url('${fontUrl}') format('${format}'); }`;
    document.head.appendChild(style);

    const winId = `font-preview-${Date.now()}`;
    const win = os.window.create(winId, name, "550px", "480px", { icon: "fas fa-font" });

    const contentEl = win.querySelector(".window-content");
    if (contentEl) {
      contentEl.style.padding = "20px";
      contentEl.style.overflowY = "auto";
    }
    (contentEl || win).innerHTML = `
      <div style="text-align:center;margin-bottom:16px;">
        <div style="font-family:'FontPreview';font-size:64px;line-height:1.2;color:var(--text-primary);padding:20px 0;">
          Aa Bb
        </div>
        <div style="font-family:'FontPreview';font-size:28px;line-height:1.3;color:var(--text-primary);">
          The quick brown fox jumps over the lazy dog.
        </div>
      </div>
      <div style="border-bottom:1px solid var(--glass-border);margin:16px 0;"></div>
      <div style="display:grid;grid-template-columns:auto 1fr;gap:8px 16px;font-size:13px;">
        <span style="opacity:0.6;">Family:</span><span>${fontFamily}</span>
        <span style="opacity:0.6;">Format:</span><span>${format}</span>
        <span style="opacity:0.6;">Size:</span><span>${formatFileSize(blob.size)}</span>
      </div>
      <div style="border-bottom:1px solid var(--glass-border);margin:16px 0;"></div>
      <div style="font-family:'FontPreview';font-size:18px;line-height:1.6;color:var(--text-secondary);">
        <div style="font-size:36px;margin-bottom:8px;">Aa Bb Cc Dd Ee Ff Gg</div>
        <div style="font-size:24px;margin-bottom:8px;">Hh Ii Jj Kk Ll Mm Nn Oo Pp</div>
        <div style="font-size:18px;margin-bottom:8px;">Qq Rr Ss Tt Uu Vv Ww Xx Yy Zz</div>
        <div style="font-size:14px;">0123456789 !@#$%^&amp;*() {}[] &lt;&gt;?/</div>
      </div>`;
  } catch (err) {
    console.error("[FileDisplay] openFontFile error:", err);
    os.dialog.alert("Error", "Failed to open font file");
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

    if (isModel3DFile(name)) return openModelFile(name, path, fs, appLauncher);
    if (
      isExeFile(name) ||
      name.toLowerCase().endsWith(".jsdos") ||
      name.toLowerCase().endsWith(".com") ||
      name.toLowerCase().endsWith(".bat")
    )
      return openExecutable(name, path, jsDosApp);
    if (isSwfFile(name)) return openSwfFile(name, path, fs, appLauncher);
    if (isRomFile(name)) return openRomFile(name, path, appLauncher);
    if (isVideoFile(name) || isAudioFile(name) || isImageFile(name))
      return openMediaFile(name, path, fs, windowManager);
    if (isOfficeFile(name)) return openOfficeFile(name, path, fs, officeApp, notepadApp);
    if (isFontFile(name)) return openFontFile(name, path, fs);

    const content = await fs.getFileContent(path, name);

    if (isMarkdownFile(name)) return openMarkdown(name, path, content, markdownApp, notepadApp);
    if (isHtmlFile(name)) return openHtmlFile(name, path, content, browserApp, notepadApp);
    return openTextFile(name, path, content, notepadApp);
  } catch (err) {
    console.error("[FileDisplay] openFileWith error:", err);
    os.notify.send("File Display", `Failed to open ${name}`, { type: "error" });
  }
}

function resolveDesktopIconFromDOM(name) {
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

function stripext(name) {
  return SHORTCUT_EXTS.some((ext) => name.toLowerCase().endsWith(`.${ext}`))
    ? name.slice(0, name.lastIndexOf("."))
    : name;
}

export async function showFileProperties(path, name, isFolder, onRename = null) {
  try {
    const displayLabel = isFolder ? name : stripext(name);
    let iconSrc;
    if (isFolder) {
      iconSrc = resolveIconUrl("static/icons/file.webp");
    } else {
      const domIcon = resolveDesktopIconFromDOM(name);
      iconSrc =
        domIcon && !domIcon.startsWith("fa") && !domIcon.startsWith("http") && !domIcon.startsWith("data:")
          ? resolveIconUrl(domIcon)
          : domIcon || resolveFileIcon(name);
    }
    let contents = "";
    let size;
    if (isFolder) {
      const { size: totalSize, files: fileCount, dirs: folderCount } = await os.fs.calcDirSize(path);
      const parts = [];
      if (fileCount > 0) parts.push(`${fileCount} File${fileCount !== 1 ? "s" : ""}`);
      if (folderCount > 0) parts.push(`${folderCount} Folder${folderCount !== 1 ? "s" : ""}`);
      contents = parts.join(", ") || "Empty";
      size = totalSize > 0 ? formatSize(totalSize) : "Empty";
    } else {
      size = await getItemSize(path);
    }
    let type = isFolder ? "Folder" : fileKindFromName(name);
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
                    : type === FileKind.FONT
                      ? "Font"
                      : "File";
    }
    if (type === "other" && isShortcutFile(name)) type = "Shortcut";
    const location = Array.isArray(path) ? path.join("/") : path;
    const modified = await getModifiedDate(path);

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
            <input id="props-rename-input" type="text" value="${displayLabel}" style="font-size:18px;font-weight:600;padding:4px;border-radius:6px;border:1px solid var(--glass-border);background:var(--glass);color:inherit;width:100%;">
            <div style="opacity:0.7;font-size:13px;margin-top:4px;">${type}</div>
          </div>
        </div>

        <div style="border-bottom:1px solid var(--glass-border);margin-bottom:16px;"></div>

        <div style="margin-bottom:16px;">
          <div style="font-size:13px;font-weight:600;margin-bottom:8px;opacity:0.9;">Details</div>
          <div style="display:grid;grid-template-columns:120px 1fr;gap:8px;font-size:13px;">
            <div style="opacity:0.7;">Type:</div><div>${type}</div>
            <div style="opacity:0.7;">Location:</div><div>${location}</div>
            <div style="opacity:0.7;">Size:</div><div>${size}</div>
            ${isFolder ? `<div style="opacity:0.7;">Contents:</div><div>${contents}</div>` : ""}
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

async function getItemSize(path) {
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

async function getModifiedDate(path) {
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
