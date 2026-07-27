import { resolveIconUrl } from "../shared/assetResolver.js";
import { BusEvents } from "../core/EventBus.js";
import { WindowRecord } from "../core/WindowRecord.js";
import { audioMixer } from "../audioMixer.js";
import { showStartStyleMenu } from "../shared/contextMenu.js";
import { animateWindowOpen } from "./AnimationSystem.js";

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
} from "../shared/domUtils.js";
import { StorageKeys, os } from "../framework.js";
export class TaskbarSystem {
  constructor(manager) {
    this.manager = manager;
    this.contextMenuOpen = false;
    setTimeout(() => this.initScrollHandling(), 0);
    this.onCloseBound = () => this.applyTaskbarLabels();
    os.events.on(BusEvents.WINDOW_CLOSED, this.onCloseBound);
  }

  initScrollHandling() {
    if (this.scrollInitDone) return;
    const taskbar = $("#taskbar");
    const taskbarWindows = $("#taskbar-windows");
    if (!taskbar || !taskbarWindows) return;
    this.scrollInitDone = true;

    const indicator = createElement("div", { className: "taskbar-scroll-indicator" });
    const thumb = createElement("div", { className: "taskbar-scroll-indicator-thumb" });
    indicator.appendChild(thumb);
    taskbar.appendChild(indicator);

    const reposition = () => {
      const tw = taskbarWindows.getBoundingClientRect();
      const tb = taskbar.getBoundingClientRect();
      indicator.style.left = `${tw.left - tb.left}px`;
      indicator.style.right = `${tb.right - tw.right}px`;
    };

    const update = () => {
      const horiz = !taskbar.classList.contains("position-left") && !taskbar.classList.contains("position-right");
      if (!horiz) {
        indicator.classList.remove("visible");
        return;
      }
      if (taskbarWindows.scrollWidth <= taskbarWindows.clientWidth) {
        indicator.classList.remove("visible");
        return;
      }
      indicator.classList.add("visible");
      const sl = taskbarWindows.scrollLeft;
      const maxSl = taskbarWindows.scrollWidth - taskbarWindows.clientWidth;
      const iw = indicator.clientWidth;
      const tw2 = Math.max(24, (taskbarWindows.clientWidth / taskbarWindows.scrollWidth) * iw);
      thumb.style.width = `${tw2}px`;
      thumb.style.transform = `translateX(${(sl / maxSl) * (iw - tw2)}px)`;
    };

    taskbarWindows.addEventListener(
      "wheel",
      (e) => {
        const horiz = !taskbar.classList.contains("position-left") && !taskbar.classList.contains("position-right");
        if (!horiz) return;
        if (taskbarWindows.scrollWidth <= taskbarWindows.clientWidth) return;
        e.preventDefault();
        taskbarWindows.scrollLeft += e.deltaY + e.deltaX;
      },
      { passive: false }
    );

    taskbarWindows.addEventListener("scroll", update);

    const ro = new ResizeObserver(() => {
      reposition();
      update();
    });
    ro.observe(taskbarWindows);
    ro.observe(taskbar);
    const mo = new MutationObserver(() => {
      reposition();
      update();
    });
    mo.observe(taskbarWindows, { childList: true, subtree: true, attributes: true });

    requestAnimationFrame(() => {
      reposition();
      update();
    });
  }

  updateTaskbarAlignment() {
    const taskbarWindows = $("#taskbar-windows");
    if (taskbarWindows) {
      const taskbarAlignment = os.storage.get(StorageKeys.taskbarAlignment) || "left";
      const taskbar = $("#taskbar");

      if (taskbar) {
        const isHorizontal =
          taskbar.classList.contains("position-bottom") || taskbar.classList.contains("position-top");

        if (isHorizontal) {
          const justifyMap = { left: "flex-start", center: "center", right: "flex-end" };
          taskbarWindows.style.justifyContent = justifyMap[taskbarAlignment] || "flex-start";
        } else {
          const alignMap = { left: "flex-start", center: "center", right: "flex-end" };
          taskbarWindows.style.alignItems = alignMap[taskbarAlignment] || "flex-start";
        }
      }
    }
  }

