const fs = require("fs");
const path = require("path");
const axios = require("axios");
const express = require("express");

module.exports = function createAssetServer(options) {
  const {
    resourcesPath,
    userStaticPath,
    staticFolderName,
    CDN_BASE,
    PORT,
    log,
    mainWindow
  } = options;

  const server = express();
  const CONCURRENT_DOWNLOADS = 10;
  const MAX_RETRIES = 3;

  async function fetchRemoteMetadata() {
    try {
      const res = await axios.get(`${CDN_BASE}/static/metadata.json`);
      return res.data;
    } catch (err) {
      log("Failed to fetch remote metadata:", err.message);
      return null;
    }
  }

  async function downloadFile(localFile, cdnPath, retries = MAX_RETRIES) {
    const cdnUrl = `${CDN_BASE}/static/${cdnPath}`;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        fs.mkdirSync(path.dirname(localFile), { recursive: true });
        const response = await axios.get(cdnUrl, { responseType: "stream" });
        const writer = fs.createWriteStream(localFile);
        
        await new Promise((resolve, reject) => {
          response.data.pipe(writer);
          response.data.on("error", reject);
          writer.on("finish", resolve);
          writer.on("error", reject);
        });
        
        return true;
      } catch (err) {
        if (attempt === retries) {
          throw err;
        }
        log(`Download attempt ${attempt + 1} failed for ${cdnPath}, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  async function downloadWithConcurrency(tasks, concurrency) {
    const results = [];
    const executing = [];

    for (const task of tasks) {
      const promise = task().then(result => {
        executing.splice(executing.indexOf(promise), 1);
        return result;
      });

      results.push(promise);
      executing.push(promise);

      if (executing.length >= concurrency) {
        await Promise.race(executing);
      }
    }

    return Promise.allSettled(results);
  }

  async function predownloadAssets() {
    log("Starting predownloadAssets...");
    
    const metadata = await fetchRemoteMetadata();
    if (!metadata || !metadata.files) {
      log("No metadata or files found");
      mainWindow?.webContents.send("asset-sync", { done: true });
      return;
    }

    log(`Metadata loaded with ${Object.keys(metadata.files).length} total files`);

    fs.mkdirSync(userStaticPath, { recursive: true });
    fs.writeFileSync(path.join(userStaticPath, "metadata.json"), JSON.stringify(metadata, null, 2));

    const downloadTasks = [];
    const tasksInfo = [];

    for (const [key, entry] of Object.entries(metadata.files)) {
      if (key.startsWith("gtavc/")) {
        log(`Skipping gtavc file from preload: ${key}`);
        continue;
      }

      const bundled = path.join(resourcesPath, staticFolderName, key);
      if (fs.existsSync(bundled)) {
        log(`File exists in bundle: ${key}`);
        continue;
      }

      const cached = path.join(userStaticPath, key);
      if (fs.existsSync(cached)) {
        log(`File exists in cache: ${key}`);
        continue;
      }

      tasksInfo.push(key);
      downloadTasks.push(async () => {
        try {
          log("Pre-downloading asset:", key);
          await downloadFile(cached, entry.path || key);
          log("Successfully downloaded:", key);
          return { success: true, key };
        } catch (err) {
          log("Pre-download failed:", key, err.message);
          return { success: false, key };
        }
      });
    }

    log(`Found ${downloadTasks.length} files to download`);

    if (downloadTasks.length === 0) {
      log("No assets need downloading, sending done signal");
      mainWindow?.webContents.send("asset-sync", { done: true });
      return;
    }

    log(`Starting concurrent download of ${downloadTasks.length} assets...`);
    
    const total = downloadTasks.length;
    let completed = 0;

    const wrappedTasks = downloadTasks.map((task, index) => async () => {
      const result = await task();
      completed++;
      const key = tasksInfo[index];
      
      log(`Progress: ${completed}/${total} (${((completed / total) * 100).toFixed(1)}%)`);
      
      mainWindow?.webContents.send("asset-sync", { 
        file: key, 
        progress: (completed / total) * 100 
      });
      
      return result;
    });

    await downloadWithConcurrency(wrappedTasks, CONCURRENT_DOWNLOADS);
    
    log("All downloads complete, sending done signal");
    mainWindow?.webContents.send("asset-sync", { done: true });
    log("Pre-download completed");
  }

  async function streamAndCacheFile(res, localFile, cdnPath) {
    const cdnUrl = `${CDN_BASE}/static/${cdnPath}`;
    
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        fs.mkdirSync(path.dirname(localFile), { recursive: true });
        const response = await axios.get(cdnUrl, { responseType: "stream" });
        
        if (response.headers["content-type"]) {
          res.setHeader("Content-Type", response.headers["content-type"]);
        }
        if (response.headers["content-length"]) {
          res.setHeader("Content-Length", response.headers["content-length"]);
        }
        
        const fileStream = fs.createWriteStream(localFile);
        
        await new Promise((resolve, reject) => {
          let responseEnded = false;
          let fileEnded = false;
          
          const checkBothEnded = () => {
            if (responseEnded && fileEnded) {
              resolve();
            }
          };
          
          response.data.pipe(fileStream);
          response.data.pipe(res);
          
          response.data.on("error", (err) => {
            fileStream.destroy();
            res.destroy();
            reject(err);
          });
          
          fileStream.on("finish", () => {
            fileEnded = true;
            checkBothEnded();
          });
          
          fileStream.on("error", (err) => {
            res.destroy();
            reject(err);
          });
          
          res.on("finish", () => {
            responseEnded = true;
            checkBothEnded();
          });
          
          res.on("error", (err) => {
            fileStream.destroy();
            reject(err);
          });
        });
        
        log("Successfully streamed and cached:", cdnPath);
        return;
        
      } catch (err) {
        if (attempt === MAX_RETRIES) {
          log("Failed to stream after retries:", cdnPath, err.message);
          throw err;
        }
        log(`Stream attempt ${attempt + 1} failed for ${cdnPath}, retrying...`);
        
        if (fs.existsSync(localFile)) {
          try {
            fs.unlinkSync(localFile);
          } catch (unlinkErr) {
            log("Failed to remove partial file:", unlinkErr.message);
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  server.use((req, res, next) => {
    log(`Incoming request: ${req.method} ${req.path}`);
    next();
  });

  server.get(`/${staticFolderName}`, async (req, res, next) => {
    next();
  });

  server.use(`/${staticFolderName}`, async (req, res, next) => {
    try {
      let requested = req.path;
      
      if (requested.startsWith(`/${staticFolderName}/`)) {
        requested = requested.substring(`/${staticFolderName}/`.length);
      } else if (requested.startsWith('/')) {
        requested = requested.substring(1);
      }
      
      log(`Processing static asset request: ${requested}`);
      
      const bundled = path.join(resourcesPath, staticFolderName, requested);
      if (fs.existsSync(bundled)) {
        log(`Serving from bundle: ${requested}`);
        return next();
      }

      const cached = path.join(userStaticPath, requested);
      if (fs.existsSync(cached)) {
        log(`Serving from cache: ${requested}`);
        return next();
      }

      const metadataFile = path.join(userStaticPath, "metadata.json");
      if (!fs.existsSync(metadataFile)) {
        log(`No metadata file found, skipping: ${requested}`);
        return next();
      }

      const metadata = JSON.parse(fs.readFileSync(metadataFile, "utf-8"));
      const entry = metadata.files && metadata.files[requested];
      
      if (!entry) {
        log(`No metadata entry found for: ${requested}`);
        return next();
      }

      log("On-demand streaming and caching asset:", requested);
      await streamAndCacheFile(res, cached, entry.path || requested);
    } catch (err) {
      log("Asset stream error:", err.message);
      next();
    }
  });

  server.use(`/${staticFolderName}`, express.static(userStaticPath));
  server.use(`/${staticFolderName}`, express.static(path.join(resourcesPath, staticFolderName)));
  server.use("/desktop", express.static(path.join(resourcesPath, "desktop")));
  server.use("/assets", express.static(path.join(resourcesPath, "desktop")));

  server.use((req, res) => {
    const requested = decodeURIComponent(req.path);
    log(`Fallback handler for: ${requested}`);
    
    const direct = path.join(resourcesPath, requested);
    if (fs.existsSync(direct) && fs.statSync(direct).isFile()) {
      log(`Serving direct file: ${requested}`);
      return res.sendFile(direct);
    }

    const fallback = path.join(resourcesPath, "desktop", path.basename(requested));
    if (fs.existsSync(fallback) && fs.statSync(fallback).isFile()) {
      log(`Serving fallback file: ${requested}`);
      return res.sendFile(fallback);
    }

    log(`404 - File not found: ${requested}`);
    res.status(404).send("Not found");
  });

  server.listen(PORT, () => {
    log("Asset server running at http://localhost:" + PORT);
  });

  return {
    server,
    predownloadAssets
  };
};