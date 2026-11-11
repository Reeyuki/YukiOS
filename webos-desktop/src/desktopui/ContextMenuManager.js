import { $, $$, createElement } from "../shared/domUtils.js";
import {
  showContextMenu,
  showDynamicContextMenu,
  showYukiDynamicContextMenu,
  hideMenu,
} from "../shared/contextMenu.js";
import {
  sortDesktopIcons,
  relayoutDesktopIcons,
  changeDesktopIconSize,
} from "./desktopui.js";
import { os, StorageKeys, ServiceKeys } from "../framework.js";
import { getContextMenuStyle, CM_STYLES } from "../shared/contextMenuStyle.js";
import { ArchiveExtractor } from "../archiveExtractor.js";
import { AppSource } from "../AppSource.js";
import {
  showFileProperties,
  isImageFile,
  openFileWithApp,
  buildFileIconHTML,
} from "../fileDisplay.js";
import { isVideoFile } from "../shared/fileKindDetector.js";
import { FileKind, getExt, isZipFile } from "../shared/fileKindDetector.js";
import { getCompatibleApps, getDefaultApp } from "../fileAssociations.js";
import { showChooseAppDialog } from "../shared/chooseAppDialog.js";

import {
  buildCopyAction,
  buildCutAction,
  buildDeleteAction,
  buildRenameAction,
  buildPropertiesAction,
  getScreenshotService,
  isScreenshotRecording,
  toggleDesktopRecording,
} from "./contextActions.js";
import { openFileConverter } from "../utils/fileConverter.js";
import {
  getTargetFormats,
  detectCategory,
  convertFileBlob,
} from "../utils/converterCore.js";
import { showTransferDialog } from "../shared/transferDialog.js";
import { SystemUtilities } from "../system.js";
import { videos } from "../wallpaperList.js";
import { vantaPresets } from "../vantaPresets.js";
import { downloadBlob } from "../utils/utils.js";

function isCursorFileName(fileName) {
  const lower = fileName.toLowerCase();
  return lower.endsWith(".ani") || lower.endsWith(".cur");
}

