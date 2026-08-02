import { mimeFromName } from "./fileKindDetector.js";
import { formatSize } from "../utils/utils.js";

const EXT_MIME_MAP = {
  html: "text/html",
  htm: "text/html",
  xhtml: "application/xhtml+xml",
  txt: "text/plain",
  text: "text/plain",
  log: "text/plain",
  ini: "text/plain",
  conf: "text/plain",
  desktop: "text/x-desktop",
  md: "text/markdown",
  markdown: "text/markdown",
  js: "text/javascript",
  mjs: "text/javascript",
  cjs: "text/javascript",
  css: "text/css",
  json: "application/json",
  xml: "text/xml",
  yaml: "text/yaml",
  yml: "text/yaml",
  csv: "text/csv",
  tsv: "text/tab-separated-values",
  sh: "text/x-sh",
  py: "text/x-python",
  rs: "text/x-rust",
  java: "text/x-java",
  c: "text/x-c",
  h: "text/x-c",
  cpp: "text/x-c",
  hpp: "text/x-c",
  ts: "text/typescript",
  wasm: "application/wasm",
  svg: "image/svg+xml"
};

export function splitPath(pathStr) {
  if (!pathStr || pathStr === "/") return [];
  return String(pathStr).split("/").filter(Boolean);
}

export function joinPath(segments) {
  return segments.join("/");
}

export function getMimeType(name) {
  const ext = String(name).toLowerCase().split(".").pop();
  if (EXT_MIME_MAP[ext]) return EXT_MIME_MAP[ext];
  const detected = mimeFromName(name);
  if (detected && detected !== "application/octet-stream") return detected;
  return "application/octet-stream";
}

export function isDirEntry(entry) {
  if (!entry) return false;
  return entry.type === "directory" || !entry.type;
}

export function isTextContentType(mime) {
  if (!mime) return true;
  if (mime.startsWith("text/")) return true;
  return /json|javascript|xml|x-sh|wasm|manifest|yaml/.test(mime);
}

export function isVirtualFsInput(input) {
  const t = String(input || "").trim();
  if (!t) return false;
  if (t.startsWith("fs://") || t.startsWith("file://")) return true;
  if (t.startsWith("/")) return true;
  return false;
}

