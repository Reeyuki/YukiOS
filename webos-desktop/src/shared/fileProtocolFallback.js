import { readOsTheme } from "./virtualFsNet.js";

export function isFileProtocol() {
  try {
    return location.protocol === "file:" || window.location.origin === "null" || !window.location.origin;
  } catch {
    return false;
  }
}

export function buildFileProtocolFallbackHtml(appId, targetUrl) {
  const theme = readOsTheme();
  const pagesUrl = `https://yukios.pages.dev?app=${encodeURIComponent(String(appId || "browserApp"))}`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Not available offline</title><style>
  *{box-sizing:border-box}body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:${theme.bg};color:${theme.text};font-family:system-ui,-apple-system,sans-serif;padding:20px}
  .card{width:100%;max-width:520px;background:${theme.surface};border:1px solid ${theme.border};border-radius:14px;padding:28px 24px;text-align:center;box-shadow:0 24px 64px rgba(0,0,0,0.35)}
  .badge{width:56px;height:56px;margin:0 auto 16px;border-radius:14px;background:${theme.surface};border:1px solid ${theme.border};display:flex;align-items:center;justify-content:center;color:${theme.error};font-size:26px;font-weight:700}
  .title{font-size:18px;font-weight:700;margin:0 0 8px;color:${theme.text}}
  .desc{font-size:13px;line-height:1.6;color:${theme.textMuted};margin:0 auto 16px;max-width:440px}
  .actions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:18px}
  .btn{appearance:none;border-radius:10px;padding:10px 18px;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.15s;border:1px solid ${theme.border}}
  .btn-primary{background:${theme.brand};color:#fff;border-color:${theme.brand}}
  .btn-primary:hover{filter:brightness(1.08)}
  .btn-ghost{background:rgba(255,255,255,0.06);color:${theme.text}}
  .btn-ghost:hover{background:rgba(255,255,255,0.1)}
</style></head><body><div class="card"><div class="badge">!</div><div class="title">Can't open in file://</div><p class="desc">YukiOS Browser and web apps need a web server. Service Worker and Wisp can't run from <code>file://</code> (origin is <code>null</code>).</p><div class="actions"><button class="btn btn-primary" onclick='window.open(${JSON.stringify(pagesUrl)}, "_blank", "noopener")'>Open from YukiOS</button></div></div></body></html>`;
}

export function injectFileProtocolFallback(container, appId, targetUrl) {
  if (!container) return;
  const html = buildFileProtocolFallbackHtml(appId, targetUrl);
  container.innerHTML = "";
  const iframe = document.createElement("iframe");
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "none";
  iframe.style.display = "block";
  iframe.srcdoc = html;
  container.appendChild(iframe);
}
