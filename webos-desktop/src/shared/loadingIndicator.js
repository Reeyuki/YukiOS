export function buildLoadingIndicator({ label = "Loading...", progress = null, iconClass = "fas fa-spinner fa-spin" } = {}) {
  const bar = progress !== null ? `<div class="yuki-loading-bar"><div style="width:${progress}%"></div></div>` : "";
  return `<div class="yuki-loading-indicator"><i class="${iconClass}" style="animation-duration:1.4s;opacity:0.7"></i><span>${label}</span>${bar}</div>`;
}

export function getLoadingIndicatorCSS() {
  return `.yuki-loading-indicator{display:flex;align-items:center;gap:8px;color:var(--text-secondary);font-size:13px}.yuki-loading-indicator i{opacity:0.7}.yuki-loading-bar{flex:1;height:3px;background:rgba(255,255,255,0.08);border-radius:2px;overflow:hidden}.yuki-loading-bar>div{height:100%;background:var(--brand);transition:width 0.2s ease}`;
}
