import { showDynamicContextMenu } from "../shared/contextMenu.js";

import { StorageKeys, os } from "../framework.js";
class TrayManager {
  constructor() {
    this._items = new Map();
    this._el = null;
    this._popupEl = null;
    this._popupVisible = false;
    this._wm = null;
    this.MAX_VISIBLE = 7;
  }

  init(wm) {
    this._wm = wm;
    const sysTray = document.getElementById("system-tray");
    if (!sysTray) return;
    this._el = document.createElement("div");
    this._el.id = "app-tray";
    sysTray.insertBefore(this._el, sysTray.firstChild);

    document.addEventListener("click", (e) => {
      if (!e.target.closest("#app-tray") && !e.target.closest("#tray-overflow-popup")) {
        this._hidePopup();
      }
    });

    os.events.on("window:closed", ({ winId }) => {
      const item = this._items.get(winId);
      if (item && !item.resident) {
        this._items.delete(winId);
        this._render();
      }
    });
  }

  register(winId, icon, label, options = {}) {
    const inTray = options.resident || options.showInTray || false;
    this._items.set(winId, {
      icon,
      label,
      inTray,
      resident: options.resident || false,
      showInTray: options.showInTray || false,
      onClick: options.onClick || null,
      onWheel: options.onWheel || null,
      onQuit: options.onQuit || null,
      contextMenuItems: options.contextMenuItems || null,
      priority: options.priority || 0
    });
    this._render();
  }

  updateIcon(winId, newIcon) {
    const item = this._items.get(winId);
    if (item) {
      item.icon = newIcon;
      this._render();
    }
  }

  updateLabel(winId, newLabel) {
    const item = this._items.get(winId);
    if (item) {
      item.label = newLabel;
      this._render();
    }
  }

  updateContextMenuItems(winId, newContextMenuItems) {
    const item = this._items.get(winId);
    if (item) {
      item.contextMenuItems = newContextMenuItems;
    }
  }

  unregister(winId) {
    if (!this._items.has(winId)) return;
    this._items.delete(winId);
    this._render();
  }

  sendToTray(winId) {
    const item = this._items.get(winId);
    if (!item) return false;
    const win = document.getElementById(winId);
    const taskbarItem = document.getElementById(`taskbar-${winId}`);
    if (win) win.style.display = "none";
    if (taskbarItem) taskbarItem.style.display = "none";
    item.inTray = true;
    this._render();
    return true;
  }

  restoreFromTray(winId) {
    const item = this._items.get(winId);
    if (!item || !item.inTray) return false;
    if (item.resident) {
      if (item.onClick) item.onClick();
      return true;
    }
    const win = document.getElementById(winId);
    const taskbarItem = document.getElementById(`taskbar-${winId}`);
    if (win) {
      win.style.display = "flex";
      os.window.bringToFront(win);
      if (this._wm) {
        const entry = this._wm.openWindows.get(winId);
        if (entry?.record?.snapZone) {
          this._wm._applySnap(win, entry.record.snapZone);
        }
      }
    }
    if (taskbarItem) {
      taskbarItem.style.display = "";
      taskbarItem.classList.remove("minimized");
    }
    if (!item.showInTray) {
      item.inTray = false;
    }
    this._render();
    return true;
  }

  isRegistered(winId) {
    return this._items.has(winId);
  }

  isInTray(winId) {
    return this._items.get(winId)?.inTray === true;
  }

  getTrayItems() {
    return Array.from(this._items.entries())
      .filter(([, item]) => item.inTray)
      .map(([winId, item]) => ({ winId, ...item }));
  }

