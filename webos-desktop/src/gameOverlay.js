import { KeybindManager } from "./keybindManager.js";
import { StorageKeys, os } from "./framework.js";
import { BusEvents } from "./core/EventBus.js";
import { SteamDataManager, steamAppRenderer } from "./games/games.js";
import { ScreenshotApp } from "./apps/screenshot.js";
import { TerminalApp } from "./apps/terminal.js";
import { audioMixer } from "./audioMixer.js";
import { resolveIconUrl } from "./shared/assetResolver.js";
import {
  $,
  $$,
  createElement,
  setHTML,
  setText,
  addClass,
  removeClass,
  toggleClass,
  setStyle
} from "./shared/domUtils.js";

const OVERLAY_SETTINGS_KEY = StorageKeys.overlaySettings;
const OVERLAY_NOTES_KEY = StorageKeys.overlayNotes;
const OVERLAY_PANEL_POSITIONS_KEY = StorageKeys.overlayPanelPositions;
const OVERLAY_OPEN_PANELS_KEY = StorageKeys.overlayOpenPanels;

const DOCK_ITEM_DEFAULTS = [
  { id: "overview", title: "Overview", icon: "fa-home" },
  { id: "achievements", title: "Achievements", icon: "fa-trophy" },
  { id: "friends", title: "Friends", icon: "fa-user-friends" },
  { id: "notes", title: "Notes", icon: "fa-sticky-note" },
  { id: "scramjet", title: "Web Browser", icon: "fa-rocket" },
  { id: "screenshots", title: "Screenshots", icon: "fa-images" },
  { id: "audio", title: "Audio", icon: "fa-volume-high" },
  { id: "launcher", title: "Quick Launch", icon: "fa-th" },
  { id: "terminal", title: "Terminal", icon: "fa-terminal" },
  { id: "settings", title: "Settings", icon: "fa-cog" }
];

export class GameOverlayController {
  constructor(os) {
    this.os = os;
    this.visible = false;
    this.overlayEl = null;
    this.currentGameId = null;
    this.currentWinId = null;
    this.currentGameTitle = "";
    this.activeTab = "overview";
    this.friendsWindow = null;
    this.perfMonitorEnabled = false;
    this.perfInterval = null;
    this.clockInterval = null;
    this.sessionStart = null;
    this.achievementFilter = "all";
    this.settings = this.loadSettings();
    this.notes = this.loadNotes();
    this.listeningForKeybind = false;
    this.screenshotApp = null;
    this.openPanels = new Set();
    this.panelZCounter = 100;
    this.panelPositions = {};
    this.screenshotViewUrls = new Map();
    this.recording = false;
    this.recordingDonePromise = null;
    this.init();
  }

  init() {
    document.addEventListener("keydown", this.onKeyDown.bind(this));
    document.addEventListener("keydown", (e) => {
      if (this.visible && e.key === "Escape") {
        e.preventDefault();
        this.close();
      }
    });

    os.events.on(BusEvents.ACHIEVEMENT_TRIGGER, () => {
      if (this.visible) this.renderAchievements();
    });
  }

  onKeyDown(e) {
    if (KeybindManager.matches(e, "steam.overlay") || (e.shiftKey && e.key === "Tab")) {
      e.preventDefault();
      e.stopPropagation();
      if (this.visible) {
        this.close();
      } else {
        this.open();
      }
    }
  }

  loadSettings() {
    try {
      const s = os.storage.get(OVERLAY_SETTINGS_KEY) || {
        enabled: true,
        restoreTabs: true,
        perfMonitor: false,
        dockItems: null
      };
      if (!s.dockItems) {
        s.dockItems = DOCK_ITEM_DEFAULTS.map((d) => ({ id: d.id, visible: true }));
      }
      return s;
    } catch {
      return {
        enabled: true,
        restoreTabs: true,
        perfMonitor: false,
        dockItems: DOCK_ITEM_DEFAULTS.map((d) => ({ id: d.id, visible: true }))
      };
    }
  }

  saveSettings() {
    os.storage.set(OVERLAY_SETTINGS_KEY, this.settings);
  }

  loadNotes() {
    try {
      return os.storage.get(OVERLAY_NOTES_KEY) || [];
    } catch {
      return [];
    }
  }

  saveNotes() {
    os.storage.set(OVERLAY_NOTES_KEY, this.notes);
  }

  loadPanelPositions() {
    try {
      return os.storage.get(OVERLAY_PANEL_POSITIONS_KEY) || {};
    } catch {
      return {};
    }
  }

  savePanelPositions() {
    os.storage.set(OVERLAY_PANEL_POSITIONS_KEY, this.panelPositions);
  }

