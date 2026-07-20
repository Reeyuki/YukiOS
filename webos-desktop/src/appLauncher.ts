import { sanitizeTitle } from "./utils/utils.js";
import { HIGHLIGHTED_GAMES, getGameName } from "./games/games.js";
import { appMap } from "./games/gamesList.js";
import { SYSTEM_APPS } from "./AppRegistryConfig.js";
import { createAppActions } from "./AppActions.js";
import { initializeAppGrid, tryGetIcon, trackRecentlyUsed } from "./desktopui/startMenu.js";
import { IFRAME_ATTRS } from "./shared/iframeAttrs.js";
import { getLibraryUrl } from "./shared/cdnConfig.js";
import { StorageKeys, os } from "./framework.js";
import {
  fetchHtmlAsBlobUrl,
  resolveUrl,
  resolveIconUrl,
  looksLikeHtml,
  isCdnGhUrl,
  isCdnHostname,
  getCurrentCdnRepoBase,
  resolveGhUrl
} from "./shared/assetResolver.js";
import { yukiITDevToolsBridge, YUKI_DEV_TOOLS_URL } from "./yukiITDevToolsBridge.js";
import { ClippyAnimation, initClippy, speak } from "./ai/clippy.js";
const clippySpeak = speak;
import { GameOverlayController } from "./gameOverlay.js";
import "./styles/gameOverlay.css";
import { initAnalytics, getAnalyticsBase, sendLaunchAnalytics, recordUsage } from "./analytics.js";
import { getNewsContentSignature, updateNewsBadge } from "./apps/news.js";
import { SteamSettings } from "./games/steam.js";
import { PROXIES, clampProxyIndex, buildProxyUrl, fetchHtmlThroughProxy } from "./proxies.js";
import { trigger as triggerCursorEffect } from "./cursorEffect.js";
const STATICALLY_BASE = resolveGhUrl("https://cdn.jsdelivr.net/gh/Reeyuki/yukios-games@main");

export class AppLauncher {
  wm: any;
  fs: any;
  services: Record<string, any>;
  taskManager: any;
  adsManager: any;
  brightnessApp: any;
  TRANSPARENCY_ALLOWED_APP_IDS: Set<string>;
  clippyPromise: Promise<any>;
  appRegistry: Map<string, any>;
  BIC: string;
  appMap: Record<string, any>;
  launchedAppIds: Set<string>;
  appSessions: Map<string, { appId: string; startTime: number }>;
  clippyMap: Record<string, any>;

