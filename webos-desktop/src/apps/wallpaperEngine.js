import "../styles/wallpaperEngine.css";
import { BaseApp, os, StorageKeys, MODES } from "../framework.js";
import { SystemUtilities } from "../system.js";
import { WALLPAPER_NAME_URL_PAIRS, MAC_WALLPAPER_NAME_URL_PAIRS } from "../wallpaperConfig.js";
import { videos, videos2 } from "../wallpaperList.js";
import { vantaPresets } from "../vantaPresets.js";
import { resolveWallpaperUrl } from "../shared/assetResolver.js";
import { FileKind } from "../shared/fileKindDetector.js";

import { $, $$, bindEvent, setText, setHTML, createElement } from "../shared/domUtils.js";
import { renderRangeSlider, bindRangeSlider, getRangeSliderValue, setRangeSliderValue } from "../shared/rangeSlider.js";
import { renderSelectMenu, bindSelectMenu, getSelectMenuValue } from "../shared/selectMenu.js";
import { showContextMenu, hideMenu } from "../shared/contextMenu.js";

const WE_KEYS = {
  favorites: StorageKeys.wallpaperEngineFavorites,
  history: StorageKeys.wallpaperEngineHistory,
  playlists: StorageKeys.wallpaperEnginePlaylists,
  activePlaylist: StorageKeys.wallpaperEngineActivePlaylist,
  shuffleInterval: StorageKeys.wallpaperEngineShuffleInterval,

  viewMode: StorageKeys.wallpaperEngineViewMode,
  searchHistory: StorageKeys.wallpaperEngineSearchHistory,
  colorFilter: StorageKeys.wallpaperEngineColorFilter,
  customVantaPresets: StorageKeys.wallpaperEngineCustomVantaPresets
};

const DEFAULT_FILTER = { brightness: 100, contrast: 100, saturate: 100, blur: 0 };

const VANTA_DEFAULTS = {
  WAVES: { color: 0x1e1e1e, shininess: 50, waveHeight: 20, waveSpeed: 1, zoom: 0.75 },
  BIRDS: { color1: 0x1e1e1e, color2: 0x4a00e0, birdSize: 1, speedLimit: 5 },
  NET: { color: 0x1e1e1e, backgroundColor: 0x0a0a0a, points: 10, distance: 18, spacing: 18 },
  DOTS: { color: 0x4a00e0, color2: 0x1e1e1e, size: 2.5, spacing: 40 },
  GLOBE: { color: 0x4a00e0, color2: 0x1e1e1e, size: 1.2, deviation: 200 },
  HALO: { color: 0x1e1e1e, backgroundColor: 0x0a0a0a, size: 1.5 },
  FOG: { color: 0x1e1e1e, highlightColor: 0x4a00e0, speed: 1 },
  CELLS: { color: 0x1e1e1e, color2: 0x4a00e0, size: 1.5, speed: 1 }
};

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

function toBlobUrl(content) {
  if (!content) return null;
  if (isBlob(content)) return URL.createObjectURL(content);
  if (typeof content !== "string") return null;
  if (content.startsWith("http") || content.startsWith("/") || content.startsWith("blob:")) return content;
  if (content.startsWith("data:")) {
    const [header, b64] = content.split(",");
    const mime = header.match(/data:(.*?);/)?.[1] ?? "application/octet-stream";
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: mime }));
  }
  return null;
}

function getVideoThumbnailUrl(src) {
  if (typeof src !== "string") return null;
  const match = src.match(/\/media\/(\d+)\/(.*?)(?:\.\d+x\d+)?\.mp4$/);
  if (match) return `https://motionbgs.com/i/c/364x205/media/${match[1]}/${match[2]}.jpg`;
  return null;
}

function extractVideoName(src) {
  const match = src.match(/\/([^/]+?)\.\d+x\d+\.mp4$/);
  if (match) return match[1].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const m2 = src.match(/\/([^/]+?)\.mp4$/);
  if (m2) return m2[1].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return "Video Wallpaper";
}

function getExtension(filename) {
  return filename?.split(".").pop()?.toLowerCase() || "";
}

function isVideoFile(name) {
  return ["mp4", "webm", "mov", "avi", "gif"].includes(getExtension(name));
}

