const { app, BrowserWindow, ipcMain, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const express = require("express");
const axios = require("axios");

let mainWindow;
const PORT = 6767;
const CDN_BASE = "https://reeyuki.netlify.app";
let resourcesPath;
const staticFolderName = "static";
let userStaticPath;
const DEBUG = !app.isPackaged;

function getResourcesPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "app.asar", "resources")
    : path.join(__dirname, "resources");
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 500,
    minWidth: 400,
    minHeight: 200,
    center: true,
    fullscreen: false,
    alwaysOnTop: false,
    resizable: true,
    title: "yukios",
    frame: true,
    autoHideMenuBar: true,
    menuBarVisible: false,
    icon: path.join(resourcesPath, "icons/icon-256.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  Menu.setApplicationMenu(null);
  mainWindow.loadURL(`http://localhost:${PORT}/index.html`);

  if (DEBUG) mainWindow.webContents.openDevTools();
}

async function ensureFile(localFile, cdnPath) {
  if (!fs.existsSync(localFile)) {
    const dir = path.dirname(localFile);
    fs.mkdirSync(dir, { recursive: true });
    const cdnUrl = `${CDN_BASE}/static/${cdnPath}`;
    try {
      const response = await axios.get(cdnUrl, { responseType: "arraybuffer" });
      fs.writeFileSync(localFile, response.data);
    } catch (err) {
      console.error("Failed to download", cdnUrl, err.message);
    }
  }
}
async function fetchRemoteMetadata() {
  try {
    const url = `${CDN_BASE}/static/metadata.json`;
    const response = await axios.get(url);
    return response.data;
  } catch (err) {
    console.error("Failed to fetch remote metadata:", err.message);
    return null;
  }
}


async function downloadUpdatedAssets() {
  const localMetadataFile = path.join(resourcesPath, staticFolderName, "metadata.json");
  let localVersion = "0.0.0";

  if (fs.existsSync(localMetadataFile)) {
    try {
      const raw = fs.readFileSync(localMetadataFile, "utf-8");
      const metadata = JSON.parse(raw);
      localVersion = metadata.version || "0.0.0";
    } catch {}
  }

  const remoteMetadata = await fetchRemoteMetadata();
  if (!remoteMetadata) return;

  const remoteVersion = remoteMetadata.version || "0.0.0";
  if (remoteVersion === localVersion) return;

  const files = remoteMetadata.files || {};
  const total = Object.keys(files).length;
  let count = 0;

  for (const [key, entry] of Object.entries(files)) {
    const cachedFile = path.join(userStaticPath, key);
    const bundledFile = path.join(resourcesPath, staticFolderName, key);
    if (fs.existsSync(bundledFile) || fs.existsSync(cachedFile)) {
      count++;
      mainWindow?.webContents.send("asset-sync", { file: key, progress: (count / total) * 100 });
      continue;
    }

    await ensureFile(cachedFile, entry.path || key);
    count++;
    mainWindow?.webContents.send("asset-sync", { file: key, progress: (count / total) * 100 });
  }

  const localMetadataPath = path.join(userStaticPath, "metadata.json");
  fs.writeFileSync(localMetadataPath, JSON.stringify(remoteMetadata, null, 2));
  mainWindow?.webContents.send("asset-sync", { done: true });
}


async function preloadStaticFiles(req, res, next) {
  const metadataFile = path.join(resourcesPath, staticFolderName, "metadata.json");
  if (!fs.existsSync(metadataFile)) return next();

  try {
    const metadataRaw = fs.readFileSync(metadataFile, "utf-8");
    const metadata = JSON.parse(metadataRaw);

    let requested = decodeURIComponent(req.path).replace(/^\/+/, "");
    if (requested.startsWith(`${staticFolderName}/`)) requested = requested.slice(`${staticFolderName}/`.length);
    if (!requested) return next();

    const entry = metadata.files && metadata.files[requested];
    if (!entry) return next();

    const bundledFile = path.join(resourcesPath, staticFolderName, requested);
    if (fs.existsSync(bundledFile)) return next();

    const cachedFile = path.join(userStaticPath, requested);
    await ensureFile(cachedFile, entry.path || requested);
  } catch (err) {
    console.error(err);
  }

  next();
}

function startServer() {
  const server = express();

  server.use(preloadStaticFiles);
  server.use(`/${staticFolderName}`, express.static(userStaticPath));
  server.use(`/${staticFolderName}`, express.static(path.join(resourcesPath, staticFolderName)));

  server.use("/desktop", express.static(path.join(resourcesPath, "desktop")));
  server.use("/assets", express.static(path.join(resourcesPath, "desktop")));

  server.use((req, res) => {
    const requested = decodeURIComponent(req.path);
    const candidate = path.join(resourcesPath, requested);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return res.sendFile(candidate);

    const alt = path.join(resourcesPath, "desktop", path.basename(requested));
    if (fs.existsSync(alt) && fs.statSync(alt).isFile()) return res.sendFile(alt);

    console.error("serve: 404 for", req.method, req.path, "candidate:", candidate);
    res.status(404).send("Not found");
  });

  server.listen(PORT, () => {
    console.log("Local server running at http://localhost:" + PORT);
  });
}

app.whenReady().then(() => {
  resourcesPath = getResourcesPath();
  userStaticPath = path.join(app.getPath("userData"), staticFolderName);
  if (!fs.existsSync(userStaticPath)) fs.mkdirSync(userStaticPath, { recursive: true });

  downloadUpdatedAssets().catch(err => console.error("Background asset update failed:", err));

  startServer();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});


app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("read-global-variable", (event, key) => {
  const globals = { TEST1: "Hello", TEST2: [2, 4, 5], TEST3: { value1: 10, value2: {} } };
  return globals[key] || null;
});
