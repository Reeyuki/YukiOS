import { resolveIconUrl } from "../shared/assetResolver.js";
import { BusEvents } from "../core/EventBus.js";
import { WindowRecord } from "../core/WindowRecord.js";
import { audioMixer } from "../audioMixer.js";
import { showStartStyleMenu } from "../shared/contextMenu.js";
import { restoreWindowAnimated } from "./AnimationSystem.js";
import { enableTaskbarReorder } from "./taskbarReorder.js";
import { parseBool } from "../utils/utils.js";

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
import { Achievements } from "../achievements.js";
export class TaskbarSystem {
  constructor(manager) {
    this.manager = manager;
    this.contextMenuOpen = false;
    this.taskbarDragging = false;
    setTimeout(() => this.initScrollHandling(), 0);
    this.onCloseBound = () => this.applyTaskbarLabels();
    os.events.on(BusEvents.WINDOW_CLOSED, this.onCloseBound);
    this.syncPinnedBound = () => this.syncPinnedStates();
    os.events.on(BusEvents.WINDOW_FOCUSED, this.syncPinnedBound);
    os.events.on(BusEvents.WINDOW_CREATED, this.syncPinnedBound);
    os.events.on(BusEvents.WINDOW_MINIMIZED, this.syncPinnedBound);
    os.events.on(BusEvents.WINDOW_CLOSED, () => {
      this.renderPinnedItems();
      this.syncPinnedStates();
    });
    this.audioIndicatorTimer = setInterval(() => this.updateAudioIndicators(), 600);
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
    const pinWinEl = $(`#${winId}`);
    const pinAppId = pinWinEl?.dataset?.appId || this.manager.guessAppIdFromWinId(winId);
    taskbarItem.dataset.appId = pinAppId;
    taskbarItem.dataset.winId = winId;
    taskbarItem.classList.add("running");
    if (this.getPinnedItemByAppId(pinAppId)) {
      taskbarItem.classList.add("pinned");
      const stalePin = this.findPinnedElementByAppId(pinAppId);
      if (stalePin) stalePin.remove();
      $$(".taskbar-item.pinned", $("#taskbar-windows")).forEach((el) => {
        if (el !== taskbarItem && el.dataset.appId === pinAppId) el.remove();
      });
    }
    taskbarItem.appendChild(this.buildTaskbarIcon(iconValue, title, color));
    if (parseBool(os.storage.get(StorageKeys.taskbarShowLabels))) {
      const label = createElement("span", { className: "taskbar-item-label", text: title });
      taskbarItem.appendChild(label);
    }
    const speakerIndicator = createElement("span", { className: "taskbar-speaker-indicator" });
    speakerIndicator.innerHTML = '<i class="fas fa-volume-up"></i>';
    speakerIndicator.addEventListener("click", (e) => {
      e.stopPropagation();
      audioMixer().toggleChannelMute(winId);
    });
    taskbarItem.appendChild(speakerIndicator);
    os.events.emit(BusEvents.WINDOW_CREATED, { winId });

    taskbarItem.onclick = () => this.handleRunningItemClick(winId);

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

    enableTaskbarReorder(taskbarItem, {
      getContainer: () => $("#taskbar-windows"),
      getSiblings: () => $$(".taskbar-item", $("#taskbar-windows")),
      onDragStart: () => {
        this.taskbarDragging = true;
        this.hideTaskbarPreview();
        if (this.manager.taskbarPreviewShowTimer) clearTimeout(this.manager.taskbarPreviewShowTimer);
        if (this.manager.taskbarPreviewHideTimer) clearTimeout(this.manager.taskbarPreviewHideTimer);
      },
      onDragEnd: () => {
        this.taskbarDragging = false;
      },
      onDrop: () => {
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
    this.manager.registerWindow(winId, { taskbarItem, title, iconValue, color, record });

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
      if (this.contextMenuOpen || this.taskbarDragging) return;
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
    this.applyTaskbarOrder();

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

  updateAudioIndicators() {
    const intensityValues = audioMixer().intensityValues;
    if (!intensityValues) return;
    this.manager.openWindows.forEach((entry, winId) => {
      const indicator = entry.taskbarItem ? $(".taskbar-speaker-indicator", entry.taskbarItem) : null;
      if (!indicator) return;
      const intensity = intensityValues.get(winId) || 0;
      const channel = audioMixer().channels.get(winId);
      const isExplicitlyPlaying = channel?.nowPlaying?.playbackState === "playing";
      const isMuted = channel?.muted === true;
      indicator.classList.toggle("visible", intensity > 0.5 || isExplicitlyPlaying || isMuted);
      indicator.classList.toggle("muted", isMuted);
    });
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
        if (!w.id || !w.id.startsWith("browser-app-")) {
          restoreWindowAnimated(w);
        }
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

  isWindowPinned(winId) {
    const win = $(`#${winId}`);
    const appId = win?.dataset?.appId || this.manager.guessAppIdFromWinId(winId);
    return !!this.getPinnedItemByAppId(appId);
  }

  getPinnedItemByAppId(appId) {
    if (!appId) return null;
    return this.getPinnedItems().find((item) => item.appId === appId) || null;
  }

  findOpenWindowIdByAppId(appId) {
    if (!appId) return null;
    for (const [wId] of this.manager.openWindows) {
      const winEl = document.getElementById(wId);
      if (winEl?.dataset?.appId === appId) return wId;
    }
    return null;
  }

  findPinnedElementByAppId(appId) {
    const pin = this.getPinnedItemByAppId(appId);
    return pin ? $(`#taskbar-pinned-${pin.winId}`) : null;
  }

  getPinnedItems() {
    try {
      let pinnedData = os.storage.get(StorageKeys.pinnedTaskbarItems) || [];
      const obsoleteIds = ["animesApp"];
      const filteredPinned = pinnedData.filter((item) => !obsoleteIds.includes(item.appId));
      if (filteredPinned.length !== pinnedData.length) {
        pinnedData = filteredPinned;
        os.storage.set(StorageKeys.pinnedTaskbarItems, pinnedData);
        try {
          const order = os.storage.get(StorageKeys.taskbarOrder) || [];
          const cleanedOrder = order.filter((id) => !obsoleteIds.includes(id));
          if (cleanedOrder.length !== order.length) os.storage.set(StorageKeys.taskbarOrder, cleanedOrder);
        } catch {}
      }
      const tvPinnedWinId = "tv-streaming-pinned";
      const hasTvDefaultPin = pinnedData.some((item) => item.winId === tvPinnedWinId);
      if (hasTvDefaultPin) {
        pinnedData = pinnedData.filter((item) => item.winId !== tvPinnedWinId);
        os.storage.set(StorageKeys.pinnedTaskbarItems, pinnedData);
        try {
          const order = os.storage.get(StorageKeys.taskbarOrder) || [];
          if (order.includes("tvStreamingApp")) {
            os.storage.set(
              StorageKeys.taskbarOrder,
              order.filter((id) => id !== "tvStreamingApp")
            );
          }
        } catch {}
      }
      const migrationKey = StorageKeys.defaultsCreatedPrefix + "pinnedTaskbarItems";
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
        },
        {
          winId: "movies-pinned",
          appId: "moviesApp",
          title: "Movies",
          iconValue: "fas fa-film",
          color: null
        },
        {
          winId: "aniwatch-pinned",
          appId: "aniwatchApp",
          title: "Aniwatch Anime",
          iconValue: "fas fa-play-circle",
          color: null
        }
      ];

      const existingAppIds = pinnedData.map((item) => item.appId);
      const missingDefaults = defaultApps.filter((app) => !existingAppIds.includes(app.appId));

      if (missingDefaults.length > 0) {
        let updatedPinnedItems;
        if (pinnedData.length === 0) {
          updatedPinnedItems = [...defaultApps];
        } else {
          updatedPinnedItems = [...pinnedData];
          missingDefaults.forEach((app) => {
            const defaultIdx = defaultApps.findIndex((d) => d.appId === app.appId);
            let insertPos = updatedPinnedItems.length;
            for (let i = defaultIdx - 1; i >= 0; i--) {
              const predIdx = updatedPinnedItems.findIndex((item) => item.appId === defaultApps[i].appId);
              if (predIdx !== -1) {
                insertPos = predIdx + 1;
                break;
              }
            }
            if (insertPos === updatedPinnedItems.length) {
              for (let i = defaultIdx + 1; i < defaultApps.length; i++) {
                const succIdx = updatedPinnedItems.findIndex((item) => item.appId === defaultApps[i].appId);
                if (succIdx !== -1) {
                  insertPos = succIdx;
                  break;
                }
              }
            }
            updatedPinnedItems.splice(insertPos, 0, app);
          });
        }
        os.storage.set(StorageKeys.pinnedTaskbarItems, updatedPinnedItems);
        try {
          const order = os.storage.get(StorageKeys.taskbarOrder) || [];
          if (order.length > 0) {
            let orderChanged = false;
            missingDefaults.forEach((app) => {
              if (order.includes(app.appId)) return;
              const defaultIdx = defaultApps.findIndex((d) => d.appId === app.appId);
              let insertPos = order.length;
              for (let i = defaultIdx - 1; i >= 0; i--) {
                const predIdx = order.indexOf(defaultApps[i].appId);
                if (predIdx !== -1) {
                  insertPos = predIdx + 1;
                  break;
                }
              }
              if (insertPos === order.length) {
                for (let i = defaultIdx + 1; i < defaultApps.length; i++) {
                  const succIdx = order.indexOf(defaultApps[i].appId);
                  if (succIdx !== -1) {
                    insertPos = succIdx;
                    break;
                  }
                }
              }
              order.splice(insertPos, 0, app.appId);
              orderChanged = true;
            });
            if (orderChanged) os.storage.set(StorageKeys.taskbarOrder, order);
          }
        } catch {}
        if (!os.storage.get(migrationKey)) os.storage.set(migrationKey, "true");
        return updatedPinnedItems;
      }

      if (!os.storage.get(migrationKey)) os.storage.set(migrationKey, "true");
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
    if (pinnedItems.some((item) => item.appId === appId)) return;

    pinnedItems.push({
      winId: `${appId}-pinned`,
      appId,
      title: entry.title,
      iconValue: entry.iconValue,
      color: entry.color
    });

    this.savePinnedItems(pinnedItems);

    const openItem = $(`#taskbar-${winId}`);
    if (openItem) openItem.classList.add("pinned");
    const stalePin = this.findPinnedElementByAppId(appId);
    if (stalePin) stalePin.remove();

    this.syncPinnedStates();
    os.events.emit(BusEvents.ACHIEVEMENT_TRIGGER, { achievementId: Achievements.PinCushion });
  }

  unpinFromTaskbar(winId) {
    const win = $(`#${winId}`);
    const appId = win?.dataset?.appId || this.manager.guessAppIdFromWinId(winId);
    const pinnedItems = this.getPinnedItems();
    const target = pinnedItems.find((item) => item.appId === appId) || pinnedItems.find((item) => item.winId === winId);
    if (!target) return;

    const filtered = pinnedItems.filter((item) => item !== target);
    this.savePinnedItems(filtered);

    $$(".taskbar-item.pinned", $("#taskbar-windows")).forEach((el) => {
      if (el.dataset.appId !== appId) return;
      const elWinId = el.id.replace("taskbar-", "");
      if (this.manager.openWindows.has(elWinId)) {
        el.classList.remove("pinned");
      } else {
        el.remove();
      }
    });

    this.syncPinnedStates();
  }

  handleRunningItemClick(winId) {
    const winTask = $(`#${winId}`);
    if (!winTask) return;
    const entry = this.manager.openWindows.get(winId);
    const record = entry?.record;
    const isMinimized = record ? record.minimized : winTask.style.display === "none";

    if (isMinimized) {
      if (winTask.style.display === "none") winTask.style.display = "";
      winTask.classList.remove("minimized");
      if (record) record.minimized = false;
      if (!winTask.id || !winTask.id.startsWith("browser-app-")) {
        restoreWindowAnimated(winTask);
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
  }

  applyPinnedClickAndMenu(pinnedItem, appId, pinWinId) {
    pinnedItem.onclick = () => {
      const openWinId = this.findOpenWindowIdByAppId(appId);
      if (openWinId) this.handleRunningItemClick(openWinId);
      else if (appId) os.app.launch(appId);
    };
    pinnedItem.oncontextmenu = (e) => {
      e.preventDefault();
      this.hideTaskbarPreview();
      if (this.manager.taskbarPreviewShowTimer) clearTimeout(this.manager.taskbarPreviewShowTimer);
      if (this.manager.taskbarPreviewHideTimer) clearTimeout(this.manager.taskbarPreviewHideTimer);
      this.contextMenuOpen = true;
      const menu = showStartStyleMenu(e, (addMenuItem, addSeparator) => {
        const hasOpenWindow = this.findOpenWindowIdByAppId(appId);
        if (hasOpenWindow) {
          addMenuItem("New Window", () => os.app.launch(appId), "fa-plus-square");
          addSeparator();
        }
        addMenuItem("Unpin from Taskbar", () => this.unpinFromTaskbar(pinWinId), "fa-thumbtack");
        addSeparator();
        addMenuItem(
          "Launch App",
          () => {
            if (appId) os.app.launch(appId);
          },
          "fa-play"
        );
      });
      const observer = new MutationObserver(() => {
        if (!document.body.contains(menu)) {
          this.contextMenuOpen = false;
          this.taskbarDragging = false;
          observer.disconnect();
        }
      });
      observer.observe(document.body, { childList: true });
    };
  }

  keepPinnedOnClose(winId) {
    const taskbarItem = $(`#taskbar-${winId}`);
    if (!taskbarItem || !taskbarItem.classList.contains("pinned")) return false;

    taskbarItem.classList.remove("active", "running", "minimized");
    const appId = taskbarItem.dataset.appId || this.manager.guessAppIdFromWinId(winId);
    const pin = this.getPinnedItemByAppId(appId);
    const pinWinId = pin ? pin.winId : `${appId}-pinned`;
    this.applyPinnedClickAndMenu(taskbarItem, appId, pinWinId);
    return true;
  }

  renderPinnedItems() {
    const taskbarWindows = $("#taskbar-windows");
    if (!taskbarWindows) return;

    const existingPinned = $$('.taskbar-item[id^="taskbar-pinned-"]', taskbarWindows);
    existingPinned.forEach((el) => el.remove());

    const pinnedItems = this.getPinnedItems();
    if (pinnedItems.length === 0) return;

    pinnedItems.forEach((item) => {
      const openWinId = this.findOpenWindowIdByAppId(item.appId);
      if (openWinId) {
        const openItem = $(`#taskbar-${openWinId}`);
        if (openItem) openItem.classList.add("pinned");
        const stalePin = this.findPinnedElementByAppId(item.appId);
        if (stalePin) stalePin.remove();
        return;
      }

      const existingForApp = $$(".taskbar-item.pinned", taskbarWindows).find((el) => el.dataset.appId === item.appId);
      if (existingForApp) return;

      const pinnedItem = createElement("div", {
        id: `taskbar-pinned-${item.winId}`,
        className: "taskbar-item pinned"
      });
      pinnedItem.dataset.title = item.title;
      pinnedItem.dataset.appId = item.appId;
      pinnedItem.dataset.winId = item.winId;
      pinnedItem.appendChild(this.buildTaskbarIcon(item.iconValue, item.title, item.color));

      this.applyPinnedClickAndMenu(pinnedItem, item.appId, item.winId);

      enableTaskbarReorder(pinnedItem, {
        getContainer: () => $("#taskbar-windows"),
        getSiblings: () => $$(".taskbar-item", $("#taskbar-windows")),
        onDragStart: () => {
          this.taskbarDragging = true;
          this.hideTaskbarPreview();
          if (this.manager.taskbarPreviewShowTimer) clearTimeout(this.manager.taskbarPreviewShowTimer);
          if (this.manager.taskbarPreviewHideTimer) clearTimeout(this.manager.taskbarPreviewHideTimer);
        },
        onDragEnd: () => {
          this.taskbarDragging = false;
        },
        onDrop: () => {
          this.saveTaskbarOrder();
        }
      });

      taskbarWindows.appendChild(pinnedItem);
    });

    this.applyTaskbarOrder();
    this.syncPinnedStates();
  }

  saveTaskbarOrder() {
    const taskbarWindows = $("#taskbar-windows");
    if (!taskbarWindows) return;

    const items = $$(".taskbar-item", taskbarWindows);
    const order = items.map((item) => item.dataset.appId).filter(Boolean);

    try {
      os.storage.set(StorageKeys.taskbarOrder, order);
    } catch {}
  }

  applyTaskbarOrder() {
    const taskbarWindows = $("#taskbar-windows");
    if (!taskbarWindows) return;

    const saved = os.storage.get(StorageKeys.taskbarOrder) || [];
    if (!saved.length) return;

    const tiles = $$(".taskbar-item", taskbarWindows);
    const byId = new Map(tiles.map((t) => [t.id.replace("taskbar-", ""), t]));
    const byApp = new Map(tiles.map((t) => [t.dataset.appId, t]));

    const resolveAppId = (entry) => {
      if (byApp.has(entry)) return entry;
      const pin = this.getPinnedItems().find((p) => `pinned-${p.winId}` === entry);
      return pin ? pin.appId : null;
    };

    const ordered = [];
    saved.forEach((entry) => {
      let t = byId.get(entry) || byApp.get(entry);
      if (!t) {
        const appId = resolveAppId(entry);
        if (appId) t = byApp.get(appId);
      }
      if (t) {
        ordered.push(t);
        byId.delete(t.id.replace("taskbar-", ""));
        byApp.delete(t.dataset.appId);
      }
    });
    byApp.forEach((t) => ordered.push(t));

    ordered.forEach((t) => taskbarWindows.appendChild(t));
  }

  restorePinnedItems() {
    this.renderPinnedItems();
  }

  syncPinnedStates() {
    const taskbarWindows = $("#taskbar-windows");
    if (!taskbarWindows) return;
    const openList = Array.from(this.manager.openWindows.entries());
    $$(".taskbar-item.pinned", taskbarWindows).forEach((pinned) => {
      const appId = pinned.dataset.appId;
      const winId = pinned.dataset.winId;
      let running = false;
      let focused = false;
      for (const [wId, entry] of openList) {
        const winEl = document.getElementById(wId);
        const wApp = winEl?.dataset?.appId;
        if (wApp === appId || wId === winId) {
          running = true;
          if (entry.taskbarItem?.classList.contains("active")) focused = true;
        }
      }
      pinned.classList.toggle("running", running);
      pinned.classList.toggle("active", focused);
    });
  }

  applyTaskbarLabels() {
    const show = parseBool(os.storage.get(StorageKeys.taskbarShowLabels));
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
