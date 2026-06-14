import { StorageKeys } from "../settings/settings.js";
import { resolveIconUrl } from "../shared/assetResolver.js";
import { BusEvents } from "../core/EventBus.js";
import { WindowRecord } from "../core/WindowRecord.js";
import { audioMixer } from "../audioMixer.js";
import { showStartStyleMenu } from "../shared/contextMenu.js";
import { animateWindowOpen } from "./AnimationSystem.js";
import { os } from "../os/index.js";

export class TaskbarSystem {
  constructor(manager) {
    this.manager = manager;
  }

  updateTaskbarAlignment() {
    const taskbarWindows = document.getElementById("taskbar-windows");
    if (taskbarWindows) {
      const taskbarAlignment = os.storage.get(StorageKeys.taskbarAlignment) || "center";
      const taskbar = document.getElementById("taskbar");

      if (taskbar) {
        const isHorizontal =
          taskbar.classList.contains("position-bottom") || taskbar.classList.contains("position-top");

        if (isHorizontal) {
          if (taskbarAlignment === "left") {
            taskbarWindows.style.justifyContent = "flex-start";
          } else if (taskbarAlignment === "center") {
            taskbarWindows.style.justifyContent = "center";
          } else if (taskbarAlignment === "right") {
            taskbarWindows.style.justifyContent = "flex-end";
          }
        } else {
          if (taskbarAlignment === "left") {
            taskbarWindows.style.alignItems = "flex-start";
          } else if (taskbarAlignment === "center") {
            taskbarWindows.style.alignItems = "center";
          } else if (taskbarAlignment === "right") {
            taskbarWindows.style.alignItems = "flex-end";
          }
        }
      }
    }
  }

  _buildTaskbarIcon(iconValue, title, color) {
    iconValue = resolveIconUrl(iconValue);
    const { isImage, isDataUrl } = this.manager._resolveIconType(iconValue);

    if (isImage || isDataUrl) {
      const icon = document.createElement("img");
      icon.src = iconValue;
      icon.onerror = () => {
        const fallback = document.createElement("i");
        fallback.className = "fas fa-window-maximize";
        fallback.style.color = color ?? "var(--brand)";
        icon.replaceWith(fallback);
      };
      return icon;
    }

    const icon = document.createElement("i");
    icon.alt = title;

    if (typeof iconValue === "string" && iconValue.length > 0) {
      icon.className = iconValue.startsWith("fa") ? iconValue : `fa ${iconValue}`;
      icon.style.color = color ?? "white";
    } else {
      icon.className = "fas fa-window-maximize";
      icon.style.color = "var(--brand)";
    }

    return icon;
  }

