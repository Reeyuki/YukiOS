import { desktop } from "./desktop.js";
import { appMap, getGameName } from "./games.js";
import { initializeAppGrid, populateStartMenu, tryGetIcon } from "./startMenu";

const IFRAME_ATTRS =
  'style="width:100%;height:100%;border:none;" allow="autoplay; fullscreen; clipboard-write; encrypted-media; picture-in-picture" sandbox="allow-forms allow-downloads allow-modals allow-pointer-lock allow-popups allow-same-origin allow-scripts allow-top-navigation-by-user-activation"';

export class AppLauncher {
  constructor(
    windowManager,
    fileSystemManager,
    musicPlayer,
    explorerApp,
    terminalApp,
    notepadApp,
    browserApp,
    cameraApp,
    pythonApp,
    nodeApp,
    calculatorApp,
    aboutApp
  ) {
    this.wm = windowManager;
    this.fs = fileSystemManager;
    this.musicPlayer = musicPlayer;
    this.explorerApp = explorerApp;
    this.terminalApp = terminalApp;
    this.notepadApp = notepadApp;
    this.browserApp = browserApp;
    this.cameraApp = cameraApp;
    this.pythonApp = pythonApp;
    this.nodeApp = nodeApp;
    this.calculatorApp = calculatorApp;
    this.aboutApp = aboutApp;
    this.pageLoadTime = Date.now();
    this.TRANSPARENCY_ALLOWED_APP_IDS = new Set(["paint", "photopea", "vscode", "liventcord"]);
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
      pythonApp: { type: "system", title: "Python Code Editor", action: () => this.pythonApp.open() },
      nodeApp: { type: "system", title: "NodeJS Code Editor", action: () => this.nodeApp.open() },
      calculatorApp: { type: "system", title: "Calculator", action: () => this.calculatorApp.open() },
      aboutApp: { type: "system", title: "About", action: () => this.aboutApp.open() },
      music: { type: "system", title: "Music Player", action: () => this.musicPlayer.open(this.wm) },
      flash: { type: "system", title: "Flash Games", action: () => this.explorerApp.openFlash() }
    };

    this.appMap = { ...localAppMap, ...appMap };
    populateStartMenu(this);
    initializeAppGrid();