  loadOpenPanels() {
    try {
      const arr = os.storage.get(OVERLAY_OPEN_PANELS_KEY);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  saveOpenPanels() {
    os.storage.set(OVERLAY_OPEN_PANELS_KEY, Array.from(this.openPanels));
  }

  findActiveGameWindow() {
    const wins = $$('.window[data-app-id]:not([data-app-id=""])');
    if (!wins.length) return null;
    let best = null;
    let bestZ = -1;
    wins.forEach((w) => {
      const z = parseInt(w.style.zIndex) || 0;
      if (z > bestZ && w.style.display !== "none") {
        bestZ = z;
        best = w;
      }
    });
    return best;
  }

  isSystemApp(appId) {
    const entry = os.app.getAppInfo(appId);
    return entry?.type === "system";
  }

  openForWindow(gameWin) {
    if (!this.settings?.enabled || !gameWin) return;
    if (this.isSystemApp(gameWin.dataset.appId)) return;
    this.currentWinId = gameWin.id;
    this.currentGameId = gameWin.dataset.appId;
    this.currentGameTitle = this.getGameTitle(this.currentGameId);
    this.sessionStart = Date.now();
    this.blockGameInput(gameWin);

    if (this.overlayEl) {
      const titleEl = this.overlayEl.querySelector(".overlay-info-title");
      if (titleEl) titleEl.textContent = this.escapeHtml(this.currentGameTitle);
      this.overlayEl.style.display = "";
      requestAnimationFrame(() => this.overlayEl.classList.add("steam-overlay--visible"));
    } else {
      this.buildOverlay();
    }

    this.visible = true;
    this.startClock();
    if (this.settings.perfMonitor) this.startPerfMonitor();
  }

  open() {
    if (!this.settings.enabled) return;
    const gameWin = this.findActiveGameWindow();
    if (!gameWin) return;
    if (this.isSystemApp(gameWin.dataset.appId)) return;

    this.currentWinId = gameWin.id;
    this.currentGameId = gameWin.dataset.appId;
    this.currentGameTitle = this.getGameTitle(this.currentGameId);
    this.sessionStart = Date.now();
    this.blockGameInput(gameWin);

    if (this.overlayEl) {
      const titleEl = this.overlayEl.querySelector(".overlay-info-title");
      if (titleEl) titleEl.textContent = this.escapeHtml(this.currentGameTitle);
      this.overlayEl.style.display = "";
      requestAnimationFrame(() => this.overlayEl.classList.add("steam-overlay--visible"));
    } else {
      this.buildOverlay();
    }

    this.visible = true;
    this.startClock();
    if (this.settings.perfMonitor) this.startPerfMonitor();
  }

  close() {
    this.stopClock();
    this.stopPerfMonitor();
    this.restoreGameInput();
    this.savePanelPositions();
    this.saveOpenPanels();

    if (this.overlayEl) {
      this.overlayEl.classList.remove("steam-overlay--visible");
      setTimeout(() => {
        if (this.overlayEl) {
          this.overlayEl.style.display = "none";
        }
      }, 200);
    }
    this.visible = false;
  }

  exitGame() {
    const win = $(`#${this.currentWinId}`);
    this.close();
    if (win) {
      os.window.close(win);
    }
  }

  getGameTitle(appId) {
    const info = os.app.getAppInfo(appId);
    return info?.title || appId || "Game";
  }

  blockGameInput(win) {
    const content = $(".window-content", win);
    if (content) content.style.pointerEvents = "none";
  }

  restoreGameInput() {
    if (this.currentWinId) {
      const win = $(`#${this.currentWinId}`);
      if (win) {
        const content = win.querySelector(".window-content");
        if (content) content.style.pointerEvents = "";
      }
    }
  }

  buildOverlay() {
    if (this.overlayEl) {
      this.overlayEl.remove();
    }

    this.openPanels = new Set();
    this.panelPositions = this.loadPanelPositions();

    const el = createElement("div");
    el.className = "steam-overlay";
    el.innerHTML = `
      <div class="steam-overlay-backdrop"></div>
      <div class="overlay-info-bar">
        <div class="overlay-info-stack">
        <div class="overlay-perf-monitor" id="overlay-perf-monitor" style="display:none;">
          <span class="overlay-perf-item"><span class="overlay-perf-value" id="perf-fps">--</span> FPS</span>
          <span class="overlay-perf-item"><span class="overlay-perf-value" id="perf-frame">--</span>ms</span>
        </div>
          <div class="overlay-clock-time" id="overlay-clock-time">--:-- --</div> 
          <div class="overlay-clock-date" id="overlay-clock-date">---, --- --, ----</div>
          <div class="overlay-session-time" id="overlay-session-time">0m this session</div>
          <button class="overlay-exit-game" id="overlay-exit-game">Exit Game</button>
        </div>
        <span class="overlay-info-title">${this.escapeHtml(this.currentGameTitle)}</span>
        <div class="overlay-info-right">
          <div class="overlay-backtogame">
            <div class="overlay-backtogame-text">
              <span class="overlay-backtogame-main">Back to Game</span>
              <span class="overlay-backtogame-key">(${(KeybindManager.getCurrentKeys("steam.overlay") || ["Shift", "Tab"]).join(" + ")})</span>
            </div>
            <button class="overlay-backtogame-close" id="overlay-close-x"><i class="fas fa-times"></i></button>
          </div>
        </div>
      </div>
      <div class="steam-overlay-main" id="overlay-panels-container"></div>
      <div class="steam-overlay-dock" id="steam-overlay-dock"></div>
    `;

    document.body.appendChild(el);
    this.overlayEl = el;
    this.buildDock(el.querySelector("#steam-overlay-dock"));

    this.bindOverlayEvents();

    const prevOpen = this.loadOpenPanels();
    if (prevOpen.includes("overview")) {
      this.togglePanel("overview");
    }
    for (const id of prevOpen) {
      if (id !== "overview") {
        this.togglePanel(id);
      }
    }
    if (!prevOpen.length) {
      this.togglePanel("overview");
    }

    requestAnimationFrame(() => {
      el.classList.add("steam-overlay--visible");
    });
  }

  buildDock(dockEl) {
    dockEl.innerHTML = "";
    const dockArr = this.settings.dockItems || DOCK_ITEM_DEFAULTS.map((d) => ({ id: d.id, visible: true }));
    const visible = dockArr.filter((d) => d.visible);
    let draggedId = null;

    visible.forEach((item, i) => {
      const def = DOCK_ITEM_DEFAULTS.find((d) => d.id === item.id);
      if (!def) return;

      const btn = createElement("button");
      btn.className = "overlay-dock-btn" + (this.openPanels.has(item.id) ? " active" : "");
      btn.dataset.panel = item.id;
      btn.draggable = true;
      btn.innerHTML = `<i class="fas ${def.icon}"></i>`;

      btn.addEventListener("click", () => this.togglePanel(item.id));

      btn.addEventListener("dragstart", (e) => {
        draggedId = item.id;
        btn.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", item.id);
      });

      btn.addEventListener("dragover", (e) => {
        e.preventDefault();
        if (!draggedId || draggedId === item.id) return;
        btn.classList.add("drag-over");
      });

      btn.addEventListener("dragleave", () => {
        btn.classList.remove("drag-over");
      });

      btn.addEventListener("drop", (e) => {
        e.preventDefault();
        btn.classList.remove("drag-over");
        if (!draggedId || draggedId === item.id) return;
        this.reorderDock(draggedId, item.id);
        draggedId = null;
      });

      btn.addEventListener("dragend", () => {
        btn.classList.remove("dragging");
        draggedId = null;
        dockEl.querySelectorAll(".overlay-dock-btn").forEach((b) => b.classList.remove("drag-over"));
      });

      dockEl.appendChild(btn);
    });

    const closeBtn = createElement("button");
    closeBtn.className = "overlay-dock-btn overlay-dock-close";
    closeBtn.id = "overlay-dock-close";
    closeBtn.innerHTML = '<i class="fas fa-times"></i>';
    closeBtn.addEventListener("click", () => this.close());
    dockEl.appendChild(closeBtn);
  }

  rebuildDock() {
    const dockEl = this.overlayEl?.querySelector("#steam-overlay-dock");
    if (dockEl) this.buildDock(dockEl);
  }

  reorderDock(fromId, toId) {
    const items = this.settings.dockItems;
    const fromIdx = items.findIndex((d) => d.id === fromId);
    const toIdx = items.findIndex((d) => d.id === toId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = items.splice(fromIdx, 1);
    items.splice(toIdx, 0, moved);
    this.saveSettings();
    this.rebuildDock();
  }

  bindOverlayEvents() {
    const el = this.overlayEl;

    el.querySelector("#overlay-close-x").addEventListener("click", () => this.close());
    el.querySelector("#overlay-exit-game").addEventListener("click", () => this.exitGame());

    el.addEventListener("click", (e) => {
      if (e.target === el.querySelector(".steam-overlay-backdrop")) {
        this.close();
      }
    });
  }

  togglePanel(id) {
    const container = this.overlayEl.querySelector("#overlay-panels-container");
    let panel = container.querySelector(`[data-panel="${id}"]`);

    if (panel) {
      if (panel.style.display === "none") {
        panel.style.display = "";
        this.openPanels.add(id);
        this.bringPanelToFront(panel);
        this.activateDockBtn(id);
        this.lazyRender(id);
      } else {
        panel.style.display = "none";
        this.openPanels.delete(id);
        this.deactivateDockBtn(id);
      }
      return;
    }

    this.createPanel(id, container);
    this.openPanels.add(id);
    this.lazyRender(id);
    this.activateDockBtn(id);
  }

  createPanel(id, container) {
    const titleMap = {
      overview: "Game Overview",
      achievements: "Achievements",
      friends: "Friends",
      notes: "Notes",
      scramjet: "Web Browser",
      screenshots: "Screenshots",
      audio: "Audio",
      launcher: "Quick Launch",
      terminal: "Terminal",
      settings: "Settings"
    };
    const panelTitle = titleMap[id] || (id.startsWith("screenshot-view--") ? id.replace("screenshot-view--", "") : id);
    const pos = this.panelPositions[id] || this.getDefaultPanelPos(id);
    const panel = createElement("div");
    panel.className = "overlay-panel";
    panel.dataset.panel = id;
    const wStr = pos.w !== undefined ? `width:${pos.w}px;` : "";
    const hStr = pos.h !== undefined ? `height:${pos.h}px;` : "";
    panel.style.cssText = `position:absolute;left:${pos.x}px;top:${pos.y}px;${wStr}${hStr}z-index:${++this.panelZCounter};display:block;`;
    panel.innerHTML = `
      <div class="overlay-panel-header">
        <span class="overlay-panel-title">${panelTitle}</span>
        <button class="overlay-panel-maximize" data-panel-maximize="${id}"><i class="fas fa-expand"></i></button>
        <button class="overlay-panel-close" data-panel-close="${id}"><i class="fas fa-times"></i></button>
      </div>
      <div class="overlay-panel-body"></div>
      <div class="overlay-panel-resize-handle resize-nw" data-resize="nw"></div>
      <div class="overlay-panel-resize-handle resize-n" data-resize="n"></div>
      <div class="overlay-panel-resize-handle resize-ne" data-resize="ne"></div>
      <div class="overlay-panel-resize-handle resize-e" data-resize="e"></div>
      <div class="overlay-panel-resize-handle resize-se" data-resize="se"></div>
      <div class="overlay-panel-resize-handle resize-s" data-resize="s"></div>
      <div class="overlay-panel-resize-handle resize-sw" data-resize="sw"></div>
      <div class="overlay-panel-resize-handle resize-w" data-resize="w"></div>
    `;
    container.appendChild(panel);
    this.makePanelDraggable(panel);
    this.makePanelResizable(panel);
    panel.querySelector(".overlay-panel-close").addEventListener("click", (e) => {
      e.stopPropagation();
      this.togglePanel(id);
    });
    panel.querySelector(".overlay-panel-maximize").addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleMaximizePanel(panel);
    });
    panel.addEventListener("mousedown", () => this.bringPanelToFront(panel));
  }

  getDefaultPanelPos(id) {
    const REF = {
      overview: { x: 23, y: 6, w: 320, h: 243 },
      achievements: { x: 1159, y: -69, w: 350, h: 266 },
      friends: { x: 1162, y: 205, w: 350, h: 240 },
      notes: { x: 28, y: 546, w: 320, h: 160 },
      scramjet: { x: 358, y: -104, w: 799, h: 562 },
      screenshots: { x: 26, y: 259, w: 320, h: 282 },
      audio: { x: 1164, y: 460, w: 347, h: 241 },
      launcher: { x: 579, y: 260, w: 373, h: 336 },
      terminal: { x: 404, y: 32, w: 581, h: 319 },
      settings: { x: 281, y: -77, w: 500, h: 691 }
    };

    const ref = REF[id];
    if (ref) return { ...ref };

    if (id.startsWith("screenshot-view--")) {
      const s = REF.browser;
      return { ...s };
    }

    return { x: 23, y: 6, w: 320 };
  }

  makePanelDraggable(panel) {
    const header = panel.querySelector(".overlay-panel-header");
    const container = panel.parentElement;
    let isDragging = false;
    let startX, startY, origX, origY;
    let activeSnapZone = null;

    header.addEventListener("mousedown", (e) => {
      if (e.target.closest(".overlay-panel-close") || e.target.closest(".overlay-panel-maximize")) return;
      isDragging = true;
      this.bringPanelToFront(panel);
      header.style.cursor = "grabbing";

      if (panel.classList.contains("maximized")) {
        const restore = panel.preMaximizeRect || this.getDefaultPanelPos(panel.dataset.panel);
        panel.classList.remove("maximized");
        panel.querySelector(".overlay-panel-maximize i").className = "fas fa-expand";
        panel.style.width = restore.w + "px";
        panel.style.height = restore.h + "px";
        panel.style.left = e.clientX - restore.w / 2 + "px";
        panel.style.top = "0px";
        panel.preMaximizeRect = null;
      }

      origX = panel.offsetLeft;
      origY = panel.offsetTop;
      startX = e.clientX;
      startY = e.clientY;
    });

    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      panel.style.left = origX + dx + "px";
      panel.style.top = origY + dy + "px";

      const containerRect = container.getBoundingClientRect();
      activeSnapZone = this.getSnapZone(e.clientX, e.clientY, containerRect);
      if (activeSnapZone) {
        this.showSnapPreview(container, this.getSnapRect(activeSnapZone, containerRect));
      } else {
        this.hideSnapPreview(container);
      }
    });

