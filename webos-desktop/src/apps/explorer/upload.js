import { BusEvents } from "../../core/EventBus.js";
import { os } from "../../framework.js";
import { FileKind } from "../../shared/fileKindDetector.js";
import { $, setStyle } from "../../shared/domUtils.js";
import { resolveIconUrl } from "../../shared/assetResolver.js";
import {
  fileKindFromName,
  isImageFile,
  isOfficeFile,
  isWallpaperPath,
  readFileAsDataURL,
  readFileAsText,
  resolveFileIcon,
  isExeFile,
  isSwfFile,
  isZipFile,
  isISOFile
} from "../../fileDisplay.js";
import { showConflictDialog } from "../../shared/conflictDialog.js";
import { splitWebkitPath, pluralize } from "../../utils/utils.js";
import { Achievements } from "../../achievements.js";
import { AppSource } from "../../AppSource.js";

const BINARY_OFFICE_EXTS = [".pdf", ".docx", ".xlsx", ".xls", ".pptx", ".ppt"];
const ARCHIVE_EXTS = [".zip", ".gz", ".tgz", ".tar", ".rar", ".7z", ".bz2", ".xz"];

function isBinaryWrite(kind, isBinaryOffice, isBinary) {
  return kind === FileKind.VIDEO || isBinaryOffice || isBinary;
}

async function resolveFilePayload(file, name) {
  const kind = fileKindFromName(name);
  const icon = resolveFileIcon(name);
  const isBinaryOffice =
    isOfficeFile(name) && BINARY_OFFICE_EXTS.includes(name.substring(name.lastIndexOf(".")).toLowerCase());
  const isBinary =
    isBinaryOffice ||
    ARCHIVE_EXTS.some((ext) => name.toLowerCase().endsWith(ext)) ||
    kind === FileKind.IMAGE ||
    kind === FileKind.AUDIO ||
    kind === FileKind.VIDEO ||
    kind === FileKind.ROM ||
    isExeFile(name) ||
    isSwfFile(name) ||
    isZipFile(name) ||
    isISOFile(name);
  let content;
  if (isBinaryWrite(kind, isBinaryOffice, isBinary)) {
    content = file;
  } else {
    try {
      content = await readFileAsText(file);
    } catch {
      content = await readFileAsDataURL(file);
    }
  }
  return { kind, content, icon, isBinaryOffice, isBinary };
}

async function saveFilePayload(targetPath, name, kind, content, icon, isBinaryOffice = false, isBinary = false) {
  os.events.emit(BusEvents.DESKTOP_ICON_ADDED, { name, kind });
  if (isBinaryWrite(kind, isBinaryOffice, isBinary)) {
    await os.fs.writeBinaryFile(targetPath, name, content, kind, icon);
  } else {
    await os.fs.createFile(targetPath, name, content, kind, icon);
  }
}

async function replaceFilePayload(targetPath, name, kind, content, icon, isBinaryOffice = false, isBinary = false) {
  if (isBinaryWrite(kind, isBinaryOffice, isBinary)) {
    await os.fs.deleteBinaryFile(targetPath, name).catch(() => {});
    await os.fs.writeBinaryFile(targetPath, name, content, kind, icon);
  } else {
    await os.fs.updateFile(targetPath, name, content, { kind, icon });
  }
}

async function resolveConflictAction(name, applyToAllAction) {
  if (applyToAllAction) return { action: applyToAllAction, applyToAll: false };
  return showConflictDialog(name);
}