  addToTaskbar(winId, title, iconValue, color = null) {
    this.manager.triggerSessionSave();
    if (document.getElementById(`taskbar-${winId}`)) return;
    if (iconValue === "fas fa-video") color = "var(--brand)";

    iconValue = resolveIconUrl(iconValue);

    const taskbarItem = document.createElement("div");
    taskbarItem.id = `taskbar-${winId}`;
    taskbarItem.className = "taskbar-item";
    taskbarItem.appendChild(this._buildTaskbarIcon(iconValue, title, color));
    os.events.emit(BusEvents.WINDOW_CREATED, { winId });

    taskbarItem.onclick = () => {
      const winTask = document.getElementById(winId);
      if (!winTask) return;
      const entry = this.manager.openWindows.get(winId);
      if (winTask.style.display === "none") {
        winTask.style.display = "block";
        taskbarItem.classList.remove("minimized");
        if (entry?.record) entry.record.minimized = false;
        // Exclude browser app from animations
        if (!winTask.id || !winTask.id.startsWith("browser-app-")) {
          requestAnimationFrame(() => animateWindowOpen(winTask));
        }
      }
      this.manager.bringToFront(winTask);
    };

    taskbarItem.oncontextmenu = (e) => {
      e.preventDefault();
      this._hideTaskbarPreview();
      const win = document.getElementById(winId);
      showStartStyleMenu(e, (addMenuItem, addSeparator) =>
        this.manager._buildContextMenuItems(addMenuItem, addSeparator, win)
      );
    };

    const win = document.getElementById(winId);
    let geometry = {};
    if (win) {
      const geom = this.manager._getWindowNormalGeometry(win);
      geometry = {
        x: geom.x,
        y: geom.y,
        width: geom.width,
        height: geom.height,
        zIndex: parseInt(win.style.zIndex) || 1000
      };
    }

    const record = new WindowRecord(winId, title, { ...geometry, iconValue, color });
    this.manager.openWindows.set(winId, { taskbarItem, title, iconValue, color, record });
    this.manager.workspaceManager?.registerWindow(winId);

    audioMixer().registerWindow(winId, title, audioMixer().getIconHtmlForTaskbar(null, iconValue));

    if (win) {
      const headerSpan = win.querySelector(".window-header > span");
      if (headerSpan) {
        const iconHtml = this.manager.getWindowIconHtml(iconValue, color);
        if (iconHtml) {
          const temp = document.createElement("div");
          temp.innerHTML = iconHtml;
          const iconEl = temp.firstElementChild;
          if (iconEl && !headerSpan.querySelector("svg, i, img")) {
            headerSpan.insertBefore(iconEl, headerSpan.firstChild);
          }
        }
      }
    }

    taskbarItem.addEventListener("mouseenter", () => {
      if (this.manager._taskbarPreviewShowTimer) clearTimeout(this.manager._taskbarPreviewShowTimer);
      this.manager._taskbarPreviewShowTimer = setTimeout(() => {
        this._showTaskbarPreview(winId, taskbarItem);
      }, 220);
    });

    taskbarItem.addEventListener("mouseleave", () => {
      if (this.manager._taskbarPreviewShowTimer) clearTimeout(this.manager._taskbarPreviewShowTimer);
      this._scheduleHideTaskbarPreview();
    });

    document.getElementById("taskbar-windows").appendChild(taskbarItem);

    const taskbarWindows = document.getElementById("taskbar-windows");
    if (taskbarWindows) {
      const taskbarAlignment = os.storage.get(StorageKeys.taskbarAlignment) || "center";
      const taskbar = document.getElementById("taskbar");

      if (taskbar) {
        const isHorizontal =
          taskbar.classList.contains("position-bottom") || taskbar.classList.contains("position-top");

        if (isHorizontal) {
          if (taskbarAlignment === "left") {
            taskbarWindows.style.justifyContent = "flex-start";
          } else if (taskbarAlignment === "center") {
            taskbarWindows.style.justifyContent = "center";
          } else if (taskbarAlignment === "right") {
            taskbarWindows.style.justifyContent = "flex-end";
          }
        } else {
          if (taskbarAlignment === "left") {
            taskbarWindows.style.alignItems = "flex-start";
          } else if (taskbarAlignment === "center") {
            taskbarWindows.style.alignItems = "center";
          } else if (taskbarAlignment === "right") {
            taskbarWindows.style.alignItems = "flex-end";
          }
        }
      }
    }
  }

  _scheduleHideTaskbarPreview() {
    if (this.manager._taskbarPreviewHideTimer) clearTimeout(this.manager._taskbarPreviewHideTimer);
    this.manager._taskbarPreviewHideTimer = setTimeout(() => {
      if (!this.manager._taskbarPreviewHovering) this._hideTaskbarPreview();
    }, 160);
  }

  _hideTaskbarPreview() {
    if (!this.manager._taskbarPreview) return;
    this.manager._taskbarPreview.remove();
    this.manager._taskbarPreview = null;
    this.manager._taskbarPreviewWinId = null;
    this.manager._taskbarPreviewHovering = false;
  }

