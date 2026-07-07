import { fileKindFromName, getExt } from "../fileDisplay.js";
import { formatSize } from "../utils/utils.js";
import { FileKind } from "../shared/fileKindDetector.js";
import { os } from "../framework.js";

const TYPE_LABELS = {
  [FileKind.TEXT]: "TEXT",
  [FileKind.IMAGE]: "IMAGE",
  [FileKind.VIDEO]: "VIDEO",
  [FileKind.AUDIO]: "AUDIO",
  [FileKind.ROM]: "ROM",
  [FileKind.OTHER]: "FILE"
};

const SHOW_DELAY = 500;

let tooltipEl = null;
let showTimeout = null;

export function scheduleFileTooltip(event, dirPath, name, isFolder) {
  if (isFolder) return;
  cancelPending();
  const cx = event.clientX;
  const cy = event.clientY;
  showTimeout = setTimeout(() => {
    showTimeout = null;
    showTooltip(cx, cy, dirPath, name);
  }, SHOW_DELAY);
}

export function scheduleAppTooltip(event, title) {
  cancelPending();
  const cx = event.clientX;
  const cy = event.clientY;
  showTimeout = setTimeout(() => {
    showTimeout = null;
    showAppTooltip(cx, cy, title);
  }, SHOW_DELAY);
}

export function hideFileTooltip() {
  cancelPending();
  if (tooltipEl) {
    tooltipEl.remove();
    tooltipEl = null;
  }
}

function cancelPending() {
  if (showTimeout) {
    clearTimeout(showTimeout);
    showTimeout = null;
  }
}

function buildRow(label, value) {
  const row = document.createElement("div");
  row.className = "ft-row";
  const l = document.createElement("span");
  l.className = "ft-label";
  l.textContent = label + ":";
  row.appendChild(l);
  row.appendChild(document.createTextNode(" " + value));
  return row;
}

function showAppTooltip(cx, cy, title) {
  hideFileTooltip();
  tooltipEl = document.createElement("div");
  tooltipEl.className = "file-tooltip";
  tooltipEl.appendChild(buildRow("TYPE", "APPLICATION"));
  tooltipEl.appendChild(buildRow("NAME", title));
  document.body.appendChild(tooltipEl);
  positionTooltip(cx, cy);
}

function showTooltip(cx, cy, dirPath, name) {
  hideFileTooltip();
  tooltipEl = document.createElement("div");
  tooltipEl.className = "file-tooltip";

  tooltipEl.appendChild(buildRow("TYPE", getTypeLabel(name)));

  const sizeRow = buildRow("SIZE", "Loading...");
  sizeRow.className = "ft-row ft-size";
  tooltipEl.appendChild(sizeRow);
  loadSize(dirPath, name, sizeRow);

  tooltipEl.appendChild(buildRow("DATE MODIFIED", new Date().toLocaleString()));

  document.body.appendChild(tooltipEl);
  positionTooltip(cx, cy);
}

async function loadSize(dirPath, name, rowEl) {
  try {
    const meta = await os.fs.getMetadata(dirPath, name);
    const text = meta.size != null ? formatSize(meta.size) : "Unknown";
    const label = rowEl.querySelector(".ft-label");
    rowEl.textContent = "";
    if (label) rowEl.appendChild(label);
    rowEl.appendChild(document.createTextNode(" " + text));
  } catch {
    const label = rowEl.querySelector(".ft-label");
    rowEl.textContent = "";
    if (label) rowEl.appendChild(label);
    rowEl.appendChild(document.createTextNode(" Unknown"));
  }
}

function getTypeLabel(name) {
  const kind = fileKindFromName(name);
  const label = TYPE_LABELS[kind];
  if (label) return label;
  const ext = getExt(name);
  return ext ? ext.toUpperCase() : "FILE";
}

function positionTooltip(cx, cy) {
  const rect = tooltipEl.getBoundingClientRect();
  let x = cx + 12;
  let y = cy + 12;

  if (x + rect.width > window.innerWidth - 8) {
    x = cx - rect.width - 12;
  }
  if (y + rect.height > window.innerHeight - 8) {
    y = cy - rect.height - 12;
  }

  x = Math.max(4, x);
  y = Math.max(4, y);

  tooltipEl.style.left = x + "px";
  tooltipEl.style.top = y + "px";
}
