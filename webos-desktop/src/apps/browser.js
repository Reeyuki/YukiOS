import "../styles/scramjet.css";
import { BaseApp, PersistenceTypes, StorageKeys, os } from "../framework.js";
import { wobbleStart, wobbleMove, wobbleEnd } from "../windowManager/AnimationSystem.js";

const THEME_VARS = [
  "--brand",
  "--text-primary",
  "--text-secondary",
  "--text-muted",
  "--bg-primary",
  "--bg-secondary",
  "--surface-1",
  "--surface-hover",
  "--glass",
  "--glass-border",
  "--error",
  "--font-ui",
  "--font-mono",
  "--brand-glow",
  "--text-on-brand",
  "--brand-hover",
  "--brand-dim",
  "--overlay-bg",
  "--surface-2",
  "--success",
  "--warning"
];

let _scramjetInstanceCount = 0;

export class BrowserApp extends BaseApp {
  constructor(services) {
    super(services);
    this.iframe = null;
    this._msgHandler = null;
    this._element = null;
  }

  getDeclarativeSchema(opts) {
    const instanceNum = ++_scramjetInstanceCount;
    return {
      id: "scramjet",
      name: "Scramjet Browser",
      icon: "fas fa-globe",
      windows: [
        {
          id: "scramjet-window-" + instanceNum,
          title: opts?.isIncognito ? "Scramjet Browser (Private)" : "Scramjet Browser",
          size: ["1024px", "630px"],
          icon: "fas fa-globe",
          skipHeader: true,
          ui: `
            <div class="scramjet-container" style="width:100%;height:100%;overflow:hidden;">
              <iframe
                class="scramjet-iframe"
                style="width:100%;height:100%;border:none;"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation-by-user-activation"
              ></iframe>
            </div>
          `
        }
      ],
      state: {
        initial: {
          ...(opts?.isIncognito ? { isIncognito: true } : {}),
          ...(opts?.openUrl ? { openUrl: opts.openUrl } : {})
        },
        persistence: PersistenceTypes.NONE
      },
      onMount: "initScramjet",
      onClose: "cleanupScramjet"
    };
  }

  async initScramjet(payload, vt, element, state) {
    this._element = element;
    const iframe = element.querySelector(".scramjet-iframe");
    this.iframe = iframe;

    const isIncognito = state.isIncognito || false;
    const incognitoParam = isIncognito ? "?incognito=true" : "";
    iframe.src = window.location.origin + "/scram/index.html" + incognitoParam;

    const header = element.querySelector(".window-header");
    if (header) {
      header.classList.add("scramjet-header");
      const span = header.querySelector("span");
      if (span) span.textContent = "";
    }

    this.wm.makeDraggable(element);
    this.wm.makeResizable(element);

    const sendDataToIframe = () => {
      if (!iframe || !iframe.contentWindow) return;
      const computed = getComputedStyle(document.documentElement);
      const vars = {};
      THEME_VARS.forEach((name) => {
        vars[name] = computed.getPropertyValue(name).trim();
      });
      const bookmarks = os.storage.get(StorageKeys.browserBookmarks) || [];
      const history = os.storage.get(StorageKeys.browserHistory) || [];
      iframe.contentWindow.postMessage({ type: "scram:init", vars, bookmarks, history }, "*");
    };

    const msgHandler = (e) => {
      if (e.source !== iframe?.contentWindow) return;
      const data = e.data;
      if (!data || !data.type) return;

      if (data.type === "scram:getBookmarks" || data.type === "scram:getHistory") {
        sendDataToIframe();
      } else if (data.type === "scram:addBookmark") {
        let bookmarks = os.storage.get(StorageKeys.browserBookmarks) || [];
        if (!bookmarks.some((b) => b.url === data.url)) {
          bookmarks.push({ name: data.name || data.url, url: data.url });
          os.storage.set(StorageKeys.browserBookmarks, bookmarks);
        }
      } else if (data.type === "scram:removeBookmark") {
        let bookmarks = os.storage.get(StorageKeys.browserBookmarks) || [];
        bookmarks = bookmarks.filter((b) => b.url !== data.url);
        os.storage.set(StorageKeys.browserBookmarks, bookmarks);
      } else if (data.type === "scram:setBookmarks") {
        os.storage.set(StorageKeys.browserBookmarks, data.bookmarks || []);
      } else if (data.type === "scram:addHistory") {
        let history = os.storage.get(StorageKeys.browserHistory) || [];
        history.push({ url: data.url, title: data.title || data.url, time: Date.now() });
        if (history.length > 500) history = history.slice(-500);
        os.storage.set(StorageKeys.browserHistory, history);
      } else if (data.type === "scram:setHistory") {
        os.storage.set(StorageKeys.browserHistory, data.history || []);
      } else if (data.type === "browser-new-window") {
        os.app.launch("browserApp", { isIncognito: !!data.incognito });
      }
    };
    this._msgHandler = msgHandler;
    window.addEventListener("message", msgHandler);

    iframe.addEventListener("load", () => {
      sendDataToIframe();
      this._trySetupIframe(iframe, element);
      if (state.openUrl) this._navigateToUrl(iframe, state.openUrl);
    });
  }

