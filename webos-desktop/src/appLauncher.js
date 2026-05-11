import { desktop } from "./desktop.js";
import { HIGHLIGHTED_GAMES, getGameName, setGameLauncher } from "./games.js";
import { appMap } from "./gamesList.js";
import { initializeAppGrid, populateStartMenu, tryGetIcon } from "./startMenu";
import { IFRAME_ATTRS } from "./shared/iframeAttrs.js";
import {
  fetchHtmlAsBlobUrl,
  resolveUrl,
  looksLikeHtml,
  isJsDelivrGhUrl,
  CDN_BASES,
  getCurrentJsDelivrRepoBase
} from "./shared/assetResolver.js";
import { initClippy, speak as clippySpeak } from "./clippy.js";
import { initAnalytics, getAnalyticsBase, sendLaunchAnalytics, recordUsage } from "./analytics.js";
import { StorageKeys } from "./settings.js";
import { getNewsContentSignature } from "./news.js";
import { PROXIES, clampProxyIndex, buildProxyUrl } from "./proxies.js";
const JSDELIVR_BASE = "https://cdn.jsdelivr.net/gh/reeyuki/yukios-games@main";
const YUKIOS_JSDELIVR_BASE = "https://cdn.jsdelivr.net/gh/reeyuki/yukios@main";

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
    calculatorApp,
    aboutApp,
    newsApp,
    settingsApp,
    taskManagerApp,
    weatherApp,
    appCreatorApp,
    officeApp,
    monaco,
    model3dApp,
    categoriesApp,
    jsDosApp,
    v86app,
    youtubeApp,
    achievementsApp,
    adsManager,
    profileCustomizerApp
  ) {
    this.wm = windowManager;
    this.fs = fileSystemManager;
    this.musicPlayer = musicPlayer;
    this.explorerApp = explorerApp;
    this.terminalApp = terminalApp;
    this.notepadApp = notepadApp;
    this.browserApp = browserApp;
    this.cameraApp = cameraApp;
    this.calculatorApp = calculatorApp;
    this.aboutApp = aboutApp;
    this.newsApp = newsApp;
    this.settingsApp = settingsApp;
    this.taskManager = taskManagerApp;
    this.weatherApp = weatherApp;
    this.appCreatorApp = appCreatorApp;
    this.officeApp = officeApp;
    this.monacoApp = monaco;
    this.model3dApp = model3dApp;
    this.categoriesApp = categoriesApp;
    this.jsDosApp = jsDosApp;
    this.v86app = v86app;
    this.youtubeApp = youtubeApp;
    this.achievementsApp = achievementsApp;
    this.adsManager = adsManager;
    this.profileCustomizerApp = profileCustomizerApp;
    this.TRANSPARENCY_ALLOWED_APP_IDS = new Set(["paint", "photopea", "vscode", "liventcord"]);

    this.clippyPromise = initClippy();

    initAnalytics();
    setGameLauncher(this);

    this.BIC = "badIceCream";

    const localAppMap = {
      browserApp: {
        type: "system",
        title: "Yuki Browser",
        action: () => this.browserApp.open(),
        clippy: { message: "I can help you find your bookmarks.", animation: "animate" }
      },
      explorer: {
        type: "system",
        title: "Explorer",
        action: () => this.explorerApp.open()
      },
      terminal: {
        type: "system",
        title: "Terminal",
        action: () => this.terminalApp.open(),
        clippy: { message: "Be careful with commands!", animation: "Acknowledge" }
      },
      notepad: {
        type: "system",
        title: "Notepad",
        action: () => this.notepadApp.open(),
        clippy: { message: "It looks like you're writing something. Need help with that letter?", animation: "Pleased" }
      },
      monaco: {
        type: "system",
        title: "Monaco Editor",
        action: () => this.monacoApp.open(),
        clippy: { message: "Would you like help starting with a 'Hello World?", animation: "Pleased" }
      },
      cameraApp: {
        type: "system",
        title: "Camera App",
        action: () => this.cameraApp.open(),
        clippy: { message: "Smile! I'll help you look your best.", animation: "Congratulate" }
      },
      settingsApp: {
        type: "system",
        title: "Settings",
        action: () => this.settingsApp.open(),
        clippy: { message: "I can guide you through settings.", animation: "Acknowledge" }
      },
      calculatorApp: {
        type: "system",
        title: "Calculator",
        action: () => this.calculatorApp.open(),
        clippy: { message: "I can do math too! ...Mostly.", animation: "Pleased" }
      },
      aboutApp: {
        type: "system",
        title: "About",
        action: () => this.aboutApp.open(),
        clippy: { message: "Your system is running smoothly.", animation: "Acknowledge" }
      },
      newsApp: {
        type: "system",
        title: "What's New",
        action: () => this.newsApp.open()
      },
      music: {
        type: "system",
        title: "Spotify",
        action: () => this.musicPlayer.open(this.wm),
        clippy: { message: "Paste a Spotify link and I'll embed it for you.", animation: "Pleased" }
      },
      model3dApp: {
        type: "system",
        title: "3D Model Viewer",
        action: () => this.model3dApp.open(),
        clippy: { message: "That caught my eye!", animation: "MoveLeft" }
      },
      flash: {
        type: "system",
        title: "Flash Games",
        action: () => this.categoriesApp.openFlash(this, this.explorerApp.wm),
        clippy: { message: "Ah the classics!", animation: "Pleased" }
      },
      steamApp: {
        type: "system",
        title: "Steam",
        action: (extra) => this.categoriesApp.opensteamApp(this, this.explorerApp.wm, null, extra?.steamGameId),
        clippy: { message: "I can suggest tips for your games.", animation: "animate" }
      },
      systemApps: {
        type: "system",
        title: "All Apps",
        action: () => this.categoriesApp.openSystemsApp(this, this.explorerApp.wm)
      },

      taskManagerApp: {
        type: "system",
        title: "Task Manager",
        action: () => this.taskManagerApp.open(),
        clippy: { message: "Something's hogging resources. Want me to guess what?", animation: "Acknowledge" }
      },
      weatherApp: {
        type: "system",
        title: "Weather",
        action: () => this.weatherApp.open(),
        clippy: { message: "Rain is expected today. Don't forget your umbrella!", animation: "Pleased" }
      },
      appCreatorApp: {
        type: "system",
        title: "App Creator",
        action: () => this.appCreatorApp.open()
      },
      officeApp: {
        type: "system",
        title: "Office",
        action: () => this.officeApp.open(),
        clippy: { message: "Need a hand creating a document or spreadsheet?", animation: "animate" }
      },
      jsDosApp: {
        type: "system",
        title: "JsDos",
        action: () => this.jsDosApp.open()
      },
      v86app: {
        type: "system",
        title: "Virtual 86",
        action: () => this.v86app.open()
      },
      achievementsApp: {
        type: "system",
        title: "Achievements",
        action: () => this.achievementsApp.open()
      },
      profileCustomizer: {
        type: "system",
        title: "Customize Profile",
        icon: "fas fa-user-circle",
        action: () => this.profileCustomizerApp.open(),
        clippy: { message: "Let's make your profile look great!", animation: "Congratulate" }
      },
      youtube: {
        type: "system",
        title: "YouTube Utilities",
        action: () => this.youtubeApp.open(),
        clippy: { message: "Paste a YouTube link and I'll embed it for you.", animation: "Pleased" }
      },
      libreSprite: {
        type: "system",
        title: "LibreSprite",
        url: "https://yukios.vercel.app/static/apps/libresprite/index.html",
        action: () =>
          this.openIframeApp({
            appId: "libreSprite",
            type: "game",
            source: "https://yukios.vercel.app/static/apps/libresprite/index.html",
            originalName: "libreSprite"
          })
      },
      kiwiIRC: {
        type: "system",
        title: "kiwiIRC",
        action: () =>
          this.openIframeApp({
            appId: "kiwiIRC",
            type: "game",
            source: "/static/apps/kiwiirc/index.html",
            originalName: "Kivi IRC"
          })
      },
      yukiConvert: {
        type: "system",
        title: "Yuki Convert",
        action: () =>
          this.openIframeApp({
            appId: "yukiConvert",
            type: "game",
            source: `${YUKIOS_JSDELIVR_BASE}/static/apps/yukiconvert/file-converter.html`,
            originalName: "Yuki Convert"
          })
      }
    };

    this.clippyMap = Object.fromEntries(
      Object.entries(localAppMap)
        .filter(([, v]) => v.clippy)
        .map(([k, v]) => [k, v.clippy])
    );

    this.clippyMap["vscode"] = { message: "Ready to write some code!", animation: "Congratulate" };
    this.appMap = { ...appMap };
    for (const [key, value] of Object.entries(localAppMap)) {
      if (this.appMap[key]) {
        this.appMap[key] = { ...this.appMap[key], ...value };
      } else {
        this.appMap[key] = value;
      }
    }
    this._launchedAppIds = this._loadLaunchedApps();
    this._appSessions = new Map();
    this._initSteamTracking();
    populateStartMenu(this);
    initializeAppGrid(this);

    if (!localStorage.getItem(StorageKeys.aboutLaunchKey)) {
      setTimeout(() => {
        this.aboutApp.open();
        localStorage.setItem(StorageKeys.aboutLaunchKey, "true");
      }, 300);
    }

    const currentNewsSig = getNewsContentSignature();
    const savedNewsSig = localStorage.getItem(StorageKeys.newsReadSignatureKey);
    const legacyNewsSeen = localStorage.getItem(StorageKeys.newsSeenKey) === "true";

    if (!savedNewsSig && legacyNewsSeen) {
      localStorage.setItem(StorageKeys.newsReadSignatureKey, currentNewsSig);
    } else if (savedNewsSig !== currentNewsSig) {
      setTimeout(() => {
        this.newsApp.open();
        localStorage.setItem(StorageKeys.newsReadSignatureKey, currentNewsSig);
        localStorage.setItem(StorageKeys.newsSeenKey, "true");
      }, 300);
    }
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

    this._ensureIframeNavigateHandler();
  }

  async speak(message, animation) {
    await clippySpeak(message, animation);
  }

  _ensureIframeNavigateHandler() {
    if (this._iframeNavigateHandlerInstalled) return;
    this._iframeNavigateHandlerInstalled = true;

    const looksLikeHtml = (url) => typeof url === "string" && /\.html?([?#].*)?$/i.test(url);
    const isJsDelivrGhUrl = (url) => typeof url === "string" && url.startsWith("https://cdn.jsdelivr.net/gh/");

    window.addEventListener("message", async (event) => {
      const data = event?.data;
      if (!data || data.__yukios !== "navigate" || typeof data.url !== "string") return;

      let sourceIframe = null;
      for (const iframe of desktop.querySelectorAll("iframe")) {
        if (iframe.contentWindow === event.source) {
          sourceIframe = iframe;
          break;
        }
      }
      if (!sourceIframe) return;

      let nextUrl = data.url;
      const prevSrc = sourceIframe.getAttribute("src") || "";

      try {
        if (looksLikeHtml(nextUrl) && isJsDelivrGhUrl(nextUrl)) {
          const blobUrl = await fetchHtmlAsBlobUrl(nextUrl);
          sourceIframe.src = blobUrl;
        } else {
          sourceIframe.src = nextUrl;
        }
      } finally {
        if (prevSrc.startsWith("blob:") && prevSrc !== sourceIframe.src) {
          try {
            URL.revokeObjectURL(prevSrc);
          } catch {}
        }
      }
    });
  }

  async launch(app, swf = false, extra = null) {
    const info = this.appMap[app];
    if (!info) return console.error(`App ${app} not found.`);

    if (!this._launchedAppIds.has(app)) {
      this._launchedAppIds.add(app);
      this._saveLaunchedApps();
      this.achievementsApp.incrementAppLaunched();
    }
    if (info.type !== "system") {
      this.achievementsApp.incrementGameLaunched();
    }
    const analyticsBase = getAnalyticsBase(app);
    sendLaunchAnalytics(app);

    if (HIGHLIGHTED_GAMES.has(app)) {
      this.adsManager?.maybeSpawnAd();
    }

    const clippyEntry = this.clippyMap[app];
    if (clippyEntry) {
      clippySpeak(clippyEntry.message, clippyEntry.animation);
    }

    const urlParams = new URLSearchParams(window.location.search);
    if (info.type !== "system" && window.electronAPI?.launchGame && !urlParams.has("game"))
      return window.electronAPI.launchGame(app);

    if (info.type === "system") {
      if (info.url) {
        if (app === "libreSprite") {
          this.openRemoteApp(info.url);
        } else {
          this.openIframeApp({ appId: app, type: "game", source: info.url, originalName: app, analyticsBase });
        }
      } else if (info.action) info.action(extra);
      return;
    }

    const handlers = {
      swf: () => this.openIframeApp({ appId: app, type: "swf", source: info.swf, originalName: app }),
      gba: () => this.openIframeApp({ appId: app, type: "gba", source: info.url, originalName: app }),
      psp: () => this.openIframeApp({ appId: app, type: "psp", source: info.url, originalName: app }),
      nds: () => this.openIframeApp({ appId: app, type: "nds", source: info.url, originalName: app }),
      megadrive: () => this.openIframeApp({ appId: app, type: "segaMD", source: info.url, originalName: app }),
      genesis: () => this.openIframeApp({ appId: app, type: "segaMD", source: info.url, originalName: app }),
      game: () => {
        let source = info.url;
        if (info?.proxyEnabled && typeof source === "string" && /^https?:\/\//.test(source)) {
          const proxyIndex = clampProxyIndex(info.proxyIndex, PROXIES);
          source = buildProxyUrl(source, proxyIndex, PROXIES);
        }
        this.openIframeApp({ appId: app, type: "game", source, originalName: app, analyticsBase });
      },
      html: () => this.openHtmlApp(app, info.html, info),
      remote: () => this.openRemoteApp(info.url)
    };
    handlers[info.type]?.();
  }

  _loadLaunchedApps() {
    try {
      const saved = localStorage.getItem(StorageKeys.launchedApps);
      if (saved) return new Set(JSON.parse(saved));
    } catch (e) {}
    return new Set();
  }

  _saveLaunchedApps() {
    try {
      localStorage.setItem(StorageKeys.launchedApps, JSON.stringify([...this._launchedAppIds]));
    } catch (e) {}
  }

  _initSteamTracking() {
    const oldRemove = this.wm.removeFromTaskbar.bind(this.wm);
    this.wm.removeFromTaskbar = (winId) => {
      const session = this._appSessions.get(winId);
      if (session) {
        const durationMin = Math.round((Date.now() - session.startTime) / 60000);
        this._updateSteamStats(session.appId, durationMin);
        this._appSessions.delete(winId);
      }
      return oldRemove(winId);
    };
  }

  _updateSteamStats(appId, minutes) {
    try {
      const stats = JSON.parse(localStorage.getItem("steam_stats") || "{}");
      if (!stats[appId]) {
        stats[appId] = { totalMin: 0, recentMin: 0, lastPlayed: 0 };
      }
      stats[appId].totalMin += minutes;
      stats[appId].recentMin += minutes;
      stats[appId].lastPlayed = Date.now();
      localStorage.setItem("steam_stats", JSON.stringify(stats));
    } catch (e) {}
  }

  openRemoteApp(appUrl) {
    const isJsDelivrGh = window.location.hostname === "cdn.jsdelivr.net" && window.location.pathname.includes("/gh/");
    if (isJsDelivrGh && typeof appUrl === "string" && appUrl.startsWith("/")) {
      appUrl = `${JSDELIVR_BASE}${appUrl}`;
    }
    sendLaunchAnalytics(appUrl);
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

  async openIframeApp({ appId, type, source, originalName, analyticsBase = null }) {
    this._fetchHtmlAsBlobUrl = fetchHtmlAsBlobUrl;

    let id;
    let contentHtml;
    let externalUrl = null;

    if (type === "swf") {
      id = source.replace(/[^a-zA-Z0-9]/g, "");
      if (this._bringToFrontIfExists(id)) return;

      const gameName = getGameName(originalName) || originalName;
      const swfPath = await resolveUrl(source);

      const swfHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${gameName}</title>
<script src="https://cdn.jsdelivr.net/npm/@ruffle-rs/ruffle@0.2.0-nightly.2026.3.15/ruffle.min.js"></script>
<style>html,body{margin:0;padding:0;width:100%;height:100%;background:black;overflow:hidden;}#player{width:100%;height:100%;}</style>
</head>
<body>
<div id="player"></div>
<script>
const ruffle=window.RufflePlayer.newest();
const player=ruffle.createPlayer();
player.style.width="100%";
player.style.height="100%";
player.style.display="block";
document.getElementById("player").appendChild(player);
player.load("${swfPath}");
</script>
</body>
</html>`;

      const swfBlob = URL.createObjectURL(new Blob([swfHtml], { type: "text/html" }));
      contentHtml = `<iframe src="${swfBlob}" ${IFRAME_ATTRS}></iframe>`;
    } else {
      id = type === "game" ? appId : `${type}-${source.replace(/\W/g, "")}-${Date.now()}`;
      if (this._bringToFrontIfExists(id)) return;

      const shouldBypassResolution =
        type !== "game" &&
        type !== "swf" &&
        typeof source === "string" &&
        !source.startsWith("blob:") &&
        !source.startsWith("data:") &&
        !source.startsWith("http://") &&
        !source.startsWith("https://") &&
        !source.startsWith("/");

      const bypassRewriteForApp = type === "game";
      const isJsDelivrGh = window.location.hostname === "cdn.jsdelivr.net" && window.location.pathname.includes("/gh/");

      let resolvedSource =
        shouldBypassResolution || bypassRewriteForApp ? source : await resolveUrl(source, isJsDelivrGh);

      if (bypassRewriteForApp && typeof resolvedSource === "string" && resolvedSource.startsWith("/")) {
        const repoBase = getCurrentJsDelivrRepoBase();
        if (repoBase) {
          resolvedSource = `${repoBase}${resolvedSource}`;
        } else {
          try {
            resolvedSource = new URL(resolvedSource, window.location.href).href;
          } catch {}
        }
      }

      const isSameOrigin = (() => {
        try {
          return new URL(resolvedSource).origin === window.location.origin;
        } catch {
          return false;
        }
      })();

      let iframeUrl;

      if (type === "game") {
        iframeUrl = resolvedSource;
        if (
          looksLikeHtml(resolvedSource) &&
          /^https?:\/\//.test(resolvedSource) &&
          !isSameOrigin &&
          isJsDelivrGhUrl(resolvedSource)
        ) {
          try {
            iframeUrl = await fetchHtmlAsBlobUrl(resolvedSource);
          } catch (err) {
            const message = err?.message ? String(err.message) : "Unknown error";
            const errHtml = `<!doctype html><meta charset="utf-8"><title>Failed to load</title>
<style>body{font-family:system-ui,Segoe UI,Roboto,Arial;margin:16px}code{background:#f2f2f2;padding:2px 4px;border-radius:4px}</style>
<h2>Failed to fetch page</h2><p><strong>URL:</strong> <code>${resolvedSource}</code></p><p><strong>Error:</strong> <code>${message}</code></p>`;
            iframeUrl = URL.createObjectURL(new Blob([errHtml], { type: "text/html" }));
          }
        }
      } else {
        alert("ROM emulation is not available.");
        return;
      }

      contentHtml = `<iframe src="${iframeUrl}" ${IFRAME_ATTRS}></iframe>`;
      if (type === "game") externalUrl = resolvedSource;
    }

    const displayTitle = this.appMap[appId]?.title || getGameName(originalName) || originalName;

    this.createIframeWindow(
      id,
      displayTitle,
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
    this.createWindow(id, title, contentHtml, externalUrl, appId, appMeta);
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
    if (appId) this._appSessions.set(`${id}-win`, { appId, startTime: Date.now() });

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
        ${this.wm.getWindowControls(externalUrl)}
      </div>
      <div class="window-content" style="width:100%; height:100%; overflow:hidden;">${contentHtml}</div>
    `;

    desktop.appendChild(win);
    this.wm.makeDraggable(win);
    this.wm.makeResizable(win);
    this.wm.setupWindowControls(win);
    this.wm.bringToFront(win);

    win.querySelector(".external-btn")?.addEventListener("click", () => {
      if (!appId) return;
      const url = new URL(window.location.href);
      url.searchParams.set("game", appId);
      window.open(url.toString(), "_blank", "noopener,noreferrer");
    });

    const mapEntry = this.appMap[appId];
    const icon =
      mapEntry?.iconValue ||
      mapEntry?.icon ||
      (appMeta.type === "swf" ? "static/icons/flash.webp" : tryGetIcon(appId || id));
    this.wm.addToTaskbar(win.id, title, icon);

    recordUsage(`${id}-win`);
  }
}
