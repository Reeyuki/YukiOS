import { desktop } from "./desktop.js";
import { speak } from "./clippy.js";

const PROXY_BASE = "https://api.codetabs.com/v1/proxy/?quest=";
const DIRECT_IFRAME_PATTERNS = [/google.com/, /wikipedia.org/];

function shouldLoadDirect(url) {
  return DIRECT_IFRAME_PATTERNS.some((p) => p.test(url));
}

function injectGoogleIgu(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("google.com")) {
      parsed.searchParams.set("igu", "1");
      return parsed.toString();
    }
  } catch {}
  return url;
}

async function loadViaProxy(iframe, url) {
  if (shouldLoadDirect(url)) {
    if (iframe._blobUrl) {
      URL.revokeObjectURL(iframe._blobUrl);
      iframe._blobUrl = null;
    }
    iframe.src = url;
    return;
  }

  try {
    const proxyUrl = PROXY_BASE + encodeURIComponent(url);
    const response = await fetch(proxyUrl);
    const html = await response.text();

    const base = new URL(url);
    const rewritten = html.replace(/(<head[^>]*>)/i, `$1<base href="${base.origin}/">`);

    const blob = new Blob([rewritten], { type: "text/html" });
    const blobUrl = URL.createObjectURL(blob);

    if (iframe._blobUrl) URL.revokeObjectURL(iframe._blobUrl);
    iframe._blobUrl = blobUrl;
    iframe.src = blobUrl;
  } catch (err) {
    console.error("Proxy load failed:", err);
    speak("That page didn't load. Try a search instead?", "Alert");

    const errHtml = `<html><body class="browser-error-container">
      <h2>⚠ Failed to load page</h2>
      <div class="browser-error-details">
        <p><strong>Error:</strong> ${err.message}</p>
        <p><strong>URL:</strong> ${url}</p>
      </div>
      </body></html>`;

    const blob = new Blob([errHtml], { type: "text/html" });
    if (iframe._blobUrl) URL.revokeObjectURL(iframe._blobUrl);
    iframe._blobUrl = URL.createObjectURL(blob);
    iframe.src = iframe._blobUrl;
  }
}

