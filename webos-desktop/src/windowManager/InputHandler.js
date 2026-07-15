import { toggleStartMenu } from "../desktopui/startMenu.js";
import { resolveIconUrl } from "../shared/assetResolver.js";
import { KeybindManager } from "../keybindManager.js";

import { StorageKeys, os } from "../framework.js";
export class InputHandler {
  constructor(manager) {
    this.manager = manager;
    this.windowSwitcherActive = false;
    this.windowSwitcherIndex = 0;
    this.windowSwitcherWindows = [];
    this.windowSwitcherOverlay = null;
  }

  init() {
    this.initStartMenuKeybinds();
    this.initWindowSwitcher();

    document.addEventListener("keydown", (e) => {
      if (KeybindManager.matches(e, "global.showDesktop")) {
        e.preventDefault();

        const allWindows = Array.from(this.manager.openWindows.keys())
          .map((id) => document.getElementById(id))
          .filter(Boolean);

        const anyVisible = allWindows.some((w) => w.style.display !== "none");

        if (anyVisible) {
          allWindows.forEach((win) => this.manager.minimizeWindow(win));
        } else {
          allWindows.forEach((win) => {
            win.style.display = "block";
            win.style.opacity = "";
            win.style.transform = "";
            win.style.filter = "";
            win.getAnimations().forEach((anim) => anim.cancel());
            const taskbarItem = document.getElementById(`taskbar-${win.id}`);
            if (taskbarItem) taskbarItem.classList.remove("minimized");
          });
        }
      }
    });

    document.addEventListener("keydown", (e) => {
      const focused = Array.from(this.manager.openWindows.keys())
        .map((id) => document.getElementById(id))
        .filter(Boolean)
        .sort((a, b) => parseInt(b.style.zIndex) - parseInt(a.style.zIndex))[0];
      if (!focused) return;
      if (KeybindManager.matches(e, "global.snapLeft")) {
        e.preventDefault();
        this.manager.applySnap(focused, "left");
      }
      if (KeybindManager.matches(e, "global.snapRight")) {
        e.preventDefault();
        this.manager.applySnap(focused, "right");
      }
      if (KeybindManager.matches(e, "global.maximize")) {
        e.preventDefault();
        this.manager.applySnap(focused, "maximize");
      }
    });
  }

  initStartMenuKeybinds() {
    document.addEventListener(
      "pointerdown",
      (e) => {
        const target = e.target;
        if (target?.closest?.(".window")) this.manager.lastFocusZone = "window";
        else if (target?.closest?.("#start-menu")) this.manager.lastFocusZone = "start-menu";
        else this.manager.lastFocusZone = "desktop";

        if (this.manager.lastFocusZone === "desktop") {
          this.manager.openWindows.forEach(({ taskbarItem }) => taskbarItem?.classList?.remove("active"));
        }
      },
      { capture: true }
    );

    document.addEventListener("keydown", (e) => {
      if (!this.shouldOpenStartMenuFromKeyEvent(e)) return;
      e.preventDefault();
      toggleStartMenu({ focusSearch: true, openDefaultPage: true });
    });
  }

  shouldOpenStartMenuFromKeyEvent(e) {
    const isTrigger =
      KeybindManager.matches(e, "global.startMenu.ctrl") ||
      KeybindManager.matches(e, "global.startMenu.tab") ||
      KeybindManager.matches(e, "global.startMenu.space");
    if (!isTrigger) return false;

    const otherMods = e.altKey || e.metaKey || e.shiftKey;
    if (otherMods) return false;

    if (e.key !== "Control" && e.ctrlKey) return false;

    const active = document.activeElement;
    if (active) {
      const tag = active.tagName;
      const isEditable = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || active.isContentEditable === true;
      if (isEditable) return false;
      if (tag === "IFRAME") return false;
      if (active.closest?.(".window")) return false;
      if (active.closest?.("#start-menu")) return false;
    }

    if (this.manager.lastFocusZone !== "desktop") return false;

    const anyWindowActive = Array.from(this.manager.openWindows.values()).some((v) =>
      v.taskbarItem?.classList?.contains("active")
    );
    if (anyWindowActive) return false;

    return true;
  }