  _trySetupIframe(iframe, element) {
    const setup = () => {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        if (!iframeDoc || !iframeDoc.body) return false;
        const controlsSlot = iframeDoc.getElementById("controls-slot");
        const tabsContainer = iframeDoc.getElementById("tabs-container");
        if (!controlsSlot || !tabsContainer) return false;
        this._injectControls(iframeDoc, controlsSlot, element);
        this._attachDragHandler(tabsContainer, iframe, element);
        return true;
      } catch (e) {
        console.error("Failed to setup iframe drag:", e);
        return false;
      }
    };
    if (!setup()) {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        if (iframeDoc?.body) {
          const obs = new MutationObserver(() => {
            if (setup()) obs.disconnect();
          });
          obs.observe(iframeDoc.body, { childList: true, subtree: true });
        }
      } catch (e) {
        console.error("Could not observe iframe for drag setup:", e);
      }
    }
  }

  _injectControls(iframeDoc, controlsSlot, element) {
    const controlsHTML = `<div class="window-controls">
      <button class="minimize-btn" title="Minimize"><svg viewBox="0 0 10 1" xmlns="http://www.w3.org/2000/svg"><path d="M0 0h10v1H0z"></path></svg></button>
      <button class="external-btn" title="Open in New Tab">↗</button>
      <button class="maximize-btn" title="Maximize"><svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"><path d="M0 0v10h10V0H0zm1 1h8v8H1V1z"></path></svg></button>
      <button class="close-btn" title="Close"><svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"><path d="M10.2.7L9.5 0 5.1 4.4.7 0 0 .7l4.4 4.4L0 9.5l.7.7 4.4-4.4 4.4 4.4.7-.7-4.4-4.4z"></path></svg></button>
    </div>`;
    controlsSlot.innerHTML = controlsHTML;
    const closeBtn = controlsSlot.querySelector(".close-btn");
    const maxBtn = controlsSlot.querySelector(".maximize-btn");
    const minBtn = controlsSlot.querySelector(".minimize-btn");
    const externalBtn = controlsSlot.querySelector(".external-btn");
    if (closeBtn)
      closeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.wm.closeWindow(element);
      });
    if (maxBtn)
      maxBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (element.dataset.snapZone === "maximize") this.wm.toggleFullscreen(element);
        else this.wm._applySnap(element, "maximize");
      });
    if (minBtn)
      minBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.wm.minimizeWindow(element);
      });
    if (externalBtn)
      externalBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.open(window.location.origin + "/scram/index.html", "_blank");
      });
  }

  _attachDragHandler(tabsContainer, iframe, element) {
    tabsContainer.style.cursor = "move";
    tabsContainer.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      if (
        e.target.closest(".tab") ||
        e.target.closest(".new-tab") ||
        e.target.closest(".window-controls") ||
        e.target.closest("button, input, select, textarea")
      )
        return;
      this._startIframeDrag(e, iframe, element);
    });
  }

  _startIframeDrag(e, iframe, element) {
    e.preventDefault();
    this.wm.bringToFront(element);
    wobbleStart(element);
    const wasSnapped = !!element.dataset.snapZone;
    if (wasSnapped) this.wm._unsnap(element);
    const disableStretch = os.storage.get(StorageKeys.disableDesktopStretchScroll) === "true";
    if (disableStretch) {
      if (getComputedStyle(element).position !== "fixed") {
        const rect = element.getBoundingClientRect();
        element.style.left = `${rect.left}px`;
        element.style.top = `${rect.top}px`;
        element.style.position = "fixed";
      }
    } else if (getComputedStyle(element).position === "fixed") {
      const rect = element.getBoundingClientRect();
      const desktop = document.getElementById("desktop");
      const desktopRect = desktop.getBoundingClientRect();
      const left = rect.left - desktopRect.left + desktop.scrollLeft;
      const top = rect.top - desktopRect.top + desktop.scrollTop;
      element.style.left = `${left}px`;
      element.style.top = `${top}px`;
      element.style.position = "absolute";
    }
    const iframeRect = iframe.getBoundingClientRect();
    const startX = e.clientX + iframeRect.left;
    const startY = e.clientY + iframeRect.top;
    const winRect = element.getBoundingClientRect();
    const ox = startX - winRect.left;
    const oy = startY - winRect.top;
    this.wm.isDraggingWindow = true;
    document.body.classList.add("is-dragging");
    const onMouseMove = (moveEvent) => {
      const newLeft = moveEvent.clientX - ox;
      const newTop = moveEvent.clientY - oy;
      element.style.left = `${newLeft}px`;
      element.style.top = `${newTop}px`;
      const entry = this.wm.openWindows.get(element.id);
      if (entry?.record) entry.record.setGeometry(newLeft, newTop);
      wobbleMove(element, moveEvent.clientX - startX, moveEvent.clientY - startY);
      const zone = this.wm._getSnapZone(moveEvent.clientX, moveEvent.clientY);
      this.wm._activeSnapZone = zone;
      if (zone) this.wm._showSnapGhost(zone);
      else this.wm._hideSnapGhost();
    };
    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      this.wm.isDraggingWindow = false;
      document.body.classList.remove("is-dragging");
      wobbleEnd(element);
      if (this.wm._activeSnapZone) {
        this.wm._applySnap(element, this.wm._activeSnapZone);
        this.wm._activeSnapZone = null;
        this.wm._hideSnapGhost();
      }
      if (this.wm.triggerSessionSave) this.wm.triggerSessionSave();
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  _sendDataToIframe() {
    if (!this.iframe || !this.iframe.contentWindow) return;

    const computed = getComputedStyle(document.documentElement);
    const vars = {};
    THEME_VARS.forEach((name) => {
      vars[name] = computed.getPropertyValue(name).trim();
    });

    const bookmarks = os.storage.get(StorageKeys.browserBookmarks) || [];
    const history = os.storage.get(StorageKeys.browserHistory) || [];

    this.iframe.contentWindow.postMessage(
      {
        type: "scram:init",
        vars,
        bookmarks,
        history
      },
      "*"
    );
  }

  cleanupScramjet() {
    if (this._msgHandler) {
      window.removeEventListener("message", this._msgHandler);
      this._msgHandler = null;
    }
    this.iframe = null;
    this._element = null;
  }

  openHtml(content, name, path) {
    const blob = new Blob([content], { type: "text/html" });
    const blobUrl = URL.createObjectURL(blob);

    if (this.iframe) {
      this._navigateToUrl(this.iframe, blobUrl);
    } else {
      os.app.launch("browserApp", { openUrl: blobUrl });
    }
  }

  _navigateToUrl(iframe, url) {
    const tryNav = () => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        const container = doc.getElementById("iframe-container");
        if (!container) return false;
        const activeFrame = container.querySelector("iframe:not(.hidden)");
        if (!activeFrame) return false;
        activeFrame.src = url;
        return true;
      } catch (e) {
        return false;
      }
    };
    if (!tryNav()) {
      let n = 0;
      const iv = setInterval(() => {
        n++;
        if (tryNav() || n > 30) clearInterval(iv);
      }, 80);
    }
  }
}