const CLOSE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12"><line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" stroke-width="2"/><line x1="11" y1="1" x2="1" y2="11" stroke="currentColor" stroke-width="2"/></svg>`;

export class BrowserApp {
  constructor(windowManager, fs) {
    this.wm = windowManager;
    this.fs = fs;
    this.windows = {};
  }

  open(skipDefaultTab = false) {
    if (document.getElementById("browser-win")) {
      this.wm.bringToFront(document.getElementById("browser-win"));
      return;
    }

    const win = document.createElement("div");
    win.className = "window";
    win.id = "browser-win";
    win.dataset.fullscreen = "false";

    win.innerHTML = `
      <div class="window-header">
        <span>Firefox</span>
        ${this.wm.getWindowControls()}
      </div>
      <div class="tab-bar">
        <div class="tabs-container"></div>
        <button class="new-tab-btn" title="Open new tab">+</button>
      </div>
      <nav class="browser-nav">
        <div>
          <button class="back-btn" disabled title="Go back">&#8592;</button>
          <button class="forward-btn" disabled title="Go forward">&#8594;</button>
          <button class="reload-btn" title="Reload">&#8635;</button>
        </div>
        <input class="address-bar" type="url" placeholder="Search or enter address" enterkeyhint="go">
      </nav>
      <nav class="bookmark-bar"></nav>
      <div class="iframe-container"></div>
    `;

    desktop.appendChild(win);
    this.wm.makeDraggable(win);
    this.wm.makeResizable(win);
    this.wm.setupWindowControls(win);
    this.wm.addToTaskbar(win.id, "Firefox", "/static/icons/firefox.webp");
    this.wm.bringToFront(win);
    this.wm.registerCloseWindow(win.querySelector(".close-btn"), win.id);

    this.tabsContainer = win.querySelector(".tabs-container");
    this.newTabBtn = win.querySelector(".new-tab-btn");
    this.addressInput = win.querySelector(".address-bar");
    this.backBtn = win.querySelector(".back-btn");
    this.forwardBtn = win.querySelector(".forward-btn");
    this.reloadBtn = win.querySelector(".reload-btn");
    this.iframeContainer = win.querySelector(".iframe-container");
    this.bookmarkBar = win.querySelector(".bookmark-bar");

    this.tabs = [];
    this.currentTabIndex = -1;

    // Create bookmarks with favicons
    this.createBookmarks();

    this.newTabBtn.onclick = () => {
      speak("Where are we headed today?", "CheckingSomething");
      this.addTab("https://www.google.com/webhp?igu=1");
    };

    this.addressInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && this.currentTabIndex >= 0) {
        const raw = this.addressInput.value.trim();
        this.navigateFromInput(this.tabs[this.currentTabIndex], raw);
      }
    });

    this.backBtn.onclick = () => this.goBack();
    this.forwardBtn.onclick = () => this.goForward();
    this.reloadBtn.onclick = () => {
      const tab = this.tabs[this.currentTabIndex];
      if (tab) loadViaProxy(tab.iframe, tab.url);
    };

    if (!skipDefaultTab) {
      this.addTab("https://www.google.com/webhp?igu=1");
    }
  }

  createBookmarks() {
    const bookmarks = [
      { name: "Google", url: "https://www.google.com/webhp?igu=1" },
      { name: "Reeyuki Site", url: "https://reeyuki.nekoweb.org" },
      { name: "LiventCord", url: "https://liventcord.github.io" },
      { name: "Wikipedia", url: "https://www.wikipedia.org" },
      { name: "File Converter", url: "https://yukiconvert.netlify.app/file-converter" },
      { name: "JS Fiddle", url: "https://jsfiddle.net" },
      { name: "SoundBoard", url: "https://www.myinstants.com/en/categories/sound%20effects/us/" }
    ];

    bookmarks.forEach((bookmark) => {
      const btn = document.createElement("button");
      btn.dataset.url = bookmark.url;

      const favicon = document.createElement("img");
      favicon.className = "bookmark-favicon";
      favicon.src = this.getFavicon(bookmark.url);
      favicon.onerror = () => {
        favicon.src = "/static/icons/firefox.webp";
      };

      const text = document.createElement("span");
      text.textContent = bookmark.name;

      btn.appendChild(favicon);
      btn.appendChild(text);

      btn.addEventListener("click", () => {
        if (this.currentTabIndex >= 0) {
          const bookmarkUrl = btn.dataset.url;
          if (bookmarkUrl !== "https://reeyuki.nekoweb.org") {
            speak("Good choice! I know this one.", "Congratulate");
          }
          this.navigate(this.tabs[this.currentTabIndex], bookmarkUrl);
        }
      });

      this.bookmarkBar.appendChild(btn);
    });
  }

  openHtml(htmlContent, name, path) {
    const existing = document.getElementById("browser-win");
    if (!existing) {
      this.open(true);
    } else {
      this.wm.bringToFront(existing);
    }

    const pathSegments = Array.isArray(path) ? path : path ? path.split("/").filter(Boolean) : [];
    const fullPath = this.fs.CONFIG.ROOT + [...pathSegments, name].join("/");

    const blob = new Blob([htmlContent], { type: "text/html" });
    const blobUrl = URL.createObjectURL(blob);

    const tabIndex = this.tabs.length;
    const iframe = document.createElement("iframe");
    iframe.className = "browser-frame";
    this.iframeContainer.appendChild(iframe);

    iframe._blobUrl = blobUrl;

    const tab = {
      url: fullPath,
      history: [fullPath],
      historyIndex: 0,
      title: name,
      iframe,
      favicon: "/static/icons/firefox.webp"
    };
    this.tabs.push(tab);

    const tabBtn = this._createTabElement(name, "/static/icons/files.webp", tabIndex);
    this.tabsContainer.appendChild(tabBtn);

    iframe.onload = () => {
      const title = iframe.contentDocument?.title || name;
      tab.title = title || name;
      tabBtn.querySelector(".tab-title").textContent = tab.title;
    };

    iframe.src = blobUrl;
    this.switchTab(tabIndex);
  }

  _createTabElement(title, faviconSrc, tabIndex) {
    const tabBtn = document.createElement("div");
    tabBtn.className = "tab-btn";

    const faviconImg = document.createElement("img");
    faviconImg.className = "tab-favicon";
    faviconImg.src = faviconSrc || "/static/icons/firefox.webp";
    faviconImg.onerror = () => (faviconImg.src = "/static/icons/firefox.webp");

    const titleSpan = document.createElement("span");
    titleSpan.className = "tab-title";
    titleSpan.textContent = title;

    const closeBtn = document.createElement("button");
    closeBtn.className = "tab-close-btn";
    closeBtn.title = "Close tab";
    closeBtn.innerHTML = CLOSE_ICON;
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      this.closeTab(this.tabs.indexOf(this.tabs[tabIndex]));
    };

    tabBtn.appendChild(faviconImg);
    tabBtn.appendChild(titleSpan);
    tabBtn.appendChild(closeBtn);
    tabBtn.onclick = () => this.switchTab(this.tabs.length);

    return tabBtn;
  }

  _isLocalTab(tab) {
    return tab && tab.url && tab.url.startsWith(this.fs.CONFIG.ROOT);
  }

  _resolveLocalPath(raw, currentTabUrl) {
    if (raw.startsWith("/")) return raw;
    if (raw.startsWith("~/")) return this.fs.CONFIG.ROOT + raw.slice(2);
    const base =
      currentTabUrl && currentTabUrl.startsWith(this.fs.CONFIG.ROOT)
        ? currentTabUrl.substring(0, currentTabUrl.lastIndexOf("/") + 1)
        : this.fs.CONFIG.ROOT;
    return base + raw;
  }

  async _tryLoadFromFs(fsPath) {
    if (!this.fs) return null;
    try {
      const parts = fsPath.replace(/^\/home\/reeyuki\//, "").split("/");
      const name = parts.pop();
      const content = await this.fs.getFileContent(parts, name);
      if (content === "" || content === null || content === undefined) return null;
      return { content, name, fsPath };
    } catch {
      return null;
    }
  }

  async navigateFromInput(tab, raw) {
    if (!raw) return;

    const looksLikeFsPath =
      raw.startsWith(this.fs.CONFIG.ROOT) ||
      raw.startsWith("~/") ||
      (this._isLocalTab(tab) && !raw.startsWith("http") && !/^[\w-]+\.[\w.-]+(\/.*)?$/.test(raw));

    if (looksLikeFsPath) {
      const fsPath = this._resolveLocalPath(raw, tab.url);
      const result = await this._tryLoadFromFs(fsPath);
      if (result) {
        this._navigateToLocalHtml(tab, result.content, result.name, fsPath);
        return;
      }
    }

    const url = this.resolveInput(raw);
    this.navigate(tab, url);
  }

  _navigateToLocalHtml(tab, htmlContent, name, fsPath) {
    const blob = new Blob([htmlContent], { type: "text/html" });
    const blobUrl = URL.createObjectURL(blob);

    if (tab.iframe._blobUrl) URL.revokeObjectURL(tab.iframe._blobUrl);
    tab.iframe._blobUrl = blobUrl;
    tab.iframe.src = blobUrl;

    if (tab.historyIndex < tab.history.length - 1) {
      tab.history = tab.history.slice(0, tab.historyIndex + 1);
    }
    tab.history.push(fsPath);
    tab.historyIndex++;
    tab.url = fsPath;
    tab.title = name;
    this.addressInput.value = fsPath;
    this.updateNavigation(tab);

    const tabBtn = this.tabsContainer.children[this.currentTabIndex];
    if (tabBtn) tabBtn.querySelector(".tab-title").textContent = name;
  }

  resolveInput(raw) {
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw)) return injectGoogleIgu(raw);
    if (/^[\w-]+\.[\w.-]+(\/.*)?$/.test(raw)) return injectGoogleIgu("https://" + raw);
    return "https://www.google.com/search?q=" + encodeURIComponent(raw) + "&igu=1";
  }

  _checkDomainClippy(url) {
    try {
      const hostname = new URL(url).hostname;
      if (hostname.includes("reeyuki")) {
        speak("Aw, you're so sweet!", "Congratulate");
      } else if (hostname.includes("google.com")) {
        speak("Need help finding something?", "Searching");
      }
    } catch {}
  }

  addTab(url) {
    if (!url) url = "https://www.google.com/webhp?igu=1";
    url = injectGoogleIgu(url);
    const tabIndex = this.tabs.length;

    const iframe = document.createElement("iframe");
    iframe.className = "browser-frame";
    this.iframeContainer.appendChild(iframe);

    const tab = {
      url,
      history: [url],
      historyIndex: 0,
      title: "New Tab",
      iframe,
      favicon: ""
    };
    this.tabs.push(tab);

    const faviconSrc = this.getFavicon(url);
    const tabBtn = document.createElement("div");
    tabBtn.className = "tab-btn";

    const faviconImg = document.createElement("img");
    faviconImg.className = "tab-favicon";
    faviconImg.src = faviconSrc;
    faviconImg.onerror = () => (faviconImg.src = "/static/icons/firefox.webp");

    const titleSpan = document.createElement("span");
    titleSpan.className = "tab-title";
    titleSpan.textContent = tab.title;

    const closeBtn = document.createElement("button");
    closeBtn.className = "tab-close-btn";
    closeBtn.title = "Close tab";
    closeBtn.innerHTML = CLOSE_ICON;
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      this.closeTab(tabIndex);
    };

    tabBtn.appendChild(faviconImg);
    tabBtn.appendChild(titleSpan);
    tabBtn.appendChild(closeBtn);
    tabBtn.onclick = () => this.switchTab(tabIndex);

    this.tabsContainer.appendChild(tabBtn);

    iframe.onload = () => {
      let title = iframe.contentDocument?.title || tab.url;
      if (!title || title.trim() === "") title = tab.url;
      tab.title = title;
      titleSpan.textContent = title;
      faviconImg.src = this.getFavicon(tab.url);
    };

    loadViaProxy(iframe, url);
    this.switchTab(tabIndex);
  }

  getFavicon(url) {
    try {
      const { hostname } = new URL(url);
      return `https://${hostname}/favicon.ico`;
    } catch {
      return "/static/icons/firefox.webp";
    }
  }

  switchTab(index) {
    if (index < 0 || index >= this.tabs.length) return;
    this.currentTabIndex = index;

    this.tabs.forEach((tab, i) => {
      tab.iframe.classList.toggle("active", i === index);
      this.tabsContainer.children[i].classList.toggle("active-tab", i === index);
    });

    const tab = this.tabs[index];
    this.addressInput.value = tab.url;
    this.updateNavigation(tab);
  }

  closeTab(index) {
    if (index < 0 || index >= this.tabs.length) return;
    const tab = this.tabs[index];
    if (tab.iframe._blobUrl) URL.revokeObjectURL(tab.iframe._blobUrl);
    tab.iframe.remove();
    this.tabs.splice(index, 1);
    this.tabsContainer.children[index].remove();

    if (this.currentTabIndex === index) {
      this.switchTab(Math.max(0, index - 1));
    } else if (this.currentTabIndex > index) {
      this.currentTabIndex--;
    }
  }

  navigate(tab, url) {
    if (!url) return;
    if (!url.startsWith("http")) url = "https://" + url;
    url = injectGoogleIgu(url);

    this._checkDomainClippy(url);

    if (tab.historyIndex < tab.history.length - 1) {
      tab.history = tab.history.slice(0, tab.historyIndex + 1);
    }
    tab.history.push(url);
    tab.historyIndex++;
    tab.url = url;
    this.addressInput.value = url;
    this.updateNavigation(tab);
    loadViaProxy(tab.iframe, url);
  }

  async goBack() {
    const tab = this.tabs[this.currentTabIndex];
    if (!tab || tab.historyIndex <= 0) return;
    tab.historyIndex--;
    tab.url = tab.history[tab.historyIndex];
    this.addressInput.value = tab.url;
    this.updateNavigation(tab);
    if (tab.url.startsWith(this.fs.CONFIG.ROOT)) {
      const result = await this._tryLoadFromFs(tab.url);
      if (result) {
        this._loadBlobIntoIframe(tab, result.content);
        return;
      }
    }
    loadViaProxy(tab.iframe, tab.url);
  }

  async goForward() {
    const tab = this.tabs[this.currentTabIndex];
    if (!tab || tab.historyIndex >= tab.history.length - 1) return;
    tab.historyIndex++;
    tab.url = tab.history[tab.historyIndex];
    this.addressInput.value = tab.url;
    this.updateNavigation(tab);
    if (tab.url.startsWith(this.fs.CONFIG.ROOT)) {
      const result = await this._tryLoadFromFs(tab.url);
      if (result) {
        this._loadBlobIntoIframe(tab, result.content);
        return;
      }
    }
    loadViaProxy(tab.iframe, tab.url);
  }

  _loadBlobIntoIframe(tab, htmlContent) {
    const blob = new Blob([htmlContent], { type: "text/html" });
    const blobUrl = URL.createObjectURL(blob);
    if (tab.iframe._blobUrl) URL.revokeObjectURL(tab.iframe._blobUrl);
    tab.iframe._blobUrl = blobUrl;
    tab.iframe.src = blobUrl;
  }

  updateNavigation(tab) {
    this.backBtn.disabled = tab.historyIndex <= 0;
    this.forwardBtn.disabled = tab.historyIndex >= tab.history.length - 1;
  }
}
