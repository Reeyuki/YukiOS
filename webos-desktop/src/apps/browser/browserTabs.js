import { os, StorageKeys } from "../../framework.js";
import {
  $,
  $$,
  createElement,
  bindEvent,
  setStyle,
  setText,
} from "../../shared/domUtils.js";
import { renderFileProtocolUrl } from "../../shared/fileProtocolEngine.js";
import {
  getWispUrl,
  WISP_SERVERS,
  DEFAULT_WISP_URL,
} from "../../shared/wispConfig.js";
import { getLibraryUrl } from "../../shared/cdnConfig.js";
import {
  getActiveTransport,
  resetTransports,
  checkWispHealth,
} from "../../shared/transportRouter.js";
import { buildYukiHomeSrcdoc } from "./yukiHome.js";
import { escapeDinoGameAttr } from "../../shared/dino/dinoGame.js";
import {
  isPluginEnabled as isWindowOpenPluginEnabled,
  setPluginEnabled as setWindowOpenPluginEnabled,
} from "./plugins/windowOpenInNewTab.js";
const DEFAULT_TAB_URL = "yuki://home";
const HOME_URL = "yuki://home";
const SEARCH_BASE = "https://search.brave.com/search?q=";
const SEARCH_ENGINES = {
  brave: { name: "Brave", url: "https://search.brave.com/search?q=" },
  duckduckgo: { name: "DuckDuckGo", url: "https://duckduckgo.com/?q=" },
  google: { name: "Google", url: "https://www.google.com/search?q=" },
  bing: { name: "Bing", url: "https://www.bing.com/search?q=" },
  startpage: {
    name: "Startpage",
    url: "https://www.startpage.com/sp/search?query=",
  },
  qwant: { name: "Qwant", url: "https://www.qwant.com/?q=" },
  yahoo: { name: "Yahoo", url: "https://search.yahoo.com/search?p=" },
  ecosia: { name: "Ecosia", url: "https://www.ecosia.org/search?q=" },
  mojeek: { name: "Mojeek", url: "https://www.mojeek.com/search?q=" },
};
const BING_REGION_MARKETS = {
  us: "en-US",
  uk: "en-GB",
  de: "de-DE",
  fr: "fr-FR",
  jp: "ja-JP",
  br: "pt-BR",
};
const FAVICON_BASE = "https://www.google.com/s2/favicons?domain=";
const FAVICON_TAIL = "&sz=32";
const USER_AGENT_PRESETS = [
  { id: "default", name: "Default", ua: "" },
  {
    id: "chrome_win",
    name: "Chrome (Win 11)",
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  },
  {
    id: "firefox_mac",
    name: "Firefox (macOS)",
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:127.0) Gecko/20100101 Firefox/127.0",
  },
  {
    id: "safari_ios",
    name: "Safari (iOS)",
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  },
  {
    id: "edge_win",
    name: "Edge (Win 11)",
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0",
  },
];
const YUKI_HOME_ICON =
  "https://cdn.jsdelivr.net/gh/NaoTomori1/YukiOS@main/static/icons/logo.png";
const VIEWPORT_SANDBOX =
  "allow-scripts allow-forms allow-same-origin allow-popups allow-top-navigation-by-user-activation allow-modals";
