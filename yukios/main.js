const { app, BrowserWindow, ipcMain, Menu, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { autoUpdater } = require("electron-updater");
const createAssetServer = require("./assetServer");

const PORT = 6767;
const CDN_BASE = "https://reeyuki.netlify.app";
const staticFolderName = "static";
const DEBUG = !app.isPackaged;

let mainWindow;
let resourcesPath;
let userStaticPath;
let assetServer;
let appStartTime = Date.now();

const logFile = path.join(app.getPath("userData"), "electron-debug.log");
const logStream = fs.createWriteStream(logFile, { flags: "a" });

function log(...args) {
  const line = args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ");
  console.log(line);
  logStream.write(line + "\n");
}

function getResourcesPath() {
  return app.isPackaged ? path.join(process.resourcesPath, "app.asar", "resources") : path.join(__dirname, "resources");
}

let lastAnalyticsTime = 0;
const ANALYTICS_THROTTLE_MS = 500;

function sendAnalytics(data) {
  const now = Date.now();
  if (!app.isPackaged) {
    return;
  }

  if (now - lastAnalyticsTime < ANALYTICS_THROTTLE_MS) {
    return;
  }

  lastAnalyticsTime = now;

  const https = require("https");
  const payload = JSON.stringify(data);

  const options = {
    hostname: "analytics.liventcord-a60.workers.dev",
    path: "/analytics",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload)
    }
  };

  const req = https.request(options, (res) => {
    log(`Analytics sent: ${res.statusCode}`);
  });

  req.on("error", (err) => {
    log("Analytics error:", err.message);
  });

  req.write(payload);
  req.end();
}

function getAnalyticsBase(appName) {
  const now = Date.now();
  const sessionAgeMs = now - appStartTime;
  return {
    app: appName,
    timestamp: now,
    sessionAgeMs
  };
}

function trackAppStart() {
  const analyticsBase = getAnalyticsBase("yukios-desktop");
  sendAnalytics({
    ...analyticsBase,
    event: "start"
  });
}

function trackGameLaunch(gameId) {
  const analyticsBase = getAnalyticsBase(`game-${gameId}`);
  sendAnalytics({
    ...analyticsBase,
    event: "start",
    gameId
  });
}

function trackAppClose() {
  const analyticsBase = getAnalyticsBase("yukios-desktop");
  sendAnalytics({
    ...analyticsBase,
    event: "close"
  });
}

