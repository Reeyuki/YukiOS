import "../styles/scramjet.css";
import { BaseApp, StorageKeys, os, BusEvents } from "../framework.js";
import { Achievements } from "../achievements.js";
import { wobbleStart, wobbleMove, wobbleEnd } from "../windowManager/AnimationSystem.js";
import { PROXIES } from "../proxies.js";
import { $, setStyle, createElement, addClass, removeClass } from "../shared/domUtils.js";
import { maybeTriggerSmartlink } from "../ads.js";

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

let scramjetInstanceCount = 0;

export class BrowserApp extends BaseApp {
  constructor(services) {
    super(services);
    this.iframe = null;
    this.msgHandler = null;
    this.element = null;
    this.torEnabled = false;
    this.torClient = null;
    this.torIframe = null;
    this.torOverlay = null;
  }

  open(opts = {}) {
    const instanceNum = ++scramjetInstanceCount;
    const winId = "scramjet-window-" + instanceNum;
    const isIncognito = opts?.isIncognito || false;
    const openUrl = opts?.openUrl || null;

    const title = isIncognito ? "Scramjet Browser (Private)" : "Scramjet Browser";
    const win = os.window.create(winId, title, "1024px", "630px", {
      icon: "static/icons/firefox.webp",
      appId: "browserApp",
      skipHeader: true
    });

    win.innerHTML = `
      <div class="scramjet-container" style="width:100%;height:100%;overflow:hidden;">
        <iframe
          class="scramjet-iframe"
          style="width:100%;height:100%;border:none;"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation-by-user-activation"
        ></iframe>
      </div>
    `;

    this.initScramjet(null, null, win, { isIncognito, openUrl });
    if (isIncognito) {
      os.events.emit(BusEvents.ACHIEVEMENT_TRIGGER, { achievementId: Achievements.GhostMode });
    }

    return win;
  }

  async initScramjet(payload, vt, element, state) {
    this.element = element;
    const iframe = element.querySelector(".scramjet-iframe");
    this.iframe = iframe;

    const isIncognito = state.isIncognito || false;
    const incognitoParam = isIncognito ? "?incognito=true" : "";
    const transportType = os.storage.get(StorageKeys.browserTransport) || "epoxy";
    iframe.src =
      window.location.origin +
      "/s/index.html" +
      incognitoParam +
      (incognitoParam ? "&" : "?") +
      "transport=" +
      transportType;

    const header = element.querySelector(".window-header");
    if (header) {
      header.classList.add("scramjet-header");
      const span = header.querySelector("span");
      if (span) span.textContent = "";
    }

    os.window.makeDraggable(element);
    os.window.makeResizable(element);

    const sendDataToIframe = () => {
      if (!iframe || !iframe.contentWindow) return;
      const computed = getComputedStyle(document.documentElement);
      const vars = {};
      THEME_VARS.forEach((name) => {
        vars[name] = computed.getPropertyValue(name).trim();
      });
      const bookmarks = os.storage.get(StorageKeys.browserBookmarks) || [];
      const history = os.storage.get(StorageKeys.browserHistory) || [];
      const wispUrl = os.storage.get(StorageKeys.wispServer) || "wss://hurt-agata-liventcord-api-7072e9a6.koyeb.app/";
      const transport = os.storage.get(StorageKeys.browserTransport) || "epoxy";
      iframe.contentWindow.postMessage({ type: "scram:init", vars, bookmarks, history, wispUrl, transport }, "*");
    };

    const msgHandler = (e) => {
      if (e.source !== iframe?.contentWindow && e.source !== this.torIframe?.contentWindow) return;
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
        this.torEnabled = data.active;
        if (!data.active) this.exitTorMode();
      } else if (data.type === "scram:navigate") {
        if (this.torEnabled && data.url) {
          this.loadWithTor(data.url);
        }
      } else if (data.type === "browser-tor-reconnect") {
        this.reconnectTor();
      } else if (data.type === "browser-navigate") {
        if (this.torEnabled && data.url) {
          this.loadWithTor(data.url);
        }
      } else if (data.type === "browser-tor-download") {
        if (this.torEnabled && data.url) {
          this.loadWithTor(data.url);
        }
      } else if (data.type === "scram:proxyConfigChange") {
        if (data.wispUrl) os.storage.set(StorageKeys.wispServer, data.wispUrl);
        if (data.transport) os.storage.set(StorageKeys.browserTransport, data.transport);
      }
    };
    this.msgHandler = msgHandler;
    window.addEventListener("message", msgHandler);

