import { PROXIES, clampProxyIndex, buildProxyUrl } from "./proxies.js";
import { BaseApp } from "./core/BaseApp.js";
import { resolveIconUrl } from "./assetUrl.js";
import { customConfirm } from "./shared/dialogs.js";
import { WindowHelper } from "./utils/WindowHelper.js";
import { StorageKeys } from "./settings.js";
import { AppSource } from "./AppSource.js";

export class BrowserApp extends BaseApp {
  static refreshIcons(node) {
    if (window.FontAwesome && window.FontAwesome.dom && window.FontAwesome.dom.i2svg) {
      window.FontAwesome.dom.i2svg({ node });
    }
  }
  constructor(services) {
    super(services);
    this.windowHelper = new WindowHelper(this.wm);
    this.winId = "browser-app-main";
    this.tabs = [];
    this.tabIdCounter = 0;
    this.activeTabId = null;
    this.dragSrcTabId = null;
    this._destroyed = false;
    this.proxies = PROXIES;
    this.defaultBookmarks = [
      { name: "Google", url: "https://www.google.com/webhp?igu=1" },
      { name: "Reeyuki Site", url: "https://reeyuki.nekoweb.org" },
      { name: "Wikipedia", url: "https://www.wikipedia.org" },
      { name: "JS Fiddle", url: "https://jsfiddle.net" },
      { name: "SoundBoard", url: "https://www.myinstants.com/en/categories/sound%20effects/us/" },
      { name: "DustinnWin10", url: "https://dustinbrett.com" },
      { name: "Win 11", url: "https://selenite.cc/resources/sppa/11/index.html" }
    ];
    this.proxyExclusionList = ["dustinbrett.com"];
    this.currentProxyIndex = 0;
    this.win = null;
    this.tabBar = null;
    this.tabStrip = null;
    this.controlsSlot = null;
    this.addressBar = null;
    this.proxySelect = null;
    this.iframeContainer = null;
    this.bookmarkBar = null;
    this.loadingOverlay = null;
    this._msgListener = null;
    this._kbListener = null;
    this._contextMenu = null;
    this.zoomLevel = 1.0;
    this.closedTabs = [];
    this.omniboxDropdown = null;
    this.darkModeEnabled = false;
    this.darkModeExclusions = {};
    this.homepageUrl = "yuki://home";
    this._declarativeApp = null;

    this._loadPrefs();
  }

  open(title = "Yuki Browser", url = null) {
    if (this._isSingletonOpen(this.winId)) return;

    this._destroyed = false;

    const startUrl = url || this.homepageUrl;

    const content = `
      <div class="browser-root" id="browser-root-${this.winId}">
        <div class="browser-tabbar" id="tabbar-${this.winId}" style="display:flex;align-items:center;">
          <div id="tab-strip-${this.winId}" style="display:flex;flex:1;overflow:auto;align-items:center;min-width:0;"></div>
          <div id="controls-slot-${this.winId}" style="display:flex;align-items:center;flex-shrink:0;"></div>
        </div>
        <div class="browser-navbar" id="navbar-${this.winId}">
          <button class="nav-btn" id="btn-back-${this.winId}" title="Back (Right-click for history)">&#8592;</button>
          <button class="nav-btn" id="btn-fwd-${this.winId}" title="Forward (Right-click for history)">&#8594;</button>
          <button class="nav-btn" id="btn-reload-${this.winId}" title="Reload">&#8635;</button>
          <button class="nav-btn" id="btn-home-${this.winId}" title="Home">⌂</button>
          <div class="address-bar-wrap">
            <input class="address-bar" id="address-${this.winId}" type="text" placeholder="Search or enter URL..." spellcheck="false" autocomplete="off"/>
            <button class="bookmark-star" id="btn-star-${this.winId}" title="Bookmark this page">☆</button>
          </div>
          <select class="proxy-select" id="proxy-${this.winId}">
            <option value="-1"${this.currentProxyIndex === -1 ? " selected" : ""}>No proxy</option>
            ${this.proxies.map((p, i) => `<option value="${i}"${i === this.currentProxyIndex ? " selected" : ""}>${p.label}</option>`).join("")}
          </select>
          <div class="zoom-controls">
            <button class="zoom-btn" id="btn-zoom-out-${this.winId}" title="Zoom out">−</button>
            <span class="zoom-label" id="zoom-label-${this.winId}">${Math.round(this.zoomLevel * 100)}%</span>
            <button class="zoom-btn" id="btn-zoom-in-${this.winId}" title="Zoom in">+</button>
          </div>
          <button class="nav-btn" id="btn-darkmode-${this.winId}" title="Dark Mode" style="font-size:14px">🌙</button>
          <button class="nav-btn" id="btn-screenshot-${this.winId}" title="Screenshot">📷</button>
          <button class="nav-btn" id="btn-fullscreen-${this.winId}" title="Fullscreen iframe">⛶</button>
          <button class="browser-menu-btn" id="btn-menu-${this.winId}" title="Menu">⋮</button>
        </div>
        <div class="bookmark-bar${this.showBookmarkBar ? "" : " hidden"}" id="bookmarkbar-${this.winId}"></div>
        <div class="browser-content" id="content-${this.winId}">
          <div class="iframe-loading-overlay" id="loading-${this.winId}">
            <div class="loading-spinner"></div>
            <div class="loading-text">Loading...</div>
          </div>
        </div>
      </div>
    `;

    this.win = this.windowHelper.createAndMountWindow(this.winId, title, content, "900px", "620px", {
      icon: resolveIconUrl("static/icons/firefox.webp")
    });

    this.tabBar = document.getElementById(`tabbar-${this.winId}`);
    this.tabStrip = document.getElementById(`tab-strip-${this.winId}`);
    this.controlsSlot = document.getElementById(`controls-slot-${this.winId}`);
    this.addressBar = document.getElementById(`address-${this.winId}`);
    this.proxySelect = document.getElementById(`proxy-${this.winId}`);
    this.iframeContainer = document.getElementById(`content-${this.winId}`);
    this.bookmarkBar = document.getElementById(`bookmarkbar-${this.winId}`);
    this.loadingOverlay = document.getElementById(`loading-${this.winId}`);

    const header = this.win.querySelector(".window-header");
    const controls = header?.querySelector(".window-controls");
    if (controls && this.controlsSlot) {
      this.controlsSlot.appendChild(controls);
      header.style.display = "none";
    }

    this.setupNavEvents();
    this.setupKeyboardShortcuts();
    this.setupMessageListener();
    this.setupKeyboardShortcuts();
    this.renderBookmarks();
    this.createTab(startUrl, true);

    this._wrapCloseButton();
  }

  _loadPrefs() {
    try {
      this.bookmarks = JSON.parse(localStorage.getItem(StorageKeys.browserBookmarks)) || [];
      this.downloads = JSON.parse(localStorage.getItem(StorageKeys.browserDownloads)) || [];
      this.history = JSON.parse(localStorage.getItem(StorageKeys.browserHistory)) || [];
      this.showBookmarkBar = localStorage.getItem(StorageKeys.browserShowBookmarks) !== "false";
      this.zoomLevel = parseFloat(localStorage.getItem(StorageKeys.browserZoom)) || 1.0;
      this.currentProxyIndex = clampProxyIndex(
        parseInt(localStorage.getItem(StorageKeys.browserProxyIndex)),
        this.proxies
      );
      this.darkModeEnabled = localStorage.getItem(StorageKeys.browserDarkMode) === "true";
      this.darkModeExclusions = JSON.parse(localStorage.getItem(StorageKeys.browserDarkExclusions) || "{}");
      this.homepageUrl = localStorage.getItem(StorageKeys.browserHomepage) || "yuki://home";
    } catch (e) {
      this.bookmarks = [];
      this.downloads = [];
      this.history = [];
      this.showBookmarkBar = true;
      this.zoomLevel = 1.0;
      this.currentProxyIndex = 0;
      this.darkModeEnabled = false;
      this.darkModeExclusions = {};
      this.homepageUrl = "yuki://home";
    }

    if (!Array.isArray(this.bookmarks) || this.bookmarks.length === 0) {
      this.bookmarks = this.defaultBookmarks;
      localStorage.setItem(StorageKeys.browserBookmarks, JSON.stringify(this.bookmarks));
    }
  }

  _saveBookmarks() {
    localStorage.setItem(StorageKeys.browserBookmarks, JSON.stringify(this.bookmarks));
  }
  _saveDownloads() {
    localStorage.setItem(StorageKeys.browserDownloads, JSON.stringify(this.downloads));
  }
  _saveHistory() {
    localStorage.setItem(StorageKeys.browserHistory, JSON.stringify(this.history.slice(-500)));
  }

  _savePrefs() {
    localStorage.setItem(StorageKeys.browserShowBookmarks, String(this.showBookmarkBar));
    localStorage.setItem(StorageKeys.browserZoom, String(this.zoomLevel));
    localStorage.setItem(StorageKeys.browserProxyIndex, String(this.currentProxyIndex));
    localStorage.setItem(StorageKeys.browserDarkMode, String(this.darkModeEnabled));
    localStorage.setItem(StorageKeys.browserDarkExclusions, JSON.stringify(this.darkModeExclusions));
    localStorage.setItem(StorageKeys.browserHomepage, this.homepageUrl);
  }

  _addToHistory(url, title) {
    if (url === "yuki://home") return;
    this.history.push({ url, title: title || url, time: Date.now() });
    this._saveHistory();
  }

  isGoogleUrl(url) {
    try {
      const host = new URL(url).hostname;
      return host === "www.google.com" || host === "google.com";
    } catch (e) {
      return false;
    }
  }

