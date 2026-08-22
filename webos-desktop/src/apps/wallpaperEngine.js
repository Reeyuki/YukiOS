import "../styles/wallpaperEngine.css";
import { BaseApp, os, StorageKeys, MODES } from "../framework.js";
import { SystemUtilities } from "../system.js";
import {
  WALLPAPER_NAME_URL_PAIRS,
  MAC_WALLPAPER_NAME_URL_PAIRS,
  CHROME_OS_WALLPAPER_NAME_URL_PAIRS
} from "../wallpaperConfig.js";
import { videos, videos2 } from "../wallpaperList.js";
import { vantaPresets } from "../vantaPresets.js";
import { resolveWallpaperUrl } from "../shared/assetResolver.js";
import { FileKind, isVideoFile } from "../shared/fileKindDetector.js";

import { $, $$, bindEvent, setText, setHTML, createElement } from "../shared/domUtils.js";
import { renderRangeSlider, bindRangeSlider, getRangeSliderValue } from "../shared/rangeSlider.js";
import { renderSelectMenu, bindSelectMenu, getSelectMenuValue } from "../shared/selectMenu.js";
import { showContextMenu } from "../shared/contextMenu.js";
import { isBlobLike } from "../utils/utils.js";

const WE_KEYS = {
  favorites: StorageKeys.wallpaperEngineFavorites,
  history: StorageKeys.wallpaperEngineHistory,
  shuffleInterval: StorageKeys.wallpaperEngineShuffleInterval,
  viewMode: StorageKeys.wallpaperEngineViewMode,
  colorFilter: StorageKeys.wallpaperEngineColorFilter
};

const DEFAULT_FILTER = { brightness: 100, contrast: 100, saturate: 100, blur: 0 };

