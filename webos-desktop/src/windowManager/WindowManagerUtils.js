import { resolveIconUrl } from "../shared/assetResolver.js";
import { sanitizeTitle } from "../utils/utils.js";
import { isImageFile } from "../fileDisplay.js";
import { updateTransparency } from "./transparencyManager.js";
import { getSetting } from "../shared/settingsUtils.js";

export class WindowManagerUtils {
  constructor(manager) {
    this.manager = manager;
  }

  init() {
    this._initVisibilityTracking();
  }

  applyWindowLayout(win) {
    const root = win.querySelector(".browser-root");
    if (!root) return;

    const header = win.querySelector(".window-header");
    const tabbar = root.querySelector(".browser-tabbar");

    if (!header || !tabbar) return;

    const controls = header.querySelector(".window-controls");
    if (!controls) return;

    tabbar.appendChild(controls);

    header.style.display = "none";

    controls.style.marginLeft = "auto";
    controls.style.display = "flex";
    controls.style.alignItems = "center";
    controls.style.height = "100%";
  }

  _resolveIconType(iconValue) {
    const isDataUrl = typeof iconValue === "string" && iconValue.startsWith("data:");
    const isHttpUrl = typeof iconValue === "string" && /^https?:\/\//.test(iconValue);
    return {
      isImage: isImageFile(iconValue) || isHttpUrl,
      isDataUrl
    };
  }

  _getFaviconLink() {
    let link = document.querySelector("link[rel~='icon']");
    return link;
  }

  getOpenWindowCount() {
    return this.manager.openWindows.size;
  }

  _getWindowNormalGeometry(win) {
    const entry = this.manager.openWindows.get(win.id);
    const rect = win.getBoundingClientRect();
    let x = rect.left;
    let y = rect.top;
    let width = rect.width;
    let height = rect.height;
    const parsePixelVal = (val, fallback) => {
      if (typeof val === "string" && val.endsWith("px")) {
        const num = parseInt(val);
        if (!isNaN(num)) return num;
      }
      return fallback;
    };
    if (win.dataset.snapZone && entry?.record?.preSnapGeometry) {
      x = entry.record.preSnapGeometry.x ?? x;
      y = entry.record.preSnapGeometry.y ?? y;
      width = entry.record.preSnapGeometry.width ?? width;
      height = entry.record.preSnapGeometry.height ?? height;
    } else if (win.dataset.fullscreen === "true") {
      x = parsePixelVal(win.dataset.prevLeft, x);
      y = parsePixelVal(win.dataset.prevTop, y);
      width = parsePixelVal(win.dataset.prevWidth, width);
      height = parsePixelVal(win.dataset.prevHeight, height);
    } else {
      x = parsePixelVal(win.style.left, x);
      y = parsePixelVal(win.style.top, y);
      width = parsePixelVal(win.style.width, width);
      height = parsePixelVal(win.style.height, height);
    }
    return { x, y, width, height };
  }

  getWindowIconHtml(iconValue, color = null) {
    if (!iconValue) return "";
    iconValue = resolveIconUrl(iconValue);
    const size = 25;
    const { isImage, isDataUrl } = this._resolveIconType(iconValue);

    if (isImage || isDataUrl) {
      return `<img src="${iconValue}" style="width:${size}px;height:${size}px;margin-right:6px;vertical-align:middle;object-fit:contain;" />`;
    } else if (typeof iconValue === "string" && iconValue.length > 0) {
      const cls = iconValue.startsWith("fa") ? iconValue : `fa ${iconValue}`;
      const clr = color ?? "white";
      return `<i class="${cls}" style="color:${clr};margin-right:6px;font-size:${size}px;vertical-align:middle;"></i>`;
    }
    return "";
  }

  generateWindowHeader(title, iconValue, color = null, externalUrl = null) {
    const iconHtml = this.getWindowIconHtml(iconValue, color);
    const controlsHtml = this.getWindowControls(externalUrl);
    return `<div class="window-header"><span>${iconHtml}${title}</span>${controlsHtml}</div>`;
  }

