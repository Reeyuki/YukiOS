import { desktop } from "./desktop.js";

const PROXY_BASE = "https://api.codetabs.com/v1/proxy/?quest=";

async function loadViaProxy(iframe, url) {
  try {
    const proxyUrl = PROXY_BASE + encodeURIComponent(url);
    const response = await fetch(proxyUrl);
    const html = await response.text();

    // Inject a <base> tag so relative asset paths resolve against the real origin
    const base = new URL(url);
    const rewritten = html.replace(/(<head[^>]*>)/i, `$1<base href="${base.origin}/">`);

    const blob = new Blob([rewritten], { type: "text/html" });
    const blobUrl = URL.createObjectURL(blob);

    // Revoke previous blob URL to avoid memory leaks
    if (iframe._blobUrl) URL.revokeObjectURL(iframe._blobUrl);
    iframe._blobUrl = blobUrl;
    iframe.src = blobUrl;
  } catch (err) {
    console.error("Proxy load failed:", err);
    const errHtml = `<html><body style="font-family:sans-serif;padding:2rem;color:#333">
      <h2>⚠ Failed to load page</h2>
      <p><strong>Error:</strong> ${err.message}</p>
      <p><strong>URL:</strong> ${url}</p>
    </body></html>`;
    const blob = new Blob([errHtml], { type: "text/html" });
    if (iframe._blobUrl) URL.revokeObjectURL(iframe._blobUrl);
    iframe._blobUrl = URL.createObjectURL(blob);
    iframe.src = iframe._blobUrl;
  }
}

export class BrowserApp {
  constructor(windowManager) {
    this.wm = windowManager;
    this.windows = {};
    this.searchEngine = { name: "Google Search", url: "https://www.google.com/search?q=" };
  }