  constructor(windowManager: any, fileSystemManager: any, services: Record<string, any> | Map<string, any> = {}) {
    this.wm = windowManager;
    this.fs = fileSystemManager;

    this.services = services instanceof Map ? Object.fromEntries(services) : services;
    Object.assign(this, this.services);

    this.taskManager = this.services.taskManagerApp;
    this.adsManager = this.services.adsApp;
    this.brightnessApp = this.services.displayPerformanceApp;

    this.TRANSPARENCY_ALLOWED_APP_IDS = new Set(["paint", "photopea", "vscode", "liventcord"]);

    this.clippyPromise = initClippy();

    initAnalytics();

    const settings = SteamSettings.load();
    if (settings.runOnStartup && !(window as any).steamStartupHandled) {
      (window as any).steamStartupHandled = true;
      setTimeout(() => {
        this.launch("steamApp");
        if (settings.startMinimized) {
          setTimeout(() => {
            const steamWin = document.getElementById("games-app-win");
            if (steamWin) {
              const wm = this.wm;
              wm.minimize(steamWin);
            }
          }, 500);
        }
      }, 1000);
    }

    this.appRegistry = new Map();

    this.registerAppsFromMap();

    this.BIC = "badIceCream";

    const appActions = createAppActions(this);

    const systemAppsWithActions = Object.fromEntries(
      Object.entries(SYSTEM_APPS).map(([appId, metadata]) => {
        const action = appActions[appId];
        return [appId, { ...metadata, ...(action ? { action } : {}) }];
      })
    );

    this.clippyMap = Object.fromEntries(
      Object.entries(SYSTEM_APPS)
        .filter(([, v]: [string, any]) => v.clippy)
        .map(([k, v]: [string, any]) => [k, v.clippy])
    );

    this.clippyMap["vscode"] = { message: "Ready to write some code!", animation: ClippyAnimation.GetWizardy };
    this.appMap = { ...appMap, ...systemAppsWithActions };
    this.launchedAppIds = this.loadLaunchedApps();
    this.appSessions = new Map();
    this.initSteamTracking();
    initializeAppGrid();

    const currentNewsSig = getNewsContentSignature();
    const savedNewsSig = os.storage.get(StorageKeys.newsReadSignatureKey);
    const legacyNewsSeen = os.storage.get(StorageKeys.newsSeenKey) === "true";
    const setupCompleted = os.storage.get(StorageKeys.setupCompleted) === "true";

    if (!savedNewsSig && legacyNewsSeen) {
      os.storage.set(StorageKeys.newsReadSignatureKey, currentNewsSig);
    } else if (savedNewsSig !== currentNewsSig && setupCompleted) {
      setTimeout(() => {
        this.launch("newsApp");
        os.storage.set(StorageKeys.newsReadSignatureKey, currentNewsSig);
        os.storage.set(StorageKeys.newsSeenKey, "true");
      }, 1000);
    }

    setTimeout(() => {
      updateNewsBadge();
    }, 500);

    this.ensureIframeNavigateHandler();

    this.overlayController = new GameOverlayController(this, this.services);
  }

  setEmulatorApp(emulatorApp: any): void {
    this.emulatorApp = emulatorApp;
  }

  listRunningApps(): Array<{ winId: string; title: string; icon: string; status: string }> {
    const apps: Array<{ winId: string; title: string; icon: string; status: string }> = [];
    const seen = new Set<string>();
    this.wm.openWindows.forEach((entry: any, winId: string) => {
      if (seen.has(winId)) return;
      seen.add(winId);
      if (os.tray.isInTray(winId)) return;
      apps.push({
        winId,
        title: entry.title || winId,
        icon: entry.iconValue || "fas fa-window-maximize",
        status: "Running"
      });
    });
    return apps;
  }

  registerAppsFromMap(): void {
    for (const [appId, metadata] of Object.entries(SYSTEM_APPS)) {
      const serviceKey = (metadata as any).serviceKey || appId;
      const instance = this.services[serviceKey] || (this as any)[appId] || (this as any)[appId + "App"];
      if (instance) {
        this.appRegistry.set(appId, instance);
      }
    }
  }

  async speak(message: string, animation?: any): Promise<void> {
    await clippySpeak(message, animation);
  }