  _buildIcon(winId, icon, label) {
    const btn = document.createElement("button");
    btn.className = "tray-icon-btn";
    btn.title = label;
    btn.dataset.winId = winId;
    const isUrl =
      typeof icon === "string" &&
      (icon.startsWith("http") ||
        icon.startsWith("data:") ||
        icon.startsWith("/") ||
        /\.(webp|png|jpg|jpeg|gif|svg)/.test(icon));
    const isFontAwesome =
      typeof icon === "string" &&
      (icon.startsWith("fa-") ||
        icon.startsWith("fas") ||
        icon.startsWith("fab") ||
        icon.startsWith("far") ||
        icon.startsWith("fa "));
    if (isUrl) {
      btn.innerHTML = `<img src="${icon}" alt="${label}" />`;
    } else if (isFontAwesome) {
      btn.innerHTML = `<i class="${icon}"></i>`;
    } else {
      btn.innerHTML = `<span>${icon}</span>`;
      btn.style.width = "auto";
      btn.style.padding = "0 6px";
      btn.style.fontSize = "12px";
      btn.style.whiteSpace = "nowrap";
    }
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const item = this._items.get(winId);
      if (item && item.onClick) {
        item.onClick();
      } else {
        this.restoreFromTray(winId);
      }
    });
    btn.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._showContextMenu(e, winId, label);
    });
    btn.addEventListener("wheel", (e) => {
      const item = this._items.get(winId);
      if (item && item.onWheel) {
        e.preventDefault();
        e.stopPropagation();
        item.onWheel(e);
      }
    });
    return btn;
  }

  _render() {
    if (!this._el) return;
    this._el.innerHTML = "";

    const trayEnabled = os.storage.get(StorageKeys.trayEnabled) !== "false";
    if (!trayEnabled) {
      this._el.style.display = "none";
      this._hidePopup();
      return;
    }

    const trayAppVisibility = (() => {
      try {
        return os.storage.get(StorageKeys.trayAppVisibility) || {};
      } catch {
        return {};
      }
    })();

    const trayItems = this.getTrayItems().filter((item) => trayAppVisibility[item.winId] !== false);

    if (trayItems.length === 0) {
      this._el.style.display = "none";
      this._hidePopup();
      return;
    }
    this._el.style.display = "flex";
    const sortedItems = [...trayItems].sort((a, b) => (b.priority || 0) - (a.priority || 0));
    const visible = sortedItems.slice(0, this.MAX_VISIBLE);
    const overflow = sortedItems.slice(this.MAX_VISIBLE);
    visible.forEach(({ winId, icon, label }) => {
      this._el.appendChild(this._buildIcon(winId, icon, label));
    });
    if (overflow.length > 0) {
      const btn = document.createElement("button");
      btn.className = "tray-overflow-btn";
      btn.title = `${overflow.length} more`;
      btn.innerHTML = `<i class="fas fa-chevron-up"></i><span class="tray-overflow-count">${overflow.length}</span>`;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (this._popupVisible) {
          this._hidePopup();
        } else {
          this._showPopup(overflow);
        }
      });
      this._el.appendChild(btn);

      if (this._popupVisible && this._popupEl) {
        this._updatePopupContent(overflow);
      }
    } else {
      this._hidePopup();
    }
  }

  _updatePopupContent(items) {
    if (!this._popupEl) return;
    this._popupEl.innerHTML = "";
    items.forEach(({ winId, icon, label }) => {
      const row = document.createElement("div");
      row.className = "tray-popup-item";
      row.title = label;
      const isUrl =
        typeof icon === "string" &&
        (icon.startsWith("http") ||
          icon.startsWith("data:") ||
          icon.startsWith("/") ||
          /\.(webp|png|jpg|jpeg|gif|svg)/.test(icon));
      const isFontAwesome =
        typeof icon === "string" &&
        (icon.startsWith("fa-") ||
          icon.startsWith("fas") ||
          icon.startsWith("fab") ||
          icon.startsWith("far") ||
          icon.startsWith("fa "));
      if (isUrl) {
        row.innerHTML = `<img src="${icon}" alt="${label}" />`;
      } else if (isFontAwesome) {
        row.innerHTML = `<i class="${icon}"></i>`;
      } else {
        row.innerHTML = `<span style="font-size:12px;">${icon}</span>`;
      }
      row.addEventListener("click", (e) => {
        e.stopPropagation();
        this.restoreFromTray(winId);
        this._hidePopup();
      });
      row.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._showContextMenu(e, winId, label);
      });
      this._popupEl.appendChild(row);
    });
  }

  _showPopup(items) {
    if (!this._popupEl) {
      this._popupEl = document.createElement("div");
      this._popupEl.id = "tray-overflow-popup";
      document.body.appendChild(this._popupEl);
    }
    this._updatePopupContent(items);
    const trayRect = this._el.getBoundingClientRect();
    this._popupEl.style.bottom = `${window.innerHeight - trayRect.top + 6}px`;
    this._popupEl.style.right = `${window.innerWidth - trayRect.right}px`;
    this._popupEl.style.display = "flex";
    this._popupEl.style.flexWrap = "wrap";
    this._popupEl.style.gap = "2px";
    this._popupVisible = true;
  }

  quitApp(winId) {
    const item = this._items.get(winId);
    if (item && item.onQuit) {
      item.onQuit();
    }
    this.unregister(winId);
    const win = document.getElementById(winId);
    if (!win) return;
    os.window.removeFromTaskbar(winId);
    if (this._wm) {
      this._wm._silenceWindow(win);
      if (win.dataset.isGame === "true") {
        this._wm.gameWindowCount = Math.max(0, this._wm.gameWindowCount - 1);
      }
      this._wm.updateTransparency();
      this._wm._animateAndRemove(win);
    }
  }

  _showContextMenu(e, winId, label) {
    const trayItem = this._items.get(winId);
    showDynamicContextMenu(e, (menu, item, hr) => {
      const header = document.createElement("div");
      header.style.padding = "6px 12px";
      header.style.fontSize = "11px";
      header.style.fontWeight = "bold";
      header.style.color = "rgba(255, 255, 255, 0.4)";
      header.style.textTransform = "uppercase";
      header.style.letterSpacing = "0.5px";
      header.style.borderBottom = "1px solid rgba(255, 255, 255, 0.08)";
      header.style.marginBottom = "4px";
      header.style.cursor = "default";
      header.style.userSelect = "none";
      header.textContent = label;
      menu.appendChild(header);

      if (trayItem && trayItem.contextMenuItems) {
        trayItem.contextMenuItems.forEach((menuItem) => {
          if (menuItem.type === "divider") {
            menu.appendChild(hr());
          } else {
            menu.appendChild(item(menuItem.label, menuItem.action, menuItem.icon));
          }
        });
        menu.appendChild(hr());
      }

      menu.appendChild(
        item(
          "Open",
          () => {
            this.restoreFromTray(winId);
            this._hidePopup();
          },
          "fa-window-maximize"
        )
      );
      menu.appendChild(hr());
      menu.appendChild(
        item(
          "Quit",
          () => {
            this.quitApp(winId);
            this._hidePopup();
          },
          "fa-times"
        )
      );
    });
  }

  _hidePopup() {
    if (this._popupEl) this._popupEl.style.display = "none";
    this._popupVisible = false;
  }
}

export const trayManager = new TrayManager();
