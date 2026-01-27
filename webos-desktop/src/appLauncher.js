import { desktop } from "./desktop.js";
import { appMap, getGameName } from "./games.js";
import { populateStartMenu, tryGetIcon } from "./startMenu";

export class AppLauncher {
  constructor(
    windowManager,
    fileSystemManager,
    musicPlayer,
    explorerApp,
    terminalApp,
    notepadApp,
    browserApp,
    cameraApp
  ) {
    this.wm = windowManager;
    this.fs = fileSystemManager;
    this.musicPlayer = musicPlayer;
    this.explorerApp = explorerApp;
    this.terminalApp = terminalApp;
    this.notepadApp = notepadApp;
    this.browserApp = browserApp;
    this.cameraApp = cameraApp;
    this.pageLoadTime = Date.now();
    this.TRANSPARENCY_ALLOWED_APP_IDS = new Set(["paint", "vscode", "liventcord"]);
    const analyticsBase = this._getAnalyticsBase("hit-page");
    this.sendAnalytics({ ...analyticsBase, event: "start" });
    this.BIC = "badIceCream";
    const localAppMap = {
      return: {
        type: "system",
        title: "Return",
        action: () => (window.location.href = "https://reeyuki.github.io/site")
      },
      explorer: { type: "system", title: "Explorer", action: () => this.explorerApp.open() },
      terminal: { type: "system", title: "Terminal", action: () => this.terminalApp.open() },
      notepad: { type: "system", title: "Notepad", action: () => this.notepadApp.open() },
      browser: { type: "system", title: "Browser", action: () => this.browserApp.open() },
      cameraApp: { type: "system", title: "Camera App", action: () => this.cameraApp.open() },
      music: { type: "system", title: "Music Player", action: () => this.musicPlayer.open(this.wm) },
      flash: { type: "system", title: "Flash Games", action: () => this.explorerApp.openFlash() }
    };

    this.appMap = { ...localAppMap, ...appMap };
    populateStartMenu(this);
  }

