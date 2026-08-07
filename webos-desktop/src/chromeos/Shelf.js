import "../styles/chromeos.css";
import { createElement, os, StorageKeys } from "../framework.js";
import { $ } from "../shared/domUtils.js";
import { modeManager, MODES } from "../modeManager.js";
import { BusEvents } from "../core/EventBus.js";
import { resolveIconUrl } from "../shared/assetResolver.js";
import { showStartStyleMenu } from "../shared/contextMenu.js";
import { getLauncher, initLauncher, destroyLauncher } from "./Launcher.js";
import { getAppRegistry } from "../appRegistry.js";
import { ChromeOsQuickSettings } from "./quickSettings.js";

const DEFAULT_SHELF_APPS = [
  { appId: "explorerApp", title: "Files", icon: "static/icons/file.webp" },
  { appId: "browserApp", title: "Browser", icon: "static/icons/firefox.webp" },
  { appId: "terminalApp", title: "Terminal", icon: "static/icons/terminal.webp" },
  { appId: "settingsApp", title: "Settings", icon: "fa fa-cog" }
];

export class Shelf {
  constructor(wm) {
    this.wm = wm;
    this.el = null;
    this.runningItems = new Map();
    this.pinnedItems = [];
    this.quickSettings = null;

    this.boundFocus = this.handleFocus.bind(this);
    this.boundClosed = this.handleClosed.bind(this);
    this.boundSettings = this.onSettingsChanged.bind(this);
    this.boundMode = this.onModeChanged.bind(this);
  }

  init() {
    if (this.el) return;
    this.loadPinnedItems();
    this.createDOM();
    initLauncher();
    getLauncher().setShelf(this);
    this.quickSettings = new ChromeOsQuickSettings(this);
    this.quickSettings.init();
    os.events.on(BusEvents.WINDOW_FOCUSED, this.boundFocus);
    os.events.on(BusEvents.WINDOW_CLOSED, this.boundClosed);
    os.events.on(BusEvents.SETTINGS_CHANGED, this.boundSettings);
    os.events.on(BusEvents.MODE_ENTERED, this.boundMode);
    os.events.on(BusEvents.MODE_EXITED, this.boundMode);
    this.applySettings();
  }

  destroy() {
    if (!this.el) return;
    this.quickSettings?.destroy();
    this.quickSettings = null;
    destroyLauncher();
    os.events.off(BusEvents.WINDOW_FOCUSED, this.boundFocus);
    os.events.off(BusEvents.WINDOW_CLOSED, this.boundClosed);
    os.events.off(BusEvents.SETTINGS_CHANGED, this.boundSettings);
    os.events.off(BusEvents.MODE_ENTERED, this.boundMode);
    os.events.off(BusEvents.MODE_EXITED, this.boundMode);
    this.el.remove();
    this.el = null;
    this.runningItems.clear();
    this.pinnedItems = [];
  }

  onModeChanged({ id }) {
    if (id !== MODES.CHROME_OS) return;
    if (modeManager.isActive(MODES.CHROME_OS)) {
      this.show();
    } else {
      this.hide();
    }
  }

  show() {
    if (this.el) this.el.style.display = "flex";
  }

  hide() {
    if (this.el) this.el.style.display = "none";
    this.quickSettings?.closeCalendarPopup();
  }

  createDOM() {
    this.el = createElement("div", { id: "chromeos-shelf" });

    const leftSection = createElement("div", { className: "shelf-left" });
    const rightSection = createElement("div", { className: "shelf-right" });

    this.launcherBtn = createElement("button", {
      className: "shelf-launcher-btn",
      attributes: { title: "Launcher" }
    });
    this.launcherBtn.innerHTML = `<i class="fas fa-circle"></i>`;
    leftSection.appendChild(this.launcherBtn);

    this.appsContainer = createElement("div", { className: "shelf-apps" });
    this.renderPinnedItems();

    this.el.appendChild(leftSection);
    this.el.appendChild(this.appsContainer);
    this.el.appendChild(rightSection);
    document.body.appendChild(this.el);

    this.el.addEventListener("click", (e) => {
      if (e.target.closest(".shelf-launcher-btn")) {
        e.stopPropagation();
        this.toggleLauncher();
      }
    });
  }

  toggleLauncher() {
    getLauncher().toggle();
  }

  loadPinnedItems() {
    const saved = os.storage.get(StorageKeys.chromeOsShelfPinnedItems);
    if (saved && Array.isArray(saved) && saved.length) {
      this.pinnedItems = saved.map((a) => ({ ...a }));
    } else {
      this.pinnedItems = DEFAULT_SHELF_APPS.map((a) => ({ ...a }));
    }
  }

  savePinnedItems() {
    os.storage.set(StorageKeys.chromeOsShelfPinnedItems, this.pinnedItems);
  }

  isPinned(appId) {
    return this.pinnedItems.some((p) => p.appId === appId);
  }

  pinApp(appId, title, icon) {
    if (this.isPinned(appId)) return;
    this.pinnedItems.push({ appId, title, icon });
    this.savePinnedItems();
    this.renderPinnedItems();
  }