  isWikipediaUrl(url) {
    try {
      const host = new URL(url).hostname;
      return host === "www.wikipedia.org" || host === "wikipedia.org";
    } catch (e) {
      return false;
    }
  }

  isDirectLoadUrl(url) {
    if (this.isGoogleUrl(url) || this.isWikipediaUrl(url)) {
      return true;
    }
    try {
      const host = new URL(url).hostname.toLowerCase();
      return this.proxyExclusionList.some((domain) => host === domain || host.endsWith("." + domain));
    } catch (e) {
      return false;
    }
  }

  isYukiHome(url) {
    return url === "yuki://home";
  }

  _wrapCloseButton() {
    const closeBtn = this.win?.querySelector(".close-btn");
    if (!closeBtn || closeBtn.dataset.browserWrappedClose === "true") return;
    const originalOnClick = closeBtn.onclick;
    closeBtn.onclick = (e) => {
      this.destroy();
      if (typeof originalOnClick === "function") return originalOnClick.call(closeBtn, e);
    };
    closeBtn.dataset.browserWrappedClose = "true";
  }

  onClose() {
    this.destroy();
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;

    try {
      if (this._kbListener) document.removeEventListener("keydown", this._kbListener);
    } catch (e) {}
    try {
      if (this._msgListener) window.removeEventListener("message", this._msgListener);
    } catch (e) {}

    try {
      this._closeDropdown?.();
    } catch (e) {}
    try {
      this._closePanel?.();
    } catch (e) {}

    this._kbListener = null;
    this._msgListener = null;
    this._contextMenu = null;
    this.omniboxDropdown = null;
  }

  requestClose() {
    const closeBtn = this.win?.querySelector(".close-btn");
    if (closeBtn) closeBtn.click();
    else this.destroy();
  }

