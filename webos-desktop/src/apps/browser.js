import "../styles/scramjet.css";
import { BaseApp, StorageKeys, os, BusEvents } from "../framework.js";
import { Achievements } from "../achievements.js";
import {
  $,
  setStyle,
  createElement,
  bindEvent,
  addClass,
  removeClass,
  setText,
  setHTML,
} from "../shared/domUtils.js";
import { maybeTriggerSmartlink } from "../ads.js";
import {
  buildFsInterceptScript,
  buildDirectoryHtml,
  getMimeType,
  isDirEntry,
  isTextContentType,
  joinPath,
  parseLocalTarget,
  readOsTheme,
  splitPath,
} from "../shared/virtualFsNet.js";
import { escapeDinoGameAttr } from "../shared/dino/dinoGame.js";
import { escapeHtml } from "../utils/utils.js";
import { injectFileProtocolFallback } from "../shared/fileProtocolFallback.js";
import {
  renderFileProtocolUrl,
  fetchViaWispRaw,
} from "../shared/fileProtocolEngine.js";
import { getLibraryUrl } from "../shared/cdnConfig.js";
import { isFunction } from "../shared/functionUtils.js";
import { KeybindManager } from "../keybindManager.js";
import {
  isPluginEnabled as isWindowOpenPluginEnabled,
  setPluginEnabled as setWindowOpenPluginEnabled,
} from "./browser/plugins/windowOpenInNewTab.js";
import {
  createPopupWindow,
  isPopupInterceptEnabled,
} from "../core/ScramjetPopupManager.js";
import { buildBrowserView } from "./browser/browserView.js";
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
  "--warning",
];
const DIRECT_LOAD_DOMAINS = ["reeyuki.github.io", "reeyuki.neocities.org"];
function isDirectLoadUrl(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return DIRECT_LOAD_DOMAINS.some(
      (domain) => host === domain || host.endsWith("." + domain),
    );
  } catch {
    return false;
  }
}
let scramjetInstanceCount = 0;
const pdfScriptPromises = new Map();
function loadRemoteScript(url) {
  if (pdfScriptPromises.has(url)) return pdfScriptPromises.get(url);
  const promise = new Promise((resolveLoad, rejectLoad) => {
    const script = createElement("script", { attributes: { src: url } });
    script.onload = () => resolveLoad();
    script.onerror = () => rejectLoad(new Error("Failed to load " + url));
    document.head.appendChild(script);
  });
  pdfScriptPromises.set(url, promise);
  return promise;
}
function loadRemoteStylesheet(url) {
  if (pdfScriptPromises.has(url)) return pdfScriptPromises.get(url);
  const promise = new Promise((resolveLoad, rejectLoad) => {
    const link = createElement("link", {
      attributes: { rel: "stylesheet", href: url },
    });
    link.onload = () => resolveLoad();
    link.onerror = () => rejectLoad(new Error("Failed to load " + url));
    document.head.appendChild(link);
  });
  pdfScriptPromises.set(url, promise);
  return promise;
}
let pdfjsLoadPromise = null;
function loadPdfjs() {
  if (pdfjsLoadPromise) return pdfjsLoadPromise;
  pdfjsLoadPromise = (async () => {
    await Promise.all([
      loadRemoteScript(getLibraryUrl("pdfjs", "js")),
      loadRemoteScript(getLibraryUrl("pdfjs", "viewer")),
      loadRemoteStylesheet(getLibraryUrl("pdfjs", "viewerCss")),
    ]);
    const pdfjsLib = window.pdfjsLib;
    if (!pdfjsLib) throw new Error("PDF library failed to load");
    pdfjsLib.GlobalWorkerOptions.workerSrc = getLibraryUrl("pdfjs", "worker");
    return pdfjsLib;
  })();
  return pdfjsLoadPromise;
}
let cachedThemeVars = null;
let cachedThemeVarsAt = 0;
function getCachedThemeVars() {
  const now = Date.now();
  if (cachedThemeVars && now - cachedThemeVarsAt < 500) return cachedThemeVars;
  const computed = getComputedStyle(document.documentElement);
  const vars = {};
  THEME_VARS.forEach((name) => {
    vars[name] = computed.getPropertyValue(name).trim();
  });
  cachedThemeVars = vars;
  cachedThemeVarsAt = now;
  return vars;
}
export class BrowserApp extends BaseApp {
  constructor(services) {
    super(services);
    this.msgHandler = null;
    this.element = null;
    this.torEnabled = false;
    this.torClient = null;
    this.torIframe = null;
    this.torOverlay = null;
    this.windowHandlers = new Map();
    this.focusedWinId = null;
    this.focusListener = null;
  }
  onClose(winId) {
    const entry = this.windowHandlers.get(winId);
    if (entry) {
      window.removeEventListener("message", entry.msgHandler);
      if (entry.settingsChangedHandler)
        os.events.off(BusEvents.SETTINGS_CHANGED, entry.settingsChangedHandler);
      if (entry.docKeyHandler)
        document.removeEventListener("keydown", entry.docKeyHandler);
      if (entry.observer) entry.observer.disconnect();
      try {
        entry.view?.tabsApi?.destroy?.();
      } catch {}
      this.windowHandlers.delete(winId);
    }
    if (this.element && this.element.id === winId) {
      this.cleanupScramjet();
    }
    try {
      if (os.storage.get(StorageKeys.browserClearOnExit) === true) {
        const openWindows = os.window.getOpenWindows();
        let remaining = false;
        if (openWindows) {
          const keys =
            typeof openWindows.keys === "function"
              ? Array.from(openWindows.keys())
              : Object.keys(openWindows);
          remaining = keys.some((key) =>
            String(key).startsWith("scramjet-window"),
          );
        }
        if (!remaining) {
          os.storage.set(StorageKeys.browserHistory, []);
          os.storage.set(StorageKeys.browserBookmarks, []);
          os.storage.set(StorageKeys.browserDownloads, []);
        }
      }
    } catch {}
  }
  open(opts = {}) {
    const instanceNum = ++scramjetInstanceCount;
    const winId = "scramjet-window-" + instanceNum;
    const isIncognito = opts?.isIncognito || false;
    const openUrl = opts?.openUrl || "yuki://home";
    const openStart = performance.now();
    try {
      performance.mark(`browser:open:${winId}`);
    } catch {}
    const title = isIncognito
      ? "Scramjet Browser (Private)"
      : "Scramjet Browser";
    const win = os.window.create(winId, title, "1024px", "630px", {
      icon: "static/icons/chrome.webp",
      appId: "browserApp",
      skipHeader: true,
      position: "center",
    });
    win.dataset.browserOpenStart = String(openStart);
    win.innerHTML = `<div class="browser-root"></div>`;
    os.window.makeDraggable(win);
    os.window.makeResizable(win);
    this.initScramjet(null, null, win, { isIncognito, openUrl });
    if (isIncognito) {
      os.events.emit(BusEvents.ACHIEVEMENT_TRIGGER, {
        achievementId: Achievements.GhostMode,
      });
    }
    return win;
  }
  async initScramjet(payload, vt, element, state) {
    try {
      const params = new URLSearchParams(window.location.search);
      const wispParam = params.get("wisp");
      if (wispParam) {
        const parsed = new URL(wispParam);
        if (parsed.protocol === "ws:" || parsed.protocol === "wss:") {
          os.storage.set(StorageKeys.wispServer, wispParam);
        }
      }
    } catch {}
    this.element = element;
    const winId = element.id;
    let rootContainer = $(".browser-root", element);
    if (!rootContainer) {
      element.innerHTML = `<div class="browser-root"></div>`;
      rootContainer = $(".browser-root", element);
    }
    os.window.makeDraggable(element);
    os.window.makeResizable(element);
    const initialUrl = state?.openUrl || "yuki://home";
    const parsedNum = Number(String(winId).split("-").pop());
    const instanceNum =
      Number.isFinite(parsedNum) && parsedNum > 0
        ? parsedNum
        : scramjetInstanceCount;
    const getWindowOpenInterceptEnabled = () =>
      isWindowOpenPluginEnabled(os.storage);
    const msgHandler = (e) => {
      const data = e.data;
      if (!data || !data.type) return;
      if (
        data.type === "browser-navigate" ||
        data.type === "navigate" ||
        data.type === "scram-local-nav" ||
        data.type === "scram:navigate"
      ) {
        if (data.url) this.navigateSingleLayer(winId, String(data.url));
        return;
      }
      if (data.type === "browser-navigate-split") {
        try {
          const splitUrl = data.url ? String(data.url) : "";
          if (!splitUrl) return;
          const entry = this.windowHandlers.get(winId);
          const tabsApi = entry?.view?.tabsApi || null;
          try {
            if (tabsApi?.isSplitActive?.()) {
              tabsApi.navigateSplit(splitUrl);
              return;
            }
          } catch {}
          try {
            const tab = tabsApi?.addTab?.(splitUrl);
            if (tab) this.navigateSingleLayer(winId, tab.url || splitUrl);
            else this.navigateSingleLayer(winId, splitUrl);
          } catch {
            try {
              this.navigateSingleLayer(winId, splitUrl);
            } catch {}
          }
        } catch {}
        return;
      }
      if (data.type === "browser-new-window") {
        os.app.launch("browserApp", { isIncognito: !!data.incognito });
      } else if (data.type === "scram:setTorMode") {
        this.torEnabled = data.active;
        if (!data.active) this.exitTorMode();
      } else if (data.type === "browser-tor-reconnect") {
        this.reconnectTor();
      } else if (data.type === "browser-tor-download") {
        if (this.torEnabled && data.url) {
          this.loadWithTor(data.url);
        }
      } else if (data.type === "scram:proxyConfigChange") {
        if (data.wispUrl) os.storage.set(StorageKeys.wispServer, data.wispUrl);
        if (data.transport)
          os.storage.set(StorageKeys.browserTransport, data.transport);
      } else if (data.type === "scram:windowOpenInterceptGet") {
        try {
          e.source?.postMessage(
            {
              type: "scram:windowOpenInterceptState",
              enabled: getWindowOpenInterceptEnabled(),
            },
            "*",
          );
        } catch {}
      } else if (data.type === "scram:setWindowOpenIntercept") {
        const enabled = !!data.enabled;
        setWindowOpenPluginEnabled(os.storage, enabled);
        try {
          const activeView = this.element?.id
            ? this.windowHandlers.get(this.element.id)?.view
            : null;
          activeView?.tabsApi
            ?.getActive?.()
            ?.viewport?.contentWindow?.postMessage(
              { type: "scram:windowOpenInterceptState", enabled },
              "*",
            );
        } catch {}
      } else if (data.type === "browser-window-open") {
        const url = data.url;
        if (url) this.navigateSingleLayer(winId, String(url));
      } else if (data.type === "browser-popup-open") {
        const targetUrl = data.url ? String(data.url) : "";
        if (!targetUrl) return;
        if (!isPopupInterceptEnabled()) {
          this.navigateSingleLayer(winId, targetUrl);
          return;
        }
        try {
          createPopupWindow({
            parentAppId: "browserApp",
            parentName: "Browser",
            parentIcon: "static/icons/chrome.webp",
            url: targetUrl,
            pageTitle: data.pageTitle || targetUrl,
            features: data.specs || "",
          });
        } catch {}
      } else if (data.type === "scram:localRequest") {
        this.handleLocalRequest(data.url).then((result) => {
          try {
            e.source?.postMessage(
              { type: "scram:localResponse", id: data.id, ...result },
              "*",
            );
          } catch {}
        });
      } else if (data.type === "scram:localDownload") {
        this.handleLocalDownload(data.url);
      } else if (data.type === "browser-fetch-request") {
        this.handleBridgeFetchRequest(winId, data);
      } else if (data.type === "browser-open") {
        const openUrl = data.url ? String(data.url) : "";
        if (!openUrl) return;
        let intercepted = false;
        try {
          intercepted = isWindowOpenPluginEnabled(os.storage);
        } catch {
          intercepted = true;
        }
        if (intercepted) {
          try {
            const openEntry = this.windowHandlers.get(winId);
            const opened = openEntry?.view?.tabsApi?.addTab?.(openUrl);
            if (opened) {
              this.navigateSingleLayer(winId, opened.url || openUrl);
              return;
            }
          } catch {}
        }
        this.navigateSingleLayer(winId, openUrl);
      } else if (data.type === "browser-blocked") {
        try {
          const entry = this.windowHandlers.get(winId);
          if (entry) {
            entry.blockedCount = (entry.blockedCount || 0) + 1;
            entry.blockedPageCount = (entry.blockedPageCount || 0) + 1;
          }
        } catch {}
        let adblockOn = true;
        try {
          const stored = os.storage.get(StorageKeys.browserAdblockEnabled);
          adblockOn = stored === undefined || stored === null ? true : !!stored;
        } catch {
          adblockOn = true;
        }
        if (!adblockOn) return;
        os.notify.send(
          "Browser",
          "Blocked resource: " + String(data.url || data.kind || "unknown"),
          {
            type: "info",
            duration: 3000,
          },
        );
        try {
          const entry = this.windowHandlers.get(winId);
          const blockedTotal = entry?.blockedCount || 0;
          const adButton = entry?.view?.els?.adBtn || null;
          if (adButton && adButton.dataset) {
            adButton.dataset.tooltip =
              "Ad blocking is active. Blocked: " + blockedTotal;
          }
        } catch {}
        try {
          const entry = this.windowHandlers.get(winId);
          entry.view?.tabsApi?.recordBlocked?.(data.url || data.kind);
        } catch {}
        try {
          const blockedEntry = this.windowHandlers.get(winId);
          const popup = blockedEntry?.view?.els?.adPopup || null;
          if (popup && popup.classList.contains("open")) {
            this.updateAdblockPopup(winId);
          }
        } catch {}
      }
    };
    this.msgHandler = msgHandler;
    window.addEventListener("message", msgHandler);
    element.addEventListener("remove", () => this.onClose(winId), {
      once: true,
    });
    let settingsDebounce = null;
    const settingsChangedHandler = () => {
      if (settingsDebounce) return;
      settingsDebounce = setTimeout(() => {
        settingsDebounce = null;
        cachedThemeVars = null;
        try {
          getCachedThemeVars();
        } catch {}
        const current = this.windowHandlers.get(winId);
        try {
          current?.view?.tabsApi?.refresh?.();
        } catch {}
      }, 100);
    };
    this.settingsChangedHandler = settingsChangedHandler;
    os.events.on(BusEvents.SETTINGS_CHANGED, settingsChangedHandler);
    if (!this.focusListener) {
      this.focusListener = (data) => {
        try {
          this.focusedWinId = (data && data.winId) || null;
        } catch {}
      };
      try {
        os.events.on(BusEvents.WINDOW_FOCUSED, this.focusListener);
      } catch {}
    }
    const docKeyHandler = (event) => {
      try {
        if (this.focusedWinId !== winId) return;
      } catch {
        return;
      }
      try {
        if (
          element &&
          event.target instanceof Element &&
          element.contains(event.target)
        )
          return;
      } catch {}
      const target = event.target;
      if (target instanceof Element) {
        const tag = (target.tagName || "").toUpperCase();
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable)
          return;
      }
      for (let tabNum = 1; tabNum <= 9; tabNum += 1) {
        let matched = false;
        try {
          matched = KeybindManager.matches(event, "browser.tab" + tabNum);
        } catch {
          matched = false;
        }
        if (!matched) continue;
        try {
          event.preventDefault();
        } catch {}
        try {
          const live = this.windowHandlers.get(winId);
          const all = live?.view?.tabsApi?.getAll?.() || [];
          const picked = all[tabNum - 1];
          if (picked) live.view.tabsApi.switchTab(picked.id);
        } catch {}
        return;
      }
    };
    document.addEventListener("keydown", docKeyHandler);
    this.windowHandlers.set(winId, {
      root: rootContainer,
      view: null,
      win: element,
      msgHandler,
      settingsChangedHandler,
      docKeyHandler,
      lastUrl: initialUrl,
      blockedCount: 0,
      blockedPageCount: 0,
      observer: null,
    });
    let view = null;
    try {
      view = buildBrowserView(rootContainer, {
        initialUrl,
        appId: "browserApp",
        instanceNum,
        onNavigate: (url) => this.navigateSingleLayer(winId, url),
        onAction: (action) => this.handleBrowserAction(winId, action),
      });
    } catch {
      view = null;
    }
    if (!view) {
      try {
        injectFileProtocolFallback(rootContainer, "browserApp", initialUrl);
      } catch {}
      return;
    }
    const stored = this.windowHandlers.get(winId);
    if (stored) {
      stored.view = view;
      stored.root = view.root || rootContainer;
    }
    const header =
      view.els?.header ||
      view.header ||
      $(".browser-tab-strip", view.root) ||
      view.tabStrip ||
      $(".browser-address-row", view.root);
    if (header) {
      bindEvent(header, "mousedown", () => {
        try {
          os.window.focus(winId);
        } catch {}
      });
    }
    os.window.makeDraggable(element);
    os.window.makeResizable(element);
    this.navigateSingleLayer(winId, initialUrl);
  }
  handleBrowserAction(winId, action) {
    const entry = this.windowHandlers.get(winId);
    if (!entry || !entry.view) return;
    const view = entry.view;
    const tabsApi = view.tabsApi;
    const active = tabsApi?.getActive?.() || null;
    const raw =
      typeof action === "string"
        ? action
        : action?.id || action?.type || action?.action || "";
    const id = String(raw || "").toLowerCase();
    const payload = typeof action === "object" && action ? action : {};
    const syncAddress = (value) => {
      const target = value || active?.url || entry.lastUrl || "";
      if (!target) return;
      const field =
        view.addressInput ||
        $(".browser-address-input", view.root) ||
        $(".browser-address-input", entry.root);
      if (field) field.value = target;
    };
    const callBehavior = (names) => {
      for (const name of names) {
        try {
          if (tabsApi && typeof tabsApi[name] === "function") {
            tabsApi[name](active?.id);
            return true;
          }
        } catch {}
        try {
          if (active && typeof active[name] === "function") {
            active[name]();
            return true;
          }
        } catch {}
      }
      return false;
    };
    if (id === "minimize") {
      os.window.minimize(winId);
      return;
    }
    if (id === "maximize" || id === "toggle-maximize" || id === "zoom-window") {
      try {
        const el =
          (entry && entry.win) || document.getElementById(winId) || null;
        const target = el && el.dataset ? el : null;
        if (!target) {
          os.window.maximize(winId);
        } else if (target.dataset.snapZone === "maximize") {
          os.window.unsnap(target);
        } else {
          os.window.applySnap(target, "maximize");
        }
      } catch {
        try {
          os.window.maximize(winId);
        } catch {}
      }
      return;
    }
    if (id === "close" || id === "close-window") {
      os.window.close(winId);
      return;
    }
    if (id === "external" || id === "open-external") {
      try {
        const source = entry.win
          ? entry.win.outerHTML
          : document.documentElement.outerHTML;
        const blob = new Blob([source], { type: "text/html" });
        const objectUrl = URL.createObjectURL(blob);
        window.open(objectUrl, "_blank", "noopener");
        setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
      } catch {}
      return;
    }
    if (id === "new-tab") {
      const url = payload.url || "yuki://home";
      try {
        const tab = tabsApi?.addTab?.(url);
        if (tab) this.navigateSingleLayer(winId, tab.url || url);
        else this.navigateSingleLayer(winId, url);
      } catch {
        this.navigateSingleLayer(winId, url);
      }
      syncAddress(url);
      return;
    }
    if (id === "new-window") {
      const url = payload.url || active?.url || "yuki://home";
      os.app.launch("browserApp", { openUrl: url });
      return;
    }
    if (id === "back") {
      if (!callBehavior(["goBack", "back", "navigateBack"])) {
        if (active && Array.isArray(active.navStack) && active.navIndex > 0) {
          active.navIndex -= 1;
          this.navigateSingleLayer(winId, active.navStack[active.navIndex]);
        }
      }
      syncAddress(active?.url);
      return;
    }
    if (id === "fwd" || id === "forward") {
      if (!callBehavior(["goForward", "forward", "navigateForward"])) {
        if (
          active &&
          Array.isArray(active.navStack) &&
          active.navIndex < active.navStack.length - 1
        ) {
          active.navIndex += 1;
          this.navigateSingleLayer(winId, active.navStack[active.navIndex]);
        }
      }
      syncAddress(active?.url);
      return;
    }
    if (id === "reload" || id === "refresh") {
      if (!callBehavior(["reload", "refresh", "reloadTab"])) {
        const url = active?.url || entry.lastUrl || "";
        if (url) this.navigateSingleLayer(winId, url);
      }
      syncAddress(active?.url);
      return;
    }
    if (id === "home") {
      if (!callBehavior(["goHome", "home"])) {
        let homeUrl = "yuki://home";
        try {
          const storedHome = os.storage.get(StorageKeys.browserHomepage);
          if (storedHome) homeUrl = String(storedHome);
        } catch {}
        this.navigateSingleLayer(winId, homeUrl);
        syncAddress(homeUrl);
        return;
      }
      syncAddress(active?.url);
      return;
    }
    if (id === "google-lens") {
      this.navigateSingleLayer(winId, "https://www.google.com/imghp");
      syncAddress("https://www.google.com/imghp");
      return;
    }
    if (id === "new-private-window") {
      os.app.launch("browserApp", { isIncognito: true });
      return;
    }
    if (id === "star" || id === "toggle-bookmark") {
      try {
        tabsApi?.handleMenuAction?.("toggle-bookmark");
      } catch {}
      syncAddress(active?.url);
      return;
    }
    if (id === "bookmarks") {
      try {
        tabsApi?.handleMenuAction?.("bookmarks");
      } catch {}
      syncAddress(active?.url);
      return;
    }
    if (id === "history" || id === "show-history") {
      try {
        tabsApi?.handleMenuAction?.("history");
      } catch {}
      syncAddress(active?.url);
      return;
    }
    if (id === "downloads" || id === "show-downloads") {
      try {
        tabsApi?.handleMenuAction?.("downloads");
      } catch {}
      syncAddress(active?.url);
      return;
    }
    if (id === "reopen-tab" || id === "reopen") {
      try {
        tabsApi?.handleMenuAction?.("reopen-tab");
      } catch {}
      syncAddress(active?.url);
      return;
    }
    if (id === "save-page") {
      try {
        tabsApi?.handleMenuAction?.("save-page");
      } catch {}
      syncAddress(active?.url);
      return;
    }
    if (id === "screenshot") {
      try {
        tabsApi?.handleMenuAction?.("screenshot");
      } catch {}
      syncAddress(active?.url);
      return;
    }
    if (id === "devtools") {
      try {
        tabsApi?.handleMenuAction?.("devtools");
      } catch {}
      syncAddress(active?.url);
      return;
    }
    if (id === "clear-data" || id === "clear-browsing-data") {
      try {
        tabsApi?.handleMenuAction?.("clear-data");
      } catch {}
      syncAddress(active?.url);
      return;
    }
    if (id === "darkmode" || id === "dark-mode" || id === "toggle-darkmode") {
      try {
        tabsApi?.handleMenuAction?.("darkmode");
      } catch {}
      syncAddress(active?.url);
      return;
    }
    if (id === "zoom-in") {
      try {
        tabsApi?.handleMenuAction?.("zoom-in");
      } catch {}
      syncAddress(active?.url);
      return;
    }
    if (id === "zoom-out") {
      try {
        tabsApi?.handleMenuAction?.("zoom-out");
      } catch {}
      syncAddress(active?.url);
      return;
    }
    if (id === "wisp-settings" || id === "wisp" || id === "proxy-settings") {
      try {
        tabsApi?.handleMenuAction?.("wisp-settings");
      } catch {}
      syncAddress(active?.url);
      return;
    }
    if (id === "adblock") {
      this.showAdblockPopup(winId);
      syncAddress(active?.url);
      return;
    }
    if (id === "adblock-toggle") {
      const next = this.setAdblockEnabled(winId, !this.isAdblockEnabled());
      os.notify.send(
        "Browser",
        next ? "Ad blocking enabled." : "Ad blocking disabled.",
        {
          type: "info",
          duration: 3000,
        },
      );
      syncAddress(active?.url);
      return;
    }
    if (id === "open-blocking-log") {
      this.navigateSingleLayer(winId, "yuki://blocking-log");
      syncAddress("yuki://blocking-log");
      return;
    }
    if (id === "find" || id === "find-in-page") {
      try {
        tabsApi?.handleMenuAction?.("find");
      } catch {}
      syncAddress(active?.url);
      return;
    }
    if (id === "split" || id === "split-view") {
      try {
        tabsApi?.handleMenuAction?.("split");
      } catch {}
      syncAddress(active?.url);
      return;
    }
    if (id === "toggle-bookmarkbar") {
      try {
        tabsApi?.handleMenuAction?.("toggle-bookmarkbar");
      } catch {}
      syncAddress(active?.url);
      return;
    }
    if (id === "palette" || id === "command-palette") {
      try {
        document.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "p",
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
          }),
        );
      } catch {}
      syncAddress(active?.url);
      return;
    }
    if (id === "sidebar" || id === "toggle-sidebar") {
      callBehavior(["toggleSidebar", "sidebar"]);
      syncAddress(active?.url);
      return;
    }
    if (id === "sidebar-collapse" || id === "collapse-sidebar") {
      if (!callBehavior(["collapseSidebar", "toggleSidebar", "sidebar"])) {
        try {
          tabsApi?.refresh?.();
        } catch {}
      }
      syncAddress(active?.url);
      return;
    }
    if (id === "fullscreen" || id === "toggle-fullscreen") {
      if (!callBehavior(["toggleFullscreen", "fullscreen"])) {
        try {
          os.window.toggleFullscreen(winId);
        } catch {}
      }
      syncAddress(active?.url);
      return;
    }
    if (
      id === "menu" ||
      id === "menu-open" ||
      id === "menu-close" ||
      id === "open-menu"
    ) {
      callBehavior(["toggleMenu", "openMenu", "menu"]);
      syncAddress(active?.url);
      return;
    }
    if (id === "pdf-close") {
      this.closePdfViewer(winId);
      syncAddress(active?.url);
      return;
    }
    callBehavior([id]);
    syncAddress(active?.url);
  }
  isAdblockEnabled() {
    try {
      const stored = os.storage.get(StorageKeys.browserAdblockEnabled);
      return stored === undefined || stored === null ? true : !!stored;
    } catch {
      return true;
    }
  }
  setAdblockEnabled(winId, enabled) {
    const next = enabled === true;
    try {
      os.storage.set(StorageKeys.browserAdblockEnabled, next);
    } catch {}
    const entry = this.windowHandlers.get(winId);
    const adBtn = entry?.view?.els?.adBtn || null;
    if (adBtn) {
      adBtn.classList.toggle("active", next);
      adBtn.classList.toggle("inactive", !next);
      if (adBtn.dataset) {
        adBtn.dataset.tooltip = next
          ? "Ad blocking is active. Blocked: " + (entry?.blockedCount || 0)
          : "Ad blocking is off";
      }
    }
    this.updateAdblockPopup(winId);
    return next;
  }
  showAdblockPopup(winId) {
    const entry = this.windowHandlers.get(winId);
    const popup = entry?.view?.els?.adPopup || null;
    if (!popup) {
      return;
    }
    popup.classList.toggle("open");
    this.updateAdblockPopup(winId);
  }
  updateAdblockPopup(winId) {
    const entry = this.windowHandlers.get(winId);
    const els = entry?.view?.els || null;
    if (!els || !els.adPopup) {
      return;
    }
    const enabled = this.isAdblockEnabled();
    if (els.adPageNum) {
      setText(els.adPageNum, String(entry.blockedPageCount || 0));
    }
    if (els.adTotalNum) {
      setText(els.adTotalNum, String(entry.blockedCount || 0));
    }
    if (els.adPowerBtn) {
      els.adPowerBtn.classList.toggle("active", enabled);
      els.adPowerBtn.classList.toggle("inactive", !enabled);
      if (els.adPowerBtn.dataset) {
        els.adPowerBtn.dataset.tooltip = enabled
          ? "Turn ad blocking off"
          : "Turn ad blocking on";
      }
    }
  }
  closePdfViewer(winId) {
    try {
      const targetEntry = this.windowHandlers.get(winId);
      if (!targetEntry || !targetEntry.view || !targetEntry.view.els) return;
      const els = targetEntry.view.els;
      if (els.pdfViewer) removeClass(els.pdfViewer, "active");
      if (els.pdfBody) setHTML(els.pdfBody, "");
      if (els.pdfTitle) setText(els.pdfTitle, "PDF Document");
      if (els.pdfInfo) setText(els.pdfInfo, "-");
    } catch {}
  }
  async openPdfViewer(winId, entry, active, viewport, urlText) {
    const els = entry?.view?.els || null;
    if (!els || !els.pdfViewer || !els.pdfBody)
      throw new Error("PDF viewer unavailable");
    let filename = String(urlText || "");
    try {
      const parsed = new URL(String(urlText));
      const last = parsed.pathname.split("/").pop();
      if (last) filename = last;
    } catch {
      const parts = String(urlText).split(/[?#]/)[0].split("/");
      const last = parts.pop();
      if (last) filename = last;
    }
    try {
      filename = decodeURIComponent(filename);
    } catch {}
    addClass(els.pdfViewer, "active");
    if (els.pdfTitle) setText(els.pdfTitle, filename);
    if (els.pdfBody) setHTML(els.pdfBody, "");
    if (els.pdfInfo) setText(els.pdfInfo, "-");
    try {
      const pdfjsLib = await loadPdfjs();
      const fetched = await fetchViaWispRaw(urlText);
      const buffer = fetched?.buffer || null;
      if (!buffer) throw new Error("Empty PDF response");
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) })
        .promise;
      if (els.pdfInfo) setText(els.pdfInfo, pdf.numPages + " pages");
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const pageViewport = page.getViewport({ scale });
        const canvas = createElement("canvas");
        canvas.width = Math.floor(pageViewport.width);
        canvas.height = Math.floor(pageViewport.height);
        await page.render({
          canvasContext: canvas.getContext("2d"),
          viewport: pageViewport,
        }).promise;
        els.pdfBody.appendChild(canvas);
      }
    } catch (err) {
      try {
        this.closePdfViewer(winId);
      } catch {}
      throw err;
    }
  }
  async handleBridgeFetchRequest(winId, data) {
    const entry = this.windowHandlers.get(winId);
    if (!entry || !entry.view) return;
    const active = entry.view?.tabsApi?.getActive?.() || null;
    const viewport = active?.viewport || null;
    if (!viewport) return;
    try {
      const { fetchViaWisp } = await import("../shared/fileProtocolEngine.js");
      const result = await fetchViaWisp(data.url, {
        method: data.method || "GET",
        headers: data.headers || {},
      });
      const text = result.text || "";
      viewport.contentWindow?.postMessage(
        {
          type: "browser-fetch-response",
          id: data.id,
          ok: true,
          status: result.status || 200,
          text,
          contentType: result.contentType || "text/plain",
        },
        "*",
      );
    } catch (err) {
      try {
        viewport.contentWindow?.postMessage(
          {
            type: "browser-fetch-response",
            id: data.id,
            ok: false,
            status: 0,
            text: "",
            contentType: "text/plain",
            error: err?.message || String(err),
          },
          "*",
        );
      } catch {}
    }
  }
  async navigateSingleLayer(winId, rawUrl) {
    const entry = this.windowHandlers.get(winId);
    if (!entry) return;
    entry.blockedPageCount = 0;
    try {
      const navPopup = entry.view?.els?.adPopup || null;
      if (navPopup && navPopup.classList.contains("open")) {
        this.updateAdblockPopup(winId);
      }
    } catch {}
    const urlText = String(rawUrl || "");
    if (!urlText) return;
    entry.lastUrl = urlText;
    maybeTriggerSmartlink();
    if (!isDirectLoadUrl(urlText) && this.isTorUrl(urlText)) {
      this.loadWithTor(urlText);
      return;
    }
    let active = entry.view?.tabsApi?.getActive?.() || null;
    if (!active) {
      try {
        active = entry.view?.tabsApi?.addTab?.(urlText) || null;
      } catch {
        active = null;
      }
    }
    if (!active) return;
    const viewport = active.viewport || null;
    if (!viewport) return;
    try {
      this.closePdfViewer(winId);
    } catch {}
    try {
      const previewed = entry.view?.tabsApi?.previewNavigate?.(
        active.id,
        urlText,
      );
      if (previewed) active = previewed;
    } catch {}
    const reportDone = () => {
      try {
        entry.view?.tabsApi?.setProgress?.(100);
      } catch {}
      try {
        entry.view?.tabsApi?.clearStatus?.();
      } catch {}
    };
    try {
      entry.view?.tabsApi?.setStatusFor?.(urlText);
    } catch {}
    try {
      entry.view?.tabsApi?.setProgress?.(10);
    } catch {}
    const syncViewAddress = (value, title) => {
      const field =
        entry.view?.addressInput ||
        $(".browser-address-input", entry.view?.root) ||
        $(".browser-address-input", entry.root);
      if (field) field.value = value;
      active.url = value;
      if (title) active.title = title;
      else if (value) active.title = value;
      if (Array.isArray(active.navStack)) {
        const last = active.navStack[active.navIndex];
        if (last !== value) {
          active.navStack = active.navStack
            .slice(0, active.navIndex + 1)
            .concat([value]);
          active.navIndex = active.navStack.length - 1;
        }
      }
      try {
        entry.view?.tabsApi?.refresh?.();
      } catch {}
    };
    if (/^yuki:/i.test(urlText)) {
      active = entry.view?.tabsApi?.getActive?.() || active;
      let moved = null;
      try {
        moved = await entry.view?.tabsApi?.navigateTab?.(active?.id, urlText);
      } catch {}
      const settled = moved && moved.url ? moved : active;
      entry.lastUrl = (settled && settled.url) || urlText;
      syncViewAddress(
        entry.lastUrl,
        (settled && settled.title) || entry.lastUrl,
      );
      try {
        entry.view?.tabsApi?.refresh?.();
      } catch {}
      return;
    }
    if (/^(blob:|data:|about:)/i.test(urlText)) {
      try {
        viewport.removeAttribute("srcdoc");
        viewport.src = urlText;
      } catch {}
      syncViewAddress(urlText, urlText);
      reportDone();
      return;
    }
    if (isDirectLoadUrl(urlText)) {
      try {
        viewport.removeAttribute("srcdoc");
        viewport.src = urlText;
      } catch {}
      syncViewAddress(urlText, urlText);
      reportDone();
      return;
    }
    const localTarget = parseLocalTarget(urlText);
    if (localTarget) {
      try {
        const result = await this.handleLocalRequest(urlText);
        const title = result.title || urlText;
        if (result.blobUrl) {
          viewport.removeAttribute("srcdoc");
          viewport.src = result.blobUrl;
        } else if (result.html != null) {
          viewport.src = "about:blank";
          viewport.srcdoc = result.html;
        } else if (result.text != null) {
          viewport.src = "about:blank";
          viewport.srcdoc =
            "<!DOCTYPE html><html><body><pre>" +
            escapeHtml(String(result.text)) +
            "</pre></body></html>";
        }
        syncViewAddress(urlText, title);
        reportDone();
        return;
      } catch {}
    }
    if (/^https?:\/\//i.test(urlText)) {
      const cleanPath = String(urlText).split(/[?#]/)[0];
      if (cleanPath.toLowerCase().endsWith(".pdf")) {
        try {
          let filename = urlText;
          try {
            const parsed = new URL(urlText);
            const last = parsed.pathname.split("/").pop();
            if (last) filename = last;
          } catch {
            const parts = cleanPath.split("/");
            const last = parts.pop();
            if (last) filename = last;
          }
          try {
            filename = decodeURIComponent(filename);
          } catch {}
          await this.openPdfViewer(winId, entry, active, viewport, urlText);
          entry.lastUrl = urlText;
          syncViewAddress(urlText, filename);
          reportDone();
          return;
        } catch {}
      }
    }
    try {
      const outcome = await renderFileProtocolUrl(viewport, urlText);
      const finalUrl = outcome?.url || urlText;
      entry.lastUrl = finalUrl;
      syncViewAddress(finalUrl, outcome?.title || finalUrl);
      reportDone();
    } catch {
      try {
        viewport.src = "about:blank";
        viewport.srcdoc = this.buildLocalErrorPage(
          urlText,
          "Page failed to load",
          { dino: true },
        );
        syncViewAddress(urlText, urlText);
      } catch {}
      reportDone();
    }
  }
  isWindowOpenInterceptEnabled() {
    return isWindowOpenPluginEnabled(os.storage);
  }
  setWindowOpenInterceptEnabled(enabled) {
    setWindowOpenPluginEnabled(os.storage, !!enabled);
    try {
      const activeViewport = this.element?.id
        ? this.windowHandlers.get(this.element.id)?.view?.tabsApi?.getActive?.()
            ?.viewport
        : null;
      activeViewport?.contentWindow?.postMessage(
        { type: "scram:windowOpenInterceptState", enabled: !!enabled },
        "*",
      );
    } catch {}
    return !!enabled;
  }
  getWindowOpenPluginStatus() {
    return {
      id: "windowOpenInNewTab",
      enabled: this.isWindowOpenInterceptEnabled(),
    };
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
    this.torIframe = null;
    this.element = null;
  }
  openHtml(content, name, path) {
    const blob = new Blob([content], { type: "text/html" });
    const blobUrl = URL.createObjectURL(blob);
    const activeId = this.element?.id || [...this.windowHandlers.keys()].pop();
    if (activeId && this.windowHandlers.has(activeId)) {
      this.navigateSingleLayer(activeId, blobUrl);
    } else {
      os.app.launch("browserApp", { openUrl: blobUrl });
    }
  }
  navigateToUrl(target, url) {
    const rawUrl = url ?? target;
    let winId = null;
    if (typeof target === "string" && this.windowHandlers.has(target))
      winId = target;
    else if (this.element?.id && this.windowHandlers.has(this.element.id))
      winId = this.element.id;
    else winId = [...this.windowHandlers.keys()].pop() || null;
    if (!winId) return;
    this.navigateSingleLayer(winId, rawUrl);
  }
  async handleLocalRequest(url) {
    const target = parseLocalTarget(url);
    if (!target) {
      return {
        status: 400,
        contentType: "text/html",
        html: this.buildLocalErrorPage(url, "Unsupported local address"),
        title: "Error",
      };
    }
    if (target.kind === "port") {
      const portEntry = os.ports.get(target.port);
      if (!portEntry) {
        const cleanUrl = String(url).replace(/\/+$/, "");
        const refusedUrl = cleanUrl || "localhost:" + target.port;
        return {
          status: 404,
          contentType: "text/html",
          html: this.buildLocalErrorPage(
            refusedUrl,
            "This site cannot be reached",
            {
              title: "This site cannot be reached",
              detail: refusedUrl + " refused to connect.",
              code: "ERR_CONNECTION_REFUSED",
              dino: true,
            },
          ),
          title: "This site cannot be reached",
        };
      }
      try {
        const request = { method: "GET", url: target.path, headers: {} };
        const response = await portEntry.handler(request);
        return await this.convertLocalResponse(response, target, portEntry);
      } catch (err) {
        return {
          status: 500,
          contentType: "text/html",
          html: this.buildLocalErrorPage(
            url,
            "Server error: " + String(err?.message || err),
          ),
          title: "Server error",
        };
      }
    }
    return await this.resolveVirtualPath(target.path);
  }
  async convertLocalResponse(response, target, portEntry) {
    const status = response?.status ?? 200;
    let contentType = "application/octet-stream";
    const headers = response?.headers;
    if (headers && isFunction(headers.get)) {
      const ct = headers.get("content-type");
      if (ct) contentType = ct;
    } else if (headers && typeof headers === "object") {
      contentType =
        headers["content-type"] || headers["Content-Type"] || contentType;
    }
    const base = contentType.split(";")[0].trim();
    const title = "localhost:" + target.port;
    if (base.includes("html")) {
      const text = isFunction(response.text)
        ? await response.text()
        : String(response?.body ?? "");
      const fsBase = [
        ...(portEntry?.root || []),
        ...splitPath(target.path).slice(0, -1),
      ];
      const html = await this.processHtmlContent(text, fsBase);
      return { status, contentType: base, html, title };
    }
    if (isTextContentType(base) && !base.startsWith("image/")) {
      const text = isFunction(response.text)
        ? await response.text()
        : String(response?.body ?? "");
      return { status, contentType: base, text, title };
    }
    try {
      const clone = isFunction(response.clone) ? response.clone() : null;
      if (clone && isFunction(clone.text)) {
        const probe = await clone.text();
        if (/^\s*<!DOCTYPE\s+html|^\s*<html[\s>]/i.test(probe)) {
          const fsBase = [
            ...(portEntry?.root || []),
            ...splitPath(target.path).slice(0, -1),
          ];
          const html = await this.processHtmlContent(probe, fsBase);
          return { status, contentType: "text/html", html, title };
        }
      }
    } catch {}
    let blob = null;
    try {
      blob = isFunction(response.blob) ? await response.blob() : null;
    } catch {}
    if (!blob && response?.body != null) {
      blob = new Blob([response.body], { type: base });
    }
    if (!blob) {
      return {
        status: 500,
        contentType: "text/html",
        html: this.buildLocalErrorPage(target.path, "Server returned no body"),
        title,
      };
    }
    return {
      status,
      contentType: base,
      blobUrl: URL.createObjectURL(blob),
      title,
    };
  }
  async resolveVirtualPath(inputPath) {
    const segments = splitPath(inputPath);
    const pathStr = joinPath(segments);
    const name = segments[segments.length - 1] || "";
    const dirSegments = segments.slice(0, -1);
    const dirStr = joinPath(dirSegments);
    if (!name) {
      return await this.serveVirtualDirectory(segments, pathStr);
    }
    if (dirStr && !(await os.fs.exists(dirStr))) {
      return {
        status: 404,
        contentType: "text/html",
        html: this.buildLocalErrorPage(
          inputPath,
          "Directory not found: /" + dirStr,
        ),
        title: "Not Found",
      };
    }
    const entries = await os.fs.readdir(dirStr || "/");
    const found = entries[name];
    if (!found) {
      return {
        status: 404,
        contentType: "text/html",
        html: this.buildLocalErrorPage(
          inputPath,
          "File not found: /" + pathStr,
        ),
        title: "Not Found",
      };
    }
    if (isDirEntry(found)) {
      return await this.serveVirtualDirectory(segments, pathStr);
    }
    return await this.serveVirtualFile(segments, dirSegments, name, pathStr);
  }
  async serveVirtualDirectory(segments, pathStr) {
    const entries = await os.fs.readdir(pathStr || "/");
    const base = "fs:///" + (pathStr ? pathStr + "/" : "");
    const html = buildDirectoryHtml(pathStr, entries, null, {
      theme: readOsTheme(),
      base,
    });
    return {
      status: 200,
      contentType: "text/html",
      html,
      title: "Index of /" + pathStr,
    };
  }
  async serveVirtualFile(segments, dirSegments, name, pathStr) {
    const mime = getMimeType(name);
    const isMedia =
      mime.startsWith("image/") ||
      mime.startsWith("video/") ||
      mime.startsWith("audio/") ||
      mime === "application/pdf";
    if (mime.includes("html")) {
      const text = await os.fs.read(pathStr);
      const html = await this.processHtmlContent(
        text || "",
        segments.slice(0, -1),
      );
      return { status: 200, contentType: mime, html, title: name };
    }
    if (!isMedia && isTextContentType(mime)) {
      const text = await os.fs.read(pathStr);
      return { status: 200, contentType: mime, text: text ?? "", title: name };
    }
    const dirStr = joinPath(dirSegments) || "/";
    let blob = await os.fs.readBinaryFile(dirStr, name);
    if (!blob) {
      const content = await os.fs.getFileContent(dirStr, name);
      blob =
        content instanceof Blob
          ? content
          : content != null
            ? new Blob([String(content)], { type: mime })
            : null;
    }
    if (!blob) {
      return {
        status: 500,
        contentType: "text/html",
        html: this.buildLocalErrorPage(pathStr, "Could not read file: " + name),
        title: "Read error",
      };
    }
    return {
      status: 200,
      contentType: mime,
      blobUrl: URL.createObjectURL(blob),
      title: name,
    };
  }
  async processHtmlContent(html, baseSegments) {
    let doc;
    try {
      doc = new DOMParser().parseFromString(html, "text/html");
    } catch {
      return html;
    }
    if (!doc.documentElement) return html;
    const base = baseSegments || [];
    const tags = [
      "img",
      "script",
      "link",
      "video",
      "audio",
      "source",
      "track",
      "iframe",
      "embed",
    ];
    for (const tag of tags) {
      const attr = tag === "link" ? "href" : "src";
      const elements = doc.querySelectorAll(tag + "[" + attr + "]");
      for (const element of elements) {
        const value = element.getAttribute(attr);
        if (!value) continue;
        if (
          /^(https?:|data:|blob:|mailto:|#|javascript:|about:)/i.test(
            value.trim(),
          )
        )
          continue;
        const target = this.resolveHtmlReference(base, value);
        if (!target) continue;
        const blobUrl = await this.htmlResourceToBlobUrl(target);
        if (blobUrl) element.setAttribute(attr, blobUrl);
      }
    }
    if (html.indexOf("scram-local-nav") === -1) {
      const script = doc.createElement("script");
      script.textContent = buildFsInterceptScript(
        "fs:///" + (base.length ? base.join("/") + "/" : ""),
      );
      (doc.head || doc.documentElement).appendChild(script);
    }
    return "<!DOCTYPE html>" + doc.documentElement.outerHTML;
  }
  resolveHtmlReference(baseSegments, ref) {
    let clean = ref.split(/[?#]/)[0];
    if (!clean) return null;
    if (clean.startsWith("fs://")) clean = clean.slice(5);
    if (clean.startsWith("/")) return splitPath(clean);
    if (/^[a-z][a-z0-9+.-]*:/i.test(clean)) return null;
    const result = [...baseSegments];
    for (const part of clean.split("/")) {
      if (!part || part === ".") continue;
      if (part === "..") result.pop();
      else result.push(part);
    }
    return result;
  }
  async htmlResourceToBlobUrl(segments) {
    const pathStr = joinPath(segments);
    const dirSegments = segments.slice(0, -1);
    const name = segments[segments.length - 1] || "";
    if (!name) return null;
    const mime = getMimeType(name);
    const isMedia =
      mime.startsWith("image/") ||
      mime.startsWith("video/") ||
      mime.startsWith("audio/") ||
      mime === "application/pdf";
    try {
      if (!isMedia && isTextContentType(mime)) {
        const text = await os.fs.read(pathStr);
        if (text == null) return null;
        return URL.createObjectURL(new Blob([text], { type: mime }));
      }
      const dirStr = joinPath(dirSegments) || "/";
      let blob = await os.fs.readBinaryFile(dirStr, name);
      if (!blob) {
        const content = await os.fs.getFileContent(dirStr, name);
        blob =
          content instanceof Blob
            ? content
            : content != null
              ? new Blob([String(content)], { type: mime })
              : null;
      }
      if (!blob) return null;
      return URL.createObjectURL(blob);
    } catch {
      return null;
    }
  }
  buildLocalErrorPage(url, message, options = {}) {
    const theme = readOsTheme();
    const title = escapeHtml(String(options.title || "Error"));
    if (options.dino) {
      return (
        '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' +
        title +
        "</title><style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;color:" +
        theme.text +
        ";font-family:system-ui,-apple-system,sans-serif}.offline{width:100%;max-width:640px;padding:20px;text-align:center}.dino{border:1px solid " +
        theme.border +
        ";border-radius:12px;overflow:hidden;background:" +
        theme.surface +
        "}.dino-frame{display:block;width:100%;height:210px;border:0}.offline-msg{font-size:20px;font-weight:500;margin-top:20px;text-align:left}.offline-try{font-size:14px;color:" +
        theme.textMuted +
        ";margin-top:14px;text-align:left;margin-left:auto;margin-right:auto}.offline-try ul{list-style:disc;padding-left:20px;margin:6px 0 0}.offline-try li{margin-top:4px}.offline-code{font-family:ui-monospace,monospace;font-size:13px;color:" +
        theme.textMuted +
        ";margin-top:16px;text-align:left}</style></head><body><div class='offline'><div class='dino'><iframe class='dino-frame' srcdoc='" +
        escapeDinoGameAttr() +
        "' title='T-Rex Runner' loading='lazy'></iframe></div><div class='offline-msg'>There is no Internet connection.</div><div class='offline-try'>Try:<ul><li>Checking the network cables, modem and router</li><li>Reconnecting to Wi-Fi</li></ul></div><div class='offline-code'>" +
        (options.code
          ? escapeHtml(String(options.code))
          : "ERR_CONNECTION_REFUSED") +
        "</div></div></body></html>"
      );
    }
    const detail = options.detail
      ? '<div class="detail">' + escapeHtml(String(options.detail)) + "</div>"
      : "";
    const code = options.code
      ? '<div class="code">' + escapeHtml(String(options.code)) + "</div>"
      : "";
    return (
      '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' +
      title +
      "</title><style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;color:" +
      theme.text +
      ";font-family:system-ui,-apple-system,sans-serif}.wrap{text-align:center;max-width:520px;padding:20px}.badge{width:56px;height:56px;margin:0 auto 16px;border-radius:14px;background:" +
      theme.surface +
      ";border:1px solid " +
      theme.border +
      ";display:flex;align-items:center;justify-content:center;color:" +
      theme.error +
      ";font-size:26px;font-weight:700}.msg{font-size:20px;font-weight:600;margin-bottom:8px}.url{font-size:13px;color:" +
      theme.textMuted +
      ";word-break:break-all}.detail{font-size:14px;color:" +
      theme.textMuted +
      ";margin-top:10px}.code{display:inline-block;margin-top:14px;padding:4px 10px;border:1px solid " +
      theme.border +
      ";border-radius:6px;background:" +
      theme.surface +
      ";color:" +
      theme.textMuted +
      ';font-family:ui-monospace,monospace;font-size:12px}</style></head><body><div class="wrap"><div class="badge">!</div><div class="msg">' +
      escapeHtml(message) +
      '</div><div class="url">' +
      escapeHtml(url) +
      "</div>" +
      detail +
      code +
      "</div></body></html>"
    );
  }
  async handleLocalDownload(url) {
    const result = await this.handleLocalRequest(url);
    try {
      if (result.blobUrl) {
        const blob = await (await fetch(result.blobUrl)).blob();
        this.triggerDownload(blob, url);
      } else if (result.text != null) {
        this.triggerDownload(
          new Blob([result.text], { type: result.contentType || "text/plain" }),
          url,
        );
      }
    } catch {}
  }
  enterTorMode() {
    if (this.torOverlay) return;
    const container = $(".browser-root", this.element);
    if (!container) return;
    const overlay = createElement("div", { className: "tor-overlay" });
    overlay.innerHTML = `
      <div class="tor-bar">
        <span class="tor-bar-label"><i class="fas fa-shield-halved"></i> Tor Active</span>
        <button class="tor-exit-btn">Exit Tor</button>
      </div>
      <div class="tor-loading yuki-loading-indicator">
        <div class="loading-spinner"></div>
        <div class="tor-loading-text">Starting Tor...</div>
      </div>
      <iframe class="tor-iframe" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>
    `;
    const exitBtn = $(".tor-exit-btn", overlay);
    if (exitBtn) {
      exitBtn.addEventListener("click", () => {
        this.exitTorMode();
        this.torEnabled = false;
        try {
          const activeView = this.element?.id
            ? this.windowHandlers.get(this.element.id)?.view
            : null;
          activeView?.tabsApi
            ?.getActive?.()
            ?.viewport?.contentWindow?.postMessage(
              { type: "scram:torMode", active: false },
              "*",
            );
        } catch {}
      });
    }
    container.appendChild(overlay);
    this.torOverlay = overlay;
    this.torIframe = $(".tor-iframe", overlay);
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
    const el = $(".tor-loading", this.torOverlay);
    const txt = $(".tor-loading-text", this.torOverlay);
    if (el) setStyle(el, { display: "flex" });
    if (txt) txt.textContent = text || "Starting Tor...";
  }
  hideTorLoading() {
    const el = $(".tor-loading", this.torOverlay);
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
      os.notify.send("Tor Error", "Failed to start Tor: " + e.message, {
        type: "error",
        duration: 5000,
      });
      return false;
    }
  }
  async reconnectTor() {
    try {
      await os.tor.reconnect();
      os.notify.send("Tor", "Tor reconnected.", {
        type: "success",
        duration: 3000,
      });
      if (this.torClient) {
        this.torClient.close();
        this.torClient = null;
      }
    } catch {
      os.notify.send("Tor", "Reconnect failed. Try again.", {
        type: "error",
        duration: 5000,
      });
    }
  }
  async loadWithTor(url) {
    this.enterTorMode();
    this.showTorLoading("Preparing Tor connection...");
    try {
      if (!this.torClient) {
        const torReady = await this.startTorWithStatus();
        if (!torReady) {
          this.writeTorErrorPage(
            url,
            "Tor could not start. Check your connection.",
          );
          return;
        }
        this.torClient = await os.tor.createClient();
      }
      this.showTorLoading("Fetching " + url);
      const resp = await Promise.race([
        this.torClient.fetch(url),
        new Promise((resolveFn, rejectFn) =>
          setTimeout(() => rejectFn(new Error("Tor fetch timed out")), 30000),
        ),
      ]);
      if (!resp || resp.status >= 400)
        throw new Error("HTTP " + (resp?.status || "error"));
      const ct =
        typeof resp.headers === "object" && resp.headers
          ? resp.headers["content-type"] ||
            resp.headers.get?.("content-type") ||
            ""
          : "";
      const isBinary =
        ct.includes("application/octet-stream") ||
        ct.includes("application/zip") ||
        ct.includes("application/pdf") ||
        (ct &&
          !ct.includes("text") &&
          !ct.includes("json") &&
          !ct.includes("html") &&
          !ct.includes("xml"));
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
        fc > 5
          ? "Tor connection may be stale (" + fc + " fetches served)."
          : "Tor failed to load this page.",
        true,
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
      ? '<button class="tor-reconnect-btn">Reconnect Tor</button>'
      : "";
    iframe.srcdoc =
      "<html><body><div>" +
      (message || "All proxies failed to load this page.") +
      "</div><div>" +
      url +
      "</div>" +
      reconnectHtml +
      "</body></html>";
    if (showReconnect) {
      const onLoad = () => {
        iframe.onload = null;
        try {
          const btn = $(".tor-reconnect-btn", iframe.contentDocument);
          if (btn) btn.addEventListener("click", () => this.reconnectTor());
        } catch {}
      };
      iframe.onload = onLoad;
    }
  }
  triggerDownload(blob, url) {
    let name = "download";
    try {
      name = new URL(url).pathname.split("/").pop() || "download";
    } catch {}
    const objectUrl = URL.createObjectURL(blob);
    const a = createElement("a", {
      attributes: { href: objectUrl, download: name },
    });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
  }
  isTorUrl(url) {
    if (
      !url ||
      url.startsWith("about:") ||
      url.startsWith("blob:") ||
      url.startsWith("yuki://")
    )
      return false;
    if (this.torEnabled) return true;
    try {
      return os.storage.get(StorageKeys.browserTorEnabled) === true;
    } catch {
      return false;
    }
  }
}
