import { desktop } from "./desktop.js";
import { WindowHelper } from "./utils/WindowHelper.js";
import { HIGHLIGHTED_GAMES, getGameName, setGameLauncher } from "./games.js";
import { appMap } from "./gamesList.js";
import { initializeAppGrid, populateStartMenu, tryGetIcon } from "./startMenu";
import { IFRAME_ATTRS } from "./shared/iframeAttrs.js";
import { getLibraryUrl } from "./shared/cdnConfig.js";
import {
  fetchHtmlAsBlobUrl,
  resolveUrl,
  looksLikeHtml,
  isCdnGhUrl,
  isCdnHostname,
  getCurrentCdnRepoBase,
  resolveGhUrl
} from "./shared/assetResolver.js";
import { initClippy, speak as clippySpeak } from "./clippy.js";
import { initAnalytics, getAnalyticsBase, sendLaunchAnalytics, recordUsage } from "./analytics.js";
import { StorageKeys } from "./settings.js";
import { getNewsContentSignature } from "./news.js";
import { PROXIES, clampProxyIndex, buildProxyUrl } from "./proxies.js";
import { AppRuntime } from "./runtime/AppRuntime.js";
const STATICALLY_BASE = resolveGhUrl("https://cdn.jsdelivr.net/gh/Reeyuki/yukios-games@main");

