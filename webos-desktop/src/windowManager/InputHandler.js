import { toggleStartMenu } from "../desktopui/startMenu.js";
import { StorageKeys } from "../settings/settings.js";
import { os } from "../os/index.js";
import { resolveIconUrl } from "../shared/assetResolver.js";

export class InputHandler {
  constructor(manager) {
    this.manager = manager;
    this.windowSwitcherActive = false;
    this.windowSwitcherIndex = 0;
    this.windowSwitcherWindows = [];
    this.windowSwitcherOverlay = null;
  }

  init() {
    this._initStartMenuKeybinds();
    this._initWindowSwitcher();

    document.addEventListener("keydown", (e) => {
      if (
        e.key.toLowerCase() === "d" &&
        e.metaKey === false &&
        e.ctrlKey === false &&
        e.altKey === false &&
        e.shiftKey === false &&
        e.getModifierState("Meta") === false &&
        e.getModifierState("Control") === false &&
        e.getModifierState("Alt") === false &&
        e.getModifierState("Shift") === false &&
        e.getModifierState("OS")
      ) {
        return;
      }
      if (e.key.toLowerCase() === "d" && (e.metaKey || e.ctrlKey)) {
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
      if (!e.metaKey && !e.ctrlKey) return;
      const focused = Array.from(this.manager.openWindows.keys())
        .map((id) => document.getElementById(id))
        .filter(Boolean)
        .sort((a, b) => parseInt(b.style.zIndex) - parseInt(a.style.zIndex))[0];
      if (!focused) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        this.manager._applySnap(focused, "left");
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        this.manager._applySnap(focused, "right");
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        this.manager._applySnap(focused, "maximize");
      }
    });
  }

  _initStartMenuKeybinds() {
    document.addEventListener(
      "pointerdown",
      (e) => {
        const target = e.target;
        if (target?.closest?.(".window")) this.manager._lastFocusZone = "window";
        else if (target?.closest?.("#start-menu")) this.manager._lastFocusZone = "start-menu";
        else this.manager._lastFocusZone = "desktop";

        if (this.manager._lastFocusZone === "desktop") {
          this.manager.openWindows.forEach(({ taskbarItem }) => taskbarItem?.classList?.remove("active"));
        }
      },
      { capture: true }
    );

    document.addEventListener("keydown", (e) => {
      if (!this._shouldOpenStartMenuFromKeyEvent(e)) return;
      e.preventDefault();
      toggleStartMenu({ focusSearch: true, openDefaultPage: true });
    });
  }

  _shouldOpenStartMenuFromKeyEvent(e) {
    const key = e.key;
    const isTrigger = key === "Control" || key === "Tab" || key === " " || key === "Spacebar";
    if (!isTrigger) return false;

    const otherMods = e.altKey || e.metaKey || e.shiftKey;
    if (otherMods) return false;

    if (key !== "Control" && e.ctrlKey) return false;

    const active = document.activeElement;
    if (active) {
      const tag = active.tagName;
      const isEditable = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || active.isContentEditable === true;
      if (isEditable) return false;
      if (tag === "IFRAME") return false;
      if (active.closest?.(".window")) return false;
      if (active.closest?.("#start-menu")) return false;
    }

    if (this.manager._lastFocusZone !== "desktop") return false;

    const anyWindowActive = Array.from(this.manager.openWindows.values()).some((v) =>
      v.taskbarItem?.classList?.contains("active")
    );
    if (anyWindowActive) return false;

    return true;
  }

  _initWindowSwitcher() {
    document.addEventListener("keydown", (e) => {
      if (e.altKey && e.key.toLowerCase() === "q") {
        e.preventDefault();
        if (!this.windowSwitcherActive) {
          this._startWindowSwitcher();
        } else {
          this._cycleWindowSwitcher();
        }
      }
    });

    document.addEventListener("keyup", (e) => {
      if (this.windowSwitcherActive && e.key === "Alt") {
        this._endWindowSwitcher();
      }
    });
  }

  _getSwitcherSettings() {
    return {
      mode: os.storage.get(StorageKeys.windowSwitcherMode) || "mru",
      ui: os.storage.get(StorageKeys.windowSwitcherUI) || "overlay",
      includeMinimized: os.storage.get(StorageKeys.windowSwitcherIncludeMinimized) !== "false"
    };
  }