function toBlobUrl(content) {
  if (!content) return null;
  if (isBlobLike(content)) return URL.createObjectURL(content);
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
  singletonWindowIds = ["wallpaper-engine"];

  constructor(os) {
    super(os);
    this.fs = os.fs;
    this.winId = null;
    this.win = null;
    this.host = null;
    this.embedded = false;
    this.currentCategory = "static";
    this.searchQuery = "";
    this.wallpaperItems = [];
    this.favorites = loadJSON(WE_KEYS.favorites, []);
    this.history = loadJSON(WE_KEYS.history, []);
    this.colorFilter = loadJSON(WE_KEYS.colorFilter, DEFAULT_FILTER);
    this.shuffleTimer = null;
    this.previewItem = null;
    this.sortMode = "default";
  }

  saveFavorites() {
    saveJSON(WE_KEYS.favorites, this.favorites);
  }
  saveHistory() {
    saveJSON(WE_KEYS.history, this.history.slice(0, 50));
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
    if (!this.fs) return;

    const win = os.window.create("wallpaper-engine", "Wallpaper Engine", "960px", "640px", {
      icon: "fas fa-paint-roller"
    });

    this.winId = "wallpaper-engine";
    this.win = win;
    this.mountInto(win);
    this.initTray();
  }

  mountInto(host) {
    this.host = host;
    this.embedded = host.id === "wallpaper-engine-host";
    host.classList.add("we-host");
    this.applyColorFilter();
    this.renderUI(host);
    this.loadAllWallpapers();
    this.initAutoCycle();
  }

  onClose(winId) {
    if (this.shuffleTimer) {
      clearInterval(this.shuffleTimer);
      this.shuffleTimer = null;
    }
    os.tray.unregister("wallpaper-engine");
    $$(".we-fs-overlay").forEach((el) => el.remove());
    this.winId = null;
    this.win = null;
    const settingsHost = $("#wallpaper-engine-host");
    if (settingsHost) this.mountInto(settingsHost);
  }

  initTray() {
    if (os.modes.isActive(MODES.MAC)) return;
    os.tray.register("wallpaper-engine", "fas fa-paint-roller", "Wallpaper Engine", {
      showInTray: true,
      priority: 5,
      onClick: () => {
        os.app.launch("wallpaperEngineApp");
      },
      contextMenuItems: this.getTrayItems()
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
    const style = createElement("style");
    style.id = "we-color-filter-style";
    style.textContent = `#wallpaper-img, #wallpaper-video, #vanta-container { filter: brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturate}%) blur(${f.blur}px) !important; }`;
    $("#we-color-filter-style")?.remove();
    document.head.appendChild(style);
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
      <div class="we-container ${this.embedded ? "we-embedded" : ""}">
        <div class="we-sidebar" id="we-sidebar"></div>
        <div class="we-main">
          <div class="we-toolbar" id="we-toolbar"></div>
          <div class="we-cat-bar" id="we-cat-bar"></div>
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
    const sidebar = $("#we-sidebar", this.host);
    const catBar = $("#we-cat-bar", this.host);

    const categories = [
      { id: "all", icon: "fas fa-th-large", label: "All" },
      { id: "static", icon: "fas fa-image", label: "Static" },
      { id: "mac", icon: "fab fa-apple", label: "macOS" },
      { id: "chromeos", icon: "fab fa-chrome", label: "ChromeOS" },
      { id: "video", icon: "fas fa-film", label: "Live Video" },
      { id: "vanta", icon: "fas fa-magic", label: "Animated" },
      { id: "uploaded", icon: "fas fa-cloud-upload-alt", label: "Your Uploads" },
      { id: "favorites", icon: "fas fa-star", label: "Favorites" },
      { id: "recent", icon: "fas fa-clock", label: "Recent" }
    ];

    const tools = [
      { id: "__import", icon: "fas fa-link", label: "Import URL" },
      { id: "__filters", icon: "fas fa-tint", label: "Color Filters" }
    ];

    const itemHtml = (c, compact) => `
      <div class="we-sidebar-item ${compact ? "we-cat-btn" : ""} ${c.id === "static" ? "active" : ""}" data-cat="${c.id}">
        <i class="${c.icon}"></i><span>${c.label}</span>
      </div>`;

    if (sidebar) {
      setHTML(
        sidebar,
        `
        <div class="we-sidebar-title">Categories</div>
        ${categories.map((c) => itemHtml(c, false)).join("")}
        <div class="we-sidebar-title" style="margin-top:12px;">Tools</div>
        ${tools.map((t) => itemHtml(t, false)).join("")}
      `
      );
      this.bindCategoryClicks(sidebar);
    }

    if (catBar) {
      setHTML(catBar, categories.map((c) => itemHtml(c, true)).join("") + tools.map((t) => itemHtml(t, true)).join(""));
      this.bindCategoryClicks(catBar);
    }
  }

  bindCategoryClicks(container) {
    bindEvent(container, "click", (e) => {
      const item = e.target.closest(".we-sidebar-item");
      if (!item) return;
      this.selectCategory(item.dataset.cat);
    });

    container.querySelectorAll(".we-sidebar-item").forEach((item) => {
      bindEvent(item, "contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const cat = item.dataset.cat;
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

  selectCategory(cat) {
    $$(`.we-sidebar-item[data-cat="${cat}"]`, this.host).forEach((el) => el.classList.add("active"));
    $$(`.we-sidebar-item:not([data-cat="${cat}"])`, this.host).forEach((el) => el.classList.remove("active"));
    this.currentCategory = cat;
    if (cat === "__import") this.showImportView();
    else if (cat === "__filters") this.showFiltersView();
    else this.renderGrid();
  }

  renderToolbar() {
    const toolbar = $("#we-toolbar", this.host);
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
    bindEvent($("#we-sort-select", this.host), "change", () => {
      this.sortMode = getSelectMenuValue("we-sort-select", this.host);
      if (!this.currentCategory.startsWith("__")) this.renderGrid();
    });

    const search = $("#we-search", this.host);
    if (search) {
      bindEvent(search, "input", () => {
        this.searchQuery = search.value.trim().toLowerCase();
        if (!this.currentCategory.startsWith("__")) this.renderGrid();
      });
    }

    bindEvent($("#we-upload-btn", this.host), "click", () => {
      $("#we-file-input", this.host)?.click();
    });

    bindEvent($("#we-file-input", this.host), "change", (e) => {
      const files = e.target.files;
      if (!files?.length) return;
      this.handleUpload(files);
      e.target.value = "";
    });

    bindEvent($("#we-random-btn", this.host), "click", () => this.shuffleRandom());
  }

  renderBottomBar() {
    const bar = $("#we-bottom-bar", this.host);
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

    bindEvent($("#we-cycle-toggle", this.host), "change", () => {
      const checked = $("#we-cycle-toggle", this.host).checked;
      os.storage.set(StorageKeys.cycleWallpaper, checked ? "true" : "false");
      this.initAutoCycle();
    });

    bindEvent($("#we-shuffle-interval", this.host), "change", () => {
      const val = parseInt($("#we-shuffle-interval", this.host).value) || 30;
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
      SystemUtilities.setSequentialWallpaper?.();
    }, interval);
  }

  async loadAllWallpapers() {
    const items = [];
    items.push(...this.getStaticWallpapers());
    items.push(...this.getMacWallpapers());
    items.push(...this.getChromeOsWallpapers());
    items.push(...this.getVideoWallpapers());
    items.push(...this.getVantaWallpapers());
    items.push(...(await this.getUserWallpapers()));
    this.wallpaperItems = items;
    this.updateStats();
    this.renderGrid();
  }

  updateStats() {
    const stats = $("#we-stats", this.host);
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

  getChromeOsWallpapers() {
    return CHROME_OS_WALLPAPER_NAME_URL_PAIRS.map((wp) => ({
      id: `chromeos_${wp.filename || wp.name}`,
      name: wp.name,
      type: "chromeos",
      src: wp.url,
      thumbnail: resolveWallpaperUrl(wp.url),
      isVideo: false,
      meta: { source: "ChromeOS" }
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
    return vantaPresets.map((p) => ({
      id: `vanta_${p.id}`,
      name: p.name,
      type: "vanta",
      src: `vanta:${p.id}`,
      thumbnail: null,
      vantaPreset: p,
      isVideo: false,
      meta: { source: "Vanta.js", effect: p.effect }
    }));
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
    if (cat !== "all" && cat !== "favorites" && cat !== "recent") items = items.filter((i) => i.type === cat);
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
    const content = $("#we-content", this.host);
    if (!content) return;
    if (this.currentCategory.startsWith("__")) return;

    let items = this.getFilteredItems();

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

    const isFav = this.favorites.includes(item.id);
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
      </div>
      <div class="we-card-name">${item.name}</div>
      <div class="we-card-actions">
        <button class="we-card-action primary" data-action="set" data-id="${item.id}" title="Set Desktop"><i class="fas fa-desktop"></i></button>
        <button class="we-card-action" data-action="login" data-id="${item.id}" title="Set Login"><i class="fas fa-lock"></i></button>
      </div>`;

    this.attachCardContextMenu(card);
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
        if (item) this.showPreview(item);
      }
    });

    bindEvent(content, "dblclick", (e) => {
      const card = e.target.closest(".we-card");
      if (!card) return;
      const item = this.wallpaperItems.find((i) => i.id === card.dataset.id);
      if (item) this.showFullscreenPreview(item);
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
    const panel = $("#we-preview-panel", this.host);
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
        </div>
      </div>
    `
    );

    bindEvent($("#we-preview-close", this.host), "click", () => this.hidePreview());
    bindEvent($("#we-preview-set", this.host), "click", () => this.setDesktop(item));
    bindEvent($("#we-preview-login", this.host), "click", () => this.setLogin(item));
    bindEvent($("#we-preview-fav", this.host), "click", () => this.toggleFavorite(item.id));

    const customizeBtn = $("#we-preview-customize", this.host);
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
        { id: "pv-fs", label: "Fullscreen Preview", action: "fullscreen", icon: "fa-expand" }
      ];
      pvItems.push("hr", { id: "pv-copy", label: "Copy Name", action: "copyName", icon: "fa-copy" });
      showContextMenu(e, pvItems, {
        setDesktop: () => this.setDesktop(item),
        setLogin: () => this.setLogin(item),
        toggleFav: () => this.toggleFavorite(item.id),
        fullscreen: () => this.showFullscreenPreview(item),
        copyName: () => navigator.clipboard.writeText(item.name).then(() => this.notify("Name copied"))
      });
    });
  }

  updatePreviewFavBtn() {
    const btn = $("#we-preview-fav", this.host);
    if (!btn || !this.previewItem) return;
    const isFav = this.favorites.includes(this.previewItem.id);
    setHTML(btn, `<i class="fas fa-star"></i> ${isFav ? "Favorited" : "Add to Favorites"}`);
  }

  hidePreview() {
    const panel = $("#we-preview-panel", this.host);
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
    const overlay = createElement("div", { className: "we-vanta-customize-dialog" });
    let currentOptions = { ...preset.options };

    const getControls = () => this.getVantaControls({ effect: preset.effect, options: currentOptions });

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

    setHTML(
      overlay,
      `
      <div class="we-vanta-customize-inner">
        <div class="we-customize-header">
          <div class="we-customize-title">Customize ${preset.name}</div>
          <button class="we-customize-close"><i class="fas fa-times"></i></button>
        </div>
        <div class="we-customize-content" id="v-customize-content">${this.renderVantaControlsHtml(getControls())}</div>
        <div class="we-customize-footer">
          <button class="we-customize-btn we-customize-cancel">Cancel</button>
          <button class="we-customize-btn we-customize-apply"><i class="fas fa-check"></i> Apply</button>
        </div>
      </div>
    `
    );

    document.body.appendChild(overlay);
    bindRangeSlider(overlay);
    overlay.querySelectorAll(".we-control-color").forEach((input) => {
      bindEvent(input, "input", () => {});
    });
    getControls()
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
      const customPreset = { effect: preset.effect, options: { ...currentOptions, ...customOptions } };
      SystemUtilities.setWallpaper(`vanta:custom:${btoa(JSON.stringify(customPreset))}`);
      this.notify(`Custom "${preset.name}" applied`);
      overlay.remove();
    };
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

  async shuffleRandom() {
    const items = this.getFilteredItems();
    if (!items.length) return;
    const item = items[Math.floor(Math.random() * items.length)];
    await this.setDesktop(item);
    if (this.host) this.showPreview(item);
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
      showContextMenu(e, menuItems, {
        setDesktop: () => this.setDesktop(item),
        setLogin: () => this.setLogin(item),
        toggleFav: () => this.toggleFavorite(item.id),
        fullscreen: () => this.showFullscreenPreview(item),
        copyName: () => navigator.clipboard.writeText(item.name).then(() => this.notify("Name copied")),
        deletePaper: () => this.deleteUserWallpaper(item)
      });
    });
  }

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
          const effect = window.VANTA[preset.effect];
          if (effect) effect({ el: container, ...preset.options });
        }
      }
    }
  }

  setupDragDrop() {
    const content = $("#we-content", this.host);
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
    const content = $("#we-content", this.host);
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
    bindEvent($("#we-import-go", this.host), "click", async () => {
      const url = $("#we-import-url", this.host)?.value.trim();
      if (!url) return;
      const status = $("#we-import-status", this.host);
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

  showFiltersView() {
    const content = $("#we-content", this.host);
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
      const slider = $(`#${id}`, this.host);
      if (slider) {
        bindEvent(slider, "input", () => {
          const val = getRangeSliderValue(id, this.host);
          const display = $(`#${id}-val`, this.host);
          if (display) setText(display, val + unit);
          this.updateFilter(key, val);
        });
      }
    };

    bindFilter("we-filter-brightness", "brightness", "%");
    bindFilter("we-filter-contrast", "contrast", "%");
    bindFilter("we-filter-saturate", "saturate", "%");
    bindFilter("we-filter-blur", "blur", "px");

    bindEvent($("#we-filter-reset", this.host), "click", () => {
      this.colorFilter = { ...DEFAULT_FILTER };
      this.saveFilter();
      this.showFiltersView();
      this.applyColorFilter();
    });
  }

  notify(msg, type = "info") {
    os.notify.send("Wallpaper Engine", msg, { type });
  }
}
