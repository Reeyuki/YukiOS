const fs = require("fs");
const path = require("path");
const axios = require("axios");
const express = require("express");

module.exports = function createAssetServer(options) {
  const { resourcesPath, userStaticPath, staticFolderName, CDN_BASE, PORT, log, mainWindow } = options;

  const server = express();
  const CONCURRENT_DOWNLOADS = 10;
  const MAX_RETRIES = 10;
  let mimeTypes = null;
  try {
    mimeTypes = require("mime-types");
  } catch {}

  function ensureDirSync(dir) {
    fs.mkdirSync(dir, { recursive: true });
  }

  function isReadableFileSync(filePath) {
    try {
      const abs = path.resolve(filePath);
      const stats = fs.statSync(abs);
      if (!stats.isFile()) return null;
      fs.accessSync(abs, fs.constants.R_OK);
      return { abs, stats };
    } catch {
      return null;
    }
  }

  function setHeadersForFile(res, stats, abs) {
    if (mimeTypes) {
      const mt = mimeTypes.lookup(abs);
      if (mt) res.setHeader("Content-Type", mt);
    }
    if (stats?.size) res.setHeader("Content-Length", stats.size);
    if (stats?.mtime) res.setHeader("Last-Modified", stats.mtime.toUTCString());
  }

  function sendFile(res, filePath, tag) {
    const file = isReadableFileSync(filePath);
    if (!file) {
      log(`Cannot access file (${tag}):`, filePath);
      if (!res.headersSent) res.status(500).send("Internal Server Error");
      return false;
    }
    const { abs, stats } = file;
    setHeadersForFile(res, stats, abs);
    try {
      const data = fs.readFileSync(abs);
      res.send(data);
      return true;
    } catch (err) {
      log(`Read error (${tag}) for ${abs}:`, err?.message || err);
      if (!res.headersSent) res.status(500).send("Internal Server Error");
      return false;
    }
  }

  async function fetchRemoteMetadata() {
    try {
      const res = await axios.get(`${CDN_BASE}/static/metadata.json`, { timeout: 15000 });
      return res.data;
    } catch (err) {
      log("Failed to fetch remote metadata:", err?.message || err);
      return null;
    }
  }

  async function downloadFile(localFile, cdnPath, retries = MAX_RETRIES) {
    const cdnUrl = `${CDN_BASE}/static/${cdnPath}`;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        ensureDirSync(path.dirname(localFile));
        const response = await axios.get(cdnUrl, { responseType: "arraybuffer", timeout: 30000 });
        fs.writeFileSync(localFile, response.data);
        log("Downloaded:", cdnPath);
        return true;
      } catch (err) {
        if (err?.response?.status === 404) {
          log(`File not found (404): ${cdnPath}`);
          return false;
        }
        if (attempt === retries) throw err;
        log(`Download attempt ${attempt + 1} failed for ${cdnPath}, retrying...`);
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }

  async function downloadWithConcurrency(tasks, concurrency) {
    const results = [];
    const executing = [];
    for (const task of tasks) {
      const p = task().then((res) => {
        const i = executing.indexOf(p);
        if (i > -1) executing.splice(i, 1);
        return res;
      });
      results.push(p);
      executing.push(p);
      if (executing.length >= concurrency) await Promise.race(executing);
    }
    return Promise.allSettled(results);
  }

  async function predownloadAssets() {
    log("Starting predownloadAssets...");
    const metadata = await fetchRemoteMetadata();
    if (!metadata?.files) {
      mainWindow?.webContents.send("asset-sync", { done: true });
      return;
    }

    const totalFiles = Object.keys(metadata.files).length;
    log(`Metadata loaded with ${totalFiles} total files`);
    ensureDirSync(userStaticPath);
    try {
      fs.writeFileSync(path.join(userStaticPath, "metadata.json"), JSON.stringify(metadata, null, 2));
    } catch (e) {
      log("Failed to write metadata.json:", e?.message || e);
    }

    const downloadTasks = [];
    const tasksInfo = [];
    for (const [key, entry] of Object.entries(metadata.files)) {
      if (key.startsWith("gtavc/")) continue;
      const bundled = path.join(resourcesPath, staticFolderName, key);
      const cached = path.join(userStaticPath, key);
      if (isReadableFileSync(bundled) || isReadableFileSync(cached)) continue;
      tasksInfo.push(key);
      downloadTasks.push(async () => {
        try {
          await downloadFile(cached, entry.path || key);
          return { success: true, key };
        } catch (err) {
          log("Pre-download failed:", key, err?.message || err);
          return { success: false, key };
        }
      });
    }

    const total = downloadTasks.length;
    if (total === 0) {
      mainWindow?.webContents.send("asset-sync", { done: true });
      return;
    }

    let completed = 0;
    const wrapped = downloadTasks.map((task, idx) => async () => {
      const result = await task();
      completed++;
      mainWindow?.webContents.send("asset-sync", { file: tasksInfo[idx], progress: (completed / total) * 100 });
      return result;
    });

    await downloadWithConcurrency(wrapped, CONCURRENT_DOWNLOADS);
    mainWindow?.webContents.send("asset-sync", { done: true });
    log("Pre-download completed");
  }

  async function handleAssetRequest(req, res) {
    try {
      let requested = decodeURIComponent(req.path || "");
      if (requested.startsWith(`/${staticFolderName}/`)) requested = requested.slice(staticFolderName.length + 2);
      else if (requested.startsWith("/")) requested = requested.slice(1);

      const bundled = path.join(resourcesPath, staticFolderName, requested);
      if (isReadableFileSync(bundled)) {
        sendFile(res, bundled, "bundle");
        return;
      }

      const cached = path.join(userStaticPath, requested);
      if (isReadableFileSync(cached)) {
        sendFile(res, cached, "cache");
        return;
      }

      const metadataFile = path.join(userStaticPath, "metadata.json");
      let metadata = null;
      if (fs.existsSync(metadataFile))
        try {
          metadata = JSON.parse(fs.readFileSync(metadataFile, "utf-8"));
        } catch {
          metadata = null;
        }

      const entry = metadata?.files?.[requested];
      if (entry) {
        try {
          await downloadFile(cached, entry.path || requested);
          sendFile(res, cached, "downloaded");
        } catch {
          res.status(500).send("Failed to fetch asset");
        }
        return;
      }

      const fallback = path.join(resourcesPath, "desktop", path.basename(requested));
      if (isReadableFileSync(fallback)) {
        sendFile(res, fallback, "fallback");
        return;
      }

      res.status(404).send("Not found");
    } catch (err) {
      log("Asset error:", err?.message || err);
      if (!res.headersSent) res.status(500).send("Internal Server Error");
    }
  }

  server.use(`/${staticFolderName}`, handleAssetRequest);
  server.use(`/${staticFolderName}`, express.static(userStaticPath));
  server.use(`/${staticFolderName}`, express.static(path.join(resourcesPath, staticFolderName)));
  server.use("/desktop", express.static(path.join(resourcesPath, "desktop")));
  server.use("/assets", express.static(path.join(resourcesPath, "desktop")));

  server.use(async (req, res) => {
    try {
      const requested = decodeURIComponent(req.path || "");
      const direct = path.join(resourcesPath, requested);
      if (isReadableFileSync(direct)) {
        sendFile(res, direct, "direct");
        return;
      }

      const fallback = path.join(resourcesPath, "desktop", path.basename(requested));
      if (isReadableFileSync(fallback)) {
        sendFile(res, fallback, "fallback");
        return;
      }

      res.status(404).send("Not found");
    } catch (err) {
      log("Fallback handler error:", err?.message || err);
      if (!res.headersSent) res.status(500).send("Internal Server Error");
    }
  });

  server.use((err, req, res, next) => {
    try {
      log(`Express error for ${req.method} ${req.path}:`, err?.message || err);
      if (!res.headersSent) res.status(err?.status || 500).send(err?.message || "Internal Server Error");
    } catch {
      if (!res.headersSent) res.status(500).send("Internal Server Error");
    }
  });

  server.listen(PORT, () => log("Asset server running at http://localhost:" + PORT));

  return { server, predownloadAssets };
};
