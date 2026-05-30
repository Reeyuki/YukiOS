import { detectUserLocation, getCached, setCache } from "./weather.js";
import { getWeatherIcon } from "./shared/weatherCodes.js";
import { StorageKeys } from "./settings/settings.js";
import { videos } from "./wallpaperList.js";
import { createCalendarPopup, setCurrentCalendarMonth } from "./calendar.js";
import { resolveWallpaperUrl } from "./shared/assetResolver.js";
import { bus, BusEvents } from "./core/EventBus.js";
import { trayManager } from "./tray.js";

function isBlob(obj) {
  if (!obj) return false;
  return (
    obj instanceof Blob ||
    (typeof obj === "object" &&
      typeof obj.size === "number" &&
      typeof obj.type === "string" &&
      typeof obj.slice === "function")
  );
}

class WallpaperStore {
  static _currentWallpaperBlobUrl = null;
  static _currentLoginWallpaperBlobUrl = null;
  static WP_BLOB_DB_NAME = "wallpaper-blobs-db";
  static WP_BLOB_DB_VERSION = 1;
  static WP_BLOB_STORE = "wallpapers";
  static WP_BLOB_KEY = "current";
  static WP_LOGIN_BLOB_KEY = "login_current";
  static _wpBlobDB = null;

  static _revokeWallpaperBlob(isLogin = false) {
    if (isLogin) {
      if (this._currentLoginWallpaperBlobUrl) {
        URL.revokeObjectURL(this._currentLoginWallpaperBlobUrl);
        this._currentLoginWallpaperBlobUrl = null;
      }
    } else {
      if (this._currentWallpaperBlobUrl) {
        URL.revokeObjectURL(this._currentWallpaperBlobUrl);
        this._currentWallpaperBlobUrl = null;
      }
    }
  }

  static _isBase64Video(str) {
    return typeof str === "string" && str.startsWith("data:video/");
  }

  static _isBase64Image(str) {
    return typeof str === "string" && str.startsWith("data:image/");
  }

  static _base64ToBlobUrl(dataUrl) {
    const [header, b64] = dataUrl.split(",");
    const mime = header.match(/:(.*?);/)[1];
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: mime });
    return URL.createObjectURL(blob);
  }

  static _openWpBlobDB() {
    if (this._wpBlobDB) return Promise.resolve(this._wpBlobDB);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.WP_BLOB_DB_NAME, this.WP_BLOB_DB_VERSION);
      req.onupgradeneeded = (e) => {
        e.target.result.createObjectStore(this.WP_BLOB_STORE);
      };
      req.onsuccess = (e) => {
        this._wpBlobDB = e.target.result;
        resolve(this._wpBlobDB);
      };
      req.onerror = (e) => reject(e);
    });
  }

  static async _storeWallpaperBlob(blob, key = this.WP_BLOB_KEY) {
    const db = await this._openWpBlobDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.WP_BLOB_STORE, "readwrite");
      tx.objectStore(this.WP_BLOB_STORE).put(blob, key);
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e);
    });
  }

  static async _loadWallpaperBlob(key = this.WP_BLOB_KEY) {
    const db = await this._openWpBlobDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.WP_BLOB_STORE, "readonly");
      const req = tx.objectStore(this.WP_BLOB_STORE).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = (e) => reject(e);
    });
  }

  static async _clearWallpaperBlob(key = this.WP_BLOB_KEY) {
    const db = await this._openWpBlobDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.WP_BLOB_STORE, "readwrite");
      tx.objectStore(this.WP_BLOB_STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e);
    });
  }
}

