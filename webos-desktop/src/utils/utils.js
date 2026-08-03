import { os, MODES, StorageKeys } from "../framework.js";

export { isTextFile, mimeFromExt } from "../shared/fileKindDetector.js";

export function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function camelize(str) {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, function (word, index) {
      return index === 0 ? word.toLowerCase() : word.toUpperCase();
    })
    .replace(/\s+/g, "");
}

export function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
}

export function pluralize(count, singular, plural = singular + "s") {
  return count === 1 ? singular : plural;
}

export function isArchiveFile(name) {
  const lower = name.toLowerCase();
  return [".zip", ".gz", ".tgz", ".tar", ".tar.gz", ".tar.bz2", ".tar.xz", ".rar", ".7z", ".bz2", ".xz"].some((ext) =>
    lower.endsWith(ext)
  );
}

export function archiveBaseName(name) {
  const lower = name.toLowerCase();
  const suffixes = [".tar.gz", ".tar.bz2", ".tar.xz", ".tgz", ".zip", ".gz", ".bz2", ".xz", ".tar", ".rar", ".7z"];
  for (const suffix of suffixes) {
    if (lower.endsWith(suffix)) return name.slice(0, name.length - suffix.length);
  }
  return name;
}

export function tarStr(bytes, offset, length) {
  let str = "";
  for (let i = offset; i < offset + length; i++) {
    if (bytes[i] === 0) break;
    str += String.fromCharCode(bytes[i]);
  }
  return str;
}

export async function decodeFileContent(content) {
  if (!content) return "";

  if (content instanceof Blob) {
    return await content.text();
  }

  if (typeof content !== "string") return String(content);

  if (content.startsWith("data:")) {
    try {
      const base64Match = content.match(/^data:[^;]+;base64,(.+)$/);
      if (base64Match?.[1]) return atob(base64Match[1]);

      const plainMatch = content.match(/^data:[^,]+,(.+)$/);
      if (plainMatch?.[1]) return decodeURIComponent(plainMatch[1]);
    } catch (err) {
      console.error("Failed to decode data URL:", err);
      return content;
    }
  }

  return content;
}

export function splitWebkitPath(file) {
  const parts = (file.webkitRelativePath || file.name).split("/");
  const fileName = parts.pop();
  return { parts, fileName };
}

export function buildClipboardIcons(selectedItems, itemName, isFile, view, currentPath) {
  const allSelected = selectedItems.size > 1 && selectedItems.has(itemName) ? [...selectedItems] : [itemName];

  const nameToIsFile = {};
  if (view) {
    [...view.querySelectorAll(".file-item")].forEach((el) => {
      const n = el.querySelector("span")?.textContent;
      if (n) nameToIsFile[n] = parseBool(el.dataset.isFile);
    });
  }

  return allSelected.map((n) => ({
    element: null,
    data: { name: n, path: currentPath, isFile: nameToIsFile[n] ?? isFile }
  }));
}

export function isWindowFocused(winId) {
  const winEl = document.getElementById(winId);
  if (!winEl) return false;
  return winEl.contains(document.activeElement);
}

export function rectsIntersect(a, b) {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

export function sanitizeTitle(title) {
  if (title === "[object Object]") return "Window";
  return title;
}

export function isTaskbarTop() {
  if (os.modes.isActive(MODES.MAC)) return true;
  const taskbar = document.getElementById("taskbar");
  return taskbar && taskbar.classList.contains("position-top");
}

export function parseBool(val, defaultValue = false) {
  if (val === true || val === "true" || val === "1") return true;
  if (val === false || val === "false" || val === "0") return false;
  return defaultValue;
}

export function getSetting(key, defaultValue) {
  const storageKey = StorageKeys[key];
  if (!storageKey) return defaultValue;
  const val = os.storage.get(storageKey);
  if (val === null) return defaultValue;
  if (val === "true") return true;
  if (val === "false") return false;
  const num = Number(val);
  if (!isNaN(num)) return num;
  return val;
}

export function getRawSetting(key, fallback) {
  return os.storage.get(key) ?? fallback;
}

export function resolveAppName(appId) {
  if (!appId) return "Unknown App";
  const info = os.app.getAppInfo(appId);
  if (info?.title) return info.title;
  const allApps = os.app.getAllApps();
  const lower = String(appId).toLowerCase();
  const matchedId = Object.keys(allApps).find((id) => id.toLowerCase() === lower);
  if (matchedId && allApps[matchedId]?.title) return allApps[matchedId].title;
  return appId.charAt(0).toUpperCase() + appId.slice(1).replace(/([a-z])([A-Z])/g, "$1 $2");
}

export function resolveAppId(appId) {
  if (!appId) return null;
  const allApps = os.app.getAllApps();
  if (allApps[appId]) return appId;
  const lower = String(appId).toLowerCase();
  const matchedId = Object.keys(allApps).find((id) => id.toLowerCase() === lower);
  return matchedId || null;
}

export function resolveAppIcon(appId) {
  if (!appId) return null;
  const info = os.app.getAppInfo(appId);
  if (info?.icon) return info.icon;
  const allApps = os.app.getAllApps();
  const lower = String(appId).toLowerCase();
  const matchedId = Object.keys(allApps).find((id) => id.toLowerCase() === lower);
  return allApps[matchedId]?.icon || null;
}

export function timeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function debounce(fn, delay = 300) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

export function throttle(fn, limit = 200) {
  let lastTime = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastTime >= limit) {
      lastTime = now;
      fn.apply(this, args);
    }
  };
}

export function generateId(prefix = "") {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function truncate(str, maxLength) {
  if (typeof str !== "string" || str.length <= maxLength) return str;
  return str.slice(0, maxLength - 1) + "...";
}

export function titleCase(str) {
  if (typeof str !== "string" || str.length === 0) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function base64ToBlob(dataUrl) {
  const [meta, b64] = dataUrl.split(",");
  const mimeMatch = meta.match(/data:([^;]+)/);
  const mime = (mimeMatch && mimeMatch[1]) || "application/octet-stream";
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