export async function handleFileUpload(explorer, files, isFolder, win, inst) {
  if (!files.length) return;
  const targetPath = inst ? inst.currentPath : ["Desktop"];
  const progressEl = inst ? $(`#${inst.winId}-upload-progress`, win) : null;
  if (progressEl) setStyle(progressEl, { display: "block" });

  let applyToAllAction = null;
  let uploadedCount = 0;
  let skippedCount = 0;

  try {
    let flatFiles;

    if (isFolder) {
      const pathMap = new Map();
      for (const file of files) {
        const { parts, fileName } = splitWebkitPath(file);
        const subPath = [...targetPath, ...parts];
        const key = subPath.join("/");
        if (!pathMap.has(key)) pathMap.set(key, { path: subPath, files: [] });
        pathMap.get(key).files.push({ file, fileName });
      }
      flatFiles = [];
      const sortedEntries = [...pathMap.values()].sort((a, b) => a.path.length - b.path.length);
      for (const { path, files: grouped } of sortedEntries) {
        await os.fs.mkdir(path);
        for (const { file, fileName } of grouped) {
          flatFiles.push({ file, targetPath: path, name: fileName });
        }
      }
    } else {
      flatFiles = files.map((file) => ({ file, targetPath: targetPath, name: file.name }));
    }

    for (const { file, targetPath, name } of flatFiles) {
      if (isWallpaperPath(targetPath)) {
        const { kind, content, icon } = await resolveFilePayload(file, name);
        await saveToWallpapers(explorer, name, content, kind, icon);
        uploadedCount++;
        continue;
      }

      const existingPath = explorer.fs.join(explorer.fs.resolveUserPath(targetPath), name);
      const exists = await os.fs.exists(existingPath);
      const payload = await resolveFilePayload(file, name);

      if (!exists) {
        await saveFilePayload(
          targetPath,
          name,
          payload.kind,
          payload.content,
          payload.icon,
          payload.isBinaryOffice,
          payload.isBinary
        );
        uploadedCount++;
        continue;
      }

      const result = await resolveConflictAction(name, applyToAllAction);
      if (result.applyToAll) applyToAllAction = result.action;

      if (result.action === "skip") {
        skippedCount++;
        continue;
      }

      if (result.action === "replace") {
        await replaceFilePayload(
          targetPath,
          name,
          payload.kind,
          payload.content,
          payload.icon,
          payload.isBinaryOffice,
          payload.isBinary
        );
      } else {
        await saveFilePayload(
          targetPath,
          name,
          payload.kind,
          payload.content,
          payload.icon,
          payload.isBinaryOffice,
          payload.isBinary
        );
      }
      uploadedCount++;
    }

    const parts = [];
    if (uploadedCount > 0) parts.push(`${uploadedCount} ${pluralize(uploadedCount, "file")} uploaded`);
    if (skippedCount > 0) parts.push(`${skippedCount} skipped`);
    if (parts.length) os.notify.send(parts.join(", "));
  } finally {
    if (progressEl) setStyle(progressEl, { display: "none" });
  }

  if (inst) await explorer.renderInstance(inst);
}

export async function uploadSingleFile(explorer, file, targetPath, overrideName = null) {
  const name = overrideName || file.name;
  const { kind, content, icon, isBinaryOffice, isBinary } = await resolveFilePayload(file, name);
  if (isWallpaperPath(targetPath)) {
    await saveToWallpapers(explorer, name, content, kind, icon);
    return;
  }
  await saveFilePayload(targetPath, name, kind, content, icon, isBinaryOffice, isBinary);
}

export async function saveToWallpapers(explorer, name, content, kind, icon) {
  os.events.emit(BusEvents.ACHIEVEMENT_TRIGGER, { achievementId: Achievements.PersonalSpace });

  const wallpapersPath = ["Pictures", "Wallpapers"];
  await os.fs.mkdir(wallpapersPath);
  const safeIcon = kind === FileKind.IMAGE ? "@content" : icon || resolveIconUrl("static/icons/file.webp");
  await explorer.fs.createFile(wallpapersPath, name, content, kind, safeIcon);
}

export function triggerFileUpload(explorer, inst) {
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  input.addEventListener("change", async () => {
    const files = Array.from(input.files);
    if (!files.length) return;
    const win = document.getElementById(inst.winId);
    await handleFileUpload(explorer, files, false, win, inst);
  });
  input.click();
}