    if (window.electronAPI) {
      const tmnpIcon = document.createElement("div");
      tmnpIcon.className = "icon selectable";
      tmnpIcon.dataset.app = "TMNP";
      tmnpIcon.draggable = false;
      tmnpIcon.style.cssText = "user-select: none; left: 600px; top: 110px;";

      tmnpIcon.append(
        Object.assign(document.createElement("img"), { src: appMap.TMNP.icon }),
        Object.assign(document.createElement("div"), { textContent: appMap.TMNP.title })
      );

      desktop.append(tmnpIcon);
    }
  }

  launch(app, swf = false) {
    const info = this.appMap[app];
    if (!info) return console.error(`App ${app} not found.`);

    const analyticsBase = this._getAnalyticsBase(app);
    this.sendAnalytics({ ...analyticsBase, event: "launch" });

    if (app.includes(this.BIC)) {
      if (swf) {
        return this.openIframeApp({ appId: app, type: "swf", source: info.swf, originalName: app });
      } else {
        return this.openIframeApp({ appId: app, type: "game", source: info.url, originalName: app, analyticsBase });
      }
    }
    if (app === "gtaVc" && !window.electronAPI) {
      const msgId = "gtavc-browser-warning";
      if (!document.getElementById(`${msgId}-win`)) {
        const content = `
          <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;flex-direction:column;font-family:sans-serif;padding:20px;box-sizing:border-box;text-align:center;">
            <h2 style="margin-bottom:12px;">Cannot Launch Game</h2>
            <p style="font-size:16px;max-width:500px;">
              GTA Vice City cannot run in the browser using a https domain (this site).
              Please launch this game using the desktop app.
              This game can't run over HTTPS, but works fine on localhost and through LAN, and I couldn't figure out why.
            </p>
          </div>
        `;
        this.createWindow(msgId, "Launch Error", content, null, msgId, { type: "system" });
      }
      return;
    }
    const urlParams = new URLSearchParams(window.location.search);
    if (info.type != "system" && window.electronAPI?.launchGame && !urlParams.has("game"))
      return window.electronAPI.launchGame(app);

    const handlers = {
      system: () => info.action(),
      swf: () => this.openIframeApp({ appId: app, type: "swf", source: info.swf, originalName: app }),
      gba: () => this.openIframeApp({ appId: app, type: "gba", source: info.url, originalName: app }),
      psp: () => this.openIframeApp({ appId: app, type: "psp", source: info.url, originalName: app }),
      nds: () => this.openIframeApp({ appId: app, type: "nds", source: info.url, originalName: app }),
      game: () => this.openIframeApp({ appId: app, type: "game", source: info.url, originalName: app, analyticsBase }),
      html: () => this.openHtmlApp(app, info.html, info),
      remote: () => this.openRemoteApp(info.url)
    };

    handlers[info.type]?.();
  }

  _getAnalyticsBase(app) {
    const now = Date.now();
    return { app, timestamp: now, sessionAgeMs: now - this.pageLoadTime };
  }

  sendAnalytics(data) {
    if (window.location.hostname === "localhost") return;
    fetch("https://analytics.liventcord-a60.workers.dev/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
  }
  sendAppInstallAnalytics() {
    this.sendAnalytics({ ...this._getAnalyticsBase(), event: "installApp" });
  }

  recordUsage(winId) {
    const startTime = Date.now();
    const win = document.getElementById(winId);
    if (!win) return;

    const appId = win.dataset.appId || "";
    let sent = false;

    const sendUsage = () => {
      if (sent) return;
      sent = true;
      this.sendAnalytics({
        app: appId,
        event: "usage",
        durationMs: Date.now() - startTime,
        timestamp: Date.now(),
        sessionAgeMs: Date.now() - this.pageLoadTime
      });
    };

    win.querySelector(".close-btn")?.addEventListener("click", sendUsage);
  }

  openRemoteApp(appUrl) {
    this.sendAnalytics({ ...this._getAnalyticsBase(appUrl), event: "launch" });
    if (window.electronAPI) {
      location.href = appUrl;
    } else {
      window.open(appUrl, "_blank", "noopener,noreferrer");
    }
  }

  openHtmlApp(appName, htmlContent, appMeta) {
    if (this._bringToFrontIfExists(appName)) return;
    this.createWindow(
      appName,
      appName.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()),
      htmlContent,
      null,
      appName,
      appMeta
    );
  }

  openIframeApp({ appId, type, source, originalName, analyticsBase = null }) {
    let id;
    let contentHtml;
    let externalUrl = null;

    if (type === "swf") {
      id = source.replace(/[^a-zA-Z0-9]/g, "");
      if (this._bringToFrontIfExists(id)) return;
      const gameName = getGameName(originalName);
      const swfPath = source.startsWith("http") ? source : `${window.location.origin}${source}`;
      contentHtml = `<iframe srcdoc="
      <!DOCTYPE html>
      <html lang='en'>
        <head>
          <meta charset='UTF-8'>
          <title>${gameName}</title>
          <script src='https://cdn.jsdelivr.net/npm/@ruffle-rs/ruffle@0.2.0-nightly.2026.1.17/ruffle.min.js'></script>
          <style>html,body{margin:0;padding:0;width:100%;height:100%;background:black;overflow:hidden;}#player{width:100%;height:100%;}</style>
        </head>
        <body>
          <div id='player'></div>
          <script>
            const ruffle = window.RufflePlayer.newest();
            const player = ruffle.createPlayer();
            player.style.width='100%';
            player.style.height='100%';
            player.style.display='block';
            document.getElementById('player').appendChild(player);
            player.load('${swfPath}');
          </script>
        </body>
      </html>" ${IFRAME_ATTRS}></iframe>`;
    } else {
      id = type === "game" ? appId : `${type}-${source.replace(/\W/g, "")}-${Date.now()}`;
      if (this._bringToFrontIfExists(id)) return;
      const iframeUrl =
        type === "game"
          ? source
          : `/static/emulatorjs.html?rom=${encodeURIComponent(source)}&core=${encodeURIComponent(type)}&color=%230064ff`;
      contentHtml = `<iframe src="${iframeUrl}" ${IFRAME_ATTRS}></iframe>`;
      if (type === "game") externalUrl = source;
    }

    this.createIframeWindow(
      id,
      getGameName(originalName),
      contentHtml,
      appId,
      {
        type,
        swf: type === "swf" ? source : undefined,
        rom: type !== "game" && type !== "swf" ? source : undefined,
        core: type !== "game" && type !== "swf" ? type : undefined
      },
      analyticsBase,
      externalUrl
    );
  }

  _bringToFrontIfExists(id) {
    const el = document.getElementById(`${id}-win`);
    if (el) this.wm.bringToFront(el);
    return !!el;
  }

  createIframeWindow(id, title, contentHtml, appId, appMeta, analyticsBase = null, externalUrl = null) {
    this.createWindow(id, title, contentHtml, externalUrl || analyticsBase, appId, appMeta);
  }

  isTransparencyBlocked(appId, appMeta) {
    return !(appMeta.type === "system" || this.TRANSPARENCY_ALLOWED_APP_IDS.has(appId));
  }

  createWindow(id, title, contentHtml, externalUrl = null, appId = null, appMeta = {}) {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has("game") && appId) {
      document.title = title;
      document.head.insertAdjacentHTML(
        "beforeend",
        `<style>
                html, body {
                    margin: 0;
                    padding: 0;
                    width: 100%;
                    height: 100%;
                    overflow: hidden;
                    background: black;
                }
            </style>`
      );
      document.body.innerHTML = `<div id="electron-game-root" style="width:100vw;height:100vh;margin:0;padding:0;overflow:hidden;">${contentHtml}</div>`;
      return;
    }

    const isGame = this.isTransparencyBlocked(appId, appMeta);
    const win = this.wm.createWindow(`${id}-win`, title, "80vw", "80vh", isGame);

    Object.assign(win.dataset, {
      appType: appMeta.type || "",
      externalUrl: externalUrl || "",
      appId: appId || "",
      swf: appMeta.swf || "",
      isGame,
      rom: appMeta.rom || "",
      core: appMeta.core || ""
    });

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
        <div class="window-content" style="width:100%; height:100%; overflow:hidden;">${contentHtml}</div>
    `;

    desktop.appendChild(win);
    this.wm.makeDraggable(win);
    this.wm.makeResizable(win);
    this.wm.setupWindowControls(win);
    this.wm.bringToFront(win);

    win.querySelector(".external-btn").addEventListener("click", () => {
      if (!appId) return;
      const url = new URL(window.location.href);
      url.searchParams.set("game", appId);
      window.open(url.toString(), "_blank", "noopener,noreferrer");
    });

    const icon = tryGetIcon(appId || id);
    this.wm.addToTaskbar(win.id, title, icon);
    this.recordUsage(`${id}-win`);
  }
}