  _showTaskbarPreview(winId, anchorEl) {
    const win = document.getElementById(winId);
    if (!win || !anchorEl || anchorEl.classList.contains("minimized")) return;

    if (this.manager._taskbarPreviewWinId !== winId) this._hideTaskbarPreview();

    const meta = this.manager.openWindows.get(winId);
    const title = meta?.title || winId;

    const preview = document.createElement("div");
    preview.className = "taskbar-preview";
    preview.dataset.winId = winId;
    preview.innerHTML = `
      <div class="taskbar-preview__title"></div>
      <div class="taskbar-preview__thumb"></div>
    `;
    preview.querySelector(".taskbar-preview__title").textContent = title;

    const thumb = preview.querySelector(".taskbar-preview__thumb");
    const clone = win.cloneNode(true);
    clone.removeAttribute("id");
    clone.classList.add("taskbar-preview__winclone");
    clone.style.position = "absolute";
    clone.style.left = "50%";
    clone.style.top = "50%";
    clone.style.margin = "0";
    clone.style.maxWidth = "none";
    clone.style.maxHeight = "none";
    clone.style.transformOrigin = "center";
    clone.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
    clone.querySelectorAll(".window-controls").forEach((n) => n.remove());
    clone.querySelectorAll("input,textarea,button,select").forEach((n) => n.setAttribute("disabled", "disabled"));

    clone.querySelectorAll("iframe, video, audio, canvas").forEach((n) => {
      const placeholder = document.createElement("div");
      placeholder.style.width = "100%";
      placeholder.style.height = "100%";
      placeholder.style.background = "var(--bg-secondary, rgba(0,0,0,0.5))";
      placeholder.style.display = "flex";
      placeholder.style.alignItems = "center";
      placeholder.style.justifyContent = "center";

      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = this.manager.getWindowIconHtml(meta?.iconValue, meta?.color || "white");
      const iconEl = tempDiv.firstElementChild;
      if (iconEl) {
        iconEl.style.fontSize = "48px";
        iconEl.style.width = "48px";
        iconEl.style.height = "48px";
        iconEl.style.opacity = "0.7";
        placeholder.appendChild(iconEl);
      }
      n.replaceWith(placeholder);
    });

    thumb.appendChild(clone);

    document.body.appendChild(preview);
    this.manager._taskbarPreview = preview;
    this.manager._taskbarPreviewWinId = winId;

    const rect = anchorEl.getBoundingClientRect();
    const pRect = preview.getBoundingClientRect();

    const left = Math.max(
      8,
      Math.min(rect.left + rect.width / 2 - pRect.width / 2, window.innerWidth - pRect.width - 8)
    );
    const top = Math.max(8, rect.top - pRect.height - 10);

    preview.style.left = `${left}px`;
    preview.style.top = `${top}px`;

    const winRect = win.getBoundingClientRect();
    const innerW = 240;
    const innerH = 140;
    const scaleX = innerW / Math.max(1, winRect.width);
    const scaleY = innerH / Math.max(1, winRect.height);
    const scale = Math.min(scaleX, scaleY);
    clone.style.transform = `translate(-50%, -50%) scale(${scale})`;

    preview.addEventListener("mouseenter", () => {
      this.manager._taskbarPreviewHovering = true;
      if (this.manager._taskbarPreviewHideTimer) clearTimeout(this.manager._taskbarPreviewHideTimer);
    });
    preview.addEventListener("mouseleave", () => {
      this.manager._taskbarPreviewHovering = false;
      this._scheduleHideTaskbarPreview();
    });

    preview.addEventListener("mousedown", (e) => e.preventDefault());
    preview.addEventListener("click", () => {
      const w = document.getElementById(winId);
      if (!w) return;

      if (w.style.display === "none") {
        w.style.display = "block";
        const taskbarItem = document.getElementById(`taskbar-${winId}`);
        if (taskbarItem) taskbarItem.classList.remove("minimized");
      }

      this.manager.bringToFront(w);
      this._hideTaskbarPreview();
    });
  }

