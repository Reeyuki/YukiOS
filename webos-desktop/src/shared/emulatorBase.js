import { BusEvents } from "../core/EventBus.js";
import { os } from "../os/index.js";

export function normalizePath(path) {
  if (Array.isArray(path)) return path;
  if (typeof path === "string") return path.split("/").filter(Boolean);
  return Object.values(path ?? {}).filter((v) => typeof v === "string");
}

export function fileNameToDisplayName(name) {
  return name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function buildLoadingStateHTML({ winId, iconClass, wrapperClass, textClass, logClass, displayName }) {
  return `
    <div id="${winId}-inner" class="${wrapperClass || "emu-state emu-load-wrap"}">
      <i class="${iconClass}"></i>
      <div class="${textClass || "emu-state-text"} emu-state-text--accent">Starting <strong>${displayName}</strong>…</div>
      <div id="${winId}-log" class="${logClass || "emu-state-text--muted"}"></div>
    </div>`;
}

export function buildErrorHTML({
  msg,
  wrapperClass = "emu-state emu-state--error",
  iconClass = "fa-solid fa-triangle-exclamation emu-state-icon",
  textClass = "emu-state-text emu-state--error"
}) {
  return `<div class="${wrapperClass}"><i class="${iconClass}"></i><div class="${textClass}">${msg}</div></div>`;
}

export function setLog(logEl, msg) {
  if (logEl) logEl.textContent = msg;
}

export async function saveEmulatorFile({ file, dir, kind = "other", icon, extraDirs = [], emitChanged = false }) {
  const blob = new Blob([await file.arrayBuffer()], { type: file.type || "application/octet-stream" });
  await os.fs.writeBinaryFile(dir, file.name, blob, kind, icon);
  for (const extra of extraDirs) {
    await os.fs.writeBinaryFile(extra.dir, file.name, blob, extra.kind ?? kind, icon);
  }
  if (emitChanged) os.events.emit(BusEvents.FILE_CHANGED, { path: file.name });
  return blob;
}

export async function renderEmulatorFileList({
  container,
  dir,
  filter,
  emptyHTML,
  cardHTML,
  cardSelector,
  deleteBtnSelector,
  deleteAction,
  onCardClick,
  onReload
}) {
  if (!container) return;
  try {
    await os.fs.mkdir(dir).catch(() => {});
    const entries = await os.fs.readdir(dir).catch(() => null);
    const files = Array.isArray(entries)
      ? entries
      : Object.keys(entries ?? {}).filter((k) => entries?.[k]?.type === "file");
    const matched = files.filter((f) => !f.startsWith(".") && filter(f));
    if (matched.length === 0) {
      container.innerHTML = emptyHTML;
      return;
    }
    container.innerHTML = matched.map((f) => cardHTML(f)).join("");
    container.querySelectorAll(cardSelector).forEach((card) => {
      card.addEventListener("click", (e) => {
        if (e.target.closest(deleteBtnSelector)) return;
        onCardClick(card.dataset.userFile);
      });
    });
    container.querySelectorAll(deleteBtnSelector).forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await deleteAction(btn.dataset.file);
        await onReload();
      });
    });
  } catch {}
}

function defaultSpinner(count) {
  return `<i class="fa-solid fa-spinner fa-spin emu-state-icon"></i><div class="emu-state-text">Saving ${count} file(s)…</div>`;
}

function defaultSuccess(count) {
  return `<i class="fa-solid fa-circle-check emu-state-icon"></i><div class="emu-state-text">Saved ${count} file(s)!</div>`;
}

function defaultError(msg) {
  return `<div class="emu-state emu-state--error"><i class="fa-solid fa-triangle-exclamation emu-state-icon"></i><div class="emu-state-text emu-state--error">${msg}</div></div>`;
}

export async function handleEmulatorUpload({
  zone,
  files,
  dir,
  kind = "other",
  icon,
  extraDirs = [],
  emitChanged = false,
  spinnerHTML,
  successHTML,
  errorHTML,
  onSaved,
  onReload
}) {
  const originalHTML = zone.innerHTML;
  const count = files.length;
  zone.innerHTML = spinnerHTML || defaultSpinner(count);
  try {
    for (const file of files) {
      await saveEmulatorFile({ file, dir, kind, icon, extraDirs, emitChanged });
    }
    onSaved?.();
    zone.innerHTML = successHTML || defaultSuccess(count);
    setTimeout(() => {
      zone.innerHTML = originalHTML;
      onReload?.();
    }, 1500);
  } catch (err) {
    zone.innerHTML = errorHTML ? errorHTML(err.message) : defaultError(err.message);
    setTimeout(() => {
      zone.innerHTML = originalHTML;
    }, 2500);
  }
}
