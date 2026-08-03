import { createElement } from "./shared/domUtils.js";
import { detectUserLocation, getCached, setCache } from "./apps/weather.js";
import { getWeatherIcon } from "./shared/weatherCodes.js";
import { DEFAULT_WALLPAPER_FILES, WALLPAPER_STATIC_DIR, STATIC_FALLBACK_WALLPAPERS } from "./wallpaperConfig.js";
import { createCalendarPopup, setCurrentCalendarMonth } from "./apps/calendar.js";
import { resolveWallpaperUrl } from "./shared/assetResolver.js";
import { BusEvents } from "./core/EventBus.js";
import { getVantaPresetById } from "./vantaPresets.js";
import { vantaPresets } from "./vantaPresets.js";
import { loadVantaEffect } from "./vanta/vantaLoader.js";
import { parseBool } from "./utils/utils.js";

import { StorageKeys, os, MODES, isYuri } from "./framework.js";
import { getYuriWallpapers } from "./yuriWallpapers.js";
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
  static currentWallpaperBlobUrl = null;
  static currentLoginWallpaperBlobUrl = null;
  static WP_BLOB_DB_NAME = "wallpaper-blobs-db";
  static WP_BLOB_DB_VERSION = 1;
  static WP_BLOB_STORE = "wallpapers";
  static WP_BLOB_KEY = "current";
  static WP_LOGIN_BLOB_KEY = "login_current";
  static wpBlobDB = null;
  static currentVantaInstance = null;

  static revokeWallpaperBlob(isLogin = false) {
    if (isLogin) {
      if (this.currentLoginWallpaperBlobUrl) {
        URL.revokeObjectURL(this.currentLoginWallpaperBlobUrl);
        this.currentLoginWallpaperBlobUrl = null;
      }
    } else {
      if (this.currentWallpaperBlobUrl) {
        URL.revokeObjectURL(this.currentWallpaperBlobUrl);
        this.currentWallpaperBlobUrl = null;
      }
    }
  }

  static destroyVantaInstance() {
    if (this.currentVantaInstance) {
      try {
        this.currentVantaInstance.destroy();
      } catch (error) {
        console.warn("Error destroying Vanta instance:", error);
      }
      this.currentVantaInstance = null;
    }
  }

  static isBase64Video(str) {
    return typeof str === "string" && str.startsWith("data:video/");
  }

  static isBase64Image(str) {
    return typeof str === "string" && str.startsWith("data:image/");
  }

  static base64ToBlobUrl(dataUrl) {
    const [header, b64] = dataUrl.split(",");
    const mime = header.match(/:(.*?);/)[1];
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: mime });
    return URL.createObjectURL(blob);
  }

  static openWpBlobDB() {
    if (this.wpBlobDB) return Promise.resolve(this.wpBlobDB);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.WP_BLOB_DB_NAME, this.WP_BLOB_DB_VERSION);
      req.onupgradeneeded = (e) => {
        e.target.result.createObjectStore(this.WP_BLOB_STORE);
      };
      req.onsuccess = (e) => {
        this.wpBlobDB = e.target.result;
        resolve(this.wpBlobDB);
      };
      req.onerror = (e) => reject(e);
    });
  }

  static async storeWallpaperBlob(blob, key = this.WP_BLOB_KEY) {
    const db = await this.openWpBlobDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.WP_BLOB_STORE, "readwrite");
      tx.objectStore(this.WP_BLOB_STORE).put(blob, key);
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e);
    });
  }

  static async loadWallpaperBlob(key = this.WP_BLOB_KEY) {
    const db = await this.openWpBlobDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.WP_BLOB_STORE, "readonly");
      const req = tx.objectStore(this.WP_BLOB_STORE).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = (e) => reject(e);
    });
  }

  static async clearWallpaperBlob(key = this.WP_BLOB_KEY) {
    const db = await this.openWpBlobDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.WP_BLOB_STORE, "readwrite");
      tx.objectStore(this.WP_BLOB_STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e);
    });
  }
}

class WallpaperManager {
  static normalizeWallpaperUrl(url) {
    return resolveWallpaperUrl(url);
  }