function createWindow(url, title, width, height, isGame = false, gameId = null) {
  const win = new BrowserWindow({
    width,
    height,
    minWidth: 400,
    minHeight: 200,
    resizable: true,
    title,
    autoHideMenuBar: true,
    icon: path.join(resourcesPath, "icons/icon-256.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  Menu.setApplicationMenu(null);
  win.loadURL(url);
  if (DEBUG) win.webContents.openDevTools();

  win.on("close", async (e) => {
    if (assetServer) {
      e.preventDefault();
      log(`Window closing: ${title}`);

      if (isGame && gameId) {
        const analyticsBase = getAnalyticsBase(`game-${gameId}`);
        sendAnalytics({
          ...analyticsBase,
          event: "close",
          gameId
        });
      }

      win.destroy();
    }
  });

  return win;
}

function launchGameWindow(gameId) {
  const url = `http://localhost:${PORT}/index.html?game=${encodeURIComponent(gameId)}`;
  trackGameLaunch(gameId);
  if (gameId === "TMNP") {
    handleTMNP(gameId);
    return;
  }
  return createWindow(url, gameId, 1440, 900, true, gameId);
}

function handleTMNP() {
  const { spawn } = require("child_process");
  const path = require("path");
  const fs = require("fs");

  const exeName = "TeenageMutantNinjaPuppets.exe";
  const exePath = path.join(userStaticPath, "games", "TMNP", exeName);

  if (!fs.existsSync(exePath)) {
    console.error("Executable not found:", exePath);
  }

  let child;
  if (process.platform === "win32") {
    child = spawn(exePath, [], { detached: true, stdio: "ignore" });
  } else if (process.platform === "linux") {
    child = spawn("wine", [exePath], { detached: true, stdio: "ignore" });
  } else {
    console.error("Unsupported platform:", process.platform);
  }
}

function ensureGameShortcut(gameId) {
  if (!app.isPackaged) return;
  console.log("Registering game shortcut for: ", gameId);

  if (process.platform === "win32") {
    const dir = path.join(app.getPath("desktop"), "YukiOS Games");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const shortcutPath = path.join(dir, `${gameId}.lnk`);
    if (fs.existsSync(shortcutPath)) return;

    shell.writeShortcutLink(shortcutPath, {
      target: process.execPath,
      args: `--game=${gameId}`,
      description: `YukiOS Game: ${gameId}`,
      icon: process.execPath
    });
    return;
  }

  if (process.platform === "linux") {
    const dir = path.join(app.getPath("home"), ".local", "share", "applications");

    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const shortcutPath = path.join(dir, `yukios-${gameId}.desktop`);
    if (fs.existsSync(shortcutPath)) return;
    function camelToHuman(str) {
      return str
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/_/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^./, (c) => c.toUpperCase());
    }

    const content = `
      [Desktop Entry]
      Type=Application
      Version=1.0
      Name=${camelToHuman(gameId)}
      Comment=YukiOS Game
      Exec=${process.execPath} --game=${gameId}
      Icon=${process.execPath}
      Terminal=false
      Categories=Game;YukiOS;
      StartupWMClass=${gameId}
    `.trim();

    fs.writeFileSync(shortcutPath, content);
    fs.chmodSync(shortcutPath, 0o755);
    return;
  }

  if (process.platform === "darwin") {
    const dir = path.join(app.getPath("home"), "Applications", "webOS Games");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const shortcutPath = path.join(dir, `${gameId}.app`);
    if (fs.existsSync(shortcutPath)) return;

    shell.writeShortcutLink(shortcutPath, {
      target: process.execPath,
      args: `--game=${gameId}`
    });
  }
}

ipcMain.handle("launch-game", (event, gameId) => {
  log("IPC launch-game:", gameId);
  ensureGameShortcut(gameId);
  launchGameWindow(gameId);
});

ipcMain.handle("read-global-variable", (event, key) => {
  const globals = {
    TEST1: "Hello",
    TEST2: [2, 4, 5],
    TEST3: { value1: 10, value2: {} }
  };
  return globals[key] || null;
});

autoUpdater.autoDownload = true;

autoUpdater.on("update-available", () => {
  console.log("Update available. Downloading...");
});

autoUpdater.on("update-downloaded", () => {
  const response = dialog.showMessageBoxSync({
    type: "info",
    buttons: ["Restart", "Later"],
    title: "Update Ready",
    message: "A new version has been downloaded. Restart to apply the update?"
  });
  if (response === 0) {
    autoUpdater.quitAndInstall();
  }
});

app.whenReady().then(async () => {
  autoUpdater.checkForUpdatesAndNotify();

  resourcesPath = getResourcesPath();
  userStaticPath = path.join(app.getPath("userData"), staticFolderName);
  if (!fs.existsSync(userStaticPath)) fs.mkdirSync(userStaticPath, { recursive: true });

  const gameArg = process.argv.find((a) => a.startsWith("--game="));
  const gameId = gameArg ? gameArg.split("=")[1] : null;

  trackAppStart();

  if (gameId) {
    trackGameLaunch(gameId);
  }

  mainWindow = createWindow(
    `http://localhost:${PORT}/index.html${gameId ? "?game=" + encodeURIComponent(gameId) : ""}`,
    gameId || "yukios",
    gameId ? 1440 : 1200,
    gameId ? 900 : 800,
    !!gameId,
    gameId
  );

  assetServer = createAssetServer({
    resourcesPath,
    userStaticPath,
    staticFolderName,
    CDN_BASE,
    PORT,
    log,
    mainWindow
  });

  mainWindow.webContents.on("did-finish-load", () => {
    assetServer.predownloadAssets().catch((err) => log(err));
  });
});

app.on("window-all-closed", async () => {
  if (process.platform !== "darwin") {
    trackAppClose();
    app.quit();
  }
});

app.on("before-quit", async (e) => {
  if (assetServer) {
    e.preventDefault();
    trackAppClose();
    app.quit();
  }
});