  initWindowSwitcher() {
    document.addEventListener("keydown", (e) => {
      const isForward = KeybindManager.matches(e, "global.windowSwitcher");
      const isReverse = KeybindManager.matches(e, "global.windowSwitcherReverse");
      if (isForward || isReverse) {
        e.preventDefault();
        if (!this.windowSwitcherActive) {
          this.startWindowSwitcher();
        } else {
          this.cycleWindowSwitcher(isReverse);
        }
      }
    });

    document.addEventListener("keyup", (e) => {
      if (this.windowSwitcherActive && e.key === "Alt") {
        this.endWindowSwitcher();
      }
    });
  }

  getSwitcherSettings() {
    return {
      mode: os.storage.get(StorageKeys.windowSwitcherMode) || "mru",
      ui: os.storage.get(StorageKeys.windowSwitcherUI) || "overlay",
      includeMinimized: os.storage.get(StorageKeys.windowSwitcherIncludeMinimized) !== "false"
    };
  }

  getWindowsForSwitcher() {
    const settings = this.getSwitcherSettings();
    const allWindows = Array.from(this.manager.openWindows.keys())
      .map((id) => document.getElementById(id))
      .filter(Boolean);

    let windows = allWindows;
    if (!settings.includeMinimized) {
      windows = allWindows.filter((w) => w.style.display !== "none");
    }

    if (windows.length === 0) return [];

    if (settings.mode === "mru") {
      windows.sort((a, b) => parseInt(b.style.zIndex) - parseInt(a.style.zIndex));
    } else {
      windows.sort((a, b) => parseInt(a.style.zIndex) - parseInt(b.style.zIndex));
    }

    return windows;
  }

  startWindowSwitcher() {
    const settings = this.getSwitcherSettings();
    this.windowSwitcherWindows = this.getWindowsForSwitcher();

    if (this.windowSwitcherWindows.length === 0) return;

    this.windowSwitcherActive = true;
    this.windowSwitcherIndex = this.windowSwitcherWindows.length > 1 ? 1 : 0;

    if (settings.ui === "overlay") {
      this.showSwitcherOverlay();
    } else if (settings.ui === "taskbar") {
      this.highlightTaskbarItem(this.windowSwitcherIndex);
    }

    this.bringToFront(this.windowSwitcherWindows[this.windowSwitcherIndex]);
  }

  cycleWindowSwitcher(reverse = false) {
    const settings = this.getSwitcherSettings();
    const len = this.windowSwitcherWindows.length;
    this.windowSwitcherIndex = reverse
      ? (this.windowSwitcherIndex - 1 + len) % len
      : (this.windowSwitcherIndex + 1) % len;
    const nextWindow = this.windowSwitcherWindows[this.windowSwitcherIndex];

    if (settings.ui === "overlay") {
      this.updateSwitcherOverlay();
    } else if (settings.ui === "taskbar") {
      this.highlightTaskbarItem(this.windowSwitcherIndex);
    }

    this.bringToFront(nextWindow);
  }

  endWindowSwitcher() {
    const settings = this.getSwitcherSettings();
    const selectedWindow = this.windowSwitcherWindows[this.windowSwitcherIndex];

    if (settings.ui === "overlay") {
      this.hideSwitcherOverlay();
    } else if (settings.ui === "taskbar") {
      this.clearTaskbarHighlights();
    }

    if (selectedWindow) {
      if (selectedWindow.style.display === "none") {
        selectedWindow.style.display = "";
        const taskbarItem = document.getElementById(`taskbar-${selectedWindow.id}`);
        if (taskbarItem) taskbarItem.classList.remove("minimized");
      }
      this.bringToFront(selectedWindow);
    }

    this.windowSwitcherActive = false;
    this.windowSwitcherWindows = [];
    this.windowSwitcherIndex = 0;
  }