const STATIC_FALLBACK_WALLPAPERS = [
  "/static/wallpapers/mint.webp",
  "/static/wallpapers/nier.webp",
  "/static/wallpapers/redwin10.jpg",
  "/static/wallpapers/wallpaper1.webp",
  "/static/wallpapers/wallpaper2.webp",
  "/static/wallpapers/wallpaper3.webp",
  "/static/wallpapers/wallpaper4.webp",
  "/static/wallpapers/wallpaper5.webp",
  "/static/wallpapers/wallpaper6.webp",
  "/static/wallpapers/wallpaper7.webp",
  "/static/wallpapers/wallpaper8.webp",
  "/static/wallpapers/wallpaper9.webp",
  "/static/wallpapers/wallpaper10.webp",
  "/static/wallpapers/wallpaper11.webp",
  "/static/wallpapers/wallpaper12.png",
  "/static/wallpapers/wallpaper13.png",
  "/static/wallpapers/win7.webp",
  "/static/wallpapers/win10.webp",
  "/static/wallpapers/win11.webp",
  "/static/wallpapers/xp.webp"
];

class WallpaperManager {
  static _normalizeWallpaperUrl(url) {
    return resolveWallpaperUrl(url);
  }

  static _pickStaticFallbackWallpaper() {
    const list = STATIC_FALLBACK_WALLPAPERS;
    if (!list?.length) return "/static/wallpapers/wallpaper1.webp";
    const picked = list[Math.floor(Math.random() * list.length)];
    return this._normalizeWallpaperUrl(picked);
  }

  static setSequentialWallpaper() {
    const isManual = localStorage.getItem(StorageKeys.manualWallpaper) === "true";
    if (isManual) return;

    const shouldCycle = localStorage.getItem(StorageKeys.cycleWallpaper) !== "false";
    const existing = localStorage.getItem(StorageKeys.wallpaperKey);
    if (!shouldCycle && existing) return;

    if (typeof videos === "undefined" || !videos.length) return;

    let index = parseInt(localStorage.getItem(StorageKeys.wallpaperIndexKey)) || 0;
    if (shouldCycle) {
      index = (index + 1) % videos.length;
      localStorage.setItem(StorageKeys.wallpaperIndexKey, String(index));
    }

    const wallpaper = videos[index];
    localStorage.setItem(StorageKeys.wallpaperKey, wallpaper);
    WallpaperStore._clearWallpaperBlob().catch(() => {});
    this.applyWallpaper(wallpaper);
  }

  static async setWallpaper(wallpaperURL) {
    if (!wallpaperURL) return;

    if (isBlob(wallpaperURL)) {
      const type = wallpaperURL.type.startsWith("video/") ? "video" : "img";
      await WallpaperStore._storeWallpaperBlob(wallpaperURL);
      localStorage.setItem(StorageKeys.wallpaperKey, type === "video" ? "__blob_video__" : "__blob_image__");
      localStorage.setItem(StorageKeys.manualWallpaper, "true");
      localStorage.setItem(StorageKeys.cycleWallpaper, "false");
      const toggle = document.getElementById("settingsCycleWallpaper");
      if (toggle) toggle.checked = false;

      this._applyBlob(wallpaperURL, type);
      bus.emit(BusEvents.WALLPAPER_CHANGED, { url: "__blob__" });
      return;
    }

    wallpaperURL = this._normalizeWallpaperUrl(wallpaperURL);

    bus.emit(BusEvents.WALLPAPER_CHANGED, { url: wallpaperURL });

    localStorage.setItem(StorageKeys.manualWallpaper, "true");
    localStorage.setItem(StorageKeys.cycleWallpaper, "false");

    const toggle = document.getElementById("settingsCycleWallpaper");
    if (toggle) toggle.checked = false;

    if (WallpaperStore._isBase64Video(wallpaperURL)) {
      const blob = this._dataURItoBlob(wallpaperURL);
      await WallpaperStore._storeWallpaperBlob(blob);
      localStorage.setItem(StorageKeys.wallpaperKey, "__blob_video__");
      this._applyBlob(blob, "video");
    } else if (WallpaperStore._isBase64Image(wallpaperURL)) {
      if (wallpaperURL.length > 524288) {
        const blob = this._dataURItoBlob(wallpaperURL);
        await WallpaperStore._storeWallpaperBlob(blob);
        localStorage.setItem(StorageKeys.wallpaperKey, "__blob_image__");
        this._applyBlob(blob, "img");
      } else {
        await WallpaperStore._clearWallpaperBlob().catch(() => {});
        localStorage.setItem(StorageKeys.wallpaperKey, wallpaperURL);
        this.applyWallpaper(wallpaperURL);
      }
    } else {
      await WallpaperStore._clearWallpaperBlob().catch(() => {});
      localStorage.setItem(StorageKeys.wallpaperKey, wallpaperURL);
      this.applyWallpaper(wallpaperURL);
    }
  }

