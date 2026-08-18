import "./style.css";
import { os, ServiceKeys } from "../../framework.js";
import { modeManager, MODES } from "../../modeManager.js";
import { createElement, $ } from "../../shared/domUtils.js";
import { resolveIconUrl } from "../../shared/assetResolver.js";
import { BusEvents } from "../../core/EventBus.js";
import { getSetting } from "../../utils/utils.js";
import { showStartStyleMenu } from "../../shared/contextMenu.js";
import { StorageKeys } from "../../StorageKeys.js";
import { KeybindManager } from "../../keybindManager.js";

const DEFAULT_DOCK_APPS = [
  { appId: "launchpadApp", title: "Launchpad", icon: "fas fa-th", color: "#888" },
  { appId: "commandPalette", title: "Finder", icon: "fas fa-folder", color: "#6ea8fe", isFinder: true },
  { appId: "explorerApp", title: "Explorer", icon: `static/icons/file.webp`, color: "#fff" },
  { appId: "browserApp", title: "Yuki Browser", icon: "static/icons/firefox.webp", color: "#fff" },
  { appId: "terminalApp", title: "Terminal", icon: `static/icons/terminal.webp`, color: "#fff" },
  { appId: "settingsApp", title: "Settings", icon: "fa fa-cog", color: "#adb5bd" },
  { appId: "calculatorApp", title: "Calculator", icon: "fas fa-calculator", color: "#20c997" },
  { appId: "notepadApp", title: "Notes", icon: "static/icons/notepad.webp", color: "#ffc107" },
  { appId: "discordApp", title: "Discord", icon: "fab fa-discord", color: "#5865f2" },
  { appId: "trashApp", title: "Trash", icon: "fas fa-trash", color: "#888", isTrash: true }
];

export class MacDock {
  constructor(manager) {
    this.manager = manager;
    this.container = null;
    this.runningItems = new Map();
    this.pinnedItems = [];
    this.boundHover = this.handleHover.bind(this);
    this.boundFocus = this.handleFocus.bind(this);
    this.boundClosed = this.handleClosed.bind(this);
    this.boundSettings = this.onSettingsChanged.bind(this);
    this.boundAutoHide = this.onAutoHideMove.bind(this);
    this.boundKeydown = this.handleKeydown.bind(this);
    this.lastClientX = null;
    this.lastClientY = null;
    this.dragState = null;
    this.autoHideVisible = false;
    this.showHideTimer = null;
    this.settings = this.getDefaultSettings();
  }

  getDefaultSettings() {
    return {
      dockEnabled: false,
      dockPosition: "bottom",
      dockAutoHide: false,
      dockMagnification: true,
      dockMagnifyAmount: 1.2,
      dockMagnifyRange: 3,
      dockIconSize: 43,
      dockScale: 100,
      dockAnimationSpeed: 0.2
    };
  }

  readSettings() {
    this.settings = {
      dockEnabled: getSetting("dockEnabled", false) === true,
      dockPosition: os.storage.get(StorageKeys.dockPosition) || "bottom",
      dockAutoHide: os.storage.get(StorageKeys.dockAutoHide) === "true",
      dockMagnification: os.storage.get(StorageKeys.dockMagnification) !== "false",
      dockMagnifyAmount: Number(os.storage.get(StorageKeys.dockMagnifyAmount)) || 1.2,
      dockMagnifyRange: Number(os.storage.get(StorageKeys.dockMagnifyRange)) || 3,
      dockIconSize: Number(os.storage.get(StorageKeys.dockIconSize)) || 43,
      dockScale: Number(os.storage.get(StorageKeys.dockScale)) || 100,
      dockAnimationSpeed: Number(os.storage.get(StorageKeys.dockAnimationSpeed)) || 0.2
    };
  }

  applyCSSSettings() {
    if (!this.container) return;
    const s = this.settings;
    const scaleVal = Math.max(50, Math.min(200, s.dockScale)) / 100;
    const iconSize = Math.max(28, Math.min(80, s.dockIconSize));
    const animSpeed = Math.max(0.05, Math.min(0.5, s.dockAnimationSpeed));
    this.container.style.setProperty("--dock-icon-size", `${iconSize}px`);
    this.container.style.setProperty("--dock-scale", scaleVal);
    this.container.style.setProperty("--dock-anim-speed", `${animSpeed}s`);
    this.container.classList.toggle("dock-auto-hide", s.dockAutoHide);
    this.container.classList.toggle("dock-magnify", s.dockMagnification);
    this.container.dataset.position = s.dockPosition;
  }

