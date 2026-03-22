import { videos } from "./wallpaperList.js";
import { detectUserLocation } from "./weather.js";
import { getWeatherIcon } from "./shared/weatherCodes.js";
import { getBrowser } from "./shared/platformUtils.js";
import { StorageKeys } from "./settings.js";

const loginBtn = document.getElementById("login-btn");
const login = document.getElementById("login");
let settings;

loginBtn.addEventListener("click", () => {
  login.classList.add("fade-out");
  login.classList.remove("active");
  login.addEventListener("transitionend", () => login.remove(), { once: true });
  settings.updateUsername();
});

let pageLoadTime;
let isLoginned = false;

function startLoginClock() {
  pageLoadTime = Date.now();
  isLoginned = true;
}

function getGreeting(username) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning " : hour < 18 ? "Good afternoon " : "Good evening ";
  return greeting + (username || "");
}

function showLogin() {
  const savedUsername = localStorage.getItem("yukiOS_username");
  if (savedUsername) {
    const usernameInput = document.getElementById("username");
    if (usernameInput) usernameInput.value = savedUsername;
  }
  document.getElementById("loginGreeting").textContent = getGreeting(savedUsername);
  login.classList.add("active");
  login.classList.remove("is-hidden");
  startLoginClock();
}

let _weatherIntervalId = null;
let _weatherWidget = null;

// ── Blob URL cache for base64 video wallpapers ──
let _currentWallpaperBlobUrl = null;

function _revokeWallpaperBlob() {
  if (_currentWallpaperBlobUrl) {
    URL.revokeObjectURL(_currentWallpaperBlobUrl);
    _currentWallpaperBlobUrl = null;
  }
}

/**
 * Detect whether a string is a base64 data-URL for a video.
 */
function _isBase64Video(str) {
  return typeof str === "string" && str.startsWith("data:video/");
}

/**
 * Detect whether a string is a base64 data-URL for an image.
 */
function _isBase64Image(str) {
  return typeof str === "string" && str.startsWith("data:image/");
}

/**
 * Convert a base64 data-URL to a Blob URL.
 */
function _base64ToBlobUrl(dataUrl) {
  const [header, b64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)[1];
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime });
  return URL.createObjectURL(blob);
}

// ── IndexedDB helpers for wallpaper blob storage ──
const WP_BLOB_DB_NAME = "wallpaper-blobs-db";
const WP_BLOB_DB_VERSION = 1;
const WP_BLOB_STORE = "wallpapers";
const WP_BLOB_KEY = "current";

let _wpBlobDB = null;

function _openWpBlobDB() {
  if (_wpBlobDB) return Promise.resolve(_wpBlobDB);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(WP_BLOB_DB_NAME, WP_BLOB_DB_VERSION);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(WP_BLOB_STORE);
    };
    req.onsuccess = (e) => {
      _wpBlobDB = e.target.result;
      resolve(_wpBlobDB);
    };
    req.onerror = (e) => reject(e);
  });
}

async function _storeWallpaperBlob(blob) {
  const db = await _openWpBlobDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WP_BLOB_STORE, "readwrite");
    tx.objectStore(WP_BLOB_STORE).put(blob, WP_BLOB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e);
  });
}

async function _loadWallpaperBlob() {
  const db = await _openWpBlobDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WP_BLOB_STORE, "readonly");
    const req = tx.objectStore(WP_BLOB_STORE).get(WP_BLOB_KEY);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = (e) => reject(e);
  });
}

async function _clearWallpaperBlob() {
  const db = await _openWpBlobDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WP_BLOB_STORE, "readwrite");
    tx.objectStore(WP_BLOB_STORE).delete(WP_BLOB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e);
  });
}

export class SystemUtilities {
  static setSettings(_settings) {
    settings = _settings;
  }

  static startClock() {
    const clock = document.getElementById("clock");
    const date = document.getElementById("date");
    const uptime = document.getElementById("uptime");
    if (!clock || !date) return;
    const updateClock = () => {
      const now = new Date();
      clock.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      date.textContent = now.toLocaleDateString();
      if (uptime && isLoginned) {
        uptime.textContent = `${Math.floor((Date.now() - pageLoadTime) / 60000)} min`;
      }
    };
    setInterval(updateClock, 1000);
    updateClock();
  }