  bringToFront(win) {
    this.manager.bringToFront(win);
  }
  showSwitcherOverlay() {
    if (this.windowSwitcherOverlay) return;

    const overlay = document.createElement("div");
    overlay.id = "window-switcher-overlay";
    overlay.className = "ws-overlay";

    const content = document.createElement("div");
    content.id = "window-switcher-content";
    content.className = "ws-content";

    overlay.appendChild(content);
    document.body.appendChild(overlay);
    this.windowSwitcherOverlay = overlay;

    this.updateSwitcherOverlay();
  }

  updateSwitcherOverlay() {
    const content = this.windowSwitcherOverlay?.querySelector("#window-switcher-content");
    if (!content) return;

    content.innerHTML = "";

    this.windowSwitcherWindows.forEach((win, index) => {
      const isActive = index === this.windowSwitcherIndex;
      const entry = this.manager.openWindows.get(win.id);

      const title = entry?.title || win.id;
      const iconValue = entry?.iconValue || "";
      const color = entry?.color || null;

      const item = document.createElement("div");
      item.className = `ws-item ${isActive ? "active" : ""}`;

      const previewContainer = document.createElement("div");
      previewContainer.className = "ws-preview";

      const icon = this.buildSwitcherIcon(iconValue, title, color, isActive);
      previewContainer.appendChild(icon);

      const titleSpan = document.createElement("span");
      titleSpan.textContent = title;
      titleSpan.className = `ws-title ${isActive ? "active" : ""}`;

      item.appendChild(previewContainer);
      item.appendChild(titleSpan);
      content.appendChild(item);
    });
  }

  buildSwitcherIcon(iconValue, title, color, isActive) {
    iconValue = resolveIconUrl(iconValue);

    const isImage =
      iconValue &&
      (iconValue.startsWith("http") ||
        iconValue.startsWith("data:image") ||
        iconValue.match(/\.(png|jpg|jpeg|webp|gif|svg)$/i));

    const isDataUrl = iconValue && iconValue.startsWith("data:image");

    if (isImage || isDataUrl) {
      const icon = document.createElement("img");
      icon.src = iconValue;
      icon.className = `ws-icon-image ${isActive ? "active" : ""}`;

      icon.onerror = () => {
        const fallback = document.createElement("i");
        fallback.className = "fas fa-window-maximize ws-icon-fallback";
        icon.replaceWith(fallback);
      };

      return icon;
    }

    const icon = document.createElement("i");

    if (typeof iconValue === "string" && iconValue.length > 0) {
      icon.className = `${iconValue.startsWith("fa") ? iconValue : `fa ${iconValue}`} ws-icon ${isActive ? "active" : ""}`;
    } else {
      icon.className = "fas fa-window-maximize ws-icon fallback";
    }

    return icon;
  }
  hideSwitcherOverlay() {
    if (this.windowSwitcherOverlay) {
      this.windowSwitcherOverlay.remove();
      this.windowSwitcherOverlay = null;
    }
  }

  highlightTaskbarItem(index) {
    this.clearTaskbarHighlights();
    const win = this.windowSwitcherWindows[index];
    if (win) {
      const taskbarItem = document.getElementById(`taskbar-${win.id}`);
      if (taskbarItem) {
        taskbarItem.style.boxShadow = "0 0 0 2px var(--brand, #0078d7)";
        taskbarItem.style.transition = "box-shadow 0.15s ease";
      }
    }
  }

  clearTaskbarHighlights() {
    this.windowSwitcherWindows.forEach((win) => {
      const taskbarItem = document.getElementById(`taskbar-${win.id}`);
      if (taskbarItem) {
        taskbarItem.style.boxShadow = "";
      }
    });
  }
}