function isCustomCursorActive() {
  return Boolean(os.storage.get(StorageKeys.cursorKey));
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function parseDesktopDir(filePath) {
  if (Array.isArray(filePath)) return filePath.filter(Boolean);
  if (!filePath) return ["Desktop"];
  const parts = String(filePath).split("/").filter(Boolean);
  return parts.length ? parts : ["Desktop"];
}

async function readDesktopCursorBlob(fileName, dirParts) {
  try {
    const blob = await os.fs.readBinaryFile(dirParts, fileName);
    if (blob && blob.size) return blob;
  } catch {}
  const content = await os.fs.getFileContent(dirParts, fileName);
  if (content instanceof Blob && content.size) return content;
  return null;
}

function applyDesktopPointerCursor(dataUrl) {
  os.storage.set(StorageKeys.cursorKey, dataUrl);
  document.body.style.cursor = `url("${dataUrl}"), auto`;
}

function resetDesktopPointerCursor() {
  os.storage.remove(StorageKeys.cursorKey);
  document.body.style.cursor = "";
}

async function setDesktopPointerFromFile(fileName, dirParts) {
  try {
    const blob = await readDesktopCursorBlob(fileName, dirParts);
    if (!blob) throw new Error("empty cursor");
    applyDesktopPointerCursor(await blobToDataUrl(blob));
  } catch {
    os.dialog.alert("Error", "Could not set mouse pointer");
  }
}

async function createDesktopShortcut(fileName, dirParts, desktopUI) {
  try {
    const targetPath = [...dirParts, fileName].join("/");
    const payload = JSON.stringify({ targetPath, targetName: fileName });
    const baseName = `${fileName}.shortcut.json`;
    const shortcutName = await os.fs.getUniqueFileName(dirParts, baseName);
    await os.fs.write([...dirParts, shortcutName], payload);
    if (dirParts.length === 1 && dirParts[0] === "Desktop") {
      try {
        await desktopUI.createDesktopFileIcon(shortcutName);
      } catch {}
    }
  } catch {
    os.dialog.alert("Error", "Could not create shortcut");
  }
}

function getDesktopScreenshotService() {
  try {
    return os.app.getInstance(ServiceKeys.SCREENSHOT);
  } catch {
    return getScreenshotService();
  }
}

function getDesktopConvertExtension(fileName) {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "";
}

function getDesktopConvertBaseName(fileName) {
  const idx = fileName.lastIndexOf(".");
  return idx > 0 ? fileName.slice(0, idx) : fileName;
}

function getDesktopConvertDefaults(category) {
  if (category === "image") return { quality: 90 };
  if (category === "audio") return { bitrate: "192k", channels: 2 };
  if (category === "video") return { videoCodec: "h264", audioCodec: "aac" };
  return {};
}

async function readDesktopConvertSource(dirParts, fileName) {
  try {
    const blob = await os.fs.readBinaryFile(dirParts, fileName);
    if (blob && blob.size) return blob;
  } catch {}
  const content = await os.fs.getFileContent(dirParts, fileName);
  if (content instanceof Blob) return content;
  if (typeof content === "string") return new Blob([content]);
  return new Blob([]);
}

async function runDesktopConvert(fileName, dirParts, targetFormat) {
  const ext = getDesktopConvertExtension(fileName);
  const category = detectCategory(ext);
  const source = await readDesktopConvertSource(dirParts, fileName);
  let text = null;
  if (category === "text" || category === "structured") {
    try {
      text = await source.text();
    } catch {
      text = String(source);
    }
  }
  const out = await convertFileBlob({
    blob: source,
    text,
    sourceExt: ext,
    targetFormat,
    options: getDesktopConvertDefaults(category),
  });
  let result = out;
  if (
    out &&
    typeof out === "object" &&
    !(out instanceof Blob) &&
    ("blob" in out || "text" in out)
  ) {
    result = out.blob || out.text;
  }
  const candidate = `${getDesktopConvertBaseName(fileName)}.${targetFormat}`;
  let uniqueName = candidate;
  try {
    uniqueName = await os.fs.getUniqueFileName(dirParts, candidate);
  } catch {}
  if (result instanceof Blob) {
    await os.fs.writeBinaryFile(dirParts, uniqueName, result);
  } else if (typeof result === "string") {
    await os.fs.createFile(dirParts, uniqueName, result);
  } else {
    throw new Error("Empty conversion result");
  }
  return uniqueName;
}

async function quickDesktopConvert(
  fileName,
  dirParts,
  targetFormat,
  desktopUI,
) {
  const label = targetFormat.toUpperCase();
  const dialog = showTransferDialog({
    title: `Converting to ${label}`,
    total: 1,
  });
  try {
    dialog.update(0, fileName);
    const created = await runDesktopConvert(fileName, dirParts, targetFormat);
    dialog.update(1, created);
    dialog.complete();
    if (dirParts.length === 1 && dirParts[0] === "Desktop") {
      try {
        await desktopUI.createDesktopFileIcon(created);
      } catch {}
    }
  } catch {
    dialog.complete();
    const category = detectCategory(getDesktopConvertExtension(fileName));
    if (category === "audio" || category === "video") {
      openFileConverter(fileName, dirParts, os, desktopUI.appLauncher);
    } else {
      os.dialog.alert("Convert to", `Could not convert "${fileName}".`);
    }
  }
}

function win11Icon(name) {
  try {
    if (getContextMenuStyle() !== CM_STYLES.WIN11) return null;
  } catch {
    return null;
  }
  const icons = {
    view: `<svg fill="none" stroke-width="1.5" viewBox="0 0 24 24" style="width:16px;height:16px;"><path stroke="currentColor" d="M14 20.4v-5.8c0-.3.3-.6.6-.6h5.8c.3 0 .6.3.6.6v5.8c0 .3-.3.6-.6.6h-5.8a.6.6 0 01-.6-.6zM3 20.4v-5.8c0-.3.3-.6.6-.6h5.8c.3 0 .6.3.6.6v5.8c0 .3-.3.6-.6.6H3.6a.6.6 0 01-.6-.6zM14 9.4V3.6c0-.3.3-.6.6-.6h5.8c.3 0 .6.3.6.6v5.8c0 .3-.3.6-.6.6h-5.8a.6.6 0 01-.6-.6zM3 9.4V3.6c0-.3.3-.6.6-.6h5.8c.3 0 .6.3.6.6v5.8c0 .3-.3.6-.6.6H3.6a.6.6 0 01-.6-.6z"></path></svg>`,
    sort: `<svg viewBox="0 0 416 330" style="width:16px;height:16px;"><path stroke="currentColor" fill="currentColor" d="M124 1h8l6 2 4 3 106 107 4 8v9l-2 5-5 6-8 4h-9l-8-4-71-71-1 144-1 1v81q-2 8-8 12l-6 3h-11q-8-3-12-8l-2-3-1-3v-5l-1-1V133l1-1V70l-69 69-3 4-8 4H17l-10-5v-1l-5-7-1-8q2-1 1-5l3-5L116 5l8-4z"></path><path fill="var(--clrPrm)" stroke="var(--clrPrm)" d="M284 17h12q7 3 11 9l3 6 1 226 70-71 9-5h12l5 2 7 8 2 4v14l-3 6-110 110-5 3q-4-1-4 1h-9l-7-3-4-3-108-107-4-8v-11l3-7 6-6 6-3h13l6 3 72 72V33l2-5 6-7 8-4z"></path></svg>`,
    refresh: `<svg viewBox="0 0 64 64" style="width:16px;height:16px;"><path stroke="currentColor" fill="currentColor" d="M52.36 2.42c1.13-.78 3.1.11 3.01 1.58.16 4.63.24 9.29-.06 13.92-1.33 1.78-3.92 1.84-5.83 2.7-2.86.88-5.63 2.05-8.55 2.73-2.24.82-3.57-2.75-1.56-3.76 3.12-1.45 6.55-2.08 9.7-3.46-4.53-5.47-12.03-8.07-19.02-7.52-7.45.53-14.44 4.97-18.24 11.38-3.59 5.9-4.28 13.42-1.95 19.9 2.06 5.83 6.52 10.78 12.13 13.38 6.52 3.08 14.48 2.94 20.86-.43 6.41-3.32 11.14-9.75 12.27-16.9.69-3.14-.13-6.37.28-9.52 1.08-1 2.2-1.08 3.38-.25.99 1.78.87 3.87.92 5.83.09 8.42-4.09 16.75-10.83 21.79-5.85 4.49-13.59 6.43-20.87 5.25-9.43-1.37-17.82-8.13-21.22-17.02-3.85-9.35-1.81-20.75 4.95-28.25C18.12 6.4 28.59 2.98 38.11 5.12c4.88.92 9.11 3.7 13.03 6.61.17-2.8-.15-5.63.26-8.41l.96-.9z"></path></svg>`,
    new: `<svg viewBox="0 0 500 500" style="width:16px;height:16px;"><path fill="var(--clrPrm)" stroke="var(--clrPrm)" d="M245 151h11q4 2 7 6l3 6v71h72q6 2 9 7l2 4v11l-5 7-6 3h-72v72q-2 6-6 9l-4 2h-11l-8-5-3-6v-72h-71q-7-2-10-6l-2-4v-11q2-5 6-8l6-3h71v-71q2-7 7-10l4-2z"></path><path stroke="currentColor" fill="currentColor" d="M249 26q3-1 4 1h19l1 1h7l1 1h6l6 2h5l1 1 11 2 4 2h3l6 3 13 4 21 10 21 13 17 13 17 17 17 20 11 16 5 10 2 2 12 26 6 18v3l2 4 1 8 1 1v4l1 1v4l1 1 1 14 1 1v19q2 0 1 4l-1 1v18l-1 1v8l-1 1v6l-1 1-2 14-1 1v3l-2 4v3l-6 18-5 10v2l-7 14-13 21-13 17-16 17-20 17-16 11-10 5-2 2-26 12-21 7h-3l-5 2h-4l-1 1h-4l-1 1h-4l-1 1-14 1-1 1h-19q-1 2-4 1l-1-1h-19l-1-1h-7l-1-1h-6l-1-1-14-2-1-1-10-2-18-6-3-2h-2l-21-10-21-13-17-13-17-15-18-21-11-16-5-10-2-2-10-21-5-16-2-3-1-7-3-8-2-14-1-1-1-14-1-1v-19q-2-1-1-4l1-1v-19l1-1v-7l1-1v-6l1-1 2-14 4-12v-3l2-3 3-11 5-10v-2l7-14 13-21 13-17 16-17 21-18 16-11 10-5 2-2 21-10 16-5 3-2 7-1 8-3h4l1-1h4l6-2h6l1-1h7l1-1h19l1-1zm-13 31l-1 1h-9l-1 1h-6l-1 1h-4l-1 1h-4l-9 3h-3l-15 5-3 2h-2l-7 4h-2q-31 15-53 37-25 24-41 58v2l-5 10-5 15-2 11-1 1v4l-1 1v4l-1 1v6l-1 1v9l-1 1v29l1 1v9l1 1v6l1 1v4l1 1v4l3 9v3l5 15 5 10v2l10 19q12 19 28 36 23 24 56 39h2l7 4h2l3 2 15 5 11 2 1 1h4l1 1 12 1 1 1h8l1 1h29l1-1 15-1 1-1h5l1-1h4l9-3h3l15-5 24-11 10-6q17-11 32-25l13-14 10-13 12-19 5-10v-2l4-7v-2l2-3 5-15 2-11 1-1v-4l1-1 1-12 1-1v-9l1-1v-28l-1-1-1-15-1-1v-5l-1-1v-4l-3-9v-3l-5-15-11-24-6-10q-11-19-26-33-17-18-38-31l-19-10h-2l-10-5-15-5-11-2-1-1h-4l-1-1h-4l-1-1h-6l-1-1h-9l-1-1h-29z"></path></svg>`,
    display: `<svg viewBox="0 0 500 500" style="width:16px;height:16px;"><path stroke="currentColor" fill="currentColor" d="M243.5 37h210l18 6L485 53.5l6 8 5 10 3 9v10l1 1v255l-1 1v10l-3 9-5 10-8.5 10.5-8 6-10 5-6 1-1 1h-4l-1 1H345v62h46.5q6.8 2.3 10.5 7.5l3 8v5l-3 7-4.5 4.5-6 3h-258l-5-2-5.5-5.5-3-7v-7l5.5-9.5 8-4H180v-62H71.5l-1-1-8-1-9-4-9-6-5.5-5.5-10-16-3-9v-6l-1-1v-92l.5-.5 4 4 12 8 18.5 9.5v70l3 7 5.5 5.5 5 2h378q6.8-2.3 10.5-7.5l3-8v-261l-3-8-5.5-5.5-5-2h-188l-1.5-1.5-6-14-12-18-.5-2.5zM214 401v62h96v-62h-96z"></path><path fill="var(--clrPrm)" stroke="var(--clrPrm)" d="M105.5 0h28l1 1h6.5q-.8 2.6 1 3.5v4l1 1v3l1 1v3l1 1v3l2 6 7 12 6.5 6.5 7 5 12 5q4-1 5 1h12l1-1h4l4-2h3l7-3h3L230 66.5l6 12 3 10-15 15-7 12-1 6-1 1v4l-1 1v13l1 1v4l3 9 4 7 17 18-8 20-12.5 18.5-9-3h-3l-4-2h-3l-1-1h-16l-14 5-12.5 9.5-5 7-5 10v3l-3 9-1 7-1 1v3.5h-8.5l-1 1h-24l-1-1H99l-1-2.5v-3l-1-1v-3l-1-1-1-8-3-9-6-10-8.5-8.5-13-7h-3l-5-2h-16l-4 2h-3l-12 4L11 203.5l-7-14-1-5-2-3v-3l12-11 7-10 3-7 1-6 1-1v-4l1-1v-9l-1-1-1-9-5-11q-7.4-11.6-18-20v-2l10-22 9-13V50l7.5 1 7 3 8 1 1 1h11q1.3-2.3 6-1l10-5h2L85 39.5l7-11 3-9v-3l1-1v-4l2-5v-4L99.5 1q4.8 1.3 6-1zm8.5 98l-6 2-9 5-9 10-5 12v14q2 0 1 4l4 9 3 4 5 4 8 5 6 2h5l1 1 14-2 8-4 4-4h1v-1q5-5 8-12l1-7 1-1v-9q-2-1-1-5l-2-6-6-9q-5-7-13-10l-6-2h-13z"></path></svg>`,
    personalize: `<svg viewBox="0 0 576 512" style="width:16px;height:16px;"><path fill="currentColor" d="M339.3 367.1c27.3-3.9 51.9-19.4 67.2-42.9L568.2 74.1c12.6-19.5 9.4-45.3-7.6-61.2S517.7-4.4 499.1 9.6L262.4 187.2c-24 18-38.2 46.1-38.4 76.1L339.3 367.1zm-19.6 25.4l-116-104.4C143.9 290.3 96 339.6 96 400c0 3.9 .2 7.8 .6 11.6C98.4 429.1 86.4 448 68.8 448H64c-17.7 0-32 14.3-32 32s14.3 32 32 32H208c61.9 0 112-50.1 112-112c0-2.5-.1-5-.2-7.5z"></path></svg>`,
  };
  return icons[name] || null;
}

export class DesktopContextMenuManager {
  constructor(desktopUI, PositionStore, IconDataHelper, wm) {
    this.desktopUI = desktopUI;
    this.PositionStore = PositionStore;
    this.IconDataHelper = IconDataHelper;
    this.wm = wm;
    this.desktop = $("#desktop");
    this.archiveExtractor = new ArchiveExtractor(
      desktopUI.fs,
      (msg) => os.notify.send(msg),
      AppSource.ARCHIVE_EXTRACTOR,
    );
    this.templates = {
      iconContextMenu: [
        {
          id: "ctx-open",
          label: "Open",
          action: "open",
          icon: "fa-external-link-alt",
        },
        "hr",
        { id: "ctx-copy", label: "Copy", action: "copy", icon: "fa-copy" },
        { id: "ctx-cut", label: "Cut", action: "cut", icon: "fa-cut" },
        "hr",
        {
          id: "ctx-paste-icon",
          label: "Paste",
          action: "paste",
          condition: () => !!this.desktopUI.getClipboard(),
          icon: "fa-paste",
        },
        "hr",
        {
          id: "ctx-delete",
          label: "Delete",
          action: "delete",
          icon: "fa-trash-alt",
        },
        {
          id: "ctx-rename",
          label: "Rename",
          action: "rename",
          icon: "fa-edit",
        },
        {
          id: "ctx-customize",
          label: "Customize Icon & Title",
          action: "customize",
          icon: "fa-palette",
        },
        {
          id: "ctx-properties",
          label: "Properties",
          action: "properties",
          icon: "fa-info-circle",
        },
      ],
      folderContextMenu: [
        {
          id: "ctx-open-folder",
          label: "Open",
          action: "openFolder",
          icon: "fa-folder-open",
        },
        "hr",
        {
          id: "ctx-add-archive-folder",
          label: "Compress to Zip file",
          action: "addArchiveFolder",
          icon: "fa-file-archive",
        },
        {
          id: "ctx-download-folder",
          label: "Download",
          action: "downloadFolder",
          icon: "fa-download",
        },
        "hr",
        {
          id: "ctx-copy-folder",
          label: "Copy",
          action: "copyFolder",
          icon: "fa-copy",
        },
        {
          id: "ctx-cut-folder",
          label: "Cut",
          action: "cutFolder",
          icon: "fa-cut",
        },
        "hr",
        {
          id: "ctx-paste-folder",
          label: "Paste",
          action: "paste",
          condition: () => !!this.desktopUI.getClipboard(),
          icon: "fa-paste",
        },
        "hr",
        {
          id: "ctx-delete-folder",
          label: "Delete",
          action: "deleteFolder",
          icon: "fa-trash-alt",
        },
        {
          id: "ctx-rename-folder",
          label: "Rename",
          action: "renameFolder",
          icon: "fa-edit",
        },
        "hr",
        {
          id: "ctx-properties-folder",
          label: "Properties",
          action: "propertiesFolder",
          icon: "fa-info-circle",
        },
      ],
      fileIconContextMenu: [
        {
          id: "ctx-open-file",
          label: "Open",
          action: "openFile",
          icon: "fa-file-alt",
        },
        "hr",
        {
          id: "ctx-add-archive-file",
          label: "Compress to Zip file",
          action: "addArchiveFile",
          icon: "fa-file-archive",
        },
        {
          id: "ctx-download-file",
          label: "Download",
          action: "downloadFile",
          icon: "fa-download",
        },
        "hr",
        {
          id: "ctx-copy-file",
          label: "Copy",
          action: "copyFile",
          icon: "fa-copy",
        },
        { id: "ctx-cut-file", label: "Cut", action: "cutFile", icon: "fa-cut" },
        "hr",
        {
          id: "ctx-paste-file",
          label: "Paste",
          action: "paste",
          condition: () => !!this.desktopUI.getClipboard(),
          icon: "fa-paste",
        },
        "hr",
        {
          id: "ctx-delete-file",
          label: "Delete",
          action: "deleteFile",
          icon: "fa-trash-alt",
        },
        {
          id: "ctx-rename-file",
          label: "Rename",
          action: "renameFile",
          icon: "fa-edit",
        },
        "hr",
        {
          id: "ctx-properties-file",
          label: "Properties",
          action: "propertiesFile",
          icon: "fa-info-circle",
        },
      ],
      desktopContextMenu: [
        {
          id: "ctx-view",
          label: "View",
          icon: win11Icon("view") || "fa-eye",
          action: "view",
        },
        {
          id: "ctx-sort",
          label: "Sort by",
          icon: win11Icon("sort") || "fa-sort",
          action: "sort",
        },
        {
          id: "ctx-refresh",
          label: "Refresh",
          action: "refresh",
          icon: win11Icon("refresh") || "fa-sync-alt",
        },
        "hr",
        {
          id: "ctx-new",
          label: "New",
          action: "new",
          icon: win11Icon("new") || "fa-plus",
        },
        "hr",
        {
          id: "ctx-add-files",
          label: "Upload files",
          action: "addFiles",
          icon: "fa-file-upload",
        },
        {
          id: "ctx-open-explorer",
          label: "Open in File Explorer",
          action: "openExplorer",
          icon: "fa-folder-open",
        },
        {
          id: "ctx-start-recording",
          label: "Start Recording",
          action: "startRecording",
          icon: "fa-circle",
        },
        "hr",
        {
          id: "ctx-set-wallpaper",
          label: "Personalize",
          action: "setWallpaper",
          icon: win11Icon("personalize") || "fa-paint-brush",
        },
        {
          id: "ctx-background",
          label: "Change background",
          action: "background",
          icon: "fa-image",
        },
        "hr",
        {
          id: "ctx-open-terminal",
          label: "Open in Terminal",
          action: "openTerminal",
          icon: "fa-terminal",
        },
        "hr",
        {
          id: "ctx-paste",
          label: "Paste",
          action: "paste",
          condition: () => !!this.desktopUI.getClipboard(),
          icon: "fa-paste",
        },
        "hr",
        {
          id: "ctx-widgets",
          label: "Widgets",
          action: "widgets",
          icon: "fa-puzzle-piece",
        },
        {
          id: "ctx-fullscreen",
          label: "Full screen",
          icon: "fa-expand",
          action: "fullscreen",
        },
      ],
    };
  }

  handleContextMenu(e) {
    if (e.target.closest(".desktop-file-icon")) {
      e.preventDefault();
      this.showFileIconContextMenu(e, e.target.closest(".desktop-file-icon"));
    } else if (e.target.classList.contains("folder-icon")) {
      e.preventDefault();
      this.showFolderContextMenu(e, e.target);
    } else if (e.target.classList.contains("selectable")) {
      e.preventDefault();
      this.showIconContextMenu(e, e.target);
    } else if (e.target === this.desktop) {
      e.preventDefault();
      this.showDesktopContextMenu(e);
    }
  }

  showFolderContextMenu(e, folderIcon) {
    if (!this.desktopUI.selectionManager.has(folderIcon)) {
      this.desktopUI.selectionManager.clear();
      this.desktopUI.selectionManager.add(folderIcon);
    }
    const selectedArray = this.desktopUI.selectionManager.toArray();
    const folderName = folderIcon.dataset.folderName;

    showContextMenu(e, this.templates.folderContextMenu, {
      openFolder: () => this.desktopUI.openFolder(folderName),
      addArchiveFolder: async () => {
        await this.addToArchive(["Desktop", folderName], folderName);
      },
      downloadFolder: async () => {
        await this.downloadItem(["Desktop", folderName], folderName, true);
      },
      propertiesFolder: buildPropertiesAction(folderIcon, this.desktopUI),
      copyFolder: buildCopyAction(selectedArray, this.desktopUI),
      cutFolder: buildCutAction(selectedArray, this.desktopUI),
      paste: async () => {
        await this.desktopUI.pasteToDesktop();
      },
      deleteFolder: buildDeleteAction(selectedArray, this.desktopUI),
      renameFolder: buildRenameAction(folderIcon, this.desktopUI, {
        PositionStore: this.PositionStore,
      }),
    });
  }

  showFileIconContextMenu(e, fileIcon) {
    if (!this.desktopUI.selectionManager.has(fileIcon)) {
      this.desktopUI.selectionManager.clear();
      this.desktopUI.selectionManager.add(fileIcon);
    }
    const selectedArray = this.desktopUI.selectionManager.toArray();
    const fileName = fileIcon.dataset.fileName;
    const rawFilePath = fileIcon.dataset.filePath;
    const filePath =
      rawFilePath !== undefined && rawFilePath !== null && rawFilePath !== ""
        ? rawFilePath
        : "Desktop";

    showDynamicContextMenu(e, async (menu, item, hr, submenu) => {
      const defaultApp = getDefaultApp(fileName);
      const defaultIcon =
        defaultApp?.icon !== undefined &&
        defaultApp?.icon !== null &&
        defaultApp.icon !== ""
          ? defaultApp.icon
          : "fa-file-alt";
      menu.appendChild(
        item(
          "Open",
          () => this.desktopUI.openDesktopFile(fileName),
          defaultIcon,
        ),
      );
      menu.appendChild(
        submenu(
          "Open with",
          (subMenuEl, subItem, subHr) => {
            const apps = getCompatibleApps(fileName);
            for (const app of apps) {
              subMenuEl.appendChild(
                subItem(
                  app.title,
                  () =>
                    openFileWithApp(app.appId, {
                      name: fileName,
                      path: filePath.split("/"),
                    }),
                  app.icon,
                ),
              );
            }
            subMenuEl.appendChild(subHr());
            subMenuEl.appendChild(
              subItem(
                "Choose another app",
                () =>
                  showChooseAppDialog({
                    ext: getExt(fileName),
                    name: fileName,
                    path: filePath.split("/"),
                  }),
                "fa-sliders-h",
              ),
            );
          },
          "fa-share-alt",
        ),
      );
      menu.appendChild(
        item(
          "Compress to Zip file",
          async () => {
            await this.addToArchive([filePath, fileName], fileName);
          },
          "fa-file-archive",
        ),
      );
      menu.appendChild(
        item(
          "Download",
          async () => {
            await this.downloadItem([filePath, fileName], fileName, false);
          },
          "fa-download",
        ),
      );
      menu.appendChild(hr());

      const desktopExt = getDesktopConvertExtension(fileName);
      const desktopCategory = detectCategory(desktopExt);
      const rawDesktopTargets = desktopCategory
        ? getTargetFormats(desktopExt)
        : null;
      const desktopTargets = Array.isArray(rawDesktopTargets)
        ? rawDesktopTargets.filter((target) => target !== desktopExt)
        : [];
      if (desktopTargets.length > 0) {
        const desktopDir = parseDesktopDir(filePath);
        menu.appendChild(
          submenu(
            "Convert to",
            (subMenuEl, subItem, subHr) => {
              for (const target of desktopTargets) {
                subMenuEl.appendChild(
                  subItem(target.toUpperCase(), () => {
                    quickDesktopConvert(
                      fileName,
                      desktopDir,
                      target,
                      this.desktopUI,
                    );
                  }),
                );
              }
              subMenuEl.appendChild(subHr());
              subMenuEl.appendChild(
                subItem(
                  "Convert / Transform...",
                  () => {
                    openFileConverter(
                      fileName,
                      desktopDir,
                      os,
                      this.desktopUI.appLauncher,
                    );
                  },
                  "fa-exchange-alt",
                ),
              );
            },
            "fa-exchange-alt",
          ),
        );
      }

      menu.appendChild(hr());

      const notEditable = [
        "mp4",
        "mp3",
        "png",
        "jpg",
        "gif",
        "webp",
        "zip",
        "exe",
      ];
      const fileExt = fileName.split(".").pop().toLowerCase();
      if (!notEditable.includes(fileExt)) {
        menu.appendChild(
          item(
            "Edit with Notepad",
            async () => {
              await this.desktopUI.editDesktopFileWithNotepad(fileName);
            },
            "fa-pen",
          ),
        );
      }

      menu.appendChild(
        item(
          "Edit with Notepad (force)",
          async () => {
            await this.desktopUI.editDesktopFileWithNotepad(fileName);
          },
          "fa-pen",
        ),
      );

      if (isImageFile(fileName) || isVideoFile(fileName)) {
        const isVideo = isVideoFile(fileName);
        const readAsDataUrl = async () => {
          const blob = await os.fs.readBinaryFile(filePath, fileName);
          if (!blob) return null;
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        };

        menu.appendChild(
          item(
            "Set as Wallpaper",
            async () => {
              try {
                const dataUrl = await readAsDataUrl();
                await SystemUtilities.setWallpaper(dataUrl);
              } catch (err) {
                console.error("Set wallpaper error:", err);
                os.dialog.alert("Error", "Could not set wallpaper");
              }
            },
            isVideo ? "fa-video" : "fa-image",
          ),
        );
        menu.appendChild(
          item(
            "Save as Wallpaper",
            async () => {
              try {
                const dataUrl = await readAsDataUrl();
                await this.desktopUI.saveToWallpapers(
                  fileName,
                  dataUrl,
                  isVideo ? FileKind.VIDEO : FileKind.IMAGE,
                  "@content",
                );
              } catch (err) {
                console.error("Save wallpaper error:", err);
                os.dialog.alert("Error", "Could not save wallpaper");
              }
            },
            "fa-save",
          ),
        );
      }

      menu.appendChild(hr());
      menu.appendChild(
        item("Copy", buildCopyAction(selectedArray, this.desktopUI), "fa-copy"),
      );
      menu.appendChild(
        item("Cut", buildCutAction(selectedArray, this.desktopUI), "fa-cut"),
      );
      if (this.desktopUI.getClipboard()) {
        menu.appendChild(
          item(
            "Paste",
            async () => {
              await this.desktopUI.pasteToDesktop();
            },
            "fa-paste",
          ),
        );
      }
      menu.appendChild(hr());
      menu.appendChild(
        item(
          "Create shortcut",
          async () => {
            await createDesktopShortcut(
              fileName,
              parseDesktopDir(filePath),
              this.desktopUI,
            );
          },
          "fa-link",
        ),
      );
      if (isCursorFileName(fileName)) {
        const cursorDir = parseDesktopDir(filePath);
        menu.appendChild(
          item(
            "Set as mouse pointer",
            async () => {
              await setDesktopPointerFromFile(fileName, cursorDir);
            },
            "fa-mouse-pointer",
          ),
        );
      }
      if (isCustomCursorActive()) {
        menu.appendChild(
          item(
            "Reset mouse pointer",
            () => resetDesktopPointerCursor(),
            "fa-undo",
          ),
        );
      }
      menu.appendChild(hr());
      menu.appendChild(
        item(
          "Delete",
          buildDeleteAction(selectedArray, this.desktopUI),
          "fa-trash-alt",
        ),
      );
      menu.appendChild(
        item(
          "Rename",
          () => this.startInlineDesktopRename(fileIcon),
          "fa-edit",
        ),
      );
      menu.appendChild(hr());
      menu.appendChild(
        item(
          "Properties",
          buildPropertiesAction(fileIcon, this.desktopUI),
          "fa-info-circle",
        ),
      );
    });
  }

  showIconContextMenu(e, icon) {
    if (!this.desktopUI.selectionManager.has(icon)) {
      this.desktopUI.selectionManager.clear();
      this.desktopUI.selectionManager.add(icon);
    }
    const selectedArray = this.desktopUI.selectionManager.toArray();
    const last = selectedArray[selectedArray.length - 1];
    showContextMenu(e, this.templates.iconContextMenu, {
      open: () => os.app.launch(last.dataset.app),
      copy: buildCopyAction(selectedArray, this.desktopUI),
      cut: buildCutAction(selectedArray, this.desktopUI),
      paste: async () => {
        await this.desktopUI.pasteToDesktop();
      },
      delete: buildDeleteAction(selectedArray, this.desktopUI),
      rename: () => this.startInlineDesktopRename(last),
      customize: () => {
        import("../shared/appCustomizer.js").then((m) => {
          const imgSrc = last.querySelector("img")?.src;
          const iClass = last.querySelector("i")?.className;
          let iconValue = "";
          if (imgSrc !== undefined && imgSrc !== null && imgSrc !== "") {
            iconValue = imgSrc;
          } else if (iClass !== undefined && iClass !== null && iClass !== "") {
            iconValue = iClass;
          }
          m.showAppCustomizer(
            last.dataset.app,
            this.IconDataHelper.getIconName(last),
            iconValue,
          );
        });
      },
      properties: buildPropertiesAction(last, this.desktopUI),
    });
  }

  showDesktopContextMenu(e) {
    const currentSort = this.currentSortMode();
    const storedAutoSort = os.storage.get(StorageKeys.desktopAutoSort);
    const currentAutoSort =
      storedAutoSort !== undefined && storedAutoSort !== null
        ? Boolean(storedAutoSort)
        : false;

    showDynamicContextMenu(e, (menu, item, hr, submenu) => {
      menu.appendChild(
        submenu(
          "View",
          (sub, sItem, sHr) => {
            const storedSize = os.storage.get(StorageKeys.desktopIconSize);
            const parsedSize = Number(storedSize);
            const currentSize = Number.isFinite(parsedSize) ? parsedSize : 48;
            const sizes = [
              { size: 96, label: "Large icons", icon: "fa-th-list" },
              { size: 64, label: "Medium icons", icon: "fa-th-large" },
              { size: 32, label: "Small icons", icon: "fa-th" },
            ];
            sizes.forEach(({ size, label, icon: faIcon }) => {
              const el = sItem(
                label,
                () => changeDesktopIconSize(size),
                faIcon,
              );
              if (currentSize === size) {
                el.style.fontWeight = "700";
                const check = createElement("i");
                check.className = "fas fa-check";
                check.style.marginLeft = "auto";
                check.style.fontSize = "10px";
                el.appendChild(check);
              }
              sub.appendChild(el);
            });

            sub.appendChild(sHr());

            const storedAlignment = os.storage.get(
              StorageKeys.desktopIconAlignment,
            );
            const currentAlignment =
              storedAlignment !== undefined &&
              storedAlignment !== null &&
              storedAlignment !== ""
                ? storedAlignment
                : "horizontal";
            const alignLabel =
              currentAlignment === "vertical"
                ? "Align Horizontally"
                : "Align Vertically";
            const alignIcon =
              currentAlignment === "vertical"
                ? "fa-arrows-alt-h"
                : "fa-arrows-alt-v";
            sub.appendChild(
              sItem(
                alignLabel,
                () => {
                  const next =
                    currentAlignment === "vertical" ? "horizontal" : "vertical";
                  os.storage.set(StorageKeys.desktopIconAlignment, next);
                  relayoutDesktopIcons();
                },
                alignIcon,
              ),
            );

            sub.appendChild(sHr());

            const hideDesktopIcons =
              os.storage.get(StorageKeys.hideDesktopIcons) === "true";
            const hideLabel = hideDesktopIcons
              ? "Show desktop icons"
              : "Hide desktop icons";
            const hideIcon = hideDesktopIcons ? "fa-eye" : "fa-eye-slash";
            sub.appendChild(
              sItem(
                hideLabel,
                () => {
                  const next = !hideDesktopIcons;
                  os.storage.set(StorageKeys.hideDesktopIcons, String(next));
                  $$("#desktop > .icon").forEach((icon) => {
                    icon.style.display = next ? "none" : "";
                  });
                },
                hideIcon,
              ),
            );
          },
          win11Icon("view") || "fa-eye",
        ),
      );
      menu.appendChild(
        submenu(
          "Sort by",
          (sub, sItem, sHr) => {
            const sortItems = [
              { id: "name", label: "Name", icon: "fa-sort-alpha-down" },
              { id: "type", label: "Item type", icon: "fa-sort-amount-down" },
              { id: "recent", label: "Recently used", icon: "fa-clock" },
            ];
            sortItems.forEach(({ id, label, icon: faIcon }) => {
              const el = sItem(label, () => sortDesktopIcons(id), faIcon);
              if (currentSort === id) {
                el.style.fontWeight = "700";
                const check = createElement("i");
                check.className = "fas fa-check";
                check.style.marginLeft = "auto";
                check.style.fontSize = "10px";
                el.appendChild(check);
              }
              sub.appendChild(el);
            });
            sub.appendChild(sHr());
            if (currentSort && currentSort !== "none") {
              sub.appendChild(
                sItem(
                  "Free Placement",
                  () => sortDesktopIcons("none"),
                  "fa-undo",
                ),
              );
            }
            sub.appendChild(sHr());
            const autoLabel = currentAutoSort
              ? "Auto Sort: On"
              : "Auto Sort: Off";
            const autoIcon = currentAutoSort ? "fa-toggle-on" : "fa-toggle-off";
            const autoEl = sItem(
              autoLabel,
              () => {
                const next = !currentAutoSort;
                os.storage.set(StorageKeys.desktopAutoSort, next);
                if (next && currentSort && currentSort !== "none") {
                  sortDesktopIcons(currentSort);
                }
              },
              autoIcon,
            );
            if (currentAutoSort) autoEl.style.color = "var(--clrPrm)";
            sub.appendChild(autoEl);
          },
          win11Icon("sort") || "fa-sort",
        ),
      );
      menu.appendChild(
        item(
          "Refresh",
          async () => {
            const desktopEl = $("#desktop");
            if (desktopEl.classList.contains("desktop-refreshing")) return;
            desktopEl.classList.add("desktop-refreshing");
            await new Promise((r) => setTimeout(r, 60));
            $$(".folder-icon, .desktop-file-icon").forEach((i) => i.remove());
            await this.desktopUI.loadDesktopItems();
            relayoutDesktopIcons();
            setTimeout(
              () => desktopEl.classList.remove("desktop-refreshing"),
              80,
            );
            const fresh = $$("#desktop > .icon");
            fresh.forEach((el, idx) => {
              el.classList.remove("desktop-refresh-enter");
              void el.offsetWidth;
              el.style.animationDelay = `${(idx % 8) * 18}ms`;
              el.classList.add("desktop-refresh-enter");
            });
            setTimeout(() => {
              fresh.forEach((el) => {
                el.classList.remove("desktop-refresh-enter");
                el.style.animationDelay = "";
              });
            }, 600);
          },
          win11Icon("refresh") || "fa-sync-alt",
        ),
      );
      menu.appendChild(hr());
      menu.appendChild(
        submenu(
          "New",
          (sub, sItem, sHr) => {
            sub.appendChild(
              sItem(
                "Folder",
                async () => {
                  await this.spawnInlineDesktopItem(false);
                },
                "fa-folder",
              ),
            );
            sub.appendChild(
              sItem(
                "Text",
                async () => {
                  await this.spawnInlineDesktopItem(true);
                },
                "fa-file-alt",
              ),
            );
          },
          win11Icon("new") || "fa-plus",
        ),
      );

      menu.appendChild(hr());

      menu.appendChild(
        item(
          "Display settings",
          () => {
            os.app.launch("settingsApp", { section: "pane-appearance" });
          },
          win11Icon("display") || "fa-cog",
        ),
      );

      menu.appendChild(
        item(
          "Personalize",
          () => {
            os.app.launch("settingsApp", { section: "pane-appearance" });
          },
          win11Icon("personalize") || "fa-paint-brush",
        ),
      );
      menu.appendChild(hr());

      menu.appendChild(
        item(
          "Open in Terminal",
          () => {
            const storedUsername = os.storage.get(StorageKeys.username);
            const username =
              storedUsername !== undefined &&
              storedUsername !== null &&
              storedUsername !== ""
                ? storedUsername
                : "guest";
            os.app.launch("terminalApp", {
              initialPath: ["home", username, "Desktop"],
            });
          },
          "fa-terminal",
        ),
      );

      menu.appendChild(hr());

      if (this.desktopUI.getClipboard()) {
        menu.appendChild(
          item(
            "Paste",
            async () => {
              await this.desktopUI.pasteToDesktop();
            },
            "fa-paste",
          ),
        );
      }

      menu.appendChild(
        item(
          "Full screen",
          () => {
            if (document.fullscreenElement) {
              document.exitFullscreen();
            } else {
              document.documentElement.requestFullscreen();
            }
          },
          "fa-expand",
        ),
      );

      menu.appendChild(
        item(
          "Show more options",
          () => {
            this.showYukiDesktopContextMenu(e);
          },
          "fa-ellipsis-h",
        ),
      );
    });
  }

  showYukiDesktopContextMenu(e) {
    const currentSort = this.currentSortMode();
    const storedAutoSort = os.storage.get(StorageKeys.desktopAutoSort);
    const currentAutoSort =
      storedAutoSort !== undefined && storedAutoSort !== null
        ? Boolean(storedAutoSort)
        : false;

    showYukiDynamicContextMenu(e, (menu, item, hr, submenu) => {
      menu.appendChild(
        submenu(
          "New",
          (sub, sItem, sHr) => {
            sub.appendChild(
              sItem(
                "Folder",
                async () => {
                  await this.spawnInlineDesktopItem(false);
                },
                "fa-folder",
              ),
            );
            sub.appendChild(
              sItem(
                "Text",
                async () => {
                  await this.spawnInlineDesktopItem(true);
                },
                "fa-file-alt",
              ),
            );
          },
          "fa-plus",
        ),
      );

      menu.appendChild(hr());

      menu.appendChild(
        item("Upload files", () => this.desktopUI.addFiles(), "fa-file-upload"),
      );
      menu.appendChild(
        item(
          "Open in File Explorer",
          () => this.desktopUI.explorerApp.open(),
          "fa-folder-open",
        ),
      );
      const screenshotService = getDesktopScreenshotService();
      const recordingActive = isScreenshotRecording(screenshotService);
      menu.appendChild(
        item(
          recordingActive ? "Stop recording" : "Start recording",
          async () => {
            try {
              await toggleDesktopRecording();
            } catch {
              os.dialog.alert("Recording", "Could not change recording state");
            }
          },
          recordingActive ? "fa-stop" : "fa-circle",
        ),
      );
      menu.appendChild(
        item(
          "Personalize",
          () => {
            os.app.launch("settingsApp", { section: "pane-appearance" });
          },
          "fa-paint-brush",
        ),
      );
      menu.appendChild(
        item(
          "Change background",
          () => this.showBackgroundContextMenu(e),
          "fa-image",
        ),
      );
      menu.appendChild(
        item(
          "Desktop particles",
          () => {
            os.app.launch("settingsApp", {
              section: "pane-appearance",
              target: "sc-particles",
            });
          },
          "fa-snowflake",
        ),
      );
      menu.appendChild(
        item(
          "Open in Terminal",
          () => {
            const storedUsername = os.storage.get(StorageKeys.username);
            const username =
              storedUsername !== undefined &&
              storedUsername !== null &&
              storedUsername !== ""
                ? storedUsername
                : "guest";
            os.app.launch("terminalApp", {
              initialPath: ["home", username, "Desktop"],
            });
          },
          "fa-terminal",
        ),
      );

      menu.appendChild(hr());

      if (this.desktopUI.getClipboard()) {
        menu.appendChild(
          item(
            "Paste",
            async () => {
              await this.desktopUI.pasteToDesktop();
            },
            "fa-paste",
          ),
        );
      }

      menu.appendChild(hr());

      menu.appendChild(
        submenu(
          "View",
          (sub, sItem, sHr) => {
            const storedSize = os.storage.get(StorageKeys.desktopIconSize);
            const parsedSize = Number(storedSize);
            const currentSize = Number.isFinite(parsedSize) ? parsedSize : 48;
            const sizes = [
              { size: 96, label: "Large icons", icon: "fa-th-list" },
              { size: 64, label: "Medium icons", icon: "fa-th-large" },
              { size: 32, label: "Small icons", icon: "fa-th" },
            ];
            sizes.forEach(({ size, label, icon: faIcon }) => {
              const el = sItem(
                label,
                () => changeDesktopIconSize(size),
                faIcon,
              );
              if (currentSize === size) {
                el.style.fontWeight = "700";
                const check = createElement("i");
                check.className = "fas fa-check";
                check.style.marginLeft = "auto";
                check.style.fontSize = "10px";
                el.appendChild(check);
              }
              sub.appendChild(el);
            });

            sub.appendChild(sHr());

            const storedAlignment = os.storage.get(
              StorageKeys.desktopIconAlignment,
            );
            const currentAlignment =
              storedAlignment !== undefined &&
              storedAlignment !== null &&
              storedAlignment !== ""
                ? storedAlignment
                : "horizontal";
            const alignLabel =
              currentAlignment === "vertical"
                ? "Align Horizontally"
                : "Align Vertically";
            const alignIcon =
              currentAlignment === "vertical"
                ? "fa-arrows-alt-h"
                : "fa-arrows-alt-v";
            sub.appendChild(
              sItem(
                alignLabel,
                () => {
                  const next =
                    currentAlignment === "vertical" ? "horizontal" : "vertical";
                  os.storage.set(StorageKeys.desktopIconAlignment, next);
                  relayoutDesktopIcons();
                },
                alignIcon,
              ),
            );

            sub.appendChild(sHr());

            const hideDesktopIcons =
              os.storage.get(StorageKeys.hideDesktopIcons) === "true";
            const hideLabel = hideDesktopIcons
              ? "Show desktop icons"
              : "Hide desktop icons";
            const hideIcon = hideDesktopIcons ? "fa-eye" : "fa-eye-slash";
            sub.appendChild(
              sItem(
                hideLabel,
                () => {
                  const next = !hideDesktopIcons;
                  os.storage.set(StorageKeys.hideDesktopIcons, String(next));
                  $$("#desktop > .icon").forEach((icon) => {
                    icon.style.display = next ? "none" : "";
                  });
                },
                hideIcon,
              ),
            );
          },
          "fa-eye",
        ),
      );

      menu.appendChild(
        submenu(
          "Sort by",
          (sub, sItem, sHr) => {
            const sortItems = [
              { id: "name", label: "Name", icon: "fa-sort-alpha-down" },
              { id: "type", label: "Item type", icon: "fa-sort-amount-down" },
              { id: "recent", label: "Recently used", icon: "fa-clock" },
            ];
            sortItems.forEach(({ id, label, icon: faIcon }) => {
              const el = sItem(label, () => sortDesktopIcons(id), faIcon);
              if (currentSort === id) {
                el.style.fontWeight = "700";
                const check = createElement("i");
                check.className = "fas fa-check";
                check.style.marginLeft = "auto";
                check.style.fontSize = "10px";
                el.appendChild(check);
              }
              sub.appendChild(el);
            });
            sub.appendChild(sHr());
            if (currentSort && currentSort !== "none") {
              sub.appendChild(
                sItem(
                  "Free Placement",
                  () => sortDesktopIcons("none"),
                  "fa-undo",
                ),
              );
            }
            sub.appendChild(sHr());
            const autoLabel = currentAutoSort
              ? "Auto Sort: On"
              : "Auto Sort: Off";
            const autoIcon = currentAutoSort ? "fa-toggle-on" : "fa-toggle-off";
            const autoEl = sItem(
              autoLabel,
              () => {
                const next = !currentAutoSort;
                os.storage.set(StorageKeys.desktopAutoSort, next);
                if (next && currentSort && currentSort !== "none") {
                  sortDesktopIcons(currentSort);
                }
              },
              autoIcon,
            );
            if (currentAutoSort) autoEl.style.color = "var(--brand)";
            sub.appendChild(autoEl);
          },
          "fa-sort",
        ),
      );

      menu.appendChild(hr());

      menu.appendChild(
        submenu(
          "Widgets",
          (sub, sItem, sHr) => {
            const wm = this.desktopUI.widgetManager;
            const existing = wm.getAllWidgets();
            const existingTypes = new Set(existing.map((w) => w.type));
            const widgetTypes = [
              { type: "clock", label: "Clock", icon: "fa-clock" },
              { type: "weather", label: "Weather", icon: "fa-cloud-sun" },
              { type: "notes", label: "Notes", icon: "fa-sticky-note" },
              { type: "calendar", label: "Calendar", icon: "fa-calendar-alt" },
              {
                type: "systemMonitor",
                label: "System Monitor",
                icon: "fa-desktop",
              },
              {
                type: "musicControl",
                label: "Music Control",
                icon: "fa-music",
              },
              { type: "todo", label: "To-Do", icon: "fa-check-square" },
              { type: "power", label: "Power", icon: "fa-power-off" },
              { type: "clipboard", label: "Clipboard", icon: "fa-clipboard" },
              { type: "photoFrame", label: "Photo Frame", icon: "fa-image" },
              { type: "timer", label: "Timer", icon: "fa-stopwatch" },
              { type: "youtube", label: "YouTube", icon: "fab fa-youtube" },
              { type: "aquarium", label: "Aquarium", icon: "fa-fish" },
              { type: "rhythms", label: "Rhythms", icon: "fa-wave-square" },
            ];
            widgetTypes.forEach((wt) => {
              const disabled = existingTypes.has(wt.type);
              const el = sItem(
                wt.label,
                disabled
                  ? null
                  : () => {
                      wm.addWidget(wt.type, wt.label);
                    },
                wt.icon,
              );
              if (disabled) {
                el.style.opacity = "0.4";
                el.style.cursor = "default";
                const check = createElement("i");
                check.className = "fas fa-check";
                check.style.marginLeft = "auto";
                check.style.fontSize = "10px";
                check.style.color = "var(--brand)";
                el.appendChild(check);
              }
              sub.appendChild(el);
            });
            if (existing.length > 0) {
              sub.appendChild(sHr());
              const removeAll = sItem(
                "Remove All Widgets",
                () => {
                  existing.forEach((w) => wm.removeWidget(w.id));
                },
                "fa-trash-alt",
              );
              removeAll.style.color = "var(--error)";
              sub.appendChild(removeAll);
            }
          },
          "fa-puzzle-piece",
        ),
      );

      menu.appendChild(
        item(
          "Full screen",
          () => {
            if (document.fullscreenElement) {
              document.exitFullscreen();
            } else {
              document.documentElement.requestFullscreen();
            }
          },
          "fa-expand",
        ),
      );

      menu.appendChild(hr());

      menu.appendChild(
        item(
          "Refresh",
          async () => {
            const desktopEl = $("#desktop");
            if (desktopEl.classList.contains("desktop-refreshing")) return;
            desktopEl.classList.add("desktop-refreshing");
            await new Promise((r) => setTimeout(r, 60));
            $$(".folder-icon, .desktop-file-icon").forEach((i) => i.remove());
            await this.desktopUI.loadDesktopItems();
            relayoutDesktopIcons();
            setTimeout(
              () => desktopEl.classList.remove("desktop-refreshing"),
              80,
            );
            const fresh = $$("#desktop > .icon");
            fresh.forEach((el, idx) => {
              el.classList.remove("desktop-refresh-enter");
              void el.offsetWidth;
              el.style.animationDelay = `${(idx % 8) * 18}ms`;
              el.classList.add("desktop-refresh-enter");
            });
            setTimeout(() => {
              fresh.forEach((el) => {
                el.classList.remove("desktop-refresh-enter");
                el.style.animationDelay = "";
              });
            }, 600);
          },
          "fa-sync-alt",
        ),
      );
    });
  }

  currentSortMode() {
    const stored = os.storage.get(StorageKeys.desktopSortMode);
    return stored !== undefined && stored !== null && stored !== ""
      ? stored
      : "none";
  }

  async showBackgroundContextMenu(e) {
    showDynamicContextMenu(e, (menu, item, hr) => {
      menu.appendChild(
        item(
          "Open Wallpaper Engine",
          () => os.app.launch("wallpaperEngineApp"),
          "fa-paint-roller",
        ),
      );
      menu.appendChild(hr());
      menu.appendChild(item("Vanta.js Wallpapers", null, "fa-magic"));
      menu.appendChild(hr());

      vantaPresets.forEach((preset) => {
        menu.appendChild(
          item(
            preset.name,
            async () => {
              await SystemUtilities.setWallpaper(`vanta:${preset.id}`);
            },
            "fa-palette",
          ),
        );
      });

      menu.appendChild(hr());

      videos.forEach((videoUrl) => {
        const name = videoUrl
          .split("/")
          .pop()
          .replace(/\.\d+x\d+\.mp4$/, "")
          .replace(/-/g, " ");
        menu.appendChild(
          item(
            name,
            async () => {
              await SystemUtilities.setWallpaper(videoUrl);
            },
            "fa-film",
          ),
        );
      });
    });
  }

  async showNewContextMenu(e) {
    showDynamicContextMenu(e, (menu, item, hr) => {
      menu.appendChild(
        item(
          "Folder",
          async () => {
            await this.spawnInlineDesktopItem(false);
          },
          "fa-folder",
        ),
      );
      menu.appendChild(
        item(
          "Text",
          async () => {
            await this.spawnInlineDesktopItem(true);
          },
          "fa-file-alt",
        ),
      );
    });
  }

  async spawnInlineDesktopItem(isFile) {
    const defaultName = isFile ? "New File.txt" : "New Folder";
    const iconClass = isFile ? "fas fa-file" : "fas fa-folder";

    const icon = createElement("div");
    icon.className = "icon selectable is-renaming";
    icon.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;font-size:32px;color:var(--clrPrm);background:var(--surface-1);border:1px solid var(--glass-border);border-radius:8px;"><i class="${iconClass}"></i></div><div></div>`;
    this.desktopUI.positionHelper.snap(icon);
    this.desktopUI.desktop.appendChild(icon);

    const { wrap, input, errorTip } = this.createInlineInput(defaultName);
    icon.appendChild(wrap);

    const dotIdx = defaultName.lastIndexOf(".");
    input.focus();
    if (isFile && dotIdx > 0) input.setSelectionRange(0, dotIdx);
    else input.select();

    const showError = (msg) => {
      errorTip.textContent = msg;
      errorTip.style.display = "block";
      input.classList.add("error");
    };
    const clearError = () => {
      errorTip.style.display = "none";
      input.classList.remove("error");
    };

    let committed = false;
    const cancel = () => {
      if (committed) return;
      committed = true;
      icon.remove();
    };

    const commit = async () => {
      if (committed) return;
      const name = input.value.trim();
      if (!name) {
        cancel();
        return;
      }
      committed = true;
      try {
        if (isFile) {
          await os.fs.write(["Desktop", name], "");
          await this.desktopUI.createDesktopFileIcon(name);
        } else {
          await os.fs.mkdir(["Desktop", name]);
          await this.desktopUI.createFolderIcon(name);
        }
        icon.remove();
      } catch (err) {
        committed = false;
        const msg =
          err?.message !== undefined &&
          err.message !== null &&
          err.message !== ""
            ? err.message
            : "Could not create item.";
        showError(msg);
        input.focus();
      }
    };

    this.bindInlineInputEvents(input, commit, cancel, clearError);
  }

  createInlineInput(value) {
    const wrap = createElement("div");
    wrap.style.cssText =
      "position:absolute;left:50%;top:calc(var(--icon-img-s) + 10px);transform:translateX(-50%);width:160px;max-width:180px;min-width:120px;display:flex;flex-direction:column;gap:6px;z-index:10;";

    const input = createElement("input");
    input.type = "text";
    input.value = value;
    input.style.cssText =
      "padding:6px 8px;border-radius:6px;border:1px solid var(--clrPrm);background:var(--surface-1, rgba(20,20,30,0.95));color:var(--text-primary);font-size:12px;line-height:1.4;text-align:center;outline:none;width:100%;box-sizing:border-box;box-shadow:0 4px 16px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.08);";
    wrap.appendChild(input);

    const errorTip = createElement("div");
    errorTip.style.cssText =
      "color:var(--error);font-size:11px;text-align:center;display:none;word-break:break-word;overflow-wrap:anywhere;max-width:160px; background:rgba(0,0,0,0.75); padding:4px 6px; border-radius:4px;";
    wrap.appendChild(errorTip);

    return { wrap, input, errorTip };
  }

  bindInlineInputEvents(input, commit, cancel, clearError) {
    input.onkeydown = (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        commit();
      }
      if (ev.key === "Escape") {
        ev.preventDefault();
        cancel();
      }
    };
    input.onblur = () => {
      setTimeout(() => {
        if (document.activeElement !== input) {
          commit();
        }
      }, 100);
    };
    input.oninput = clearError;
  }

  startInlineDesktopRename(icon) {
    if (icon.classList.contains("is-renaming")) return;
    icon.classList.add("is-renaming");

    const maybeFirst = icon.firstElementChild;
    const maybeLast = icon.querySelector("div:last-child");
    if (
      maybeFirst &&
      maybeLast &&
      maybeFirst !== maybeLast &&
      !maybeFirst.querySelector("i, img, svg") &&
      maybeFirst.textContent.trim()
    ) {
      try {
        let targetForIcon = "";
        if (
          icon.dataset.fileName !== undefined &&
          icon.dataset.fileName !== ""
        ) {
          targetForIcon = icon.dataset.fileName;
        } else if (
          icon.dataset.folderName !== undefined &&
          icon.dataset.folderName !== ""
        ) {
          targetForIcon = icon.dataset.folderName;
        } else {
          targetForIcon = maybeLast.textContent.trim();
        }
        const tmp = document.createElement("div");
        tmp.innerHTML = buildFileIconHTML(targetForIcon, {
          size: 64,
          radius: 12,
        }).trim();
        const fresh = tmp.firstElementChild;
        if (fresh) maybeFirst.replaceWith(fresh);
      } catch {}
    }

    const labelDiv = icon.querySelector("div:last-child");
    let currentName = "";
    if (icon.dataset.app !== undefined && icon.dataset.app !== "") {
      if (icon.dataset.fileName !== undefined && icon.dataset.fileName !== "") {
        currentName = icon.dataset.fileName.replace(/\.desktop$/, "");
      } else if (labelDiv && labelDiv.textContent !== null) {
        const t = labelDiv.textContent.trim();
        currentName = t.length > 0 ? t : icon.dataset.app;
      } else {
        currentName = icon.dataset.app;
      }
    } else {
      if (
        icon.dataset.folderName !== undefined &&
        icon.dataset.folderName !== ""
      ) {
        currentName = icon.dataset.folderName;
      } else if (
        icon.dataset.fileName !== undefined &&
        icon.dataset.fileName !== ""
      ) {
        currentName = icon.dataset.fileName;
      } else if (labelDiv && labelDiv.textContent !== null) {
        currentName = labelDiv.textContent.trim();
      }
      if (currentName.endsWith(".desktop"))
        currentName = currentName.slice(0, -8);
    }
    if (labelDiv) labelDiv.style.display = "none";

    const { wrap, input, errorTip } = this.createInlineInput(currentName);
    icon.appendChild(wrap);

    const dotIdx = currentName.lastIndexOf(".");
    input.focus();
    if (dotIdx > 0) input.setSelectionRange(0, dotIdx);
    else input.select();

    const showError = (msg) => {
      errorTip.textContent = msg;
      errorTip.style.display = "block";
      input.classList.add("error");
    };
    const clearError = () => {
      errorTip.style.display = "none";
      input.classList.remove("error");
    };

    let committed = false;

    const cancel = () => {
      if (committed) return;
      committed = true;
      icon.classList.remove("is-renaming");
      wrap.remove();
      if (labelDiv) labelDiv.style.display = "";
    };

    const commit = async () => {
      if (committed) return;
      let newName = input.value.trim();
      if (!newName || newName === currentName) {
        cancel();
        return;
      }
      committed = true;
      try {
        if (icon.classList.contains("folder-icon")) {
          await this.desktopUI.fs.renameItem(
            "Desktop",
            currentName,
            newName,
            true,
          );
          icon.dataset.folderName = newName;
          if (labelDiv) {
            labelDiv.textContent = newName;
            labelDiv.title = newName;
          }
        } else if (icon.classList.contains("desktop-file-icon")) {
          const wasDesktop = currentName.endsWith(".desktop");
          if (wasDesktop && !newName.endsWith(".desktop")) {
            newName += ".desktop";
          }
          await this.desktopUI.fs.renameItem(
            "Desktop",
            currentName,
            newName,
            true,
          );
          icon.dataset.fileName = newName;
          const displayName = newName.endsWith(".desktop")
            ? newName.slice(0, -8)
            : newName;
          if (labelDiv) {
            labelDiv.textContent = displayName;
            labelDiv.title = displayName;
          }
        } else if (icon.dataset.app) {
          let newFile = newName;
          if (
            icon.dataset.fileName?.endsWith(".desktop") &&
            !newFile.endsWith(".desktop")
          ) {
            newFile += ".desktop";
          }
          if (icon.dataset.fileName) {
            await this.desktopUI.fs.renameItem(
              "Desktop",
              icon.dataset.fileName,
              newFile,
              true,
            );
            icon.dataset.fileName = newFile;
          }
          if (labelDiv) {
            labelDiv.textContent = newName;
            labelDiv.title = newName;
          }
        }
        const first = icon.firstElementChild;
        if (
          first &&
          first !== labelDiv &&
          !first.querySelector("i, img, svg") &&
          first.textContent.trim()
        ) {
          try {
            const targetForIcon =
              icon.dataset.fileName !== undefined &&
              icon.dataset.fileName !== ""
                ? icon.dataset.fileName
                : newName;
            const tmp = document.createElement("div");
            tmp.innerHTML = buildFileIconHTML(targetForIcon, {
              size: 64,
              radius: 12,
            }).trim();
            const fresh = tmp.firstElementChild;
            if (fresh) first.replaceWith(fresh);
          } catch {}
        }
        icon.classList.remove("is-renaming");
        wrap.remove();
        if (labelDiv) labelDiv.style.display = "";
      } catch (err) {
        committed = false;
        const msg =
          err?.message !== undefined &&
          err.message !== null &&
          err.message !== ""
            ? err.message
            : `"${newName}" already exists`;
        showError(msg);
        input.focus();
      }
    };

    this.bindInlineInputEvents(input, commit, cancel, clearError);
  }

  async addToArchive(path, name) {
    try {
      const isFolder = !name.includes(".") || (await this.isDirectory(path));

      const dirPath = path.length > 1 ? path.slice(0, -1) : ["Desktop"];
      const items = [{ name, path: dirPath, isFile: !isFolder }];

      const archiveName = isZipFile(name) ? name.slice(0, -4) : name;

      const result = await this.archiveExtractor.createArchive(items, {
        format: "zip",
        compressionLevel: 6,
        outputPath: ["Desktop"],
        archiveName,
      });

      if (result.success) {
        await this.desktopUI.createDesktopFileIcon(result.name);
      } else {
        throw new Error(result.error || "Failed to create archive");
      }
    } catch (err) {
      console.error("Archive error:", err);
      os.dialog.alert("Error", "Failed to create archive");
    }
  }

  async downloadItem(path, name, isFolder) {
    try {
      if (isFolder) {
        const items = [{ name, path: ["Desktop"], isFile: false }];

        const archiveName = isZipFile(name) ? name.slice(0, -4) : name;

        const result = await this.archiveExtractor.createArchive(items, {
          format: "zip",
          compressionLevel: 6,
          outputPath: ["Desktop"],
          archiveName,
        });

        if (result.success) {
          const content = await os.fs.read(["Desktop", result.name], {
            encoding: "binary",
          });
          const blob = new Blob([content], { type: "application/zip" });
          downloadBlob(blob, result.name);
          await os.fs.delete(["Desktop"], result.name);
        } else {
          throw new Error(result.error || "Failed to create archive");
        }
      } else {
        const content = await os.fs.read(path, { encoding: "binary" });
        const blob = new Blob([content], { type: "application/octet-stream" });
        downloadBlob(blob, name);
      }
    } catch (err) {
      console.error("Download error:", err);
      os.dialog.alert("Error", "Failed to download item");
    }
  }

  async isDirectory(path) {
    try {
      const dirPath = path.slice(0, -1);
      const fileName = path[path.length - 1];
      const folder = await os.fs.readdir(dirPath);
      const item = folder[fileName];
      return item && !item.type;
    } catch {
      return false;
    }
  }
}