  openHtml(content, name = "file", path = "file://") {
    const id = `file-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const win = this.wm.createWindow(id, name, "900px", "620px");

    const html = typeof content === "string" ? content : "";

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);

    win.innerHTML = `
    <div class="window-header">
      <span>Browser</span>
      ${this.wm.getWindowControls()}
    </div>

    <div class="browser-root" id="browser-root-${id}">
      <div class="browser-tabbar" id="tabbar-${id}">
        <div class="browser-tab active" data-tab-id="1">
          <span class="tab-favicon-placeholder">📄</span>
          <span class="tab-title">${name}</span>
        </div>
      </div>

      <div class="browser-navbar" id="navbar-${id}">
        <button class="nav-btn" disabled>←</button>
        <button class="nav-btn" disabled>→</button>
        <button class="nav-btn">↻</button>
        <button class="nav-btn">⌂</button>

        <div class="address-bar-wrap">
          <input class="address-bar" value="${path}" readonly />
        </div>

        <button class="browser-menu-btn">⋮</button>
      </div>

      <div class="browser-content" id="content-${id}" style="height:100%; display:flex;">
        <iframe class="browser-iframe active" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" src="${url}"></iframe>
      </div>
    </div>
  `;

    this.windowHelper.mountWindow(win, id, name, "fas fa-file");

    const iframe = win.querySelector("iframe");
    if (iframe) {
      iframe.addEventListener("load", () => {
        try {
          URL.revokeObjectURL(url);
        } catch (e) {}
      });
    }

    return win;
  }
  setupNavEvents() {
    const backBtn = document.getElementById(`btn-back-${this.winId}`);
    backBtn.addEventListener("click", () => {
      const tab = this.getActiveTab();
      if (!tab || tab.historyIndex <= 0) return;
      tab.historyIndex--;
      this.loadHistoryEntry(tab);
    });
    backBtn.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      this.openNavHistoryMenu(e, "back");
    });

    const fwdBtn = document.getElementById(`btn-fwd-${this.winId}`);
    fwdBtn.addEventListener("click", () => {
      const tab = this.getActiveTab();
      if (!tab || tab.historyIndex >= tab.history.length - 1) return;
      tab.historyIndex++;
      this.loadHistoryEntry(tab);
    });
    fwdBtn.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      this.openNavHistoryMenu(e, "forward");
    });

    document.getElementById(`btn-reload-${this.winId}`).addEventListener("click", () => {
      const tab = this.getActiveTab();
      if (tab) this.loadUrl(tab, tab.url);
    });

    document.getElementById(`btn-home-${this.winId}`).addEventListener("click", () => {
      this.navigate(this.homepageUrl);
    });

    document.getElementById(`btn-home-${this.winId}`).addEventListener("contextmenu", (e) => {
      e.preventDefault();
      this.openHomepageConfig(e.currentTarget);
    });

    this.addressBar.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        this.hideOmnibox();
        this.navigate(this.addressBar.value.trim());
      }
      if (e.key === "Escape") {
        this.hideOmnibox();
        this.addressBar.blur();
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        this.navigateOmnibox(e.key === "ArrowDown" ? 1 : -1);
      }
    });

    this.addressBar.addEventListener("input", () => {
      this.updateOmnibox(this.addressBar.value);
    });

    this.addressBar.addEventListener("focus", () => {
      this.addressBar.select();
      this.updateOmnibox(this.addressBar.value);
    });

    this.addressBar.addEventListener("blur", () => {
      setTimeout(() => this.hideOmnibox(), 150);
    });

    this.proxySelect.addEventListener("change", () => {
      const oldProxyIndex = this.currentProxyIndex;
      this.currentProxyIndex = parseInt(this.proxySelect.value);
      this._savePrefs();

      const proxyName =
        this.currentProxyIndex === -1 ? "No proxy" : this.proxies[this.currentProxyIndex]?.label || "Unknown";
      this.notify("Proxy Changed", `Switched to ${proxyName}`, "info", 3000);

      const tab = this.getActiveTab();
      if (tab && tab.url && !this.isYukiHome(tab.url)) {
        this.showLoading(true);
        tab.title = "Loading…";
        this.renderTabs();
        this.loadUrl(tab, tab.url);
      }
    });

    document.getElementById(`btn-screenshot-${this.winId}`).addEventListener("click", () => {
      this.takeScreenshot();
    });

    document.getElementById(`btn-star-${this.winId}`).addEventListener("click", () => {
      this.toggleBookmark();
    });

    document.getElementById(`btn-menu-${this.winId}`).addEventListener("click", (e) => {
      e.stopPropagation();
      this.openMainMenu(e.currentTarget);
    });

    document.getElementById(`btn-zoom-in-${this.winId}`).addEventListener("click", () => {
      this.zoomLevel = Math.min(3.0, parseFloat((this.zoomLevel + 0.1).toFixed(1)));
      this.applyZoom();
    });

    document.getElementById(`btn-zoom-out-${this.winId}`).addEventListener("click", () => {
      this.zoomLevel = Math.max(0.3, parseFloat((this.zoomLevel - 0.1).toFixed(1)));
      this.applyZoom();
    });

    document.getElementById(`btn-darkmode-${this.winId}`).addEventListener("click", (e) => {
      e.stopPropagation();
      this.openDarkModePopup(e.currentTarget);
    });

    document.getElementById(`btn-fullscreen-${this.winId}`).addEventListener("click", () => {
      this.enterIframeFullscreen();
    });
  }

  openNavHistoryMenu(e, direction) {
    this._closeDropdown();
    const tab = this.getActiveTab();
    if (!tab) return;

    let entries = [];
    if (direction === "back") {
      entries = tab.history
        .slice(0, tab.historyIndex)
        .reverse()
        .map((url, i) => ({ url, idx: tab.historyIndex - 1 - i }));
    } else {
      entries = tab.history.slice(tab.historyIndex + 1).map((url, i) => ({ url, idx: tab.historyIndex + 1 + i }));
    }

    if (entries.length === 0) return;

    const menu = document.createElement("div");
    menu.className = "ctx-menu";
    menu.style.top = e.clientY + "px";
    menu.style.left = e.clientX + "px";

    menu.innerHTML = entries
      .slice(0, 12)
      .map(({ url, idx }) => {
        let label = url;
        try {
          label = new URL(url).hostname || url;
        } catch (ex) {}
        return `<div class="ctx-history-item" data-idx="${idx}" title="${url}"><i class="fas fa-history" style="width:16px;margin-right:8px;opacity:0.6;"></i>${label}</div>`;
      })
      .join("");

    BrowserApp.refreshIcons(menu);

    menu.querySelectorAll(".ctx-history-item").forEach((item) => {
      item.addEventListener("click", (ev) => {
        ev.stopPropagation();
        this._closeDropdown();
        const idx = parseInt(item.dataset.idx);
        tab.historyIndex = idx;
        this.loadHistoryEntry(tab);
      });
    });

    document.body.appendChild(menu);
    this._contextMenu = menu;

    const close = (ev) => {
      if (!menu.contains(ev.target)) {
        this._closeDropdown();
        document.removeEventListener("click", close);
      }
    };
    setTimeout(() => document.addEventListener("click", close), 0);
  }

  openDarkModePopup(anchor) {
    this._closeDropdown();
    const rect = anchor.getBoundingClientRect();
    const popup = document.createElement("div");
    popup.className = "dark-mode-popup";
    popup.style.top = rect.bottom + 6 + "px";
    popup.style.left = rect.left - 120 + "px";

    const tab = this.getActiveTab();
    let currentHost = "";
    try {
      currentHost = new URL(tab?.url || "").hostname;
    } catch (ex) {}
    const isExcluded = currentHost && this.darkModeExclusions[currentHost] === true;

    popup.innerHTML = `
      <div class="dm-title">Dark Mode</div>
      <div class="dm-row" id="dm-toggle-row">
        <span>Dark mode</span>
        <div class="dm-toggle${this.darkModeEnabled ? " on" : ""}" id="dm-global-toggle"></div>
      </div>
      ${
        currentHost
          ? `
      <div class="dm-row" id="dm-site-row">
        <span style="font-size:12px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${isExcluded ? "Re-enable for" : "Disable for"} ${currentHost}</span>
        <span style="font-size:18px;cursor:pointer">${isExcluded ? "✓" : "✕"}</span>
      </div>`
          : ""
      }
    `;

    const toggleEl = popup.querySelector("#dm-global-toggle");
    toggleEl.addEventListener("click", () => {
      this.darkModeEnabled = !this.darkModeEnabled;
      toggleEl.classList.toggle("on", this.darkModeEnabled);
      this._savePrefs();
      this.applyDarkModeToActiveTab();
    });

    const siteRow = popup.querySelector("#dm-site-row");
    if (siteRow) {
      siteRow.addEventListener("click", () => {
        if (isExcluded) {
          delete this.darkModeExclusions[currentHost];
        } else {
          this.darkModeExclusions[currentHost] = true;
        }
        this._savePrefs();
        this.applyDarkModeToActiveTab();
        this._closeDropdown();
      });
    }

    document.body.appendChild(popup);
    this._contextMenu = popup;

    const close = (ev) => {
      if (!popup.contains(ev.target)) {
        this._closeDropdown();
        document.removeEventListener("click", close);
      }
    };
    setTimeout(() => document.addEventListener("click", close), 0);
  }

  applyDarkModeToActiveTab() {
    const tab = this.getActiveTab();
    if (!tab) return;
    this._applyDarkModeToTab(tab);
  }

  _applyDarkModeToTab(tab) {
    if (!tab.iframe) return;
    let host = "";
    try {
      host = new URL(tab.url || "").hostname;
    } catch (ex) {}
    const excluded = host && this.darkModeExclusions[host] === true;
    const shouldDark = this.darkModeEnabled && !excluded;

    try {
      const doc = tab.iframe.contentDocument;
      if (!doc) return;
      const existingStyle = doc.getElementById("__yuki_dark_mode__");
      if (shouldDark) {
        if (!existingStyle) {
          const s = doc.createElement("style");
          s.id = "__yuki_dark_mode__";
          s.textContent = `
            html { filter: invert(1) hue-rotate(180deg) !important; }
            img, video, canvas, svg, picture, iframe { filter: invert(1) hue-rotate(180deg) !important; }
          `;
          (doc.head || doc.documentElement).appendChild(s);
        }
      } else {
        if (existingStyle) existingStyle.remove();
      }
    } catch (ex) {}
  }

  enterIframeFullscreen() {
    const tab = this.getActiveTab();
    if (!tab || !tab.iframe) return;
    if (tab.iframe.requestFullscreen) {
      tab.iframe.requestFullscreen().catch(() => {});
    } else if (tab.iframe.webkitRequestFullscreen) {
      tab.iframe.webkitRequestFullscreen();
    }
  }

  openHomepageConfig(anchor) {
    this._closeDropdown();
    const dialog = document.createElement("div");
    dialog.className = "homepage-dialog";
    dialog.innerHTML = `
      <div class="homepage-dialog-box">
        <div class="homepage-dialog-title">Set Homepage</div>
        <input type="text" id="homepage-input-${this.winId}" value="${this.homepageUrl}" placeholder="https://... or yuki://home"/>
        <div class="homepage-dialog-btns">
          <button id="hp-cancel-${this.winId}">Cancel</button>
          <button id="hp-default-${this.winId}">Reset Default</button>
          <button class="primary" id="hp-save-${this.winId}">Save</button>
        </div>
      </div>
    `;
    document.body.appendChild(dialog);

    dialog.querySelector(`#hp-cancel-${this.winId}`).addEventListener("click", () => dialog.remove());
    dialog.querySelector(`#hp-default-${this.winId}`).addEventListener("click", () => {
      this.homepageUrl = "yuki://home";
      this._savePrefs();
      dialog.remove();
    });
    dialog.querySelector(`#hp-save-${this.winId}`).addEventListener("click", () => {
      const val = dialog.querySelector(`#homepage-input-${this.winId}`).value.trim();
      if (val) {
        this.homepageUrl = val;
        this._savePrefs();
      }
      dialog.remove();
    });
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) dialog.remove();
    });
  }

  updateOmnibox(query) {
    if (!query || query.length < 1) {
      this.hideOmnibox();
      return;
    }
    const q = query.toLowerCase();
    const results = [];
    const seen = new Set();

    const addResult = (icon, title, url) => {
      if (seen.has(url) || results.length >= 8) return;
      seen.add(url);
      results.push({ icon, title, url });
    };

    [...this.history].reverse().forEach((h) => {
      if (h.url.toLowerCase().includes(q) || (h.title || "").toLowerCase().includes(q)) {
        addResult("🕐", h.title || h.url, h.url);
      }
    });

    this.bookmarks.forEach((b) => {
      if (b.url.toLowerCase().includes(q) || b.name.toLowerCase().includes(q)) {
        addResult("★", b.name, b.url);
      }
    });

    if (results.length === 0) {
      this.hideOmnibox();
      return;
    }

    const wrap = document.querySelector(`#address-${this.winId}`).closest(".address-bar-wrap");
    let dropdown = wrap.querySelector(".omnibox-dropdown");
    if (!dropdown) {
      dropdown = document.createElement("div");
      dropdown.className = "omnibox-dropdown";
      wrap.appendChild(dropdown);
      wrap.style.position = "relative";
    }
    this.omniboxDropdown = dropdown;
    this._omniboxSelectedIndex = -1;

    dropdown.innerHTML = results
      .map(
        (r, i) => `
      <div class="omnibox-item" data-url="${r.url}" data-idx="${i}">
        <span class="omnibox-item-icon">${r.icon}</span>
        <span class="omnibox-item-title">${r.title}</span>
        <span class="omnibox-item-url">${r.url}</span>
      </div>
    `
      )
      .join("");

    dropdown.querySelectorAll(".omnibox-item").forEach((item) => {
      item.addEventListener("mousedown", (e) => {
        e.preventDefault();
        const url = item.dataset.url;
        this.hideOmnibox();
        this.navigate(url);
      });
    });
  }

  navigateOmnibox(delta) {
    if (!this.omniboxDropdown) return;
    const items = this.omniboxDropdown.querySelectorAll(".omnibox-item");
    if (!items.length) return;
    this._omniboxSelectedIndex = (this._omniboxSelectedIndex + delta + items.length) % items.length;
    items.forEach((el, i) => el.classList.toggle("selected", i === this._omniboxSelectedIndex));
    const selected = items[this._omniboxSelectedIndex];
    if (selected) this.addressBar.value = selected.dataset.url;
  }

  hideOmnibox() {
    if (this.omniboxDropdown) {
      this.omniboxDropdown.remove();
      this.omniboxDropdown = null;
    }
    this._omniboxSelectedIndex = -1;
  }

  applyZoom() {
    const label = document.getElementById(`zoom-label-${this.winId}`);
    if (label) label.textContent = Math.round(this.zoomLevel * 100) + "%";
    const tab = this.getActiveTab();
    if (tab) {
      tab.iframe.style.transform = this.zoomLevel !== 1.0 ? `scale(${this.zoomLevel})` : "";
      if (this.zoomLevel !== 1.0) {
        tab.iframe.style.width = 100 / this.zoomLevel + "%";
        tab.iframe.style.height = 100 / this.zoomLevel + "%";
      } else {
        tab.iframe.style.width = "100%";
        tab.iframe.style.height = "100%";
      }
    }
    this._savePrefs();
  }

  setupKeyboardShortcuts() {
    this._kbListener = (e) => {
      const inWin = this.win && this.win.contains(document.activeElement);
      if (!inWin && document.activeElement !== document.body) return;

      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && /^[1-9]$/.test(e.key)) {
        e.preventDefault();
        const index = parseInt(e.key, 10) - 1;
        const tab = this.tabs[index];
        if (tab) this.switchTab(tab.id);
        return;
      }

      if (e.ctrlKey && e.key === "l") {
        e.preventDefault();
        this.addressBar.focus();
        this.addressBar.select();
      }
      if (e.ctrlKey && e.key === "t") {
        e.preventDefault();
        this.createTab(this.homepageUrl, true);
      }
      if (e.ctrlKey && e.key === "w") {
        e.preventDefault();
        const tab = this.getActiveTab();
        if (tab) this.closeTab(tab.id);
      }
      if (e.ctrlKey && e.shiftKey && e.key === "T") {
        e.preventDefault();
        this.reopenLastClosedTab();
      }
    };
    document.addEventListener("keydown", this._kbListener);
  }

  setupMessageListener() {
    if (this._msgListener) return;
    this._msgListener = (e) => {
      if (!e.data || typeof e.data !== "object") return;
      if (e.data.type === "browser-navigate") {
        const tab = this.getActiveTab();
        if (!tab) return;
        this.pushHistory(tab, e.data.url);
        tab.title = "Loading…";
        this.showLoading(true);
        this.renderTabs();
        this.loadUrl(tab, e.data.url);
      }
      if (e.data.type === "browser-download") {
        this.fetchAndDownload(e.data.url, e.data.filename);
      }
      if (e.data.type === "browser-audio-playing") {
        const tab = this.tabs.find((t) => t.iframe && t.iframe.contentWindow === e.source);
        if (tab) {
          tab.isPlayingAudio = e.data.playing;
          this.renderTabs();
        }
      }
    };
    window.addEventListener("message", this._msgListener);
  }

  loadHistoryEntry(tab) {
    const url = tab.history[tab.historyIndex];
    tab.url = url;
    this.updateAddressBar(url);
    this.updateNavButtons(tab);
    this.showLoading(true);
    tab.title = "Loading…";
    this.renderTabs();
    this.loadUrl(tab, url);
  }

  updateNavButtons(tab) {
    const backBtn = document.getElementById(`btn-back-${this.winId}`);
    const fwdBtn = document.getElementById(`btn-fwd-${this.winId}`);
    if (backBtn) backBtn.disabled = !tab || tab.historyIndex <= 0;
    if (fwdBtn) fwdBtn.disabled = !tab || tab.historyIndex >= tab.history.length - 1;
  }

  updateStarButton(url) {
    const btn = document.getElementById(`btn-star-${this.winId}`);
    if (!btn) return;
    const isBookmarked = this.bookmarks.some((b) => b.url === url);
    btn.textContent = isBookmarked ? "★" : "☆";
    btn.classList.toggle("bookmarked", isBookmarked);
  }

  toggleBookmark() {
    const tab = this.getActiveTab();
    if (!tab || !tab.url) return;
    const idx = this.bookmarks.findIndex((b) => b.url === tab.url);
    if (idx !== -1) {
      this.bookmarks.splice(idx, 1);
    } else {
      this.bookmarks.push({ name: tab.title || tab.url, url: tab.url });
    }
    this._saveBookmarks();
    this.renderBookmarks();
    this.updateStarButton(tab.url);
  }

  renderBookmarks() {
    if (!this.bookmarkBar) return;
    this.bookmarkBar.innerHTML = "";
    this.bookmarks.forEach((bm, idx) => {
      const item = document.createElement("div");
      item.className = "bookmark-item";
      try {
        const origin = new URL(bm.url.startsWith("http") ? bm.url : "https://" + bm.url).origin;
        item.innerHTML = `<img class="bookmark-favicon" src="${origin}/favicon.ico" onerror="this.style.display='none'"/><span>${bm.name}</span><span class="bm-remove" data-idx="${idx}">×</span>`;
      } catch (e) {
        item.innerHTML = `<span>${bm.name}</span><span class="bm-remove" data-idx="${idx}">×</span>`;
      }
      item.addEventListener("click", (e) => {
        if (e.target.classList.contains("bm-remove")) {
          e.stopPropagation();
          this.bookmarks.splice(idx, 1);
          this._saveBookmarks();
          this.renderBookmarks();
          return;
        }
        this.navigate(bm.url);
      });
      this.bookmarkBar.appendChild(item);
    });
  }

  createTab(url = null, switchTo = true) {
    const startUrl = url || this.homepageUrl;
    const id = ++this.tabIdCounter;
    const iframe = document.createElement("iframe");
    iframe.className = "browser-iframe";
    iframe.setAttribute(
      "sandbox",
      "allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation-by-user-activation"
    );
    this.iframeContainer.appendChild(iframe);

    const tab = {
      id,
      title: "New Tab",
      url: "",
      iframe,
      active: false,
      pinned: false,
      history: [],
      historyIndex: -1,
      isGoogle: false,
      faviconUrl: null,
      isPlayingAudio: false
    };
    this.tabs.push(tab);

    if (switchTo) this.switchTab(id);
    if (startUrl) this.navigateTab(id, startUrl);
    this.renderTabs();
    return tab;
  }

  closeTab(tabId) {
    const idx = this.tabs.findIndex((t) => t.id === tabId);
    if (idx === -1) return;
    const tab = this.tabs[idx];

    this.closedTabs.push({ url: tab.url, title: tab.title });
    if (this.closedTabs.length > 20) this.closedTabs.shift();

    tab.iframe.remove();
    this.tabs.splice(idx, 1);
    if (this.tabs.length === 0) {
      this.requestClose();
      return;
    }
    if (this.activeTabId === tabId) {
      const next = this.tabs[Math.min(idx, this.tabs.length - 1)];
      this.switchTab(next.id);
    }
    this.renderTabs();
  }

  reopenLastClosedTab() {
    if (this.closedTabs.length === 0) return;
    const closed = this.closedTabs.pop();
    this.createTab(closed.url, true);
  }

  closeOtherTabs(tabId) {
    const toClose = this.tabs.filter((t) => t.id !== tabId).map((t) => t.id);
    toClose.forEach((id) => {
      const tab = this.tabs.find((t) => t.id === id);
      if (tab) {
        this.closedTabs.push({ url: tab.url, title: tab.title });
        tab.iframe.remove();
      }
    });
    this.tabs = this.tabs.filter((t) => t.id === tabId);
    if (this.closedTabs.length > 20) this.closedTabs = this.closedTabs.slice(-20);
    this.switchTab(tabId);
    this.renderTabs();
  }

  closeTabsToRight(tabId) {
    const idx = this.tabs.findIndex((t) => t.id === tabId);
    if (idx === -1) return;
    const toClose = this.tabs.slice(idx + 1);
    toClose.forEach((tab) => {
      this.closedTabs.push({ url: tab.url, title: tab.title });
      tab.iframe.remove();
    });
    this.tabs = this.tabs.slice(0, idx + 1);
    if (this.closedTabs.length > 20) this.closedTabs = this.closedTabs.slice(-20);
    if (!this.tabs.find((t) => t.id === this.activeTabId)) {
      this.switchTab(this.tabs[this.tabs.length - 1].id);
    }
    this.renderTabs();
  }

  closeTabsToLeft(tabId) {
    const idx = this.tabs.findIndex((t) => t.id === tabId);
    if (idx === -1) return;
    const toClose = this.tabs.slice(0, idx);
    toClose.forEach((tab) => {
      this.closedTabs.push({ url: tab.url, title: tab.title });
      tab.iframe.remove();
    });
    this.tabs = this.tabs.slice(idx);
    if (this.closedTabs.length > 20) this.closedTabs = this.closedTabs.slice(-20);
    if (!this.tabs.find((t) => t.id === this.activeTabId)) {
      this.switchTab(this.tabs[0].id);
    }
    this.renderTabs();
  }

  switchTab(tabId) {
    this.tabs.forEach((t) => {
      t.active = t.id === tabId;
      t.iframe.classList.toggle("active", t.active);
    });
    this.activeTabId = tabId;
    const tab = this.getActiveTab();
    if (tab) {
      this.updateAddressBar(tab.url);
      this.updateNavButtons(tab);
      this.updateStarButton(tab.url);
    }
    this.renderTabs();
  }

  getActiveTab() {
    return this.tabs.find((t) => t.id === this.activeTabId) || null;
  }

  navigate(input) {
    const tab = this.getActiveTab();
    if (!tab) return;
    this.navigateTab(tab.id, input);
  }

  navigateTab(tabId, input) {
    const tab = this.tabs.find((t) => t.id === tabId);
    if (!tab) return;
    const url = this.resolveUrl(input);
    tab.url = url;
    tab.history = tab.history.slice(0, tab.historyIndex + 1);
    tab.history.push(url);
    tab.historyIndex = tab.history.length - 1;
    this.updateNavButtons(tab);
    this.showLoading(true);
    tab.title = "Loading…";
    this.renderTabs();
    if (this.activeTabId === tabId) {
      this.updateAddressBar(url);
      this.updateStarButton(url);
    }
    this.loadUrl(tab, url);
  }

  pushHistory(tab, url) {
    tab.url = url;
    tab.history = tab.history.slice(0, tab.historyIndex + 1);
    tab.history.push(url);
    tab.historyIndex = tab.history.length - 1;
    if (this.activeTabId === tab.id) {
      this.updateAddressBar(url);
      this.updateNavButtons(tab);
      this.updateStarButton(url);
    }
  }

  resolveUrl(input) {
    if (!input) return this.homepageUrl;
    if (input === "yuki://home") return "yuki://home";
    if (/^(https?:\/\/)?(www\.)?google\.com(\/.*)?$/i.test(input)) return "https://www.google.com/webhp?igu=1";
    if (/^https?:\/\//i.test(input)) return input;
    if (/^[\w-]+\.[a-z]{2,}(\/.*)?$/i.test(input)) return "https://" + input;
    return "https://www.google.com/search?q=" + encodeURIComponent(input);
  }

  buildProxyUrl(url, proxyIndex) {
    const idx = proxyIndex !== undefined ? proxyIndex : this.currentProxyIndex;
    return buildProxyUrl(url, idx, this.proxies);
  }

  loadUrl(tab, url) {
    if (this.isYukiHome(url)) {
      this.loadYukiHome(tab);
    } else if (this.isDirectLoadUrl(url)) {
      this.loadDirect(tab, url);
    } else if (this.currentProxyIndex === -1) {
      this.loadDirect(tab, url);
    } else {
      this.loadWithFallback(tab, url, this.currentProxyIndex);
    }
  }

  loadDirect(tab, url) {
    tab.isGoogle = this.isGoogleUrl(url);
    tab.iframe.removeAttribute("srcdoc");
    tab.iframe.onload = null;

    const onLoad = () => {
      tab.iframe.removeEventListener("load", onLoad);
      this.showLoading(false);
      this.onTabLoaded(tab, url);
      if (tab.isGoogle) this.interceptGoogleLinks(tab);
      this._applyDarkModeToTab(tab);
      this._injectAudioDetector(tab);
    };
    tab.iframe.addEventListener("load", onLoad);
    tab.iframe.src = url;
  }

  loadYukiHome(tab) {
    tab.isGoogle = false;
    tab.iframe.removeAttribute("src");

    const homeSrcdoc = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Yuki — New Tab</title>
<style>
.bg-orb {
  position: fixed;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.4;
  pointer-events: none;
  z-index: -1;
}
.bg-orb-1 {
  width: 400px;
  height: 400px;
  background: #8ab4f8;
  top: -100px;
  left: -100px;
}
.bg-orb-2 {
  width: 300px;
  height: 300px;
  background: #fdd663;
  bottom: -50px;
  right: -50px;
}
.bg-orb-3 {
  width: 250px;
  height: 250px;
  background: #81c995;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
.main {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  text-align: center;
}
.logo {
  font-size: 64px;
  margin-bottom: 16px;
}
.main h1 {
  font-size: 32px;
  font-weight: 600;
  color: #e8eaed;
  margin: 0 0 8px 0;
}
.tagline {
  font-size: 16px;
  color: #9aa0a6;
  margin: 0 0 32px 0;
}
.time {
  font-size: 48px;
  font-weight: 300;
  color: #e8eaed;
  margin: 0 0 8px 0;
}
.date {
  font-size: 14px;
  color: #9aa0a6;
  margin: 0 0 40px 0;
}
.quick-links {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  justify-content: center;
  max-width: 600px;
}
.quick-link {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 20px;
  background: rgba(42, 42, 46, 0.8);
  border: 1px solid #3c3c40;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.15s;
  min-width: 80px;
}
.quick-link:hover {
  background: rgba(53, 53, 58, 0.9);
  border-color: #5f6368;
  transform: translateY(-2px);
}
.quick-link-icon {
  width: 32px;
  height: 32px;
  object-fit: contain;
}
.quick-link-label {
  font-size: 12px;
  color: #e8eaed;
}
body {
  margin: 0;
  font-family: "Segoe UI", system-ui, sans-serif;
  background: #202124;
  color: #e8eaed;
}
</style>
</head>
<body>
<div class="bg-orb bg-orb-1"></div>
<div class="bg-orb bg-orb-2"></div>
<div class="bg-orb bg-orb-3"></div>
<div class="main">
  <div class="logo">🌸</div>
  <h1>Yuki Browser</h1>
  <p class="tagline">Your serene corner of the web</p>
  <div class="time" id="clock">--:--</div>
  <div class="date" id="datestr"></div>
  <div class="quick-links">
    <button class="quick-link" data-nav="https://www.google.com/webhp?igu=1">
      <img class="quick-link-icon" src="https://www.google.com/favicon.ico" onerror="this.style.display='none'" />
      <div class="quick-link-label">Google</div>
    </button>
    <button class="quick-link" data-nav="https://www.wikipedia.org">
      <img class="quick-link-icon" src="https://www.wikipedia.org/favicon.ico" onerror="this.style.display='none'" />
      <div class="quick-link-label">Wikipedia</div>
    </button>
    <button class="quick-link" data-nav="https://www.github.com">
      <img class="quick-link-icon" src="https://www.github.com/favicon.ico" onerror="this.style.display='none'" />
      <div class="quick-link-label">GitHub</div>
    </button>
    <button class="quick-link" data-nav="https://www.reddit.com">
      <img class="quick-link-icon" src="https://www.reddit.com/favicon.ico" onerror="this.style.display='none'" />
      <div class="quick-link-label">Reddit</div>
    </button>
  </div>
</div>
<script>
  function tick() {
    var now = new Date();
    document.getElementById('clock').textContent = now.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    document.getElementById('datestr').textContent = now.toLocaleDateString([], {weekday:'long',year:'numeric',month:'long',day:'numeric'});
  }
  tick();
  setInterval(tick, 1000);
  document.querySelectorAll('[data-nav]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      window.parent.postMessage({ type: 'browser-navigate', url: btn.getAttribute('data-nav') }, '*');
    });
  });
