import { desktop } from "./desktop.js";

export class BrowserApp {
  constructor(windowManager) {
    this.wm = windowManager;
    this.windows = {};
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
      </nav>
      <div class="iframe-container" style="position:relative;width:100%;height:calc(100% - 112px);"></div>
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

    this.tabs = [];
    this.currentTabIndex = -1;

    this.newTabBtn.onclick = () => this.addTab();
    this.addressInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && this.currentTabIndex >= 0) {
        this.navigate(this.tabs[this.currentTabIndex], this.addressInput.value);
      }
    });

    win.querySelectorAll(".bookmark-bar button").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (this.currentTabIndex >= 0) {
          this.navigate(this.tabs[this.currentTabIndex], btn.dataset.url);
        }
      });
    });

    this.addTab("https://www.google.com/webhp?igu=1");
  }

  addTab(url = "https://www.google.com/webhp?igu=1") {
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
    iframe.src = url;
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
      if (parsed.hostname.includes("google.com")) url = "https://www.google.com/webhp?igu=1";
    } catch {}

    if (tab.historyIndex < tab.history.length - 1) {
      tab.history = tab.history.slice(0, tab.historyIndex + 1);
    }
    tab.history.push(url);
    tab.historyIndex++;
    tab.url = url;
    tab.iframe.src = url;
    this.updateNavigation(tab);
  }

  goBack() {
    const tab = this.tabs[this.currentTabIndex];
    if (!tab || tab.historyIndex <= 0) return;
    tab.historyIndex--;
    tab.url = tab.history[tab.historyIndex];
    tab.iframe.src = tab.url;
    this.updateNavigation(tab);
  }

  goForward() {
    const tab = this.tabs[this.currentTabIndex];
    if (!tab || tab.historyIndex >= tab.history.length - 1) return;
    tab.historyIndex++;
    tab.url = tab.history[tab.historyIndex];
    tab.iframe.src = tab.url;
    this.updateNavigation(tab);
  }

  updateNavigation(tab) {
    this.backBtn.disabled = tab.historyIndex <= 0;
    this.forwardBtn.disabled = tab.historyIndex >= tab.history.length - 1;
  }
}