    document.addEventListener("mouseup", (e) => {
      if (isDragging) {
        isDragging = false;
        header.style.cursor = "grab";
        this.hideSnapPreview(container);

        if (activeSnapZone) {
          const containerRect = container.getBoundingClientRect();
          const snapRect = this.getSnapRect(activeSnapZone, containerRect);
          panel.style.left = snapRect.x + "px";
          panel.style.top = snapRect.y + "px";
          panel.style.width = snapRect.w + "px";
          panel.style.height = snapRect.h + "px";
          activeSnapZone = null;
        }

        this.panelPositions[panel.dataset.panel] = {
          x: parseInt(panel.style.left),
          y: parseInt(panel.style.top),
          w: panel.offsetWidth,
          h: panel.offsetHeight
        };
        this.savePanelPositions();
      }
    });
  }

  makePanelResizable(panel) {
    const handles = panel.querySelectorAll(".overlay-panel-resize-handle");
    if (!handles.length) return;
    let isResizing = false;
    let resizeDir = null;
    let startX, startY, startW, startH, startL, startT;

    handles.forEach((handle) => {
      handle.addEventListener("mousedown", (e) => {
        e.stopPropagation();
        e.preventDefault();
        isResizing = true;
        resizeDir = handle.dataset.resize;
        startX = e.clientX;
        startY = e.clientY;
        startW = panel.offsetWidth;
        startH = panel.offsetHeight;
        startL = panel.offsetLeft;
        startT = panel.offsetTop;
      });
    });

    document.addEventListener("mousemove", (e) => {
      if (!isResizing || !resizeDir) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const minW = 280;
      const minH = 160;

      if (resizeDir.includes("e")) {
        panel.style.width = Math.max(minW, startW + dx) + "px";
      }
      if (resizeDir.includes("w")) {
        const newW = Math.max(minW, startW - dx);
        panel.style.width = newW + "px";
        panel.style.left = startL + startW - newW + "px";
      }
      if (resizeDir.includes("s")) {
        panel.style.height = Math.max(minH, startH + dy) + "px";
      }
      if (resizeDir.includes("n")) {
        const newH = Math.max(minH, startH - dy);
        panel.style.height = newH + "px";
        panel.style.top = startT + startH - newH + "px";
      }
    });

    document.addEventListener("mouseup", () => {
      if (isResizing) {
        isResizing = false;
        resizeDir = null;
        this.panelPositions[panel.dataset.panel] = {
          x: parseInt(panel.style.left),
          y: parseInt(panel.style.top),
          w: panel.offsetWidth,
          h: panel.offsetHeight
        };
        this.savePanelPositions();
      }
    });
  }

  bringPanelToFront(panel) {
    panel.style.zIndex = ++this.panelZCounter;
  }

  toggleMaximizePanel(panel) {
    const id = panel.dataset.panel;
    const container = this.overlayEl.querySelector("#overlay-panels-container");
    const icon = panel.querySelector(".overlay-panel-maximize i");

    if (panel.classList.contains("maximized")) {
      const restore = panel.preMaximizeRect || this.getDefaultPanelPos(id);
      panel.classList.remove("maximized");
      panel.style.left = restore.x + "px";
      panel.style.top = restore.y + "px";
      panel.style.width = restore.w + "px";
      panel.style.height = restore.h + "px";
      panel.preMaximizeRect = null;
      if (icon) icon.className = "fas fa-expand";
      this.panelPositions[id] = { x: restore.x, y: restore.y, w: restore.w, h: restore.h };
      this.savePanelPositions();
    } else {
      panel.preMaximizeRect = {
        x: panel.offsetLeft,
        y: panel.offsetTop,
        w: panel.offsetWidth,
        h: panel.offsetHeight
      };
      const rect = container.getBoundingClientRect();
      panel.classList.add("maximized");
      panel.style.left = "0px";
      panel.style.top = "0px";
      panel.style.width = rect.width + "px";
      panel.style.height = rect.height + "px";
      if (icon) icon.className = "fas fa-compress";
    }
    this.bringPanelToFront(panel);
  }

  getSnapZone(clientX, clientY, containerRect) {
    const edge = 36;
    const nearLeft = clientX - containerRect.left <= edge;
    const nearRight = containerRect.right - clientX <= edge;
    const nearTop = clientY - containerRect.top <= edge;
    const nearBottom = containerRect.bottom - clientY <= edge;

    if (nearTop && nearLeft) return "nw";
    if (nearTop && nearRight) return "ne";
    if (nearBottom && nearLeft) return "sw";
    if (nearBottom && nearRight) return "se";
    if (nearLeft) return "w";
    if (nearRight) return "e";
    if (nearTop) return "n";
    return null;
  }

  getSnapRect(zone, containerRect) {
    const w = containerRect.width;
    const h = containerRect.height;
    const halfW = w / 2;
    const halfH = h / 2;

    switch (zone) {
      case "nw":
        return { x: 0, y: 0, w: halfW, h: halfH };
      case "ne":
        return { x: halfW, y: 0, w: halfW, h: halfH };
      case "sw":
        return { x: 0, y: halfH, w: halfW, h: halfH };
      case "se":
        return { x: halfW, y: halfH, w: halfW, h: halfH };
      case "w":
        return { x: 0, y: 0, w: halfW, h };
      case "e":
        return { x: halfW, y: 0, w: halfW, h };
      case "n":
        return { x: 0, y: 0, w, h };
      default:
        return null;
    }
  }

  getSnapPreviewEl(container) {
    let preview = container.querySelector(".overlay-snap-preview");
    if (!preview) {
      preview = createElement("div");
      preview.className = "overlay-snap-preview";
      container.appendChild(preview);
    }
    return preview;
  }

  showSnapPreview(container, snapRect) {
    const preview = this.getSnapPreviewEl(container);
    preview.style.left = snapRect.x + "px";
    preview.style.top = snapRect.y + "px";
    preview.style.width = snapRect.w + "px";
    preview.style.height = snapRect.h + "px";
    preview.classList.add("active");
  }

  hideSnapPreview(container) {
    const preview = container.querySelector(".overlay-snap-preview");
    if (preview) preview.classList.remove("active");
  }

  activateDockBtn(id) {
    const btn = this.overlayEl.querySelector(`.overlay-dock-btn[data-panel="${id}"]`);
    if (btn) btn.classList.add("active");
  }

  deactivateDockBtn(id) {
    const btn = this.overlayEl.querySelector(`.overlay-dock-btn[data-panel="${id}"]`);
    if (btn) btn.classList.remove("active");
  }

  lazyRender(id) {
    switch (id) {
      case "overview":
        this.renderOverview();
        break;
      case "achievements":
        this.renderAchievements();
        break;
      case "friends":
        this.renderFriends();
        break;
      case "notes":
        this.renderNotes();
        break;
      case "scramjet":
        this.initScramjet();
        break;
      case "screenshots":
        this.renderScreenshots();
        break;
      case "audio":
        this.renderAudio();
        break;
      case "launcher":
        this.renderLauncher();
        break;
      case "terminal":
        this.initTerminal();
        break;
      case "settings":
        this.renderSettings();
        break;
    }
    if (id.startsWith("screenshot-view--")) {
      this.renderScreenshotView(id);
    }
  }

  formatTime(min) {
    if (!min || min < 0) return "0m";
    if (min < 60) return `${Math.round(min)}m`;
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  formatTimeDecimal(min) {
    if (!min || min < 0) return "0 hrs";
    const h = (min / 60).toFixed(1);
    return `${h} hrs`;
  }

  getDayLabel(i) {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return days[d.getDay()];
  }

  getDayValue(i) {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  }

  renderOverview() {
    const pane = this.overlayEl.querySelector('[data-panel="overview"] .overlay-panel-body');
    if (!pane) return;

    const stats = SteamDataManager.getStats();
    const gameStats = stats[this.currentGameId] || { totalMin: 0, lastPlayed: 0 };
    const sessionMin = this.sessionStart ? Math.round((Date.now() - this.sessionStart) / 60000) : 0;

    pane.innerHTML = `
      <div class="overview-header">Game Overview</div>
      <div class="overview-playtime-card">
        <div class="overview-playtime-card-header">
          <span><i class="fas fa-bars"></i> PLAYTIME</span>
          <i class="fas fa-clock"></i>
        </div>
        <div class="overview-playtime-stats">
          <div class="overview-playtime-row">
            <span>Total Playtime</span>
            <span class="overview-playtime-value">${this.formatTimeDecimal(gameStats.totalMin)}</span>
          </div>
          <div class="overview-playtime-row">
            <span>Last 2 Weeks</span>
            <span class="overview-playtime-value">${this.formatTime(SteamDataManager.getRecentMinutes(this.currentGameId))}</span>
          </div>
          <div class="overview-playtime-row">
            <span>Current Session</span>
            <span class="overview-playtime-value" id="overview-session-playtime">${this.formatTime(sessionMin)}</span>
          </div>
        </div>
      </div>
    `;
  }

  updateOverviewPlaytime() {
    if (!this.visible) return;
    const sessionMin = this.sessionStart ? Math.round((Date.now() - this.sessionStart) / 60000) : 0;
    const sessionEl = this.overlayEl?.querySelector("#overview-session-playtime");
    if (sessionEl) {
      sessionEl.textContent = this.formatTime(sessionMin);
    }
  }

  renderAchievements() {
    const pane = this.overlayEl.querySelector('[data-panel="achievements"] .overlay-panel-body');
    if (!pane) return;

    const achApp = this.os.app.getInstance("achievementsApp");
    if (!achApp) {
      pane.innerHTML = `<div class="overlay-no-data">Achievements system not available</div>`;
      return;
    }

    const allAch = achApp.achievements || [];
    const unlocked = achApp.unlocked || new Set();
    const total = allAch.length;
    const done = unlocked.size;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    let filtered = allAch;
    if (this.achievementFilter === "unlocked") {
      filtered = allAch.filter((a) => unlocked.has(a.id));
    } else if (this.achievementFilter === "locked") {
      filtered = allAch.filter((a) => !unlocked.has(a.id));
    }

    pane.innerHTML = `
      <div class="overlay-achievements-header">
        <div class="overlay-achievements-stats">
          <strong>${done}</strong> / ${total} unlocked (${pct}%)
        </div>
        <div class="overlay-achievements-filters">
          <button class="overlay-ach-filter-btn ${this.achievementFilter === "all" ? "active" : ""}" data-filter="all">All</button>
          <button class="overlay-ach-filter-btn ${this.achievementFilter === "unlocked" ? "active" : ""}" data-filter="unlocked">Unlocked</button>
          <button class="overlay-ach-filter-btn ${this.achievementFilter === "locked" ? "active" : ""}" data-filter="locked">Locked</button>
        </div>
      </div>
      <div class="overlay-achievements-grid">
        ${filtered
          .map((a) => {
            const isUnlocked = unlocked.has(a.id);
            const unlockedTs = isUnlocked ? unlocked.get(a.id) : null;
            return `
            <div class="overlay-achievement-card ${isUnlocked ? "overlay-achievement-card--unlocked" : "overlay-achievement-card--locked"}">
              <div class="overlay-ach-icon-wrap">
                <i class="fas ${a.icon || "fa-trophy"}"></i>
              </div>
              <div class="overlay-ach-info">
                <div class="overlay-ach-title">${a.title}</div>
                <div class="overlay-ach-desc">${a.desc || ""}</div>
                ${unlockedTs ? `<div class="overlay-ach-date">Unlocked on ${new Date(unlockedTs).toLocaleDateString()}</div>` : ""}
              </div>
              <span class="overlay-ach-rarity overlay-ach-rarity--${a.rarity || "common"}">${a.rarity || "common"}</span>
            </div>
          `;
          })
          .join("")}
      </div>
    `;

    pane.querySelectorAll(".overlay-ach-filter-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.achievementFilter = btn.dataset.filter;
        this.renderAchievements();
      });
    });
  }

  renderFriends() {
    const pane = this.overlayEl.querySelector('[data-panel="friends"] .overlay-panel-body');
    if (!pane) return;

    if (pane.querySelector(".window-content")) return;

    this.openFriendsPopup();

    const win = $("#steam-friends-win");
    if (win) {
      const content = win.querySelector(".window-content");
      if (content) {
        pane.innerHTML = "";
        pane.appendChild(content);
        win.remove();
      }
    }
  }

  openFriendsPopup() {
    const existing = $("#steam-friends-win");
    if (existing) {
      os.window.bringToFront(existing);
      return;
    }

    const renderer = new steamAppRenderer();
    renderer.gameUI.openFriendsWindow(os.window);
  }

  renderNotes() {
    const pane = this.overlayEl.querySelector('[data-panel="notes"] .overlay-panel-body');
    if (!pane) return;

    pane.innerHTML = `
      <div class="overlay-notes-container">
        <div class="overlay-notes-toolbar">
          <button class="overlay-notes-add-btn" id="overlay-notes-add-btn"><i class="fas fa-plus"></i> New Note</button>
        </div>
        <div class="overlay-notes-list" id="overlay-notes-list">
          ${this.renderNotesList()}
        </div>
      </div>
    `;

    pane.querySelector("#overlay-notes-add-btn").addEventListener("click", () => {
      this.addNote();
    });

    this.bindNoteEvents();
  }

  renderNotesList() {
    if (!this.notes.length) {
      return `<div class="overlay-no-data" style="height:100px;">No notes yet. Click "New Note" to add one.</div>`;
    }
    return this.notes
      .map(
        (note, i) => `
      <div class="overlay-note-card" data-index="${i}">
        <div class="overlay-note-card-header">
          <span class="overlay-note-card-time">${new Date(note.ts).toLocaleString()}</span>
          <button class="overlay-note-delete-btn" data-index="${i}"><i class="fas fa-trash"></i></button>
        </div>
        <div class="overlay-note-text" contenteditable="true" data-index="${i}">${this.escapeHtml(note.text)}</div>
      </div>
    `
      )
      .join("");
  }

  bindNoteEvents() {
    const list = this.overlayEl.querySelector("#overlay-notes-list");
    if (!list) return;

    list.querySelectorAll(".overlay-note-delete-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index);
        this.deleteNote(idx);
      });
    });

    list.querySelectorAll(".overlay-note-text").forEach((el) => {
      el.addEventListener("blur", () => {
        const idx = parseInt(el.dataset.index);
        const text = el.textContent.trim();
        if (text && this.notes[idx]) {
          this.notes[idx].text = text;
          this.saveNotes();
        }
      });
    });
  }

  addNote() {
    this.notes.unshift({ ts: Date.now(), text: "New note..." });
    this.saveNotes();
    this.renderNotes();
  }

  deleteNote(idx) {
    this.notes.splice(idx, 1);
    this.saveNotes();
    this.renderNotes();
  }

  async renderScreenshots() {
    const pane = this.overlayEl.querySelector('[data-panel="screenshots"] .overlay-panel-body');
    if (!pane) return;

    try {
      const files = await os.fs.readdir(["Pictures", "Screenshots"]);
      const filesArray = Object.entries(files || {})
        .filter(([, item]) => item.type === "file")
        .map(([name, item]) => ({ ...item, name }));
      const imageFiles = filesArray.filter(
        (f) =>
          f.name &&
          (f.name.endsWith(".png") || f.name.endsWith(".jpg") || f.name.endsWith(".jpeg") || f.name.endsWith(".webm"))
      );

      const hasFiles = imageFiles.length > 0;

      pane.innerHTML = `
        <div class="overlay-screenshots-toolbar">
          <button class="overlay-screenshot-action-btn" id="overlay-screenshot-full" title="Take Screenshot">
            <i class="fas fa-camera"></i>
          </button>
          <button class="overlay-screenshot-action-btn" id="overlay-screenshot-record" title="Record Video">
            <i class="fas fa-video"></i>
          </button>
        </div>
      `;

      if (!hasFiles) {
        pane.innerHTML += `
          <div class="overlay-no-data" style="font-style:normal">
            No screenshots yet
          </div>
        `;
      } else {
        const sortedFiles = imageFiles.sort((a, b) => (b.mtime || 0) - (a.mtime || 0));

        pane.innerHTML += `
          <div class="overlay-screenshots-grid">
            ${sortedFiles
              .map(
                (file) => `
              <div class="overlay-screenshot-card" data-name="${file.name}">
                <button class="overlay-screenshot-delete" data-name="${file.name}"><i class="fas fa-trash"></i></button>
                ${
                  file.name.endsWith(".webm")
                    ? `<video src="" muted loop class="screenshot-video" data-path="Pictures/Screenshots/${file.name}"></video>`
                    : `<img src="" alt="${file.name}" class="screenshot-img" data-path="Pictures/Screenshots/${file.name}">`
                }
              </div>
            `
              )
              .join("")}
          </div>
        `;

        for (const file of sortedFiles) {
          const path = `Pictures/Screenshots/${file.name}`;
          const preview = pane.querySelector(`[data-path="${path}"]`);
          if (preview) {
            try {
              const data = await os.fs.readBinaryFile(["Pictures", "Screenshots"], file.name);
              const url = URL.createObjectURL(data);
              if (file.name.endsWith(".webm")) {
                preview.src = url;
              } else {
                preview.src = url;
              }
            } catch (e) {
              console.warn("[Overlay] Failed to load screenshot:", file.name, e);
            }
          }
        }

        pane.querySelectorAll(".overlay-screenshot-delete").forEach((btn) => {
          btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const name = btn.dataset.name;
            this.deleteScreenshot(name);
          });
        });

        pane.querySelectorAll(".overlay-screenshot-card").forEach((card) => {
          card.addEventListener("click", () => {
            const name = card.dataset.name;
            this.viewScreenshot(name);
          });
        });
      }

      const fullBtn = pane.querySelector("#overlay-screenshot-full");
      const recordBtn = pane.querySelector("#overlay-screenshot-record");

      if (fullBtn) {
        fullBtn.addEventListener("click", () => this.captureScreenshot("full"));
      }
      if (recordBtn) {
        recordBtn.addEventListener("click", () => this.captureScreenshot("record"));
      }
    } catch (e) {
      console.warn("[Overlay] Failed to load screenshots:", e);
      pane.innerHTML = `<div class="overlay-no-data">Failed to load screenshots</div>`;
    }
  }

  async deleteScreenshot(name) {
    try {
      await os.fs.delete(["Pictures", "Screenshots"], name);
      this.cleanupScreenshotView(`screenshot-view--${name}`);
      os.notify.send("Screenshots", `Deleted ${name}`);
      this.renderScreenshots();
    } catch (e) {
      console.warn("[Overlay] Failed to delete screenshot:", e);
      os.notify.send("Screenshots", "Failed to delete", { type: "error" });
    }
  }

  async viewScreenshot(name) {
    const panelId = `screenshot-view--${name}`;
    if (this.overlayEl?.querySelector(`[data-panel="${panelId}"]`)) {
      this.togglePanel(panelId);
      return;
    }
    try {
      const data = await os.fs.readBinaryFile(["Pictures", "Screenshots"], name);
      const url = URL.createObjectURL(data);
      this.screenshotViewUrls.set(panelId, url);
      this.togglePanel(panelId);
    } catch (e) {
      console.warn("[Overlay] Failed to view screenshot:", e);
      os.notify.send("Screenshots", "Failed to open", { type: "error" });
    }
  }

  renderScreenshotView(panelId) {
    const pane = this.overlayEl?.querySelector(`[data-panel="${panelId}"] .overlay-panel-body`);
    if (!pane) return;
    const name = panelId.replace("screenshot-view--", "");
    const url = this.screenshotViewUrls.get(panelId);
    if (!url) {
      pane.innerHTML = `<div class="overlay-no-data">Failed to load screenshot</div>`;
      return;
    }
    pane.innerHTML = `
      <div class="overlay-screenshot-viewer">
        <div class="overlay-screenshot-viewer-content">
          ${
            name.endsWith(".webm")
              ? `<video src="${url}" controls autoplay class="overlay-screenshot-viewer-media"></video>`
              : `<img src="${url}" alt="${name}" class="overlay-screenshot-viewer-media">`
          }
        </div>
      </div>
    `;
  }

  async captureScreenshot(mode) {
    if (!this.screenshotApp) {
      this.screenshotApp = new ScreenshotApp(this.os);
    }

    switch (mode) {
      case "full":
        await this.screenshotApp.captureFull(true);
        this.renderScreenshots();
        break;
      case "record":
        this.toggleOverlayRecording();
        break;
    }
  }

  async toggleOverlayRecording() {
    if (this.recording) {
      this.screenshotApp.stopOverlayRecording();
      this.recording = false;
      this.updateRecordBtn();
      if (this.recordingDonePromise) {
        await this.recordingDonePromise;
        this.recordingDonePromise = null;
      }
      this.renderScreenshots();
    } else {
      try {
        this.recordingDonePromise = this.screenshotApp.startOverlayRecording();
        this.recording = true;
        this.updateRecordBtn();
        os.notify.send("Recording", "Recording started.");
      } catch {
        this.recording = false;
        this.updateRecordBtn();
      }
    }
  }

  updateRecordBtn() {
    const label = this.overlayEl?.querySelector("#overlay-record-label");
    if (!label) return;
    label.textContent = this.recording ? "Stop" : "Record";
  }

  renderRecordings() {
    const pane = this.overlayEl.querySelector('[data-panel="recordings"] .overlay-panel-body');
    if (!pane) return;
    pane.innerHTML = `
      <div class="overlay-recordings-placeholder">
        <i class="fas fa-camera"></i>
        <h3>Images</h3>
        <p>Screenshots and recordings will appear here once implemented.</p>
      </div>
    `;
  }

  initScramjet() {
    const pane = this.overlayEl.querySelector('[data-panel="scramjet"] .overlay-panel-body');
    if (!pane) return;

    const panel = pane.closest(".overlay-panel");
    if (panel) panel.style.height = "500px";

    if (pane.querySelector("iframe")) return;

    const wrapper = createElement("div");
    wrapper.style.cssText = "width:100%;height:100%;overflow:hidden;";

    const iframe = createElement("iframe");
    iframe.style.cssText = "width:100%;height:100%;border:none;";
    iframe.setAttribute(
      "sandbox",
      "allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation-by-user-activation"
    );
    iframe.src = window.location.origin + "/s/index.html";

    wrapper.appendChild(iframe);
    pane.innerHTML = "";
    pane.appendChild(wrapper);
  }

  renderSettings() {
    const pane = this.overlayEl.querySelector('[data-panel="settings"] .overlay-panel-body');
    if (!pane) return;

    const keybind = KeybindManager.getCurrentKeys("steam.overlay") || ["Shift", "Tab"];

    pane.innerHTML = `
      <div class="overlay-settings-container">
        <div class="overlay-settings-section">
          <div class="overlay-settings-section-title">Overlay Settings</div>
          <div class="overlay-settings-row">
            <div>
              <div class="overlay-settings-label">Enable Steam Overlay While In-Game</div>
              <div class="overlay-settings-desc">Show overlay when pressing the shortcut key</div>
            </div>
            <div class="overlay-settings-toggle ${this.settings.enabled ? "active" : ""}" data-setting="enabled"></div>
          </div>
          <div class="overlay-settings-row">
            <div>
              <div class="overlay-settings-label">Restore Browser Tabs When Starting a Game</div>
              <div class="overlay-settings-desc">Reopen previously opened browser tabs in the overlay</div>
            </div>
            <div class="overlay-settings-toggle ${this.settings.restoreTabs ? "active" : ""}" data-setting="restoreTabs"></div>
          </div>
          <div class="overlay-settings-row">
            <div>
              <div class="overlay-settings-label">Overlay Shortcut Keys</div>
              <div class="overlay-settings-desc">Click to reassign</div>
            </div>
            <div class="overlay-settings-keybind">
              <button class="overlay-settings-keybtn" id="overlay-keybind-btn">${keybind.join(" + ")}</button>
            </div>
          </div>
        </div>
        <div class="overlay-settings-section">
          <div class="overlay-settings-section-title">Performance Settings</div>
          <div class="overlay-settings-row">
            <div>
              <div class="overlay-settings-label">Overlay Performance Monitor</div>
              <div class="overlay-settings-desc">Show FPS and frame timing in the overlay top bar</div>
            </div>
            <div class="overlay-settings-toggle ${this.settings.perfMonitor ? "active" : ""}" data-setting="perfMonitor"></div>
          </div>
        </div>
        <div class="overlay-settings-section">
          <div class="overlay-settings-section-title">Dock Configuration</div>
          <div class="overlay-settings-desc" style="margin-bottom:8px;">Drag to reorder &middot; Toggle to show/hide</div>
          <div class="overlay-settings-dock-section" id="overlay-dock-config">
            ${(this.settings.dockItems || [])
              .map((item) => {
                const def = DOCK_ITEM_DEFAULTS.find((d) => d.id === item.id);
                return `
                <div class="overlay-settings-dock-row" data-dock-id="${item.id}">
                  <span class="overlay-settings-dock-grip"><i class="fas fa-grip-vertical"></i></span>
                  <span class="overlay-settings-dock-label"><i class="fas ${def?.icon || "fa-circle"}"></i> ${def?.title || item.id}</span>
                  <div class="overlay-settings-toggle ${item.visible ? "active" : ""}" data-dock-toggle="${item.id}"></div>
                </div>
              `;
              })
              .join("")}
          </div>
        </div>
      </div>
    `;

    pane.querySelectorAll(".overlay-settings-toggle").forEach((toggle) => {
      toggle.addEventListener("click", () => {
        const setting = toggle.dataset.setting;
        const isActive = toggle.classList.contains("active");
        toggle.classList.toggle("active");
        this.settings[setting] = !isActive;
        this.saveSettings();

        if (setting === "perfMonitor") {
          if (this.settings.perfMonitor) this.startPerfMonitor();
          else this.stopPerfMonitor();
        }
      });
    });

    pane.querySelectorAll(".overlay-settings-toggle[data-dock-toggle]").forEach((toggle) => {
      toggle.addEventListener("click", () => {
        const dockId = toggle.dataset.dockToggle;
        const item = this.settings.dockItems.find((d) => d.id === dockId);
        if (item) {
          item.visible = !item.visible;
          toggle.classList.toggle("active");
          this.saveSettings();
          this.rebuildDock();
        }
      });
    });

    const dockConfig = pane.querySelector("#overlay-dock-config");
    if (dockConfig) {
      let dragRow = null;
      dockConfig.querySelectorAll(".overlay-settings-dock-row").forEach((row) => {
        row.draggable = true;
        row.addEventListener("dragstart", (e) => {
          dragRow = row;
          row.style.opacity = "0.4";
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", row.dataset.dockId);
        });
        row.addEventListener("dragover", (e) => {
          e.preventDefault();
          if (dragRow && dragRow !== row) {
            const rect = row.getBoundingClientRect();
            const mid = rect.top + rect.height / 2;
            dockConfig.insertBefore(dragRow, e.clientY < mid ? row : row.nextSibling);
          }
        });
        row.addEventListener("dragend", () => {
          row.style.opacity = "";
          dragRow = null;
          const newOrder = [];
          dockConfig.querySelectorAll(".overlay-settings-dock-row").forEach((r) => {
            const id = r.dataset.dockId;
            const existing = this.settings.dockItems.find((d) => d.id === id);
            if (existing) newOrder.push(existing);
          });
          this.settings.dockItems = newOrder;
          this.saveSettings();
          this.rebuildDock();
        });
      });
    }

    const keybindBtn = pane.querySelector("#overlay-keybind-btn");
    if (keybindBtn) {
      keybindBtn.addEventListener("click", () => {
        if (this.listeningForKeybind) return;
        this.listeningForKeybind = true;
        keybindBtn.classList.add("listening");
        keybindBtn.textContent = "Press new shortcut...";

        const handler = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const parts = [];
          if (e.ctrlKey) parts.push("Ctrl");
          if (e.shiftKey) parts.push("Shift");
          if (e.altKey) parts.push("Alt");
          if (e.metaKey) parts.push("Meta");
          const key = e.key;
          if (!["Control", "Shift", "Alt", "Meta"].includes(key)) {
            parts.push(key.length === 1 ? key.toUpperCase() : key);
          }
          if (parts.length >= 2) {
            document.removeEventListener("keydown", handler);
            this.listeningForKeybind = false;
            keybindBtn.classList.remove("listening");
            KeybindManager.setKeys("steam.overlay", parts);
            keybindBtn.textContent = parts.join(" + ");
          }
        };
        document.addEventListener("keydown", handler);
      });
    }
  }

  renderAudio() {
    const pane = this.overlayEl.querySelector('[data-panel="audio"] .overlay-panel-body');
    if (!pane) return;
    const mixer = audioMixer();
    const masterPct = Math.round(mixer.masterVolume * 100);

    let channelsHtml = "";
    mixer.channels.forEach((ch, winId) => {
      const chPct = Math.round(ch.volume * 100);
      channelsHtml += `
        <div class="overlay-audio-row" data-winid="${winId}">
          <div class="overlay-audio-row-icon">${ch.iconHtml || '<i class="fas fa-volume-up"></i>'}</div>
          <div class="overlay-audio-row-label">${this.escapeHtml(ch.title || "Unknown")}</div>
          <input type="range" min="0" max="100" value="${chPct}" class="overlay-audio-slider" data-channel="${winId}">
          <span class="overlay-audio-pct">${chPct}%</span>
        </div>`;
    });

    pane.innerHTML = `
      <div class="overlay-audio-container">
        <div class="overlay-audio-section">
          <div class="overlay-audio-section-title">Master Volume</div>
          <div class="overlay-audio-row">
            <div class="overlay-audio-row-icon"><i class="fas fa-volume-up"></i></div>
            <input type="range" min="0" max="100" value="${masterPct}" class="overlay-audio-slider" id="overlay-audio-master">
            <span class="overlay-audio-pct" id="overlay-audio-master-pct">${masterPct}%</span>
          </div>
        </div>
        <div class="overlay-audio-section">
          <div class="overlay-audio-section-title">Applications</div>
          <div class="overlay-audio-apps">
            ${channelsHtml || '<div class="overlay-audio-empty">No audio sources yet</div>'}
          </div>
        </div>
      </div>
    `;

    const masterSlider = pane.querySelector("#overlay-audio-master");
    if (masterSlider) {
      masterSlider.addEventListener("input", () => {
        const val = parseInt(masterSlider.value) / 100;
        mixer.setMaster(val);
        const pctEl = pane.querySelector("#overlay-audio-master-pct");
        if (pctEl) pctEl.textContent = `${Math.round(val * 100)}%`;
      });
    }

    pane.querySelectorAll(".overlay-audio-slider[data-channel]").forEach((slider) => {
      slider.addEventListener("input", () => {
        const winId = slider.dataset.channel;
        if (!winId) return;
        const val = parseInt(slider.value) / 100;
        mixer.setChannel(winId, val);
        const row = slider.closest(".overlay-audio-row");
        if (row) {
          const pct = row.querySelector(".overlay-audio-pct");
          if (pct) pct.textContent = `${Math.round(val * 100)}%`;
        }
      });
    });
  }

  renderLauncher() {
    const pane = this.overlayEl.querySelector('[data-panel="launcher"] .overlay-panel-body');
    if (!pane) return;

    const allApps = os.app.getAllApps();
    if (!allApps) {
      pane.innerHTML = '<div class="overlay-no-data">No apps available</div>';
      return;
    }

    const systemApps = Object.entries(allApps)
      .filter(([, app]) => app && app.type === "system" && app.title)
      .sort(([, a], [, b]) => a.title.localeCompare(b.title));

    const renderIcon = (app) => {
      if (app.icon && typeof app.icon === "string") {
        if (app.icon.startsWith("fa")) {
          return `<i class="${app.icon}"></i>`;
        }
        return `<img src="${resolveIconUrl(app.icon)}" alt="">`;
      }
      return `<i class="fas fa-window-maximize"></i>`;
    };

    pane.innerHTML = `
      <input type="text" class="overlay-launcher-search" placeholder="Search apps..." id="overlay-launcher-search">
      <div class="overlay-launcher-grid" id="overlay-launcher-grid">
        ${systemApps
          .map(
            ([key, app]) => `
          <div class="overlay-launcher-item" data-app="${key}">
            <div class="overlay-launcher-item-icon">${renderIcon(app)}</div>
            <div class="overlay-launcher-item-label">${this.escapeHtml(app.title)}</div>
          </div>
        `
          )
          .join("")}
      </div>
    `;

    const searchInput = pane.querySelector("#overlay-launcher-search");
    const grid = pane.querySelector("#overlay-launcher-grid");
    searchInput.addEventListener("input", () => {
      const q = searchInput.value.toLowerCase();
      grid.querySelectorAll(".overlay-launcher-item").forEach((item) => {
        const label = item.querySelector(".overlay-launcher-item-label").textContent.toLowerCase();
        item.style.display = label.includes(q) ? "" : "none";
      });
    });

    pane.querySelectorAll(".overlay-launcher-item").forEach((item) => {
      item.addEventListener("click", () => {
        const appId = item.dataset.app;
        if (appId) {
          this.close();
          os.app.launch(appId);
        }
      });
    });
  }

  initTerminal() {
    const pane = this.overlayEl.querySelector('[data-panel="terminal"] .overlay-panel-body');
    if (!pane) return;

    if (pane.querySelector(".terminal-content")) return;
    if (this.terminalApp && !this.terminalApp.destroyed) return;

    this.terminalApp = new TerminalApp(this.os);

    const content = createElement("div");
    content.className = "window-content terminal-content overlay-terminal-container";
    content.innerHTML = `
      <div class="terminal-output" id="terminal-output"></div>
      <div class="terminal-input-line" id="terminal-input-line">
        <span id="terminal-prompt"></span>
        <input class="terminal-input" id="terminal-input" spellcheck="false" autocomplete="off">
      </div>
    `;
    pane.appendChild(content);

    this.terminalApp.terminalOutput = content.querySelector("#terminal-output");
    this.terminalApp.terminalInput = content.querySelector("#terminal-input");
    this.terminalApp.terminalPrompt = content.querySelector("#terminal-prompt");
    this.terminalApp.terminalInputLine = content.querySelector("#terminal-input-line");

    this.terminalApp.updatePrompt();
    this.terminalApp.print("YukiOS Terminal \u2014 Overlay", "var(--charging)");
    this.terminalApp.print("Type 'help' for available commands\n");

    this.terminalApp.terminalInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const cmd = this.terminalApp.terminalInput.value.trim();
        if (!cmd) return;
        this.terminalApp.history.push(cmd);
        this.terminalApp.historyIndex = this.terminalApp.history.length;
        this.terminalApp.terminalInput.value = "";
        this.terminalApp.executeCommand(cmd);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (this.terminalApp.historyIndex > 0) {
          this.terminalApp.terminalInput.value = this.terminalApp.history[--this.terminalApp.historyIndex];
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        this.terminalApp.historyIndex = Math.min(this.terminalApp.historyIndex + 1, this.terminalApp.history.length);
        this.terminalApp.terminalInput.value =
          this.terminalApp.historyIndex < this.terminalApp.history.length
            ? this.terminalApp.history[this.terminalApp.historyIndex]
            : "";
      }
    });

    this.terminalApp.cmdExit = () => {
      this.togglePanel("terminal");
    };

    this.terminalApp.terminalInput.focus();
  }

  startClock() {
    import("./services/timeWorker.js").then(({ subscribeTimeTick }) => {
      this.overlayClockUnsub = subscribeTimeTick((data) => {
        const timeEl = this.overlayEl?.querySelector("#overlay-clock-time");
        const dateEl = this.overlayEl?.querySelector("#overlay-clock-date");
        const sessionEl = this.overlayEl?.querySelector("#overlay-session-time");
        if (timeEl) timeEl.textContent = data.timeLong;
        if (dateEl) dateEl.textContent = data.dateLong;
        if (sessionEl && this.sessionStart) {
          const min = Math.round((Date.now() - this.sessionStart) / 60000);
          sessionEl.textContent = `${min}m - this session`;
        }
      });
    });
    this.updateOverviewPlaytime();
    this.playtimeInterval = setInterval(() => this.updateOverviewPlaytime(), 1000);
  }

  stopClock() {
    if (this.overlayClockUnsub) {
      this.overlayClockUnsub();
      this.overlayClockUnsub = null;
    }
    if (this.playtimeInterval) {
      clearInterval(this.playtimeInterval);
      this.playtimeInterval = null;
    }
  }

  startPerfMonitor() {
    this.perfMonitorEnabled = true;
    const perfEl = this.overlayEl?.querySelector("#overlay-perf-monitor");
    if (perfEl) perfEl.style.display = "flex";

    let lastTime = performance.now();
    let frames = 0;
    let lastFpsUpdate = performance.now();

    const frame = (time) => {
      if (!this.perfMonitorEnabled || !this.visible) return;
      frames++;
      const elapsed = time - lastFpsUpdate;
      if (elapsed >= 500) {
        const fps = Math.round((frames * 1000) / elapsed);
        const frameTime = ((time - lastTime) / frames).toFixed(1);
        const fpsEl = this.overlayEl?.querySelector("#perf-fps");
        const frameEl = this.overlayEl?.querySelector("#perf-frame");
        if (fpsEl) fpsEl.textContent = fps;
        if (frameEl) frameEl.textContent = frameTime;
        frames = 0;
        lastFpsUpdate = time;
      }
      lastTime = time;
      this.perfRafId = requestAnimationFrame(frame);
    };

    this.perfRafId = requestAnimationFrame(frame);
  }

  stopPerfMonitor() {
    this.perfMonitorEnabled = false;
    if (this.perfRafId) {
      cancelAnimationFrame(this.perfRafId);
      this.perfRafId = null;
    }
    const perfEl = this.overlayEl?.querySelector("#overlay-perf-monitor");
    if (perfEl) perfEl.style.display = "none";
  }

  cleanupScreenshotView(id) {
    if (!id.startsWith("screenshot-view--")) return;
    const url = this.screenshotViewUrls.get(id);
    if (url) {
      URL.revokeObjectURL(url);
      this.screenshotViewUrls.delete(id);
    }
  }

  cleanupAllScreenshotViews() {
    for (const [id, url] of this.screenshotViewUrls) {
      URL.revokeObjectURL(url);
    }
    this.screenshotViewUrls.clear();
  }

  escapeHtml(str) {
    if (!str) return "";
    const div = createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
}