  static async startTaskbarWeather(appLauncher) {
    if (localStorage.getItem("yukiOS_weather") === "false") return;

    const tray = document.getElementById("system-tray");
    if (!tray) return;

    if (!_weatherWidget) {
      const widget = document.createElement("div");
      widget.id = "taskbar-weather";
      widget.style.cssText = `
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 1.1em;
        cursor: default;
        padding: 0 6px;
        opacity: 0.85;
        white-space: nowrap;
      `;
      widget.textContent = "…";
      widget.addEventListener("click", () => {
        appLauncher?.launch("weatherApp");
      });
      const clock = document.getElementById("clock");
      clock ? tray.insertBefore(widget, clock) : tray.prepend(widget);
      _weatherWidget = widget;
    }

    const fetchAndRender = async () => {
      try {
        const loc = await detectUserLocation();
        const weatherRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,weather_code`
        );
        const weatherData = await weatherRes.json();
        const temp = Math.round(weatherData.current.temperature_2m);
        const icon = getWeatherIcon(weatherData.current.weather_code);
        _weatherWidget.textContent = `${icon} ${temp}°C`;
        _weatherWidget.title = `${loc.city}, ${loc.country} — click to open`;
        _weatherWidget.style.cursor = "pointer";
      } catch {
        _weatherWidget.textContent = "";
        _weatherWidget.style.display = "none";
      }
    };

    fetchAndRender();
    _weatherIntervalId = setInterval(fetchAndRender, 10 * 60 * 1000);
  }

  static stopTaskbarWeather() {
    if (_weatherIntervalId !== null) {
      clearInterval(_weatherIntervalId);
      _weatherIntervalId = null;
    }
    if (_weatherWidget) {
      _weatherWidget.remove();
      _weatherWidget = null;
    }
  }

  static setSequentialWallpaper() {
    const isManual = localStorage.getItem(StorageKeys.manualWallpaper) === "true";
    if (isManual) return;

    const shouldCycle = localStorage.getItem(StorageKeys.cycleWallpaper) !== "false";
    const existing = localStorage.getItem(StorageKeys.wallpaperKey);
    if (!shouldCycle && existing) return;

    let index = parseInt(localStorage.getItem(StorageKeys.wallpaperIndexKey)) || 0;
    if (shouldCycle) {
      index = (index + 1) % videos.length;
      localStorage.setItem(StorageKeys.wallpaperIndexKey, String(index));
    }

    const wallpaper = videos[index];
    localStorage.setItem(StorageKeys.wallpaperKey, wallpaper);
    // Sequential wallpapers are remote URLs, clear any stored blob
    _clearWallpaperBlob().catch(() => {});
    this.applyWallpaper(wallpaper);
  }

  /**
   * Set a wallpaper. If the wallpaperURL is a base64 data-URL for a video,
   * we convert it to a Blob, store the Blob in IndexedDB, and only keep
   * a marker in localStorage (not the huge base64 string).
   */
  static async setWallpaper(wallpaperURL) {
    if (!wallpaperURL) return;

    localStorage.setItem(StorageKeys.manualWallpaper, "true");
    localStorage.setItem(StorageKeys.cycleWallpaper, "false");
    const toggle = document.getElementById("settingsCycleWallpaper");
    if (toggle) toggle.checked = false;
    if (settings) {
      settings._settings.cycleWallpaper = false;
      if (window._settings) window._settings.cycleWallpaper = false;
    }

    if (_isBase64Video(wallpaperURL)) {
      // Convert base64 → Blob and store in IndexedDB
      const [header, b64] = wallpaperURL.split(",");
      const mime = header.match(/:(.*?);/)[1];
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: mime });

      await _storeWallpaperBlob(blob);
      // Store a marker so we know to load from IndexedDB
      localStorage.setItem(StorageKeys.wallpaperKey, "__blob_video__");
      this._applyVideoBlob(blob);
    } else if (_isBase64Image(wallpaperURL)) {
      // Images as base64 are smaller and fine in localStorage, but let's
      // still optimize large ones. For simplicity, store all base64 images
      // as blobs too if they exceed 512KB.
      if (wallpaperURL.length > 524288) {
        const [header, b64] = wallpaperURL.split(",");
        const mime = header.match(/:(.*?);/)[1];
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: mime });
        await _storeWallpaperBlob(blob);
        localStorage.setItem(StorageKeys.wallpaperKey, "__blob_image__");
        this._applyImageBlob(blob);
      } else {
        await _clearWallpaperBlob().catch(() => {});
        localStorage.setItem(StorageKeys.wallpaperKey, wallpaperURL);
        this.applyWallpaper(wallpaperURL);
      }
    } else {
      // Normal URL (http/https or /static/...)
      await _clearWallpaperBlob().catch(() => {});
      localStorage.setItem(StorageKeys.wallpaperKey, wallpaperURL);
      this.applyWallpaper(wallpaperURL);
    }
  }

  static _applyVideoBlob(blob) {
    _revokeWallpaperBlob();
    _currentWallpaperBlobUrl = URL.createObjectURL(blob);

    document.getElementById("wallpaper-img")?.remove();
    document.getElementById("wallpaper-video")?.remove();

    const el = Object.assign(document.createElement("video"), {
      id: "wallpaper-video",
      src: _currentWallpaperBlobUrl,
      autoplay: true,
      loop: true,
      muted: true,
      playsInline: true
    });

    Object.assign(el.style, {
      position: "fixed",
      top: "50%",
      left: "50%",
      width: "100%",
      height: "100%",
      objectFit: "cover",
      transform: "translate(-50%, -50%)",
      zIndex: "-1",
      pointerEvents: "none",
      userSelect: "none"
    });
    el.addEventListener("contextmenu", (e) => e.preventDefault());
    document.body.appendChild(el);
  }

  static _applyImageBlob(blob) {
    _revokeWallpaperBlob();
    _currentWallpaperBlobUrl = URL.createObjectURL(blob);

    document.getElementById("wallpaper-img")?.remove();
    document.getElementById("wallpaper-video")?.remove();

    const el = Object.assign(document.createElement("img"), {
      id: "wallpaper-img",
      src: _currentWallpaperBlobUrl
    });

    Object.assign(el.style, {
      position: "fixed",
      top: "50%",
      left: "50%",
      width: "100%",
      height: "100%",
      objectFit: "cover",
      transform: "translate(-50%, -50%)",
      zIndex: "-1",
      pointerEvents: "none",
      userSelect: "none"
    });
    el.addEventListener("contextmenu", (e) => e.preventDefault());
    document.body.appendChild(el);
  }

  static applyWallpaper(wallpaperURL) {
    if (!wallpaperURL) return;

    // If it's a base64 video, convert to blob URL for performance
    if (_isBase64Video(wallpaperURL)) {
      _revokeWallpaperBlob();
      _currentWallpaperBlobUrl = _base64ToBlobUrl(wallpaperURL);

      document.getElementById("wallpaper-img")?.remove();
      document.getElementById("wallpaper-video")?.remove();

      const el = Object.assign(document.createElement("video"), {
        id: "wallpaper-video",
        src: _currentWallpaperBlobUrl,
        autoplay: true,
        loop: true,
        muted: true,
        playsInline: true
      });

      Object.assign(el.style, {
        position: "fixed",
        top: "50%",
        left: "50%",
        width: "100%",
        height: "100%",
        objectFit: "cover",
        transform: "translate(-50%, -50%)",
        zIndex: "-1",
        pointerEvents: "none",
        userSelect: "none"
      });
      el.addEventListener("contextmenu", (e) => e.preventDefault());
      document.body.appendChild(el);
      return;
    }

    // If it's a base64 image, also use blob URL
    if (_isBase64Image(wallpaperURL)) {
      _revokeWallpaperBlob();
      _currentWallpaperBlobUrl = _base64ToBlobUrl(wallpaperURL);

      document.getElementById("wallpaper-img")?.remove();
      document.getElementById("wallpaper-video")?.remove();

      const el = Object.assign(document.createElement("img"), {
        id: "wallpaper-img",
        src: _currentWallpaperBlobUrl
      });

      Object.assign(el.style, {
        position: "fixed",
        top: "50%",
        left: "50%",
        width: "100%",
        height: "100%",
        objectFit: "cover",
        transform: "translate(-50%, -50%)",
        zIndex: "-1",
        pointerEvents: "none",
        userSelect: "none"
      });
      el.addEventListener("contextmenu", (e) => e.preventDefault());
      document.body.appendChild(el);
      return;
    }

    // Regular URL path
    _revokeWallpaperBlob();

    const isVideo = wallpaperURL.toLowerCase().endsWith(".mp4");

    document.getElementById("wallpaper-img")?.remove();
    document.getElementById("wallpaper-video")?.remove();

    const el = isVideo
      ? Object.assign(document.createElement("video"), {
          id: "wallpaper-video",
          src: wallpaperURL,
          autoplay: true,
          loop: true,
          muted: true,
          playsInline: true
        })
      : Object.assign(document.createElement("img"), {
          id: "wallpaper-img",
          src: wallpaperURL
        });

    Object.assign(el.style, {
      position: "fixed",
      top: "50%",
      left: "50%",
      width: "100%",
      height: "100%",
      objectFit: "cover",
      transform: "translate(-50%, -50%)",
      zIndex: "-1",
      pointerEvents: "none",
      userSelect: "none"
    });
    el.addEventListener("contextmenu", (e) => e.preventDefault());
    document.body.appendChild(el);
  }

  static async loadWallpaper() {
    const shouldCycle = localStorage.getItem(StorageKeys.cycleWallpaper) !== "false";
    const isManual = localStorage.getItem(StorageKeys.manualWallpaper) === "true";
    const saved = localStorage.getItem(StorageKeys.wallpaperKey);

    // Check for blob-stored wallpapers first
    if (saved === "__blob_video__" || saved === "__blob_image__") {
      try {
        const blob = await _loadWallpaperBlob();
        if (blob) {
          if (saved === "__blob_video__") {
            this._applyVideoBlob(blob);
          } else {
            this._applyImageBlob(blob);
          }
          return;
        }
      } catch (e) {
        console.warn("Failed to load wallpaper blob, falling back", e);
      }
      // If blob loading failed, fall through to default
      this.setSequentialWallpaper();
      return;
    }

    if (isManual && saved) {
      this.applyWallpaper(saved);
    } else if (shouldCycle) {
      this.setSequentialWallpaper();
    } else if (saved) {
      this.applyWallpaper(saved);
    } else {
      this.setSequentialWallpaper();
    }
  }
}

let isStartedBooting = false;

function startBootSequence() {
  if (isStartedBooting) return;
  isStartedBooting = true;
  const messages = [
    "Starting boot sequence for YukiOS...",
    "Finished running startup functions.",
    "Starting graphical user interface...",
    "System ready! :D"
  ];
  const messagesContainer = document.getElementById("bootMessages");
  const loadingBar = document.getElementById("loadingBar");

  messages.forEach((msg, index) => {
    setTimeout(() => {
      const msgEl = document.createElement("div");
      msgEl.className = "boot-message";
      msgEl.textContent = `[OK] ${msg}`;
      messagesContainer.appendChild(msgEl);
      loadingBar.style.width = `${((index + 1) / messages.length) * 100}%`;
      if (index === messages.length - 1) {
        setTimeout(() => {
          document.getElementById("bootloader").classList.add("hidden");
          showLogin();
        }, 500);
      }
    }, index * 250);
  });
}

export function skipBootSequence() {
  if (isStartedBooting) return;
  isStartedBooting = true;
  document.getElementById("bootloader")?.classList.add("hidden");
  showLogin();
  document.getElementById("login-btn").click();
}

document.querySelector(".boot-option").addEventListener("click", startBootSequence);
document.body.addEventListener("keydown", (e) => {
  if (e.key === "Enter") startBootSequence();
});

const browser = document.getElementById("browserInfo");
browser.textContent = getBrowser();
