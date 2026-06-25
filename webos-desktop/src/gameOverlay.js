import { KeybindManager } from "./keybindManager.js";
import { StorageKeys, os } from "./framework.js";
import { SteamDataManager, steamAppRenderer } from "./games/games.js";
import { ScreenshotApp } from "./apps/screenshot.js";
import { TerminalApp } from "./apps/terminal.js";
import { audioMixer } from "./audioMixer.js";
import { resolveIconUrl } from "./shared/assetResolver.js";
import { $$ } from "./shared/domUtils.js";

const OVERLAY_SETTINGS_KEY = "yukiOS_overlay_settings";
const OVERLAY_NOTES_KEY = "yukiOS_overlay_notes";
const OVERLAY_PANEL_POSITIONS_KEY = "yukiOS_overlay_panel_positions";
const OVERLAY_OPEN_PANELS_KEY = "yukiOS_overlay_open_panels";

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
  constructor(appLauncher, services) {
    this.appLauncher = appLauncher;
    this.services = services;
    this.wm = services.windowManager;
    this.visible = false;
    this.overlayEl = null;
    this.currentGameId = null;
    this.currentWinId = null;
    this.currentGameTitle = "";
    this.activeTab = "overview";
    this.friendsWindow = null;
    this.perfMonitorEnabled = false;
    this._perfInterval = null;
    this._clockInterval = null;
    this._sessionStart = null;
    this._achievementFilter = "all";
    this._settings = this._loadSettings();
    this.notes = this._loadNotes();
    this._listeningForKeybind = false;
    this._screenshotApp = null;
    this._openPanels = new Set();
    this._panelZCounter = 100;
    this._panelPositions = {};
    this._screenshotViewUrls = new Map();
    this._recording = false;
    this._recordingDonePromise = null;
    this._init();
  }

  _init() {
    document.addEventListener("keydown", this._onKeyDown.bind(this));
    document.addEventListener("keydown", (e) => {
      if (this.visible && e.key === "Escape") {
        e.preventDefault();
        this.close();
      }
    });
  }

  _onKeyDown(e) {
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

  _loadSettings() {
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

  _saveSettings() {
    os.storage.set(OVERLAY_SETTINGS_KEY, this._settings);
  }

  _loadNotes() {
    try {
      return os.storage.get(OVERLAY_NOTES_KEY) || [];
    } catch {
      return [];
    }
  }

  _saveNotes() {
    os.storage.set(OVERLAY_NOTES_KEY, this.notes);
  }

  _loadPanelPositions() {
    try {
      return os.storage.get(OVERLAY_PANEL_POSITIONS_KEY) || {};
    } catch {
      return {};
    }
  }

  _savePanelPositions() {
    os.storage.set(OVERLAY_PANEL_POSITIONS_KEY, this._panelPositions);
  }

  _loadOpenPanels() {
    try {
      const arr = os.storage.get(OVERLAY_OPEN_PANELS_KEY);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  _saveOpenPanels() {
    os.storage.set(OVERLAY_OPEN_PANELS_KEY, Array.from(this._openPanels));
  }

  _findActiveGameWindow() {
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

  _isSystemApp(appId) {
    const entry = this.appLauncher.appMap?.[appId];
    return entry?.type === "system";
  }

  openForWindow(gameWin) {
    if (!this._settings?.enabled || !gameWin) return;
    if (this._isSystemApp(gameWin.dataset.appId)) return;
    this.currentWinId = gameWin.id;
    this.currentGameId = gameWin.dataset.appId;
    this.currentGameTitle = this._getGameTitle(this.currentGameId);
    this._sessionStart = Date.now();
    this._blockGameInput(gameWin);

    if (this.overlayEl) {
      const titleEl = this.overlayEl.querySelector(".overlay-info-title");
      if (titleEl) titleEl.textContent = this._escapeHtml(this.currentGameTitle);
      this.overlayEl.style.display = "";
      requestAnimationFrame(() => this.overlayEl.classList.add("steam-overlay--visible"));
    } else {
      this._buildOverlay();
    }

    this.visible = true;
    this._startClock();
    if (this._settings.perfMonitor) this._startPerfMonitor();
  }

  open() {
    if (!this._settings.enabled) return;
    const gameWin = this._findActiveGameWindow();
    if (!gameWin) return;
    if (this._isSystemApp(gameWin.dataset.appId)) return;

    this.currentWinId = gameWin.id;
    this.currentGameId = gameWin.dataset.appId;
    this.currentGameTitle = this._getGameTitle(this.currentGameId);
    this._sessionStart = Date.now();
    this._blockGameInput(gameWin);

    if (this.overlayEl) {
      const titleEl = this.overlayEl.querySelector(".overlay-info-title");
      if (titleEl) titleEl.textContent = this._escapeHtml(this.currentGameTitle);
      this.overlayEl.style.display = "";
      requestAnimationFrame(() => this.overlayEl.classList.add("steam-overlay--visible"));
    } else {
      this._buildOverlay();
    }

    this.visible = true;
    this._startClock();
    if (this._settings.perfMonitor) this._startPerfMonitor();
  }

  close() {
    this._stopClock();
    this._stopPerfMonitor();
    this._restoreGameInput();
    this._savePanelPositions();
    this._saveOpenPanels();

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

  _exitGame() {
    const win = document.getElementById(this.currentWinId);
    this.close();
    if (win) {
      os.window.close(win);
    }
  }

  _getGameTitle(appId) {
    const map = this.appLauncher.appMap || {};
    return map[appId]?.title || appId || "Game";
  }

  _blockGameInput(win) {
    const content = win.querySelector(".window-content");
    if (content) content.style.pointerEvents = "none";
  }

  _restoreGameInput() {
    if (this.currentWinId) {
      const win = document.getElementById(this.currentWinId);
      if (win) {
        const content = win.querySelector(".window-content");
        if (content) content.style.pointerEvents = "";
      }
    }
  }

  _buildOverlay() {
    if (this.overlayEl) {
      this.overlayEl.remove();
    }

    this._openPanels = new Set();
    this._panelPositions = this._loadPanelPositions();

    const el = document.createElement("div");
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
        <span class="overlay-info-title">${this._escapeHtml(this.currentGameTitle)}</span>
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
    this._buildDock(el.querySelector("#steam-overlay-dock"));

    this._bindOverlayEvents();

    const prevOpen = this._loadOpenPanels();
    if (prevOpen.includes("overview")) {
      this._togglePanel("overview");
    }
    for (const id of prevOpen) {
      if (id !== "overview") {
        this._togglePanel(id);
      }
    }
    if (!prevOpen.length) {
      this._togglePanel("overview");
    }

    requestAnimationFrame(() => {
      el.classList.add("steam-overlay--visible");
    });
  }

  _buildDock(dockEl) {
    dockEl.innerHTML = "";
    const dockArr = this._settings.dockItems || DOCK_ITEM_DEFAULTS.map((d) => ({ id: d.id, visible: true }));
    const visible = dockArr.filter((d) => d.visible);
    let draggedId = null;

    visible.forEach((item, i) => {
      const def = DOCK_ITEM_DEFAULTS.find((d) => d.id === item.id);
      if (!def) return;

      const btn = document.createElement("button");
      btn.className = "overlay-dock-btn" + (this._openPanels.has(item.id) ? " active" : "");
      btn.dataset.panel = item.id;
      btn.draggable = true;
      btn.innerHTML = `<i class="fas ${def.icon}"></i>`;

      btn.addEventListener("click", () => this._togglePanel(item.id));

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
        this._reorderDock(draggedId, item.id);
        draggedId = null;
      });

      btn.addEventListener("dragend", () => {
        btn.classList.remove("dragging");
        draggedId = null;
        dockEl.querySelectorAll(".overlay-dock-btn").forEach((b) => b.classList.remove("drag-over"));
      });

      dockEl.appendChild(btn);
    });

    const closeBtn = document.createElement("button");
    closeBtn.className = "overlay-dock-btn overlay-dock-close";
    closeBtn.id = "overlay-dock-close";
    closeBtn.innerHTML = '<i class="fas fa-times"></i>';
    closeBtn.addEventListener("click", () => this.close());
    dockEl.appendChild(closeBtn);
  }

  _rebuildDock() {
    const dockEl = this.overlayEl?.querySelector("#steam-overlay-dock");
    if (dockEl) this._buildDock(dockEl);
  }

  _reorderDock(fromId, toId) {
    const items = this._settings.dockItems;
    const fromIdx = items.findIndex((d) => d.id === fromId);
    const toIdx = items.findIndex((d) => d.id === toId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = items.splice(fromIdx, 1);
    items.splice(toIdx, 0, moved);
    this._saveSettings();
    this._rebuildDock();
  }

  _bindOverlayEvents() {
    const el = this.overlayEl;

    el.querySelector("#overlay-close-x").addEventListener("click", () => this.close());
    el.querySelector("#overlay-exit-game").addEventListener("click", () => this._exitGame());

    el.addEventListener("click", (e) => {
      if (e.target === el.querySelector(".steam-overlay-backdrop")) {
        this.close();
      }
    });
  }

  _togglePanel(id) {
    const container = this.overlayEl.querySelector("#overlay-panels-container");
    let panel = container.querySelector(`[data-panel="${id}"]`);

    if (panel) {
      if (panel.style.display === "none") {
        panel.style.display = "";
        this._openPanels.add(id);
        this._bringPanelToFront(panel);
        this._activateDockBtn(id);
        this._lazyRender(id);
      } else {
        panel.style.display = "none";
        this._openPanels.delete(id);
        this._deactivateDockBtn(id);
      }
      return;
    }

    this._createPanel(id, container);
    this._openPanels.add(id);
    this._lazyRender(id);
    this._activateDockBtn(id);
  }

  _createPanel(id, container) {
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
    const pos = this._panelPositions[id] || this._getDefaultPanelPos(id);
    const panel = document.createElement("div");
    panel.className = "overlay-panel";
    panel.dataset.panel = id;
    const wStr = pos.w !== undefined ? `width:${pos.w}px;` : "";
    const hStr = pos.h !== undefined ? `height:${pos.h}px;` : "";
    panel.style.cssText = `position:absolute;left:${pos.x}px;top:${pos.y}px;${wStr}${hStr}z-index:${++this._panelZCounter};display:block;`;
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
    this._makePanelDraggable(panel);
    this._makePanelResizable(panel);
    panel.querySelector(".overlay-panel-close").addEventListener("click", (e) => {
      e.stopPropagation();
      this._togglePanel(id);
    });
    panel.querySelector(".overlay-panel-maximize").addEventListener("click", (e) => {
      e.stopPropagation();
      this._toggleMaximizePanel(panel);
    });
    panel.addEventListener("mousedown", () => this._bringPanelToFront(panel));
  }

  _getDefaultPanelPos(id) {
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

  _makePanelDraggable(panel) {
    const header = panel.querySelector(".overlay-panel-header");
    const container = panel.parentElement;
    let isDragging = false;
    let startX, startY, origX, origY;
    let activeSnapZone = null;

    header.addEventListener("mousedown", (e) => {
      if (e.target.closest(".overlay-panel-close") || e.target.closest(".overlay-panel-maximize")) return;
      isDragging = true;
      this._bringPanelToFront(panel);
      header.style.cursor = "grabbing";

      if (panel.classList.contains("maximized")) {
        const restore = panel._preMaximizeRect || this._getDefaultPanelPos(panel.dataset.panel);
        panel.classList.remove("maximized");
        panel.querySelector(".overlay-panel-maximize i").className = "fas fa-expand";
        panel.style.width = restore.w + "px";
        panel.style.height = restore.h + "px";
        panel.style.left = e.clientX - restore.w / 2 + "px";
        panel.style.top = "0px";
        panel._preMaximizeRect = null;
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
      activeSnapZone = this._getSnapZone(e.clientX, e.clientY, containerRect);
      if (activeSnapZone) {
        this._showSnapPreview(container, this._getSnapRect(activeSnapZone, containerRect));
      } else {
        this._hideSnapPreview(container);
      }
    });

    document.addEventListener("mouseup", (e) => {
      if (isDragging) {
        isDragging = false;
        header.style.cursor = "grab";
        this._hideSnapPreview(container);

        if (activeSnapZone) {
          const containerRect = container.getBoundingClientRect();
          const snapRect = this._getSnapRect(activeSnapZone, containerRect);
          panel.style.left = snapRect.x + "px";
          panel.style.top = snapRect.y + "px";
          panel.style.width = snapRect.w + "px";
          panel.style.height = snapRect.h + "px";
          activeSnapZone = null;
        }

        this._panelPositions[panel.dataset.panel] = {
          x: parseInt(panel.style.left),
          y: parseInt(panel.style.top),
          w: panel.offsetWidth,
          h: panel.offsetHeight
        };
        this._savePanelPositions();
      }
    });
  }

  _makePanelResizable(panel) {
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
        this._panelPositions[panel.dataset.panel] = {
          x: parseInt(panel.style.left),
          y: parseInt(panel.style.top),
          w: panel.offsetWidth,
          h: panel.offsetHeight
        };
        this._savePanelPositions();
      }
    });
  }

  _bringPanelToFront(panel) {
    panel.style.zIndex = ++this._panelZCounter;
  }

  _toggleMaximizePanel(panel) {
    const id = panel.dataset.panel;
    const container = this.overlayEl.querySelector("#overlay-panels-container");
    const icon = panel.querySelector(".overlay-panel-maximize i");

    if (panel.classList.contains("maximized")) {
      const restore = panel._preMaximizeRect || this._getDefaultPanelPos(id);
      panel.classList.remove("maximized");
      panel.style.left = restore.x + "px";
      panel.style.top = restore.y + "px";
      panel.style.width = restore.w + "px";
      panel.style.height = restore.h + "px";
      panel._preMaximizeRect = null;
      if (icon) icon.className = "fas fa-expand";
      this._panelPositions[id] = { x: restore.x, y: restore.y, w: restore.w, h: restore.h };
      this._savePanelPositions();
    } else {
      panel._preMaximizeRect = {
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
    this._bringPanelToFront(panel);
  }

  _getSnapZone(clientX, clientY, containerRect) {
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

  _getSnapRect(zone, containerRect) {
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

  _getSnapPreviewEl(container) {
    let preview = container.querySelector(".overlay-snap-preview");
    if (!preview) {
      preview = document.createElement("div");
      preview.className = "overlay-snap-preview";
      container.appendChild(preview);
    }
    return preview;
  }

  _showSnapPreview(container, snapRect) {
    const preview = this._getSnapPreviewEl(container);
    preview.style.left = snapRect.x + "px";
    preview.style.top = snapRect.y + "px";
    preview.style.width = snapRect.w + "px";
    preview.style.height = snapRect.h + "px";
    preview.classList.add("active");
  }

  _hideSnapPreview(container) {
    const preview = container.querySelector(".overlay-snap-preview");
    if (preview) preview.classList.remove("active");
  }

  _activateDockBtn(id) {
    const btn = this.overlayEl.querySelector(`.overlay-dock-btn[data-panel="${id}"]`);
    if (btn) btn.classList.add("active");
  }

  _deactivateDockBtn(id) {
    const btn = this.overlayEl.querySelector(`.overlay-dock-btn[data-panel="${id}"]`);
    if (btn) btn.classList.remove("active");
  }

  _lazyRender(id) {
    switch (id) {
      case "overview":
        this._renderOverview();
        break;
      case "achievements":
        this._renderAchievements();
        break;
      case "friends":
        this._renderFriends();
        break;
      case "notes":
        this._renderNotes();
        break;
      case "scramjet":
        this._initScramjet();
        break;
      case "screenshots":
        this._renderScreenshots();
        break;
      case "audio":
        this._renderAudio();
        break;
      case "launcher":
        this._renderLauncher();
        break;
      case "terminal":
        this._initTerminal();
        break;
      case "settings":
        this._renderSettings();
        break;
    }
    if (id.startsWith("screenshot-view--")) {
      this._renderScreenshotView(id);
    }
  }

  _formatTime(min) {
    if (!min || min < 0) return "0m";
    if (min < 60) return `${Math.round(min)}m`;
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  _formatTimeDecimal(min) {
    if (!min || min < 0) return "0 hrs";
    const h = (min / 60).toFixed(1);
    return `${h} hrs`;
  }

  _getDayLabel(i) {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return days[d.getDay()];
  }

  _getDayValue(i) {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  }

  _renderOverview() {
    const pane = this.overlayEl.querySelector('[data-panel="overview"] .overlay-panel-body');
    if (!pane) return;

    const stats = SteamDataManager.getStats();
    const gameStats = stats[this.currentGameId] || { totalMin: 0, lastPlayed: 0 };
    const sessionMin = this._sessionStart ? Math.round((Date.now() - this._sessionStart) / 60000) : 0;

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
            <span class="overview-playtime-value">${this._formatTimeDecimal(gameStats.totalMin)}</span>
          </div>
          <div class="overview-playtime-row">
            <span>Last 2 Weeks</span>
            <span class="overview-playtime-value">${this._formatTime(SteamDataManager.getRecentMinutes(this.currentGameId))}</span>
          </div>
          <div class="overview-playtime-row">
            <span>Current Session</span>
            <span class="overview-playtime-value" id="overview-session-playtime">${this._formatTime(sessionMin)}</span>
          </div>
        </div>
      </div>
    `;
  }

  _updateOverviewPlaytime() {
    if (!this.visible) return;
    const sessionMin = this._sessionStart ? Math.round((Date.now() - this._sessionStart) / 60000) : 0;
    const sessionEl = this.overlayEl?.querySelector("#overview-session-playtime");
    if (sessionEl) {
      sessionEl.textContent = this._formatTime(sessionMin);
    }
  }

  _renderAchievements() {
    const pane = this.overlayEl.querySelector('[data-panel="achievements"] .overlay-panel-body');
    if (!pane) return;

    const achApp = this.services.achievementsApp;
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
    if (this._achievementFilter === "unlocked") {
      filtered = allAch.filter((a) => unlocked.has(a.id));
    } else if (this._achievementFilter === "locked") {
      filtered = allAch.filter((a) => !unlocked.has(a.id));
    }

    pane.innerHTML = `
      <div class="overlay-achievements-header">
        <div class="overlay-achievements-stats">
          <strong>${done}</strong> / ${total} unlocked (${pct}%)
        </div>
        <div class="overlay-achievements-filters">
          <button class="overlay-ach-filter-btn ${this._achievementFilter === "all" ? "active" : ""}" data-filter="all">All</button>
          <button class="overlay-ach-filter-btn ${this._achievementFilter === "unlocked" ? "active" : ""}" data-filter="unlocked">Unlocked</button>
          <button class="overlay-ach-filter-btn ${this._achievementFilter === "locked" ? "active" : ""}" data-filter="locked">Locked</button>
        </div>
      </div>
      <div class="overlay-achievements-grid">
        ${filtered
          .map((a) => {
            const isUnlocked = unlocked.has(a.id);
            return `
            <div class="overlay-achievement-card ${isUnlocked ? "overlay-achievement-card--unlocked" : "overlay-achievement-card--locked"}">
              <div class="overlay-ach-icon-wrap">
                <i class="fas ${a.icon || "fa-trophy"}"></i>
              </div>
              <div class="overlay-ach-info">
                <div class="overlay-ach-title">${a.title}</div>
                <div class="overlay-ach-desc">${a.desc || ""}</div>
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
        this._achievementFilter = btn.dataset.filter;
        this._renderAchievements();
      });
    });
  }

  _renderFriends() {
    const pane = this.overlayEl.querySelector('[data-panel="friends"] .overlay-panel-body');
    if (!pane) return;

    if (pane.querySelector(".window-content")) return;

    this._openFriendsPopup();

    const win = document.getElementById("steam-friends-win");
    if (win) {
      const content = win.querySelector(".window-content");
      if (content) {
        pane.innerHTML = "";
        pane.appendChild(content);
        win.remove();
      }
    }
  }

  _openFriendsPopup() {
    const wm = this.wm;
    if (!wm) return;

    const existing = document.getElementById("steam-friends-win");
    if (existing) {
      wm.bringToFront(existing);
      return;
    }

    const renderer = new steamAppRenderer();
    renderer.gameUI.openFriendsWindow(wm);
  }

  _renderNotes() {
    const pane = this.overlayEl.querySelector('[data-panel="notes"] .overlay-panel-body');
    if (!pane) return;

    pane.innerHTML = `
      <div class="overlay-notes-container">
        <div class="overlay-notes-toolbar">
          <button class="overlay-notes-add-btn" id="overlay-notes-add-btn"><i class="fas fa-plus"></i> New Note</button>
        </div>
        <div class="overlay-notes-list" id="overlay-notes-list">
          ${this._renderNotesList()}
        </div>
      </div>
    `;

    pane.querySelector("#overlay-notes-add-btn").addEventListener("click", () => {
      this._addNote();
    });

    this._bindNoteEvents();
  }

  _renderNotesList() {
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
        <div class="overlay-note-text" contenteditable="true" data-index="${i}">${this._escapeHtml(note.text)}</div>
      </div>
    `
      )
      .join("");
  }

  _bindNoteEvents() {
    const list = this.overlayEl.querySelector("#overlay-notes-list");
    if (!list) return;

    list.querySelectorAll(".overlay-note-delete-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index);
        this._deleteNote(idx);
      });
    });

    list.querySelectorAll(".overlay-note-text").forEach((el) => {
      el.addEventListener("blur", () => {
        const idx = parseInt(el.dataset.index);
        const text = el.textContent.trim();
        if (text && this.notes[idx]) {
          this.notes[idx].text = text;
          this._saveNotes();
        }
      });
    });
  }

  _addNote() {
    this.notes.unshift({ ts: Date.now(), text: "New note..." });
    this._saveNotes();
    this._renderNotes();
  }

  _deleteNote(idx) {
    this.notes.splice(idx, 1);
    this._saveNotes();
    this._renderNotes();
  }

  async _renderScreenshots() {
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
            this._deleteScreenshot(name);
          });
        });

        pane.querySelectorAll(".overlay-screenshot-card").forEach((card) => {
          card.addEventListener("click", () => {
            const name = card.dataset.name;
            this._viewScreenshot(name);
          });
        });
      }

      const fullBtn = pane.querySelector("#overlay-screenshot-full");
      const recordBtn = pane.querySelector("#overlay-screenshot-record");

      if (fullBtn) {
        fullBtn.addEventListener("click", () => this._captureScreenshot("full"));
      }
      if (recordBtn) {
        recordBtn.addEventListener("click", () => this._captureScreenshot("record"));
      }
    } catch (e) {
      console.warn("[Overlay] Failed to load screenshots:", e);
      pane.innerHTML = `<div class="overlay-no-data">Failed to load screenshots</div>`;
    }
  }

  async _deleteScreenshot(name) {
    try {
      await os.fs.delete(["Pictures", "Screenshots"], name);
      this._cleanupScreenshotView(`screenshot-view--${name}`);
      os.notify.send("Screenshots", `Deleted ${name}`);
      this._renderScreenshots();
    } catch (e) {
      console.warn("[Overlay] Failed to delete screenshot:", e);
      os.notify.send("Screenshots", "Failed to delete", { type: "error" });
    }
  }

  async _viewScreenshot(name) {
    const panelId = `screenshot-view--${name}`;
    if (this.overlayEl?.querySelector(`[data-panel="${panelId}"]`)) {
      this._togglePanel(panelId);
      return;
    }
    try {
      const data = await os.fs.readBinaryFile(["Pictures", "Screenshots"], name);
      const url = URL.createObjectURL(data);
      this._screenshotViewUrls.set(panelId, url);
      this._togglePanel(panelId);
    } catch (e) {
      console.warn("[Overlay] Failed to view screenshot:", e);
      os.notify.send("Screenshots", "Failed to open", { type: "error" });
    }
  }

  _renderScreenshotView(panelId) {
    const pane = this.overlayEl?.querySelector(`[data-panel="${panelId}"] .overlay-panel-body`);
    if (!pane) return;
    const name = panelId.replace("screenshot-view--", "");
    const url = this._screenshotViewUrls.get(panelId);
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

  async _captureScreenshot(mode) {
    if (!this._screenshotApp) {
      this._screenshotApp = new ScreenshotApp(this.services);
    }

    switch (mode) {
      case "full":
        await this._screenshotApp.captureFull(true);
        this._renderScreenshots();
        break;
      case "record":
        this._toggleOverlayRecording();
        break;
    }
  }

  async _toggleOverlayRecording() {
    if (this._recording) {
      this._screenshotApp.stopOverlayRecording();
      this._recording = false;
      this._updateRecordBtn();
      if (this._recordingDonePromise) {
        await this._recordingDonePromise;
        this._recordingDonePromise = null;
      }
      this._renderScreenshots();
    } else {
      try {
        this._recordingDonePromise = this._screenshotApp.startOverlayRecording();
        this._recording = true;
        this._updateRecordBtn();
        os.notify.send("Recording", "Recording started.");
      } catch {
        this._recording = false;
        this._updateRecordBtn();
      }
    }
  }

  _updateRecordBtn() {
    const label = this.overlayEl?.querySelector("#overlay-record-label");
    if (!label) return;
    label.textContent = this._recording ? "Stop" : "Record";
  }

  _renderRecordings() {
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

  _initScramjet() {
    const pane = this.overlayEl.querySelector('[data-panel="scramjet"] .overlay-panel-body');
    if (!pane) return;

    const panel = pane.closest(".overlay-panel");
    if (panel) panel.style.height = "500px";

    if (pane.querySelector("iframe")) return;

    const wrapper = document.createElement("div");
    wrapper.style.cssText = "width:100%;height:100%;overflow:hidden;";

    const iframe = document.createElement("iframe");
    iframe.style.cssText = "width:100%;height:100%;border:none;";
    iframe.setAttribute(
      "sandbox",
      "allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation-by-user-activation"
    );
    iframe.src = window.location.origin + "/scram/index.html";

    wrapper.appendChild(iframe);
    pane.innerHTML = "";
    pane.appendChild(wrapper);
  }

  _renderSettings() {
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
            <div class="overlay-settings-toggle ${this._settings.enabled ? "active" : ""}" data-setting="enabled"></div>
          </div>
          <div class="overlay-settings-row">
            <div>
              <div class="overlay-settings-label">Restore Browser Tabs When Starting a Game</div>
              <div class="overlay-settings-desc">Reopen previously opened browser tabs in the overlay</div>
            </div>
            <div class="overlay-settings-toggle ${this._settings.restoreTabs ? "active" : ""}" data-setting="restoreTabs"></div>
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
            <div class="overlay-settings-toggle ${this._settings.perfMonitor ? "active" : ""}" data-setting="perfMonitor"></div>
          </div>
        </div>
        <div class="overlay-settings-section">
          <div class="overlay-settings-section-title">Dock Configuration</div>
          <div class="overlay-settings-desc" style="margin-bottom:8px;">Drag to reorder &middot; Toggle to show/hide</div>
          <div class="overlay-settings-dock-section" id="overlay-dock-config">
            ${(this._settings.dockItems || [])
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
        this._settings[setting] = !isActive;
        this._saveSettings();

        if (setting === "perfMonitor") {
          if (this._settings.perfMonitor) this._startPerfMonitor();
          else this._stopPerfMonitor();
        }
      });
    });

    pane.querySelectorAll(".overlay-settings-toggle[data-dock-toggle]").forEach((toggle) => {
      toggle.addEventListener("click", () => {
        const dockId = toggle.dataset.dockToggle;
        const item = this._settings.dockItems.find((d) => d.id === dockId);
        if (item) {
          item.visible = !item.visible;
          toggle.classList.toggle("active");
          this._saveSettings();
          this._rebuildDock();
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
            const existing = this._settings.dockItems.find((d) => d.id === id);
            if (existing) newOrder.push(existing);
          });
          this._settings.dockItems = newOrder;
          this._saveSettings();
          this._rebuildDock();
        });
      });
    }

    const keybindBtn = pane.querySelector("#overlay-keybind-btn");
    if (keybindBtn) {
      keybindBtn.addEventListener("click", () => {
        if (this._listeningForKeybind) return;
        this._listeningForKeybind = true;
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
            this._listeningForKeybind = false;
            keybindBtn.classList.remove("listening");
            KeybindManager.setKeys("steam.overlay", parts);
            keybindBtn.textContent = parts.join(" + ");
          }
        };
        document.addEventListener("keydown", handler);
      });
    }
  }

  _renderAudio() {
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
          <div class="overlay-audio-row-label">${this._escapeHtml(ch.title || "Unknown")}</div>
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

  _renderLauncher() {
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
            <div class="overlay-launcher-item-label">${this._escapeHtml(app.title)}</div>
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

  _initTerminal() {
    const pane = this.overlayEl.querySelector('[data-panel="terminal"] .overlay-panel-body');
    if (!pane) return;

    if (pane.querySelector(".terminal-content")) return;
    if (this._terminalApp && !this._terminalApp._destroyed) return;

    this._terminalApp = new TerminalApp(this.services);

    const content = document.createElement("div");
    content.className = "window-content terminal-content overlay-terminal-container";
    content.innerHTML = `
      <div class="terminal-output" id="terminal-output"></div>
      <div class="terminal-input-line" id="terminal-input-line">
        <span id="terminal-prompt"></span>
        <input class="terminal-input" id="terminal-input" spellcheck="false" autocomplete="off">
      </div>
    `;
    pane.appendChild(content);

    this._terminalApp.terminalOutput = content.querySelector("#terminal-output");
    this._terminalApp.terminalInput = content.querySelector("#terminal-input");
    this._terminalApp.terminalPrompt = content.querySelector("#terminal-prompt");
    this._terminalApp.terminalInputLine = content.querySelector("#terminal-input-line");

    this._terminalApp.updatePrompt();
    this._terminalApp.print("YukiOS Terminal \u2014 Overlay", "#00ff00");
    this._terminalApp.print("Type 'help' for available commands\n");

    this._terminalApp.terminalInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const cmd = this._terminalApp.terminalInput.value.trim();
        if (!cmd) return;
        this._terminalApp.history.push(cmd);
        this._terminalApp.historyIndex = this._terminalApp.history.length;
        this._terminalApp.terminalInput.value = "";
        this._terminalApp.executeCommand(cmd);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (this._terminalApp.historyIndex > 0) {
          this._terminalApp.terminalInput.value = this._terminalApp.history[--this._terminalApp.historyIndex];
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        this._terminalApp.historyIndex = Math.min(this._terminalApp.historyIndex + 1, this._terminalApp.history.length);
        this._terminalApp.terminalInput.value =
          this._terminalApp.historyIndex < this._terminalApp.history.length
            ? this._terminalApp.history[this._terminalApp.historyIndex]
            : "";
      }
    });

    this._terminalApp.terminalInput.focus();
  }

  _startClock() {
    this._updateClock();
    this._clockInterval = setInterval(() => {
      this._updateClock();
      this._updateOverviewPlaytime();
    }, 1000);
  }

  _stopClock() {
    if (this._clockInterval) {
      clearInterval(this._clockInterval);
      this._clockInterval = null;
    }
  }

  _updateClock() {
    const now = new Date();
    const timeEl = this.overlayEl?.querySelector("#overlay-clock-time");
    const dateEl = this.overlayEl?.querySelector("#overlay-clock-date");
    const sessionEl = this.overlayEl?.querySelector("#overlay-session-time");

    if (timeEl) {
      timeEl.textContent = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    }
    if (dateEl) {
      dateEl.textContent = now.toLocaleDateString("en-US", {
        weekday: "short",
        month: "long",
        day: "numeric",
        year: "numeric"
      });
    }
    if (sessionEl && this._sessionStart) {
      const min = Math.round((Date.now() - this._sessionStart) / 60000);
      sessionEl.textContent = `${min}m - this session`;
    }
  }

  _startPerfMonitor() {
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
      this._perfRafId = requestAnimationFrame(frame);
    };

    this._perfRafId = requestAnimationFrame(frame);
  }

  _stopPerfMonitor() {
    this.perfMonitorEnabled = false;
    if (this._perfRafId) {
      cancelAnimationFrame(this._perfRafId);
      this._perfRafId = null;
    }
    const perfEl = this.overlayEl?.querySelector("#overlay-perf-monitor");
    if (perfEl) perfEl.style.display = "none";
  }

  _cleanupScreenshotView(id) {
    if (!id.startsWith("screenshot-view--")) return;
    const url = this._screenshotViewUrls.get(id);
    if (url) {
      URL.revokeObjectURL(url);
      this._screenshotViewUrls.delete(id);
    }
  }

  _cleanupAllScreenshotViews() {
    for (const [id, url] of this._screenshotViewUrls) {
      URL.revokeObjectURL(url);
    }
    this._screenshotViewUrls.clear();
  }

  _escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
}
