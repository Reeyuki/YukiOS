export class BrowserApp {
  constructor(windowManager) {
    this.wm = windowManager;
    this.history = [];
    this.historyIndex = -1;
    this.currentURL = "https://www.google.com/webhp?igu=1";
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
      <nav class="browser-nav">
        <div>
          <button id="back-btn" disabled aria-label="Click to go back" title="Click to go back">
            ←
          </button>
          <button id="forward-btn" disabled aria-label="Click to go forward" title="Click to go forward">
            →
          </button>
          <button id="reload-btn" aria-label="Reload this page" title="Reload this page">
            ⟳
          </button>
        </div>
        <input id="address-bar" type="url" value="${this.currentURL}" aria-label="Address" enterkeyhint="go">
      </nav>
      <nav class="bookmark-bar">
      <button data-url="https://www.google.com/webhp?igu=1">Google</button>
      <button data-url="https://reeyuki.github.io">Reeyuki Site</button>
      <button data-url="https://liventcord.github.io">LiventCord</button>
      <button data-url="https://www.wikipedia.org">Wikipedia</button>
      <button data-url="https://archive.org">Internet Archive</button>
      <button data-url="https://dustinbrett.com/Program%20Files/Browser/dino/index.html">T-Rex Dino</button>
      <button onclick="window.open('https://dn721809.ca.archive.org/0/items/youtube-xvFZjo5PgG0/xvFZjo5PgG0.mp4','_blank')">Click me</button>
      <a href="https://emupedia.net/beta/emuos/">EmuOS</a>

      </nav>
      <iframe id="browser-frame" src="${this.currentURL}" style="width:100%;height:calc(100% - 88px);border:none"></iframe>
    `;

    desktop.appendChild(win);
    this.wm.makeDraggable(win);
    this.wm.makeResizable(win);
    this.wm.setupWindowControls(win);
    this.wm.addToTaskbar(win.id, "Browser", "/static/icons/chromium.webp");

    win.querySelector(".close-btn").onclick = () => win.remove();

    this.frame = win.querySelector("#browser-frame");
    this.addressInput = win.querySelector("#address-bar");
    this.backBtn = win.querySelector("#back-btn");
    this.forwardBtn = win.querySelector("#forward-btn");
    this.reloadBtn = win.querySelector("#reload-btn");
    win.style.width = "70vw";
    win.style.height = "70vh";
    win.style.left = "15vw";
    win.style.top = "15vh";

    this.setupControls(win);
  }

  setupControls(win) {
    this.backBtn.onclick = () => this.goBack();
    this.forwardBtn.onclick = () => this.goForward();
    this.reloadBtn.onclick = () => (this.frame.src = this.currentURL);

    this.addressInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        this.navigate(this.addressInput.value);
      }
    });

    win.querySelectorAll(".bookmark-bar button").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.navigate(btn.dataset.url);
      });
    });
  }

  navigate(url) {
    if (!url) {
      console.error("No url found");
      return;
    }
    if (!url.startsWith("http") && !url.startsWith("chrome")) url = "https://" + url;
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }
    this.history.push(url);
    this.historyIndex++;
    this.updateNavigation();
  }

  goBack() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.updateNavigation();
    }
  }

  goForward() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.updateNavigation();
    }
  }

  updateNavigation() {
    this.currentURL = this.history[this.historyIndex];
    this.frame.src = this.currentURL;
    this.addressInput.value = this.currentURL;
    this.backBtn.disabled = this.historyIndex <= 0;
    this.forwardBtn.disabled = this.historyIndex >= this.history.length - 1;
  }
}