export function isLocalhostInput(input) {
  const t = String(input || "").trim();
  return /^(https?:\/\/)?(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?(\/|$)/i.test(t);
}

export function parseLocalhostTarget(input) {
  const t = String(input || "").trim();
  if (!t) return null;
  let url;
  try {
    url = new URL(t.startsWith("http") ? t : "http://" + t);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (host !== "localhost" && host !== "127.0.0.1" && host !== "0.0.0.0") return null;
  const port = url.port ? parseInt(url.port, 10) : 80;
  return { port, path: decodeURIComponent(url.pathname || "/") + (url.search || "") };
}

export function parseLocalTarget(input) {
  const t = String(input || "").trim();
  if (!t) return null;
  const localhost = parseLocalhostTarget(t);
  if (localhost) return { kind: "port", port: localhost.port, path: localhost.path };
  let pathStr = t;
  if (pathStr.startsWith("fs://")) pathStr = pathStr.slice(5);
  else if (pathStr.startsWith("file://")) pathStr = pathStr.slice(7);
  else if (pathStr.startsWith("http://") || pathStr.startsWith("https://")) return null;
  pathStr = pathStr.split("?")[0].split("#")[0];
  if (!pathStr.startsWith("/")) return null;
  return { kind: "fs", path: pathStr.replace(/^\/+/, "") };
}

export function readOsTheme() {
  const computed = getComputedStyle(document.documentElement);
  const get = (name, fallback) => {
    const value = computed.getPropertyValue(name).trim();
    return value || fallback;
  };
  return {
    brand: get("--brand", "#8b5cf6"),
    text: get("--text-primary", "#f2f2f7"),
    textMuted: get("--text-secondary", "#a1a1b0"),
    bg: get("--bg-primary", "#12121a"),
    surface: get("--surface-1", "#1d1d2a"),
    surfaceHover: get("--surface-hover", "#262636"),
    border: get("--glass-border", "rgba(255,255,255,0.1)"),
    error: get("--error", "#ef4444")
  };
}

export function buildFsInterceptScript(base) {
  return `<script>
(function() {
  var base = ${JSON.stringify(base)};
  function resolve(href) {
    try { return new URL(href, base).href; } catch (e) { return null; }
  }
  document.addEventListener('click', function(e) {
    var anchor = e.target.closest('a');
    if (!anchor) return;
    var href = anchor.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) return;
    if (anchor.target === '_blank') return;
    var resolved = resolve(href);
    if (!resolved) return;
    e.preventDefault();
    e.stopPropagation();
    window.parent.postMessage({ type: 'scram-local-nav', url: resolved }, '*');
  }, true);
  document.addEventListener('submit', function(e) {
    var form = e.target;
    var action = form.getAttribute('action') || base;
    var resolved = resolve(action);
    if (!resolved) return;
    e.preventDefault();
    var params = new URLSearchParams(new FormData(form)).toString();
    var method = (form.method || 'get').toLowerCase();
    var finalUrl = method === 'post' ? resolved : (resolved + (resolved.indexOf('?') >= 0 ? '&' : '?') + params);
    window.parent.postMessage({ type: 'scram-local-nav', url: finalUrl }, '*');
  }, true);
})();
<\/script>`;
}

const FOLDER_ICON = '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M1.5 3.5A1.5 1.5 0 0 1 3 2h3.586a1.5 1.5 0 0 1 1.06.44l1.293 1.293a1.5 1.5 0 0 0 1.06.44H13a1.5 1.5 0 0 1 1.5 1.5v6.79a1.5 1.5 0 0 1-1.5 1.5H3a1.5 1.5 0 0 1-1.5-1.5V3.5z"/></svg>';

const FILE_ICON = '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M3.5 1.5A1.5 1.5 0 0 1 5 0h4.586a1.5 1.5 0 0 1 1.06.44l3.914 3.914a1.5 1.5 0 0 1 .44 1.06V12.5a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5v-11z"/></svg>';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildDirectoryHtml(pathStr, entries, hrefBuilder, options = {}) {
  const theme = options.theme || readOsTheme();
  const base = options.base || "fs:///" + (pathStr ? pathStr + "/" : "");
  const builder = hrefBuilder || ((name, isDir) => encodeURIComponent(name) + (isDir ? "/" : ""));
  const segments = splitPath(pathStr);
  const rows = [];
  if (segments.length > 0) {
    rows.push(
      '<div class="row row-parent"><a class="entry-link" href="' +
        escapeHtml(builder("..", true)) +
        '"><span class="entry-icon dir">' +
        FOLDER_ICON +
        '</span><span class="entry-name">..</span></a><span class="entry-kind">parent directory</span><span class="entry-size"></span><span class="entry-date"></span></div>'
    );
  }
  const names = Object.keys(entries).sort((a, b) => {
    const ea = entries[a];
    const eb = entries[b];
    const da = isDirEntry(ea);
    const db = isDirEntry(eb);
    if (da !== db) return da ? -1 : 1;
    return a.localeCompare(b);
  });
  for (const name of names) {
    const entry = entries[name];
    const isDir = isDirEntry(entry);
    const size = isDir ? "" : formatSize(entry.size ?? 0);
    const kind = isDir ? "directory" : entry.kind || "file";
    rows.push(
      '<div class="row"><a class="entry-link" href="' +
        escapeHtml(builder(name, isDir)) +
        '"><span class="entry-icon ' +
        (isDir ? "dir" : "file") +
        '">' +
        (isDir ? FOLDER_ICON : FILE_ICON) +
        '</span><span class="entry-name">' +
        escapeHtml(name) +
        (isDir ? "/" : "") +
        "</span></a><span class=\"entry-kind\">" +
        escapeHtml(kind) +
        '</span><span class="entry-size">' +
        escapeHtml(size) +
        '</span><span class="entry-date">—</span></div>'
    );
  }
  const crumbs = ['<a class="crumb" href="/">home</a>'];
  segments.forEach((segment, index) => {
    crumbs.push(
      '<span class="crumb-sep">/</span><a class="crumb" href="/' +
        segments.slice(0, index + 1).join("/") +
        '">' +
        escapeHtml(segment) +
        "</a>"
    );
  });
  return (
    "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Index of /" +
    escapeHtml(pathStr) +
    '</title><style>body{margin:0;font-family:system-ui,-apple-system,sans-serif;background:' +
    theme.bg +
    ";color:" +
    theme.text +
    ";font-size:14px;padding:0 0 40px 0}.header{display:flex;align-items:center;gap:10px;padding:16px 22px;border-bottom:1px solid " +
    theme.border +
    ";background:" +
    theme.surface +
    "}.header .icon{color:" +
    theme.brand +
    "}.header h1{font-size:15px;font-weight:600;margin:0;flex:1}.crumbs{display:flex;align-items:center;gap:4px;padding:10px 22px;flex-wrap:wrap;font-size:12px}.crumb{color:" +
    theme.brand +
    ";text-decoration:none;cursor:pointer}.crumb:hover{text-decoration:underline}.crumb-sep{color:" +
    theme.textMuted +
    '}.listing{display:flex;flex-direction:column}.row{display:flex;align-items:center;gap:14px;padding:7px 22px;border-bottom:1px solid ' +
    theme.border +
    ";min-width:0}.row:hover{background:" +
    theme.surfaceHover +
    "}.row-parent{opacity:.8}.entry-link{display:flex;align-items:center;gap:10px;flex:1;min-width:0;color:" +
    theme.text +
    ";text-decoration:none;cursor:pointer}.entry-link:hover{color:" +
    theme.brand +
    "}.entry-icon{display:inline-flex;align-items:center;color:" +
    theme.brand +
    ";flex-shrink:0}.entry-icon.file{color:" +
    theme.textMuted +
    "}.entry-name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.entry-kind,.entry-size,.entry-date{color:" +
    theme.textMuted +
    ";font-size:12px;width:110px;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.entry-size{width:80px;text-align:right}.entry-date{width:auto;min-width:80px}</style></head><body><div class=\"header\"><span class=\"icon\">" +
    FOLDER_ICON +
    "</span><h1>Index of /" +
    escapeHtml(pathStr) +
    "</h1></div><div class=\"crumbs\">" +
    crumbs.join("") +
    "</div><div class=\"listing\">" +
    rows.join("") +
    "</div>" +
    buildFsInterceptScript(base) +
    "</body></html>"
  );
}