  launch(app, swf = false) {
    const info = this.appMap[app];
    if (!info) {
      console.error(`App ${app} not found.`);
      return;
    }
    console.log("Starting app : ", app);

    const analyticsBase = this._getAnalyticsBase(app);
    this.sendAnalytics({ ...analyticsBase, event: "launch" });
    if (app.includes(this.BIC)) {
      if (swf) {
        console.log("Start ruffle");
        this.openRuffleApp(app, info.swf);
      } else {
        console.log(app, info.url);
        this.openGameApp(app, info.url);
      }
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const launchedByElectron = urlParams.has("game");

    if (window.electronAPI && typeof window.electronAPI.launchGame === "function" && !launchedByElectron) {
      window.electronAPI.launchGame(app);
      return;
    }

    const handleApp = {
      system: () => info.action(),
      swf: () => this.openRuffleApp(app, info.swf),
      gba: () => this.openEmulatorApp(app, info.url, "gba"),
      nds: () => this.openEmulatorApp(app, info.url, "nds"),
      game: () => this.openGameApp(app, info.url, analyticsBase),
      html: () => this.openHtmlApp(app, info.html, info),
      remote: () => this.openRemoteApp(info.url)
    };

    handleApp[info.type]?.();
  }

  _getAnalyticsBase(app) {
    const now = Date.now();
    const sessionAgeMs = now - this.pageLoadTime;
    return {
      app,
      timestamp: now,
      sessionAgeMs
    };
  }

  sendAnalytics(data) {
    if (window.location.hostname === "localhost") return;
    fetch("https://analytics.liventcord-a60.workers.dev/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
  }

  recordUsage(winId, analyticsBase) {
    const startTime = Date.now();
    const win = document.getElementById(winId);

    const sendUsage = () => {
      const durationMs = Date.now() - startTime;
      this.sendAnalytics({ ...analyticsBase, event: "usage", durationMs });
    };

    win.querySelector(".close-btn").addEventListener("click", sendUsage);
    win.addEventListener("blur", sendUsage);
  }

  openRemoteApp(appUrl) {
    const analyticsBase = this._getAnalyticsBase(appUrl);
    this.sendAnalytics({ ...analyticsBase, event: "launch" });
    window.open(appUrl, "_blank", "noopener,noreferrer");
  }

  openHtmlApp(appName, htmlContent, appMeta) {
    if (document.getElementById(`${appName}-win`)) {
      this.wm.bringToFront(document.getElementById(`${appName}-win`));
      return;
    }

    this.createWindow(
      appName,
      appName.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase()),
      htmlContent,
      null,
      appName,
      appMeta
    );
  }

  openRuffleApp(originalName, swfPath) {
    if (!swfPath) return;
    const gameName = getGameName(originalName);

    const id = swfPath.replace(/[^a-zA-Z0-9]/g, "");
    if (document.getElementById(`${id}-win`)) {
      this.wm.bringToFront(document.getElementById(`${id}-win`));
      return;
    }

    const content = `<embed src="${swfPath}" width="100%" height="100%">`;
    this.createWindow(id, gameName.toUpperCase(), content, null, originalName, {
      type: "swf",
      swf: swfPath
    });
  }

  openEmulatorApp(originalName, romName, core) {
    const gameName = getGameName(originalName);

    const uniqueId = `${core}-${romName.replace(/\W/g, "")}-${Date.now()}`;
    if (document.getElementById(uniqueId)) {
      this.wm.bringToFront(document.getElementById(uniqueId));
      return;
    }

    const iframeUrl = `/static/emulatorjs.html?rom=${encodeURIComponent(romName)}&core=${encodeURIComponent(core)}&color=%230064ff`;
    const content = `<iframe src="${iframeUrl}" style="width:100%; height:100%; border:none;" allow="autoplay; fullscreen; clipboard-write; encrypted-media; picture-in-picture" sandbox="allow-forms allow-downloads allow-modals allow-pointer-lock allow-popups allow-same-origin allow-scripts allow-top-navigation-by-user-activation"></iframe>`;
    this.createWindow(uniqueId, gameName, content, iframeUrl, gameName, {
      type: core,
      rom: romName,
      core
    });
  }

  openGameApp(appId, url) {
    const gameName = getGameName(appId);
    if (document.getElementById(`${appId}-win`)) {
      this.wm.bringToFront(document.getElementById(`${appId}-win`));
      return;
    }

    const content = `<iframe src="${url}" style="width:100%; height:100%; border:none;" allow="autoplay; fullscreen; clipboard-write; encrypted-media; picture-in-picture" sandbox="allow-forms allow-downloads allow-modals allow-pointer-lock allow-popups allow-same-origin allow-scripts allow-top-navigation-by-user-activation"></iframe>`;
    this.createWindow(appId, gameName, content, url, appId, {
      type: "game"
    });
  }
  isTransparencyBlocked(appId, appMeta) {
    if (appMeta.type === "system") return false;
    if (this.TRANSPARENCY_ALLOWED_APP_IDS.has(appId)) return false;
    return true;
  }

  createWindow(id, title, contentHtml, externalUrl = null, appId = null, appMeta = {}) {
    const urlParams = new URLSearchParams(window.location.search);
    const electronGameMode = urlParams.has("game");
    if (electronGameMode && appId) {
      document.body.innerHTML = `
        <div id="electron-game-root" style="
          width:100vw;
          height:100vh;
          margin:0;
          padding:0;
          overflow:hidden;
          background:black;
        ">
          ${contentHtml}
        </div>
      `;
      document.title = title;
      return;
    }

    const isGame = this.isTransparencyBlocked(appId, appMeta);

    const win = this.wm.createWindow(`${id}-win`, title, "80vw", "80vh", isGame);

    win.dataset.appType = appMeta.type || "";
    win.dataset.externalUrl = externalUrl || "";
    win.dataset.appId = appId || "";
    win.dataset.swf = appMeta.swf || "";
    win.dataset.isGame = isGame;
    win.dataset.rom = appMeta.rom || "";
    win.dataset.core = appMeta.core || "";

    win.innerHTML = `
      <div class="window-header">
        <span>${title}</span>
        <div class="window-controls">
          <button class="minimize-btn" title="Minimize">−</button>
          <button class="external-btn" title="Open in External">↗</button>
          <button class="maximize-btn" title="Maximize">□</button>
          <button class="close-btn" title="Close">X</button>
        </div>
      </div>
      <div class="window-content" style="width:100%; height:100%;">
        ${contentHtml}
      </div>
    `;

    desktop.appendChild(win);

    this.wm.makeDraggable(win);
    this.wm.makeResizable(win);
    this.wm.setupWindowControls(win);
    this.wm.bringToFront(win);

    win.querySelector(".external-btn").addEventListener("click", () => {
      if (!appId) return;
      console.log(id, title, contentHtml, externalUrl, appId, appMeta);
      const url = new URL(window.location.href);
      url.searchParams.set("game", appId);
      window.open(url.toString(), "_blank", "noopener,noreferrer");
    });

    const icon = tryGetIcon(appId || id);
    this.wm.addToTaskbar(win.id, title, icon);
    this.recordUsage(`${id}-win`);
  }
}