  ensureIframeNavigateHandler(): void {
    if ((this as any).iframeNavigateHandlerInstalled) return;
    (this as any).iframeNavigateHandlerInstalled = true;

    window.addEventListener("message", async (event: MessageEvent) => {
      const data = event?.data;
      if (!data || data.__yukios !== "navigate" || typeof data.url !== "string") return;

      let sourceIframe: HTMLIFrameElement | null = null;
      for (const iframe of document.getElementById("desktop")!.querySelectorAll("iframe")) {
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

  async launch(app: string, swf: boolean = false, extra: any = null): Promise<void> {
    const info = this.appMap[app];
    if (!info) {
      console.error(`App ${app} not found.`);
      return;
    }

    triggerCursorEffect(info.icon);

    if (typeof info.url === "string" && isCdnGhUrl(info.url)) {
      info.url = resolveGhUrl(info.url);
    }
    if (typeof info.swf === "string" && isCdnGhUrl(info.swf)) {
      info.swf = resolveGhUrl(info.swf);
    }
    if (typeof info.html === "string" && isCdnGhUrl(info.html)) {
      info.html = resolveGhUrl(info.html);
    }

    if (!this.launchedAppIds.has(app)) {
      this.launchedAppIds.add(app);
      this.saveLaunchedApps();
      os.achievements.incrementAppLaunched();
    }
    trackRecentlyUsed(app);
    if (info.type !== "system") {
      os.achievements.incrementGameLaunched();
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

    const appExtra = { ...(extra || {}), appId: app, appType: info.type };

    if (info.type === "system") {
      if (info.launchType === "remote") {
        this.openRemoteApp(info.source || info.url);
      } else if (info.launchType === "iframe" && info.source) {
        this.openIframeApp({
          appId: app,
          type: "game",
          source: info.source,
          originalName: app,
          analyticsBase,
          ...appExtra
        });
      } else if (info.url) {
        this.openIframeApp({
          appId: app,
          type: "game",
          source: info.url,
          originalName: app,
          analyticsBase,
          ...appExtra
        });
      } else if (info.action) {
        await info.action.call(this, appExtra);
      } else if (info.launchType === "instance") {
        const appInstance = this.appRegistry.get(app);
        if (appInstance && typeof appInstance.open === "function") {
          await appInstance.open(appExtra);
        } else {
          console.warn(`No open() method found for app: ${app}`);
        }
      }
      return;
    }

    const handlers: Record<string, () => Promise<void> | void> = {
      swf: () => this.openIframeApp({ appId: app, type: "swf", source: info.swf, originalName: app, ...appExtra }),
      gba: () => this.openIframeApp({ appId: app, type: "gba", source: info.url, originalName: app, ...appExtra }),
      psp: () => this.openIframeApp({ appId: app, type: "psp", source: info.url, originalName: app, ...appExtra }),
      nds: () => this.openIframeApp({ appId: app, type: "nds", source: info.url, originalName: app, ...appExtra }),
      megadrive: () =>
        this.openIframeApp({ appId: app, type: "segaMD", source: info.url, originalName: app, ...appExtra }),
      genesis: () =>
        this.openIframeApp({ appId: app, type: "segaMD", source: info.url, originalName: app, ...appExtra }),
      game: async () => {
        let source = info.url;

        if (info?.scramjetEnabled) {
          const wispUrl =
            os.storage.get(StorageKeys.wispServer) || "wss://hurt-agata-liventcord-api-7072e9a6.koyeb.app/";
          source = `/scramapps/scramjet-template.html?wisp=${encodeURIComponent(wispUrl)}&target=${encodeURIComponent(info.url)}`;
        } else if (info?.proxyEnabled && typeof source === "string" && /^https?:\/\//.test(source)) {
          const proxyIndex = clampProxyIndex(info.proxyIndex, PROXIES);
          try {
            source = await fetchHtmlThroughProxy(source, proxyIndex, PROXIES);
          } catch (e) {
            source = buildProxyUrl(source, proxyIndex, PROXIES);
          }
        }
        this.openIframeApp({ appId: app, type: "game", source, originalName: app, analyticsBase, ...appExtra });
      },
      html: () => this.openHtmlApp(app, info.html, info),
      remote: () => this.openRemoteApp(info.url)
    };
    const handler = handlers[info.type];
    if (handler) {
      await handler();
    }
  }

  loadLaunchedApps(): Set<string> {
    try {
      const saved = os.storage.get(StorageKeys.launchedApps);
      if (saved) return new Set(saved);
    } catch (e) {}
    return new Set();
  }

  saveLaunchedApps(): void {
    try {
      os.storage.set(StorageKeys.launchedApps, [...this.launchedAppIds]);
    } catch (e) {}
  }

  initSteamTracking(): void {
    const oldRemove = this.wm.removeFromTaskbar.bind(this.wm);
    this.wm.removeFromTaskbar = (winId: string) => {
      const session = this.appSessions.get(winId);
      if (session) {
        const durationMin = Math.round((Date.now() - session.startTime) / 60000);
        this.updateSteamStats(session.appId, durationMin);
        this.appSessions.delete(winId);
        this.adsManager?.onGameClosed();
      }
      return oldRemove(winId);
    };
  }

  updateSteamStats(appId: string, minutes: number): void {
    try {
      const now = Date.now();
      const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

      const stats = os.storage.get(StorageKeys.steamStats) || {};
      if (!stats[appId]) {
        stats[appId] = { totalMin: 0, lastPlayed: 0 };
      }
      stats[appId].totalMin += minutes;
      stats[appId].lastPlayed = now;
      os.storage.set(StorageKeys.steamStats, stats);

      const sessions = os.storage.get(StorageKeys.steamSessions) || {};
      if (!sessions[appId]) sessions[appId] = [];
      sessions[appId].push({ ts: now, min: minutes });
      sessions[appId] = sessions[appId].filter((s: any) => now - s.ts < ONE_WEEK_MS);
      os.storage.set(StorageKeys.steamSessions, sessions);
    } catch (e) {}
  }

  openRemoteApp(appUrl: string): void {
    const isStaticallyGh = isCdnGhUrl(window.location.href);
    if (isStaticallyGh && typeof appUrl === "string" && appUrl.startsWith("/")) {
      appUrl = `${STATICALLY_BASE}${appUrl}`;
    }
    sendLaunchAnalytics(appUrl);
    window.open(appUrl, "blank", "noopener,noreferrer");
  }

  async openYukiDevToolsApp(extra: Record<string, any> = {}): Promise<void> {
    const appId = "yukiDevTools";
    if (this.bringToFrontIfExists(appId)) return;

    const title = this.appMap[appId]?.title || "Yuki Dev Tools";
    let iframeUrl = YUKI_DEV_TOOLS_URL;

    try {
      iframeUrl = await yukiITDevToolsBridge(YUKI_DEV_TOOLS_URL);
    } catch (err) {
      console.error("Failed to build bridged Yuki Dev Tools iframe", err);
    }

    const contentHtml = `<iframe src="${iframeUrl}" ${IFRAME_ATTRS}></iframe>`;
    this.createWindow(appId, title, contentHtml, YUKI_DEV_TOOLS_URL, appId, {
      type: "game",
      ...extra
    });
  }

  openHtmlApp(appName: string, htmlContent: string, appMeta: any): void {
    if (this.bringToFrontIfExists(appName)) return;
    this.createWindow(
      appName,
      appName.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()),
      htmlContent,
      null,
      appName,
      appMeta
    );
  }

  async openIframeApp({ appId, type, source, originalName, analyticsBase = null, ...extra }: any): Promise<void> {
    (this as any).fetchHtmlAsBlobUrl = fetchHtmlAsBlobUrl;

    let id: string;
    let contentHtml: string | undefined;
    let externalUrl: string | null = null;

    if (type === "swf") {
      id = source.replace(/[^a-zA-Z0-9]/g, "");
      if (this.bringToFrontIfExists(id)) return;

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
      externalUrl = swfBlob;
    } else {
      id = type === "game" ? appId : `${type}-${source.replace(/\W/g, "")}-${Date.now()}`;
      if (this.bringToFrontIfExists(id)) return;

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

      const isLocalhostUrl = (() => {
        if (typeof source !== "string") return false;
        try {
          const url = new URL(source, window.location.origin);
          return url.hostname === "localhost" || url.hostname === "127.0.0.1";
        } catch {
          return false;
        }
      })();
      let resolvedSource = source;
      if (!shouldBypassResolution && !isCdnGh && !isLocalhostUrl) {
        resolvedSource = await resolveUrl(source, isCdnGhUrl(window.location.href));
      }

      if (typeof resolvedSource === "string" && resolvedSource.includes("static/apps/azahar")) {
        const mirrors = [
          "https://yukios.netlify.app/",
          "https://yukios.pages.dev/",
          "https://yukios.neocities.org/",
          "https://yukios.vercel.app/"
        ];

        for (const mirror of mirrors) {
          try {
            const testUrl = new URL("static/apps/azahar/index.html", mirror).href;
            const res = await fetch(testUrl, { method: "HEAD" });
            if (res.ok) {
              resolvedSource = testUrl;
              break;
            }
          } catch (e) {}
        }
      } else if (typeof resolvedSource === "string" && resolvedSource.includes("static/apps/kiwiirc")) {
        const mirrors = [
          "https://yukios.netlify.app/",
          "https://yukios.pages.dev/",
          "https://yukios.neocities.org/",
          "https://yukios.vercel.app/"
        ];

        for (const mirror of mirrors) {
          try {
            const testUrl = new URL("static/apps/kiwiirc/index.html", mirror).href;
            const res = await fetch(testUrl, { method: "HEAD" });
            if (res.ok) {
              resolvedSource = testUrl;
              break;
            }
          } catch (e) {}
        }
      } else if (isCdnGh && typeof resolvedSource === "string" && resolvedSource.startsWith("/")) {
        if (!resolvedSource.includes("localhost:4000")) {
          const repoBase = getCurrentCdnRepoBase();
          if (repoBase) {
            resolvedSource = `${repoBase}${resolvedSource}`;
          } else {
            try {
              resolvedSource = new URL(resolvedSource, window.location.href).href;
            } catch {}
          }
        }
      }

      const isSameOrigin = (() => {
        try {
          return new URL(resolvedSource).origin === window.location.origin;
        } catch {
          return false;
        }
      })();

      let iframeUrl: string;

      if (type !== "game") {
        contentHtml = `<iframe src="${resolvedSource}" ${IFRAME_ATTRS}></iframe>`;
      }

      if (type === "game") {
        const displayTitle = this.appMap[appId]?.title || originalName;
        const isGame = this.isTransparencyBlocked(appId, { type });
        const gameIcon = this.appMap[appId]?.icon || "fas fa-gamepad";
        const resolvedGameIcon = resolveIconUrl(gameIcon);
        const gameIconHtml =
          resolvedGameIcon.startsWith("fas ") ||
          resolvedGameIcon.startsWith("fab ") ||
          resolvedGameIcon.startsWith("far ")
            ? `<i class="${resolvedGameIcon}" style="margin-right:6px;font-size:16px;vertical-align:middle;"></i>`
            : `<img src="${resolvedGameIcon}" style="width:20px;height:20px;margin-right:6px;vertical-align:middle;object-fit:contain;">`;

        const win = os.window.create(
          extra.forceId || `${id}-win`,
          displayTitle,
          extra.width || "80vw",
          extra.height || "80vh",
          {
            ...extra,
            isGame,
            icon: gameIcon,
            skipHeader: true
          }
        );
        if (appId) this.appSessions.set(`${id}-win`, { appId, startTime: Date.now() });

        Object.assign(win.dataset, {
          appType: type,
          externalUrl: resolvedSource || "",
          appId: appId || "",
          swf: type === "swf" ? source : "",
          isGame,
          rom: type !== "game" && type !== "swf" ? source : "",
          core: type !== "game" && type !== "swf" ? type : ""
        });

        const overlayBtnHtml = isGame
          ? `<button class="overlay-open-btn" title="Steam Overlay (Shift+Tab)"><i class="fab fa-steam"></i></button>`
          : "";

        win.innerHTML = `
          <div class="window-header">
            <span>${gameIconHtml}${displayTitle}</span>
            <div class="window-header-actions">
              ${overlayBtnHtml}
              ${os.window.getWindowControls(resolvedSource, true)}
            </div>
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

        win.querySelector(".overlay-open-btn")?.addEventListener("click", () => {
          this.overlayController?.openForWindow(win);
        });

        win.querySelector(".external-btn")?.addEventListener("click", () => {
          window.open(resolvedSource, "blank");
        });

        if (resolvedSource.startsWith("blob:")) {
          iframeUrl = resolvedSource;
        } else if (
          looksLikeHtml(resolvedSource) &&
          /^https?:\/\//.test(resolvedSource) &&
          !isSameOrigin &&
          (isCdnGhUrl(resolvedSource) || isCdnGhUrl(window.location.href))
        ) {
          try {
            iframeUrl = await fetchHtmlAsBlobUrl(resolvedSource);
          } catch (err: any) {
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
      contentHtml!,
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

  bringToFrontIfExists(id: string): boolean {
    const el = document.getElementById(`${id}-win`);
    if (el) os.window.bringToFront(el);
    return !!el;
  }

  createIframeWindow(
    id: string,
    title: string,
    contentHtml: string,
    appId: string,
    appMeta: any,
    analyticsBase: any = null,
    externalUrl: string | null = null
  ): void {
    this.createWindow(id, title, contentHtml, externalUrl, appId, appMeta);
  }

  isTransparencyBlocked(appId: string, appMeta: any): boolean {
    return !(appMeta.type === "system" || this.TRANSPARENCY_ALLOWED_APP_IDS.has(appId));
  }

  createWindow(
    id: string,
    title: string,
    contentHtml: string,
    externalUrl: string | null = null,
    appId: string | null = null,
    appMeta: Record<string, any> = {}
  ): void {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has("game") && appId) {
      document.title = sanitizeTitle(title);
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
    const mapEntry = this.appMap[appId!];
    let icon: string =
      mapEntry?.iconValue ||
      mapEntry?.icon ||
      (appMeta.type === "swf" ? "static/icons/flash.webp" : tryGetIcon(appId || id));

    if (!icon) {
      icon = "fas fa-window-maximize";
    }

    const win = os.window.create(`${id}-win`, title, "80vw", "80vh", {
      isGame,
      icon
    });
    if (appId) this.appSessions.set(`${id}-win`, { appId, startTime: Date.now() });

    Object.assign(win.dataset, {
      appType: appMeta.type || "",
      externalUrl: externalUrl || "",
      appId: appId || "",
      swf: appMeta.swf || "",
      isGame,
      rom: appMeta.rom || "",
      core: appMeta.core || ""
    });

    const resolvedIcon = resolveIconUrl(icon);
    const iconHtml =
      resolvedIcon.startsWith("fas ") || resolvedIcon.startsWith("fab ") || resolvedIcon.startsWith("far ")
        ? `<i class="${resolvedIcon}" style="margin-right:8px;font-size:16px;"></i>`
        : `<img src="${resolvedIcon}" style="width:20px;height:20px;margin-right:8px;vertical-align:middle;object-fit:contain;">`;

    const overlayBtnHtml = isGame
      ? `<button class="overlay-open-btn" title="Steam Overlay (Shift+Tab)"><i class="fab fa-steam"></i></button>`
      : "";

    win.innerHTML = `
      <div class="window-header">
        <span>${iconHtml}${title}</span>
        <div class="window-header-actions">
          ${overlayBtnHtml}
          ${os.window.getWindowControls(externalUrl, true)}
        </div>
      </div>
      <div class="window-content" style="width:100%; height:100%; overflow:hidden;">${contentHtml}</div>
    `;

    win.querySelector(".overlay-open-btn")?.addEventListener("click", () => {
      this.overlayController?.openForWindow(win);
    });

    win.querySelector(".external-btn")?.addEventListener("click", () => {
      const url = win.dataset.externalUrl || win.querySelector("iframe")?.src || externalUrl;
      if (url) window.open(url, "blank", "noopener,noreferrer");
    });

    recordUsage(`${id}-win`);
  }
}