  static async setLoginWallpaper(wallpaperURL) {
    if (wallpaperURL === "none" || !wallpaperURL) {
      localStorage.removeItem(StorageKeys.loginWallpaperKey);
      await WallpaperStore._clearWallpaperBlob(WallpaperStore.WP_LOGIN_BLOB_KEY).catch(() => {});
      bus.emit(BusEvents.LOGIN_WALLPAPER_CHANGED, { url: null });
      return;
    }

    if (isBlob(wallpaperURL)) {
      const type = wallpaperURL.type.startsWith("video/") ? "video" : "img";
      await WallpaperStore._storeWallpaperBlob(wallpaperURL, WallpaperStore.WP_LOGIN_BLOB_KEY);
      localStorage.setItem(StorageKeys.loginWallpaperKey, type === "video" ? "__blob_video__" : "__blob_image__");
      bus.emit(BusEvents.LOGIN_WALLPAPER_CHANGED, { url: "__blob__" });
      return;
    }

    wallpaperURL = this._normalizeWallpaperUrl(wallpaperURL);
    localStorage.setItem(StorageKeys.loginWallpaperKey, wallpaperURL);
    bus.emit(BusEvents.LOGIN_WALLPAPER_CHANGED, { url: wallpaperURL });

    if (WallpaperStore._isBase64Video(wallpaperURL)) {
      const blob = this._dataURItoBlob(wallpaperURL);
      await WallpaperStore._storeWallpaperBlob(blob, WallpaperStore.WP_LOGIN_BLOB_KEY);
      localStorage.setItem(StorageKeys.loginWallpaperKey, "__blob_video__");
    } else if (WallpaperStore._isBase64Image(wallpaperURL)) {
      if (wallpaperURL.length > 524288) {
        const blob = this._dataURItoBlob(wallpaperURL);
        await WallpaperStore._storeWallpaperBlob(blob, WallpaperStore.WP_LOGIN_BLOB_KEY);
        localStorage.setItem(StorageKeys.loginWallpaperKey, "__blob_image__");
      } else {
        await WallpaperStore._clearWallpaperBlob(WallpaperStore.WP_LOGIN_BLOB_KEY).catch(() => {});
      }
    } else {
      await WallpaperStore._clearWallpaperBlob(WallpaperStore.WP_LOGIN_BLOB_KEY).catch(() => {});
    }
  }

  static async getLoginWallpaper() {
    const saved = localStorage.getItem(StorageKeys.loginWallpaperKey);
    if (!saved || saved === "none") return null;
    if (saved === "__blob_video__" || saved === "__blob_image__") {
      try {
        const blob = await WallpaperStore._loadWallpaperBlob(WallpaperStore.WP_LOGIN_BLOB_KEY);
        if (blob) {
          WallpaperStore._revokeWallpaperBlob(true);
          WallpaperStore._currentLoginWallpaperBlobUrl = URL.createObjectURL(blob);
          return { url: WallpaperStore._currentLoginWallpaperBlobUrl, isVideo: saved === "__blob_video__" };
        }
      } catch (e) {}
      return null;
    }
    if (WallpaperStore._isBase64Video(saved)) {
      WallpaperStore._revokeWallpaperBlob(true);
      WallpaperStore._currentLoginWallpaperBlobUrl = WallpaperStore._base64ToBlobUrl(saved);
      return { url: WallpaperStore._currentLoginWallpaperBlobUrl, isVideo: true };
    }
    if (WallpaperStore._isBase64Image(saved)) {
      WallpaperStore._revokeWallpaperBlob(true);
      WallpaperStore._currentLoginWallpaperBlobUrl = WallpaperStore._base64ToBlobUrl(saved);
      return { url: WallpaperStore._currentLoginWallpaperBlobUrl, isVideo: false };
    }
    const isVideo =
      typeof saved === "string" && (saved.toLowerCase().endsWith(".mp4") || saved.toLowerCase().endsWith(".webm"));
    return { url: saved, isVideo };
  }

