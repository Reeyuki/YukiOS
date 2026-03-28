export function camelize(str) {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, function (word, index) {
      return index === 0 ? word.toLowerCase() : word.toUpperCase();
    })
    .replace(/\s+/g, "");
}

export const isImageFile = (file) => typeof file === "string" && /\.(png|jpg|jpeg|gif|webp|svg|ico)$/i.test(file);

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

export function isTextFile(name) {
  const lower = name.toLowerCase();
  return [
    ".txt",
    ".md",
    ".js",
    ".json",
    ".html",
    ".css",
    ".xml",
    ".csv",
    ".ts",
    ".py",
    ".sh",
    ".yaml",
    ".yml",
    ".toml",
    ".ini",
    ".cfg",
    ".log",
    ".sql"
  ].some((ext) => lower.endsWith(ext));
}

export function mimeFromExt(ext) {
  const map = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    bmp: "image/bmp",
    ico: "image/x-icon"
  };
  return map[ext] || "image/png";
}

export function bytesToStoreContent(fileName, bytes) {
  if (isTextFile(fileName)) {
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {}
  }

  const lower = fileName.toLowerCase();
  const ext = lower.split(".").pop();
  const b64 = btoa(String.fromCharCode(...bytes));

  if (isImageFile(fileName)) {
    const mime = mimeFromExt(ext);
    return `data:${mime};base64,${b64}`;
  }

  return `data:application/octet-stream;base64,${b64}`;
}

export function tarStr(bytes, offset, length) {
  let str = "";
  for (let i = offset; i < offset + length; i++) {
    if (bytes[i] === 0) break;
    str += String.fromCharCode(bytes[i]);
  }
  return str;
}

export function decodeFileContent(content) {
  if (!content) return "";

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
      if (n) nameToIsFile[n] = el.dataset.isFile === "true";
    });
  }

  return allSelected.map((n) => ({
    element: null,
    data: { name: n, path: currentPath, isFile: nameToIsFile[n] ?? isFile }
  }));
}

export function isWindowFocused(winId, lastMousePos) {
  const winEl = document.getElementById(winId);
  if (!winEl) return false;
  const rect = winEl.getBoundingClientRect();
  const mouseOver =
    lastMousePos.x >= rect.left &&
    lastMousePos.x <= rect.right &&
    lastMousePos.y >= rect.top &&
    lastMousePos.y <= rect.bottom;
  return mouseOver || winEl.contains(document.activeElement);
}