export class AppLauncher {
  constructor(
    windowManager,
    fileSystemManager,
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
    shittifyApp,
    monaco,
    model3dApp,
    categoriesApp,
    jsDosApp,
    v86app,
    youtubeApp,
    achievementsApp,
    adsManager,
    profileCustomizerApp,
    markdownApp,
    emulatorApp,
    ruffleApp,
    shortcutsApp,
    yukiConvertApp
  ) {
    this.wm = windowManager;
    this.windowHelper = new WindowHelper(this.wm);
    this.fs = fileSystemManager;
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
    this.shittifyApp = shittifyApp;
    this.monacoApp = monaco;
    this.model3dApp = model3dApp;
    this.categoriesApp = categoriesApp;
    this.jsDosApp = jsDosApp;
    this.v86app = v86app;
    this.youtubeApp = youtubeApp;
    this.achievementsApp = achievementsApp;
    this.adsManager = adsManager;
    this.profileCustomizerApp = profileCustomizerApp;
    this.markdownApp = markdownApp;
    this.emulatorApp = emulatorApp;
    this.ruffleApp = ruffleApp;
    this.shortcutsApp = shortcutsApp;
    this.yukiConvertApp = yukiConvertApp;
    this.TRANSPARENCY_ALLOWED_APP_IDS = new Set(["paint", "photopea", "vscode", "liventcord"]);

    this.clippyPromise = initClippy();

    initAnalytics();
    setGameLauncher(this);

    this.appRuntime = new AppRuntime({
      wm: this.wm,
      fs: this.fs,
      bus: null,
      notifications: null,
      WindowHelper: WindowHelper
    });

    this._registerLegacyApps();

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
      yukiConvert: {
        type: "system",
        title: "Yuki Convert",
        action: () => this.yukiConvertApp.open()
      },
      terminal: {
        type: "system",
        title: "Terminal",
        action: (extra) => this.terminalApp.open(extra),
        clippy: { message: "Be careful with commands!", animation: "Acknowledge" }
      },
      notepad: {
        type: "system",
        title: "Notepad",
        action: (extra) => this.notepadApp.open(extra),
        clippy: { message: "It looks like you're writing something. Need help with that letter?", animation: "Pleased" }
      },
      markdown: {
        type: "system",
        title: "Markdown",
        action: (extra) => this.markdownApp.open(extra),
        clippy: { message: "Writing in Markdown? I can help you format your documents!", animation: "Pleased" }
      },
      emulatorApp: {
        type: "system",
        title: "Yuki Emulator",
        action: () => this.emulatorApp.open(),
        clippy: { message: "Ready to play some classic games!", animation: "Pleased" }
      },
      ruffleApp: {
        type: "system",
        title: "Ruffle",
        action: () => this.ruffleApp.open(),
        clippy: { message: "Ready to play some classic games!", animation: "Pleased" }
      },
      monaco: {
        type: "system",
        title: "Yuki Code",
        action: (extra) => this.monacoApp.open(extra),
        clippy: { message: "Would you like help starting with a 'Hello World?", animation: "Pleased" }
      },
      cameraApp: {
        type: "system",
        title: "Camera App",
        action: (extra) => this.cameraApp.open(extra),
        clippy: { message: "Smile! I'll help you look your best.", animation: "Congratulate" }
      },
      settingsApp: {
        type: "system",
        title: "Settings",
        action: (extra) => this.settingsApp.open(extra),
        clippy: { message: "I can guide you through settings.", animation: "Acknowledge" }
      },
      calculatorApp: {
        type: "system",
        title: "Calculator",
        action: (extra) => this.calculatorApp.open(extra),
        clippy: { message: "I can do math too! ...Mostly.", animation: "Pleased" }
      },
      aboutApp: {
        type: "system",
        title: "About",
        action: (extra) => this.aboutApp.open(extra),
        clippy: { message: "Your system is running smoothly.", animation: "Acknowledge" }
      },
      shortcutsApp: {
        type: "system",
        title: "Shortcuts",
        action: (extra) => this.shortcutsApp.open(extra),
        clippy: { message: "Press Ctrl+K to open Command Palette!", animation: "animate" }
      },
      newsApp: {
        type: "system",
        title: "What's New",
        action: (extra) => this.newsApp.open(extra)
      },
      model3dApp: {
        type: "system",
        title: "3D Model Viewer",
        action: (extra) => this.model3dApp.open(extra),
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
        action: (extra) => this.taskManager.open(extra),
        clippy: { message: "Something's hogging resources. Want me to guess what?", animation: "Acknowledge" }
      },
      weatherApp: {
        type: "system",
        title: "Weather",
        action: (extra) => this.weatherApp.open(extra),
        clippy: { message: "Rain is expected today. Don't forget your umbrella!", animation: "Pleased" }
      },
      appCreatorApp: {
        type: "system",
        title: "App Creator",
        action: (extra) => this.appCreatorApp.open(extra)
      },
      officeApp: {
        type: "system",
        title: "Office",
        action: (extra) => this.officeApp.open(extra),
        clippy: { message: "Need a hand creating a document or spreadsheet?", animation: "animate" }
      },
      shittify: {
        type: "system",
        title: "Evil Spotify",
        action: (extra) => this.shittifyApp.open(extra)
      },
      jsDosApp: {
        type: "system",
        title: "JsDos",
        action: (extra) => this.jsDosApp.open(extra)
      },
      v86app: {
        type: "system",
        title: "Virtual 86",
        action: (extra) => this.v86app.open(extra)
      },
      achievementsApp: {
        type: "system",
        title: "Achievements",
        action: (extra) => this.achievementsApp.open(extra)
      },
      profileCustomizer: {
        type: "system",
        title: "Customize Profile",
        icon: "fas fa-user-circle",
        action: (extra) => this.profileCustomizerApp.open(extra),
        clippy: { message: "Let's make your profile look great!", animation: "Congratulate" }
      },
      youtube: {
        type: "system",
        title: "YouTube Utilities",
        action: (extra) => this.youtubeApp.open(extra),
        clippy: { message: "Paste a YouTube link and I'll embed it for you.", animation: "Pleased" }
      },
      libreSprite: {
        type: "system",
        title: "LibreSprite",
        url: "https://yukios.netlify.app/static/apps/libresprite/index.html",
        action: () =>
          this.openIframeApp({
            appId: "libreSprite",
            type: "game",
            source: "https://yukios.netlify.app/static/apps/libresprite/index.html",
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
      azahar: {
        type: "system",
        title: "Azahar (3DS Emulator)",
        action: () =>
          this.openIframeApp({
            appId: "azahar",
            type: "game",
            source: "/static/apps/azahar/index.html",
            originalName: "Azahar"
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

    //if (!localStorage.getItem(StorageKeys.aboutLaunchKey)) {
    //  setTimeout(() => {
    //    this.aboutApp.open();
    //    localStorage.setItem(StorageKeys.aboutLaunchKey, "true");
    //  }, 300);
    //}

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

    this._ensureIframeNavigateHandler();
  }

  _registerLegacyApps() {
    this.appRuntime.registerLegacy("browserApp", this.browserApp);
    this.appRuntime.registerLegacy("explorer", this.explorerApp);
    this.appRuntime.registerLegacy("terminal", this.terminalApp);
    this.appRuntime.registerLegacy("notepad", this.notepadApp);
    this.appRuntime.registerLegacy("markdown", this.markdownApp);
    this.appRuntime.registerLegacy("emulatorApp", this.emulatorApp);
    this.appRuntime.registerLegacy("ruffleApp", this.ruffleApp);
    this.appRuntime.registerLegacy("monaco", this.monacoApp);
    this.appRuntime.registerLegacy("cameraApp", this.cameraApp);
    this.appRuntime.registerLegacy("settingsApp", this.settingsApp);
    this.appRuntime.registerLegacy("calculatorApp", this.calculatorApp);
    this.appRuntime.registerLegacy("aboutApp", this.aboutApp);
    this.appRuntime.registerLegacy("shortcutsApp", this.shortcutsApp);
    this.appRuntime.registerLegacy("newsApp", this.newsApp);
    this.appRuntime.registerLegacy("model3dApp", this.model3dApp);
    this.appRuntime.registerLegacy("flash", this.categoriesApp);
    this.appRuntime.registerLegacy("steamApp", this.categoriesApp);
    this.appRuntime.registerLegacy("taskManager", this.taskManager);
    this.appRuntime.registerLegacy("weather", this.weatherApp);
    this.appRuntime.registerLegacy("appCreator", this.appCreatorApp);
    this.appRuntime.registerLegacy("office", this.officeApp);
    this.appRuntime.registerLegacy("shittify", this.shittifyApp);
    this.appRuntime.registerLegacy("jsDos", this.jsDosApp);
    this.appRuntime.registerLegacy("v86", this.v86app);
    this.appRuntime.registerLegacy("youtube", this.youtubeApp);
    this.appRuntime.registerLegacy("achievements", this.achievementsApp);
    this.appRuntime.registerLegacy("profileCustomizer", this.profileCustomizerApp);
    this.appRuntime.registerLegacy("yukiConvert", this.yukiConvertApp);
  }

  _tryLaunchDeclarative(appId, opts) {
    const appInstance = this.appRuntime.getLegacy(appId);
    if (!appInstance) return null;

    if (typeof appInstance.getDeclarativeSchema === "function") {
      try {
        const schema = appInstance.getDeclarativeSchema(opts);
        if (schema && typeof schema === "object") {
          if (
            schema.onMount &&
            typeof schema.onMount === "string" &&
            typeof appInstance[schema.onMount] === "function"
          ) {
            if (!schema.actions) {
              schema.actions = {};
            }
            if (!schema.actions[schema.onMount]) {
              schema.actions[schema.onMount] = (payload, event, element, state) => {
                return appInstance[schema.onMount](payload, event, element, state);
              };
            }
          }
          if (!schema.onClose && typeof appInstance.onClose === "function") {
            schema.onClose = (winId, state) => {
              return appInstance.onClose(winId, state);
            };
          }
          this.appRuntime.registerDeclarative(schema);
          return this.appRuntime.launch(schema.id, opts);
        }
      } catch (e) {
        console.warn(`Failed to use declarative schema for ${appId}, falling back to imperative`, e);
      }
    }

    return null;
  }

  async speak(message, animation) {
    await clippySpeak(message, animation);
  }

  _ensureIframeNavigateHandler() {
    if (this._iframeNavigateHandlerInstalled) return;
    this._iframeNavigateHandlerInstalled = true;

    const looksLikeHtml = (url) => typeof url === "string" && /\.html?([?#].*)?$/i.test(url);

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
        if (looksLikeHtml(nextUrl) && isCdnGhUrl(nextUrl)) {
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

    if (typeof info.url === "string" && isCdnGhUrl(info.url)) {
      info.url = resolveGhUrl(info.url);
    }
    if (typeof info.swf === "string" && isCdnGhUrl(info.swf)) {
      info.swf = resolveGhUrl(info.swf);
    }
    if (typeof info.html === "string" && isCdnGhUrl(info.html)) {
      info.html = resolveGhUrl(info.html);
    }

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

    const appExtra = { ...(extra || {}), appId: app, appType: info.type };
    this.wm._pendingLaunchOptions = appExtra;

    if (info.type === "system") {
      if (info.url) {
        if (app === "libreSprite") {
          this.openRemoteApp(info.url);
        } else {
          this.openIframeApp({
            appId: app,
            type: "game",
            source: info.url,
            originalName: app,
            analyticsBase,
            ...appExtra
          });
        }
      } else if (info.action) {
        const result = this._tryLaunchDeclarative(app, appExtra);
        if (!result) {
          info.action(appExtra);
        }
      }
      return;
    }

    const handlers = {
      swf: () => this.openIframeApp({ appId: app, type: "swf", source: info.swf, originalName: app, ...appExtra }),
      gba: () => this.openIframeApp({ appId: app, type: "gba", source: info.url, originalName: app, ...appExtra }),
      psp: () => this.openIframeApp({ appId: app, type: "psp", source: info.url, originalName: app, ...appExtra }),
      nds: () => this.openIframeApp({ appId: app, type: "nds", source: info.url, originalName: app, ...appExtra }),
      megadrive: () =>
        this.openIframeApp({ appId: app, type: "segaMD", source: info.url, originalName: app, ...appExtra }),
      genesis: () =>
        this.openIframeApp({ appId: app, type: "segaMD", source: info.url, originalName: app, ...appExtra }),
      game: () => {
        let source = info.url;
        if (info?.proxyEnabled && typeof source === "string" && /^https?:\/\//.test(source)) {
          const proxyIndex = clampProxyIndex(info.proxyIndex, PROXIES);
          source = buildProxyUrl(source, proxyIndex, PROXIES);
        }
        this.openIframeApp({ appId: app, type: "game", source, originalName: app, analyticsBase, ...appExtra });
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
      const now = Date.now();
      const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

      const stats = JSON.parse(localStorage.getItem(StorageKeys.steamStats) || "{}");
      if (!stats[appId]) {
        stats[appId] = { totalMin: 0, lastPlayed: 0 };
      }
      stats[appId].totalMin += minutes;
      stats[appId].lastPlayed = now;
      localStorage.setItem(StorageKeys.steamStats, JSON.stringify(stats));

      const sessions = JSON.parse(localStorage.getItem(StorageKeys.steamSessions) || "{}");
      if (!sessions[appId]) sessions[appId] = [];
      sessions[appId].push({ ts: now, min: minutes });
      sessions[appId] = sessions[appId].filter((s) => now - s.ts < ONE_WEEK_MS);
      localStorage.setItem(StorageKeys.steamSessions, JSON.stringify(sessions));
    } catch (e) {}
  }

  openRemoteApp(appUrl) {
    const isStaticallyGh = isCdnGhUrl(window.location.href);
    if (isStaticallyGh && typeof appUrl === "string" && appUrl.startsWith("/")) {
      appUrl = `${STATICALLY_BASE}${appUrl}`;
    }
    sendLaunchAnalytics(appUrl);
    window.open(appUrl, "_blank", "noopener,noreferrer");
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

  async openIframeApp({ appId, type, source, originalName, analyticsBase = null, ...extra }) {
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
<script src="${getLibraryUrl("ruffle") || "https://unpkg.com/@ruffle-rs/ruffle/ruffle.js"}"></script>
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

      const isCdnGh = isCdnHostname(window.location.hostname) && window.location.pathname.includes("/gh/");

      let resolvedSource =
        shouldBypassResolution || isCdnGh ? source : await resolveUrl(source, isCdnGhUrl(window.location.href));

      if (
        isCdnGh &&
        typeof resolvedSource === "string" &&
        resolvedSource.startsWith("/") &&
        !resolvedSource.startsWith("/static/apps/azahar/")
      ) {
        const repoBase = getCurrentCdnRepoBase();
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

      if (type !== "game") {
        contentHtml = `<iframe src="${resolvedSource}" ${IFRAME_ATTRS}></iframe>`;
      }

      if (type === "game") {
        const displayTitle = this.appMap[appId]?.title || originalName;
        const win = this.wm.createWindow(
          extra.forceId || `${id}-win`,
          displayTitle,
          extra.width || "80vw",
          extra.height || "80vh",
          this.isTransparencyBlocked(appId, { type }),
          extra
        );
        if (appId) this._appSessions.set(`${id}-win`, { appId, startTime: Date.now() });

        Object.assign(win.dataset, {
          appType: type,
          externalUrl: resolvedSource || "",
          appId: appId || "",
          swf: type === "swf" ? source : "",
          isGame: this.isTransparencyBlocked(appId, { type }),
          rom: type !== "game" && type !== "swf" ? source : "",
          core: type !== "game" && type !== "swf" ? type : ""
        });

        win.innerHTML = `
          <div class="window-header">
            <span>${displayTitle}</span>
            ${this.wm.getWindowControls(resolvedSource)}
          </div>
          <div class="window-content" style="width:100%; height:100%; overflow:hidden; display:flex; align-items:center; justify-content:center; background:#1a1a1a;">
            <div class="modern-loader">
              <div class="loader-dots">
                <div class="loader-dot"></div>
                <div class="loader-dot"></div>
                <div class="loader-dot"></div>
              </div>
              <div class="loader-text">Loading</div>
            </div>
          </div>
        `;

        this.windowHelper.mountWindow(win, `${id}-win`, displayTitle, this.appMap[appId]?.icon || "fas fa-gamepad");

        win.querySelector(".external-btn")?.addEventListener("click", () => {
          window.open(resolvedSource, "_blank");
        });

        if (
          looksLikeHtml(resolvedSource) &&
          /^https?:\/\//.test(resolvedSource) &&
          !isSameOrigin &&
          (isCdnGhUrl(resolvedSource) || isCdnGhUrl(window.location.href))
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
        } else {
          iframeUrl = resolvedSource;
        }

        const contentDiv = win.querySelector(".window-content");
        if (contentDiv) {
          contentDiv.innerHTML = `<iframe src="${iframeUrl}" ${IFRAME_ATTRS}></iframe>`;
        }

        if (type === "game") externalUrl = resolvedSource;
        return;
      } else {
        this.emulatorApp.launchFromUrl(resolvedSource, type);
        return;
      }
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

    this.windowHelper.mountWindow(win, win.id, title, null, { addToTaskbar: false });

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