const FALLBACK_WISP = "wss://probuildingsupplies.com/w/";
const MAX_HISTORY = 500;
const MAX_CLOSED = 20;
const MAX_SUGGEST = 8;
const BLOCKED_LOG_CAP = 200;
const blockedLog = [];
let htmlCanvasPromise = null;
function loadHtmlCanvas() {
  if (!htmlCanvasPromise) {
    htmlCanvasPromise = import(getLibraryUrl("html2canvasPro")).catch(
      () => null,
    );
  }
  return htmlCanvasPromise;
}
function evaluateMathExpression(text) {
  const source = String(text || "");
  if (source.length === 0 || source.length > 100) return null;
  if (!/^[0-9+\-*/().\s%^,]+$/.test(source)) return null;
  if (!/[+\-*/%^]/.test(source)) return null;
  if (!/\d/.test(source)) return null;
  const cleaned = source.replace(/,/g, "");
  let pos = 0;
  function peek() {
    return cleaned[pos] || "";
  }
  function consume() {
    const ch = cleaned[pos] || "";
    pos += 1;
    return ch;
  }
  function skipSpaces() {
    while (peek() === " " || peek() === "\t" || peek() === "\n") pos += 1;
  }
  function parseNumber() {
    skipSpaces();
    let num = "";
    let dots = 0;
    while (/[0-9.]/.test(peek())) {
      if (peek() === ".") dots += 1;
      num += consume();
    }
    if (!num || dots > 1 || num === ".") return null;
    const val = Number(num);
    return Number.isFinite(val) ? val : null;
  }
  function parsePrimary() {
    skipSpaces();
    if (peek() === "(") {
      consume();
      const val = parseExpression();
      if (val === null) return null;
      skipSpaces();
      if (peek() !== ")") return null;
      consume();
      return val;
    }
    return parseNumber();
  }
  function parseUnary() {
    skipSpaces();
    if (peek() === "-") {
      consume();
      const val = parseUnary();
      return val === null ? null : -val;
    }
    if (peek() === "+") {
      consume();
      return parseUnary();
    }
    return parsePrimary();
  }
  function parseFactor() {
    const base = parseUnary();
    if (base === null) return null;
    skipSpaces();
    if (peek() === "^") {
      consume();
      const exp = parseFactor();
      if (exp === null) return null;
      return Math.pow(base, exp);
    }
    return base;
  }
  function parseTerm() {
    let val = parseFactor();
    if (val === null) return null;
    for (;;) {
      skipSpaces();
      const op = peek();
      if (op !== "*" && op !== "/" && op !== "%") return val;
      consume();
      const rhs = parseFactor();
      if (rhs === null) return null;
      if (op === "*") val = val * rhs;
      else if (op === "/") val = val / rhs;
      else val = val % rhs;
    }
  }
  function parseExpression() {
    let val = parseTerm();
    if (val === null) return null;
    for (;;) {
      skipSpaces();
      const op = peek();
      if (op !== "+" && op !== "-") return val;
      consume();
      const rhs = parseTerm();
      if (rhs === null) return null;
      if (op === "+") val = val + rhs;
      else val = val - rhs;
    }
  }
  const result = parseExpression();
  if (result === null) return null;
  skipSpaces();
  if (pos !== cleaned.length) return null;
  if (!Number.isFinite(result)) return "Error";
  const rounded = Math.round(result * 1e10) / 1e10;
  const text2 = String(rounded);
  if (text2.length > 21) return String(Number(result.toExponential(6)));
  return text2;
}
export function createTabsStore(viewportContainer, opts = {}) {
  const tabs = [];
  const closedStack = [];
  const downloadList = [];
  const state = { activeId: null, counter: 0 };
  const splitState = { splitId: null };
  const findState = { matches: [], current: -1, query: "" };
  const yukiState = {
    active: false,
    kind: null,
    prevUrl: null,
    prevTitle: null,
  };
  const rootNode =
    opts.root ||
    (viewportContainer && viewportContainer.parentElement) ||
    viewportContainer;
  const syncCallback = opts.onAddressSync || opts.syncAddress || null;
  const actionCallback = opts.onAction || null;
  const progressCallback = opts.onProgress || null;
  const sidebarModeCallback =
    typeof opts.onSidebarMode === "function" ? opts.onSidebarMode : null;
  let omniboxIndex = -1;
  let omniboxResults = [];
  let changeListener = null;
  function setChangeListener(fn) {
    changeListener = typeof fn === "function" ? fn : null;
  }
  function notifyChange() {
    if (typeof changeListener === "function") {
      try {
        changeListener();
      } catch (notifyErr) {
        return;
      }
    }
  }
  let zoomLevel = 1.0;
  let sidebarCollapsed =
    safeGet(StorageKeys.browserSidebarCollapsed, false) === true;
  let darkModeOn = false;
  try {
    const storedZoom = os.storage.get(StorageKeys.browserZoom);
    const parsedZoom = parseFloat(storedZoom);
    if (Number.isFinite(parsedZoom) && parsedZoom >= 0.3 && parsedZoom <= 3.0)
      zoomLevel = parsedZoom;
  } catch (storeErr) {
    zoomLevel = 1.0;
  }
  function safeGet(key, fallback) {
    try {
      const value = os.storage.get(key);
      return value === undefined || value === null ? fallback : value;
    } catch (storeErr) {
      return fallback;
    }
  }
  function safeSet(key, value) {
    try {
      os.storage.set(key, value);
    } catch (storeErr) {
      return;
    }
  }
  function getCustomEngines() {
    const stored = safeGet(StorageKeys.browserCustomEngines, []);
    return Array.isArray(stored) ? stored : [];
  }
  function saveCustomEngines(list) {
    safeSet(StorageKeys.browserCustomEngines, Array.isArray(list) ? list : []);
  }
  function getAllEngines() {
    const custom = getCustomEngines();
    const combined = Object.assign({}, SEARCH_ENGINES);
    for (let i = 0; i < custom.length; i += 1) {
      const entry = custom[i];
      if (entry && entry.name && entry.url)
        combined["custom_" + i] = { name: entry.name, url: entry.url };
    }
    return combined;
  }
  function getSearchBase() {
    const storedKey = safeGet(StorageKeys.browserSearchEngine, "brave");
    const region = safeGet(StorageKeys.browserSearchRegion, "");
    const customList = getCustomEngines();
    let base = SEARCH_BASE;
    let activeKey = "brave";
    if (typeof storedKey === "string" && storedKey.startsWith("custom_")) {
      const parsed = parseInt(storedKey.slice(7), 10);
      if (
        Number.isFinite(parsed) &&
        customList[parsed] &&
        customList[parsed].url
      ) {
        base = customList[parsed].url;
        activeKey = storedKey;
      } else {
        base = SEARCH_ENGINES.brave.url;
        activeKey = "brave";
      }
    } else if (typeof storedKey === "string" && SEARCH_ENGINES[storedKey]) {
      base = SEARCH_ENGINES[storedKey].url;
      activeKey = storedKey;
    } else {
      base = SEARCH_ENGINES.brave.url;
      activeKey = "brave";
    }
    if (region) {
      if (activeKey === "google")
        base = base + "&gl=" + encodeURIComponent(region);
      else if (activeKey === "duckduckgo")
        base = base + "&kl=" + encodeURIComponent(region) + "-en";
      else if (activeKey === "bing" && BING_REGION_MARKETS[region]) {
        base = base + "&mkt=" + encodeURIComponent(BING_REGION_MARKETS[region]);
      }
    }
    return base;
  }
  function getCustomWisps() {
    const stored = safeGet(StorageKeys.browserCustomWisps, []);
    if (!Array.isArray(stored)) return [];
    const kept = stored.filter(
      (entry) => entry && entry.url !== "wss://reeyukiwisp.onrender.com/",
    );
    if (kept.length !== stored.length)
      safeSet(StorageKeys.browserCustomWisps, kept);
    return kept;
  }
  function saveCustomWisps(list) {
    safeSet(StorageKeys.browserCustomWisps, Array.isArray(list) ? list : []);
  }
  function getDarkExclusions() {
    const stored = safeGet(StorageKeys.browserDarkExclusions, {});
    if (stored && typeof stored === "object" && !Array.isArray(stored))
      return stored;
    return {};
  }
  function saveDarkExclusions(map) {
    safeSet(
      StorageKeys.browserDarkExclusions,
      map && typeof map === "object" ? map : {},
    );
  }
  function persistOpenTabs() {
    try {
      const urls = [];
      for (let i = 0; i < tabs.length; i += 1) {
        const current = tabs[i] && tabs[i].url ? String(tabs[i].url) : "";
        if (/^https?:\/\//i.test(current)) urls.push(current);
        if (urls.length >= 25) break;
      }
      safeSet(StorageKeys.browserOpenTabs, urls);
    } catch (persistErr) {
      return;
    }
  }
  function syncAdblockButtons(enabled) {
    if (!rootNode) return;
    const buttons = $$('[id^="adblock-btn"]', rootNode);
    buttons.forEach((btn) => {
      btn.classList.toggle("active", enabled === true);
      btn.classList.toggle("inactive", enabled !== true);
    });
  }
  function applyDarkModeForUrl(targetUrl) {
    if (!rootNode) return;
    let hostname = "";
    try {
      const parsed = new URL(String(targetUrl));
      hostname = parsed.hostname || "";
    } catch (parseErr) {
      hostname = "";
    }
    const exclusions = getDarkExclusions();
    if (hostname && exclusions && exclusions[hostname]) {
      rootNode.classList.remove("browser-darkmode");
      return;
    }
    const storedDark = safeGet(StorageKeys.browserDarkMode, false);
    const enabled = storedDark === true;
    rootNode.classList.toggle("browser-darkmode", enabled);
    darkModeOn = enabled;
  }
  function notifyAddress(url) {
    if (typeof syncCallback === "function") syncCallback(url);
  }
  function emitAction(action, payload) {
    if (typeof actionCallback === "function") actionCallback(action, payload);
  }
  function normalizeUrl(raw) {
    const trimmed = String(raw || "").trim();
    if (!trimmed) return DEFAULT_TAB_URL;
    if (
      trimmed.startsWith("yuki://") ||
      trimmed.startsWith("fs://") ||
      trimmed.startsWith("file://") ||
      trimmed.startsWith("/")
    )
      return trimmed;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return trimmed;
    if (
      trimmed.includes(" ") ||
      /^[^\s@]+\.[^\s@]+(\/.*)?$/.test(trimmed) === false
    )
      return getSearchBase() + encodeURIComponent(trimmed);
    return "https://" + trimmed;
  }
  function titleFromUrl(url) {
    const text = String(url || "");
    if (text.startsWith("yuki://")) {
      const kind = text.replace("yuki://", "");
      return kind.charAt(0).toUpperCase() + kind.slice(1);
    }
    try {
      const parsed = new URL(text);
      return parsed.hostname || text;
    } catch (parseErr) {
      const parts = text.split("/");
      return parts.pop() || text;
    }
  }
  function faviconForUrl(url) {
    const text = String(url || "");
    if (text === "yuki://home" || text === "yuki://newtab")
      return YUKI_HOME_ICON;
    try {
      const parsed = new URL(text);
      if (!parsed.hostname) return null;
      return FAVICON_BASE + parsed.hostname + FAVICON_TAIL;
    } catch (parseErr) {
      return null;
    }
  }
  function recordHistoryEntry(url, title) {
    const target = String(url || "");
    if (!target || target.startsWith("yuki://")) return;
    try {
      const stored = safeGet(StorageKeys.browserHistory, []);
      const arr = Array.isArray(stored) ? stored : [];
      const filtered = arr.filter((item) => {
        const itemUrl = item && item.url ? item.url : item;
        return itemUrl !== target;
      });
      safeSet(
        StorageKeys.browserHistory,
        [{ url: target, title: title || target, time: Date.now() }]
          .concat(filtered)
          .slice(0, MAX_HISTORY),
      );
    } catch (storeErr) {
      return;
    }
  }
  const DEFAULT_BOOKMARKS = [
    {
      name: "YukiOS Alpha Historical",
      url: "https://reeyuki.github.io/YukiOS-AlphaHistorical/desktop/",
    },
  ];
  function loadBookmarks() {
    let stored = null;
    try {
      stored = os.storage.get(StorageKeys.browserBookmarks);
    } catch (storeErr) {
      stored = null;
    }
    if (stored === undefined || stored === null) {
      safeSet(StorageKeys.browserBookmarks, DEFAULT_BOOKMARKS);
      return DEFAULT_BOOKMARKS.slice();
    }
    return Array.isArray(stored) ? stored : [];
  }
  function loadHistoryList() {
    const stored = safeGet(StorageKeys.browserHistory, []);
    return Array.isArray(stored) ? stored : [];
  }
  function currentWispUrl() {
    try {
      return getWispUrl();
    } catch (storeErr) {
      const stored = safeGet(StorageKeys.wispServer, "");
      return stored || FALLBACK_WISP;
    }
  }
  function findTab(id) {
    return tabs.find((tab) => tab.id === id) || null;
  }
  function getActiveTab() {
    return tabs.find((tab) => tab.id === state.activeId) || null;
  }
  function applyZoomToViewport(target) {
    let viewport = null;
    let effective = zoomLevel;
    if (target && target.viewport) {
      viewport = target.viewport;
      if (Number.isFinite(target.zoom)) effective = target.zoom;
    } else if (target && target.style) {
      viewport = target;
      const owner = tabs.find((entry) => entry.viewport === target) || null;
      if (owner && Number.isFinite(owner.zoom)) effective = owner.zoom;
    }
    if (!viewport) return;
    if (effective === 1) {
      viewport.style.zoom = "";
      return;
    }
    viewport.style.zoom = String(effective);
  }
  function refreshZoomLabel() {
    const active = getActiveTab();
    const effective =
      active && Number.isFinite(active.zoom) ? active.zoom : zoomLevel;
    const label = rootNode ? $(".browser-zoom-label", rootNode) : null;
    if (label) setText(label, Math.round(effective * 100) + "%");
    const alt = rootNode ? $(".nav-zoom-label", rootNode) : null;
    if (alt && alt !== label) setText(alt, Math.round(effective * 100) + "%");
  }
  function showTabViewports() {
    tabs.forEach((tab) => {
      const isActive = tab.id === state.activeId;
      const isSplit = splitState.splitId && tab.id === splitState.splitId;
      setStyle(tab.viewport, {
        display: isActive || isSplit ? "block" : "none",
      });
    });
    if (viewportContainer)
      viewportContainer.classList.toggle(
        "split-mode",
        Boolean(splitState.splitId),
      );
  }
  function applyVisibility() {
    showTabViewports();
  }
  function createViewport() {
    const frame = createElement("iframe", {
      className: "file-protocol-viewport",
      attributes: { sandbox: VIEWPORT_SANDBOX, title: "web view" },
    });
    setStyle(frame, {
      flex: "1",
      width: "100%",
      minHeight: "0",
      border: "none",
      display: "none",
    });
    return frame;
  }
  function pushNavEntry(tab, url) {
    if (tab.navSuppressed) return;
    if (url === tab.navStack[tab.navIndex]) return;
    tab.navStack = tab.navStack.slice(0, tab.navIndex + 1);
    tab.navStack.push(url);
    tab.navIndex = tab.navStack.length - 1;
  }
  let statusShowTimer = null;
  let statusHideTimer = null;
  function shortStatusHost(url) {
    const text = String(url || "");
    try {
      const parsed = new URL(text);
      if (parsed.hostname) return parsed.hostname;
    } catch (hostErr) {
      void hostErr;
    }
    return text.length > 48 ? text.slice(0, 48) + "…" : text;
  }
  function hideStatusNow() {
    if (statusShowTimer) {
      clearTimeout(statusShowTimer);
      statusShowTimer = null;
    }
    if (statusHideTimer) {
      clearTimeout(statusHideTimer);
      statusHideTimer = null;
    }
    if (!rootNode) return;
    const el = $(".link-status", rootNode);
    if (el) el.classList.remove("visible");
  }
  function setStatusFor(url) {
    if (!rootNode) return;
    if (statusHideTimer) {
      clearTimeout(statusHideTimer);
      statusHideTimer = null;
    }
    if (statusShowTimer) clearTimeout(statusShowTimer);
    statusShowTimer = setTimeout(() => {
      statusShowTimer = null;
      if (!rootNode) return;
      const el = $(".link-status", rootNode);
      if (!el) return;
      setText(el, "Loading " + shortStatusHost(url) + "…");
      el.classList.add("visible");
    }, 250);
  }
  function clearStatus() {
    if (statusShowTimer) {
      clearTimeout(statusShowTimer);
      statusShowTimer = null;
    }
    if (statusHideTimer) clearTimeout(statusHideTimer);
    statusHideTimer = setTimeout(() => {
      statusHideTimer = null;
      hideStatusNow();
    }, 600);
  }
  async function engineRender(tab, url) {
    if (!tab || !tab.viewport) return null;
    tab.loading = true;
    notifyChange();
    try {
      try {
        if (typeof progressCallback === "function" && tab.id === state.activeId)
          progressCallback(10);
      } catch (progressErr) {
        void progressErr;
      }
      try {
        if (tab.id === state.activeId) setStatusFor(url);
      } catch (statusErr) {
        void statusErr;
      }
      const currentUrl = String(url);
      if (currentUrl === "yuki://home" || currentUrl === "yuki://newtab") {
        renderNewTab(tab.viewport);
        return { handled: true, url };
      }
      if (currentUrl.startsWith("yuki://")) {
        openYukiPage(currentUrl.replace("yuki://", ""));
        return { handled: true, url };
      }
      try {
        const result = await renderFileProtocolUrl(tab.viewport, url, {
          wispUrl: currentWispUrl(),
        });
        if (result && result.title) tab.title = result.title;
        applyZoomToViewport(tab);
        return result;
      } catch (renderErr) {
        return null;
      }
    } finally {
      tab.loading = false;
      try {
        if (
          typeof progressCallback === "function" &&
          tab &&
          tab.id === state.activeId
        )
          progressCallback(100);
      } catch (doneErr) {
        void doneErr;
      }
      try {
        if (tab && tab.id === state.activeId) clearStatus();
      } catch (statusDoneErr) {
        void statusDoneErr;
      }
      notifyChange();
    }
  }
  function afterNavigate() {
    persistOpenTabs();
    updateStarButton();
    updateMenuBadges();
    refreshAudioStates();
    notifyChange();
  }
  async function performNavigate(tab, rawUrl) {
    if (!tab) return null;
    const normalized = normalizeUrl(rawUrl);
    applyDarkModeForUrl(normalized);
    if (normalized === "yuki://home" || normalized === "yuki://newtab") {
      if (yukiState.active && tab.id === state.activeId) closeYukiPage();
      pushNavEntry(tab, normalized);
      tab.url = normalized;
      tab.title = titleFromUrl(normalized);
      tab.favicon = faviconForUrl(normalized);
      if (tab.id === state.activeId) notifyAddress(normalized);
      notifyChange();
      await engineRender(tab, normalized);
      afterNavigate();
      return tab;
    }
    if (normalized.startsWith("yuki://")) {
      openYukiPage(normalized.replace("yuki://", ""));
      tab.url = normalized;
      tab.title = titleFromUrl(normalized);
      pushNavEntry(tab, normalized);
      if (tab.id === state.activeId) notifyAddress(normalized);
      afterNavigate();
      return tab;
    }
    if (yukiState.active && tab.id === state.activeId) closeYukiPage();
    pushNavEntry(tab, normalized);
    tab.url = normalized;
    tab.title = titleFromUrl(normalized);
    tab.favicon = faviconForUrl(normalized);
    recordHistoryEntry(normalized, tab.title);
    if (tab.id === state.activeId) notifyAddress(normalized);
    notifyChange();
    await engineRender(tab, normalized);
    afterNavigate();
    return tab;
  }
  function addTab(url) {
    const target = normalizeUrl(url || DEFAULT_TAB_URL);
    state.counter += 1;
    const id = "tab-" + Date.now() + "-" + state.counter;
    const viewport = createViewport();
    viewportContainer.appendChild(viewport);
    const tab = {
      id,
      title: titleFromUrl(target),
      url: target,
      favicon: faviconForUrl(target),
      loading: false,
      viewport,
      navStack: [target],
      navIndex: 0,
      navSuppressed: false,
      isPinned: false,
      isMuted: false,
      isPlaying: false,
      zoom: zoomLevel,
    };
    const tabNextOn = safeGet(StorageKeys.browserTabBehaviorNext, true);
    if (tabNextOn !== false && state.activeId) {
      const activeIndex = tabs.findIndex(
        (entry) => entry.id === state.activeId,
      );
      if (activeIndex !== -1) tabs.splice(activeIndex + 1, 0, tab);
      else tabs.push(tab);
    } else {
      tabs.push(tab);
    }
    state.activeId = id;
    applyVisibility();
    applyZoomToViewport(tab);
    notifyAddress(target);
    if (target === "yuki://home" || target === "yuki://newtab")
      renderNewTab(viewport);
    else if (target.startsWith("yuki://"))
      openYukiPage(target.replace("yuki://", ""));
    else {
      recordHistoryEntry(target, tab.title);
      engineRender(tab, target);
    }
    emitAction("tab-created", { id, url: target });
    updateStarButton();
    updateMenuBadges();
    persistOpenTabs();
    notifyChange();
    return tab;
  }
  function switchTab(id) {
    const tab = findTab(id);
    if (!tab) return null;
    if (yukiState.active) {
      hideYukiContainer();
      yukiState.active = false;
      yukiState.kind = null;
    }
    state.activeId = id;
    applyVisibility();
    notifyAddress(tab.url);
    refreshZoomLabel();
    updateStarButton();
    notifyChange();
    return tab;
  }
  function finishCloseAt(closeIndex, closeId) {
    const removed = tabs[closeIndex];
    if (removed && removed.url) {
      closedStack.push({
        url: removed.url,
        title: removed.title || removed.url,
      });
      if (closedStack.length > MAX_CLOSED) closedStack.shift();
    }
    tabs.splice(closeIndex, 1);
    if (removed && removed.viewport) removed.viewport.remove();
    if (splitState.splitId === closeId) splitState.splitId = null;
    if (state.activeId === closeId) {
      const fallback = tabs[closeIndex] || tabs[closeIndex - 1] || null;
      state.activeId = fallback ? fallback.id : null;
      applyVisibility();
      if (fallback) notifyAddress(fallback.url);
    } else applyVisibility();
    if (tabs.length === 0) addTab(HOME_URL);
    updateStarButton();
    updateMenuBadges();
    persistOpenTabs();
    notifyChange();
    return true;
  }
  function closeTab(id) {
    const index = tabs.findIndex((tab) => tab.id === id);
    if (index === -1) return false;
    const confirmOn = safeGet(StorageKeys.browserConfirmClose, false);
    if (confirmOn === true && tabs.length > 1) {
      const target = tabs[index];
      const label = target && target.title ? String(target.title) : "this tab";
      return os.dialog
        .confirm("Close tab", "Close " + label + "?")
        .then((confirmed) => {
          if (!confirmed) return false;
          return finishCloseAt(index, id);
        });
    }
    return finishCloseAt(index, id);
  }
  function moveTab(id, targetId) {
    if (!id || !targetId || id === targetId) return false;
    const fromIndex = tabs.findIndex((tab) => tab.id === id);
    if (fromIndex === -1) return false;
    const targetIndex = tabs.findIndex((tab) => tab.id === targetId);
    if (targetIndex === -1) return false;
    const moved = tabs.splice(fromIndex, 1)[0];
    const insertAt = tabs.findIndex((tab) => tab.id === targetId);
    tabs.splice(insertAt === -1 ? tabs.length : insertAt, 0, moved);
    applyVisibility();
    persistOpenTabs();
    notifyChange();
    return true;
  }
  function getActive() {
    return getActiveTab();
  }
  function getAll() {
    return tabs.slice();
  }
  async function goBack() {
    const tab = getActiveTab();
    if (!tab) return null;
    if (yukiState.active) {
      closeYukiPage();
      return tab;
    }
    if (!tab.navStack || tab.navIndex <= 0) return tab;
    tab.navIndex -= 1;
    tab.navSuppressed = true;
    const target = tab.navStack[tab.navIndex];
    tab.url = target;
    tab.title = titleFromUrl(target);
    notifyAddress(target);
    await engineRender(tab, target);
    tab.navSuppressed = false;
    return tab;
  }
  async function goForward() {
    const tab = getActiveTab();
    if (!tab) return null;
    if (yukiState.active) return tab;
    if (!tab.navStack || tab.navIndex >= tab.navStack.length - 1) return tab;
    tab.navIndex += 1;
    tab.navSuppressed = true;
    const target = tab.navStack[tab.navIndex];
    tab.url = target;
    tab.title = titleFromUrl(target);
    notifyAddress(target);
    await engineRender(tab, target);
    tab.navSuppressed = false;
    return tab;
  }
  async function jumpNavStack(index) {
    const tab = getActiveTab();
    if (!tab || !Array.isArray(tab.navStack) || tab.navStack.length === 0)
      return null;
    const parsed = Number(index);
    if (!Number.isFinite(parsed)) return null;
    const clamped = Math.max(
      0,
      Math.min(Math.floor(parsed), tab.navStack.length - 1),
    );
    tab.navIndex = clamped;
    tab.navSuppressed = true;
    const target = tab.navStack[tab.navIndex];
    tab.url = target;
    tab.title = titleFromUrl(target);
    tab.favicon = faviconForUrl(target);
    notifyAddress(target);
    await engineRender(tab, target);
    tab.navSuppressed = false;
    afterNavigate();
    return tab;
  }
  async function reload() {
    const tab = getActiveTab();
    if (!tab) return null;
    if (yukiState.active) {
      renderYukiContent(yukiState.kind);
      return tab;
    }
    tab.navSuppressed = true;
    await engineRender(tab, tab.url);
    tab.navSuppressed = false;
    return tab;
  }
  async function navigateTab(id, url) {
    const tab = id ? findTab(id) : getActiveTab();
    if (!tab) return null;
    return performNavigate(tab, url);
  }
  function previewNavigate(id, url) {
    const tab = id ? findTab(id) : getActiveTab();
    if (!tab) return null;
    const normalized = normalizeUrl(url);
    tab.url = normalized;
    tab.title = titleFromUrl(normalized);
    tab.favicon = faviconForUrl(normalized);
    if (tab.id === state.activeId) notifyAddress(normalized);
    notifyChange();
    return tab;
  }
  function hideOmnibox() {
    omniboxIndex = -1;
    omniboxResults = [];
    if (!rootNode) return;
    const existing = $(".omnibox-dropdown", rootNode);
    if (existing) existing.remove();
  }
  function getOmniboxSelection() {
    if (omniboxIndex < 0 || omniboxIndex >= omniboxResults.length) return null;
    return omniboxResults[omniboxIndex] || null;
  }
  function paintOmniboxSelection() {
    if (!rootNode) return;
    const items = $$(".omnibox-item", rootNode);
    items.forEach((item, itemIndex) => {
      item.classList.toggle("selected", itemIndex === omniboxIndex);
    });
  }
  function selectOmniboxNext() {
    if (!omniboxResults || omniboxResults.length === 0) return null;
    omniboxIndex = (omniboxIndex + 1) % omniboxResults.length;
    paintOmniboxSelection();
    return getOmniboxSelection();
  }
  function selectOmniboxPrev() {
    if (!omniboxResults || omniboxResults.length === 0) return null;
    omniboxIndex =
      (omniboxIndex - 1 + omniboxResults.length) % omniboxResults.length;
    paintOmniboxSelection();
    return getOmniboxSelection();
  }
  function updateOmnibox(input) {
    if (!rootNode) return [];
    const suggestionsOn = safeGet(StorageKeys.browserSearchSuggestions, true);
    if (suggestionsOn === false) {
      hideOmnibox();
      return [];
    }
    const query =
      typeof input === "string"
        ? input
        : input && input.value
          ? String(input.value)
          : "";
    const trimmed = query.trim().toLowerCase();
    hideOmnibox();
    if (!trimmed) return [];
    const history = loadHistoryList();
    const bookmarks = loadBookmarks();
    const results = [];
    const seen = new Set();
    function addResult(kind, title, url) {
      if (!url || seen.has(url) || results.length >= MAX_SUGGEST) return;
      seen.add(url);
      results.push({ kind, title, url });
    }
    const calcValue = evaluateMathExpression(trimmed);
    if (calcValue !== null) {
      results.push({
        kind: "calc",
        title: trimmed,
        url: "= " + calcValue,
        result: calcValue,
      });
    }
    for (let i = history.length - 1; i >= 0; i -= 1) {
      const entry = history[i];
      const url = entry && entry.url ? String(entry.url) : "";
      const title = entry && entry.title ? String(entry.title) : url;
      if (
        url.toLowerCase().includes(trimmed) ||
        title.toLowerCase().includes(trimmed)
      )
        addResult("history", title, url);
      if (results.length >= MAX_SUGGEST) break;
    }
    bookmarks.forEach((mark) => {
      const url = mark && mark.url ? String(mark.url) : "";
      const name = mark && mark.name ? String(mark.name) : url;
      if (
        url.toLowerCase().includes(trimmed) ||
        name.toLowerCase().includes(trimmed)
      )
        addResult("bookmark", name, url);
    });
    if (results.length === 0) {
      omniboxResults = [];
      omniboxIndex = -1;
      return [];
    }
    omniboxResults = results.slice();
    omniboxIndex = -1;
    const addressField =
      opts.addressInput || $(".browser-address-input", rootNode);
    const anchor =
      addressField && addressField.parentElement
        ? addressField.parentElement
        : rootNode;
    const dropdown = createElement("div", { className: "omnibox-dropdown" });
    results.forEach((result, resultIndex) => {
      const item = createElement("div", { className: "omnibox-item" });
      const icon = createElement("span", {
        className: "omnibox-item-icon",
        text:
          result.kind === "bookmark"
            ? "star"
            : result.kind === "calc"
              ? "calc"
              : "clock",
      });
      const title = createElement("span", { className: "omnibox-item-title" });
      setText(title, result.title);
      const link = createElement("span", { className: "omnibox-item-url" });
      setText(link, result.url);
      item.appendChild(icon);
      item.appendChild(title);
      item.appendChild(link);
      bindEvent(item, "mousedown", (event) => {
        event.preventDefault();
        omniboxIndex = resultIndex;
        activateOmniboxSelection();
      });
      dropdown.appendChild(item);
    });
    anchor.appendChild(dropdown);
    return results;
  }
  function activateOmniboxSelection() {
    const picked = getOmniboxSelection();
    if (!picked) return null;
    hideOmnibox();
    if (picked.kind === "calc") {
      const value = String(picked.result ?? "");
      if (value && value !== "Error") {
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(value).catch(() => {});
          }
        } catch (clipErr) {
          void clipErr;
        }
      }
      try {
        const field = opts.addressInput || null;
        if (field) {
          field.value = value;
          field.focus();
          field.select();
        }
      } catch (fieldErr) {
        void fieldErr;
      }
      return "calc";
    }
    try {
      if (document.activeElement && document.activeElement.blur)
        document.activeElement.blur();
    } catch (blurErr) {
      void blurErr;
    }
    const active = getActiveTab();
    if (active) performNavigate(active, picked.url);
    return "navigated";
  }
  function updateStarButton() {
    if (!rootNode) return;
    const star = $('[id^="star-btn"]', rootNode);
    if (!star) return;
    const active = getActiveTab();
    if (!active || !active.url) {
      star.style.color = "var(--text-muted)";
      return;
    }
    const bookmarks = loadBookmarks();
    const bookmarked = bookmarks.some(
      (mark) => mark && mark.url === active.url,
    );
    star.style.color = bookmarked ? "var(--accent)" : "var(--text-muted)";
  }
  function updateMenuBadges() {
    if (!rootNode) return;
    const dlBadge = $('[id^="menu-dl-badge"]', rootNode);
    if (dlBadge) {
      if (downloadList.length > 0) {
        setText(dlBadge, String(downloadList.length));
        setStyle(dlBadge, { display: "" });
      } else {
        setStyle(dlBadge, { display: "none" });
      }
    }
    const rtBadge = $('[id^="menu-rt-badge"]', rootNode);
    if (rtBadge) {
      if (closedStack.length > 0) {
        setText(rtBadge, String(closedStack.length));
        setStyle(rtBadge, { display: "" });
      } else {
        setStyle(rtBadge, { display: "none" });
      }
    }
    const check = $('[data-action="toggle-bookmarkbar"] .di-icon', rootNode);
    if (check) {
      const visible = safeGet(StorageKeys.browserShowBookmarks, true);
      check.classList.toggle("fa-check", visible);
      check.classList.toggle("fa-minus", !visible);
    }
  }
  function toggleBookmark() {
    const active = getActiveTab();
    if (!active || !active.url) return false;
    if (String(active.url).startsWith("yuki://")) return false;
    const bookmarks = loadBookmarks();
    const index = bookmarks.findIndex(
      (mark) => mark && mark.url === active.url,
    );
    if (index !== -1) bookmarks.splice(index, 1);
    else bookmarks.push({ name: active.title || active.url, url: active.url });
    safeSet(StorageKeys.browserBookmarks, bookmarks);
    renderBookmarkBar();
    updateStarButton();
    updateMenuBadges();
    notifyChange();
    return index === -1;
  }
  function renderBookmarkBar() {
    if (!rootNode) return;
    const bar =
      $(".browser-bookmark-row", rootNode) || $(".bookmark-bar", rootNode);
    if (!bar) return;
    const visible = safeGet(StorageKeys.browserShowBookmarks, true);
    const bookmarks = loadBookmarks();
    bar.replaceChildren();
    if (!visible || bookmarks.length === 0) {
      bar.classList.add("hidden");
      bar.classList.remove("showing");
      return;
    }
    bar.classList.remove("hidden");
    bar.classList.add("showing");
    setTimeout(() => bar.classList.remove("showing"), 400);
    bookmarks.forEach((mark, markIndex) => {
      const url = mark && mark.url ? String(mark.url) : "";
      if (!url) return;
      const name = mark && mark.name ? String(mark.name) : url;
      let hostname = "";
      try {
        hostname = new URL(url).hostname || "";
      } catch (parseErr) {
        hostname = "";
      }
      const item = createElement("div", { className: "bookmark-item" });
      item.dataset.tooltip = name;
      const fav = createElement("img", {
        className: "bm-favicon",
        attributes: {
          src:
            "https://www.google.com/s2/favicons?domain=" + hostname + "&sz=32",
          alt: "",
        },
      });
      bindEvent(fav, "error", () => {
        setStyle(fav, { display: "none" });
      });
      const label = createElement("span");
      setText(label, name);
      const remove = createElement("button", {
        className: "bm-remove",
        text: "✕",
      });
      remove.dataset.idx = String(markIndex);
      bindEvent(remove, "click", (event) => {
        event.stopPropagation();
        const next = loadBookmarks();
        const removeIndex = next.findIndex(
          (entry) => entry && entry.url === url,
        );
        if (removeIndex !== -1) next.splice(removeIndex, 1);
        safeSet(StorageKeys.browserBookmarks, next);
        renderBookmarkBar();
        updateMenuBadges();
      });
      bindEvent(item, "click", () => {
        const active = getActiveTab();
        if (active) performNavigate(active, url);
      });
      item.appendChild(fav);
      item.appendChild(label);
      item.appendChild(remove);
      bar.appendChild(item);
    });
  }
  function pageLayer() {
    if (viewportContainer && viewportContainer.parentElement)
      return viewportContainer.parentElement;
    return rootNode;
  }
  function ensureYukiContainer() {
    let container = rootNode ? $(".yuki-page-container", rootNode) : null;
    if (container) return container;
    container = createElement("div", { className: "yuki-page-container" });
    const layer = pageLayer();
    if (layer) layer.appendChild(container);
    return container;
  }
  function hideYukiContainer() {
    if (!rootNode) return;
    const container = $(".yuki-page-container", rootNode);
    if (container) container.remove();
  }
  function buildYukiHeader(container, titleText) {
    const header = createElement("div", { className: "yuki-page-header" });
    const back = createElement("button", {
      className: "yuki-back-btn",
      attributes: { "data-tooltip": "Back to browsing" },
    });
    back.appendChild(
      createElement("i", { className: "fa-solid fa-arrow-left" }),
    );
    bindEvent(back, "click", () => {
      closeYukiPage();
    });
    const title = createElement("h1", { className: "yuki-page-title" });
    setText(title, titleText);
    header.appendChild(back);
    header.appendChild(title);
    container.appendChild(header);
  }
  function bindYukiRow(row, url) {
    bindEvent(row, "click", () => {
      const active = getActiveTab();
      if (active) {
        closeYukiPage();
        performNavigate(active, url);
      }
    });
  }
  function buildYukiFilter(body) {
    const filter = createElement("input", {
      className: "yuki-search-bar",
      attributes: { type: "text", placeholder: "Filter..." },
    });
    body.appendChild(filter);
    bindEvent(filter, "input", () => {
      const query = String(filter.value || "").toLowerCase();
      const rows = $$(".history-entry, .panel-item", body);
      rows.forEach((row) => {
        const hay = String(
          (row.dataset && row.dataset.search) || row.textContent || "",
        ).toLowerCase();
        setStyle(row, { display: hay.includes(query) ? "" : "none" });
      });
    });
    return filter;
  }
  function escapeBookmarkText(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/\[/g, "&#91;")
      .replace(/\]/g, "&#93;");
  }
  function exportBookmarks() {
    const bookmarks = loadBookmarks();
    if (bookmarks.length === 0) {
      os.dialog.alert("Export bookmarks", "No bookmarks to export.");
      return;
    }
    const stamp = Math.floor(Date.now() / 1000);
    let html =
      "<!DOCTYPE NETSCAPE-Bookmark-file-1>\n" +
      '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n' +
      "<TITLE>Bookmarks</TITLE>\n<H1>Bookmarks</H1>\n<DL><p>\n";
    bookmarks.forEach((mark) => {
      const url = mark && mark.url ? String(mark.url) : "";
      if (!url) return;
      const name = mark && mark.name ? String(mark.name) : url;
      html +=
        '<DT><A HREF="' +
        escapeBookmarkText(url) +
        '" ADD_DATE="' +
        stamp +
        '">' +
        escapeBookmarkText(name) +
        "</A>\n";
    });
    html += "</DL><p>\n";
    const blob = new Blob([html], { type: "text/html" });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = createElement("a", {
      attributes: { href: objectUrl, download: "bookmarks.html" },
    });
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
  }
  function importBookmarks() {
    const picker = createElement("input", {
      attributes: { type: "file", accept: ".html,.htm" },
    });
    bindEvent(picker, "change", () => {
      const file = picker.files && picker.files[0] ? picker.files[0] : null;
      if (!file) return;
      const reader = new FileReader();
      bindEvent(reader, "load", async () => {
        const text = String(reader.result || "");
        const pattern = /<a\s[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([^<]*)</gi;
        const stored = loadBookmarks();
        const known = new Set(
          stored.map((mark) => (mark && mark.url ? String(mark.url) : "")),
        );
        let count = 0;
        let match = pattern.exec(text);
        while (match) {
          const href = String(match[1] || "").trim();
          const label = String(match[2] || "").trim() || href;
          if (href && !known.has(href)) {
            known.add(href);
            stored.push({ name: label, url: href });
            count += 1;
          }
          match = pattern.exec(text);
        }
        if (count > 0) safeSet(StorageKeys.browserBookmarks, stored);
        await os.dialog.alert(
          "Import bookmarks",
          "Imported " + count + " bookmarks.",
        );
        renderYukiContent("bookmarks");
        renderBookmarkBar();
      });
      reader.readAsText(file);
    });
    picker.click();
  }
  function recordBlocked(url) {
    if (typeof url !== "string") return;
    const text = url.trim();
    if (!text) return;
    blockedLog.push({ url: text, time: Date.now() });
    while (blockedLog.length > BLOCKED_LOG_CAP) blockedLog.shift();
    if (yukiState.active && yukiState.kind === "blocking-log")
      renderYukiContent("blocking-log");
  }
  function renderBlockingBody(body) {
    const total = blockedLog.length;
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const start = dayStart.getTime();
    let today = 0;
    const domains = new Set();
    blockedLog.forEach((entry) => {
      if (entry && entry.time >= start) today += 1;
      try {
        const host = new URL(String(entry.url)).hostname;
        if (host) domains.add(host);
      } catch (parseErr) {
        return;
      }
    });
    const stats = createElement("div", { className: "blocking-stats" });
    const totalEl = createElement("div", { className: "blocking-stat" });
    setText(totalEl, "Total blocked: " + total);
    const todayEl = createElement("div", { className: "blocking-stat" });
    setText(todayEl, "Blocked today: " + today);
    const domainEl = createElement("div", { className: "blocking-stat" });
    setText(domainEl, "Domains: " + domains.size);
    stats.appendChild(totalEl);
    stats.appendChild(todayEl);
    stats.appendChild(domainEl);
    body.appendChild(stats);
    if (total === 0) {
      body.appendChild(
        createElement("div", {
          className: "yuki-page-empty",
          text: "No blocked requests yet",
        }),
      );
      return;
    }
    for (let i = blockedLog.length - 1; i >= 0; i -= 1) {
      const entry = blockedLog[i];
      const url = entry && entry.url ? String(entry.url) : "";
      if (!url) continue;
      let domain = url;
      try {
        domain = new URL(url).hostname || url;
      } catch (parseErr) {
        domain = url;
      }
      const row = createElement("div", { className: "blocking-entry" });
      const domainLine = createElement("div", { className: "blocking-domain" });
      setText(domainLine, domain);
      const urlLine = createElement("div", { className: "blocking-url" });
      setText(urlLine, url.length > 80 ? url.slice(0, 80) + "..." : url);
      const timeLine = createElement("div", { className: "blocking-time" });
      setText(timeLine, new Date(entry.time).toLocaleTimeString());
      row.appendChild(domainLine);
      row.appendChild(urlLine);
      row.appendChild(timeLine);
      body.appendChild(row);
    }
  }
  function renderDinoBody(body) {
    const page = createElement("div", { className: "dino-page" });
    const frame = createElement("iframe", {
      className: "dino-srcdoc",
      attributes: { title: "T-Rex Runner" },
    });
    frame.setAttribute("srcdoc", escapeDinoGameAttr());
    page.appendChild(frame);
    body.appendChild(page);
  }
  function renderHistoryBody(body) {
    buildYukiFilter(body);
    const history = loadHistoryList();
    if (history.length === 0) {
      body.appendChild(
        createElement("div", {
          className: "yuki-page-empty",
          text: "No history yet",
        }),
      );
      return;
    }
    const nowDate = new Date();
    const todayStart = new Date(
      nowDate.getFullYear(),
      nowDate.getMonth(),
      nowDate.getDate(),
    ).getTime();
    const yesterdayStart = todayStart - 86400000;
    let lastLabel = null;
    history.slice(0, 200).forEach((entry) => {
      const url = entry && entry.url ? String(entry.url) : "";
      if (!url) return;
      const titleText = String((entry && entry.title) || url);
      const stamp =
        entry && Number.isFinite(entry.time) ? entry.time : Date.now();
      const day = new Date(stamp);
      const dayStart = new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate(),
      ).getTime();
      let label = day.toLocaleDateString();
      if (dayStart === todayStart) label = "Today";
      else if (dayStart === yesterdayStart) label = "Yesterday";
      if (label !== lastLabel) {
        const header = createElement("div", {
          className: "history-group-header",
        });
        setText(header, label);
        body.appendChild(header);
        lastLabel = label;
      }
      const row = createElement("div", { className: "history-entry" });
      row.dataset.search = (titleText + " " + url).toLowerCase();
      const fav = createElement("img", {
        className: "he-favicon",
        attributes: { src: faviconForUrl(url) || "", alt: "" },
      });
      const content = createElement("div", { className: "he-body" });
      const title = createElement("div", { className: "he-title" });
      setText(title, titleText);
      const meta = createElement("div", { className: "he-meta" });
      setText(meta, url);
      const time = createElement("div", { className: "he-time" });
      setText(time, day.toLocaleTimeString());
      content.appendChild(title);
      content.appendChild(meta);
      content.appendChild(time);
      row.appendChild(fav);
      row.appendChild(content);
      bindYukiRow(row, url);
      body.appendChild(row);
    });
  }
  function renderBookmarksBody(body) {
    buildYukiFilter(body);
    const actions = createElement("div", { className: "bookmark-actions" });
    const exportBtn = createElement("button", {
      className: "settings-action-btn",
    });
    setText(exportBtn, "Export");
    bindEvent(exportBtn, "click", () => {
      exportBookmarks();
    });
    const importBtn = createElement("button", {
      className: "settings-action-btn",
    });
    setText(importBtn, "Import");
    bindEvent(importBtn, "click", () => {
      importBookmarks();
    });
    actions.appendChild(exportBtn);
    actions.appendChild(importBtn);
    body.appendChild(actions);
    const bookmarks = loadBookmarks();
    if (bookmarks.length === 0) {
      body.appendChild(
        createElement("div", {
          className: "yuki-page-empty",
          text: "No bookmarks yet",
        }),
      );
      return;
    }
    bookmarks.forEach((mark, markIndex) => {
      const url = mark && mark.url ? String(mark.url) : "";
      if (!url) return;
      const nameText = String((mark && mark.name) || url);
      const row = createElement("div", { className: "panel-item" });
      row.dataset.search = (nameText + " " + url).toLowerCase();
      const content = createElement("div", { className: "panel-item-content" });
      const title = createElement("div", { className: "panel-item-title" });
      setText(title, nameText);
      const sub = createElement("div", { className: "panel-item-sub" });
      setText(sub, url);
      content.appendChild(title);
      content.appendChild(sub);
      const remove = createElement("button", {
        className: "panel-item-action",
        text: "x",
      });
      bindEvent(remove, "click", (event) => {
        event.stopPropagation();
        const next = loadBookmarks();
        next.splice(markIndex, 1);
        safeSet(StorageKeys.browserBookmarks, next);
        renderYukiContent("bookmarks");
        renderBookmarkBar();
      });
      row.appendChild(content);
      row.appendChild(remove);
      bindYukiRow(row, url);
      body.appendChild(row);
    });
  }
  function renderDownloadsBody(body) {
    buildYukiFilter(body);
    if (downloadList.length === 0) {
      body.appendChild(
        createElement("div", {
          className: "yuki-page-empty",
          text: "No downloads yet",
        }),
      );
      return;
    }
    downloadList.forEach((item) => {
      const url = item && item.url ? String(item.url) : "";
      const titleText = String((item && item.filename) || url || "Download");
      const row = createElement("div", { className: "panel-item" });
      row.dataset.search = (titleText + " " + url).toLowerCase();
      const glyph = createElement("span", { className: "download-status" });
      setText(glyph, item && item.status === "done" ? "✓" : "⏳");
      const content = createElement("div", { className: "panel-item-content" });
      const title = createElement("div", { className: "panel-item-title" });
      setText(title, titleText);
      const sub = createElement("div", { className: "panel-item-sub" });
      setText(sub, url);
      content.appendChild(title);
      content.appendChild(sub);
      row.appendChild(glyph);
      row.appendChild(content);
      if (url) bindYukiRow(row, url);
      body.appendChild(row);
    });
  }
  function renderSettingsBody(body) {
    const layout = createElement("div", { className: "yuki-settings-layout" });
    const nav = createElement("div", { className: "yuki-settings-nav" });
    const content = createElement("div", {
      className: "yuki-settings-content",
    });
    const navDefs = [
      { id: "nav", label: "Navigation", icon: "fa-compass" },
      { id: "appearance", label: "Appearance", icon: "fa-palette" },
      { id: "user-agent", label: "User-Agent", icon: "fa-laptop-code" },
      { id: "tabs", label: "Tabs", icon: "fa-gears" },
      { id: "privacy", label: "Privacy", icon: "fa-shield" },
      {
        id: "search-engines",
        label: "Search Engines",
        icon: "fa-magnifying-glass",
      },
      { id: "data", label: "Data", icon: "fa-database" },
      { id: "proxy", label: "Proxy", icon: "fa-server" },
      {
        id: "danger-zone",
        label: "Danger Zone",
        icon: "fa-triangle-exclamation",
      },
    ];
    const sectionMap = {};
    navDefs.forEach((def) => {
      const item = createElement("a", {
        className: "yuki-settings-nav-item",
        attributes: { "data-section": def.id },
      });
      if (def.id === "nav") item.classList.add("selected");
      const icon = createElement("i", { className: "fa-solid " + def.icon });
      const label = createElement("span");
      setText(label, def.label);
      item.appendChild(icon);
      item.appendChild(label);
      bindEvent(item, "click", () => {
        const allNav = $$(".yuki-settings-nav-item", layout);
        allNav.forEach((other) =>
          other.classList.toggle("selected", other === item),
        );
        Object.keys(sectionMap).forEach((key) =>
          sectionMap[key].classList.toggle("active", key === def.id),
        );
      });
      nav.appendChild(item);
    });
    function makeTitle(iconClass, titleText) {
      const titleEl = createElement("div", {
        className: "settings-section-title",
      });
      const iconEl = createElement("i", { className: "fa-solid " + iconClass });
      const textEl = createElement("span");
      setText(textEl, titleText);
      titleEl.appendChild(iconEl);
      titleEl.appendChild(textEl);
      return titleEl;
    }
    function makeToggle(labelText, checked, onChange) {
      const row = createElement("div", { className: "settings-field-row" });
      const lab = createElement("span", { className: "settings-field-label" });
      setText(lab, labelText);
      const sw = createElement("label", { className: "toggle-switch" });
      const inp = createElement("input", { attributes: { type: "checkbox" } });
      inp.checked = checked;
      const slider = createElement("span", { className: "toggle-slider" });
      sw.appendChild(inp);
      sw.appendChild(slider);
      row.appendChild(lab);
      row.appendChild(sw);
      bindEvent(inp, "change", () => onChange(inp.checked));
      return row;
    }
    function makeSub(text) {
      const sub = createElement("div");
      setText(sub, text);
      setStyle(sub, {
        marginBottom: "10px",
        fontSize: "14px",
        color: "var(--text-dim)",
        fontWeight: "500",
      });
      return sub;
    }
    const navSection = createElement("div", {
      className: "yuki-settings-section active",
      attributes: { "data-section": "nav" },
    });
    navSection.appendChild(makeTitle("fa-compass", "Navigation"));
    navSection.appendChild(makeSub("Search Engine"));
    const pillGroup = createElement("div", {
      className: "settings-option-group",
    });
    const currentEngineKey = safeGet(StorageKeys.browserSearchEngine, "brave");
    const allEngines = getAllEngines();
    Object.keys(allEngines).forEach((key) => {
      const eng = allEngines[key];
      const pill = createElement("span", {
        className:
          "settings-option-pill" + (key === currentEngineKey ? " active" : ""),
      });
      setText(pill, eng.name);
      bindEvent(pill, "click", () => {
        safeSet(StorageKeys.browserSearchEngine, key);
        renderYukiContent("settings");
      });
      pillGroup.appendChild(pill);
    });
    navSection.appendChild(pillGroup);
    navSection.appendChild(makeSub("Homepage"));
    const homeRow = createElement("div");
    setStyle(homeRow, { display: "flex", gap: "6px" });
    const storedHome = safeGet(StorageKeys.browserHomepage, HOME_URL);
    const homeInput = createElement("input", {
      className: "settings-input",
      attributes: { type: "text", placeholder: "New Tab (home)" },
    });
    homeInput.value = storedHome === HOME_URL ? "" : String(storedHome || "");
    bindEvent(homeInput, "change", () => {
      const val = String(homeInput.value || "").trim();
      safeSet(StorageKeys.browserHomepage, val || HOME_URL);
    });
    const homeReset = createElement("button", {
      className: "settings-icon-btn",
    });
    const homeIcon = createElement("i", { className: "fa-solid fa-house" });
    homeReset.appendChild(homeIcon);
    bindEvent(homeReset, "click", () => {
      safeSet(StorageKeys.browserHomepage, HOME_URL);
      homeInput.value = "";
    });
    homeRow.appendChild(homeInput);
    homeRow.appendChild(homeReset);
    navSection.appendChild(homeRow);
    const suggOn = safeGet(StorageKeys.browserSearchSuggestions, true);
    navSection.appendChild(
      makeToggle("Search Suggestions", suggOn !== false, (checked) =>
        safeSet(StorageKeys.browserSearchSuggestions, checked),
      ),
    );
    const regionRow = createElement("div", { className: "settings-field-row" });
    const regionLabel = createElement("span", {
      className: "settings-field-label",
    });
    setText(regionLabel, "Search Region");
    regionRow.appendChild(regionLabel);
    const regionOpts = [
      { value: "", label: "Default" },
      { value: "us", label: "US" },
      { value: "uk", label: "UK" },
      { value: "de", label: "Germany" },
      { value: "fr", label: "France" },
      { value: "jp", label: "Japan" },
      { value: "br", label: "Brazil" },
    ];
    const currentRegion = safeGet(StorageKeys.browserSearchRegion, "") || "";
    const regionSelect = createElement("div", {
      className: "yuki-select",
      attributes: { "data-value": currentRegion },
    });
    const regionTrigger = createElement("div", {
      className: "yuki-select-trigger",
    });
    const regionLabelSpan = createElement("span", {
      className: "yuki-select-label",
    });
    const foundRegion =
      regionOpts.find((opt) => opt.value === currentRegion) || regionOpts[0];
    setText(regionLabelSpan, foundRegion.label);
    const regionArrow = createElement("i", {
      className: "fa-solid fa-chevron-down yuki-select-arrow",
    });
    regionTrigger.appendChild(regionLabelSpan);
    regionTrigger.appendChild(regionArrow);
    const regionDrop = createElement("div", {
      className: "yuki-select-dropdown",
    });
    regionOpts.forEach((opt) => {
      const optEl = createElement("div", {
        className:
          "yuki-select-option" +
          (opt.value === currentRegion ? " selected" : ""),
        attributes: { "data-value": opt.value },
      });
      setText(optEl, opt.label);
      bindEvent(optEl, "click", (ev) => {
        ev.stopPropagation();
        safeSet(StorageKeys.browserSearchRegion, opt.value);
        regionSelect.dataset.value = opt.value;
        setText(regionLabelSpan, opt.label);
        const allOpts = $$(".yuki-select-option", regionSelect);
        allOpts.forEach((other) =>
          other.classList.toggle("selected", other.dataset.value === opt.value),
        );
        regionSelect.classList.remove("open");
      });
      regionDrop.appendChild(optEl);
    });
    regionSelect.appendChild(regionTrigger);
    regionSelect.appendChild(regionDrop);
    bindEvent(regionTrigger, "click", (ev) => {
      ev.stopPropagation();
      const wasOpen = regionSelect.classList.contains("open");
      const opens = $$(".yuki-select.open", body);
      opens.forEach((sel) => {
        if (sel !== regionSelect) sel.classList.remove("open");
      });
      regionSelect.classList.toggle("open", !wasOpen);
    });
    regionRow.appendChild(regionSelect);
    navSection.appendChild(regionRow);
    sectionMap.nav = navSection;
    content.appendChild(navSection);
    const appearanceSection = createElement("div", {
      className: "yuki-settings-section",
      attributes: { "data-section": "appearance" },
    });
    appearanceSection.appendChild(makeTitle("fa-palette", "Appearance"));
    const darkChecked = rootNode
      ? rootNode.classList.contains("browser-darkmode")
      : false;
    appearanceSection.appendChild(
      makeToggle("Dark Mode", darkChecked, (checked) => {
        toggleDarkMode();
        darkModeOn = checked;
        if (rootNode) rootNode.classList.toggle("browser-darkmode", checked);
        safeSet(StorageKeys.browserDarkMode, checked);
      }),
    );
    const bmVisible = safeGet(StorageKeys.browserShowBookmarks, true);
    appearanceSection.appendChild(
      makeToggle("Bookmark Bar", bmVisible !== false, (checked) => {
        safeSet(StorageKeys.browserShowBookmarks, checked);
        renderBookmarkBar();
      }),
    );
    const zoomRow = createElement("div", { className: "settings-field-row" });
    const zoomLabel = createElement("span", {
      className: "settings-field-label",
    });
    setText(zoomLabel, "Default Zoom");
    zoomRow.appendChild(zoomLabel);
    const zoomWrap = createElement("div");
    setStyle(zoomWrap, { display: "flex", alignItems: "center", gap: "6px" });
    const zoomPctInit = Math.round(zoomLevel * 100);
    const rangeEl = createElement("div", {
      className: "yuki-range",
      attributes: {
        "data-min": "50",
        "data-max": "200",
        "data-value": String(zoomPctInit),
      },
    });
    const track = createElement("div", { className: "yuki-range-track" });
    const fill = createElement("div", { className: "yuki-range-fill" });
    const thumb = createElement("div", { className: "yuki-range-thumb" });
    const initPct = ((zoomPctInit - 50) / (200 - 50)) * 100;
    setStyle(fill, { width: initPct + "%" });
    setStyle(thumb, { left: initPct + "%" });
    track.appendChild(fill);
    track.appendChild(thumb);
    rangeEl.appendChild(track);
    const zoomValLabel = createElement("span");
    setText(zoomValLabel, zoomPctInit + "%");
    setStyle(zoomValLabel, {
      fontSize: "13px",
      color: "var(--text-muted)",
      minWidth: "32px",
      textAlign: "right",
    });
    function applyZoomVal(val) {
      setText(zoomValLabel, val + "%");
      zoomLevel = val / 100;
      safeSet(StorageKeys.browserZoom, zoomLevel);
      const active = getActiveTab();
      if (active) {
        active.zoom = zoomLevel;
        applyZoomToViewport(active);
      }
      refreshZoomLabel();
    }
    function updateRangeFromClient(clientX) {
      const rect = track.getBoundingClientRect();
      let ratio = 0;
      if (rect.width > 0) ratio = (clientX - rect.left) / rect.width;
      ratio = Math.max(0, Math.min(1, ratio));
      const val = Math.round(50 + ratio * (200 - 50));
      const newPct = ((val - 50) / (200 - 50)) * 100;
      rangeEl.dataset.value = String(val);
      setStyle(fill, { width: newPct + "%" });
      setStyle(thumb, { left: newPct + "%" });
      return val;
    }
    let rangeDragging = false;
    bindEvent(track, "mousedown", (ev) => {
      rangeDragging = true;
      const val = updateRangeFromClient(ev.clientX);
      applyZoomVal(val);
    });
    bindEvent(document, "mousemove", (ev) => {
      if (!rangeDragging) return;
      updateRangeFromClient(ev.clientX);
    });
    bindEvent(document, "mouseup", () => {
      if (!rangeDragging) return;
      rangeDragging = false;
      const val = parseInt(rangeEl.dataset.value || "100", 10);
      applyZoomVal(val);
    });
    zoomWrap.appendChild(rangeEl);
    zoomWrap.appendChild(zoomValLabel);
    zoomRow.appendChild(zoomWrap);
    appearanceSection.appendChild(zoomRow);
    sectionMap.appearance = appearanceSection;
    content.appendChild(appearanceSection);
    const uaSection = createElement("div", {
      className: "yuki-settings-section",
      attributes: { "data-section": "user-agent" },
    });
    uaSection.appendChild(makeTitle("fa-laptop-code", "User-Agent Header"));
    uaSection.appendChild(makeSub("Presets"));
    const uaPills = createElement("div", {
      className: "settings-option-group",
    });
    const storedUa = String(safeGet(StorageKeys.browserUserAgent, "") || "");
    const activeUa = USER_AGENT_PRESETS.find(
      (preset) => preset.ua === storedUa,
    );
    const activeUaId = activeUa ? activeUa.id : "default";
    USER_AGENT_PRESETS.forEach((preset) => {
      const pill = createElement("span", {
        className:
          "settings-option-pill" + (preset.id === activeUaId ? " active" : ""),
      });
      setText(pill, preset.name);
      bindEvent(pill, "click", () => {
        safeSet(StorageKeys.browserUserAgent, preset.ua);
        renderYukiContent("settings");
      });
      uaPills.appendChild(pill);
    });
    uaSection.appendChild(uaPills);
    uaSection.appendChild(makeSub("Custom User-Agent String"));
    const uaInput = createElement("input", {
      className: "settings-input",
      attributes: {
        type: "text",
        placeholder: "Leave empty for browser default",
      },
    });
    uaInput.value = storedUa;
    uaSection.appendChild(uaInput);
    const uaRow = createElement("div");
    setStyle(uaRow, { display: "flex", gap: "6px" });
    const uaSave = createElement("button", {
      className: "settings-action-btn",
    });
    uaSave.appendChild(
      createElement("i", { className: "fa-solid fa-floppy-disk" }),
    );
    const uaSaveLabel = createElement("span");
    setText(uaSaveLabel, " Save User-Agent");
    uaSave.appendChild(uaSaveLabel);
    bindEvent(uaSave, "click", () => {
      safeSet(StorageKeys.browserUserAgent, String(uaInput.value || "").trim());
      renderYukiContent("settings");
    });
    const uaReset = createElement("button", {
      className: "settings-action-btn",
    });
    setText(uaReset, "Reset Default");
    bindEvent(uaReset, "click", () => {
      safeSet(StorageKeys.browserUserAgent, "");
      renderYukiContent("settings");
    });
    uaRow.appendChild(uaSave);
    uaRow.appendChild(uaReset);
    uaSection.appendChild(uaRow);
    sectionMap["user-agent"] = uaSection;
    content.appendChild(uaSection);
    const tabsSection = createElement("div", {
      className: "yuki-settings-section",
      attributes: { "data-section": "tabs" },
    });
    tabsSection.appendChild(makeTitle("fa-gears", "Tabs"));
    const restoreOn = safeGet(StorageKeys.browserRestoreTabs, false);
    tabsSection.appendChild(
      makeToggle("Restore Tabs", restoreOn === true, (checked) =>
        safeSet(StorageKeys.browserRestoreTabs, checked),
      ),
    );
    const confirmOn = safeGet(StorageKeys.browserConfirmClose, false);
    tabsSection.appendChild(
      makeToggle("Confirm Close", confirmOn === true, (checked) =>
        safeSet(StorageKeys.browserConfirmClose, checked),
      ),
    );
    const tabNext = safeGet(StorageKeys.browserTabBehaviorNext, true);
    tabsSection.appendChild(
      makeToggle("New Tab Next to Current", tabNext !== false, (checked) =>
        safeSet(StorageKeys.browserTabBehaviorNext, checked),
      ),
    );
    const autoplayOn = safeGet(StorageKeys.browserAutoplayBlock, false);
    tabsSection.appendChild(
      makeToggle("Block Auto-play Media", autoplayOn === true, (checked) =>
        safeSet(StorageKeys.browserAutoplayBlock, checked),
      ),
    );
    const popupsOn = isWindowOpenPluginEnabled(os.storage);
    tabsSection.appendChild(
      makeToggle("Open Popups in New Tab", popupsOn !== false, (checked) =>
        setWindowOpenPluginEnabled(os.storage, checked),
      ),
    );
    const layoutGroup = createElement("div", {
      className: "settings-layout-group",
    });
    layoutGroup.appendChild(makeTitle("fa-columns", "Browser Layout"));
    const layoutDesc = createElement("div", {
      className: "settings-layout-desc",
    });
    setText(layoutDesc, "Choose the layout that suits you best");
    layoutGroup.appendChild(layoutDesc);
    const layoutList = createElement("div", {
      className: "settings-layout-list",
    });
    const sidebarModeOn = safeGet(StorageKeys.browserSidebar, false) === true;
    function makeLayoutOption(
      layoutId,
      labelText,
      subText,
      previewClass,
      isActive,
    ) {
      const option = createElement("div", {
        className: "layout-option" + (isActive ? " selected" : ""),
        attributes: { "data-layout": layoutId },
      });
      const preview = createElement("div", {
        className: "layout-preview " + previewClass,
      });
      if (previewClass === "layout-preview-top") {
        const topbar = createElement("div", { className: "pv-topbar" });
        for (let pvIndex = 0; pvIndex < 3; pvIndex += 1) {
          topbar.appendChild(
            createElement("div", {
              className: "pv-tab" + (pvIndex === 0 ? " active" : ""),
            }),
          );
        }
        preview.appendChild(topbar);
      } else {
        const rail = createElement("div", { className: "pv-sidebar" });
        for (let pvIndex = 0; pvIndex < 3; pvIndex += 1) {
          rail.appendChild(
            createElement("div", {
              className: "pv-tab" + (pvIndex === 0 ? " active" : ""),
            }),
          );
        }
        preview.appendChild(rail);
      }
      const pvContent = createElement("div", { className: "pv-content" });
      pvContent.appendChild(createElement("div", { className: "pv-line" }));
      pvContent.appendChild(
        createElement("div", { className: "pv-line short" }),
      );
      preview.appendChild(pvContent);
      option.appendChild(preview);
      const optLabel = createElement("div", {
        className: "layout-option-label",
      });
      setText(optLabel, labelText);
      option.appendChild(optLabel);
      const optSub = createElement("div", { className: "layout-option-sub" });
      setText(optSub, subText);
      option.appendChild(optSub);
      return option;
    }
    const topOption = makeLayoutOption(
      "topbar",
      "Top Toolbar",
      "Tabs and toolbar sit at the top",
      "layout-preview-top",
      !sidebarModeOn,
    );
    const sideOption = makeLayoutOption(
      "sidebar",
      "Sidebar",
      "Vertical tabs on the left",
      "layout-preview-side",
      sidebarModeOn,
    );
    function paintLayoutOptions(activeId) {
      topOption.classList.toggle("selected", activeId === "topbar");
      sideOption.classList.toggle("selected", activeId === "sidebar");
      collapsedRowWrap.style.display = activeId === "sidebar" ? "" : "none";
    }
    bindEvent(topOption, "click", () => {
      safeSet(StorageKeys.browserSidebar, false);
      setSidebarCollapsed(false);
      requestSidebarMode(false);
      paintLayoutOptions("topbar");
    });
    bindEvent(sideOption, "click", () => {
      safeSet(StorageKeys.browserSidebar, true);
      requestSidebarMode(true);
      paintLayoutOptions("sidebar");
    });
    layoutList.appendChild(topOption);
    layoutList.appendChild(sideOption);
    layoutGroup.appendChild(layoutList);
    const collapsedRowWrap = createElement("div", {
      className: "settings-field-row",
    });
    const collapsedLabel = createElement("span", {
      className: "settings-field-label",
    });
    setText(collapsedLabel, "Collapsed Rail");
    collapsedRowWrap.appendChild(collapsedLabel);
    const collapsedSwitch = createElement("label", {
      className: "toggle-switch",
    });
    const collapsedInput = createElement("input", {
      attributes: { type: "checkbox" },
    });
    collapsedInput.checked = sidebarModeOn && sidebarCollapsed;
    collapsedRowWrap.appendChild(collapsedSwitch);
    collapsedSwitch.appendChild(collapsedInput);
    collapsedSwitch.appendChild(
      createElement("span", { className: "toggle-slider" }),
    );
    bindEvent(collapsedInput, "change", () => {
      setSidebarCollapsed(collapsedInput.checked === true);
    });
    layoutGroup.appendChild(collapsedRowWrap);
    appearanceSection.appendChild(layoutGroup);
    paintLayoutOptions(sidebarModeOn ? "sidebar" : "topbar");
    sectionMap.tabs = tabsSection;
    content.appendChild(tabsSection);
    const privacySection = createElement("div", {
      className: "yuki-settings-section",
      attributes: { "data-section": "privacy" },
    });
    privacySection.appendChild(makeTitle("fa-shield", "Privacy"));
    const adblockOn = safeGet(StorageKeys.browserAdblockEnabled, true);
    privacySection.appendChild(
      makeToggle("Ad & Tracker Blocking", adblockOn !== false, (checked) => {
        safeSet(StorageKeys.browserAdblockEnabled, checked);
        syncAdblockButtons(checked);
      }),
    );
    const clearExitOn = safeGet(StorageKeys.browserClearOnExit, false);
    privacySection.appendChild(
      makeToggle("Clear Data on Exit", clearExitOn === true, (checked) =>
        safeSet(StorageKeys.browserClearOnExit, checked),
      ),
    );
    const torOn = safeGet(StorageKeys.browserTorEnabled, false);
    privacySection.appendChild(
      makeToggle("Tor Proxy", torOn === true, (checked) =>
        safeSet(StorageKeys.browserTorEnabled, checked),
      ),
    );
    privacySection.appendChild(makeSub("Dark Mode Exclusions"));
    const exclList = createElement("div");
    const exclusions = getDarkExclusions();
    const hosts = Object.keys(exclusions);
    if (hosts.length === 0) {
      const empty = createElement("div");
      setText(empty, "No sites excluded from dark mode.");
      setStyle(empty, { color: "var(--text-dim)", fontSize: "13px" });
      exclList.appendChild(empty);
    } else {
      hosts.forEach((host) => {
        const row = createElement("div");
        setStyle(row, {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "4px 0",
          borderBottom: "1px solid var(--border)",
        });
        const nameSpan = createElement("span");
        setText(nameSpan, host);
        setStyle(nameSpan, { fontSize: "13px", color: "var(--text)" });
        const rem = createElement("button", { className: "settings-icon-btn" });
        const remIcon = createElement("i", { className: "fa-solid fa-xmark" });
        rem.appendChild(remIcon);
        setStyle(rem, { color: "var(--error)", fontSize: "12px" });
        bindEvent(rem, "click", () => {
          const next = getDarkExclusions();
          delete next[host];
          saveDarkExclusions(next);
          const active = getActiveTab();
          if (active) applyDarkModeForUrl(active.url);
          renderYukiContent("settings");
        });
        row.appendChild(nameSpan);
        row.appendChild(rem);
        exclList.appendChild(row);
      });
    }
    privacySection.appendChild(exclList);
    const exclBtnWrap = createElement("div");
    setStyle(exclBtnWrap, { marginTop: "8px", display: "flex", gap: "6px" });
    const exclBtn = createElement("button", {
      className: "settings-action-btn",
    });
    setText(exclBtn, "Exclude Current Site");
    bindEvent(exclBtn, "click", () => {
      const active = getActiveTab();
      if (!active || !active.url) return;
      if (String(active.url).startsWith("yuki://")) return;
      let host = "";
      try {
        host = new URL(String(active.url)).hostname;
      } catch (parseErr) {
        return;
      }
      if (!host) return;
      const next = getDarkExclusions();
      next[host] = true;
      saveDarkExclusions(next);
      applyDarkModeForUrl(active.url);
      renderYukiContent("settings");
    });
    exclBtnWrap.appendChild(exclBtn);
    privacySection.appendChild(exclBtnWrap);
    sectionMap.privacy = privacySection;
    content.appendChild(privacySection);
    const enginesSection = createElement("div", {
      className: "yuki-settings-section",
      attributes: { "data-section": "search-engines" },
    });
    enginesSection.appendChild(
      makeTitle("fa-magnifying-glass", "Search Engines"),
    );
    enginesSection.appendChild(makeSub("Custom Search Engines"));
    const engineList = createElement("div");
    const customEngines = getCustomEngines();
    if (customEngines.length === 0) {
      const empty = createElement("div");
      setText(empty, "No custom search engines added.");
      setStyle(empty, { color: "var(--text-dim)", fontSize: "13px" });
      engineList.appendChild(empty);
    } else {
      customEngines.forEach((eng, idx) => {
        const row = createElement("div");
        setStyle(row, {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 0",
          borderBottom: "1px solid var(--border)",
        });
        const info = createElement("div");
        const nameEl = createElement("div");
        setText(nameEl, eng.name);
        setStyle(nameEl, { fontSize: "13px", color: "var(--text)" });
        const urlEl = createElement("div");
        setText(urlEl, eng.url);
        setStyle(urlEl, { fontSize: "11px", color: "var(--text-muted)" });
        info.appendChild(nameEl);
        info.appendChild(urlEl);
        const rem = createElement("button", { className: "settings-icon-btn" });
        const remIcon = createElement("i", {
          className: "fa-solid fa-trash-can",
        });
        rem.appendChild(remIcon);
        setStyle(rem, { color: "var(--error)", fontSize: "12px" });
        bindEvent(rem, "click", () => {
          const next = getCustomEngines();
          next.splice(idx, 1);
          saveCustomEngines(next);
          renderYukiContent("settings");
        });
        row.appendChild(info);
        row.appendChild(rem);
        engineList.appendChild(row);
      });
    }
    enginesSection.appendChild(engineList);
    const addWrap = createElement("div");
    setStyle(addWrap, { marginTop: "8px" });
    const addBtn = createElement("button", {
      className: "settings-action-btn",
    });
    setText(addBtn, "Add Custom Engine");
    bindEvent(addBtn, "click", async () => {
      const name = await os.dialog.prompt(
        "Add search engine",
        "Search engine name:",
      );
      if (!name) return;
      const url = await os.dialog.prompt(
        "Add search engine",
        "Search URL with {search} placeholder:",
      );
      if (!url) return;
      if (!String(url).includes("{search}")) return;
      const next = getCustomEngines();
      next.push({
        name: String(name).trim(),
        url: String(url).replace("{search}", ""),
      });
      saveCustomEngines(next);
      renderYukiContent("settings");
    });
    addWrap.appendChild(addBtn);
    enginesSection.appendChild(addWrap);
    sectionMap["search-engines"] = enginesSection;
    content.appendChild(enginesSection);
    const dataSection = createElement("div", {
      className: "yuki-settings-section",
      attributes: { "data-section": "data" },
    });
    dataSection.appendChild(makeTitle("fa-database", "Data"));
    const dataWrap = createElement("div");
    setStyle(dataWrap, { display: "flex", gap: "5px", flexWrap: "wrap" });
    const clearHistBtn = createElement("button", {
      className: "settings-action-btn",
    });
    setText(clearHistBtn, "Clear History");
    bindEvent(clearHistBtn, "click", async () => {
      const ok = await os.dialog.confirm(
        "Clear history",
        "Clear all browsing history?",
      );
      if (!ok) return;
      safeSet(StorageKeys.browserHistory, []);
      renderYukiContent("settings");
    });
    const clearDlBtn = createElement("button", {
      className: "settings-action-btn",
    });
    setText(clearDlBtn, "Clear Downloads");
    bindEvent(clearDlBtn, "click", async () => {
      const ok = await os.dialog.confirm(
        "Clear downloads",
        "Clear all downloads?",
      );
      if (!ok) return;
      downloadList.length = 0;
      updateMenuBadges();
      renderYukiContent("settings");
    });
    const clearAllBtn = createElement("button", {
      className: "settings-action-btn danger",
    });
    setText(clearAllBtn, "Clear All");
    bindEvent(clearAllBtn, "click", async () => {
      const ok = await os.dialog.confirm(
        "Clear all data",
        "Clear all browsing data?",
      );
      if (!ok) return;
      clearBrowsingData();
      renderYukiContent("settings");
    });
    dataWrap.appendChild(clearHistBtn);
    dataWrap.appendChild(clearDlBtn);
    dataWrap.appendChild(clearAllBtn);
    dataSection.appendChild(dataWrap);
    sectionMap.data = dataSection;
    content.appendChild(dataSection);
    const proxySection = createElement("div", {
      className: "yuki-settings-section",
      attributes: { "data-section": "proxy" },
    });
    proxySection.appendChild(makeTitle("fa-server", "Proxy"));
    proxySection.appendChild(makeSub("Transport"));
    const activeTransport = getActiveTransport() || "libcurl";
    const transportGroup = createElement("div", {
      className: "settings-option-group",
    });
    const transportDefs = [
      { id: "epoxy", label: "Epoxy" },
      { id: "libcurl", label: "libcurl" },
    ];
    transportDefs.forEach((def) => {
      const pill = createElement("span", {
        className:
          "settings-option-pill" +
          (def.id === activeTransport ? " active" : ""),
      });
      setText(pill, def.label);
      bindEvent(pill, "click", () => {
        safeSet(StorageKeys.browserTransport, def.id);
        renderYukiContent("settings");
      });
      transportGroup.appendChild(pill);
    });
    proxySection.appendChild(transportGroup);
    proxySection.appendChild(makeSub("Select Server"));
    const serverList = createElement("div", { className: "server-list" });
    const currentWisp = currentWispUrl();
    const customWisps = getCustomWisps();
    const allServers = WISP_SERVERS.concat(customWisps);
    allServers.forEach((server, srvIndex) => {
      const isActive = server.url === currentWisp;
      const isCustom = srvIndex >= WISP_SERVERS.length;
      const option = createElement("div", {
        className: "wisp-option" + (isActive ? " active" : ""),
        attributes: { "data-wisp-url": server.url },
      });
      const header = createElement("div", { className: "wisp-option-header" });
      const nameWrap = createElement("div", { className: "wisp-option-name" });
      setText(nameWrap, server.name);
      if (isActive) {
        const check = createElement("i", { className: "fa-solid fa-check" });
        nameWrap.appendChild(check);
      }
      const status = createElement("div", { className: "server-status" });
      if (isCustom) {
        const del = createElement("button", { className: "delete-wisp-btn" });
        const delIcon = createElement("i", {
          className: "fa-solid fa-trash-can",
        });
        del.appendChild(delIcon);
        bindEvent(del, "click", (ev) => {
          ev.stopPropagation();
          os.dialog
            .confirm("Remove server", "Remove this server?")
            .then((ok) => {
              if (!ok) return;
              const next = getCustomWisps().filter(
                (entry) => entry.url !== server.url,
              );
              saveCustomWisps(next);
              if (currentWispUrl() === server.url)
                saveWispUrl(DEFAULT_WISP_URL);
              renderYukiContent("settings");
            });
        });
        status.appendChild(del);
      }
      header.appendChild(nameWrap);
      header.appendChild(status);
      const urlEl = createElement("div", { className: "wisp-option-url" });
      setText(urlEl, server.url);
      option.appendChild(header);
      option.appendChild(urlEl);
      bindEvent(option, "click", () => {
        saveWispUrl(server.url);
        renderYukiContent("settings");
      });
      serverList.appendChild(option);
      const statusBox = $(".server-status", option);
      const pingLabel = createElement("span", { className: "ping-text" });
      setText(pingLabel, "...");
      const healthDot = createElement("span", {
        className: "status-indicator",
      });
      if (statusBox) {
        statusBox.appendChild(pingLabel);
        statusBox.appendChild(healthDot);
      }
      checkWispHealth(server.url, 5000).then((result) => {
        if (!option.isConnected) return;
        if (result && result.ok) {
          setText(pingLabel, String(result.ms) + "ms");
          healthDot.classList.remove("status-error");
          healthDot.classList.add("status-success");
        } else {
          setText(pingLabel, "offline");
          healthDot.classList.remove("status-success");
          healthDot.classList.add("status-error");
        }
      });
    });
    proxySection.appendChild(serverList);
    proxySection.appendChild(makeSub("Custom Server"));
    const wispRow = createElement("div");
    setStyle(wispRow, { display: "flex", gap: "10px" });
    const wispInput = createElement("input", {
      className: "settings-input",
      attributes: { type: "text", placeholder: "wss://your-server.com/wisp/" },
    });
    const wispAdd = createElement("button", { className: "settings-icon-btn" });
    const wispPlus = createElement("i", { className: "fa-solid fa-plus" });
    wispAdd.appendChild(wispPlus);
    bindEvent(wispAdd, "click", () => {
      const raw = String(wispInput.value || "").trim();
      if (!raw) return;
      if (!raw.startsWith("ws://") && !raw.startsWith("wss://")) return;
      const existing = getCustomWisps();
      const known = WISP_SERVERS.map((item) => item.url).concat(
        existing.map((item) => item.url),
      );
      if (known.includes(raw)) return;
      existing.push({ name: "Custom " + (existing.length + 1), url: raw });
      saveCustomWisps(existing);
      renderYukiContent("settings");
    });
    wispRow.appendChild(wispInput);
    wispRow.appendChild(wispAdd);
    proxySection.appendChild(wispRow);
    const repairBtn = createElement("button", {
      className: "settings-action-btn",
    });
    setText(repairBtn, "Repair Proxy");
    bindEvent(repairBtn, "click", () => {
      resetTransports();
      renderYukiContent("settings");
      os.notify.send("Proxy repaired", "Transport state has been reset.");
    });
    proxySection.appendChild(repairBtn);
    sectionMap.proxy = proxySection;
    content.appendChild(proxySection);
    const dangerSection = createElement("div", {
      className: "yuki-settings-section",
      attributes: { "data-section": "danger-zone" },
    });
    dangerSection.appendChild(
      makeTitle("fa-triangle-exclamation", "Danger Zone"),
    );
    const resetBtn = createElement("button", {
      className: "settings-action-btn danger",
    });
    setText(resetBtn, "Reset All Settings");
    bindEvent(resetBtn, "click", async () => {
      const ok = await os.dialog.confirm(
        "Reset settings",
        "Reset all settings to defaults?",
      );
      if (!ok) return;
      try {
        const toRemove = [];
        for (let i = 0; i < localStorage.length; i += 1) {
          const key = localStorage.key(i);
          if (
            typeof key === "string" &&
            (key.startsWith("yukiOS_browser") ||
              key.startsWith("yukiOS_wisp") ||
              key.startsWith("scramjet_"))
          )
            toRemove.push(key);
        }
        toRemove.forEach((key) => {
          try {
            os.storage.remove(key);
          } catch (remErr) {
            return;
          }
        });
      } catch (enumErr) {
        return;
      }
      renderYukiContent("settings");
    });
    dangerSection.appendChild(resetBtn);
    sectionMap["danger-zone"] = dangerSection;
    content.appendChild(dangerSection);
    bindEvent(document, "click", () => {
      const opens = $$(".yuki-select.open", body);
      opens.forEach((sel) => sel.classList.remove("open"));
    });
    layout.appendChild(nav);
    layout.appendChild(content);
    body.appendChild(layout);
  }
  function renderYukiContent(kind) {
    const container = ensureYukiContainer();
    container.replaceChildren();
    setStyle(container, { display: "block" });
    container.classList.toggle("settings-zoom", kind === "settings");
    const label = kind.charAt(0).toUpperCase() + kind.slice(1);
    buildYukiHeader(container, label);
    const body = createElement("div", { className: "yuki-page-body" });
    container.appendChild(body);
    if (kind === "history") renderHistoryBody(body);
    else if (kind === "bookmarks") renderBookmarksBody(body);
    else if (kind === "downloads") renderDownloadsBody(body);
    else if (kind === "blocking-log") renderBlockingBody(body);
    else if (kind === "dino") renderDinoBody(body);
    else if (kind === "settings") renderSettingsBody(body);
    else {
      const empty = createElement("div", { className: "yuki-page-empty" });
      setText(empty, label);
      body.appendChild(empty);
    }
  }
  function openYukiPage(kind) {
    const target = String(kind || "history");
    const active = getActiveTab();
    if (active && !yukiState.active) {
      yukiState.prevUrl = active.url;
      yukiState.prevTitle = active.title;
    }
    yukiState.active = true;
    yukiState.kind = target;
    tabs.forEach((tab) => {
      if (tab.viewport) setStyle(tab.viewport, { display: "none" });
    });
    renderYukiContent(target);
    notifyAddress(HOME_URL + "/" + target);
    return target;
  }
  function closeYukiPage() {
    yukiState.active = false;
    yukiState.kind = null;
    hideYukiContainer();
    const active = getActiveTab();
    if (active) {
      if (
        yukiState.prevUrl &&
        active.url &&
        String(active.url).startsWith("yuki://")
      ) {
        active.url = yukiState.prevUrl;
        active.title = yukiState.prevTitle || titleFromUrl(yukiState.prevUrl);
      }
      applyVisibility();
      notifyAddress(active.url);
    } else applyVisibility();
    yukiState.prevUrl = null;
    yukiState.prevTitle = null;
  }
  function newTabHtml() {
    return buildYukiHomeSrcdoc();
  }
  function renderNewTab(frame) {
    const target = frame || (getActiveTab() ? getActiveTab().viewport : null);
    if (!target) return;
    try {
      target.removeAttribute("src");
      target.srcdoc = newTabHtml();
    } catch (renderErr) {
      return;
    }
  }
  function ensureFindBar() {
    let bar = rootNode ? $(".find-bar", rootNode) : null;
    if (bar) return bar;
    bar = createElement("div", { className: "find-bar" });
    const input = createElement("input", {
      className: "find-input",
      attributes: { type: "text", placeholder: "Find in page" },
    });
    const count = createElement("span", {
      className: "find-count",
      text: "0/0",
    });
    const prev = createElement("button", {
      className: "find-nav-btn",
      text: "prev",
    });
    const next = createElement("button", {
      className: "find-nav-btn",
      text: "next",
    });
    const close = createElement("button", {
      className: "find-close-btn",
      text: "close",
    });
    bar.appendChild(input);
    bar.appendChild(count);
    bar.appendChild(prev);
    bar.appendChild(next);
    bar.appendChild(close);
    bindEvent(input, "input", () => {
      runFind(input.value);
    });
    bindEvent(next, "click", () => {
      findNext();
    });
    bindEvent(prev, "click", () => {
      findPrev();
    });
    bindEvent(close, "click", () => {
      findClose();
    });
    const layer = pageLayer();
    if (layer) layer.appendChild(bar);
    return bar;
  }
  function clearFindMarks() {
    const active = getActiveTab();
    if (!active || !active.viewport) return;
    try {
      const doc =
        active.viewport.contentDocument ||
        (active.viewport.contentWindow &&
          active.viewport.contentWindow.document);
      if (!doc || !doc.body) return;
      const marks = doc.querySelectorAll(".find-highlight");
      marks.forEach((mark) => {
        mark.replaceWith(mark.textContent);
      });
      doc.body.normalize();
    } catch (findErr) {
      return;
    }
  }
  function updateFindCount() {
    const count = rootNode ? $(".find-count", rootNode) : null;
    if (!count) return;
    const total = findState.matches.length;
    setText(count, (total ? findState.current + 1 : 0) + "/" + total);
  }
  function runFind(query) {
    findState.query = String(query || "");
    clearFindMarks();
    findState.matches = [];
    findState.current = -1;
    if (!findState.query) {
      updateFindCount();
      return [];
    }
    const active = getActiveTab();
    if (!active || !active.viewport) {
      updateFindCount();
      return [];
    }
    try {
      const doc =
        active.viewport.contentDocument ||
        (active.viewport.contentWindow &&
          active.viewport.contentWindow.document);
      if (!doc || !doc.body) {
        updateFindCount();
        return [];
      }
      const lower = findState.query.toLowerCase();
      const walker = doc.createTreeWalker(doc.body, 4, null, false);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach((node) => {
        let current = node;
        let index = (current.textContent || "").toLowerCase().indexOf(lower);
        while (index !== -1) {
          const after = current.splitText(index);
          if (after.textContent.length > findState.query.length)
            after.splitText(findState.query.length);
          const mark = doc.createElement("mark");
          mark.className = "find-highlight";
          mark.textContent = after.textContent;
          after.replaceWith(mark);
          findState.matches.push(mark);
          current = mark.nextSibling;
          if (!current || current.nodeType !== 3) break;
          index = current.textContent.toLowerCase().indexOf(lower);
        }
      });
      if (findState.matches.length > 0) {
        findState.current = 0;
        findState.matches[0].classList.add("active");
        findState.matches[0].scrollIntoView({ block: "center" });
      }
    } catch (findErr) {
      return [];
    }
    updateFindCount();
    return findState.matches.slice();
  }
  function stepFind(delta) {
    if (findState.matches.length === 0) return -1;
    findState.matches[findState.current].classList.remove("active");
    findState.current =
      (findState.current + delta + findState.matches.length) %
      findState.matches.length;
    findState.matches[findState.current].classList.add("active");
    findState.matches[findState.current].scrollIntoView({ block: "center" });
    updateFindCount();
    return findState.current;
  }
  function findNext() {
    ensureFindBar();
    return stepFind(1);
  }
  function findPrev() {
    ensureFindBar();
    return stepFind(-1);
  }
  function findClose() {
    clearFindMarks();
    findState.matches = [];
    findState.current = -1;
    if (rootNode) {
      const bar = $(".find-bar", rootNode);
      if (bar) bar.remove();
    }
  }
  function persistZoom() {
    safeSet(StorageKeys.browserZoom, zoomLevel);
  }
  function zoomIn() {
    const active = getActiveTab();
    if (!active) {
      zoomLevel = Math.min(3.0, parseFloat((zoomLevel + 0.1).toFixed(1)));
      persistZoom();
      refreshZoomLabel();
      return zoomLevel;
    }
    if (!Number.isFinite(active.zoom)) active.zoom = zoomLevel;
    active.zoom = Math.min(3.0, parseFloat((active.zoom + 0.1).toFixed(1)));
    zoomLevel = active.zoom;
    persistZoom();
    applyZoomToViewport(active);
    refreshZoomLabel();
    return active.zoom;
  }
  function zoomOut() {
    const active = getActiveTab();
    if (!active) {
      zoomLevel = Math.max(0.3, parseFloat((zoomLevel - 0.1).toFixed(1)));
      persistZoom();
      refreshZoomLabel();
      return zoomLevel;
    }
    if (!Number.isFinite(active.zoom)) active.zoom = zoomLevel;
    active.zoom = Math.max(0.3, parseFloat((active.zoom - 0.1).toFixed(1)));
    zoomLevel = active.zoom;
    persistZoom();
    applyZoomToViewport(active);
    refreshZoomLabel();
    return active.zoom;
  }
  function zoomReset() {
    const active = getActiveTab();
    if (!active) {
      zoomLevel = 1.0;
      persistZoom();
      tabs.forEach((tab) => {
        tab.zoom = 1.0;
        applyZoomToViewport(tab);
      });
      refreshZoomLabel();
      return zoomLevel;
    }
    active.zoom = 1.0;
    zoomLevel = 1.0;
    persistZoom();
    applyZoomToViewport(active);
    refreshZoomLabel();
    return active.zoom;
  }
  function toggleSplit() {
    if (splitState.splitId) {
      splitState.splitId = null;
      applyVisibility();
      return null;
    }
    if (tabs.length < 2) {
      const created = addTab(DEFAULT_TAB_URL);
      splitState.splitId = created.id;
      applyVisibility();
      return created.id;
    }
    const activeIndex = tabs.findIndex((tab) => tab.id === state.activeId);
    const candidate = tabs[(activeIndex + 1) % tabs.length];
    splitState.splitId = candidate ? candidate.id : null;
    applyVisibility();
    return splitState.splitId;
  }
  function isSplitActive() {
    if (!splitState.splitId) return false;
    return Boolean(findTab(splitState.splitId));
  }
  async function navigateSplit(url) {
    let target = splitState.splitId ? findTab(splitState.splitId) : null;
    if (!target || target.id === state.activeId) {
      const other = tabs.find((entry) => entry.id !== state.activeId) || null;
      if (other) {
        splitState.splitId = other.id;
        target = other;
        applyVisibility();
      } else {
        const preserved = state.activeId;
        const created = addTab(url || DEFAULT_TAB_URL);
        if (preserved) state.activeId = preserved;
        splitState.splitId = created.id;
        applyVisibility();
        const wanted = normalizeUrl(url || DEFAULT_TAB_URL);
        if (created.url === wanted) {
          if (created.id === state.activeId) notifyAddress(created.url);
          return created;
        }
        target = created;
      }
    }
    if (!target) return null;
    return performNavigate(target, url);
  }
  function enterFullscreen() {
    const active = getActiveTab();
    if (!active || !active.viewport) return false;
    try {
      if (active.viewport.requestFullscreen) {
        active.viewport.requestFullscreen();
        return true;
      }
      if (active.viewport.webkitRequestFullscreen) {
        active.viewport.webkitRequestFullscreen();
        return true;
      }
    } catch (fullErr) {
      return false;
    }
    return false;
  }
  function toggleDarkMode() {
    darkModeOn = !darkModeOn;
    if (rootNode) rootNode.classList.toggle("browser-darkmode", darkModeOn);
    return darkModeOn;
  }
  function saveCurrentPage() {
    const active = getActiveTab();
    if (!active || !active.url) return false;
    if (String(active.url).startsWith("yuki://")) return false;
    const bookmarks = loadBookmarks();
    if (!bookmarks.some((mark) => mark && mark.url === active.url)) {
      bookmarks.push({ name: active.title || active.url, url: active.url });
      safeSet(StorageKeys.browserBookmarks, bookmarks);
      renderBookmarkBar();
      updateStarButton();
    }
    downloadList.unshift({
      filename: active.title || "Saved Page",
      url: active.url,
      status: "done",
      time: Date.now(),
    });
    updateMenuBadges();
    notifyChange();
    return true;
  }
  function downloadCanvas(canvas, filename) {
    return new Promise((resolve) => {
      try {
        canvas.toBlob((blob) => {
          if (!blob) {
            resolve(false);
            return;
          }
          try {
            const link = createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            link.click();
            setTimeout(() => URL.revokeObjectURL(link.href), 4000);
            resolve(true);
          } catch (saveErr) {
            resolve(false);
          }
        }, "image/png");
      } catch (shotErr) {
        resolve(false);
      }
    });
  }
  async function captureScreenshot() {
    const active = getActiveTab();
    if (!active || !active.viewport) return false;
    try {
      const loaded = await loadHtmlCanvas();
      const captureFn =
        (loaded && (loaded.default || loaded.html2canvas)) ||
        (typeof window !== "undefined" ? window.html2canvas : null);
      if (typeof captureFn !== "function") {
        os.notify.send(
          "Screenshot failed",
          "Screenshot library could not be loaded.",
          { type: "error" },
        );
        return false;
      }
      const canvas = await captureFn(active.viewport, {
        backgroundColor: null,
      });
      if (!canvas) {
        os.notify.send(
          "Screenshot failed",
          "The current page could not be captured.",
          { type: "error" },
        );
        return false;
      }
      const done = await downloadCanvas(
        canvas,
        (active.title || "screenshot") + ".png",
      );
      if (!done) {
        os.notify.send(
          "Screenshot failed",
          "The current page could not be captured.",
          { type: "error" },
        );
        return false;
      }
      downloadList.unshift({
        filename: (active.title || "screenshot") + ".png",
        url: active.url,
        status: "done",
        time: Date.now(),
      });
      updateMenuBadges();
      notifyChange();
      return true;
    } catch (shotErr) {
      os.notify.send(
        "Screenshot failed",
        "The current page could not be captured.",
        { type: "error" },
      );
      return false;
    }
  }
  async function handleMenuAction(action) {
    const name = String(action || "");
    emitAction(name, {});
    if (name === "new-tab" || name === "new-window")
      return addTab(DEFAULT_TAB_URL);
    if (name === "new-private-window") return addTab(DEFAULT_TAB_URL);
    if (name === "downloads") return openYukiPage("downloads");
    if (name === "history") return openYukiPage("history");
    if (name === "bookmarks") return openYukiPage("bookmarks");
    if (name === "toggle-bookmark") return toggleBookmark();
    if (name === "reload") return reload();
    if (name === "toggle-bookmarkbar") {
      const current = safeGet(StorageKeys.browserShowBookmarks, true);
      safeSet(StorageKeys.browserShowBookmarks, !current);
      renderBookmarkBar();
      updateMenuBadges();
      return !current;
    }
    if (name === "reopen-tab") return reopenClosedTab();
    if (name === "save-page") return saveCurrentPage();
    if (name === "screenshot") return captureScreenshot();
    if (name === "devtools") {
      try {
        os.app.launch("erudaApp");
      } catch (launchErr) {
        openYukiPage("settings");
      }
      return true;
    }
    if (name === "wisp-settings" || name === "settings")
      return openYukiPage("settings");
    if (name === "clear-data") {
      os.dialog
        .confirm(
          "Delete browsing data",
          "Delete all browsing history, downloads, and bookmarks?",
        )
        .then((confirmed) => {
          if (confirmed) clearBrowsingData();
        });
      return true;
    }
    if (name === "fullscreen") return enterFullscreen();
    if (name === "darkmode") return toggleDarkMode();
    if (name === "zoom-in") return zoomIn();
    if (name === "zoom-out") return zoomOut();
    if (name === "zoom-reset") return zoomReset();
    if (name === "split") return toggleSplit();
    if (name === "find") {
      ensureFindBar();
      return true;
    }
    return null;
  }
  function reopenClosedTab() {
    if (closedStack.length === 0) return null;
    const closed = closedStack.pop();
    if (!closed || !closed.url) return null;
    const tab = addTab(closed.url);
    updateMenuBadges();
    notifyChange();
    return tab;
  }
  function togglePin(id) {
    const tab = findTab(id);
    if (!tab) return null;
    tab.isPinned = !tab.isPinned;
    notifyChange();
    return tab.isPinned;
  }
  function toggleMute(id) {
    const tab = findTab(id);
    if (!tab) return null;
    tab.isMuted = !tab.isMuted;
    try {
      const doc = tab.viewport ? tab.viewport.contentDocument : null;
      if (doc) {
        const media = doc.querySelectorAll("audio,video");
        media.forEach((entry) => {
          entry.muted = tab.isMuted;
        });
      }
    } catch (mediaErr) {
      notifyChange();
      return tab.isMuted;
    }
    notifyChange();
    return tab.isMuted;
  }
  function refreshAudioStates() {
    let changed = false;
    for (const tab of tabs) {
      let playing = false;
      try {
        const doc = tab.viewport ? tab.viewport.contentDocument : null;
        const media = doc ? doc.querySelectorAll("audio,video") : [];
        for (const el of media) {
          if (!el.paused && !el.muted && el.volume > 0) {
            playing = true;
            break;
          }
        }
      } catch (mediaErr) {
        void mediaErr;
      }
      if (tab.isPlaying !== playing) {
        tab.isPlaying = playing;
        changed = true;
      }
    }
    return changed;
  }
  const audioTimer = setInterval(() => {
    try {
      if (refreshAudioStates()) notifyChange();
    } catch (timerErr) {
      void timerErr;
    }
  }, 3000);
  function destroy() {
    clearInterval(audioTimer);
  }
  function duplicateTab(id) {
    const tab = findTab(id);
    if (!tab || !tab.url) return null;
    return addTab(tab.url);
  }
  function reopenClosedTabAt(index) {
    if (!Number.isInteger(index) || index < 0 || index >= closedStack.length)
      return null;
    const removed = closedStack.splice(index, 1)[0];
    if (!removed || !removed.url) return null;
    const tab = addTab(removed.url);
    updateMenuBadges();
    return tab;
  }
  function clearClosedTabs() {
    closedStack.length = 0;
    updateMenuBadges();
    notifyChange();
  }
  function getClosedTabs() {
    return closedStack.map((entry) => ({ url: entry.url, title: entry.title }));
  }
  function closeOtherTabs(id) {
    const target = findTab(id);
    if (!target) return 0;
    const ids = tabs
      .filter((entry) => entry.id !== id)
      .map((entry) => entry.id);
    let count = 0;
    ids.forEach((closeId) => {
      const closeIndex = tabs.findIndex((entry) => entry.id === closeId);
      if (closeIndex !== -1) {
        finishCloseAt(closeIndex, closeId);
        count += 1;
      }
    });
    return count;
  }
  function closeLeftTabs(id) {
    const targetIndex = tabs.findIndex((entry) => entry.id === id);
    if (targetIndex <= 0) return 0;
    const ids = tabs.slice(0, targetIndex).map((entry) => entry.id);
    let count = 0;
    ids.forEach((closeId) => {
      const closeIndex = tabs.findIndex((entry) => entry.id === closeId);
      if (closeIndex !== -1) {
        finishCloseAt(closeIndex, closeId);
        count += 1;
      }
    });
    return count;
  }
  function closeRightTabs(id) {
    const targetIndex = tabs.findIndex((entry) => entry.id === id);
    if (targetIndex === -1 || targetIndex >= tabs.length - 1) return 0;
    const ids = tabs.slice(targetIndex + 1).map((entry) => entry.id);
    let count = 0;
    ids.forEach((closeId) => {
      const closeIndex = tabs.findIndex((entry) => entry.id === closeId);
      if (closeIndex !== -1) {
        finishCloseAt(closeIndex, closeId);
        count += 1;
      }
    });
    return count;
  }
  function toggleSidebar() {
    return setSidebarCollapsed(!sidebarCollapsed);
  }
  function setSidebarCollapsed(on) {
    sidebarCollapsed = on === true;
    if (rootNode) {
      const sidebar = $('[id^="tab-sidebar"]', rootNode);
      if (sidebar) sidebar.classList.toggle("collapsed", sidebarCollapsed);
    }
    safeSet(StorageKeys.browserSidebarCollapsed, sidebarCollapsed);
    return sidebarCollapsed;
  }
  function requestSidebarMode(on) {
    if (typeof sidebarModeCallback === "function") {
      try {
        sidebarModeCallback(on === true);
      } catch (callbackErr) {
        void callbackErr;
      }
    }
  }
  function saveWispUrl(url) {
    const trimmed = String(url || "").trim();
    let clean = FALLBACK_WISP;
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol === "ws:" || parsed.protocol === "wss:")
        clean = trimmed;
    } catch (parseErr) {
      clean = FALLBACK_WISP;
    }
    safeSet(StorageKeys.wispServer, clean);
    return clean;
  }
  function clearBrowsingData() {
    safeSet(StorageKeys.browserHistory, []);
    safeSet(StorageKeys.browserBookmarks, []);
    downloadList.length = 0;
    renderBookmarkBar();
    updateStarButton();
    updateMenuBadges();
    if (yukiState.active) renderYukiContent(yukiState.kind);
    notifyChange();
    return true;
  }
  try {
    const storedDarkInit = safeGet(StorageKeys.browserDarkMode, false);
    darkModeOn = storedDarkInit === true;
    if (rootNode) rootNode.classList.toggle("browser-darkmode", darkModeOn);
  } catch (initErr) {
    return;
  }
  refreshZoomLabel();
  renderBookmarkBar();
  return {
    addTab,
    switchTab,
    closeTab,
    moveTab,
    setChangeListener,
    updateStarButton,
    updateMenuBadges,
    getActive,
    getAll,
    goBack,
    goForward,
    reload,
    navigateTab,
    previewNavigate,
    setStatusFor,
    clearStatus,
    jumpNavStack,
    updateOmnibox,
    hideOmnibox,
    getOmniboxSelection,
    selectOmniboxNext,
    selectOmniboxPrev,
    activateOmniboxSelection,
    toggleBookmark,
    renderBookmarkBar,
    openYukiPage,
    closeYukiPage,
    renderNewTab,
    findNext,
    findPrev,
    findClose,
    zoomIn,
    zoomOut,
    zoomReset,
    toggleSplit,
    isSplitActive,
    navigateSplit,
    handleMenuAction,
    reopenClosedTab,
    reopenClosedTabAt,
    clearClosedTabs,
    getClosedTabs,
    duplicateTab,
    togglePin,
    toggleMute,
    refreshAudioStates,
    destroy,
    closeOtherTabs,
    closeLeftTabs,
    closeRightTabs,
    toggleSidebar,
    setSidebarCollapsed,
    requestSidebarMode,
    saveWispUrl,
    clearBrowsingData,
    recordBlocked,
  };
}