  removeFromTaskbar(winId) {
    const taskbarItem = document.getElementById(`taskbar-${winId}`);
    if (taskbarItem) taskbarItem.remove();
    const entry = this.manager.openWindows.get(winId);
    if (entry && entry.record) {
      const win = document.getElementById(winId);
      const appId = (win && win.dataset.appId) || this.manager._guessAppIdFromWinId(winId);
      if (appId) {
        try {
          const geom = win ? this.manager._getWindowNormalGeometry(win) : entry.record;
          os.storage.set(`${StorageKeys.geometryPrefix}${appId}`, {
            x: geom.x,
            y: geom.y,
            width: geom.width,
            height: geom.height
          });
        } catch (e) {}
      }
    }
    this.manager.openWindows.delete(winId);
    this.manager.workspaceManager?.unregisterWindow(winId);
    audioMixer().unregisterWindow(winId);
    os.events.emit(BusEvents.WINDOW_CLOSED, { winId });
    this._renderPinnedItems();

    if (this.manager.openWindows.size === 0) {
      this.manager.resetToDefaultState();
    } else {
      const lastWin = Array.from(this.manager.openWindows.values()).pop();
      if (lastWin) this.manager.updatePageFavicon(lastWin.iconValue, lastWin.title);
    }
    this.manager.triggerSessionSave();
  }

  _isWindowPinned(winId) {
    const pinnedItems = this._getPinnedItems();
    return pinnedItems.some((item) => item.winId === winId);
  }

  _getPinnedItems() {
    try {
      const pinnedData = os.storage.get(StorageKeys.pinnedTaskbarItems);
      return pinnedData || [];
    } catch {
      return [];
    }
  }

  _savePinnedItems(pinnedItems) {
    try {
      os.storage.set(StorageKeys.pinnedTaskbarItems, pinnedItems);
    } catch {}
  }

  _pinToTaskbar(winId) {
    const entry = this.manager.openWindows.get(winId);
    if (!entry) return;

    const win = document.getElementById(winId);
    const appId = win?.dataset?.appId || this.manager._guessAppIdFromWinId(winId);

    const pinnedItems = this._getPinnedItems();
    if (pinnedItems.some((item) => item.winId === winId)) return;

    pinnedItems.push({
      winId,
      appId,
      title: entry.title,
      iconValue: entry.iconValue,
      color: entry.color
    });

    this._savePinnedItems(pinnedItems);
    this._renderPinnedItems();
  }

  _unpinFromTaskbar(winId) {
    const pinnedItems = this._getPinnedItems();
    const filtered = pinnedItems.filter((item) => item.winId !== winId);
    this._savePinnedItems(filtered);
    this._renderPinnedItems();
  }

  _renderPinnedItems() {
    const taskbarWindows = document.getElementById("taskbar-windows");
    if (!taskbarWindows) return;

    const existingPinnedContainer = document.getElementById("taskbar-pinned-container");
    if (existingPinnedContainer) existingPinnedContainer.remove();

    const pinnedItems = this._getPinnedItems();
    if (pinnedItems.length === 0) return;

    const pinnedContainer = document.createElement("div");
    pinnedContainer.id = "taskbar-pinned-container";
    pinnedContainer.className = "taskbar-pinned-container";

    pinnedItems.forEach((item) => {
      const pinnedItem = document.createElement("div");
      pinnedItem.className = "taskbar-item pinned";
      pinnedItem.appendChild(this._buildTaskbarIcon(item.iconValue, item.title, item.color));

      pinnedItem.onclick = () => {
        if (item.appId) {
          os.app.launch(item.appId);
        }
      };

      pinnedItem.oncontextmenu = (e) => {
        e.preventDefault();
        showStartStyleMenu(e, (addMenuItem, addSeparator) => {
          addMenuItem("Unpin from Taskbar", () => this._unpinFromTaskbar(item.winId), "fa-thumbtack");
          addSeparator();
          addMenuItem(
            "Launch App",
            () => {
              if (item.appId) {
                os.app.launch(item.appId);
              }
            },
            "fa-play"
          );
        });
      };

      pinnedContainer.appendChild(pinnedItem);
    });

    if (pinnedContainer.children.length > 0) {
      taskbarWindows.insertBefore(pinnedContainer, taskbarWindows.firstChild);
    }
  }

  restorePinnedItems() {
    this._renderPinnedItems();
  }
}