  static _dataURItoBlob(dataUrl) {
    const [header, b64] = dataUrl.split(",");
    const mime = header.match(/:(.*?);/)[1];
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  static _applyBlob(blob, type) {
    WallpaperStore._revokeWallpaperBlob();
    WallpaperStore._currentWallpaperBlobUrl = URL.createObjectURL(blob);
    this._renderElement(type, WallpaperStore._currentWallpaperBlobUrl);
  }

  static applyWallpaper(wallpaperURL) {
    if (!wallpaperURL) return;
    wallpaperURL = this._normalizeWallpaperUrl(wallpaperURL);

    if (WallpaperStore._isBase64Video(wallpaperURL)) {
      WallpaperStore._revokeWallpaperBlob();
      WallpaperStore._currentWallpaperBlobUrl = WallpaperStore._base64ToBlobUrl(wallpaperURL);
      this._renderElement("video", WallpaperStore._currentWallpaperBlobUrl);
      return;
    }

    if (WallpaperStore._isBase64Image(wallpaperURL)) {
      WallpaperStore._revokeWallpaperBlob();
      WallpaperStore._currentWallpaperBlobUrl = WallpaperStore._base64ToBlobUrl(wallpaperURL);
      this._renderElement("img", WallpaperStore._currentWallpaperBlobUrl);
      return;
    }

    WallpaperStore._revokeWallpaperBlob();
    const isVideo =
      typeof wallpaperURL === "string" &&
      (wallpaperURL.toLowerCase().endsWith(".mp4") ||
        wallpaperURL.toLowerCase().endsWith(".webm") ||
        wallpaperURL.startsWith("data:video") ||
        (wallpaperURL.startsWith("blob:") && localStorage.getItem(StorageKeys.wallpaperKey) === "__blob_video__"));
    this._renderElement(isVideo ? "video" : "img", wallpaperURL);
  }

  static _renderElement(tag, src) {
    document.getElementById("wallpaper-img")?.remove();
    document.getElementById("wallpaper-video")?.remove();

    const isVideo = tag === "video";
    const el = document.createElement(tag);
    el.id = isVideo ? "wallpaper-video" : "wallpaper-img";
    el.src = src;

    if (isVideo) {
      Object.assign(el, { autoplay: true, loop: true, muted: true, playsInline: true });
    }

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

    if (isVideo) {
      let didFallback = false;
      const fallbackToStatic = () => {
        if (didFallback) return;
        didFallback = true;
        const fallback = this._pickStaticFallbackWallpaper();
        console.warn("Wallpaper video failed to load; falling back to static wallpaper:", src);
        this._renderElement("img", fallback);
      };

      el.addEventListener("error", fallbackToStatic, { once: true });

      const tryPlay = () => {
        try {
          const p = el.play?.();
          if (p && typeof p.catch === "function") p.catch(fallbackToStatic);
        } catch {
          fallbackToStatic();
        }
      };

      const loadTimeoutMs = 8000;
      const timeoutId = setTimeout(() => {
        if (el.readyState < 2) fallbackToStatic();
      }, loadTimeoutMs);
      const clear = () => clearTimeout(timeoutId);
      el.addEventListener("playing", clear, { once: true });
      el.addEventListener("loadeddata", clear, { once: true });
      el.addEventListener("canplay", tryPlay, { once: true });
      setTimeout(tryPlay, 0);
    }
  }

  static async loadWallpaper() {
    const shouldCycle = localStorage.getItem(StorageKeys.cycleWallpaper) !== "false";
    const isManual = localStorage.getItem(StorageKeys.manualWallpaper) === "true";
    const saved = localStorage.getItem(StorageKeys.wallpaperKey);

    if (saved === "__blob_video__" || saved === "__blob_image__") {
      try {
        const blob = await WallpaperStore._loadWallpaperBlob();
        if (blob) {
          this._applyBlob(blob, saved === "__blob_video__" ? "video" : "img");
          return;
        }
      } catch (e) {
        console.warn("Failed to load wallpaper blob", e);
      }
      this.setSequentialWallpaper();
      return;
    }

    if ((isManual && saved) || (!shouldCycle && saved)) {
      const normalized = this._normalizeWallpaperUrl(saved);
      if (normalized !== saved) localStorage.setItem(StorageKeys.wallpaperKey, normalized);
      this.applyWallpaper(normalized);
    } else {
      this.setSequentialWallpaper();
    }
  }
}

let settings;
let _skipUsernameUpdate = false;

let pageLoadTime;
pageLoadTime = Date.now();

function getGreeting(username) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning " : hour < 18 ? "Good afternoon " : "Good evening ";
  return greeting + (username || "");
}

