import { detectUserLocation, getCached, setCache } from "./apps/weather.js";
import { getWeatherIcon } from "./shared/weatherCodes.js";
import { StorageKeys } from "./settings/settings.js";
import { DEFAULT_WALLPAPER_FILES, WALLPAPER_STATIC_DIR, STATIC_FALLBACK_WALLPAPERS } from "./wallpaperConfig.js";
import { createCalendarPopup, setCurrentCalendarMonth } from "./apps/calendar.js";
import { resolveWallpaperUrl } from "./shared/assetResolver.js";
import { BusEvents } from "./core/EventBus.js";
import { os } from "./os/index.js";
import { getVantaPresetById } from "./vantaPresets.js";
import { videos } from "./wallpaperList.js";
import { vantaPresets } from "./vantaPresets.js";

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
  static _currentVantaInstance = null;
  static _vantaScriptsLoaded = false;
  static _vantaLoadPromise = null;

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

  static _destroyVantaInstance() {
    if (this._currentVantaInstance) {
      try {
        this._currentVantaInstance.destroy();
      } catch (error) {
        console.warn("Error destroying Vanta instance:", error);
      }
      this._currentVantaInstance = null;
    }
  }

  static async _loadVantaScripts() {
    if (this._vantaScriptsLoaded) return;
    if (this._vantaLoadPromise) return this._vantaLoadPromise;

    this._vantaLoadPromise = (async () => {
      const scripts = [
        "https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js",
        "https://cdnjs.cloudflare.com/ajax/libs/vanta/0.5.24/vanta.waves.min.js",
        "https://cdnjs.cloudflare.com/ajax/libs/vanta/0.5.24/vanta.birds.min.js",
        "https://cdnjs.cloudflare.com/ajax/libs/vanta/0.5.24/vanta.net.min.js",
        "https://cdnjs.cloudflare.com/ajax/libs/vanta/0.5.24/vanta.dots.min.js",
        "https://cdnjs.cloudflare.com/ajax/libs/vanta/0.5.24/vanta.globe.min.js",
        "https://cdnjs.cloudflare.com/ajax/libs/vanta/0.5.24/vanta.halo.min.js",
        "https://cdnjs.cloudflare.com/ajax/libs/vanta/0.5.24/vanta.fog.min.js",
        "https://cdnjs.cloudflare.com/ajax/libs/vanta/0.5.24/vanta.cells.min.js"
      ];

      for (const src of scripts) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = src;
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      this._vantaScriptsLoaded = true;
      this._vantaLoadPromise = null;
    })();

    return this._vantaLoadPromise;
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

  static _isVantaPreset(value) {
    return typeof value === "string" && value.startsWith("vanta:");
  }

  static _isVantaCustom(value) {
    return typeof value === "string" && value.startsWith("vanta:custom:");
  }

  static async _applyVantaEffect(presetId) {
    const preset = getVantaPresetById(parseInt(presetId));
    if (!preset) {
      console.error("Vanta preset not found:", presetId);
      return false;
    }

    await WallpaperStore._loadVantaScripts();

    WallpaperStore._destroyVantaInstance();
    document.getElementById("wallpaper-img")?.remove();
    document.getElementById("wallpaper-video")?.remove();

    const container = document.createElement("div");
    container.id = "vanta-container";
    Object.assign(container.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      zIndex: "-1",
      pointerEvents: "none",
      userSelect: "none"
    });

    document.body.appendChild(container);

    if (!window.VANTA) {
      console.error("VANTA global object not available. Scripts may not be loaded yet.");
      container.remove();
      return false;
    }

    const effectName = preset.effect;
    const VantaEffect = window.VANTA[effectName];

    if (!VantaEffect) {
      console.error("Vanta effect not found:", effectName, "Available effects:", Object.keys(window.VANTA));
      container.remove();
      return false;
    }

    try {
      WallpaperStore._currentVantaInstance = VantaEffect({
        el: container,
        ...preset.options
      });
      console.log("Vanta effect applied successfully:", preset.name);
      return true;
    } catch (error) {
      console.error("Failed to initialize Vanta effect:", error);
      container.remove();
      return false;
    }
  }

  static async _applyCustomVantaEffect(customConfig) {
    try {
      const preset = JSON.parse(atob(customConfig));
      if (!preset || !preset.effect || !preset.options) {
        console.error("Invalid custom Vanta configuration");
        return false;
      }

      await WallpaperStore._loadVantaScripts();

      WallpaperStore._destroyVantaInstance();
      document.getElementById("wallpaper-img")?.remove();
      document.getElementById("wallpaper-video")?.remove();

      const container = document.createElement("div");
      container.id = "vanta-container";
      Object.assign(container.style, {
        position: "fixed",
        top: "0",
        left: "0",
        width: "100%",
        height: "100%",
        zIndex: "-1",
        pointerEvents: "none",
        userSelect: "none"
      });

      document.body.appendChild(container);

      if (!window.VANTA) {
        console.error("VANTA global object not available. Scripts may not be loaded yet.");
        container.remove();
        return false;
      }

      const effectName = preset.effect;
      const VantaEffect = window.VANTA[effectName];

      if (!VantaEffect) {
        console.error("Vanta effect not found:", effectName, "Available effects:", Object.keys(window.VANTA));
        container.remove();
        return false;
      }

      WallpaperStore._currentVantaInstance = VantaEffect({
        el: container,
        ...preset.options
      });
      console.log("Custom Vanta effect applied successfully:", preset.name);
      return true;
    } catch (error) {
      console.error("Failed to apply custom Vanta effect:", error);
      return false;
    }
  }

  static _getWallpaperType(url) {
    if (!url || typeof url !== "string") return "image";
    if (url.startsWith("vanta:")) return "vanta";
    if (url.endsWith(".mp4")) return "video";
    return "image";
  }

  static setSequentialWallpaper() {
    const isManual = os.storage.get(StorageKeys.manualWallpaper) === "true";
    if (isManual) return;

    const shouldCycle = os.storage.get(StorageKeys.cycleWallpaper) !== "false";
    if (!shouldCycle) return;

    const existing = os.storage.get(StorageKeys.wallpaperKey);

    const wallpaperType = os.storage.get(StorageKeys.wallpaperType) || "image";
    let newWallpaperType = wallpaperType;

    if (existing) {
      const type = this._getWallpaperType(existing);
      if (type !== wallpaperType) {
        newWallpaperType = type;
        os.storage.set(StorageKeys.wallpaperType, newWallpaperType);
      }
    }

    const randomChoice = Math.random();
    let wallpaper;

    if (randomChoice < 0.33) {
      newWallpaperType = "image";
      os.storage.set(StorageKeys.wallpaperType, "image");

      if (typeof DEFAULT_WALLPAPER_FILES === "undefined" || !DEFAULT_WALLPAPER_FILES.length) return;

      let index = os.storage.get(StorageKeys.wallpaperIndexKey) || 0;
      const expectedWallpaper = WALLPAPER_STATIC_DIR + DEFAULT_WALLPAPER_FILES[index];

      if (existing !== expectedWallpaper) {
        wallpaper = WALLPAPER_STATIC_DIR + DEFAULT_WALLPAPER_FILES[index];
        os.storage.set(StorageKeys.wallpaperKey, wallpaper);
        WallpaperStore._clearWallpaperBlob().catch(() => {});
        this.applyWallpaper(wallpaper);
        return;
      }

      index = (index + 1) % DEFAULT_WALLPAPER_FILES.length;
      os.storage.set(StorageKeys.wallpaperIndexKey, String(index));
      wallpaper = WALLPAPER_STATIC_DIR + DEFAULT_WALLPAPER_FILES[index];
    } else if (randomChoice < 0.66) {
      newWallpaperType = "video";
      os.storage.set(StorageKeys.wallpaperType, "video");

      if (!videos || !videos.length) return;

      const videoIndex = Math.floor(Math.random() * videos.length);
      wallpaper = videos[videoIndex];
    } else {
      newWallpaperType = "vanta";
      os.storage.set(StorageKeys.wallpaperType, "vanta");

      if (!vantaPresets || !vantaPresets.length) return;

      const vantaIndex = Math.floor(Math.random() * vantaPresets.length);
      const preset = vantaPresets[vantaIndex];
      wallpaper = `vanta:${preset.id}`;
    }

    os.storage.set(StorageKeys.wallpaperKey, wallpaper);
    WallpaperStore._clearWallpaperBlob().catch(() => {});
    this.applyWallpaper(wallpaper);
  }

  static async setWallpaper(wallpaperURL) {
    if (!wallpaperURL) return;

    if (this._isVantaCustom(wallpaperURL)) {
      const customConfig = wallpaperURL.replace("vanta:custom:", "");
      const success = await this._applyCustomVantaEffect(customConfig);
      if (success) {
        os.storage.set(StorageKeys.wallpaperKey, wallpaperURL);
        os.storage.set(StorageKeys.manualWallpaper, "true");
        os.storage.set(StorageKeys.cycleWallpaper, "false");
        const toggle = document.getElementById("settingsCycleWallpaper");
        if (toggle) toggle.checked = false;
        os.events.emit(BusEvents.WALLPAPER_CHANGED, { wallpaper: wallpaperURL });
      }
      return;
    }

    if (this._isVantaPreset(wallpaperURL)) {
      const presetId = wallpaperURL.replace("vanta:", "");
      const success = await this._applyVantaEffect(presetId);
      if (success) {
        os.storage.set(StorageKeys.wallpaperKey, wallpaperURL);
        os.storage.set(StorageKeys.manualWallpaper, "true");
        os.storage.set(StorageKeys.cycleWallpaper, "false");
        os.storage.set(StorageKeys.vantaWallpaper, presetId);
        const toggle = document.getElementById("settingsCycleWallpaper");
        if (toggle) toggle.checked = false;
        os.events.emit(BusEvents.WALLPAPER_CHANGED, { wallpaper: wallpaperURL });
      }
      return;
    }

    if (isBlob(wallpaperURL)) {
      const type = wallpaperURL.type.startsWith("video/") ? "video" : "img";
      await WallpaperStore._storeWallpaperBlob(wallpaperURL);
      os.storage.set(StorageKeys.wallpaperKey, type === "video" ? "__blob_video__" : "__blob_image__");
      os.storage.set(StorageKeys.manualWallpaper, "true");
      os.storage.set(StorageKeys.cycleWallpaper, "false");
      os.storage.remove(StorageKeys.vantaWallpaper);
      const toggle = document.getElementById("settingsCycleWallpaper");
      if (toggle) toggle.checked = false;

      this._applyBlob(wallpaperURL, type);
      os.events.emit(BusEvents.WALLPAPER_CHANGED, { wallpaper: "__blob__" });
      return;
    }

    wallpaperURL = this._normalizeWallpaperUrl(wallpaperURL);

    os.events.emit(BusEvents.WALLPAPER_CHANGED, { url: wallpaperURL });

    os.storage.set(StorageKeys.manualWallpaper, "true");
    os.storage.set(StorageKeys.cycleWallpaper, "false");
    os.storage.remove(StorageKeys.vantaWallpaper);

    const toggle = document.getElementById("settingsCycleWallpaper");
    if (toggle) toggle.checked = false;

    if (WallpaperStore._isBase64Video(wallpaperURL)) {
      const blob = this._dataURItoBlob(wallpaperURL);
      await WallpaperStore._storeWallpaperBlob(blob);
      os.storage.set(StorageKeys.wallpaperKey, "__blob_video__");
      this._applyBlob(blob, "video");
    } else if (WallpaperStore._isBase64Image(wallpaperURL)) {
      if (wallpaperURL.length > 524288) {
        const blob = this._dataURItoBlob(wallpaperURL);
        await WallpaperStore._storeWallpaperBlob(blob);
        os.storage.set(StorageKeys.wallpaperKey, "__blob_image__");
        this._applyBlob(blob, "img");
      } else {
        await WallpaperStore._clearWallpaperBlob().catch(() => {});
        os.storage.set(StorageKeys.wallpaperKey, wallpaperURL);
        this.applyWallpaper(wallpaperURL);
      }
    } else {
      await WallpaperStore._clearWallpaperBlob().catch(() => {});
      os.storage.set(StorageKeys.wallpaperKey, wallpaperURL);
      this.applyWallpaper(wallpaperURL);
    }
  }

  static async setLoginWallpaper(wallpaperURL) {
    if (wallpaperURL === "none" || !wallpaperURL) {
      os.storage.remove(StorageKeys.loginWallpaperKey);
      await WallpaperStore._clearWallpaperBlob(WallpaperStore.WP_LOGIN_BLOB_KEY).catch(() => {});
      os.events.emit(BusEvents.LOGIN_WALLPAPER_CHANGED, { wallpaper: null });
      return;
    }

    if (isBlob(wallpaperURL)) {
      const type = wallpaperURL.type.startsWith("video/") ? "video" : "img";
      await WallpaperStore._storeWallpaperBlob(wallpaperURL, WallpaperStore.WP_LOGIN_BLOB_KEY);
      os.storage.set(StorageKeys.loginWallpaperKey, type === "video" ? "__blob_video__" : "__blob_image__");
      os.events.emit(BusEvents.LOGIN_WALLPAPER_CHANGED, { wallpaper: "__blob__" });
      return;
    }

    wallpaperURL = this._normalizeWallpaperUrl(wallpaperURL);
    os.storage.set(StorageKeys.loginWallpaperKey, wallpaperURL);
    os.events.emit(BusEvents.LOGIN_WALLPAPER_CHANGED, { wallpaper: wallpaperURL });

    if (WallpaperStore._isBase64Video(wallpaperURL)) {
      const blob = this._dataURItoBlob(wallpaperURL);
      await WallpaperStore._storeWallpaperBlob(blob, WallpaperStore.WP_LOGIN_BLOB_KEY);
      os.storage.set(StorageKeys.loginWallpaperKey, "__blob_video__");
    } else if (WallpaperStore._isBase64Image(wallpaperURL)) {
      if (wallpaperURL.length > 524288) {
        const blob = this._dataURItoBlob(wallpaperURL);
        await WallpaperStore._storeWallpaperBlob(blob, WallpaperStore.WP_LOGIN_BLOB_KEY);
        os.storage.set(StorageKeys.loginWallpaperKey, "__blob_image__");
      } else {
        await WallpaperStore._clearWallpaperBlob(WallpaperStore.WP_LOGIN_BLOB_KEY).catch(() => {});
      }
    } else {
      await WallpaperStore._clearWallpaperBlob(WallpaperStore.WP_LOGIN_BLOB_KEY).catch(() => {});
    }
  }

  static async getLoginWallpaper() {
    const saved = os.storage.get(StorageKeys.loginWallpaperKey);
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
        (wallpaperURL.startsWith("blob:") && os.storage.get(StorageKeys.wallpaperKey) === "__blob_video__"));
    this._renderElement(isVideo ? "video" : "img", wallpaperURL);
  }

  static _renderElement(tag, src) {
    WallpaperStore._destroyVantaInstance();
    document.getElementById("vanta-container")?.remove();
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
    const shouldCycle = os.storage.get(StorageKeys.cycleWallpaper) !== "false";
    const isManual = os.storage.get(StorageKeys.manualWallpaper) === "true";
    const saved = os.storage.get(StorageKeys.wallpaperKey);

    if (this._isVantaCustom(saved)) {
      const customConfig = saved.replace("vanta:custom:", "");
      const success = await this._applyCustomVantaEffect(customConfig);
      if (success) {
        return;
      }
      this.setSequentialWallpaper();
      return;
    }

    if (this._isVantaPreset(saved)) {
      const presetId = saved.replace("vanta:", "");
      const success = await this._applyVantaEffect(presetId);
      if (success) {
        os.storage.set(StorageKeys.vantaWallpaper, presetId);
        return;
      }
      this.setSequentialWallpaper();
      return;
    }

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
      if (normalized !== saved) os.storage.set(StorageKeys.wallpaperKey, normalized);
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
      os.events.on(BusEvents.SETTINGS_CHANGED, (settings) => {
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

    if (os.storage.get(StorageKeys.weather) === "false") return;

    os.tray.register("weatherApp", "🌡️", "Loading weather...", {
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

        os.tray.updateIcon("weatherApp", icon);
        os.tray.updateLabel("weatherApp", `${temp}°C`);
      } catch {
        os.tray.unregister("weatherApp");
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
    os.tray.unregister("weatherApp");
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