  init() {
    if (this.container) return;
    this.readSettings();
    this.container = createElement("div", { id: "mac-dock", className: "mac-dock" });
    document.body.appendChild(this.container);
    this.applyCSSSettings();
    this.loadPinnedItems();
    this.renderPinnedItems();
    this.container.addEventListener("mousemove", this.boundHover);
    this.container.addEventListener("mouseleave", this.boundHover);
    if (this.settings.dockAutoHide) {
      document.addEventListener("mousemove", this.boundAutoHide);
    }
    document.addEventListener("keydown", this.boundKeydown);
    os.events.on(BusEvents.WINDOW_FOCUSED, this.boundFocus);
    os.events.on(BusEvents.WINDOW_CLOSED, this.boundClosed);
    os.events.on(BusEvents.SETTINGS_CHANGED, this.boundSettings);
    this.syncMacSetting(true);
  }

  destroy() {
    if (!this.container) return;
    this.syncMacSetting(false);
    document.removeEventListener("keydown", this.boundKeydown);
    this.container.removeEventListener("mousemove", this.boundHover);
    this.container.removeEventListener("mouseleave", this.boundHover);
    document.removeEventListener("mousemove", this.boundAutoHide);
    this.container.remove();
    this.container = null;
    this.runningItems.clear();
    this.pinnedItems = [];
    os.events.off(BusEvents.WINDOW_FOCUSED, this.boundFocus);
    os.events.off(BusEvents.WINDOW_CLOSED, this.boundClosed);
    os.events.off(BusEvents.SETTINGS_CHANGED, this.boundSettings);
  }

  syncMacSetting(enabled) {
    if (enabled) {
      modeManager.enter(MODES.MAC);
    } else {
      modeManager.exit(MODES.MAC);
    }
  }

  onSettingsChanged() {
    this.readSettings();
    if (!this.container) return;
    this.applyCSSSettings();
    if (this.settings.dockAutoHide) {
      document.addEventListener("mousemove", this.boundAutoHide);
    } else {
      document.removeEventListener("mousemove", this.boundAutoHide);
      if (this.container) this.container.classList.remove("dock-hidden");
    }
  }

  isActive() {
    this.readSettings();
    return this.settings.dockEnabled === true;
  }