let _weatherIntervalId = null;

export class SystemUtilities {
  static async loadWallpaper() {
    await WallpaperManager.loadWallpaper();
  }
  static setSettings(_settings) {
    settings = _settings;
  }

  static startClock() {
    const clock = document.getElementById("clock");
    const date = document.getElementById("date");
    const uptime = document.getElementById("uptime");
    if (!clock || !date) return;

    const timeContainer = document.getElementById("time-container");
    const clickTarget = timeContainer || date;
    clickTarget.style.cursor = "pointer";
    clickTarget.addEventListener("click", (e) => {
      e.stopPropagation();
      setCurrentCalendarMonth();
      createCalendarPopup();
    });

    const updateClock = () => {
      const now = new Date();
      clock.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      date.textContent = now.toLocaleDateString();
      if (uptime) {
        uptime.textContent = `${Math.floor((Date.now() - pageLoadTime) / 60000)} min`;
      }
    };
    setInterval(updateClock, 1000);
    updateClock();
  }

  static async startTaskbarWeather(appLauncher) {
    SystemUtilities._appLauncher = appLauncher;
    if (!SystemUtilities._weatherEventBound) {
      SystemUtilities._weatherEventBound = true;
      bus.on(BusEvents.SETTINGS_CHANGED, (settings) => {
        if (settings && typeof settings.weather !== "undefined") {
          if (settings.weather) {
            SystemUtilities.stopTaskbarWeather();
            SystemUtilities.startTaskbarWeather(SystemUtilities._appLauncher);
          } else {
            SystemUtilities.stopTaskbarWeather();
          }
        }
      });
    }

    if (localStorage.getItem(StorageKeys.weather) === "false") return;

    trayManager.register("weatherApp", "🌡️", "Loading weather...", {
      resident: true,
      onClick: () => {
        appLauncher?.launch("weatherApp");
      },
      onQuit: () => {
        SystemUtilities.stopTaskbarWeather();
      }
    });

    const fetchAndRender = async () => {
      try {
        const loc = await detectUserLocation();
        const cacheKey = `yukiOS_weather_taskbar_${loc.latitude.toFixed(2)}_${loc.longitude.toFixed(2)}`;
        const cached = getCached(cacheKey);

        let weatherData;
        if (cached) {
          weatherData = cached;
        } else {
          const weatherRes = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,weather_code`
          );
          weatherData = await weatherRes.json();
          setCache(cacheKey, weatherData);
        }

        const temp = Math.round(weatherData.current.temperature_2m);
        const icon = getWeatherIcon(weatherData.current.weather_code);
        const weatherLabel = `${loc.city}, ${loc.country}`;

        trayManager.updateIcon("weatherApp", icon);
        trayManager.updateLabel("weatherApp", `${temp}°C`);
      } catch {
        trayManager.unregister("weatherApp");
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
    trayManager.unregister("weatherApp");
  }
  static async setWallpaper(url) {
    await WallpaperManager.setWallpaper(url);
  }
  static async setLoginWallpaper(url) {
    await WallpaperManager.setLoginWallpaper(url);
  }
  static async getLoginWallpaper() {
    return await WallpaperManager.getLoginWallpaper();
  }
}