  _getWindowsForSwitcher() {
    const settings = this._getSwitcherSettings();
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

  _startWindowSwitcher() {
    const settings = this._getSwitcherSettings();
    this.windowSwitcherWindows = this._getWindowsForSwitcher();

    if (this.windowSwitcherWindows.length === 0) return;

    this.windowSwitcherActive = true;
    this.windowSwitcherIndex = 0;

    if (settings.ui === "overlay") {
      this._showSwitcherOverlay();
    } else if (settings.ui === "taskbar") {
      this._highlightTaskbarItem(0);
    }

    this._bringToFront(this.windowSwitcherWindows[0]);
  }

  _cycleWindowSwitcher() {
    const settings = this._getSwitcherSettings();
    this.windowSwitcherIndex = (this.windowSwitcherIndex + 1) % this.windowSwitcherWindows.length;
    const nextWindow = this.windowSwitcherWindows[this.windowSwitcherIndex];

    if (settings.ui === "overlay") {
      this._updateSwitcherOverlay();
    } else if (settings.ui === "taskbar") {
      this._highlightTaskbarItem(this.windowSwitcherIndex);
    }

    this._bringToFront(nextWindow);
  }

  _endWindowSwitcher() {
    const settings = this._getSwitcherSettings();
    const selectedWindow = this.windowSwitcherWindows[this.windowSwitcherIndex];

    if (settings.ui === "overlay") {
      this._hideSwitcherOverlay();
    } else if (settings.ui === "taskbar") {
      this._clearTaskbarHighlights();
    }

    if (selectedWindow) {
      if (selectedWindow.style.display === "none") {
        selectedWindow.style.display = "";
        const taskbarItem = document.getElementById(`taskbar-${selectedWindow.id}`);
        if (taskbarItem) taskbarItem.classList.remove("minimized");
      }
      this._bringToFront(selectedWindow);
    }

    this.windowSwitcherActive = false;
    this.windowSwitcherWindows = [];
    this.windowSwitcherIndex = 0;
  }

  _bringToFront(win) {
    this.manager.bringToFront(win);
  }
  _showSwitcherOverlay() {
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

    this._updateSwitcherOverlay();
  }

  _updateSwitcherOverlay() {
    const content = this.windowSwitcherOverlay?.querySelector("#window-switcher-content");
    if (!content) return;

    content.innerHTML = "";

    this.windowSwitcherWindows.forEach((win, index) => {
      const isActive = index === this.windowSwitcherIndex;
      const entry = this.manager.openWindows.get(win.id);

      const titleEl = win.querySelector(".window-header span");
      const title = titleEl ? titleEl.textContent : entry?.title || win.id;
      const iconValue = entry?.iconValue || "";
      const color = entry?.color || null;

      const item = document.createElement("div");
      item.className = `ws-item ${isActive ? "active" : ""}`;

      const previewContainer = document.createElement("div");
      previewContainer.className = "ws-preview";

      const icon = this._buildSwitcherIcon(iconValue, title, color, isActive);
      previewContainer.appendChild(icon);

      const titleSpan = document.createElement("span");
      titleSpan.textContent = title;
      titleSpan.className = `ws-title ${isActive ? "active" : ""}`;

      item.appendChild(previewContainer);
      item.appendChild(titleSpan);
      content.appendChild(item);
    });
  }

  _buildSwitcherIcon(iconValue, title, color, isActive) {
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
  _hideSwitcherOverlay() {
    if (this.windowSwitcherOverlay) {
      this.windowSwitcherOverlay.remove();
      this.windowSwitcherOverlay = null;
    }
  }

  _highlightTaskbarItem(index) {
    this._clearTaskbarHighlights();
    const win = this.windowSwitcherWindows[index];
    if (win) {
      const taskbarItem = document.getElementById(`taskbar-${win.id}`);
      if (taskbarItem) {
        taskbarItem.style.boxShadow = "0 0 0 2px var(--brand, #0078d7)";
        taskbarItem.style.transition = "box-shadow 0.15s ease";
      }
    }
  }

  _clearTaskbarHighlights() {
    this.windowSwitcherWindows.forEach((win) => {
      const taskbarItem = document.getElementById(`taskbar-${win.id}`);
      if (taskbarItem) {
        taskbarItem.style.boxShadow = "";
      }
    });
  }
}
