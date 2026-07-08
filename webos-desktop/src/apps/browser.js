import "../styles/scramjet.css";
import { BaseApp, PersistenceTypes, StorageKeys, os } from "../framework.js";
import { wobbleStart, wobbleMove, wobbleEnd } from "../windowManager/AnimationSystem.js";
import { PROXIES } from "../proxies.js";

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
    this._torEnabled = false;
    this._torClient = null;
    this._torIframe = null;
    this._torOverlay = null;
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
      if (e.source !== iframe?.contentWindow && e.source !== this._torIframe?.contentWindow) return;
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
      } else if (data.type === "scram:setTorMode") {
        this._torEnabled = data.active;
        if (!data.active) this._exitTorMode();
      } else if (data.type === "scram:navigate") {
        if (this._torEnabled && data.url) {
          this._loadWithTor(data.url);
        }
      } else if (data.type === "browser-tor-reconnect") {
        this._reconnectTor();
      } else if (data.type === "browser-navigate") {
        if (this._torEnabled && data.url) {
          this._loadWithTor(data.url);
        }
      } else if (data.type === "browser-tor-download") {
        if (this._torEnabled && data.url) {
          this._loadWithTor(data.url);
        }
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
    this._exitTorMode();
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
    if (this._isTorUrl(url)) {
      this._loadWithTor(url);
      return;
    }
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

  _enterTorMode() {
    if (this._torOverlay) return;
    const container = this._element?.querySelector(".scramjet-container");
    if (!container) return;

    const overlay = document.createElement("div");
    overlay.className = "tor-overlay";
    overlay.innerHTML = `
      <div class="tor-bar">
        <span class="tor-bar-label"><i class="fas fa-shield-halved"></i> Tor Active</span>
        <button class="tor-exit-btn" id="tor-exit-btn">Exit Tor</button>
      </div>
      <div class="tor-loading" id="tor-loading">
        <div class="loading-spinner"></div>
        <div class="tor-loading-text" id="tor-loading-text">Starting Tor...</div>
      </div>
      <iframe class="tor-iframe" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>
    `;
    const exitBtn = overlay.querySelector("#tor-exit-btn");
    if (exitBtn) {
      exitBtn.addEventListener("click", () => {
        this._exitTorMode();
        this._torEnabled = false;
        try {
          this.iframe?.contentWindow?.postMessage({ type: "scram:torMode", active: false }, "*");
        } catch {}
      });
    }
    container.appendChild(overlay);
    this._torOverlay = overlay;
    this._torIframe = overlay.querySelector(".tor-iframe");
  }

  _exitTorMode() {
    if (this._torOverlay) {
      this._torOverlay.remove();
      this._torOverlay = null;
      this._torIframe = null;
    }
    if (this._torClient) {
      this._torClient.close();
      this._torClient = null;
    }
  }

  _showTorLoading(text) {
    const el = this._torOverlay?.querySelector("#tor-loading");
    const txt = this._torOverlay?.querySelector("#tor-loading-text");
    if (el) el.style.display = "flex";
    if (txt) txt.textContent = text || "Starting Tor...";
  }

  _hideTorLoading() {
    const el = this._torOverlay?.querySelector("#tor-loading");
    if (el) el.style.display = "none";
  }

  async _startTorWithStatus() {
    const tm = os.tor;
    try {
      const status = tm.getStatus();
      if (status.ready) return true;
      if (status.running) {
        await tm.waitForCircuit();
        return true;
      }
    } catch {}
    this._showTorLoading("Starting Tor...");
    const unsubLog = os.events.on("TOR_LOG", (msg) => {
      this._showTorLoading(msg);
    });
    try {
      await tm.start({ appId: "browserApp" });
      unsubLog();
      return true;
    } catch (e) {
      unsubLog();
      this._hideTorLoading();
      os.notify.send("Tor Error", "Failed to start Tor: " + e.message, { type: "error", duration: 5000 });
      return false;
    }
  }

  async _reconnectTor() {
    try {
      await os.tor.reconnect();
      os.notify.send("Tor", "Tor reconnected.", { type: "success", duration: 3000 });
      if (this._torClient) {
        this._torClient.close();
        this._torClient = null;
      }
    } catch {
      os.notify.send("Tor", "Reconnect failed. Try again.", { type: "error", duration: 5000 });
    }
  }

  async _loadWithTor(url) {
    this._enterTorMode();
    this._showTorLoading("Preparing Tor connection...");

    try {
      if (!this._torClient) {
        const torReady = await this._startTorWithStatus();
        if (!torReady) {
          this._writeTorErrorPage(url, "Tor could not start. Check your connection.");
          return;
        }
        this._torClient = await os.tor.createClient();
      }

      this._showTorLoading("Fetching " + url);

      const resp = await Promise.race([
        this._torClient.fetch(url),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Tor fetch timed out")), 30000))
      ]);
      if (!resp || resp.status >= 400) throw new Error("HTTP " + (resp?.status || "error"));

      const ct =
        typeof resp.headers === "object" && resp.headers
          ? resp.headers["content-type"] || resp.headers.get?.("content-type") || ""
          : "";

      const isBinary =
        ct.includes("application/octet-stream") ||
        ct.includes("application/zip") ||
        ct.includes("application/pdf") ||
        (ct && !ct.includes("text") && !ct.includes("json") && !ct.includes("html") && !ct.includes("xml"));

      if (isBinary) {
        const blob = new Blob([resp.body], { type: ct });
        this._triggerDownload(blob, url);
        this._hideTorLoading();
        return;
      }

      let html;
      if (ct.includes("application/json")) {
        const json = await resp.json();
        html = json.contents || json.body || json.data || "";
        if (!html) throw new Error("Empty JSON body");
      } else {
        html = await resp.text();
      }

      if (!html || html.trim().length === 0) throw new Error("Empty response");

      const baseUrl = (() => {
        try {
          const u = new URL(url);
          return u.origin + u.pathname.replace(/\/[^/]*$/, "/");
        } catch {
          return url;
        }
      })();

      const interceptScript = this._buildInterceptScripts(url);

      let finalHtml = html;
      const baseTag = `<base href="${baseUrl}">`;
      const injection = baseTag + interceptScript;

      if (/<head[^>]*>/i.test(finalHtml)) {
        finalHtml = finalHtml.replace(/(<head[^>]*>)/i, "$1" + injection);
      } else {
        finalHtml = "<head>" + injection + "</head>" + finalHtml;
      }

      this._hideTorLoading();
      const torIframe = this._torIframe;
      if (torIframe) {
        torIframe.removeAttribute("src");
        torIframe.onload = () => {
          torIframe.onload = null;
        };
        torIframe.srcdoc = finalHtml;
      }
    } catch (err) {
      this._hideTorLoading();
      const fc = this._torClient?.getFetchCount?.() || 0;
      this._writeTorErrorPage(
        url,
        fc > 5 ? "Tor connection may be stale (" + fc + " fetches served)." : "Tor failed to load this page.",
        true
      );
    }
  }

  _buildInterceptScripts(pageUrl) {
    return `<script>
(function() {
  var pageUrl = ${JSON.stringify(pageUrl)};
  function resolve(href) {
    try { return new URL(href, pageUrl).href; } catch(e) { return null; }
  }
  document.addEventListener('click', function(e) {
    var anchor = e.target.closest('a');
    if (!anchor) return;
    var href = anchor.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
    var resolved = resolve(href);
    if (!resolved) return;
    e.preventDefault();
    e.stopPropagation();
    window.parent.postMessage({ type: 'browser-navigate', url: resolved }, '*');
  }, true);
  document.addEventListener('submit', function(e) {
    var form = e.target;
    var action = form.getAttribute('action') || pageUrl;
    var resolved = resolve(action) || pageUrl;
    e.preventDefault();
    var params = new URLSearchParams(new FormData(form)).toString();
    var method = (form.method || 'get').toLowerCase();
    var finalUrl = method === 'post' ? resolved : (resolved + (resolved.includes('?') ? '&' : '?') + params);
    window.parent.postMessage({ type: 'browser-navigate', url: finalUrl }, '*');
  }, true);
  document.addEventListener('click', function(e) {
    var anchor = e.target.closest('a[download]');
    if (!anchor) return;
    var href = anchor.getAttribute('href');
    if (!href) return;
    try {
      var resolved = new URL(href, ${JSON.stringify(pageUrl)}).href;
      e.preventDefault();
      e.stopPropagation();
      window.parent.postMessage({ type: 'browser-tor-download', url: resolved, filename: anchor.getAttribute('download') || '' }, '*');
    } catch(err) {}
  }, true);
})();
<\/script>`;
  }

  _writeTorErrorPage(url, message, showReconnect) {
    const iframe = this._torIframe;
    if (!iframe) return;
    const reconnectHtml = showReconnect
      ? "<button onclick=\"parent.postMessage({type:'browser-tor-reconnect'},'*')\" style=\"margin-top:8px;padding:8px 20px;background:#8b5cf6;border:none;border-radius:6px;color:#fff;cursor:pointer;font-size:13px\">Reconnect Tor</button>"
      : "";
    iframe.srcdoc =
      '<html><body style="background:#202124;color:#e8eaed;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;gap:12px"><div style="font-size:48px"><i class="fas fa-exclamation-triangle"></i></div><div style="font-size:16px">' +
      (message || "All proxies failed to load this page.") +
      '</div><div style="font-size:12px;color:#9aa0a6">' +
      url +
      "</div>" +
      reconnectHtml +
      "</body></html>";
  }

  _triggerDownload(blob, url) {
    let name = "download";
    try {
      name = new URL(url).pathname.split("/").pop() || "download";
    } catch {}
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
  }

  _isTorUrl(url) {
    return (
      this._torEnabled &&
      url &&
      !url.startsWith("about:") &&
      !url.startsWith("blob:") &&
      !url.startsWith("yuki://") &&
      !url.startsWith("NT.html")
    );
  }
}
