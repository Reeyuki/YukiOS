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

    this.appMap = {
      return: { type: "system", action: () => (window.location.href = "/") },
      explorer: { type: "system", action: () => this.explorerApp.open() },
      computer: { type: "system", action: () => this.explorerApp.open() },
      terminal: { type: "system", action: () => this.terminalApp.open() },
      notepad: { type: "system", action: () => this.notepadApp.open() },
      browser: { type: "system", action: () => this.browserApp.open() },
      cameraApp: { type: "system", action: () => this.cameraApp.open() },
      music: { type: "system", action: () => this.musicPlayer.open(this.wm) },
      photopea: { type: "game", url: "https://www.photopea.com" },
      sonic: { type: "swf", swf: "/static/games/swfGames/sonic.swf" },
      flight: { type: "swf", swf: "/static/games/swfGames/flight.swf" },
      swarmQueen: { type: "swf", swf: "/static/games/swfGames/swarmQueen.swf" },
      paint: { type: "game", url: "https://paint.js.org/" },
      pacman: { type: "game", url: "https://pacman-e281c.firebaseapp.com" },
      pvz: { type: "game", url: "https://emupedia.net/emupedia-game-pvz" },
      pvzHybrid: {
        type: "remote",
        url: "https://www.miniplay.com/embed/plants-vs-zombies-hybrid-story"
      },
      tetris: { type: "game", url: "https://turbowarp.org/embed.html?autoplay#31651654" },
      roads: { type: "game", url: "https://slowroads.io" },
      vscode: { type: "game", url: "https://emupedia.net/emupedia-app-vscode" },
      isaac: { type: "game", url: "https://emupedia.net/emupedia-game-binding-of-isaac" },
      mario: { type: "game", url: "https://emupedia.net/emupedia-game-mario" },
      papaGames: { type: "game", url: "https://papasgamesfree.io" },
      zombieTd: { type: "swf", swf: "/static/games/swfGames/zombietd.swf" },
      zombotron: { type: "swf", swf: "/static/games/zombotron/zombotron.swf" },
      zombotron2: { type: "swf", swf: "/static/games/zombotron/zombotron2.swf" },
      zombotron2Time: { type: "game", url: "/static/rfiv.html?game=zombotron" },
      breach: { type: "swf", swf: "/static/games/swfGames/breach.swf" },
      fancyPants: { type: "swf", swf: "/static/games/swfGames/fancypantsadventure.swf" },
      fancyPants2: { type: "swf", swf: "/static/games/swfGames/fancypantsadventure2.swf" },
      fancyPants3: { type: "swf", swf: "/static/games/swfGames/fancypantsadventure3.swf" },
      strikeForce: {
        type: "swf",
        swf: "https://cache.armorgames.com/files/games/strikeforce-kitty-16008.swf?v=1404201513"
      },
      strikeForce2: {
        type: "swf",
        swf: "https://cache.armorgames.com/files/games/strikeforce-kitty-2-17643.swf?v=1423725280"
      },
      baloonsTd5: { type: "swf", swf: "/static/games/swfGames/baloonstd5.swf" },
      trinitas: { type: "game", url: "/static/games/trinitas" },
      jojo: {
        type: "game",
        url: "https://www.retrogames.cc/embed/8843-jojos-bizarre-adventure%3A-heritage-for-the-future-jojo-no-kimyou-na-bouken%3A-mirai-e-no-isan-japan-990927-no-cd.html"
      },
      gtaVc: { type: "game", url: "/static/vciframe.html" },
      subwaySurfers: {
        type: "game",
        url: "https://g.igroutka.ru/games/164/Xm2W5MIcPqrF1Y90/12/subway_surfers_easter_edinburgh"
      },
      mutantFighting: {
        type: "swf",
        swf: "https://cache.armorgames.com/files/games/mutant-fighting-cup-14425.swf?v=1373587528"
      },
      mutantFighting2: { type: "swf", swf: "/static/games/swfGames/mutantfightingcup2.swf" },
      finnAndBones: { type: "game", url: "/static/flashpointarchive.html?fpGameName=finnAndBones" },
      obama: { type: "game", url: "/static/flashpointarchive.html?fpGameName=obama-alien-defense" },
      intrusion2: { type: "swf", swf: "/static/games/swfGames/intrusion2.swf" },
      dan: { type: "game", url: "https://www.silvergames.com/en/dan-the-man/gameframe" },
      infectonator: { type: "swf", swf: "https://cache.armorgames.com/files/games/infectonator-5020.swf?v=1373587522" },
      infectonator2: {
        type: "swf",
        swf: "https://cache.armorgames.com/files/games/infectonator-2-13150.swf?v=1373587527"
      },
      newyorkShark: {
        type: "swf",
        swf: "https://cache.armorgames.com/files/games/new-york-shark-12969.swf?v=1373587527"
      },
      swordsSouls: { type: "swf", swf: "https://cache.armorgames.com/files/games/swordssouls-17817.swf?v=1464609285" },
      corporationInc: {
        type: "swf",
        swf: "https://cache.armorgames.com/files/games/corporation-inc-7348.swf?v=1373587524"
      },
      aground: { type: "game", url: "https://cache.armorgames.com/files/games/aground-18245/index.html?v=1591832301" },
      mobyDick: {
        type: "swf",
        swf: "https://cache.armorgames.com/files/games/moby-dick-the-video--7199.swf?v=1373587524"
      },
      mobyDick2: { type: "swf", swf: "https://cache.armorgames.com/files/games/moby-dick-2-12662.swf?v=1373587526" },
      elfStory: { type: "swf", swf: "https://cache.armorgames.com/files/games/elf-story-14680.swf?v=1373587528" },
      frogDares: { type: "swf", swf: "https://cache.armorgames.com/files/games/frog-dares-12672.swf?v=1373587526" },
      kamikazePigs: {
        type: "swf",
        swf: "https://cache.armorgames.com/files/games/kamikaze-pigs-13545.swf?v=1373587527"
      },
      icyFishes: { type: "swf", swf: "https://cache.armorgames.com/files/games/icy-fishes-12977.swf?v=1373587527" },

      feedUs6: {
        type: "swf",
        swf: "/static/games/swfGames/feeduslostisland.swf"
      },
      superrobotwar: {
        type: "game",
        url: "/static/flashpointarchive.html?fpGameName=super-robot-war"
      },
      feedUsPirates: {
        type: "swf",
        swf: "/static/games/swfGames/feeduspirates.swf"
      },
      epicbossfighter2: { type: "swf", swf: "/static/games/swfGames/EpicBossFighter2.swf" },
      avatarFortressFight2: { type: "swf", swf: "/static/games/swfGames/avatarFortressFight2.swf" },
      incredibles: { type: "swf", swf: "/static/games/swfGames/incredibles.swf" },
      cactusMcCoy: { type: "game", url: "https://papasgamesfree.io/cactus-mccoy-1" },
      jackSmith: { type: "game", url: "https://papasgamesfree.io/jacksmith" },
      pokemonRed: { type: "gba", url: "pokemon-red.gba" },
      pokemonEmerald: { type: "gba", url: "pokemon-emerald.gba" },
      pokemonPlatinum: { type: "nds", url: "pokemon-platinum.nds" },
      pokemonHeartgold: { type: "nds", url: "pokemon-heartgold.nds" },
      pokemonWhite: { type: "nds", url: "pokemon-white.nds" },
      pokemonWhite2: { type: "nds", url: "pokemon-white-2.zip" },
      minecraft: { type: "remote", url: "https://eaglercraft.com/play" },
      liventcord: { type: "game", url: "https://liventcord.github.io" },
      fnaf: { type: "game", url: "/static/games/fnaf" },
      geometryDash: { type: "game", url: "https://emupedia.net/emupedia-game-geometry-dash" },
      cutTheRope: { type: "game", url: "https://emupedia.net/emupedia-game-cut-the-rope2" },
      game2048: { type: "game", url: "https://emupedia.net/emupedia-game-2048" },
      pinball: { type: "game", url: "https://emupedia.net/emupedia-game-space-cadet-pinball" },
      flappyBird: { type: "game", url: "https://emupedia.net/emupedia-game-flappy-bird" },
      jetpack: { type: "game", url: "https://emupedia.net/emupedia-game-jetpack-joyride" },
      happyWheels: { type: "game", url: "https://emupedia.net/emupedia-game-happy-wheels/flash" }
    };

    populateStartMenu(this);
  }

  launch(app) {
    const info = this.appMap[app];
    if (!info) {
      console.error(`App ${app} not found.`);
      return;
    }
    console.log("Starting app : ", app);
    const analyticsBase = this._getAnalyticsBase(app);
    this.sendAnalytics({ ...analyticsBase, event: "launch" });

    const handleApp = {
      system: () => info.action(),
      swf: () => this.openRuffleApp(app, info.swf, analyticsBase),
      gba: () => this.openEmulatorApp(app, info.url, "gba", analyticsBase),
      nds: () => this.openEmulatorApp(app, info.url, "nds", analyticsBase),
      game: () => this.openGameApp(app, info.url, analyticsBase),
      html: () => this.openHtmlApp(app, info.html, analyticsBase, info),
      remote: () => this.openRemoteApp(info.url)
    };

    handleApp[info.type]?.();
  }

  _getAnalyticsBase(app) {
    let gpu = "Unknown";
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      if (gl) {
        const debugInfo = RENDERER || gl.getExtension("WEBGL_debug_renderer_info");
        gpu = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      }
    } catch {}

    const elapsedMs = Date.now() - this.pageLoadTime;
    const hours = Math.floor(elapsedMs / 3600000);
    const minutes = Math.floor((elapsedMs % 3600000) / 60000);
    const uptimeStr = `${hours}h, ${minutes}m`;
    const isBrave =
      /Brave\//.test(navigator.userAgent) ||
      (window.navigator.brave && typeof window.navigator.brave.isBrave === "function");

    return {
      app,
      timestamp: Date.now(),
      browser: {
        userAgent: navigator.userAgent,
        isBrave,
        language: navigator.language,
        platform: navigator.platform,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        uptime: uptimeStr,
        gpu,
        ram: navigator.deviceMemory ? `${navigator.deviceMemory} GB` : "Unknown",
        cpuCores: navigator.hardwareConcurrency || "Unknown",
        dnt: navigator.doNotTrack === "1" || window.doNotTrack === "1" ? "Enabled" : "Disabled"
      }
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

  openRuffleApp(gameName, swfPath) {
    if (!swfPath) return;

    const foundName = document.querySelector(`[data-app="${gameName}"] div`);
    if (foundName) gameName = foundName.textContent;

    const id = swfPath.replace(/[^a-zA-Z0-9]/g, "");
    if (document.getElementById(`${id}-win`)) {
      this.wm.bringToFront(document.getElementById(`${id}-win`));
      return;
    }

    const content = `<embed src="${swfPath}" width="100%" height="100%">`;
    this.createWindow(id, gameName.toUpperCase(), content, null, gameName, {
      type: "swf",
      swf: swfPath
    });
  }

  openEmulatorApp(gameName, romName, core) {
    const foundName = document.querySelector(`[data-app="${gameName}"] div`);
    if (foundName) gameName = foundName.textContent;

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

  openGameApp(gameName, url) {
    const foundName = document.querySelector(`[data-app="${gameName}"] div`);
    if (foundName) gameName = foundName.textContent;
    if (document.getElementById(`${gameName}-win`)) {
      this.wm.bringToFront(document.getElementById(`${gameName}-win`));
      return;
    }

    const content = `<iframe src="${url}" style="width:100%; height:100%; border:none;" allow="autoplay; fullscreen; clipboard-write; encrypted-media; picture-in-picture" sandbox="allow-forms allow-downloads allow-modals allow-pointer-lock allow-popups allow-same-origin allow-scripts allow-top-navigation-by-user-activation"></iframe>`;
    const formattedName = gameName.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase());
    this.createWindow(gameName, formattedName, content, url, gameName, {
      type: "game"
    });
  }
  isTransparencyBlocked(appId, appMeta) {
    if (appMeta.type === "system") return false;
    if (this.TRANSPARENCY_ALLOWED_APP_IDS.has(appId)) return false;
    return true;
  }

  createWindow(id, title, contentHtml, externalUrl = null, appId = null, appMeta = {}) {
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
          ${externalUrl ? `<button class="external-btn" title="Open in External">↗</button>` : ""}
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
    this.wm.bringToFront(document.getElementById(`${id}-win`));

    if (externalUrl) {
      win.querySelector(".external-btn").addEventListener("click", () => this.openRemoteApp(externalUrl));
    }

    const icon = tryGetIcon(appId || id);
    this.wm.addToTaskbar(win.id, title, icon);
    this.recordUsage(`${id}-win`);
  }
}