  updatePageFavicon(iconValue, title) {
    document.title = sanitizeTitle(title) || this.manager.initialTitle;
    const link = this._getFaviconLink();
    iconValue = resolveIconUrl(iconValue);
    const { isImage, isDataUrl } = this._resolveIconType(iconValue);
    if (isImage || isDataUrl) {
      link.href = iconValue;
    } else {
      link.href = this.manager.initialFavicon || "";
    }
  }

  resetToDefaultState() {
    document.title = this.manager.initialTitle;
    const link = this._getFaviconLink();
    link.href = this.manager.initialFavicon || "";
  }

  _initVisibilityTracking() {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        document.title = this.manager.initialTitle;
        this._getFaviconLink().href = this.manager.initialFavicon || "";
      } else {
        if (this.manager.openWindows.size === 0) {
          this.resetToDefaultState();
        } else {
          const activeEntry =
            Array.from(this.manager.openWindows.values()).findLast((entry) =>
              entry.taskbarItem?.classList.contains("active")
            ) ?? Array.from(this.manager.openWindows.values()).pop();
          if (activeEntry) this.updatePageFavicon(activeEntry.iconValue, activeEntry.title);
        }
      }
    });
  }

  _downloadWindowContent(win) {
    const filename =
      (win.querySelector(".window-header span")?.textContent?.trim() || win.id).replace(/[^\w\s-]/g, "").trim() ||
      "window";

    const iframe = win.querySelector("iframe");
    if (iframe) {
      const src = iframe.src || "";

      if (!src || src === "about:blank" || src === "") {
        return;
      }

      if (src.startsWith("blob:")) {
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
          if (iframeDoc) {
            const html = iframeDoc.documentElement?.outerHTML ?? "";
            const blob = new Blob([html], { type: "text/html" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename + ".html";
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }
        } catch (e) {}
        return;
      }

      if (src.startsWith("data:")) {
        const a = document.createElement("a");
        a.href = src;
        a.download = filename + ".html";
        a.click();
        return;
      }

      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc) {
          const html = iframeDoc.documentElement?.outerHTML ?? "";
          const blob = new Blob([html], { type: "text/html" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename + ".html";
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          return;
        }
      } catch (e) {}

      const a = document.createElement("a");
      a.href = src;
      a.download = filename + ".html";
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.click();
      return;
    }

    const content = win.querySelector(".window-content");
    const html = content ? content.innerHTML : win.outerHTML;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename + ".html";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  getWindowControls(externalUrl, showDownload = false) {
    const externalBtn = externalUrl ? `<button class="external-btn" title="Open in External">↗</button>` : "";

    const downloadBtn = showDownload
      ? `<button class="download-btn" title="Download">
      <svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg">
        <path d="M5 7L1.5 3.5h2V0h3v3.5h2L5 7zM0 9h10v1H0z"/>
      </svg>
    </button>`
      : "";

    if (getSetting("macOsControls", false)) {
      return `<div class="window-controls mac-controls">
        <button class="close-btn mac-btn mac-close" title="Close"></button>
        ${externalBtn}
        <button class="minimize-btn mac-btn mac-minimize" title="Minimize"></button>
        ${downloadBtn}
        <button class="maximize-btn mac-btn mac-maximize" title="Maximize"></button>
      </div>`;
    }

    return `<div class="window-controls">
      <button class="minimize-btn" title="Minimize"><svg viewBox="0 0 10 1" xmlns="http://www.w3.org/2000/svg"><path d="M0 0h10v1H0z"></path></svg></button>
      ${externalBtn}
      ${downloadBtn}
      <button class="maximize-btn" title="Maximize"><svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"><path d="M0 0v10h10V0H0zm1 1h8v8H1V1z"></path></svg></button>
      <button class="close-btn" title="Close"><svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"><path d="M10.2.7L9.5 0 5.1 4.4.7 0 0 .7l4.4 4.4L0 9.5l.7.7 4.4-4.4 4.4 4.4.7-.7-4.4-4.4z"></path></svg></button>
    </div>`;
  }

  _findAppIdByWinId(winId) {
    const gamesList = window.gamesList;
    if (!gamesList || !gamesList.appMap) return null;

    for (const [appId, appData] of Object.entries(gamesList.appMap)) {
      if (appData.id === winId) return appId;
    }
    return null;
  }

  updateTransparency() {
    updateTransparency(this.manager);
  }
}