  addItem(winId, iconValue, title, color = null) {
    if (!this.container) return;
    if (this.runningItems.has(winId)) return;

    const win = $("#" + winId);
    const appId = win?.dataset?.appId;
    const pinned = appId ? this.pinnedItems.find((p) => p.appId === appId) : null;

    if (pinned) {
      pinned.winId = winId;
      pinned.el.classList.add("active");
      const dot = pinned.el.querySelector(".dock-running-dot");
      this.runningItems.set(winId, { isPinned: true, pinnedRef: pinned });
      return;
    }

    iconValue = resolveIconUrl(iconValue);
    const iconEl = this.buildIcon(iconValue, title, color);
    const dot = createElement("span", { className: "dock-running-dot" });
    const iconWrap = createElement("div", { className: "dock-icon-wrap" });
    iconWrap.appendChild(iconEl);
    iconWrap.appendChild(dot);

    const label = createElement("span", { className: "dock-label" });
    label.textContent = title;

    const item = createElement("div", {
      className: "dock-item dock-running",
      attributes: { "data-win-id": winId }
    });
    item.appendChild(iconWrap);
    item.appendChild(label);
    item.addEventListener("click", () => this.handleItemClick(winId));
    item.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const targetWin = $("#" + winId);
      if (!targetWin) return;
      showStartStyleMenu(e, (addMenuItem, addSeparator) => {
        this.manager.buildContextMenuItems(addMenuItem, addSeparator, targetWin);
      });
    });
    item.classList.add("active");

    this.container.appendChild(item);
    this.runningItems.set(winId, { el: item, isPinned: false, iconValue, title, color });
    this.triggerRecalc();
  }

  removeItem(winId) {
    const entry = this.runningItems.get(winId);
    if (!entry) return;
    this.runningItems.delete(winId);

    if (entry.isPinned && entry.pinnedRef) {
      entry.pinnedRef.el.classList.remove("active");
      return;
    }

    if (entry.el) {
      entry.el.remove();
      this.triggerRecalc();
    }
  }

  updateActiveState(winId) {
    this.runningItems.forEach((entry, id) => {
      if (entry.isPinned && entry.pinnedRef) {
        entry.pinnedRef.el.classList.toggle("active", id === winId);
      } else if (entry.el) {
        entry.el.classList.toggle("active", id === winId);
      }
    });
  }

  loadPinnedItems() {
    const saved = os.storage.get(StorageKeys.dockPinnedItems);
    if (saved && Array.isArray(saved)) {
      this.pinnedItems = saved;
    } else {
      this.pinnedItems = [...DEFAULT_DOCK_APPS];
    }
  }

  savePinnedItems() {
    const toSave = this.pinnedItems.map((item) => ({
      appId: item.appId,
      title: item.title,
      icon: item.icon,
      color: item.color,
      isFinder: item.isFinder,
      isAudioMixer: item.isAudioMixer,
      isTrash: item.isTrash
    }));
    os.storage.set(StorageKeys.dockPinnedItems, toSave);
  }

  unpinItem(appId) {
    const idx = this.pinnedItems.findIndex((p) => p.appId === appId);
    if (idx === -1) return;
    const pinned = this.pinnedItems[idx];
    this.pinnedItems.splice(idx, 1);
    if (pinned.el) pinned.el.remove();
    this.savePinnedItems();
  }

  renderPinnedItems() {
    this.pinnedItems.forEach((app, index) => {
      const iconValue = resolveIconUrl(app.icon);
      const iconEl = this.buildIcon(iconValue, app.title, app.color);
      const dot = createElement("span", { className: "dock-running-dot" });
      const iconWrap = createElement("div", { className: "dock-icon-wrap" });
      iconWrap.appendChild(iconEl);
      iconWrap.appendChild(dot);

      const label = createElement("span", { className: "dock-label" });
      label.textContent = app.title;

      const item = createElement("div", {
        className: "dock-item dock-pinned",
        attributes: { "data-app-id": app.appId }
      });
      item.appendChild(iconWrap);
      item.appendChild(label);
      item.addEventListener("click", () => {
        if (app.isFinder) {
          os.app.getInstance(ServiceKeys.COMMAND_PALETTE)?.open();
        } else if (app.isAudioMixer) {
          import("../../audioMixer.js").then((m) => m.audioMixer().toggle());
        } else if (app.isTrash) {
          os.app.getInstance(ServiceKeys.EXPLORER)?.openTrash();
        } else {
          os.app.launch(app.appId).catch(() => {});
        }
      });
      item.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        const openWinId = app.winId && this.manager.openWindows?.has(app.winId) ? app.winId : null;
        if (openWinId) {
          const targetWin = $("#" + openWinId);
          if (targetWin) {
            showStartStyleMenu(e, (addMenuItem, addSeparator) => {
              this.manager.buildContextMenuItems(addMenuItem, addSeparator, targetWin);
              addSeparator();
              addMenuItem("Unpin from Dock", () => this.unpinItem(app.appId), "fa-thumbtack");
            });
            return;
          }
        }
        showStartStyleMenu(e, (addMenuItem, addSeparator) => {
          addMenuItem(
            "Launch App",
            () => {
              if (app.isFinder) os.app.getInstance(ServiceKeys.COMMAND_PALETTE)?.open();
              else if (app.isAudioMixer) import("../../audioMixer.js").then((m) => m.audioMixer().toggle());
              else if (app.isTrash) os.app.getInstance(ServiceKeys.EXPLORER)?.openTrash();
              else os.app.launch(app.appId);
            },
            "fa-play"
          );
          addSeparator();
          addMenuItem("Unpin from Dock", () => this.unpinItem(app.appId), "fa-thumbtack");
        });
      });

      this.container.appendChild(item);
      app.el = item;
      this.setupDraggable(item, index, true);
    });
  }

  buildIcon(iconValue, title, color) {
    const inner = createElement("div", { className: "dock-icon-inner" });
    const { isImage, isDataUrl } = this.manager.resolveIconType(iconValue);
    if (isImage || isDataUrl) {
      const img = createElement("img", { attributes: { src: iconValue, alt: title } });
      img.onerror = () => {
        const fallback = createElement("i", { className: "fas fa-window-maximize" });
        fallback.style.color = color ?? "var(--brand)";
        img.replaceWith(fallback);
      };
      inner.appendChild(img);
    } else {
      const icon = createElement("i", { attributes: { alt: title } });
      icon.className = typeof iconValue === "string" && iconValue.startsWith("fa") ? iconValue : `fa ${iconValue}`;
      icon.style.color = color ?? "var(--text-primary)";
      inner.appendChild(icon);
    }
    return inner;
  }

  handleItemClick(winId) {
    const win = $("#" + winId);
    if (!win) return;
    if (win.style.display === "none") {
      win.style.display = "";
      const entry = this.runningItems.get(winId);
      if (entry && !entry.isPinned && entry.el) entry.el.classList.remove("minimized");
      if (entry && entry.isPinned && entry.pinnedRef) entry.pinnedRef.el.classList.remove("minimized");
    }
    this.manager.bringToFront(win);
  }

  triggerRecalc() {
    if (this.lastClientX != null) {
      this.processHover(this.lastClientX, this.lastClientY);
    }
  }

  onAutoHideMove(e) {
    if (!this.container) return;
    const s = this.settings;
    const dockRect = this.container.getBoundingClientRect();
    const edge = s.dockPosition;
    let show = false;
    const margin = 16;
    if (edge === "bottom") {
      show = e.clientY >= window.innerHeight - margin;
    } else if (edge === "left") {
      show = e.clientX <= margin;
    } else if (edge === "right") {
      show = e.clientX >= window.innerWidth - margin;
    }
    if (show) {
      this.container.classList.remove("dock-hidden");
      this.autoHideVisible = true;
    } else {
      const isOver =
        e.clientX >= dockRect.left &&
        e.clientX <= dockRect.right &&
        e.clientY >= dockRect.top &&
        e.clientY <= dockRect.bottom;
      if (!isOver) {
        this.container.classList.add("dock-hidden");
        this.autoHideVisible = false;
      }
    }
  }

  handleKeydown(e) {
    if (!this.container) return;
    const tag = e.target?.tagName?.toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select" || e.target?.isContentEditable) return;

    for (let i = 1; i <= 10; i++) {
      const id = i === 10 ? "dock.launch10" : `dock.launch${i}`;
      if (KeybindManager.matches(e, id)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        const items = this.container.querySelectorAll(".dock-item");
        const idx = i - 1;
        if (idx < items.length) {
          items[idx].click();
        }
        return;
      }
    }
  }

  handleHover(e) {
    if (!this.container) return;

    if (e.type === "mousemove") {
      this.hoverX = e.clientX;
      this.hoverY = e.clientY;
      if (this.hoverRafId) return;
      this.hoverRafId = requestAnimationFrame(() => {
        this.hoverRafId = null;
        this.processHover(this.hoverX, this.hoverY);
      });
      return;
    }

    if (e.type === "mouseleave") {
      if (this.hoverRafId) {
        cancelAnimationFrame(this.hoverRafId);
        this.hoverRafId = null;
      }
      const items = [...this.container.querySelectorAll(".dock-item")];
      items.forEach((el) => {
        el.style.transform = "";
        const wrap = el.querySelector(".dock-icon-wrap");
        if (wrap) wrap.style.transform = "";
      });
      this.container.style.paddingLeft = "";
      this.container.style.paddingRight = "";
      this.container.style.paddingTop = "";
      this.container.style.paddingBottom = "";
      this.lastClientX = null;
      this.lastClientY = null;
    }
  }

  processHover(clientX, clientY) {
    const s = this.settings;
    const items = [...this.container.querySelectorAll(".dock-item")];
    const magnifyEnabled = s.dockMagnification;

    if (!magnifyEnabled) {
      items.forEach((el) => {
        el.style.transform = "";
        const wrap = el.querySelector(".dock-icon-wrap");
        if (wrap) wrap.style.transform = "";
      });
      this.container.style.paddingLeft = "";
      this.container.style.paddingRight = "";
      this.container.style.paddingTop = "";
      this.container.style.paddingBottom = "";
      return;
    }

    this.lastClientX = clientX;
    this.lastClientY = clientY;

    const containerRect = this.container.getBoundingClientRect();
    const isHorizontal = s.dockPosition === "bottom";
    const mousePos = isHorizontal ? clientX - containerRect.left : clientY - containerRect.top;

    const affectRange = Math.max(1, Math.min(10, s.dockMagnifyRange));
    const magnifyAmount = Math.max(0.1, Math.min(3, s.dockMagnifyAmount));

    let hoverIdx = 0;
    let minDist = Infinity;
    items.forEach((el, i) => {
      const cx = isHorizontal ? el.offsetLeft + el.offsetWidth / 2 : el.offsetTop + el.offsetHeight / 2;
      const d = Math.abs(mousePos - cx);
      if (d < minDist) {
        minDist = d;
        hoverIdx = i;
      }
    });

    const extras = items.map((el, i) => {
      const d = Math.abs(i - hoverIdx);
      if (d > affectRange) return 0;
      const scale = 1 + magnifyAmount * Math.pow(0.4, d);
      const dim = isHorizontal ? el.offsetWidth : el.offsetHeight;
      return (dim * (scale - 1)) / 2;
    });

    const prefix = [0];
    for (let i = 0; i < extras.length; i++) {
      prefix.push(prefix[prefix.length - 1] + extras[i]);
    }

    let maxStartExtra = 0;
    let maxEndExtra = 0;

    items.forEach((el, i) => {
      const dist = Math.abs(i - hoverIdx);
      const inRange = dist <= affectRange;

      if (inRange) {
        const scale = 1 + magnifyAmount * Math.pow(0.4, dist);
        const lift = Math.pow(0.4, dist) * 20;
        const wrap = el.querySelector(".dock-icon-wrap");
        if (wrap) {
          if (isHorizontal) {
            wrap.style.transform = scale !== 1 ? `scale(${scale}) translateY(${-lift}px)` : "";
          } else {
            wrap.style.transform = scale !== 1 ? `scale(${scale})` : "";
          }
        }
      } else {
        const wrap = el.querySelector(".dock-icon-wrap");
        if (wrap) wrap.style.transform = "";
      }

      let push = 0;
      if (i < hoverIdx) {
        push = prefix[i + 1] - prefix[hoverIdx + 1];
      } else if (i > hoverIdx) {
        push = prefix[i] - prefix[hoverIdx];
      }

      if (isHorizontal) {
        el.style.transform = push ? `translateX(${push}px)` : "";
      } else {
        el.style.transform = push ? `translateY(${push}px)` : "";
      }

      if (push < 0) maxStartExtra = Math.max(maxStartExtra, -push);
      if (push > 0) maxEndExtra = Math.max(maxEndExtra, push);
    });

    if (isHorizontal) {
      this.container.style.paddingLeft = 9 + maxStartExtra + "px";
      this.container.style.paddingRight = 9 + maxEndExtra + "px";
    } else {
      this.container.style.paddingTop = 9 + maxStartExtra + "px";
      this.container.style.paddingBottom = 9 + maxEndExtra + "px";
    }
  }

  handleFocus({ winId }) {
    this.updateActiveState(winId);
  }

  setupDraggable(item, index, isPinned = false) {
    item.setAttribute("draggable", "true");

    item.addEventListener("dragstart", (e) => {
      this.dragState = {
        item,
        index,
        isPinned,
        startX: e.clientX,
        startY: e.clientY
      };
      item.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", index.toString());
    });

    item.addEventListener("dragend", () => {
      if (this.dragState) {
        this.dragState.item.classList.remove("dragging");
        this.dragState = null;
      }
      this.container.querySelectorAll(".dock-item.drag-over").forEach((el) => {
        el.classList.remove("drag-over");
      });
    });

    item.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (!this.dragState || this.dragState.item === item) return;
      e.dataTransfer.dropEffect = "move";
      item.classList.add("drag-over");
    });

    item.addEventListener("dragleave", () => {
      item.classList.remove("drag-over");
    });

    item.addEventListener("drop", (e) => {
      e.preventDefault();
      if (!this.dragState || this.dragState.item === item) return;

      const fromIndex = this.dragState.index;
      const toIndex = index;
      const fromIsPinned = this.dragState.isPinned;
      const toIsPinned = isPinned;

      if (fromIsPinned && toIsPinned) {
        this.reorderPinnedItems(fromIndex, toIndex);
      }

      item.classList.remove("drag-over");
    });
  }

  reorderPinnedItems(fromIndex, toIndex) {
    if (fromIndex === toIndex) return;
    const [moved] = this.pinnedItems.splice(fromIndex, 1);
    this.pinnedItems.splice(toIndex, 0, moved);

    this.container.innerHTML = "";
    this.renderPinnedItems();
    this.savePinnedItems();
  }

  handleClosed({ winId }) {
    this.removeItem(winId);
  }
}