    iframe.addEventListener("load", () => {
      sendDataToIframe();
      this.trySetupIframe(iframe, element);
      if (state.openUrl) this.navigateToUrl(iframe, state.openUrl);
    });

    this.settingsChangedHandler = () => {
      this.sendDataToIframe();
    };
    os.events.on(BusEvents.SETTINGS_CHANGED, this.settingsChangedHandler);
  }

  trySetupIframe(iframe, element) {
    const setup = () => {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        if (!iframeDoc || !iframeDoc.body) return false;
        const controlsSlot = iframeDoc.getElementById("controls-slot");
        const tabsContainer = iframeDoc.getElementById("tabs-container");
        if (!controlsSlot || !tabsContainer) return false;
        this.injectControls(iframeDoc, controlsSlot, element);
        this.attachDragHandler(tabsContainer, iframe, element);
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

  injectControls(iframeDoc, controlsSlot, element) {
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
        os.window.close(element);
      });
    if (maxBtn)
      maxBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (element.dataset.snapZone === "maximize") os.window.maximize(element);
        else os.window.maximize(element);
      });
    if (minBtn)
      minBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        os.window.minimize(element);
      });
    if (externalBtn)
      externalBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.open(window.location.origin + "/s/index.html", "blank");
      });
  }

  attachDragHandler(tabsContainer, iframe, element) {
    setStyle(tabsContainer, { cursor: "move" });
    tabsContainer.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      if (
        e.target.closest(".tab") ||
        e.target.closest(".new-tab") ||
        e.target.closest(".window-controls") ||
        e.target.closest("button, input, select, textarea")
      )
        return;
      this.startIframeDrag(e, iframe, element);
    });
  }

  startIframeDrag(e, iframe, element) {
    e.preventDefault();
    os.window.bringToFront(element);
    wobbleStart(element);
    const wasSnapped = !!element.dataset.snapZone;
    if (wasSnapped) os.windowManager.unsnap(element);
    const disableStretch = os.storage.get(StorageKeys.disableDesktopStretchScroll) !== "false";
    if (disableStretch) {
      if (getComputedStyle(element).position !== "fixed") {
        const rect = element.getBoundingClientRect();
        setStyle(element, { left: `${rect.left}px`, top: `${rect.top}px`, position: "fixed" });
      }
    } else if (getComputedStyle(element).position === "fixed") {
      const rect = element.getBoundingClientRect();
      const desktop = $("#desktop");
      const desktopRect = desktop.getBoundingClientRect();
      const left = rect.left - desktopRect.left + desktop.scrollLeft;
      const top = rect.top - desktopRect.top + desktop.scrollTop;
      setStyle(element, { left: `${left}px`, top: `${top}px`, position: "absolute" });
    }
    const iframeRect = iframe.getBoundingClientRect();
    const startX = e.clientX + iframeRect.left;
    const startY = e.clientY + iframeRect.top;
    const winRect = element.getBoundingClientRect();
    const ox = startX - winRect.left;
    const oy = startY - winRect.top;
    os.windowManager.isDraggingWindow = true;
    addClass(document.body, "is-dragging");
    const onMouseMove = (moveEvent) => {
      const newLeft = moveEvent.clientX - ox;
      const newTop = moveEvent.clientY - oy;
      setStyle(element, { left: `${newLeft}px`, top: `${newTop}px` });
      const entry = os.windowManager.openWindows.get(element.id);
      if (entry?.record) entry.record.setGeometry(newLeft, newTop);
      wobbleMove(element, moveEvent.clientX - startX, moveEvent.clientY - startY);
      const zone = os.windowManager.getSnapZone(moveEvent.clientX, moveEvent.clientY);
      os.windowManager.activeSnapZone = zone;
      if (zone) os.windowManager.showSnapGhost(zone);
      else os.windowManager.hideSnapGhost();
    };
    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      os.windowManager.isDraggingWindow = false;
      removeClass(document.body, "is-dragging");
      wobbleEnd(element);
      if (os.windowManager.activeSnapZone) {
        os.windowManager.applySnap(element, os.windowManager.activeSnapZone);
        os.windowManager.activeSnapZone = null;
        os.windowManager.hideSnapGhost();
      }
      if (os.windowManager.triggerSessionSave) os.windowManager.triggerSessionSave();
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  sendDataToIframe() {
    if (!this.iframe || !this.iframe.contentWindow) return;

    const computed = getComputedStyle(document.documentElement);
    const vars = {};
    THEME_VARS.forEach((name) => {
      vars[name] = computed.getPropertyValue(name).trim();
    });

    const bookmarks = os.storage.get(StorageKeys.browserBookmarks) || [];
    const history = os.storage.get(StorageKeys.browserHistory) || [];
    const wispUrl = os.storage.get(StorageKeys.wispServer) || "wss://hurt-agata-liventcord-api-7072e9a6.koyeb.app/";
    const transport = os.storage.get(StorageKeys.browserTransport) || "epoxy";

    this.iframe.contentWindow.postMessage({ type: "scram:init", vars, bookmarks, history, wispUrl, transport }, "*");
  }

  cleanupScramjet() {
    if (this.settingsChangedHandler) {
      os.events.off(BusEvents.SETTINGS_CHANGED, this.settingsChangedHandler);
      this.settingsChangedHandler = null;
    }
    if (this.msgHandler) {
      window.removeEventListener("message", this.msgHandler);
      this.msgHandler = null;
    }
    this.exitTorMode();
    this.iframe = null;
    this.element = null;
  }

  openHtml(content, name, path) {
    const blob = new Blob([content], { type: "text/html" });
    const blobUrl = URL.createObjectURL(blob);

    if (this.iframe) {
      this.navigateToUrl(this.iframe, blobUrl);
    } else {
      os.app.launch("browserApp", { openUrl: blobUrl });
    }
  }

  navigateToUrl(iframe, url) {
    maybeTriggerSmartlink();
    if (this.isTorUrl(url)) {
      this.loadWithTor(url);
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

  enterTorMode() {
    if (this.torOverlay) return;
    const container = this.element?.querySelector(".scramjet-container");
    if (!container) return;

    const overlay = createElement("div", { className: "tor-overlay" });
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
        this.exitTorMode();
        this.torEnabled = false;
        try {
          this.iframe?.contentWindow?.postMessage({ type: "scram:torMode", active: false }, "*");
        } catch {}
      });
    }
    container.appendChild(overlay);
    this.torOverlay = overlay;
    this.torIframe = overlay.querySelector(".tor-iframe");
  }

  exitTorMode() {
    if (this.torOverlay) {
      this.torOverlay.remove();
      this.torOverlay = null;
      this.torIframe = null;
    }
    if (this.torClient) {
      this.torClient.close();
      this.torClient = null;
    }
  }

  showTorLoading(text) {
    const el = this.torOverlay?.querySelector("#tor-loading");
    const txt = this.torOverlay?.querySelector("#tor-loading-text");
    if (el) setStyle(el, { display: "flex" });
    if (txt) txt.textContent = text || "Starting Tor...";
  }

  hideTorLoading() {
    const el = this.torOverlay?.querySelector("#tor-loading");
    if (el) setStyle(el, { display: "none" });
  }

  async startTorWithStatus() {
    const tm = os.tor;
    try {
      const status = tm.getStatus();
      if (status.ready) return true;
      if (status.running) {
        await tm.waitForCircuit();
        return true;
      }
    } catch {}
    this.showTorLoading("Starting Tor...");
    const unsubLog = os.events.on("TOR_LOG", (msg) => {
      this.showTorLoading(msg);
    });
    try {
      await tm.start({ appId: "browserApp" });
      unsubLog();
      return true;
    } catch (e) {
      unsubLog();
      this.hideTorLoading();
      os.notify.send("Tor Error", "Failed to start Tor: " + e.message, { type: "error", duration: 5000 });
      return false;
    }
  }

  async reconnectTor() {
    try {
      await os.tor.reconnect();
      os.notify.send("Tor", "Tor reconnected.", { type: "success", duration: 3000 });
      if (this.torClient) {
        this.torClient.close();
        this.torClient = null;
      }
    } catch {
      os.notify.send("Tor", "Reconnect failed. Try again.", { type: "error", duration: 5000 });
    }
  }

  async loadWithTor(url) {
    this.enterTorMode();
    this.showTorLoading("Preparing Tor connection...");

    try {
      if (!this.torClient) {
        const torReady = await this.startTorWithStatus();
        if (!torReady) {
          this.writeTorErrorPage(url, "Tor could not start. Check your connection.");
          return;
        }
        this.torClient = await os.tor.createClient();
      }

      this.showTorLoading("Fetching " + url);

      const resp = await Promise.race([
        this.torClient.fetch(url),
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
        this.triggerDownload(blob, url);
        this.hideTorLoading();
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

      const interceptScript = this.buildInterceptScripts(url);

      let finalHtml = html;
      const baseTag = `<base href="${baseUrl}">`;
      const injection = baseTag + interceptScript;

      if (/<head[^>]*>/i.test(finalHtml)) {
        finalHtml = finalHtml.replace(/(<head[^>]*>)/i, "$1" + injection);
      } else {
        finalHtml = "<head>" + injection + "</head>" + finalHtml;
      }

      this.hideTorLoading();
      const torIframe = this.torIframe;
      if (torIframe) {
        torIframe.removeAttribute("src");
        torIframe.onload = () => {
          torIframe.onload = null;
        };
        torIframe.srcdoc = finalHtml;
      }
    } catch (err) {
      this.hideTorLoading();
      const fc = this.torClient?.getFetchCount?.() || 0;
      this.writeTorErrorPage(
        url,
        fc > 5 ? "Tor connection may be stale (" + fc + " fetches served)." : "Tor failed to load this page.",
        true
      );
    }
  }

  buildInterceptScripts(pageUrl) {
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

  writeTorErrorPage(url, message, showReconnect) {
    const iframe = this.torIframe;
    if (!iframe) return;
    const reconnectHtml = showReconnect
      ? "<button onclick=\"parent.postMessage({type:'browser-tor-reconnect'},'*')\" style=\"margin-top:8px;padding:8px 20px;background:var(--brand);border:none;border-radius:6px;color:var(--text-on-brand);cursor:pointer;font-size:13px\">Reconnect Tor</button>"
      : "";
    iframe.srcdoc =
      '<html><body style="background:var(--bg-primary);color:var(--text-primary);font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;gap:12px"><div style="font-size:48px"><i class="fas fa-exclamation-triangle"></i></div><div style="font-size:16px">' +
      (message || "All proxies failed to load this page.") +
      '</div><div style="font-size:12px;color:var(--text-secondary)">' +
      url +
      "</div>" +
      reconnectHtml +
      "</body></html>";
  }

  triggerDownload(blob, url) {
    let name = "download";
    try {
      name = new URL(url).pathname.split("/").pop() || "download";
    } catch {}
    const objectUrl = URL.createObjectURL(blob);
    const a = createElement("a", { attributes: { href: objectUrl, download: name } });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
  }

  isTorUrl(url) {
    return (
      this.torEnabled &&
      url &&
      !url.startsWith("about:") &&
      !url.startsWith("blob:") &&
      !url.startsWith("yuki://") &&
      !url.startsWith("NT.html")
    );
  }
}