  unpinApp(appId) {
    const idx = this.pinnedItems.findIndex((p) => p.appId === appId);
    if (idx === -1) return;
    this.pinnedItems.splice(idx, 1);
    this.savePinnedItems();
    this.renderPinnedItems();
  }

  findRunningWindow(appId) {
    for (const [winId, entry] of this.runningItems) {
      const win = $(`#${winId}`);
      if (win && win.dataset?.appId === appId) return win;
    }
    return null;
  }

  renderPinnedItems() {
    this.appsContainer.innerHTML = "";
    this.pinnedItems.forEach((app) => {
      const iconValue = resolveIconUrl(app.icon);
      const item = createElement("div", {
        className: "shelf-pinned-item",
        attributes: { "data-app-id": app.appId }
      });
      const iconEl = createElement("div", { className: "shelf-item-icon" });
      if (iconValue.startsWith("fa")) {
        iconEl.innerHTML = `<i class="${iconValue}"></i>`;
      } else {
        const img = createElement("img", { attributes: { src: iconValue, alt: app.title } });
        iconEl.appendChild(img);
      }
      item.appendChild(iconEl);
      item.addEventListener("click", () => {
        os.app.launch(app.appId).catch(() => {});
      });
      item.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        showStartStyleMenu(e, (addMenuItem, addSeparator) => {
          const runningWin = this.findRunningWindow(app.appId);
          if (runningWin) {
            if (this.wm.buildContextMenuItems) {
              this.wm.buildContextMenuItems(addMenuItem, addSeparator, runningWin);
            }
            addSeparator();
          }
          addMenuItem("New Window", () => os.app.launch(app.appId), "fa-plus-square");
          addSeparator();
          addMenuItem("Unpin", () => this.unpinApp(app.appId), "fa-thumbtack");
          addSeparator();
          addMenuItem("Launch", () => os.app.launch(app.appId), "fa-play");
          addSeparator();
          addMenuItem(
            "Rename",
            async () => {
              const appRegistry = getAppRegistry();
              const current = appRegistry.getAppDisplayName(app.appId, app.title);
              const newName = await os.dialog.prompt("Rename", "Enter a new name:", current);
              if (newName && newName.trim()) {
                appRegistry.setAppName(app.appId, newName.trim());
              }
            },
            "fa-pen"
          );
        });
      });
      this.appsContainer.appendChild(item);
      app.el = item;
    });
  }

  addRunningItem(winId, icon, title) {
    if (this.runningItems.has(winId)) return;
    const win = $(`#${winId}`);
    const appId = win?.dataset?.appId;
    const pinned = appId ? this.pinnedItems.find((p) => p.appId === appId) : null;

    if (pinned) {
      pinned.el.classList.add("active");
      this.runningItems.set(winId, { isPinned: true, pinnedRef: pinned });
      return;
    }

    const item = createElement("div", {
      className: "shelf-running-item",
      attributes: { "data-win-id": winId }
    });
    const iconEl = createElement("div", { className: "shelf-item-icon" });
    const resolved = resolveIconUrl(icon);
    if (resolved.startsWith("fa")) {
      iconEl.innerHTML = `<i class="${resolved}"></i>`;
    } else {
      const img = createElement("img", { attributes: { src: resolved, alt: title } });
      iconEl.appendChild(img);
    }
    item.appendChild(iconEl);
    const dot = createElement("div", { className: "shelf-running-dot" });
    item.appendChild(dot);

    item.addEventListener("click", () => {
      const targetWin = $(`#${winId}`);
      if (targetWin) {
        if (targetWin.style.display === "none") {
          targetWin.style.display = "";
        }
        this.wm.bringToFront(targetWin);
      }
    });
    item.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const targetWin = $(`#${winId}`);
      if (!targetWin) return;
      showStartStyleMenu(e, (addMenuItem, addSeparator) => {
        if (this.wm.buildContextMenuItems) {
          this.wm.buildContextMenuItems(addMenuItem, addSeparator, targetWin);
        }
        addSeparator();
        addMenuItem("Close", () => this.wm.closeWindow(targetWin), "fa-times");
      });
    });

    this.appsContainer.appendChild(item);
    this.runningItems.set(winId, { el: item, isPinned: false });
  }

  removeRunningItem(winId) {
    const entry = this.runningItems.get(winId);
    if (!entry) return;
    this.runningItems.delete(winId);
    if (entry.isPinned && entry.pinnedRef) {
      entry.pinnedRef.el.classList.remove("active");
      return;
    }
    if (entry.el) {
      entry.el.remove();
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

  handleFocus({ winId }) {
    this.updateActiveState(winId);
  }

  handleClosed({ winId }) {
    this.removeRunningItem(winId);
  }

  onSettingsChanged() {
    this.applySettings();
  }

  applySettings() {
    const pos = os.storage.get(StorageKeys.chromeOsShelfPosition) || "bottom";
    const autoHide = os.storage.get(StorageKeys.chromeOsShelfAutoHide) === "true";

    if (this.el) {
      this.el.dataset.shelfPos = pos;
      this.el.className = this.el.className
        .replace(/shelf-pos-\w+/g, "")
        .trim()
        .split(" ")
        .filter(Boolean)
        .concat(`shelf-pos-${pos}`)
        .join(" ");
      this.el.classList.toggle("shelf-autohide", autoHide);
    }
  }
}