  static pickStaticFallbackWallpaper() {
    const list = STATIC_FALLBACK_WALLPAPERS;
    if (!list?.length) return "/static/wallpapers/wallpaper1.webp";
    const picked = list[Math.floor(Math.random() * list.length)];
    return this.normalizeWallpaperUrl(picked);
  }

  static isVantaPreset(value) {
    return typeof value === "string" && value.startsWith("vanta:");
  }

  static isVantaCustom(value) {
    return typeof value === "string" && value.startsWith("vanta:custom:");
  }

  static async applyVantaEffect(presetId) {
    const preset = getVantaPresetById(parseInt(presetId));
    if (!preset) {
      console.error("Vanta preset not found:", presetId);
      return false;
    }

    WallpaperStore.destroyVantaInstance();
    document.getElementById("wallpaper-img")?.remove();
    document.getElementById("wallpaper-video")?.remove();

    const container = createElement("div");
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

    const VantaEffect = await loadVantaEffect(preset.effect);
    if (!VantaEffect) {
      console.error("Vanta effect not found:", preset.effect);
      container.remove();
      return false;
    }

    try {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await new Promise((resolve) => setTimeout(resolve, 50));

      WallpaperStore.currentVantaInstance = VantaEffect({
        el: container,
        ...preset.options
      });
      return true;
    } catch (error) {
      console.error("Failed to initialize Vanta effect:", error);
      container.remove();
      return false;
    }
  }

  static async applyCustomVantaEffect(customConfig) {
    try {
      const preset = JSON.parse(atob(customConfig));
      if (!preset || !preset.effect || !preset.options) {
        console.error("Invalid custom Vanta configuration");
        return false;
      }

      WallpaperStore.destroyVantaInstance();
      document.getElementById("wallpaper-img")?.remove();
      document.getElementById("wallpaper-video")?.remove();

      const container = createElement("div");
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

      const VantaEffect = await loadVantaEffect(preset.effect);
      if (!VantaEffect) {
        console.error("Vanta effect not found:", preset.effect);
        container.remove();
        return false;
      }

      await new Promise((resolve) => requestAnimationFrame(resolve));
      await new Promise((resolve) => setTimeout(resolve, 50));

      WallpaperStore.currentVantaInstance = VantaEffect({
        el: container,
        ...preset.options
      });
      return true;
    } catch (error) {
      console.error("Failed to apply custom Vanta effect:", error);
      return false;
    }
  }

  static getWallpaperType(url) {
    if (!url || typeof url !== "string") return "image";
    if (url.startsWith("vanta:")) return "vanta";
    if (url.endsWith(".mp4")) return "video";
    return "image";
  }