  open() {
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
        <span>Browser</span>
        <div class="window-controls">
          <button class="minimize-btn" title="Minimize">−</button>
          <button class="maximize-btn" title="Maximize">□</button>
          <button class="close-btn" title="Close">X</button>
        </div>
      </div>
      <div class="tab-bar">
        <div class="tabs-container"></div>
        <button class="new-tab-btn">+</button>
      </div>
      <nav class="browser-nav">
        <div>
          <button class="back-btn" disabled>←</button>
          <button class="forward-btn" disabled>→</button>
          <button class="reload-btn">⟳</button>
        </div>
        <input class="address-bar" type="url" enterkeyhint="go">
        <button class="settings-btn" title="Settings">⚙</button>
      </nav>
      <nav class="bookmark-bar">
        <button data-url="https://www.google.com/webhp?igu=1">Google</button>
        <button data-url="https://reeyuki.nekoweb.org">Reeyuki Site</button>
        <button data-url="https://liventcord.github.io">LiventCord</button>
        <button data-url="https://www.wikipedia.org">Wikipedia</button>
        <button data-url="https://www.mixconvert.com">Mix Convert</button>
        <button data-url="https://dustinbrett.com/Program%20Files/Browser/dino/index.html">T-Rex Dino</button>
        <button data-url="https://bluemaxima.org/flashpoint">Flashpoint Archive</button>
        <button data-url="https://jsfiddle.net">JS Fiddle</button>
        <button data-url="https://www.myinstants.com/en/categories/sound%20effects/us/">SoundBoard</button>
      </nav>
      <div class="iframe-container" style="position:relative;width:100%;height:calc(100% - 112px);"></div>

      <!-- Settings Panel -->
      <div class="browser-settings-panel" id="browser-settings-panel">
        <div class="browser-settings-header">
          <span>Settings</span>
          <button class="settings-close-btn" title="Close settings">✕</button>
        </div>
        <div class="browser-settings-body">
          <div class="settings-section">
            <label class="settings-label">Search Engine</label>
            <div class="settings-current-engine" id="settings-current-engine">Google Search</div>
            <div class="select-options show">
              <div class="select-option" data-name="Brave Search" data-url="https://search.brave.com/search?q=">
                <img class="engine-icon" src="https://search.brave.com/favicon.ico" onerror="this.style.display='none'">
                Brave Search
              </div>
              <div class="select-option" data-name="DuckDuckGo" data-url="https://duckduckgo.com/?q=">
                <img class="engine-icon" src="https://duckduckgo.com/favicon.ico" onerror="this.style.display='none'">
                DuckDuckGo
              </div>
              <div class="select-option active-engine" data-name="Google Search" data-url="https://www.google.com/search?q=">
                <img class="engine-icon" src="https://www.google.com/favicon.ico" onerror="this.style.display='none'">
                Google Search
              </div>
              <div class="select-option" data-name="Bing" data-url="https://www.bing.com/search?q=">
                <img class="engine-icon" src="https://www.bing.com/favicon.ico" onerror="this.style.display='none'">
                Bing
              </div>
              <div class="select-option" data-name="Startpage" data-url="https://www.startpage.com/search?q=">
                <img class="engine-icon" src="https://www.startpage.com/favicon.ico" onerror="this.style.display='none'">
                Startpage
              </div>
              <div class="select-option" data-name="Qwant" data-url="https://www.qwant.com/?q=">
                <img class="engine-icon" src="https://www.qwant.com/favicon.ico" onerror="this.style.display='none'">
                Qwant
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    desktop.appendChild(win);
    this.wm.makeDraggable(win);
    this.wm.makeResizable(win);
    this.wm.setupWindowControls(win);
    this.wm.addToTaskbar(win.id, "Browser", "/static/icons/firefox.webp");
    this.wm.bringToFront(win);
    this.wm.registerCloseWindow(win.querySelector(".close-btn"), win.id);

    win.style.width = "70vw";
    win.style.height = "70vh";
    win.style.left = "15vw";
    win.style.top = "15vh";

    this.tabsContainer = win.querySelector(".tabs-container");
    this.newTabBtn = win.querySelector(".new-tab-btn");
    this.addressInput = win.querySelector(".address-bar");
    this.backBtn = win.querySelector(".back-btn");
    this.forwardBtn = win.querySelector(".forward-btn");
    this.reloadBtn = win.querySelector(".reload-btn");
    this.iframeContainer = win.querySelector(".iframe-container");
    this.settingsPanel = win.querySelector("#browser-settings-panel");
    this.settingsBtn = win.querySelector(".settings-btn");

    this.tabs = [];
    this.currentTabIndex = -1;

    this.newTabBtn.onclick = () => this.addTab();

    this.addressInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && this.currentTabIndex >= 0) {
        const raw = this.addressInput.value.trim();
        const url = this.resolveInput(raw);
        this.navigate(this.tabs[this.currentTabIndex], url);
      }
    });

    this.settingsBtn.onclick = () => {
      this.settingsPanel.classList.toggle("open");
    };

    win.querySelector(".settings-close-btn").onclick = () => {
      this.settingsPanel.classList.remove("open");
    };

    win.querySelectorAll(".select-option").forEach((opt) => {
      opt.addEventListener("click", () => {
        this.searchEngine = { name: opt.dataset.name, url: opt.dataset.url };
        win.querySelectorAll(".select-option").forEach((o) => o.classList.remove("active-engine"));
        opt.classList.add("active-engine");
        win.querySelector("#settings-current-engine").textContent = opt.dataset.name;
      });
    });

    win.querySelectorAll(".bookmark-bar button").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (this.currentTabIndex >= 0) {
          this.navigate(this.tabs[this.currentTabIndex], btn.dataset.url);
        }
      });
    });

    this.backBtn.onclick = () => this.goBack();
    this.forwardBtn.onclick = () => this.goForward();
    this.reloadBtn.onclick = () => {
      const tab = this.tabs[this.currentTabIndex];
      if (tab) loadViaProxy(tab.iframe, tab.url);
    };

    this.addTab("https://www.google.com/webhp?igu=1");
  }

  resolveInput(raw) {
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw)) return raw;
    if (/^[\w-]+\.[\w.-]+(\/.*)?$/.test(raw)) return "https://" + raw;
    return this.searchEngine.url + encodeURIComponent(raw);
  }

  addTab(url) {
    if (!url) {
      try {
        const { origin } = new URL(this.searchEngine.url);
        url = origin + "/";
      } catch {
        url = "https://www.google.com/webhp?igu=1";
      }
    }
    const tabIndex = this.tabs.length;

    const iframe = document.createElement("iframe");
    iframe.className = "browser-frame";
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "none";
    iframe.style.position = "absolute";
    iframe.style.top = "0";
    iframe.style.left = "0";
    iframe.style.display = "none";
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

    const tabBtn = document.createElement("div");
    tabBtn.className = "tab-btn";

    const faviconImg = document.createElement("img");
    faviconImg.className = "tab-favicon";
    faviconImg.src = this.getFavicon(url);
    faviconImg.onerror = () => (faviconImg.src = "/static/icons/default-favicon.png");

    tabBtn.innerHTML = `
    <span class="tab-title">${tab.title}</span>
    <button class="tab-close-btn" title="Close tab">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12"><line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" stroke-width="2"/><line x1="11" y1="1" x2="1" y2="11" stroke="currentColor" stroke-width="2"/></svg>
    </button>
  `;
    tabBtn.prepend(faviconImg);

    if (this.newTabBtn && this.newTabBtn.parentNode === this.tabsContainer) {
      this.tabsContainer.insertBefore(tabBtn, this.newTabBtn);
    } else {
      this.tabsContainer.appendChild(tabBtn);
    }

    tabBtn.querySelector(".tab-close-btn").onclick = (e) => {
      e.stopPropagation();
      this.closeTab(tabIndex);
    };
    tabBtn.onclick = () => this.switchTab(tabIndex);

    iframe.onload = () => {
      let title = iframe.contentDocument?.title || tab.url;
      if (!title || title.trim() === "") title = tab.url;
      tab.title = title;
      tabBtn.querySelector(".tab-title").textContent = title;
      faviconImg.src = this.getFavicon(tab.url);
    };

    // Fetch through proxy and render as blob
    loadViaProxy(iframe, url);

    this.switchTab(tabIndex);
  }

  getFavicon(url) {
    try {
      const { hostname } = new URL(url);
      return `https://${hostname}/favicon.ico`;
    } catch {
      return "/static/icons/default-favicon.png";
    }
  }

  switchTab(index) {
    if (index < 0 || index >= this.tabs.length) return;
    this.currentTabIndex = index;

    this.tabs.forEach((tab, i) => {
      tab.iframe.style.display = i === index ? "block" : "none";
      this.tabsContainer.children[i].classList.toggle("active-tab", i === index);
    });

    const tab = this.tabs[index];
    this.addressInput.value = tab.url;
    this.backBtn.disabled = tab.historyIndex <= 0;
    this.forwardBtn.disabled = tab.historyIndex >= tab.history.length - 1;
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

    try {
      const parsed = new URL(url);
      if (parsed.hostname.includes("google.com") && !parsed.search) {
        url = "https://www.google.com/webhp?igu=1";
      }
    } catch (e) {
      console.error(e);
    }

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

  goBack() {
    const tab = this.tabs[this.currentTabIndex];
    if (!tab || tab.historyIndex <= 0) return;
    tab.historyIndex--;
    tab.url = tab.history[tab.historyIndex];
    this.addressInput.value = tab.url;
    this.updateNavigation(tab);
    loadViaProxy(tab.iframe, tab.url);
  }

  goForward() {
    const tab = this.tabs[this.currentTabIndex];
    if (!tab || tab.historyIndex >= tab.history.length - 1) return;
    tab.historyIndex++;
    tab.url = tab.history[tab.historyIndex];
    this.addressInput.value = tab.url;
    this.updateNavigation(tab);
    loadViaProxy(tab.iframe, tab.url);
  }

  updateNavigation(tab) {
    this.backBtn.disabled = tab.historyIndex <= 0;
    this.forwardBtn.disabled = tab.historyIndex >= tab.history.length - 1;
  }
}