<\/script>
</body>
</html>`;

    const onLoad = () => {
      tab.iframe.removeEventListener("load", onLoad);
      this.showLoading(false);
      tab.title = "Yuki — New Tab";
      tab.faviconUrl = null;
      this.renderTabs();
      if (this.activeTabId === tab.id) this.updateAddressBar("yuki://home");
    };
    tab.iframe.addEventListener("load", onLoad);
    tab.iframe.srcdoc = homeSrcdoc;
  }

  interceptGoogleLinks(tab) {
    try {
      const doc = tab.iframe.contentDocument;
      if (!doc) return;
      doc.addEventListener(
        "click",
        (e) => {
          const anchor = e.target.closest("a");
          if (!anchor) return;
          const href = anchor.getAttribute("href");
          if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
          let resolved;
          try {
            resolved = new URL(href, "https://www.google.com").href;
          } catch (err) {
            return;
          }
          if (this.isGoogleUrl(resolved)) return;
          e.preventDefault();
          e.stopPropagation();
          this.pushHistory(tab, resolved);
          tab.isGoogle = false;
          this.showLoading(true);
          tab.title = "Loading…";
          this.renderTabs();
          if (this.isDirectLoadUrl(resolved)) {
            this.loadDirect(tab, resolved);
          } else {
            this.loadWithFallback(tab, resolved, this.currentProxyIndex);
          }
        },
        true
      );
    } catch (e) {}
  }

  _injectAudioDetector(tab) {
    try {
      const doc = tab.iframe.contentDocument;
      if (!doc) return;
      const script = doc.createElement("script");
      script.textContent = `(function(){
        function check() {
          var playing = Array.from(document.querySelectorAll('audio,video')).some(function(m){return !m.paused && !m.muted && m.volume > 0;});
          window.parent.postMessage({type:'browser-audio-playing',playing:playing},'*');
        }
        setInterval(check, 1500);
      })();`;
      (doc.head || doc.documentElement).appendChild(script);
    } catch (e) {}
  }

  async loadWithFallback(tab, url, startIndex = 0) {
    this.showLoading(true);

    const proxyOrder = Array.from({ length: this.proxies.length }, (_, i) => (startIndex + i) % this.proxies.length);

    for (const proxyIndex of proxyOrder) {
      const proxyUrl = this.buildProxyUrl(url, proxyIndex);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);

      try {
        const res = await fetch(proxyUrl, { signal: controller.signal });
        clearTimeout(timer);

        if (!res.ok) throw new Error("Non-OK");

        const contentType = res.headers.get("content-type") || "";

        const isBinary =
          contentType.includes("application/octet-stream") ||
          contentType.includes("application/zip") ||
          contentType.includes("application/pdf") ||
          contentType.includes("application/x-") ||
          (contentType &&
            !contentType.includes("text") &&
            !contentType.includes("json") &&
            !contentType.includes("html") &&
            !contentType.includes("xml"));

        if (isBinary) {
          const blob = await res.blob();
          this.triggerDownload(blob, url, contentType, "");
          this.showLoading(false);
          return;
        }

        let html;

        if (contentType.includes("application/json")) {
          const json = await res.json();
          html = json.contents || json.body || json.data || "";
          if (!html) throw new Error("Empty JSON body");
        } else {
          html = await res.text();
        }

        if (!html || html.trim().length === 0) throw new Error("Empty response");

        const interceptScript =
          this.buildLinkInterceptScript(url) + this.buildDownloadInterceptScript(url) + this.buildAudioDetectScript();

        const finalHtml = this.injectScripts(html, url, interceptScript, proxyIndex);

        tab.isGoogle = false;
        tab.iframe.removeAttribute("src");

        tab.iframe.onload = () => {
          this.showLoading(false);
          this.onTabLoaded(tab, url);
          this._applyDarkModeToTab(tab);
        };

        tab.iframe.srcdoc = finalHtml;
        return;
      } catch (err) {
        clearTimeout(timer);
        continue;
      }
    }

    this.showLoading(false);
    tab.title = "Failed to load";
    this.renderTabs();
    this.writeErrorPage(tab, url);
  }

  buildAudioDetectScript() {
    return `<script>(function(){
      function check() {
        var els = document.querySelectorAll('audio,video');
        var playing = false;
        for(var i=0;i<els.length;i++){if(!els[i].paused&&!els[i].muted&&els[i].volume>0){playing=true;break;}}
        window.parent.postMessage({type:'browser-audio-playing',playing:playing},'*');
      }
      setInterval(check,1500);
    })();<\/script>`;
  }

  buildLinkInterceptScript(pageUrl) {
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
})();
<\/script>`;
  }

  buildDownloadInterceptScript(pageUrl) {
    return `<script>
(function() {
  document.addEventListener('click', function(e) {
    var anchor = e.target.closest('a[download]');
    if (!anchor) return;
    var href = anchor.getAttribute('href');
    if (!href) return;
    try {
      var resolved = new URL(href, ${JSON.stringify(pageUrl)}).href;
      e.preventDefault();
      e.stopPropagation();
      window.parent.postMessage({ type: 'browser-download', url: resolved, filename: anchor.getAttribute('download') || '' }, '*');
    } catch(err) {}
  }, true);
})();
<\/script>`;
  }

  injectScripts(html, baseUrl, scripts, proxyIndex) {
    try {
      const base = new URL(baseUrl).origin + new URL(baseUrl).pathname.replace(/\/[^/]*$/, "/");
      const proxyPrefix = this.proxies[proxyIndex !== undefined ? proxyIndex : this.currentProxyIndex].prefix;

      html = html.replace(/<base[^>]*>/gi, "");
      html = html.replace(/<link[^>]+rel\s*=\s*["']modulepreload["'][^>]*>/gi, "");
      html = this._rewriteAllUrls(html, base, proxyPrefix);

      const basePatch = this._buildRuntimePatchScript(base, proxyPrefix);
      const baseTag = `<base href="${base}" target="_self">`;
      const injection = baseTag + basePatch + scripts;

      if (/<head[^>]*>/i.test(html)) {
        return html.replace(/(<head[^>]*>)/i, `$1${injection}`);
      }
      return `<head>${injection}</head>` + html;
    } catch (e) {
      return html;
    }
  }

  _toAbsolute(val, base) {
    if (!val) return val;
    val = val.trim();
    if (
      /^(https?:|data:|blob:|javascript:|#|mailto:|tel:)/i.test(val) ||
      val.startsWith("//") ||
      val.includes("{{") ||
      val.includes("${")
    ) {
      return val.startsWith("//") ? "https:" + val : val;
    }
    try {
      return new URL(val, base).href;
    } catch (e) {
      return val;
    }
  }

  _toProxied(val, base, proxyPrefix) {
    const abs = this._toAbsolute(val, base);
    if (!abs) return abs;
    if (/^(data:|blob:|javascript:|#|mailto:|tel:)/i.test(abs)) return abs;
    try {
      const absOrigin = new URL(abs).origin;
      const baseOrigin = new URL(base).origin;
      if (absOrigin === baseOrigin) return abs;
      return proxyPrefix + encodeURIComponent(abs);
    } catch (e) {
      return abs;
    }
  }

  _rewriteAllUrls(html, base, proxyPrefix) {
    html = html.replace(/(<script[^>]*)\s+type\s*=\s*["']module["']/gi, '$1 data-was-module="true"');

    html = html.replace(
      /(\s(?:src|action|data|poster))\s*=\s*("([^"]*?)"|'([^']*?)')/gi,
      (match, attr, quoted, dq, sq) => {
        const val = dq !== undefined ? dq : sq;
        const quote = dq !== undefined ? '"' : "'";
        const rewritten = this._toProxied(val, base, proxyPrefix);
        return `${attr}=${quote}${rewritten}${quote}`;
      }
    );

    html = html.replace(/(\shref)\s*=\s*("([^"]*?)"|'([^']*?)')/gi, (match, attr, quoted, dq, sq) => {
      const val = dq !== undefined ? dq : sq;
      const quote = dq !== undefined ? '"' : "'";
      if (
        !val ||
        val.startsWith("#") ||
        val.startsWith("javascript:") ||
        val.startsWith("mailto:") ||
        val.startsWith("tel:")
      ) {
        return match;
      }
      const rewritten = this._toProxied(val, base, proxyPrefix);
      return `${attr}=${quote}${rewritten}${quote}`;
    });

    html = html.replace(/(\ssrcset)\s*=\s*("([^"]*?)"|'([^']*?)')/gi, (match, attr, quoted, dq, sq) => {
      const val = dq !== undefined ? dq : sq;
      const quote = dq !== undefined ? '"' : "'";
      const rewritten = val
        .split(",")
        .map((part) => {
          const trimmed = part.trim();
          const spaceIdx = trimmed.search(/\s/);
          if (spaceIdx === -1) return this._toProxied(trimmed, base, proxyPrefix);
          const u = trimmed.slice(0, spaceIdx);
          const descriptor = trimmed.slice(spaceIdx);
          return this._toProxied(u, base, proxyPrefix) + descriptor;
        })
        .join(", ");
      return `${attr}=${quote}${rewritten}${quote}`;
    });

    html = html.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (match, quote, val) => {
      return `url(${quote}${this._toProxied(val, base, proxyPrefix)}${quote})`;
    });

    return html;
  }

  _buildRuntimePatchScript(base, proxyPrefix) {
    return `<script>(function() {
  var __base = ${JSON.stringify(base)};
  var __proxy = ${JSON.stringify(proxyPrefix)};

  function toAbs(val) {
    if (!val || typeof val !== 'string') return val;
    val = val.trim();
    if (/^(https?:|data:|blob:|javascript:|#|mailto:|tel:)/i.test(val)) return val;
    if (val.startsWith('//')) return 'https:' + val;
    try { return new URL(val, __base).href; } catch(e) { return val; }
  }

  function toProxy(url) {
    if (!url || typeof url !== 'string') return url;
    if (/^(data:|blob:|javascript:)/i.test(url)) return url;
    try {
      var absOrigin = new URL(url).origin;
      var baseOrigin = new URL(__base).origin;
      if (absOrigin === baseOrigin) return url;
      return __proxy + encodeURIComponent(url);
    } catch(e) { return url; }
  }

  function toProxiedAbs(val) {
    return toProxy(toAbs(val));
  }

  var _createElement = document.createElement.bind(document);
  document.createElement = function(tag) {
    var el = _createElement(tag);
    var tagLower = (tag || '').toLowerCase();
    if (['script','img','video','audio','source','iframe'].indexOf(tagLower) !== -1) {
      var _srcDesc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'src') ||
                    Object.getOwnPropertyDescriptor(Element.prototype, 'src');
      if (_srcDesc && _srcDesc.set) {
        Object.defineProperty(el, 'src', {
          get: function() { return _srcDesc.get.call(this); },
          set: function(v) { _srcDesc.set.call(this, toProxiedAbs(v)); },
          configurable: true
        });
      }
    }
    if (tagLower === 'link') {
      var _hrefDesc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'href') ||
                      Object.getOwnPropertyDescriptor(Element.prototype, 'href');
      if (_hrefDesc && _hrefDesc.set) {
        Object.defineProperty(el, 'href', {
          get: function() { return _hrefDesc.get.call(this); },
          set: function(v) { _hrefDesc.set.call(this, toProxiedAbs(v)); },
          configurable: true
        });
      }
    }
    return el;
  };

  var _setAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function(name, value) {
    var n = name.toLowerCase();
    if ((n === 'src' || n === 'href' || n === 'action' || n === 'data') && typeof value === 'string') {
      value = toProxiedAbs(value);
    }
    _setAttribute.call(this, name, value);
  };

  var _fetch = window.fetch;
  window.fetch = function(input, init) {
    if (typeof input === 'string') {
      input = toProxiedAbs(input);
    } else if (input && typeof input === 'object' && input.url) {
      input = new Request(toProxiedAbs(input.url), input);
    }
    return _fetch.call(window, input, init);
  };

  var _xhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    if (typeof url === 'string') url = toProxiedAbs(url);
    var args = Array.from(arguments);
    args[1] = url;
    return _xhrOpen.apply(this, args);
  };

  if (typeof Worker !== 'undefined') {
    var _Worker = Worker;
    window.Worker = function(url, opts) {
      return new _Worker(toProxiedAbs(url), opts);
    };
    window.Worker.prototype = _Worker.prototype;
  }

  if (typeof WebSocket !== 'undefined') {
    var _WS = WebSocket;
    window.WebSocket = function(url, protocols) {
      return protocols ? new _WS(toAbs(url), protocols) : new _WS(toAbs(url));
    };
    window.WebSocket.prototype = _WS.prototype;
    Object.defineProperty(window.WebSocket, 'CONNECTING', { value: 0 });
    Object.defineProperty(window.WebSocket, 'OPEN', { value: 1 });
    Object.defineProperty(window.WebSocket, 'CLOSING', { value: 2 });
    Object.defineProperty(window.WebSocket, 'CLOSED', { value: 3 });
  }

})();<\/script>`;
  }

  async fetchAndDownload(url, filename) {
    const downloadEntry = {
      url,
      filename: filename || url.split("/").pop() || "download",
      time: Date.now(),
      status: "downloading"
    };
    this.downloads.push(downloadEntry);
    this._saveDownloads();
    try {
      if (this.isDirectLoadUrl(url)) {
        throw new Error("Direct load URL");
      }
      const proxyUrl = this.buildProxyUrl(url, this.currentProxyIndex);
      const res = await fetch(proxyUrl);
      if (!res.ok) throw new Error("Fetch failed");
      const blob = await res.blob();
      downloadEntry.status = "done";
      this._saveDownloads();
      this.triggerDownload(blob, url, res.headers.get("content-type") || "", filename);
    } catch (e) {
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        downloadEntry.status = "done";
        this._saveDownloads();
        this.triggerDownload(blob, url, "", filename);
      } catch (e2) {
        downloadEntry.status = "failed";
        this._saveDownloads();
      }
    }
  }

  triggerDownload(blob, url, contentType, filename) {
    let name = filename;
    if (!name) {
      try {
        name = new URL(url).pathname.split("/").pop() || "download";
      } catch (e) {
        name = "download";
      }
    }
    this.downloads.push({ url, filename: name, time: Date.now(), status: "done" });
    this._saveDownloads();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
  }

  writeErrorPage(tab, url) {
    tab.iframe.removeAttribute("src");
    tab.iframe.srcdoc = `<html><body style="background:#202124;color:#e8eaed;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;gap:12px"><div style="font-size:48px">⚠️</div><div style="font-size:16px">All proxies failed to load this page.</div><div style="font-size:12px;color:#9aa0a6">${url}</div></body></html>`;
  }

  onTabLoaded(tab, url) {
    try {
      const title = tab.iframe.contentDocument?.title;
      if (title) tab.title = title;
      else tab.title = new URL(url).hostname;
    } catch (e) {
      try {
        tab.title = new URL(url).hostname;
      } catch (e2) {
        tab.title = "Page";
      }
    }
    this._addToHistory(url, tab.title);
    this.fetchFavicon(tab, url);
    if (this.activeTabId === tab.id) {
      this.updateAddressBar(url);
      this.updateStarButton(url);
    }
    this.updateNavButtons(tab);
    this.renderTabs();
  }

  fetchFavicon(tab, url) {
    try {
      const origin = new URL(url).origin;
      const img = new Image();
      const directUrl = origin + "/favicon.ico";
      img.onload = () => {
        tab.faviconUrl = directUrl;
        this.renderTabs();
      };
      img.onerror = () => {
        const img2 = new Image();
        const pngUrl = origin + "/favicon.png";
        img2.onload = () => {
          tab.faviconUrl = pngUrl;
          this.renderTabs();
        };
        img2.onerror = () => {
          tab.faviconUrl = null;
          this.renderTabs();
        };
        img2.src = pngUrl;
      };
      img.src = directUrl;
    } catch (e) {
      tab.faviconUrl = null;
      this.renderTabs();
    }
  }

  showLoading(visible) {
    if (!this.loadingOverlay) return;
    this.loadingOverlay.classList.toggle("visible", visible);
  }

  updateAddressBar(url) {
    if (this.addressBar) this.addressBar.value = url || "";
  }

  async takeScreenshot() {
    const tab = this.getActiveTab();
    if (!tab) return;
    try {
      if (!window.html2canvas) {
        await new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
          s.onload = resolve;
          s.onerror = reject;
          document.head.appendChild(s);
        });
      }
      let target;
      try {
        target = tab.iframe.contentDocument.body;
      } catch (e) {
        target = tab.iframe;
      }
      const canvas = await window.html2canvas(target, { useCORS: true, allowTaint: true, backgroundColor: "#ffffff" });
      canvas.toBlob((blob) => {
        const name = (tab.title || "screenshot").replace(/[^a-z0-9]/gi, "_") + ".png";
        this.triggerDownload(blob, "", "image/png", name);
      }, "image/png");
    } catch (e) {
      const canvas = document.createElement("canvas");
      const rect = tab.iframe.getBoundingClientRect();
      canvas.width = rect.width || 900;
      canvas.height = rect.height || 500;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#202124";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#e8eaed";
      ctx.font = "16px sans-serif";
      ctx.fillText("Screenshot unavailable (cross-origin restriction)", 20, 40);
      ctx.fillText(tab.url || "", 20, 70);
      canvas.toBlob((blob) => {
        this.triggerDownload(blob, "", "image/png", "screenshot.png");
      });
    }
  }

  _closeDropdown() {
    if (this._contextMenu) {
      this._contextMenu.remove();
      this._contextMenu = null;
    }
  }

  _closePanel() {
    const panel = document.getElementById(`browser-panel-${this.winId}`);
    if (panel) panel.remove();
  }

  openMainMenu(anchor) {
    this._closeDropdown();
    const rect = anchor.getBoundingClientRect();
    const menu = document.createElement("div");
    menu.className = "browser-dropdown";
    menu.style.top = rect.bottom + 4 + "px";
    menu.style.right = window.innerWidth - rect.right + "px";
    menu.innerHTML = `
      <div class="browser-dropdown-section">
        <div class="browser-dropdown-item" data-action="downloads">
          <i class="fas fa-download di-icon" style="width:16px;margin-right:8px;opacity:0.6;"></i>
          <span class="di-label">Downloads</span>
          ${this.downloads.length ? `<span class="di-badge">${this.downloads.length}</span>` : ""}
        </div>
        <div class="browser-dropdown-item" data-action="history">
          <i class="fas fa-history di-icon" style="width:16px;margin-right:8px;opacity:0.6;"></i>
          <span class="di-label">History</span>
        </div>
        <div class="browser-dropdown-item" data-action="bookmarks">
          <i class="fas fa-star di-icon" style="width:16px;margin-right:8px;opacity:0.6;"></i>
          <span class="di-label">Bookmarks</span>
        </div>
      </div>
      <div class="browser-dropdown-section">
        <div class="browser-dropdown-item" data-action="toggle-bookmarkbar">
          <i class="fas ${this.showBookmarkBar ? "fa-check" : "fa-minus"} di-icon" style="width:16px;margin-right:8px;opacity:0.6;"></i>
          <span class="di-label">Show Bookmark Bar</span>
        </div>
        <div class="browser-dropdown-item" data-action="reopen-tab">
          <i class="fas fa-undo di-icon" style="width:16px;margin-right:8px;opacity:0.6;"></i>
          <span class="di-label">Reopen Closed Tab</span>
          ${this.closedTabs.length ? `<span class="di-badge">${this.closedTabs.length}</span>` : ""}
        </div>
      </div>
      <div class="browser-dropdown-section">
        <div class="browser-dropdown-item" data-action="clear-data">
          <i class="fas fa-trash-alt di-icon" style="width:16px;margin-right:8px;opacity:0.6;"></i>
          <span class="di-label">Delete Browsing Data</span>
        </div>
      </div>
    `;

    BrowserApp.refreshIcons(menu);

    menu.querySelectorAll(".browser-dropdown-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        const action = item.dataset.action;
        this._closeDropdown();
        if (action === "downloads") this.openDownloadsPanel();
        else if (action === "history") this.openHistoryPanel();
        else if (action === "bookmarks") this.openBookmarksPanel();
        else if (action === "toggle-bookmarkbar") this.toggleBookmarkBar();
        else if (action === "clear-data") this.clearBrowsingData();
        else if (action === "reopen-tab") this.reopenLastClosedTab();
      });
    });

    document.body.appendChild(menu);
    this._contextMenu = menu;

    const close = (e) => {
      if (!menu.contains(e.target)) {
        this._closeDropdown();
        document.removeEventListener("click", close);
      }
    };
    setTimeout(() => document.addEventListener("click", close), 0);
  }

  toggleBookmarkBar() {
    this.showBookmarkBar = !this.showBookmarkBar;
    this._savePrefs();
    if (this.bookmarkBar) this.bookmarkBar.classList.toggle("hidden", !this.showBookmarkBar);
  }

  async clearBrowsingData() {
    if (!(await customConfirm("Delete all history, downloads records, and bookmarks?"))) return;
    this.history = [];
    this.downloads = [];
    this.bookmarks = this.defaultBookmarks;
    localStorage.removeItem("browser_history");
    localStorage.removeItem("browser_downloads");
    localStorage.removeItem("browser_bookmarks");
    this.renderBookmarks();
    this.updateStarButton(this.getActiveTab()?.url || "");
  }

  openDownloadsPanel() {
    this._closePanel();
    const panel = this._createPanel("Downloads", () => this._renderDownloadsBody());
    const footer = panel.querySelector(".panel-footer");
    if (this.downloads.length > 0) {
      const clearBtn = document.createElement("button");
      clearBtn.className = "panel-action-btn danger";
      clearBtn.textContent = "Clear All";
      clearBtn.addEventListener("click", () => {
        this.downloads = [];
        this._saveDownloads();
        this._closePanel();
        this.openDownloadsPanel();
      });
      footer.appendChild(clearBtn);
    }
  }

  _renderDownloadsBody() {
    if (this.downloads.length === 0) return `<div class="panel-empty">No downloads yet</div>`;
    return [...this.downloads]
      .reverse()
      .map(
        (d) => `
      <div class="panel-item">
        <span class="panel-item-icon">${d.status === "done" ? "📄" : d.status === "failed" ? "⚠️" : "⬇"}</span>
        <div class="panel-item-content">
          <div class="panel-item-title">${d.filename || "Unknown"}</div>
          <div class="panel-item-sub">${d.url || ""}</div>
        </div>
        <span class="panel-item-action" title="Open URL" data-url="${d.url}">↗</span>
      </div>
    `
      )
      .join("");
  }

  openHistoryPanel() {
    this._closePanel();
    const panel = this._createPanel("History", (searchVal) => this._renderHistoryBody(searchVal), true);
    const footer = panel.querySelector(".panel-footer");
    if (this.history.length > 0) {
      const clearBtn = document.createElement("button");
      clearBtn.className = "panel-action-btn danger";
      clearBtn.textContent = "Clear History";
      clearBtn.addEventListener("click", () => {
        this.history = [];
        this._saveHistory();
        this._closePanel();
        this.openHistoryPanel();
      });
      footer.appendChild(clearBtn);
    }
  }

  _renderHistoryBody(filter) {
    let items = [...this.history].reverse();
    if (filter) {
      const q = filter.toLowerCase();
      items = items.filter((h) => h.url.toLowerCase().includes(q) || (h.title || "").toLowerCase().includes(q));
    }
    if (items.length === 0) return `<div class="panel-empty">No history${filter ? " matching search" : ""}</div>`;
    const groups = {};
    items.forEach((h) => {
      const d = new Date(h.time);
      const key = d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
      if (!groups[key]) groups[key] = [];
      groups[key].push(h);
    });
    return Object.entries(groups)
      .map(
        ([date, entries]) => `
      <div class="panel-section-label">${date}</div>
      ${entries
        .map(
          (h) => `
        <div class="panel-item" data-url="${h.url}">
          <span class="panel-item-icon">🕐</span>
          <div class="panel-item-content">
            <div class="panel-item-title">${h.title || h.url}</div>
            <div class="panel-item-sub">${h.url}</div>
          </div>
          <button class="panel-item-action" title="Open" data-url="${h.url}">↗</button>
        </div>
      `
        )
        .join("")}
    `
      )
      .join("");
  }

  openBookmarksPanel() {
    this._closePanel();
    this._createPanel("Bookmarks", (searchVal) => this._renderBookmarksBody(searchVal), true);
  }

  _renderBookmarksBody(filter) {
    let items = this.bookmarks;
    if (filter) {
      const q = filter.toLowerCase();
      items = items.filter((b) => b.name.toLowerCase().includes(q) || b.url.toLowerCase().includes(q));
    }
    if (items.length === 0)
      return `<div class="panel-empty">No bookmarks${filter ? " matching search" : ""}.<br>Click ☆ in the address bar to save one.</div>`;
    return items
      .map(
        (b, i) => `
      <div class="panel-item" data-url="${b.url}">
        <span class="panel-item-icon">★</span>
        <div class="panel-item-content">
          <div class="panel-item-title">${b.name}</div>
          <div class="panel-item-sub">${b.url}</div>
        </div>
        <button class="panel-item-action" title="Remove" data-remove="${i}">✕</button>
      </div>
    `
      )
      .join("");
  }

  _createPanel(title, bodyRenderer, hasSearch = false) {
    const root = document.getElementById(`browser-root-${this.winId}`);
    const panel = document.createElement("div");
    panel.className = "browser-panel";
    panel.id = `browser-panel-${this.winId}`;

    panel.innerHTML = `
      <div class="browser-panel-header">
        <span class="browser-panel-title">${title}</span>
        <button class="browser-panel-close">✕</button>
      </div>
      ${hasSearch ? `<input class="panel-search" placeholder="Search ${title.toLowerCase()}..." />` : ""}
      <div class="browser-panel-body"></div>
      <div class="panel-footer"></div>
    `;

    const body = panel.querySelector(".browser-panel-body");
    const renderBody = (filter) => {
      body.innerHTML = bodyRenderer(filter);
      body.querySelectorAll("[data-url]").forEach((el) => {
        el.addEventListener("click", (e) => {
          if (e.target.dataset.remove !== undefined) return;
          if (e.target.dataset.url) {
            this.navigate(e.target.dataset.url);
            this._closePanel();
            return;
          }
          if (el.dataset.url) {
            this.navigate(el.dataset.url);
            this._closePanel();
          }
        });
      });
      body.querySelectorAll("[data-remove]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const idx = parseInt(btn.dataset.remove);
          if (title === "Bookmarks") {
            this.bookmarks.splice(idx, 1);
            this._saveBookmarks();
            this.renderBookmarks();
          }
          const searchInput = panel.querySelector(".panel-search");
          renderBody(searchInput ? searchInput.value : "");
        });
      });
    };

    renderBody("");

    if (hasSearch) {
      const searchInput = panel.querySelector(".panel-search");
      searchInput.addEventListener("input", () => renderBody(searchInput.value));
    }

    panel.querySelector(".browser-panel-close").addEventListener("click", () => this._closePanel());

    const content = document.getElementById(`content-${this.winId}`);
    content.parentElement.style.position = "relative";
    root.style.position = "relative";
    root.appendChild(panel);
    return panel;
  }

  openTabContextMenu(tab, e) {
    this._closeDropdown();
    const menu = document.createElement("div");
    menu.className = "ctx-menu";
    menu.style.top = e.clientY + "px";
    menu.style.left = e.clientX + "px";

    const tabIdx = this.tabs.findIndex((t) => t.id === tab.id);
    const hasLeft = tabIdx > 0;
    const hasRight = tabIdx < this.tabs.length - 1;
    const hasOther = this.tabs.length > 1;

    menu.innerHTML = `
      <div class="ctx-menu-item" data-action="new-tab"><i class="fas fa-plus ci-icon" style="width:16px;margin-right:8px;opacity:0.6;"></i> New Tab</div>
      <div class="ctx-menu-item" data-action="reload"><i class="fas fa-sync-alt ci-icon" style="width:16px;margin-right:8px;opacity:0.6;"></i> Reload</div>
      <div class="ctx-menu-item" data-action="duplicate"><i class="fas fa-copy ci-icon" style="width:16px;margin-right:8px;opacity:0.6;"></i> Duplicate Tab</div>
      <div class="ctx-menu-sep"></div>
      <div class="ctx-menu-item" data-action="pin"><i class="fas fa-thumbtack ci-icon" style="width:16px;margin-right:8px;opacity:0.6;"></i> ${tab.pinned ? "Unpin Tab" : "Pin Tab"}</div>
      <div class="ctx-menu-sep"></div>
      ${hasOther ? `<div class="ctx-menu-item" data-action="close-other"><i class="fas fa-times ci-icon" style="width:16px;margin-right:8px;opacity:0.6;"></i> Close Other Tabs</div>` : ""}
      ${hasLeft ? `<div class="ctx-menu-item" data-action="close-left"><i class="fas fa-arrow-left ci-icon" style="width:16px;margin-right:8px;opacity:0.6;"></i> Close Tabs to the Left</div>` : ""}
      ${hasRight ? `<div class="ctx-menu-item" data-action="close-right"><i class="fas fa-arrow-right ci-icon" style="width:16px;margin-right:8px;opacity:0.6;"></i> Close Tabs to the Right</div>` : ""}
      <div class="ctx-menu-item" data-action="close-tab"><i class="fas fa-times-circle ci-icon" style="width:16px;margin-right:8px;opacity:0.6;"></i> Close Tab</div>
      <div class="ctx-menu-sep"></div>
      <div class="ctx-menu-item" data-action="reopen-closed"><i class="fas fa-undo ci-icon" style="width:16px;margin-right:8px;opacity:0.6;"></i> Reopen Closed Tab${this.closedTabs.length ? ` (${this.closedTabs.length})` : ""}</div>
    `;

    BrowserApp.refreshIcons(menu);

    menu.querySelectorAll(".ctx-menu-item").forEach((item) => {
      item.addEventListener("click", (ev) => {
        ev.stopPropagation();
        this._closeDropdown();
        const action = item.dataset.action;
        if (action === "new-tab") this.createTab(this.homepageUrl, true);
        else if (action === "reload") this.loadUrl(tab, tab.url);
        else if (action === "duplicate") this.createTab(tab.url, true);
        else if (action === "pin") {
          tab.pinned = !tab.pinned;
          this.renderTabs();
        } else if (action === "close-tab") this.closeTab(tab.id);
        else if (action === "close-other") this.closeOtherTabs(tab.id);
        else if (action === "close-left") this.closeTabsToLeft(tab.id);
        else if (action === "close-right") this.closeTabsToRight(tab.id);
        else if (action === "reopen-closed") this.reopenLastClosedTab();
      });
    });

    document.body.appendChild(menu);
    this._contextMenu = menu;

    const close = (ev) => {
      if (!menu.contains(ev.target)) {
        this._closeDropdown();
        document.removeEventListener("click", close);
      }
    };
    setTimeout(() => document.addEventListener("click", close), 0);
  }

  renderTabs() {
    if (!this.tabStrip) return;
    this.tabStrip.innerHTML = "";

    this.tabs.forEach((tab) => {
      const el = document.createElement("div");
      el.className = "browser-tab" + (tab.active ? " active" : "") + (tab.pinned ? " pinned" : "");
      el.setAttribute("draggable", "true");
      el.dataset.tabId = tab.id;

      const favicon = document.createElement("span");
      favicon.className = "tab-favicon-placeholder";
      if (tab.faviconUrl) {
        const img = document.createElement("img");
        img.className = "tab-favicon";
        img.src = tab.faviconUrl;
        img.onerror = () => {
          img.style.display = "none";
        };
        favicon.appendChild(img);
      } else {
        favicon.textContent = tab.url === "yuki://home" ? "🌸" : "🌐";
      }

      const titleEl = document.createElement("span");
      titleEl.className = "tab-title";
      titleEl.textContent = tab.title || "New Tab";

      if (tab.isPlayingAudio) {
        const audioIcon = document.createElement("span");
        audioIcon.className = "tab-audio-icon";
        audioIcon.textContent = "🔊";
        audioIcon.title = "Playing audio";
        el.appendChild(favicon);
        el.appendChild(titleEl);
        el.appendChild(audioIcon);
      } else {
        el.appendChild(favicon);
        el.appendChild(titleEl);
      }

      const closeBtn = document.createElement("span");
      closeBtn.className = "tab-close";
      closeBtn.textContent = "×";
      closeBtn.title = "Close tab";
      closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.closeTab(tab.id);
      });

      if (!tab.pinned) el.appendChild(closeBtn);

      el.addEventListener("click", () => this.switchTab(tab.id));
      el.addEventListener("auxclick", (e) => {
        if (e.button === 1) {
          e.preventDefault();
          e.stopPropagation();
          this.closeTab(tab.id);
        }
      });
      el.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        this.openTabContextMenu(tab, e);
      });
      el.addEventListener("dragstart", () => {
        this.dragSrcTabId = tab.id;
        el.style.opacity = "0.5";
      });
      el.addEventListener("dragend", () => {
        el.style.opacity = "";
        this.tabStrip.querySelectorAll(".browser-tab").forEach((t) => t.classList.remove("drag-over"));
      });
      el.addEventListener("dragover", (e) => {
        e.preventDefault();
        el.classList.add("drag-over");
      });
      el.addEventListener("dragleave", () => el.classList.remove("drag-over"));
      el.addEventListener("drop", (e) => {
        e.preventDefault();
        el.classList.remove("drag-over");
        if (this.dragSrcTabId === null || this.dragSrcTabId === tab.id) return;
        const srcIdx = this.tabs.findIndex((t) => t.id === this.dragSrcTabId);
        const dstIdx = this.tabs.findIndex((t) => t.id === tab.id);
        if (srcIdx === -1 || dstIdx === -1) return;
        const [moved] = this.tabs.splice(srcIdx, 1);
        this.tabs.splice(dstIdx, 0, moved);
        this.renderTabs();
      });

      this.tabStrip.appendChild(el);
    });

    const newBtn = document.createElement("div");
    newBtn.className = "tab-new-btn";
    newBtn.title = "New tab";
    newBtn.textContent = "+";
    newBtn.addEventListener("click", () => this.createTab(this.homepageUrl, true));
    this.tabStrip.appendChild(newBtn);
  }
}