  static async setSequentialWallpaper() {
    const isManual = parseBool(os.storage.get(StorageKeys.manualWallpaper));
    if (isManual) return;

    const shouldCycle = parseBool(os.storage.get(StorageKeys.cycleWallpaper), true);
    if (!shouldCycle) return;

    const existing = os.storage.get(StorageKeys.wallpaperKey);

    const wallpaperType = os.storage.get(StorageKeys.wallpaperType) || "image";
    let newWallpaperType = wallpaperType;

    if (existing) {
      const type = this.getWallpaperType(existing);
      if (type !== wallpaperType) {
        newWallpaperType = type;
        os.storage.set(StorageKeys.wallpaperType, newWallpaperType);
      }
    }

    const hasImages = typeof DEFAULT_WALLPAPER_FILES !== "undefined" && DEFAULT_WALLPAPER_FILES.length;
    const hasVanta = vantaPresets && vantaPresets.length;

    if (!hasImages && !hasVanta) {
      const fallback = this.pickStaticFallbackWallpaper();
      os.storage.set(StorageKeys.wallpaperKey, fallback);
      this.applyWallpaper(fallback);
      return;
    }

    const randomChoice = Math.random();
    let wallpaper;

    if (randomChoice < 0.33) {
      if (hasImages) {
        newWallpaperType = "image";
        os.storage.set(StorageKeys.wallpaperType, "image");

        let index = os.storage.get(StorageKeys.wallpaperIndexKey) || 0;
        const expectedWallpaper = WALLPAPER_STATIC_DIR + DEFAULT_WALLPAPER_FILES[index];

        if (existing !== expectedWallpaper) {
          wallpaper = WALLPAPER_STATIC_DIR + DEFAULT_WALLPAPER_FILES[index];
          os.storage.set(StorageKeys.wallpaperKey, wallpaper);
          WallpaperStore.clearWallpaperBlob().catch(() => {});
          this.applyWallpaper(wallpaper);
          return;
        }

        index = (index + 1) % DEFAULT_WALLPAPER_FILES.length;
        os.storage.set(StorageKeys.wallpaperIndexKey, String(index));
        wallpaper = WALLPAPER_STATIC_DIR + DEFAULT_WALLPAPER_FILES[index];
      } else if (hasVanta) {
        newWallpaperType = "vanta";
        os.storage.set(StorageKeys.wallpaperType, "vanta");
        const vantaIndex = Math.floor(Math.random() * vantaPresets.length);
        const preset = vantaPresets[vantaIndex];
        wallpaper = `vanta:${preset.id}`;
      }
    } else if (randomChoice < 0.66) {
      if (hasVanta) {
        newWallpaperType = "vanta";
        os.storage.set(StorageKeys.wallpaperType, "vanta");
        const vantaIndex = Math.floor(Math.random() * vantaPresets.length);
        const preset = vantaPresets[vantaIndex];
        wallpaper = `vanta:${preset.id}`;
      } else if (hasImages) {
        newWallpaperType = "image";
        os.storage.set(StorageKeys.wallpaperType, "image");
        let index = os.storage.get(StorageKeys.wallpaperIndexKey) || 0;
        wallpaper = WALLPAPER_STATIC_DIR + DEFAULT_WALLPAPER_FILES[index];
      }
    } else {
      if (hasVanta) {
        newWallpaperType = "vanta";
        os.storage.set(StorageKeys.wallpaperType, "vanta");
        const vantaIndex = Math.floor(Math.random() * vantaPresets.length);
        const preset = vantaPresets[vantaIndex];
        wallpaper = `vanta:${preset.id}`;
      } else if (hasImages) {
        newWallpaperType = "image";
        os.storage.set(StorageKeys.wallpaperType, "image");
        let index = os.storage.get(StorageKeys.wallpaperIndexKey) || 0;
        wallpaper = WALLPAPER_STATIC_DIR + DEFAULT_WALLPAPER_FILES[index];
      }
    }

    if (!wallpaper) {
      const fallback = this.pickStaticFallbackWallpaper();
      os.storage.set(StorageKeys.wallpaperKey, fallback);
      this.applyWallpaper(fallback);
      return;
    }

    os.storage.set(StorageKeys.wallpaperKey, wallpaper);
    WallpaperStore.clearWallpaperBlob().catch(() => {});

    if (this.isVantaPreset(wallpaper)) {
      const presetId = wallpaper.replace("vanta:", "");
      await this.applyVantaEffect(presetId);
    } else if (this.isVantaCustom(wallpaper)) {
      const customConfig = wallpaper.replace("vanta:custom:", "");
      await this.applyCustomVantaEffect(customConfig);
    } else {
      this.applyWallpaper(wallpaper);
    }
  }