function loadJSON(key, fallback) {
  try {
    const r = os.storage.get(key);
    return r ? JSON.parse(r) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, val) {
  os.storage.set(key, JSON.stringify(val));
}

export class WallpaperEngineApp extends BaseApp {
  constructor(os) {
    super(os);
    this.fs = os.fs;
    this.winId = null;
    this.win = null;
    this.currentCategory = "all";
    this.searchQuery = "";
    this.wallpaperItems = [];
    this.favorites = loadJSON(WE_KEYS.favorites, []);
    this.history = loadJSON(WE_KEYS.history, []);
    this.playlists = loadJSON(WE_KEYS.playlists, {});
    this.activePlaylist = os.storage.get(WE_KEYS.activePlaylist) || null;
    this.colorFilter = loadJSON(WE_KEYS.colorFilter, DEFAULT_FILTER);
    this.customVantaPresets = loadJSON(WE_KEYS.customVantaPresets, []);
    this.shuffleTimer = null;
    this.previewItem = null;
    this.selectedItems = new Set();
    this.sortMode = "default";
    this.tooltipTimer = null;
  }

  saveFavorites() {
    saveJSON(WE_KEYS.favorites, this.favorites);
  }
  saveHistory() {
    saveJSON(WE_KEYS.history, this.history.slice(0, 50));
  }
  savePlaylists() {
    saveJSON(WE_KEYS.playlists, this.playlists);
  }
  saveFilter() {
    saveJSON(WE_KEYS.colorFilter, this.colorFilter);
  }

  addToHistory(id) {
    this.history = this.history.filter((h) => h !== id);
    this.history.unshift(id);
    this.saveHistory();
  }

  async open(opts) {
    if (await this.isSingletonOpen("wallpaper-engine")) return;
    if (!this.fs) return;

    const win = os.window.create("wallpaper-engine", "Wallpaper Engine", "960px", "640px", {
      icon: "fas fa-paint-roller"
    });

    this.winId = "wallpaper-engine";
    this.win = win;

    this.applyColorFilter();
    this.renderUI(win);
    this.loadAllWallpapers();
    this.initAutoCycle();
    this.initTray();
  }

  onClose(winId) {
    if (this.shuffleTimer) {
      clearInterval(this.shuffleTimer);
      this.shuffleTimer = null;
    }
    os.tray.unregister("wallpaper-engine");
    $$(".we-tooltip").forEach((el) => el.remove());
    $$(".we-fs-overlay").forEach((el) => el.remove());
    this.winId = null;
    this.win = null;
  }

  initTray() {
    if (os.modes.isActive(MODES.MAC)) return;
    os.tray.register("wallpaper-engine", "fas fa-paint-roller", "Wallpaper Engine", {
      showInTray: true,
      priority: 5,
      onClick: () => {
        os.app.launch("wallpaperEngineApp");
      },
      contextMenuItems: [
        { label: "Random Wallpaper", action: () => this.shuffleRandom(), icon: "fa-dice" },
        {
          label: "Open Wallpaper Engine",
          action: () => os.app.launch("wallpaperEngineApp"),
          icon: "fa-external-link-alt"
        },
        { type: "divider" },
        {
          label: "Cycle: " + (os.storage.get(StorageKeys.cycleWallpaper) !== "false" ? "On" : "Off"),
          action: () => {
            const current = os.storage.get(StorageKeys.cycleWallpaper) !== "false";
            os.storage.set(StorageKeys.cycleWallpaper, current ? "false" : "true");
            this.initAutoCycle();
            os.tray.updateContextMenuItems("wallpaper-engine", this.getTrayItems());
          },
          icon: "fa-sync"
        }
      ]
    });
  }

  getTrayItems() {
    return [
      { label: "Random Wallpaper", action: () => this.shuffleRandom(), icon: "fa-dice" },
      {
        label: "Open Wallpaper Engine",
        action: () => os.app.launch("wallpaperEngineApp"),
        icon: "fa-external-link-alt"
      },
      { type: "divider" },
      {
        label: "Cycle: " + (os.storage.get(StorageKeys.cycleWallpaper) !== "false" ? "On" : "Off"),
        action: () => {
          const current = os.storage.get(StorageKeys.cycleWallpaper) !== "false";
          os.storage.set(StorageKeys.cycleWallpaper, current ? "false" : "true");
          this.initAutoCycle();
          os.tray.updateContextMenuItems("wallpaper-engine", this.getTrayItems());
        },
        icon: "fa-sync"
      }
    ];
  }

  applyColorFilter() {
    const f = this.colorFilter;
    const style = document.createElement("style");
    style.id = "we-color-filter-style";
    style.textContent = `#wallpaper-img, #wallpaper-video, #vanta-container { filter: brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturate}%) blur(${f.blur}px) !important; }`;
    document.getElementById("we-color-filter-style")?.remove();
    document.head.appendChild(style);
  }

  saveCustomVantaPresets() {
    saveJSON(WE_KEYS.customVantaPresets, this.customVantaPresets);
  }

  getNextCustomPresetId() {
    const maxId = this.customVantaPresets.reduce((max, p) => Math.max(max, p.id || 0), 0);
    return maxId + 1;
  }

  addCustomVantaPreset(preset) {
    const id = this.getNextCustomPresetId();
    const entry = { ...preset, id, isCustom: true };
    this.customVantaPresets.push(entry);
    this.saveCustomVantaPresets();
    return entry;
  }

  deleteCustomVantaPreset(presetId) {
    this.customVantaPresets = this.customVantaPresets.filter((p) => p.id !== presetId);
    this.saveCustomVantaPresets();
    this.wallpaperItems = this.wallpaperItems.filter((i) => i.id !== `vanta_custom_${presetId}`);
    this.renderGrid();
    this.updateStats();
  }

  updateCustomVantaPreset(presetId, updates) {
    const idx = this.customVantaPresets.findIndex((p) => p.id === presetId);
    if (idx === -1) return;
    this.customVantaPresets[idx] = { ...this.customVantaPresets[idx], ...updates };
    this.saveCustomVantaPresets();
  }

  updateFilter(key, val) {
    this.colorFilter[key] = val;
    this.saveFilter();
    this.applyColorFilter();
  }

  renderUI(container) {
    setHTML(
      container,
      `
      <div class="we-container">
        <div class="we-sidebar" id="we-sidebar"></div>
        <div class="we-main">
          <div class="we-toolbar" id="we-toolbar"></div>
          <div class="we-content" id="we-content"></div>
          <div class="we-bottom-bar" id="we-bottom-bar"></div>
        </div>
        <div class="we-preview-panel" id="we-preview-panel"></div>
      </div>
    `
    );
    this.renderSidebar();
    this.renderToolbar();
    this.renderBottomBar();
    this.setupDragDrop();
  }

  renderSidebar() {
    const sidebar = $("#we-sidebar", this.win);
    if (!sidebar) return;

    const categories = [
      { id: "all", icon: "fas fa-th-large", label: "All" },
      { id: "static", icon: "fas fa-image", label: "Static" },
      { id: "mac", icon: "fab fa-apple", label: "macOS" },
      { id: "video", icon: "fas fa-film", label: "Live Video" },
      { id: "vanta", icon: "fas fa-magic", label: "Animated" },
      { id: "custom-presets", icon: "fas fa-palette", label: "Custom Presets" },
      { id: "uploaded", icon: "fas fa-cloud-upload-alt", label: "Your Uploads" },
      { id: "favorites", icon: "fas fa-star", label: "Favorites" },
      { id: "recent", icon: "fas fa-clock", label: "Recent" }
    ];

    setHTML(
      sidebar,
      `
      <div class="we-sidebar-title">Categories</div>
      ${categories
        .map(
          (c) => `
        <div class="we-sidebar-item ${c.id === "all" ? "active" : ""}" data-cat="${c.id}">
          <i class="${c.icon}"></i>
          <span>${c.label}</span>
        </div>
      `
        )
        .join("")}
      <div class="we-sidebar-title" style="margin-top:12px;">Tools</div>
      <div class="we-sidebar-item" data-cat="__playlists"><i class="fas fa-list"></i><span>Playlists</span></div>
      <div class="we-sidebar-item" data-cat="__import"><i class="fas fa-link"></i><span>Import URL</span></div>
      <div class="we-sidebar-item" data-cat="__filters"><i class="fas fa-tint"></i><span>Color Filters</span></div>
    `
    );

    bindEvent(sidebar, "click", (e) => {
      const item = e.target.closest(".we-sidebar-item");
      if (!item) return;
      const cat = item.dataset.cat;
      $$(".we-sidebar-item", sidebar).forEach((el) => el.classList.remove("active"));
      item.classList.add("active");
      this.currentCategory = cat;
      if (cat === "__playlists") this.showPlaylistsView();
      else if (cat === "__import") this.showImportView();
      else if (cat === "__filters") this.showFiltersView();
      else this.renderGrid();
    });

    sidebar.querySelectorAll(".we-sidebar-item").forEach((item) => {
      bindEvent(item, "contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const cat = item.dataset.cat;
        if (cat === "__playlists") return;
        if (cat === "__import" || cat === "__filters") {
          showContextMenu(e, [{ id: "s-open-" + cat, label: "Open", action: "open", icon: "fa-arrow-right" }], {
            open: () => {
              item.click();
            }
          });
          return;
        }
        const label = item.querySelector("span")?.textContent || cat;
        showContextMenu(
          e,
          [
            { id: "s-show-" + cat, label: "Show " + label, action: "open", icon: "fa-arrow-right" },
            { id: "s-random-" + cat, label: "Random from " + label, action: "random", icon: "fa-dice" }
          ],
          {
            open: () => {
              item.click();
            },
            random: () => {
              this.currentCategory = cat;
              this.renderGrid();
              this.shuffleRandom();
            }
          }
        );
      });
    });
  }

  renderToolbar() {
    const toolbar = $("#we-toolbar", this.win);
    if (!toolbar) return;

    const sortOpts = [
      { label: "Default", value: "default" },
      { label: "Name A-Z", value: "name-asc" },
      { label: "Name Z-A", value: "name-desc" },
      { label: "Type", value: "type" }
    ];

    setHTML(
      toolbar,
      `
      <div class="we-search-wrap">
        <i class="fas fa-search we-search-icon"></i>
        <input class="we-search" id="we-search" type="text" placeholder="Search wallpapers..." />
      </div>
      <div class="we-sort-wrap">
        ${renderSelectMenu("we-sort-select", sortOpts, this.sortMode, "we-sort-select")}
      </div>
      <button class="we-toolbar-btn" id="we-upload-btn"><i class="fas fa-upload"></i> Upload</button>
      <button class="we-toolbar-btn we-toolbar-btn-random" id="we-random-btn"><i class="fas fa-dice"></i> Random</button>
      <input type="file" id="we-file-input" accept="image/*,video/*,.gif" style="display:none" multiple />
    `
    );

    bindSelectMenu(toolbar);
    bindEvent($("#we-sort-select", this.win), "change", () => {
      this.sortMode = getSelectMenuValue("we-sort-select", this.win);
      if (!this.currentCategory.startsWith("__")) this.renderGrid();
    });

    const search = $("#we-search", this.win);
    if (search) {
      bindEvent(search, "input", () => {
        this.searchQuery = search.value.trim().toLowerCase();
        if (!this.currentCategory.startsWith("__")) this.renderGrid();
      });
    }

    bindEvent($("#we-upload-btn", this.win), "click", () => {
      $("#we-file-input", this.win)?.click();
    });

    bindEvent($("#we-file-input", this.win), "change", (e) => {
      const files = e.target.files;
      if (!files?.length) return;
      this.handleUpload(files);
      e.target.value = "";
    });

    bindEvent($("#we-random-btn", this.win), "click", () => this.shuffleRandom());
  }

  renderBottomBar() {
    const bar = $("#we-bottom-bar", this.win);
    if (!bar) return;

    const isCycling = os.storage.get(StorageKeys.cycleWallpaper) !== "false";
    const interval = parseInt(os.storage.get(WE_KEYS.shuffleInterval)) || 30;

    setHTML(
      bar,
      `
      <div class="we-toggle-wrap">
        <label class="we-toggle">
          <input type="checkbox" id="we-cycle-toggle" ${isCycling ? "checked" : ""} />
          <span class="we-toggle-track"><span class="we-toggle-thumb"></span></span>
        </label>
        <span class="we-toggle-label">Auto cycle</span>
      </div>
      <span class="we-bar-label">Every</span>
      <div class="we-number-wrap">
        <input class="we-number-input" id="we-shuffle-interval" type="number" value="${interval}" min="5" max="999" />
      </div>
      <span class="we-bar-label">min</span>
      <span class="we-bar-spacer"></span>
      <span id="we-stats" class="we-bar-label"></span>
    `
    );

    bindEvent($("#we-cycle-toggle", this.win), "change", () => {
      const checked = $("#we-cycle-toggle", this.win).checked;
      os.storage.set(StorageKeys.cycleWallpaper, checked ? "true" : "false");
      this.initAutoCycle();
    });

    bindEvent($("#we-shuffle-interval", this.win), "change", () => {
      const val = parseInt($("#we-shuffle-interval", this.win).value) || 30;
      os.storage.set(WE_KEYS.shuffleInterval, String(val));
      this.initAutoCycle();
    });
  }

  initAutoCycle() {
    if (this.shuffleTimer) {
      clearInterval(this.shuffleTimer);
      this.shuffleTimer = null;
    }
    const enabled = os.storage.get(StorageKeys.cycleWallpaper) !== "false";
    if (!enabled) return;
    const interval = (parseInt(os.storage.get(WE_KEYS.shuffleInterval)) || 30) * 60 * 1000;
    this.shuffleTimer = setInterval(() => {
      if (this.activePlaylist && this.playlists[this.activePlaylist]) {
        const ids = this.playlists[this.activePlaylist];
        const pick = ids[Math.floor(Math.random() * ids.length)];
        const item = this.wallpaperItems.find((i) => i.id === pick);
        if (item) this.setDesktop(item, true);
      } else {
        SystemUtilities.setSequentialWallpaper?.();
      }
    }, interval);
  }

  async loadAllWallpapers() {
    const items = [];
    items.push(...this.getStaticWallpapers());
    items.push(...this.getMacWallpapers());
    items.push(...this.getVideoWallpapers());
    items.push(...this.getVantaWallpapers());
    items.push(...(await this.getUserWallpapers()));
    this.wallpaperItems = items;
    this.updateStats();
    this.renderGrid();
  }

  updateStats() {
    const stats = $("#we-stats", this.win);
    if (!stats) return;
    setText(stats, `${this.wallpaperItems.length} wallpapers`);
  }

  getStaticWallpapers() {
    return WALLPAPER_NAME_URL_PAIRS.map((wp) => ({
      id: `static_${wp.filename || wp.name}`,
      name: wp.name,
      type: "static",
      src: wp.url,
      thumbnail: resolveWallpaperUrl(wp.url),
      isVideo: false,
      meta: { source: "Built-in" }
    }));
  }

  getMacWallpapers() {
    return MAC_WALLPAPER_NAME_URL_PAIRS.map((wp) => ({
      id: `mac_${wp.filename || wp.name}`,
      name: wp.name,
      type: "mac",
      src: wp.url,
      thumbnail: resolveWallpaperUrl(wp.url),
      isVideo: false,
      meta: { source: "macOS" }
    }));
  }

  getVideoWallpapers() {
    return [...videos, ...videos2].map((url) => ({
      id: `video_${url}`,
      name: extractVideoName(url),
      type: "video",
      src: url,
      thumbnail: getVideoThumbnailUrl(url),
      isVideo: true,
      meta: { source: "motionbgs.com" }
    }));
  }

  getVantaWallpapers() {
    const builtIn = vantaPresets.map((p) => ({
      id: `vanta_${p.id}`,
      name: p.name,
      type: "vanta",
      src: `vanta:${p.id}`,
      thumbnail: null,
      vantaPreset: p,
      isVideo: false,
      isCustom: false,
      meta: { source: "Vanta.js", effect: p.effect }
    }));
    const custom = this.customVantaPresets.map((p) => ({
      id: `vanta_custom_${p.id}`,
      name: p.name,
      type: "vanta",
      src: `vanta:custom:${btoa(JSON.stringify({ effect: p.effect, options: p.options }))}`,
      thumbnail: null,
      vantaPreset: p,
      isVideo: false,
      isCustom: true,
      meta: { source: "Custom", effect: p.effect }
    }));
    return [...builtIn, ...custom];
  }

  async getUserWallpapers() {
    const items = [];
    try {
      const folder = await this.fs.getFolder(["Pictures", "Wallpapers"]);
      for (const [name, data] of Object.entries(folder)) {
        if (data?.type !== "file") continue;
        const isVideo = data.kind === FileKind.VIDEO || isVideoFile(name);
        let thumbnail = null;
        if (isVideo) {
          const content = await this.fs.getFileContent(["Pictures", "Wallpapers"], name);
          thumbnail = content instanceof Blob ? null : getVideoThumbnailUrl(content);
        } else if (data.icon === "@content") {
          const content = await this.fs.getFileContent(["Pictures", "Wallpapers"], name);
          thumbnail = toBlobUrl(content);
        } else if (data.icon) thumbnail = resolveWallpaperUrl(data.icon);
        items.push({
          id: `user_${name}`,
          name,
          type: "uploaded",
          src: name,
          thumbnail,
          isVideo,
          isUserUpload: true,
          userFileName: name,
          meta: { source: "Your Uploads" }
        });
      }
    } catch {}
    return items;
  }

  getFilteredItems() {
    let items = this.wallpaperItems;
    const cat = this.currentCategory;
    if (cat === "custom-presets") items = items.filter((i) => i.isCustom);
    else if (cat !== "all" && cat !== "favorites" && cat !== "recent") items = items.filter((i) => i.type === cat);
    else if (cat === "favorites") items = items.filter((i) => this.favorites.includes(i.id));
    else if (cat === "recent") {
      const ids = this.history;
      items = items.filter((i) => ids.includes(i.id));
      items.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    }
    if (this.searchQuery) {
      const q = this.searchQuery;
      items = items.filter((i) => i.name.toLowerCase().includes(q));
    }
    if (this.sortMode === "name-asc") items.sort((a, b) => a.name.localeCompare(b.name));
    else if (this.sortMode === "name-desc") items.sort((a, b) => b.name.localeCompare(a.name));
    else if (this.sortMode === "type") items.sort((a, b) => a.type.localeCompare(b.type));
    return items;
  }

  renderGrid() {
    const content = $("#we-content", this.win);
    if (!content) return;
    if (this.currentCategory.startsWith("__")) return;

    let items = this.getFilteredItems();

    if (this.currentCategory === "custom-presets") {
      items = [
        {
          id: "__newpreset",
          name: "Create New Preset",
          type: "new-preset",
          isNewPreset: true,
          meta: { source: "" }
        },
        ...items
      ];
    }

    if (items.length === 0) {
      let msg = "No wallpapers found",
        icon = "fa-images";
      if (this.searchQuery) {
        msg = `No results for "${this.searchQuery}"`;
        icon = "fa-search";
      } else if (this.currentCategory === "uploaded") {
        msg = "No uploaded wallpapers. Upload one above!";
        icon = "fa-cloud-upload-alt";
      } else if (this.currentCategory === "favorites") {
        msg = "No favorites yet. Star one to add it!";
        icon = "fa-star";
      } else if (this.currentCategory === "recent") {
        msg = "No recent wallpapers";
        icon = "fa-clock";
      }
      setHTML(content, `<div class="we-category-empty"><i class="fas ${icon}"></i><span>${msg}</span></div>`);
      this.hidePreview();
      return;
    }

    if (items.length === 1 && items[0].isNewPreset) {
      setHTML(
        content,
        `
        <div class="we-category-empty" style="cursor:pointer" id="we-empty-create-preset">
          <i class="fas fa-plus-circle" style="font-size:34px;opacity:0.3;color:var(--brand)"></i>
          <span>No custom presets yet. Click here to create your first one!</span>
        </div>
      `
      );
      this.hidePreview();
      const emptyEl = document.getElementById("we-empty-create-preset");
      if (emptyEl) {
        bindEvent(emptyEl, "click", () => {
          this.showVantaCustomize({ id: -1, effect: "WAVES", options: { ...VANTA_DEFAULTS.WAVES } });
        });
      }
      return;
    }

    if (this.gridObserver) {
      this.gridObserver.disconnect();
      this.gridObserver = null;
    }

    let html = '<div class="we-grid">';
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      html += `<div class="we-card we-card-placeholder" data-index="${i}" data-id="${item.id}" data-type="${item.type}" data-source="${item.meta?.source || "Unknown"}"></div>`;
    }
    html += "</div>";
    setHTML(content, html);

    this.gridObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const card = entry.target;
            const idx = parseInt(card.dataset.index);
            if (idx >= 0 && idx < items.length) {
              this.populateCard(card, items[idx]);
            }
            this.gridObserver.unobserve(card);
          }
        }
      },
      { rootMargin: "300px 0px" }
    );

    const placeholders = content.querySelectorAll(".we-card-placeholder");
    for (const card of placeholders) {
      this.gridObserver.observe(card);
    }

    this.bindGridEvents(content);
    this.hidePreview();
  }

  populateCard(card, item) {
    if (!card || !item || !card.classList.contains("we-card-placeholder")) return;
    card.classList.remove("we-card-placeholder");

    if (item.isNewPreset) {
      card.classList.add("we-new-preset-card");
      card.innerHTML = `
        <div class="we-new-preset-inner">
          <i class="fas fa-plus"></i>
          <span>${item.name}</span>
        </div>
      `;
      return;
    }

    const isFav = this.favorites.includes(item.id);
    const isSelected = this.selectedItems.has(item.id);
    const badge = item.isVideo ? "Video" : item.type === "vanta" ? "Vanta" : item.type === "static" ? "Static" : "";
    const thumb = item.thumbnail || (item.type === "vanta" ? "" : "");

    card.innerHTML = `
      <div class="we-card-thumb">
        ${thumb ? `<img src="${thumb}" alt="${item.name}" loading="lazy" />` : ""}
        ${!thumb && item.type === "vanta" ? `<div class="we-card-vanta-bg"></div>` : ""}
        ${!thumb && item.type !== "vanta" ? `<div class="we-card-img-placeholder"><i class="fas fa-image"></i></div>` : ""}
        ${badge ? `<span class="we-card-badge">${badge}</span>` : ""}
        ${item.isVideo ? `<div class="we-card-play-badge">\u25B6</div>` : ""}
        <button class="we-card-fav ${isFav ? "favorited" : ""}" data-fav="${item.id}"><i class="fas fa-star"></i></button>
        ${isSelected ? '<div class="we-card-check"><i class="fas fa-check-circle"></i></div>' : ""}
      </div>
      <div class="we-card-name">${item.name}</div>
      <div class="we-card-actions">
        <button class="we-card-action primary" data-action="set" data-id="${item.id}" title="Set Desktop"><i class="fas fa-desktop"></i></button>
        <button class="we-card-action" data-action="login" data-id="${item.id}" title="Set Login"><i class="fas fa-lock"></i></button>
      </div>`;

    this.attachCardContextMenu(card);
    this.attachCardTooltip(card);
  }

  bindGridEvents(content) {
    if (this.gridEventsBound) return;
    this.gridEventsBound = true;

    bindEvent(content, "click", (e) => {
      const card = e.target.closest(".we-card");
      const favBtn = e.target.closest(".we-card-fav");
      const actionBtn = e.target.closest(".we-card-action");
      if (favBtn) {
        e.stopPropagation();
        this.toggleFavorite(favBtn.dataset.fav);
        return;
      }
      if (actionBtn) {
        e.stopPropagation();
        const item = this.wallpaperItems.find((i) => i.id === actionBtn.dataset.id);
        if (!item) return;
        if (actionBtn.dataset.action === "set") this.setDesktop(item);
        else this.setLogin(item);
        return;
      }
      if (card) {
        const item = this.wallpaperItems.find((i) => i.id === card.dataset.id);
        if (!item) return;
        if (item.isNewPreset) {
          this.showVantaCustomize({ id: -1, effect: "WAVES", options: { ...VANTA_DEFAULTS.WAVES } });
          return;
        }
        if (e.ctrlKey || e.metaKey) {
          const id = card.dataset.id;
          if (this.selectedItems.has(id)) this.selectedItems.delete(id);
          else this.selectedItems.add(id);
          card.classList.toggle("selected");
          this.renderBatchBar();
          return;
        }
        if (item) this.showPreview(item);
      }
    });

    bindEvent(content, "dblclick", (e) => {
      const card = e.target.closest(".we-card");
      if (!card) return;
      const item = this.wallpaperItems.find((i) => i.id === card.dataset.id);
      if (item && !item.isNewPreset) this.showFullscreenPreview(item);
    });
  }

  async setDesktop(item, silent = false) {
    try {
      if (item.type === "vanta") {
        await SystemUtilities.setWallpaper(item.src);
      } else if (item.isUserUpload) {
        const content = await this.fs.getFileContent(["Pictures", "Wallpapers"], item.userFileName);
        if (content) await SystemUtilities.setWallpaper(content);
        else return;
      } else {
        await SystemUtilities.setWallpaper(item.src);
      }
      this.addToHistory(item.id);
      this.applyColorFilter();
      if (!silent) this.notify(`Desktop wallpaper set to "${item.name}"`);
    } catch {
      if (!silent) this.notify("Failed to set wallpaper");
    }
  }

  async setLogin(item) {
    try {
      if (item.isUserUpload) {
        const content = await this.fs.getFileContent(["Pictures", "Wallpapers"], item.userFileName);
        if (content) {
          await SystemUtilities.setLoginWallpaper(content);
          this.notify(`Login wallpaper set to "${item.name}"`);
        }
      } else {
        await SystemUtilities.setLoginWallpaper(item.src);
        this.notify(`Login wallpaper set to "${item.name}"`);
      }
    } catch {
      this.notify("Failed to set login wallpaper");
    }
  }

  toggleFavorite(id) {
    const idx = this.favorites.indexOf(id);
    if (idx === -1) {
      this.favorites.push(id);
      this.notify("Added to favorites");
    } else {
      this.favorites.splice(idx, 1);
      this.notify("Removed from favorites");
    }
    this.saveFavorites();
    this.renderGrid();
    if (this.previewItem?.id === id) this.updatePreviewFavBtn();
  }

  showPreview(item) {
    this.previewItem = item;
    const panel = $("#we-preview-panel", this.win);
    if (!panel) return;
    panel.classList.add("open");

    const isFav = this.favorites.includes(item.id);
    const thumbSrc = item.thumbnail || "";

    setHTML(
      panel,
      `
      <div class="we-preview-media-wrap">
        ${thumbSrc ? `<img src="${thumbSrc}" alt="${item.name}" />` : `<div class="we-preview-placeholder"><i class="fas fa-magic"></i></div>`}
        <button class="we-preview-close" id="we-preview-close"><i class="fas fa-times"></i></button>
      </div>
      <div class="we-preview-info">
        <div class="we-preview-name">${item.name}</div>
        <div class="we-preview-meta">
          <span><i class="fas fa-tag"></i> ${item.type.charAt(0).toUpperCase() + item.type.slice(1)}</span>
          <span><i class="fas fa-globe"></i> ${item.meta?.source || "Unknown"}</span>
          ${item.isVideo ? '<span><i class="fas fa-video"></i> Video</span>' : ""}
          ${item.type === "vanta" && item.vantaPreset ? `<span><i class="fas fa-cog"></i> ${item.vantaPreset.effect}</span>` : ""}
        </div>
        <div class="we-preview-actions">
          ${item.type === "vanta" ? '<button class="we-preview-btn" id="we-preview-customize"><i class="fas fa-sliders-h"></i> Customize</button>' : ""}
          <button class="we-preview-btn primary" id="we-preview-set"><i class="fas fa-desktop"></i> Set Desktop</button>
          <button class="we-preview-btn" id="we-preview-login"><i class="fas fa-lock"></i> Set Login</button>
          <button class="we-preview-btn fav" id="we-preview-fav"><i class="fas fa-star"></i> ${isFav ? "Favorited" : "Add to Favorites"}</button>
          <button class="we-preview-btn" id="we-preview-add-playlist"><i class="fas fa-list"></i> Add to Playlist</button>
        </div>
      </div>
    `
    );

    bindEvent($("#we-preview-close", this.win), "click", () => this.hidePreview());
    bindEvent($("#we-preview-set", this.win), "click", () => this.setDesktop(item));
    bindEvent($("#we-preview-login", this.win), "click", () => this.setLogin(item));
    bindEvent($("#we-preview-fav", this.win), "click", () => this.toggleFavorite(item.id));
    bindEvent($("#we-preview-add-playlist", this.win), "click", () => this.showAddToPlaylist(item));

    const customizeBtn = $("#we-preview-customize", this.win);
    if (customizeBtn && item.vantaPreset) {
      bindEvent(customizeBtn, "click", () => this.showVantaCustomize(item.vantaPreset));
    }

    bindEvent(panel, "contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isFav = this.favorites.includes(item.id);
      const pvItems = [
        { id: "pv-set", label: "Set Desktop", action: "setDesktop", icon: "fa-desktop" },
        { id: "pv-login", label: "Set Login", action: "setLogin", icon: "fa-lock" },
        "hr",
        {
          id: "pv-fav",
          label: isFav ? "Remove from Favorites" : "Add to Favorites",
          action: "toggleFav",
          icon: "fa-star"
        },
        { id: "pv-pl", label: "Add to Playlist", action: "addPlaylist", icon: "fa-list" },
        { id: "pv-fs", label: "Fullscreen Preview", action: "fullscreen", icon: "fa-expand" }
      ];
      if (item.isCustom) {
        pvItems.push("hr", {
          id: "pv-edit-preset",
          label: "Edit Preset",
          action: "editPreset",
          icon: "fa-sliders-h"
        });
        pvItems.push({
          id: "pv-del-preset",
          label: "Delete Preset",
          action: "deletePreset",
          icon: "fa-trash"
        });
      }
      pvItems.push("hr", { id: "pv-copy", label: "Copy Name", action: "copyName", icon: "fa-copy" });
      showContextMenu(e, pvItems, {
        setDesktop: () => this.setDesktop(item),
        setLogin: () => this.setLogin(item),
        toggleFav: () => this.toggleFavorite(item.id),
        addPlaylist: () => this.showAddToPlaylist(item),
        fullscreen: () => this.showFullscreenPreview(item),
        copyName: () => navigator.clipboard.writeText(item.name).then(() => this.notify("Name copied")),
        editPreset: () => {
          if (item.vantaPreset) this.showVantaCustomize(item.vantaPreset);
        },
        deletePreset: async () => {
          const confirmed = await os.dialog.confirm("Delete Preset", `Delete "${item.name}"?`);
          if (!confirmed) return;
          this.deleteCustomVantaPreset(item.vantaPreset?.id);
          this.hidePreview();
          this.notify(`Preset "${item.name}" deleted`);
        }
      });
    });
  }

  updatePreviewFavBtn() {
    const btn = $("#we-preview-fav", this.win);
    if (!btn || !this.previewItem) return;
    const isFav = this.favorites.includes(this.previewItem.id);
    setHTML(btn, `<i class="fas fa-star"></i> ${isFav ? "Favorited" : "Add to Favorites"}`);
  }

  hidePreview() {
    const panel = $("#we-preview-panel", this.win);
    if (panel) panel.classList.remove("open");
    this.previewItem = null;
  }

  renderVantaControlsHtml(controls) {
    return controls
      .map((c) => {
        if (c.type === "range") {
          return `<div class="we-control-group">
          <label class="we-control-label">${c.label}</label>
          ${renderRangeSlider(`v_slider_${c.key}`, c.min, c.max, c.step, c.value)}
          <span class="we-control-value" id="v_val_${c.key}">${c.value}</span>
        </div>`;
        }
        return `<div class="we-control-group">
        <label class="we-control-label">${c.label}</label>
        <div class="we-color-input-wrap">
          <input class="we-control-color we-custom-input" type="color" value="${c.value}" data-key="${c.key}" />
        </div>
      </div>`;
      })
      .join("");
  }

  showVantaCustomize(preset) {
    const isNew = preset.id < 0;
    const overlay = createElement("div", { className: "we-vanta-customize-dialog" });

    const effectOptions = [
      { label: "Waves", value: "WAVES" },
      { label: "Birds", value: "BIRDS" },
      { label: "Net", value: "NET" },
      { label: "Dots", value: "DOTS" },
      { label: "Globe", value: "GLOBE" },
      { label: "Halo", value: "HALO" },
      { label: "Fog", value: "FOG" },
      { label: "Cells", value: "CELLS" }
    ];

    let currentEffect = preset.effect;
    let currentOptions = { ...preset.options };

    const getControls = () => this.getVantaControls({ effect: currentEffect, options: currentOptions });

    const rebuildControls = () => {
      const container = document.getElementById("v-customize-content");
      if (!container) return;
      const controls = getControls();
      setHTML(container, this.renderVantaControlsHtml(controls));
      bindRangeSlider(overlay);
      overlay.querySelectorAll(".we-control-color").forEach((input) => {
        bindEvent(input, "input", () => {});
      });
      controls
        .filter((c) => c.type === "range")
        .forEach((c) => {
          const slider = $(`#v_slider_${c.key}`, overlay);
          if (slider) {
            bindEvent(slider, "input", () => {
              const val = getRangeSliderValue(`v_slider_${c.key}`, overlay);
              const display = $(`#v_val_${c.key}`, overlay);
              if (display) setText(display, val);
            });
          }
        });
    };

    const readOptions = () => {
      const controls = getControls();
      const opts = {};
      controls.forEach((c) => {
        if (c.type === "range") {
          opts[c.key] = getRangeSliderValue(`v_slider_${c.key}`, overlay);
        } else {
          const el = $(`.we-control-color[data-key="${c.key}"]`, overlay);
          if (el) opts[c.key] = parseInt(el.value.replace("#", "0x"), 16);
        }
      });
      return opts;
    };

    const headerHtml = isNew
      ? `
        <div class="we-customize-title">New Preset</div>
        <div style="flex:1;margin:0 12px;max-width:160px">
          ${renderSelectMenu("v-effect-select", effectOptions, currentEffect)}
        </div>
        <button class="we-customize-close"><i class="fas fa-times"></i></button>
      `
      : `
        <div class="we-customize-title">Customize ${preset.name}</div>
        <button class="we-customize-close"><i class="fas fa-times"></i></button>
      `;

    setHTML(
      overlay,
      `
      <div class="we-vanta-customize-inner">
        <div class="we-customize-header">${headerHtml}</div>
        <div class="we-customize-content" id="v-customize-content">${this.renderVantaControlsHtml(getControls())}</div>
        <div class="we-customize-footer">
          <button class="we-customize-btn we-customize-cancel">Cancel</button>
          <button class="we-customize-btn" id="we-customize-save-preset"><i class="fas fa-save"></i> Save as Preset</button>
          <button class="we-customize-btn we-customize-apply">Apply</button>
        </div>
      </div>
    `
    );

    document.body.appendChild(overlay);

    if (isNew) {
      bindSelectMenu(overlay);
      const select = document.getElementById("v-effect-select");
      if (select) {
        bindEvent(select, "change", () => {
          const newEffect = getSelectMenuValue("v-effect-select", overlay);
          if (newEffect && newEffect !== currentEffect) {
            currentEffect = newEffect;
            currentOptions = { ...VANTA_DEFAULTS[newEffect] };
            rebuildControls();
          }
        });
      }
    }

    bindRangeSlider(overlay);
    overlay.querySelectorAll(".we-control-color").forEach((input) => {
      bindEvent(input, "input", () => {});
    });
    const controls = getControls();
    controls
      .filter((c) => c.type === "range")
      .forEach((c) => {
        const slider = $(`#v_slider_${c.key}`, overlay);
        if (slider) {
          bindEvent(slider, "input", () => {
            const val = getRangeSliderValue(`v_slider_${c.key}`, overlay);
            const display = $(`#v_val_${c.key}`, overlay);
            if (display) setText(display, val);
          });
        }
      });

    overlay.querySelector(".we-customize-close").onclick = () => overlay.remove();
    overlay.querySelector(".we-customize-cancel").onclick = () => overlay.remove();
    overlay.querySelector(".we-customize-apply").onclick = () => {
      const customOptions = readOptions();
      const customPreset = { effect: currentEffect, options: { ...currentOptions, ...customOptions } };
      SystemUtilities.setWallpaper(`vanta:custom:${btoa(JSON.stringify(customPreset))}`);
      this.notify(isNew ? "Custom preset applied" : `Custom "${preset.name}" applied`);
      overlay.remove();
    };

    const savePresetBtn = document.getElementById("we-customize-save-preset");
    if (savePresetBtn) {
      bindEvent(savePresetBtn, "click", async () => {
        const customOptions = readOptions();
        const suggestedName = isNew
          ? currentEffect.charAt(0) + currentEffect.slice(1).toLowerCase() + " Custom"
          : `${preset.name} Custom`;
        const name = await os.dialog.prompt("Save Vanta Preset", "Enter a name for your custom preset:", suggestedName);
        if (!name) return;
        const newPreset = {
          name,
          effect: currentEffect,
          options: { ...currentOptions, ...customOptions },
          previewStyle: { background: "var(--bg-base)" }
        };
        const saved = this.addCustomVantaPreset(newPreset);
        this.wallpaperItems.push({
          id: `vanta_custom_${saved.id}`,
          name: saved.name,
          type: "vanta",
          src: `vanta:custom:${btoa(JSON.stringify({ effect: saved.effect, options: saved.options }))}`,
          thumbnail: null,
          vantaPreset: saved,
          isVideo: false,
          isCustom: true,
          meta: { source: "Custom", effect: saved.effect }
        });
        this.renderGrid();
        this.updateStats();
        this.notify(`Preset "${name}" saved`);
        overlay.remove();
      });
    }
  }

  getVantaControls(preset) {
    const controls = [];
    const o = preset.options;
    const fmt = (v) => "#" + v.toString(16).padStart(6, "0");
    const add = (label, key, type, min, max, step, val) =>
      controls.push({ label, key, type, min, max, step, value: val });
    const addColor = (label, key, val) => controls.push({ label, key, type: "color", value: val });

    if (preset.effect === "WAVES") {
      addColor("Color", "color", fmt(o.color));
      add("Wave Height", "waveHeight", "range", 5, 50, 1, o.waveHeight);
      add("Wave Speed", "waveSpeed", "range", 0.1, 3, 0.1, o.waveSpeed);
      add("Zoom", "zoom", "range", 0.5, 2, 0.1, o.zoom);
    } else if (preset.effect === "BIRDS") {
      addColor("Color 1", "color1", fmt(o.color1));
      addColor("Color 2", "color2", fmt(o.color2));
      add("Bird Size", "birdSize", "range", 0.5, 3, 0.1, o.birdSize);
      add("Speed Limit", "speedLimit", "range", 1, 10, 0.5, o.speedLimit);
    } else if (preset.effect === "NET") {
      addColor("Color", "color", fmt(o.color));
      add("Points", "points", "range", 5, 20, 1, o.points);
      add("Distance", "distance", "range", 10, 30, 1, o.distance);
    } else if (preset.effect === "DOTS") {
      addColor("Color", "color", fmt(o.color));
      addColor("Color 2", "color2", fmt(o.color2));
      add("Size", "size", "range", 1, 5, 0.5, o.size);
      add("Spacing", "spacing", "range", 20, 80, 5, o.spacing);
    } else if (preset.effect === "GLOBE") {
      addColor("Color", "color", fmt(o.color));
      addColor("Color 2", "color2", fmt(o.color2));
      add("Size", "size", "range", 0.5, 3, 0.1, o.size);
      add("Deviation", "deviation", "range", 50, 500, 10, o.deviation);
    } else if (preset.effect === "HALO") {
      addColor("Color", "color", fmt(o.color));
      add("Size", "size", "range", 0.5, 3, 0.1, o.size);
    } else if (preset.effect === "FOG") {
      addColor("Color", "color", fmt(o.color));
      addColor("Highlight Color", "highlightColor", fmt(o.highlightColor));
      add("Speed", "speed", "range", 0.1, 3, 0.1, o.speed);
    } else if (preset.effect === "CELLS") {
      addColor("Color", "color", fmt(o.color));
      addColor("Color 2", "color2", fmt(o.color2));
      add("Size", "size", "range", 0.5, 3, 0.1, o.size);
      add("Speed", "speed", "range", 0.1, 3, 0.1, o.speed);
    }
    return controls;
  }

  shuffleRandom() {
    const items = this.getFilteredItems();
    if (!items.length) return;
    this.showPreview(items[Math.floor(Math.random() * items.length)]);
  }

  attachCardContextMenu(card) {
    bindEvent(card, "contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const item = this.wallpaperItems.find((i) => i.id === card.dataset.id);
      if (!item) return;
      const isFav = this.favorites.includes(item.id);
      const menuItems = [
        { id: "ctx-" + item.id + "-set", label: "Set Desktop", action: "setDesktop", icon: "fa-desktop" },
        { id: "ctx-" + item.id + "-login", label: "Set Login", action: "setLogin", icon: "fa-lock" },
        "hr",
        {
          id: "ctx-" + item.id + "-fav",
          label: isFav ? "Remove from Favorites" : "Add to Favorites",
          action: "toggleFav",
          icon: "fa-star"
        },
        { id: "ctx-" + item.id + "-pl", label: "Add to Playlist", action: "addPlaylist", icon: "fa-list" },
        { id: "ctx-" + item.id + "-fs", label: "Fullscreen Preview", action: "fullscreen", icon: "fa-expand" },
        "hr",
        { id: "ctx-" + item.id + "-copy", label: "Copy Name", action: "copyName", icon: "fa-copy" }
      ];
      if (item.isUserUpload) {
        menuItems.push("hr", {
          id: "ctx-" + item.id + "-del",
          label: "Delete",
          action: "deletePaper",
          icon: "fa-trash"
        });
      }
      if (item.isCustom) {
        menuItems.push("hr", {
          id: "ctx-" + item.id + "-edit-preset",
          label: "Edit Preset",
          action: "editPreset",
          icon: "fa-sliders-h"
        });
        menuItems.push({
          id: "ctx-" + item.id + "-del-preset",
          label: "Delete Preset",
          action: "deletePreset",
          icon: "fa-trash"
        });
      }
      showContextMenu(e, menuItems, {
        setDesktop: () => this.setDesktop(item),
        setLogin: () => this.setLogin(item),
        toggleFav: () => this.toggleFavorite(item.id),
        addPlaylist: () => this.showAddToPlaylist(item),
        fullscreen: () => this.showFullscreenPreview(item),
        copyName: () => navigator.clipboard.writeText(item.name).then(() => this.notify("Name copied")),
        deletePaper: () => this.deleteUserWallpaper(item),
        editPreset: () => {
          if (item.vantaPreset) this.showVantaCustomize(item.vantaPreset);
        },
        deletePreset: async () => {
          const confirmed = await os.dialog.confirm("Delete Preset", `Delete "${item.name}"?`);
          if (!confirmed) return;
          this.deleteCustomVantaPreset(item.vantaPreset?.id);
          this.notify(`Preset "${item.name}" deleted`);
        }
      });
    });
  }

  attachCardTooltip(card) {
    bindEvent(card, "mouseenter", () => {
      clearTimeout(this.tooltipTimer);
      this.tooltipTimer = setTimeout(() => {
        const rect = card.getBoundingClientRect();
        const id = card.dataset.id;
        const item = this.wallpaperItems.find((i) => i.id === id);
        if (!item) return;
        const el = createElement("div", { className: "we-tooltip" });
        el.dataset.weTooltipFor = id;
        el.innerHTML = `
          <div class="we-tooltip-name">${item.name}</div>
          <div class="we-tooltip-row"><i class="fas fa-tag"></i> ${item.type.charAt(0).toUpperCase() + item.type.slice(1)}</div>
          <div class="we-tooltip-row"><i class="fas fa-globe"></i> ${item.meta?.source || "Unknown"}</div>
          ${item.isVideo ? '<div class="we-tooltip-row"><i class="fas fa-video"></i> Video wallpaper</div>' : ""}
          ${item.type === "vanta" && item.vantaPreset ? `<div class="we-tooltip-row"><i class="fas fa-cog"></i> ${item.vantaPreset.effect}</div>` : ""}
        `;
        el.style.position = "fixed";
        el.style.left = Math.min(rect.left + rect.width / 2 - 120, window.innerWidth - 260) + "px";
        el.style.top = rect.top - 10 + "px";
        el.style.transform = "translateY(-100%)";
        document.body.appendChild(el);
      }, 600);
    });

    bindEvent(card, "mouseleave", () => {
      clearTimeout(this.tooltipTimer);
      document.querySelectorAll(`[data-we-tooltip-for="${card.dataset.id}"]`).forEach((el) => el.remove());
    });
  }

  /* ---------- Batch Bar ---------- */
  renderBatchBar() {
    const bar = $("#we-bottom-bar", this.win);
    if (!bar) return;
    const count = this.selectedItems.size;
    const existing = bar.querySelector(".we-batch-actions");
    if (existing) existing.remove();
    if (count === 0) return;

    const batch = createElement("div", { className: "we-batch-actions" });
    setHTML(
      batch,
      `
      <span class="we-batch-count">${count} selected</span>
      <button class="we-toolbar-btn" data-batch="set"><i class="fas fa-desktop"></i> Set Desktop</button>
      <button class="we-toolbar-btn" data-batch="fav"><i class="fas fa-star"></i> Favorite</button>
      <button class="we-toolbar-btn" data-batch="playlist"><i class="fas fa-list"></i> Add to Playlist</button>
      <button class="we-toolbar-btn we-toolbar-btn--danger" data-batch="delete"><i class="fas fa-trash"></i> Delete</button>
      <button class="we-toolbar-btn" data-batch="clear"><i class="fas fa-times"></i> Clear</button>
    `
    );
    bar.appendChild(batch);

    const items = [...this.selectedItems].map((id) => this.wallpaperItems.find((i) => i.id === id)).filter(Boolean);

    bindEvent(batch, "click", (e) => {
      const btn = e.target.closest("[data-batch]");
      if (!btn) return;
      const action = btn.dataset.batch;
      if (action === "clear") {
        this.selectedItems.clear();
        this.renderGrid();
        this.renderBatchBar();
        return;
      }
      if (action === "set") {
        for (const item of items) {
          this.setDesktop(item, true);
          break;
        }
        this.notify("Desktop wallpaper set");
      } else if (action === "fav") {
        for (const item of items) {
          if (!this.favorites.includes(item.id)) this.favorites.push(item.id);
        }
        this.saveFavorites();
        this.notify(`Added ${items.length} to favorites`);
      } else if (action === "playlist") {
        if (items.length) this.showAddToPlaylist(items[0]);
        return;
      } else if (action === "delete") {
        const uploads = items.filter((i) => i.isUserUpload);
        if (uploads.length) for (const item of uploads) this.deleteUserWallpaper(item, true);
        this.notify(`Deleted ${uploads.length} wallpaper(s)`);
      }
      this.selectedItems.clear();
      this.renderGrid();
      this.renderBatchBar();
    });
  }

  /* ---------- Delete User Wallpaper ---------- */
  async deleteUserWallpaper(item, silent = false) {
    try {
      await this.fs.deleteItem(["Pictures", "Wallpapers"], item.userFileName);
      this.wallpaperItems = this.wallpaperItems.filter((i) => i.id !== item.id);
      this.renderGrid();
      this.updateStats();
      if (!silent) this.notify(`Deleted "${item.name}"`);
    } catch {
      if (!silent) this.notify("Failed to delete wallpaper");
    }
  }

  /* ---------- Fullscreen Preview ---------- */
  async showFullscreenPreview(item) {
    const overlay = createElement("div", { className: "we-fs-overlay" });
    const isVideo = item.isVideo;
    const isVanta = item.type === "vanta";

    let mediaHtml = "";
    if (isVanta) {
      mediaHtml = `<div class="we-fs-vanta-container" id="we-fs-vanta"></div>`;
    } else if (isVideo && !item.isUserUpload && item.src) {
      const poster = item.thumbnail || "";
      mediaHtml = `<div class="we-fs-video-wrap">
        <div class="we-fs-poster" style="background-image:url(${poster})">
          <div class="we-fs-play-btn-big"><i class="fas fa-play"></i></div>
        </div>
        <video class="we-fs-media" data-src="${item.src}" loop muted playsinline style="display:none"></video>
      </div>`;
    } else if (item.isUserUpload && !isVideo) {
      let src = item.thumbnail || "";
      try {
        const content = await this.fs.getFileContent(["Pictures", "Wallpapers"], item.userFileName);
        if (content) src = toBlobUrl(content);
      } catch {}
      mediaHtml = `<img class="we-fs-media" src="${src}" alt="${item.name}" />`;
    } else if (item.isUserUpload && isVideo) {
      let src = item.thumbnail || "";
      try {
        const content = await this.fs.getFileContent(["Pictures", "Wallpapers"], item.userFileName);
        if (content) src = toBlobUrl(content);
      } catch {}
      mediaHtml = `<video class="we-fs-media" src="${src}" autoplay loop muted playsinline></video>`;
    } else {
      mediaHtml = `<img class="we-fs-media" src="${item.src}" alt="${item.name}" />`;
    }

    setHTML(
      overlay,
      `
      <button class="we-fs-close"><i class="fas fa-times"></i></button>
      <div class="we-fs-bg"></div>
      ${mediaHtml}
      <div class="we-fs-info">
        <span class="we-fs-name">${item.name}</span>
        <button class="we-fs-action" id="we-fs-set"><i class="fas fa-desktop"></i> Set Desktop</button>
        <button class="we-fs-action" id="we-fs-fav"><i class="fas fa-star"></i></button>
      </div>
    `
    );

    document.body.appendChild(overlay);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay || e.target.closest(".we-fs-close")) overlay.remove();
    });

    const closeBtn = overlay.querySelector(".we-fs-close");
    if (closeBtn) closeBtn.onclick = () => overlay.remove();

    bindEvent($("#we-fs-set", overlay), "click", () => {
      this.setDesktop(item);
      overlay.remove();
    });
    bindEvent($("#we-fs-fav", overlay), "click", () => {
      this.toggleFavorite(item.id);
      const btn = $("#we-fs-fav", overlay);
      if (btn) btn.classList.toggle("we-fs-fav--active", this.favorites.includes(item.id));
    });

    const playBtn = overlay.querySelector(".we-fs-play-btn-big");
    const videoEl = overlay.querySelector(".we-fs-media");
    if (playBtn && videoEl) {
      bindEvent(playBtn, "click", (e) => {
        e.stopPropagation();
        const poster = overlay.querySelector(".we-fs-poster");
        if (poster) poster.style.display = "none";
        videoEl.style.display = "block";
        videoEl.src = videoEl.dataset.src;
        videoEl.autoplay = true;
        videoEl.play().catch(() => {});
      });
    }

    if (isVanta) {
      const preset = vantaPresets.find((p) => p.id === item.vantaPreset?.id);
      if (preset && window.VANTA) {
        const container = $("#we-fs-vanta", overlay);
        if (container) {
          const effect =
            window.VANTA[
              preset.effect === "CELLS"
                ? "CELLS"
                : preset.effect === "NET"
                  ? "NET"
                  : preset.effect === "WAVES"
                    ? "WAVES"
                    : preset.effect === "BIRDS"
                      ? "BIRDS"
                      : preset.effect === "DOTS"
                        ? "DOTS"
                        : preset.effect === "GLOBE"
                          ? "GLOBE"
                          : preset.effect === "HALO"
                            ? "HALO"
                            : "FOG"
            ];
          if (effect) effect({ el: container, ...preset.options });
        }
      }
    }
  }

  setupDragDrop() {
    const content = $("#we-content", this.win);
    if (!content) return;
    content.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    });
    content.addEventListener("drop", (e) => {
      e.preventDefault();
      if (e.dataTransfer.files?.length) this.handleUpload(e.dataTransfer.files);
    });
  }

  async handleUpload(files) {
    let count = 0;
    for (const file of files) {
      try {
        await this.fs.ensureFolder(["Pictures", "Wallpapers"]);
        const fileKind = file.type.startsWith("video") ? FileKind.VIDEO : FileKind.IMAGE;
        await this.fs.createFile(
          ["Pictures", "Wallpapers"],
          file.name,
          file,
          fileKind,
          file.type.startsWith("video") ? "static/icons/file.webp" : "@content"
        );
        count++;
      } catch {}
    }
    if (count > 0) {
      this.notify(`Uploaded ${count} wallpaper${count > 1 ? "s" : ""}`);
      await this.loadAllWallpapers();
    }
  }

  showImportView() {
    const content = $("#we-content", this.win);
    if (!content) return;
    setHTML(
      content,
      `
      <div class="we-import-view">
        <div class="we-section-title"><i class="fas fa-link"></i> Import Wallpaper from URL</div>
        <div class="we-import-form">
          <div class="we-import-row">
            <div class="we-import-input-wrap">
              <input class="we-text-input we-custom-input" id="we-import-url" type="text" placeholder="https://example.com/wallpaper.jpg" />
            </div>
            <button class="we-toolbar-btn primary" id="we-import-go"><i class="fas fa-download"></i> Import</button>
          </div>
          <p class="we-import-hint">Supports direct links to images (.jpg, .png, .webp, .gif) and videos (.mp4, .webm)</p>
          <div id="we-import-status"></div>
        </div>
      </div>
    `
    );
    bindEvent($("#we-import-go", this.win), "click", async () => {
      const url = $("#we-import-url", this.win)?.value.trim();
      if (!url) return;
      const status = $("#we-import-status", this.win);
      if (status) setHTML(status, '<span style="color:var(--text-secondary)">Downloading...</span>');
      try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error("HTTP " + resp.status);
        const blob = await resp.blob();
        const ext = url.split(".").pop()?.split("?")[0] || "jpg";
        const name = "imported_" + Date.now() + "." + ext;
        await this.fs.ensureFolder(["Pictures", "Wallpapers"]);
        const isVid = blob.type.startsWith("video/");
        await this.fs.createFile(
          ["Pictures", "Wallpapers"],
          name,
          blob,
          isVid ? FileKind.VIDEO : FileKind.IMAGE,
          isVid ? "static/icons/file.webp" : "@content"
        );
        if (status)
          setHTML(
            status,
            '<span class="import-status--success"><i class="fas fa-check"></i> Imported successfully!</span>'
          );
        this.notify(`Imported "${name}"`);
        await this.loadAllWallpapers();
      } catch (err) {
        if (status)
          setHTML(
            status,
            `<span class="import-status--error"><i class="fas fa-exclamation-triangle"></i> Failed: ${err.message}</span>`
          );
      }
    });
  }

  showPlaylistsView() {
    const content = $("#we-content", this.win);
    if (!content) return;
    const names = Object.keys(this.playlists);
    let listHtml = names.length
      ? names
          .map((n) => {
            const count = this.playlists[n].length;
            const active = this.activePlaylist === n;
            return `<div class="we-playlist-item" data-name="${n}">
        <div class="we-playlist-info">
          <div class="we-playlist-name">${n}</div>
          <div class="we-playlist-count">${count} wallpaper${count !== 1 ? "s" : ""}</div>
        </div>
        <div class="we-playlist-actions">
          ${active ? '<span class="we-playlist-active-badge">Active</span>' : `<button class="we-card-action primary we-playlist-activate" data-name="${n}">Activate</button>`}
          <button class="we-card-action we-playlist-edit" data-name="${n}"><i class="fas fa-edit"></i></button>
          <button class="we-card-action we-card-action--danger we-playlist-delete" data-name="${n}"><i class="fas fa-trash"></i></button>
        </div>
      </div>`;
          })
          .join("")
      : '<div class="we-category-empty"><i class="fas fa-list"></i><span>No playlists yet. Create one below!</span></div>';

    setHTML(
      content,
      `
      <div class="we-section-title"><i class="fas fa-list"></i> Wallpaper Playlists</div>
      <div class="we-playlist-create">
        <div class="we-import-input-wrap" style="flex:1">
          <input class="we-text-input we-custom-input" id="we-playlist-name-input" type="text" placeholder="New playlist name..." />
        </div>
        <button class="we-toolbar-btn primary" id="we-playlist-create-btn"><i class="fas fa-plus"></i> Create</button>
      </div>
      <div class="we-playlist-list">${listHtml}</div>
      <div id="we-playlist-detail"></div>
    `
    );

    bindEvent($("#we-playlist-create-btn", this.win), "click", () => {
      const name = $("#we-playlist-name-input", this.win)?.value.trim();
      if (!name || this.playlists[name]) return;
      this.playlists[name] = [];
      this.savePlaylists();
      this.showPlaylistsView();
    });

    bindEvent(content, "click", (e) => {
      const activateBtn = e.target.closest(".we-playlist-activate");
      const editBtn = e.target.closest(".we-playlist-edit");
      const deleteBtn = e.target.closest(".we-playlist-delete");
      if (activateBtn) {
        this.activePlaylist = activateBtn.dataset.name;
        os.storage.set(WE_KEYS.activePlaylist, this.activePlaylist);
        this.notify(`Playlist "${this.activePlaylist}" activated`);
        this.showPlaylistsView();
      } else if (deleteBtn) {
        const name = deleteBtn.dataset.name;
        delete this.playlists[name];
        if (this.activePlaylist === name) {
          this.activePlaylist = null;
          os.storage.remove(WE_KEYS.activePlaylist);
        }
        this.savePlaylists();
        this.showPlaylistsView();
      } else if (editBtn) {
        this.showPlaylistDetail(editBtn.dataset.name);
      }
    });

    content.querySelectorAll(".we-playlist-item").forEach((plItem) => {
      bindEvent(plItem, "contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const name = plItem.dataset.name;
        const isActive = this.activePlaylist === name;
        showContextMenu(
          e,
          [
            { id: "pl-" + name + "-edit", label: "View Details", action: "edit", icon: "fa-edit" },
            ...(isActive
              ? []
              : [{ id: "pl-" + name + "-act", label: "Activate", action: "activate", icon: "fa-play" }]),
            "hr",
            { id: "pl-" + name + "-ren", label: "Rename", action: "rename", icon: "fa-i-cursor" },
            { id: "pl-" + name + "-del", label: "Delete", action: "deletePl", icon: "fa-trash" }
          ],
          {
            edit: () => this.showPlaylistDetail(name),
            activate: () => {
              this.activePlaylist = name;
              os.storage.set(WE_KEYS.activePlaylist, name);
              this.notify(`Playlist "${name}" activated`);
              this.showPlaylistsView();
            },
            rename: async () => {
              const newName = await os.dialog.prompt("Rename Playlist", "Enter a new name:", name);
              if (newName && newName !== name && !this.playlists[newName]) {
                this.playlists[newName] = this.playlists[name];
                delete this.playlists[name];
                if (this.activePlaylist === name) {
                  this.activePlaylist = newName;
                  os.storage.set(WE_KEYS.activePlaylist, newName);
                }
                this.savePlaylists();
                this.showPlaylistsView();
              }
            },
            deletePl: () => {
              delete this.playlists[name];
              if (this.activePlaylist === name) {
                this.activePlaylist = null;
                os.storage.remove(WE_KEYS.activePlaylist);
              }
              this.savePlaylists();
              this.showPlaylistsView();
            }
          }
        );
      });
    });
  }

  showPlaylistDetail(name) {
    const detail = $("#we-playlist-detail", this.win);
    if (!detail) return;
    const ids = this.playlists[name] || [];
    const items = ids.map((id) => this.wallpaperItems.find((i) => i.id === id)).filter(Boolean);

    setHTML(
      detail,
      `
      <div class="we-section-title" style="margin-top:16px;">${name} <span style="font-weight:400;font-size:12px;color:var(--text-secondary)">(${items.length} wallpapers)</span></div>
      ${
        items.length
          ? `<div class="we-grid" style="grid-template-columns:repeat(auto-fill,minmax(120px,1fr))">
        ${items
          .map(
            (item) => `<div class="we-card" data-id="${item.id}">
          <div class="we-card-thumb">
            ${item.thumbnail ? `<img src="${item.thumbnail}" alt="${item.name}" loading="lazy" />` : '<div class="we-card-img-placeholder"><i class="fas fa-image"></i></div>'}
          </div>
          <div class="we-card-name">${item.name}</div>
          <div class="we-card-actions">
            <button class="we-card-action" style="color:#f87171" data-action="remove-from-playlist" data-playlist="${name}" data-id="${item.id}">Remove</button>
          </div>
        </div>`
          )
          .join("")}
      </div>`
          : '<div class="we-category-empty"><i class="fas fa-images"></i><span>No wallpapers in this playlist</span></div>'
      }
    `
    );

    bindEvent(detail, "click", (e) => {
      const removeBtn = e.target.closest("[data-action='remove-from-playlist']");
      if (!removeBtn) return;
      const pName = removeBtn.dataset.playlist;
      const id = removeBtn.dataset.id;
      if (this.playlists[pName]) {
        this.playlists[pName] = this.playlists[pName].filter((i) => i !== id);
        this.savePlaylists();
        this.showPlaylistDetail(pName);
      }
    });

    detail.querySelectorAll(".we-card").forEach((dcard) => {
      bindEvent(dcard, "contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = dcard.dataset.id;
        const item = this.wallpaperItems.find((i) => i.id === id);
        if (!item) return;
        const pName = dcard.querySelector("[data-playlist]")?.dataset.playlist || name;
        const isFav = this.favorites.includes(id);
        showContextMenu(
          e,
          [
            { id: "pd-" + id + "-set", label: "Set Desktop", action: "setDesktop", icon: "fa-desktop" },
            {
              id: "pd-" + id + "-fav",
              label: isFav ? "Remove from Favorites" : "Add to Favorites",
              action: "toggleFav",
              icon: "fa-star"
            },
            "hr",
            { id: "pd-" + id + "-rem", label: "Remove from Playlist", action: "removePl", icon: "fa-minus-circle" }
          ],
          {
            setDesktop: () => this.setDesktop(item),
            toggleFav: () => this.toggleFavorite(item.id),
            removePl: () => {
              if (this.playlists[pName]) {
                this.playlists[pName] = this.playlists[pName].filter((i) => i !== id);
                this.savePlaylists();
                this.showPlaylistDetail(pName);
              }
            }
          }
        );
      });
    });
  }

  showAddToPlaylist(item) {
    const names = Object.keys(this.playlists);
    if (!names.length) {
      this.notify("No playlists. Create one in the sidebar first.");
      return;
    }
    const options = names.map((n) => ({ label: n, value: n }));
    const overlay = createElement("div", { className: "we-vanta-customize-dialog" });
    setHTML(
      overlay,
      `
      <div class="we-vanta-customize-inner" style="max-width:360px">
        <div class="we-customize-header">
          <div class="we-customize-title">Add to Playlist</div>
          <button class="we-customize-close"><i class="fas fa-times"></i></button>
        </div>
        <div class="we-customize-content">
          ${renderSelectMenu("we-playlist-select", options, options[0].value)}
        </div>
        <div class="we-customize-footer">
          <button class="we-customize-btn we-customize-cancel" id="we-p-cancel">Cancel</button>
          <button class="we-customize-btn we-customize-apply" id="we-p-add">Add</button>
        </div>
      </div>
    `
    );
    document.body.appendChild(overlay);
    bindSelectMenu(overlay);
    overlay.querySelector(".we-customize-close").onclick = () => overlay.remove();
    $("#we-p-cancel", overlay).onclick = () => overlay.remove();
    $("#we-p-add", overlay).onclick = () => {
      const val = getSelectMenuValue("we-playlist-select", overlay);
      if (val && this.playlists[val]) {
        if (!this.playlists[val].includes(item.id)) {
          this.playlists[val].push(item.id);
          this.savePlaylists();
          this.notify(`Added to "${val}"`);
        } else this.notify("Already in this playlist");
      }
      overlay.remove();
    };
  }

  showFiltersView() {
    const content = $("#we-content", this.win);
    if (!content) return;
    const f = this.colorFilter;
    setHTML(
      content,
      `
      <div class="we-section-title"><i class="fas fa-tint"></i> Color Filters</div>
      <p style="color:var(--text-secondary);font-size:12px;margin-bottom:16px;">Adjust how wallpapers appear on your desktop. Changes apply instantly.</p>
      <div class="we-filters-grid">
        <div class="we-control-group">
          <label class="we-control-label">Brightness</label>
          ${renderRangeSlider("we-filter-brightness", 0, 200, 1, f.brightness)}
          <span class="we-control-value" id="we-filter-brightness-val">${f.brightness}%</span>
        </div>
        <div class="we-control-group">
          <label class="we-control-label">Contrast</label>
          ${renderRangeSlider("we-filter-contrast", 0, 200, 1, f.contrast)}
          <span class="we-control-value" id="we-filter-contrast-val">${f.contrast}%</span>
        </div>
        <div class="we-control-group">
          <label class="we-control-label">Saturation</label>
          ${renderRangeSlider("we-filter-saturate", 0, 300, 1, f.saturate)}
          <span class="we-control-value" id="we-filter-saturate-val">${f.saturate}%</span>
        </div>
        <div class="we-control-group">
          <label class="we-control-label">Blur</label>
          ${renderRangeSlider("we-filter-blur", 0, 20, 0.5, f.blur)}
          <span class="we-control-value" id="we-filter-blur-val">${f.blur}px</span>
        </div>
      </div>
      <button class="we-toolbar-btn" id="we-filter-reset" style="margin-top:12px;"><i class="fas fa-undo"></i> Reset to Defaults</button>
    `
    );

    bindRangeSlider(content);

    const bindFilter = (id, key, unit) => {
      const slider = $(`#${id}`, this.win);
      if (slider) {
        bindEvent(slider, "input", () => {
          const val = getRangeSliderValue(id, this.win);
          const display = $(`#${id}-val`, this.win);
          if (display) setText(display, val + unit);
          this.updateFilter(key, val);
        });
      }
    };

    bindFilter("we-filter-brightness", "brightness", "%");
    bindFilter("we-filter-contrast", "contrast", "%");
    bindFilter("we-filter-saturate", "saturate", "%");
    bindFilter("we-filter-blur", "blur", "px");

    bindEvent($("#we-filter-reset", this.win), "click", () => {
      this.colorFilter = { ...DEFAULT_FILTER };
      this.saveFilter();
      this.showFiltersView();
      this.applyColorFilter();
    });
  }

  notify(msg, type) {
    type = type || "info";
    const icons = { info: "fa-info-circle", success: "fa-check-circle", error: "fa-exclamation-triangle" };
    const els = document.querySelectorAll(".we-notification");
    const offset = 60 + els.length * 48;
    const el = createElement("div", { className: `we-notification we-notification--${type}` });
    el.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${msg}</span>`;
    el.style.bottom = offset + "px";
    document.body.appendChild(el);
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transition = "opacity 0.3s";
      setTimeout(() => el.remove(), 300);
    }, 3000);
  }
}