  buildTaskbarIcon(iconValue, title, color) {
    iconValue = resolveIconUrl(iconValue);
    const { isImage, isDataUrl } = this.manager.resolveIconType(iconValue);

    if (isImage || isDataUrl) {
      const icon = createElement("img", { attributes: { src: iconValue } });
      icon.onerror = () => {
        const fallback = createElement("i", { className: "fas fa-window-maximize" });
        fallback.style.color = color ?? "var(--brand)";
        icon.replaceWith(fallback);
      };
      return icon;
    }

    const icon = createElement("i", { attributes: { alt: title } });

    if (typeof iconValue === "string" && iconValue.length > 0) {
      icon.className = iconValue.startsWith("fa") ? iconValue : `fa ${iconValue}`;
      icon.style.color = color ?? "var(--text-primary)";
    } else {
      icon.className = "fas fa-window-maximize";
      icon.style.color = "var(--brand)";
    }

    return icon;
  }

  addToTaskbar(winId, title, iconValue, color = null) {
    this.manager.triggerSessionSave();
    if ($(`#taskbar-${winId}`)) return;
    if (iconValue === "fas fa-video") color = "var(--brand)";

    iconValue = resolveIconUrl(iconValue);

    const taskbarItem = createElement("div", {
      id: `taskbar-${winId}`,
      className: "taskbar-item"
    });
    taskbarItem.dataset.title = title;
    taskbarItem.appendChild(this.buildTaskbarIcon(iconValue, title, color));
    if (os.storage.get(StorageKeys.taskbarShowLabels) === "true") {
      const label = createElement("span", { className: "taskbar-item-label", text: title });
      taskbarItem.appendChild(label);
    }
    os.events.emit(BusEvents.WINDOW_CREATED, { winId });

    taskbarItem.onclick = () => {
      const winTask = $(`#${winId}`);
      if (!winTask) return;
      const entry = this.manager.openWindows.get(winId);

      if (winTask.style.display === "none") {
        winTask.style.display = "";
        taskbarItem.classList.remove("minimized");
        if (entry?.record) entry.record.minimized = false;
        if (!winTask.id || !winTask.id.startsWith("browser-app-")) {
          requestAnimationFrame(() => animateWindowOpen(winTask, true));
        }
        this.manager.bringToFront(winTask);
      } else {
        const isFocused = parseInt(winTask.style.zIndex) === this.manager.zIndexCounter - 1;
        if (isFocused) {
          this.manager.minimizeWindow(winTask);
        } else {
          this.manager.bringToFront(winTask);
        }
      }
    };

    taskbarItem.oncontextmenu = (e) => {
      e.preventDefault();
      this.hideTaskbarPreview();
      if (this.manager.taskbarPreviewShowTimer) clearTimeout(this.manager.taskbarPreviewShowTimer);
      if (this.manager.taskbarPreviewHideTimer) clearTimeout(this.manager.taskbarPreviewHideTimer);
      this.contextMenuOpen = true;
      const win = $(`#${winId}`);
      const menu = showStartStyleMenu(e, (addMenuItem, addSeparator) =>
        this.manager.buildContextMenuItems(addMenuItem, addSeparator, win)
      );
      const observer = new MutationObserver(() => {
        if (!document.body.contains(menu)) {
          this.contextMenuOpen = false;
          observer.disconnect();
        }
      });
      observer.observe(document.body, { childList: true });
    };

    taskbarItem.draggable = true;

    taskbarItem.addEventListener("dragstart", (e) => {
      taskbarItem.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", winId);
      this.hideTaskbarPreview();
      if (this.manager.taskbarPreviewShowTimer) clearTimeout(this.manager.taskbarPreviewShowTimer);
      if (this.manager.taskbarPreviewHideTimer) clearTimeout(this.manager.taskbarPreviewHideTimer);
    });

    taskbarItem.addEventListener("dragend", () => {
      taskbarItem.classList.remove("dragging");
      this.saveTaskbarOrder();
    });

    taskbarItem.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const draggingItem = $(".taskbar-item.dragging");
      if (draggingItem && draggingItem !== taskbarItem) {
        const taskbarWindows = $("#taskbar-windows");
        const items = $$(".taskbar-item:not(.dragging)", taskbarWindows);
        const nextItem = items.find((item) => {
          const rect = item.getBoundingClientRect();
          const midpoint = rect.left + rect.width / 2;
          return e.clientX < midpoint;
        });
        if (nextItem) {
          taskbarWindows.insertBefore(draggingItem, nextItem);
        } else {
          taskbarWindows.appendChild(draggingItem);
        }
      }
    });

    taskbarItem.addEventListener("drop", (e) => {
      e.preventDefault();
      const draggedWinId = e.dataTransfer.getData("text/plain");
      if (draggedWinId !== winId) {
        this.saveTaskbarOrder();
      }
    });

    const win = $(`#${winId}`);
    let geometry = {};
    if (win) {
      const geom = this.manager.getWindowNormalGeometry(win);
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
      const headerSpan = $(".window-header > span", win);
      if (headerSpan) {
        const iconHtml = this.manager.getWindowIconHtml(iconValue, color);
        if (iconHtml) {
          const temp = createElement("div");
          setHTML(temp, iconHtml);
          const iconEl = temp.firstElementChild;
          if (iconEl && !$("svg, i, img", headerSpan)) {
            headerSpan.insertBefore(iconEl, headerSpan.firstChild);
          }
        }
      }
    }

    taskbarItem.addEventListener("mouseenter", () => {
      if (this.contextMenuOpen) return;
      if (this.manager.taskbarPreviewShowTimer) clearTimeout(this.manager.taskbarPreviewShowTimer);
      this.manager.taskbarPreviewShowTimer = setTimeout(() => {
        if (!this.contextMenuOpen) {
          this.showTaskbarPreview(winId, taskbarItem);
        }
      }, 220);
    });

    taskbarItem.addEventListener("mouseleave", () => {
      if (this.manager.taskbarPreviewShowTimer) clearTimeout(this.manager.taskbarPreviewShowTimer);
      this.scheduleHideTaskbarPreview();
    });

    $("#taskbar-windows").appendChild(taskbarItem);

    const taskbarWindows = $("#taskbar-windows");
    if (taskbarWindows) {
      const taskbarAlignment = os.storage.get(StorageKeys.taskbarAlignment) || "left";
      const taskbar = $("#taskbar");

      if (taskbar) {
        const isHorizontal =
          taskbar.classList.contains("position-bottom") || taskbar.classList.contains("position-top");

        if (isHorizontal) {
          const justifyMap = { left: "flex-start", center: "center", right: "flex-end" };
          taskbarWindows.style.justifyContent = justifyMap[taskbarAlignment] || "flex-start";
        } else {
          const alignMap = { left: "flex-start", center: "center", right: "flex-end" };
          taskbarWindows.style.alignItems = alignMap[taskbarAlignment] || "flex-start";
        }
      }
    }
  }

  scheduleHideTaskbarPreview() {
    if (this.manager.taskbarPreviewHideTimer) clearTimeout(this.manager.taskbarPreviewHideTimer);
    this.manager.taskbarPreviewHideTimer = setTimeout(() => {
      if (!this.manager.taskbarPreviewHovering) this.hideTaskbarPreview();
    }, 160);
  }

  hideTaskbarPreview() {
    if (!this.manager.taskbarPreview) return;
    this.manager.taskbarPreview.remove();
    this.manager.taskbarPreview = null;
    this.manager.taskbarPreviewWinId = null;
    this.manager.taskbarPreviewHovering = false;
  }

  showTaskbarPreview(winId, anchorEl) {
    const win = $(`#${winId}`);
    if (!win || !anchorEl || anchorEl.classList.contains("minimized")) return;

    if (this.manager.taskbarPreviewWinId !== winId) this.hideTaskbarPreview();

    const meta = this.manager.openWindows.get(winId);
    const title = meta?.title || winId;

    const preview = createElement("div", { className: "taskbar-preview" });
    preview.dataset.winId = winId;
    setHTML(
      preview,
      `
      <div class="taskbar-preview__title">
        <span class="taskbar-preview__title-text"></span>
        <button class="taskbar-preview__close" title="Close">✕</button>
      </div>
      <div class="taskbar-preview__thumb"></div>
    `
    );
    setText($(".taskbar-preview__title-text", preview), title);

    const thumb = $(".taskbar-preview__thumb", preview);
    const clone = win.cloneNode(true);
    clone.removeAttribute("id");
    ["left", "top", "right", "bottom", "z-index", "position"].forEach((p) => clone.style.removeProperty(p));
    clone.classList.add("taskbar-preview__winclone");
    $$("[id]", clone).forEach((n) => n.removeAttribute("id"));
    $$(".window-controls", clone).forEach((n) => n.remove());
    $$("input,textarea,button,select", clone).forEach((n) => n.setAttribute("disabled", "disabled"));

    $$("iframe, video, audio, canvas", clone).forEach((n) => {
      const placeholder = createElement("div", {
        styles: {
          width: "100%",
          height: "100%",
          background: "var(--bg-secondary, rgba(0,0,0,0.5))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }
      });
      const tempDiv = createElement("div");
      setHTML(tempDiv, this.manager.getWindowIconHtml(meta?.iconValue, meta?.color || "var(--text-primary)"));
      const iconEl2 = tempDiv.firstElementChild;
      if (iconEl2) {
        setStyle(iconEl2, { fontSize: "48px", width: "48px", height: "48px", opacity: "0.7" });
        placeholder.appendChild(iconEl2);
      }
      n.replaceWith(placeholder);
    });

    thumb.appendChild(clone);

    document.body.appendChild(preview);
    this.manager.taskbarPreview = preview;
    this.manager.taskbarPreviewWinId = winId;

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
    const scale = Math.min(scaleX, scaleY) * 0.96;
    clone.style.transform = `translate(-50%, -50%) scale(${scale})`;

    preview.addEventListener("mouseenter", () => {
      this.manager.taskbarPreviewHovering = true;
      if (this.manager.taskbarPreviewHideTimer) clearTimeout(this.manager.taskbarPreviewHideTimer);
    });
    preview.addEventListener("mouseleave", () => {
      this.manager.taskbarPreviewHovering = false;
      this.scheduleHideTaskbarPreview();
    });

    preview.addEventListener("mousedown", (e) => e.preventDefault());
    preview.addEventListener("click", (e) => {
      if (e.target.closest(".taskbar-preview__close")) return;

      const w = $(`#${winId}`);
      if (!w) return;

      if (w.style.display === "none") {
        w.style.display = "block";
        const taskbarItem = $(`#taskbar-${winId}`);
        if (taskbarItem) taskbarItem.classList.remove("minimized");
      }

      this.manager.bringToFront(w);
      this.hideTaskbarPreview();
    });

    $(".taskbar-preview__close", preview).addEventListener("click", (e) => {
      e.stopPropagation();
      os.app.close(winId);
      this.hideTaskbarPreview();
    });
  }

  removeFromTaskbar(winId) {
    const taskbarItem = $(`#taskbar-${winId}`);
    if (taskbarItem) taskbarItem.remove();
    const entry = this.manager.openWindows.get(winId);
    if (entry && entry.record) {
      const win = $(`#${winId}`);
      const appId = (win && win.dataset.appId) || this.manager.guessAppIdFromWinId(winId);
      if (appId) {
        try {
          const geom = win ? this.manager.getWindowNormalGeometry(win) : entry.record;
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

    if (this.manager.openWindows.size === 0) {
      this.manager.resetToDefaultState();
    } else {
      const lastWin = Array.from(this.manager.openWindows.values()).pop();
      if (lastWin) this.manager.updatePageFavicon(lastWin.iconValue, lastWin.title);
    }
    this.manager.triggerSessionSave();
  }

  isWindowPinned(winId) {
    const pinnedItems = this.getPinnedItems();
    return pinnedItems.some((item) => item.winId === winId);
  }

  getPinnedItems() {
    try {
      const pinnedData = os.storage.get(StorageKeys.pinnedTaskbarItems) || [];
      const migrationKey = StorageKeys.defaultsCreatedPrefix + "pinnedTaskbarItems";

      if (!os.storage.get(migrationKey)) {
        const defaultApps = [
          {
            winId: "explorer-pinned",
            appId: "explorerApp",
            title: "Explorer",
            iconValue: resolveIconUrl("static/icons/file.webp"),
            color: null
          },
          {
            winId: "browser-pinned",
            appId: "browserApp",
            title: "Yuki Browser",
            iconValue: resolveIconUrl("static/icons/firefox.webp"),
            color: null
          },
          {
            winId: "discord-pinned",
            appId: "discordApp",
            title: "Discord",
            iconValue: "fab fa-discord",
            color: null
          }
        ];

        const existingAppIds = pinnedData.map((item) => item.appId);
        const missingDefaults = defaultApps.filter((app) => !existingAppIds.includes(app.appId));

        if (missingDefaults.length > 0) {
          const updatedPinnedItems = [...missingDefaults, ...pinnedData];
          os.storage.set(StorageKeys.pinnedTaskbarItems, updatedPinnedItems);
        }

        os.storage.set(migrationKey, "true");
        return os.storage.get(StorageKeys.pinnedTaskbarItems) || [];
      }

      return pinnedData;
    } catch {
      return [];
    }
  }

  savePinnedItems(pinnedItems) {
    try {
      os.storage.set(StorageKeys.pinnedTaskbarItems, pinnedItems);
    } catch {}
  }

  pinToTaskbar(winId) {
    const entry = this.manager.openWindows.get(winId);
    if (!entry) return;

    const win = $(`#${winId}`);
    const appId = win?.dataset?.appId || this.manager.guessAppIdFromWinId(winId);

    const pinnedItems = this.getPinnedItems();
    if (pinnedItems.some((item) => item.winId === winId)) return;

    pinnedItems.push({
      winId,
      appId,
      title: entry.title,
      iconValue: entry.iconValue,
      color: entry.color
    });

    this.savePinnedItems(pinnedItems);
    this.renderPinnedItems();
  }

  unpinFromTaskbar(winId) {
    const pinnedItems = this.getPinnedItems();
    const filtered = pinnedItems.filter((item) => item.winId !== winId);
    this.savePinnedItems(filtered);
    this.renderPinnedItems();
  }

  renderPinnedItems() {
    const taskbarWindows = $("#taskbar-windows");
    if (!taskbarWindows) return;

    const existingPinnedContainer = $("#taskbar-pinned-container");
    if (existingPinnedContainer) existingPinnedContainer.remove();

    const pinnedItems = this.getPinnedItems();
    if (pinnedItems.length === 0) return;

    const pinnedContainer = createElement("div", {
      id: "taskbar-pinned-container",
      className: "taskbar-pinned-container"
    });

    pinnedItems.forEach((item) => {
      const pinnedItem = createElement("div", { className: "taskbar-item pinned" });
      pinnedItem.dataset.title = item.title;
      pinnedItem.appendChild(this.buildTaskbarIcon(item.iconValue, item.title, item.color));

      pinnedItem.onclick = () => {
        if (item.appId) {
          os.app.launch(item.appId);
        }
      };

      pinnedItem.oncontextmenu = (e) => {
        e.preventDefault();
        this.hideTaskbarPreview();
        if (this.manager.taskbarPreviewShowTimer) clearTimeout(this.manager.taskbarPreviewShowTimer);
        if (this.manager.taskbarPreviewHideTimer) clearTimeout(this.manager.taskbarPreviewHideTimer);
        this.contextMenuOpen = true;
        const menu = showStartStyleMenu(e, (addMenuItem, addSeparator) => {
          const hasOpenWindow = this.manager.openWindows.has(item.winId);
          if (hasOpenWindow && item.appId) {
            addMenuItem("New Window", () => os.app.launch(item.appId), "fa-plus-square");
            addSeparator();
          }
          addMenuItem("Unpin from Taskbar", () => this.unpinFromTaskbar(item.winId), "fa-thumbtack");
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
        const observer = new MutationObserver(() => {
          if (!document.body.contains(menu)) {
            this.contextMenuOpen = false;
            observer.disconnect();
          }
        });
        observer.observe(document.body, { childList: true });
      };

      pinnedItem.draggable = true;

      pinnedItem.addEventListener("dragstart", (e) => {
        pinnedItem.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", `pinned-${item.winId}`);
        this.hideTaskbarPreview();
        if (this.manager.taskbarPreviewShowTimer) clearTimeout(this.manager.taskbarPreviewShowTimer);
        if (this.manager.taskbarPreviewHideTimer) clearTimeout(this.manager.taskbarPreviewHideTimer);
      });

      pinnedItem.addEventListener("dragend", () => {
        pinnedItem.classList.remove("dragging");
        this.savePinnedOrder();
      });

      pinnedItem.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        const draggingItem = $(".taskbar-item.dragging");
        if (draggingItem && draggingItem !== pinnedItem) {
          const items = $$(".taskbar-item:not(.dragging)", pinnedContainer);
          const nextItem = items.find((item) => {
            const rect = item.getBoundingClientRect();
            const midpoint = rect.left + rect.width / 2;
            return e.clientX < midpoint;
          });
          if (nextItem) {
            pinnedContainer.insertBefore(draggingItem, nextItem);
          } else {
            pinnedContainer.appendChild(draggingItem);
          }
        }
      });

      pinnedItem.addEventListener("drop", (e) => {
        e.preventDefault();
        this.savePinnedOrder();
      });

      pinnedContainer.appendChild(pinnedItem);
    });

    if (pinnedContainer.children.length > 0) {
      taskbarWindows.insertBefore(pinnedContainer, taskbarWindows.firstChild);
    }
  }

  saveTaskbarOrder() {
    const taskbarWindows = $("#taskbar-windows");
    if (!taskbarWindows) return;

    const items = $$(".taskbar-item:not(.pinned)", taskbarWindows);
    const order = items.map((item) => item.id.replace("taskbar-", ""));

    try {
      os.storage.set(StorageKeys.taskbarOrder, order);
    } catch {}
  }

  savePinnedOrder() {
    const pinnedContainer = $("#taskbar-pinned-container");
    if (!pinnedContainer) return;

    const items = $$(".taskbar-item.pinned", pinnedContainer);
    const pinnedItems = this.getPinnedItems();

    const newOrder = items.map((item) => {
      const icon = $("img, i", item);
      const iconSrc = icon?.src || icon?.className || "";
      return (
        pinnedItems.find((p) => {
          const pIcon = this.buildTaskbarIcon(p.iconValue, p.title, p.color);
          const pIconSrc = pIcon.src || pIcon.className || "";
          return pIconSrc === iconSrc;
        }) || pinnedItems[0]
      );
    });

    this.savePinnedItems(newOrder);
  }

  restorePinnedItems() {
    this.renderPinnedItems();
  }

  applyTaskbarLabels() {
    const show = os.storage.get(StorageKeys.taskbarShowLabels) === "true";
    const taskbarWindows = $("#taskbar-windows");
    if (!taskbarWindows) return;
    $$(".taskbar-item:not(.pinned)", taskbarWindows).forEach((item) => {
      let label = $(".taskbar-item-label", item);
      if (show) {
        if (!label) {
          label = createElement("span", {
            className: "taskbar-item-label",
            text: item.dataset.title || ""
          });
          item.appendChild(label);
        }
      } else {
        if (label) label.remove();
      }
    });
  }
}