  static async setWallpaper(wallpaperURL) {
    if (!wallpaperURL) return;

    if (this.isVantaCustom(wallpaperURL)) {
      const customConfig = wallpaperURL.replace("vanta:custom:", "");
      const success = await this.applyCustomVantaEffect(customConfig);
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

    if (this.isVantaPreset(wallpaperURL)) {
      const presetId = wallpaperURL.replace("vanta:", "");
      const success = await this.applyVantaEffect(presetId);
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
      await WallpaperStore.storeWallpaperBlob(wallpaperURL);
      os.storage.set(StorageKeys.wallpaperKey, type === "video" ? "__blob_video__" : "__blob_image__");
      os.storage.set(StorageKeys.manualWallpaper, "true");
      os.storage.set(StorageKeys.cycleWallpaper, "false");
      os.storage.remove(StorageKeys.vantaWallpaper);
      const toggle = document.getElementById("settingsCycleWallpaper");
      if (toggle) toggle.checked = false;

      this.applyBlob(wallpaperURL, type);
      os.events.emit(BusEvents.WALLPAPER_CHANGED, { wallpaper: "__blob__" });
      return;
    }

    wallpaperURL = this.normalizeWallpaperUrl(wallpaperURL);

    os.events.emit(BusEvents.WALLPAPER_CHANGED, { url: wallpaperURL });

    os.storage.set(StorageKeys.manualWallpaper, "true");
    os.storage.set(StorageKeys.cycleWallpaper, "false");
    os.storage.remove(StorageKeys.vantaWallpaper);

    const toggle = document.getElementById("settingsCycleWallpaper");
    if (toggle) toggle.checked = false;

    if (WallpaperStore.isBase64Video(wallpaperURL)) {
      const blob = this.dataURItoBlob(wallpaperURL);
      await WallpaperStore.storeWallpaperBlob(blob);
      os.storage.set(StorageKeys.wallpaperKey, "__blob_video__");
      this.applyBlob(blob, "video");
    } else if (WallpaperStore.isBase64Image(wallpaperURL)) {
      if (wallpaperURL.length > 524288) {
        const blob = this.dataURItoBlob(wallpaperURL);
        await WallpaperStore.storeWallpaperBlob(blob);
        os.storage.set(StorageKeys.wallpaperKey, "__blob_image__");
        this.applyBlob(blob, "img");
      } else {
        await WallpaperStore.clearWallpaperBlob().catch(() => {});
        os.storage.set(StorageKeys.wallpaperKey, wallpaperURL);
        this.applyWallpaper(wallpaperURL);
      }
    } else {
      await WallpaperStore.clearWallpaperBlob().catch(() => {});
      os.storage.set(StorageKeys.wallpaperKey, wallpaperURL);
      this.applyWallpaper(wallpaperURL);
    }
  }

  static async setLoginWallpaper(wallpaperURL) {
    if (wallpaperURL === "none" || !wallpaperURL) {
      os.storage.remove(StorageKeys.loginWallpaperKey);
      await WallpaperStore.clearWallpaperBlob(WallpaperStore.WP_LOGIN_BLOB_KEY).catch(() => {});
      os.events.emit(BusEvents.LOGIN_WALLPAPER_CHANGED, { wallpaper: null });
      return;
    }

    if (isBlob(wallpaperURL)) {
      const type = wallpaperURL.type.startsWith("video/") ? "video" : "img";
      await WallpaperStore.storeWallpaperBlob(wallpaperURL, WallpaperStore.WP_LOGIN_BLOB_KEY);
      os.storage.set(StorageKeys.loginWallpaperKey, type === "video" ? "__blob_video__" : "__blob_image__");
      os.events.emit(BusEvents.LOGIN_WALLPAPER_CHANGED, { wallpaper: "__blob__" });
      return;
    }

    wallpaperURL = this.normalizeWallpaperUrl(wallpaperURL);
    os.storage.set(StorageKeys.loginWallpaperKey, wallpaperURL);
    os.events.emit(BusEvents.LOGIN_WALLPAPER_CHANGED, { wallpaper: wallpaperURL });

    if (WallpaperStore.isBase64Video(wallpaperURL)) {
      const blob = this.dataURItoBlob(wallpaperURL);
      await WallpaperStore.storeWallpaperBlob(blob, WallpaperStore.WP_LOGIN_BLOB_KEY);
      os.storage.set(StorageKeys.loginWallpaperKey, "__blob_video__");
    } else if (WallpaperStore.isBase64Image(wallpaperURL)) {
      if (wallpaperURL.length > 524288) {
        const blob = this.dataURItoBlob(wallpaperURL);
        await WallpaperStore.storeWallpaperBlob(blob, WallpaperStore.WP_LOGIN_BLOB_KEY);
        os.storage.set(StorageKeys.loginWallpaperKey, "__blob_image__");
      } else {
        await WallpaperStore.clearWallpaperBlob(WallpaperStore.WP_LOGIN_BLOB_KEY).catch(() => {});
      }
    } else {
      await WallpaperStore.clearWallpaperBlob(WallpaperStore.WP_LOGIN_BLOB_KEY).catch(() => {});
    }
  }

  static async getLoginWallpaper() {
    const saved = os.storage.get(StorageKeys.loginWallpaperKey);
    if (!saved || saved === "none") return null;
    if (saved === "__blob_video__" || saved === "__blob_image__") {
      try {
        const blob = await WallpaperStore.loadWallpaperBlob(WallpaperStore.WP_LOGIN_BLOB_KEY);
        if (blob) {
          WallpaperStore.revokeWallpaperBlob(true);
          WallpaperStore.currentLoginWallpaperBlobUrl = URL.createObjectURL(blob);
          return { url: WallpaperStore.currentLoginWallpaperBlobUrl, isVideo: saved === "__blob_video__" };
        }
      } catch (e) {}
      return null;
    }
    if (WallpaperStore.isBase64Video(saved)) {
      WallpaperStore.revokeWallpaperBlob(true);
      WallpaperStore.currentLoginWallpaperBlobUrl = WallpaperStore.base64ToBlobUrl(saved);
      return { url: WallpaperStore.currentLoginWallpaperBlobUrl, isVideo: true };
    }
    if (WallpaperStore.isBase64Image(saved)) {
      WallpaperStore.revokeWallpaperBlob(true);
      WallpaperStore.currentLoginWallpaperBlobUrl = WallpaperStore.base64ToBlobUrl(saved);
      return { url: WallpaperStore.currentLoginWallpaperBlobUrl, isVideo: false };
    }
    const isVideo =
      typeof saved === "string" && (saved.toLowerCase().endsWith(".mp4") || saved.toLowerCase().endsWith(".webm"));
    return { url: saved, isVideo };
  }

  static dataURItoBlob(dataUrl) {
    const [header, b64] = dataUrl.split(",");
    const mime = header.match(/:(.*?);/)[1];
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  static applyBlob(blob, type) {
    WallpaperStore.revokeWallpaperBlob();
    WallpaperStore.currentWallpaperBlobUrl = URL.createObjectURL(blob);
    this.renderElement(type, WallpaperStore.currentWallpaperBlobUrl);
  }

  static applyWallpaper(wallpaperURL) {
    if (!wallpaperURL) return;
    wallpaperURL = this.normalizeWallpaperUrl(wallpaperURL);

    if (WallpaperStore.isBase64Video(wallpaperURL)) {
      WallpaperStore.revokeWallpaperBlob();
      WallpaperStore.currentWallpaperBlobUrl = WallpaperStore.base64ToBlobUrl(wallpaperURL);
      this.renderElement("video", WallpaperStore.currentWallpaperBlobUrl);
      return;
    }

    if (WallpaperStore.isBase64Image(wallpaperURL)) {
      WallpaperStore.revokeWallpaperBlob();
      WallpaperStore.currentWallpaperBlobUrl = WallpaperStore.base64ToBlobUrl(wallpaperURL);
      this.renderElement("img", WallpaperStore.currentWallpaperBlobUrl);
      return;
    }

    WallpaperStore.revokeWallpaperBlob();
    const isVideo =
      typeof wallpaperURL === "string" &&
      (wallpaperURL.toLowerCase().endsWith(".mp4") ||
        wallpaperURL.toLowerCase().endsWith(".webm") ||
        wallpaperURL.startsWith("data:video") ||
        (wallpaperURL.startsWith("blob:") && os.storage.get(StorageKeys.wallpaperKey) === "__blob_video__"));
    this.renderElement(isVideo ? "video" : "img", wallpaperURL);
  }

  static renderElement(tag, src) {
    WallpaperStore.destroyVantaInstance();
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
    el.classList.add("wallpaper-enter");
    document.body.appendChild(el);

    if (isVideo) {
      let didFallback = false;
      const fallbackToStatic = () => {
        if (didFallback) return;
        didFallback = true;
        const fallback = this.pickStaticFallbackWallpaper();
        console.warn("Wallpaper video failed to load; falling back to static wallpaper:", src);
        this.renderElement("img", fallback);
      };

      el.addEventListener("error", fallbackToStatic, { once: true });

      let retryCount = 0;
      const tryPlay = () => {
        try {
          const p = el.play?.();
          if (p && typeof p.catch === "function")
            p.catch(() => {
              if (retryCount < 3) {
                retryCount++;
                setTimeout(tryPlay, 2000 * retryCount);
              } else {
                fallbackToStatic();
              }
            });
        } catch {
          if (retryCount < 3) {
            retryCount++;
            setTimeout(tryPlay, 2000 * retryCount);
          } else {
            fallbackToStatic();
          }
        }
      };

      const loadTimeoutMs = 30000;
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
    const shouldCycle = parseBool(os.storage.get(StorageKeys.cycleWallpaper), true);
    const isManual = parseBool(os.storage.get(StorageKeys.manualWallpaper));
    const saved = os.storage.get(StorageKeys.wallpaperKey);

    if (this.isVantaCustom(saved)) {
      const customConfig = saved.replace("vanta:custom:", "");
      const success = await this.applyCustomVantaEffect(customConfig);
      if (success) {
        return;
      }
      await this.setSequentialWallpaper();
      return;
    }

    if (this.isVantaPreset(saved)) {
      const presetId = saved.replace("vanta:", "");
      const success = await this.applyVantaEffect(presetId);
      if (success) {
        os.storage.set(StorageKeys.vantaWallpaper, presetId);
        return;
      }
      await this.setSequentialWallpaper();
      return;
    }

    if (saved === "__blob_video__" || saved === "__blob_image__") {
      try {
        const blob = await WallpaperStore.loadWallpaperBlob();
        if (blob) {
          this.applyBlob(blob, saved === "__blob_video__" ? "video" : "img");
          return;
        }
      } catch (e) {
        console.warn("Failed to load wallpaper blob", e);
      }
      await this.setSequentialWallpaper();
      return;
    }

    if (isYuri() && !isManual) {
      const yuriWalls = getYuriWallpapers();
      if (yuriWalls.length) {
        const pick = yuriWalls[Math.floor(Math.random() * yuriWalls.length)];
        os.storage.set(StorageKeys.wallpaperKey, pick.url);
        this.applyWallpaper(pick.url);
        return;
      }
    }

    if ((isManual && saved) || (!shouldCycle && saved)) {
      const normalized = this.normalizeWallpaperUrl(saved);
      if (normalized !== saved) os.storage.set(StorageKeys.wallpaperKey, normalized);
      this.applyWallpaper(normalized);
    } else {
      await this.setSequentialWallpaper();
    }
  }
}

let settings;
let skipUsernameUpdate = false;

let pageLoadTime;
pageLoadTime = Date.now();

let weatherIntervalId = null;

export class SystemUtilities {
  static async loadWallpaper() {
    await WallpaperManager.loadWallpaper();
  }
  static setSettings(settings) {
    settings = settings;
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

    import("./services/timeWorker.js").then(({ subscribeTimeTick }) => {
      subscribeTimeTick((data) => {
        clock.textContent = data.timeStr;
        date.textContent = data.dateStr;
      });
    });

    if (uptime) {
      setInterval(() => {
        uptime.textContent = `${Math.floor((Date.now() - pageLoadTime) / 60000)} min`;
      }, 60000);
    }
  }

  static async startTaskbarWeather() {
    if (os.modes.isActive(MODES.MAC)) return;
    if (!SystemUtilities.weatherEventBound) {
      SystemUtilities.weatherEventBound = true;
      os.events.on(BusEvents.SETTINGS_CHANGED, (settings) => {
        if (settings && typeof settings.weather !== "undefined") {
          if (settings.weather) {
            SystemUtilities.stopTaskbarWeather();
            SystemUtilities.startTaskbarWeather();
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
        os.app.launch("weatherApp");
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
    weatherIntervalId = setInterval(fetchAndRender, 10 * 60 * 1000);
  }

  static stopTaskbarWeather() {
    if (weatherIntervalId !== null) {
      clearInterval(weatherIntervalId);
      weatherIntervalId = null;
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
  static disableVantaWallpaper() {
    WallpaperStore.destroyVantaInstance();
    document.getElementById("vanta-container")?.remove();
    const fallback = WallpaperManager.pickStaticFallbackWallpaper();
    WallpaperManager.applyWallpaper(fallback);
  }
}