function tryGetIcon(id) {
  try {
    const div = document.querySelector(`#desktop div[data-app="${id}"]`);
    return div?.querySelector("img")?.src || null;
  } catch (e) {
    return null;
  }
}

// --- Populate Start Menu ---
function populateStartMenu(appLauncher) {
  const pageMap = {
    system: document.querySelector('.kde-page[data-page="system"]'),
    apps: document.querySelector('.kde-page[data-page="apps"]'),
    games: document.querySelector('.kde-page[data-page="games"]'),
    favorites: document.querySelector('.kde-page[data-page="favorites"]')
  };

  ["system", "apps", "games"].forEach((cat) => {
    if (pageMap[cat]) pageMap[cat].innerHTML = "";
  });

  Object.entries(appLauncher.appMap).forEach(([appName, appData]) => {
    const item = document.createElement("div");
    item.classList.add("kde-item");
    item.dataset.app = appName;
    const label = appName.charAt(0).toUpperCase() + appName.slice(1);
    item.textContent = label;
    item.addEventListener("click", () => appLauncher.launch(appName));

    if (appData.type === "system") pageMap.system?.appendChild(item);
    else if (appData.type === "game" || appData.type === "swf") pageMap.games?.appendChild(item);
    else pageMap.apps?.appendChild(item);
  });
}
