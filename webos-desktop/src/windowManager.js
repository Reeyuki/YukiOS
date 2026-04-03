import { desktop } from "./desktop.js";
import { showStartStyleMenu } from "./shared/contextMenu.js";
import { isImageFile } from "./utils.js";
import { audioMixer } from "./audioMixer.js";

export class WorkspaceManager {
  constructor(windowManager) {
    this.wm = windowManager;
    this.workspaces = [{ id: 0, name: "Main", windows: new Set() }];
    this.activeId = 0;
    this._barEl = null;
    this._overviewEl = null;
    this._overviewOpen = false;
    this._dragState = null;
    this._render();
  }

  get active() {
    return this.workspaces.find((w) => w.id === this.activeId);
  }

  _nextId() {
    return this.workspaces.reduce((max, w) => Math.max(max, w.id), -1) + 1;
  }

  _render() {
    if (!this._barEl) {
      this._barEl = document.createElement("div");
      this._barEl.id = "workspace-bar";
      const taskbar = document.getElementById("taskbar");
      taskbar.insertBefore(this._barEl, document.getElementById("system-tray"));
    }

    this._barEl.innerHTML = "";

    const overviewBtn = document.createElement("button");
    overviewBtn.className = "workspace-btn workspace-overview-btn" + (this._overviewOpen ? " active" : "");
    overviewBtn.title = "Workspace Overview";
    overviewBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <rect x="0" y="0" width="6" height="6" rx="1"/><rect x="8" y="0" width="6" height="6" rx="1"/>
      <rect x="0" y="8" width="6" height="6" rx="1"/><rect x="8" y="8" width="6" height="6" rx="1"/>
    </svg>`;
    overviewBtn.addEventListener("click", () => this.toggleOverview());
    this._barEl.appendChild(overviewBtn);

    const sep = document.createElement("div");
    sep.className = "workspace-sep";
    this._barEl.appendChild(sep);

    this.workspaces.forEach((ws) => {
      const btn = document.createElement("button");
      btn.className = "workspace-btn" + (ws.id === this.activeId ? " active" : "");
      btn.textContent = ws.name;
      btn.title = `Switch to ${ws.name} (dblclick to rename)`;

      btn.addEventListener("click", (e) => {
        if (e.target === btn) this.switchTo(ws.id);
      });

      btn.addEventListener("dblclick", () => {
        const newName = prompt("Rename workspace:", ws.name);
        if (newName && newName.trim()) {
          ws.name = newName.trim();
          this._render();
          if (this._overviewOpen) this._renderOverview();
        }
      });

      if (this.workspaces.length > 1) {
        const del = document.createElement("span");
        del.className = "workspace-close";
        del.textContent = "×";
        del.title = "Remove workspace";
        del.addEventListener("click", (e) => {
          e.stopPropagation();
          this.removeWorkspace(ws.id);
        });
        btn.appendChild(del);
      }

      this._barEl.appendChild(btn);
    });

    const addBtn = document.createElement("button");
    addBtn.className = "workspace-btn workspace-add";
    addBtn.textContent = "+";
    addBtn.title = "New workspace";
    addBtn.addEventListener("click", () => this.addWorkspace());
    this._barEl.appendChild(addBtn);
  }

  addWorkspace(name) {
    const id = this._nextId();
    this.workspaces.push({ id, name: name || `WS ${id + 1}`, windows: new Set() });
    this._render();
    this.switchTo(id);
    if (this._overviewOpen) this._renderOverview();
  }

  removeWorkspace(id) {
    if (this.workspaces.length <= 1) return;
    const ws = this.workspaces.find((w) => w.id === id);
    if (!ws) return;

    ws.windows.forEach((winId) => {
      const win = document.getElementById(winId);
      if (win) {
        this.wm._silenceWindow(win);
        this.wm.removeFromTaskbar(winId);
        win.remove();
      }
    });

    this.workspaces = this.workspaces.filter((w) => w.id !== id);

    if (this.activeId === id) {
      this.activeId = this.workspaces[this.workspaces.length - 1].id;
    }

    this._render();
    this._applyVisibility();
    if (this._overviewOpen) this._renderOverview();
  }

  registerWindow(winId) {
    this.active?.windows.add(winId);
  }

  unregisterWindow(winId) {
    this.workspaces.forEach((ws) => ws.windows.delete(winId));
  }

  switchTo(id) {
    this.activeId = id;
    this._applyVisibility();
    this._render();
    if (this._overviewOpen) this.closeOverview();
  }

  _applyVisibility() {
    this.workspaces.forEach((ws) => {
      const isActive = ws.id === this.activeId;
      ws.windows.forEach((winId) => {
        const win = document.getElementById(winId);
        const taskItem = document.getElementById(`taskbar-${winId}`);
        if (win) win.style.visibility = isActive ? "" : "hidden";
        if (win) win.style.pointerEvents = isActive ? "" : "none";
        if (taskItem) taskItem.style.display = isActive ? "" : "none";
      });
    });
  }

  moveWindowTo(winId, targetWorkspaceId) {
    this.unregisterWindow(winId);
    const target = this.workspaces.find((w) => w.id === targetWorkspaceId);
    if (target) target.windows.add(winId);
    this._applyVisibility();
    if (this._overviewOpen) this._renderOverview();
  }

  toggleOverview() {
    if (this._overviewOpen) {
      this.closeOverview();
    } else {
      this.openOverview();
    }
  }

  openOverview() {
    this._overviewOpen = true;
    this._render();

    if (!this._overviewEl) {
      this._overviewEl = document.createElement("div");
      this._overviewEl.id = "workspace-overview";
      document.body.appendChild(this._overviewEl);
    }

    this._overviewEl.style.display = "flex";
    this._renderOverview();

    this._escHandler = (e) => {
      if (e.key === "Escape") this.closeOverview();
    };
    document.addEventListener("keydown", this._escHandler);
  }

  closeOverview() {
    this._overviewOpen = false;
    if (this._overviewEl) this._overviewEl.style.display = "none";
    document.removeEventListener("keydown", this._escHandler);
    this._render();
  }

  _renderOverview() {
    const el = this._overviewEl;
    el.innerHTML = "";

    const desktop = document.getElementById("desktop");
    const dw = desktop.offsetWidth;
    const dh = desktop.offsetHeight;
    const taskbarH = document.getElementById("taskbar")?.offsetHeight ?? 40;
    const vpW = window.innerWidth;
    const vpH = window.innerHeight - taskbarH;

    const count = this.workspaces.length;
    const panelGap = 24;
    const panelMaxW = Math.min(Math.floor((vpW - panelGap * (count + 1)) / count), 420);
    const panelH = Math.round(panelMaxW * (vpH / vpW));
    const scaleX = panelMaxW / dw;
    const scaleY = panelH / dh;
    const scale = Math.min(scaleX, scaleY);

    this.workspaces.forEach((ws) => {
      const panel = document.createElement("div");
      panel.className = "ov-panel" + (ws.id === this.activeId ? " ov-active" : "");
      panel.dataset.wsId = ws.id;
      panel.style.width = panelMaxW + "px";
      panel.style.height = panelH + "px";

      const label = document.createElement("div");
      label.className = "ov-label";
      label.textContent = ws.name;
      panel.appendChild(label);

      const canvas = document.createElement("div");
      canvas.className = "ov-canvas";
      canvas.style.width = dw + "px";
      canvas.style.height = dh + "px";
      canvas.style.transform = `scale(${scale})`;
      canvas.style.transformOrigin = "top left";
      panel.appendChild(canvas);

      ws.windows.forEach((winId) => {
        const realWin = document.getElementById(winId);
        if (!realWin) return;

        const entry = this.wm.openWindows.get(winId);
        const title = entry?.title ?? winId;

        const thumb = document.createElement("div");
        thumb.className = "ov-window";
        thumb.dataset.winId = winId;
        thumb.style.left = realWin.style.left;
        thumb.style.top = realWin.style.top;
        thumb.style.width = realWin.style.width;
        thumb.style.height = realWin.style.height;
        thumb.style.zIndex = realWin.style.zIndex;

        const thumbHeader = document.createElement("div");
        thumbHeader.className = "ov-window-header";
        thumbHeader.textContent = title;
        thumb.appendChild(thumbHeader);

        const thumbBody = document.createElement("div");
        thumbBody.className = "ov-window-body";
        thumb.appendChild(thumbBody);

        this._makeThumbDraggable(thumb, winId, ws.id, panel, scale);

        canvas.appendChild(thumb);
      });

      panel.addEventListener("click", (e) => {
        if (e.target === panel || e.target === canvas || e.target === label) {
          this.switchTo(ws.id);
        }
      });

      panel.addEventListener("dragover", (e) => {
        e.preventDefault();
        panel.classList.add("ov-drop-target");
      });

      panel.addEventListener("dragleave", () => {
        panel.classList.remove("ov-drop-target");
      });

      panel.addEventListener("drop", (e) => {
        e.preventDefault();
        panel.classList.remove("ov-drop-target");
        const winId = e.dataTransfer.getData("text/plain");
        if (winId) this.moveWindowTo(winId, ws.id);
      });

      el.appendChild(panel);
    });

    const addPanelBtn = document.createElement("button");
    addPanelBtn.className = "ov-add-ws";
    addPanelBtn.textContent = "+ New Workspace";
    addPanelBtn.addEventListener("click", () => this.addWorkspace());
    el.appendChild(addPanelBtn);
  }

  _makeThumbDraggable(thumb, winId, fromWsId, fromPanel, scale) {
    thumb.draggable = true;

    thumb.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", winId);
      e.dataTransfer.effectAllowed = "move";
      thumb.classList.add("ov-dragging");
    });

    thumb.addEventListener("dragend", () => {
      thumb.classList.remove("ov-dragging");
      document.querySelectorAll(".ov-drop-target").forEach((p) => p.classList.remove("ov-drop-target"));
    });

    thumb.addEventListener("click", (e) => {
      e.stopPropagation();
      this.moveWindowTo(winId, this.activeId);
      this.switchTo(fromWsId);
    });
  }
}

const styleEl = document.getElementById("window-style");
let styleParent = styleEl.parentNode;

function hideTransparency() {
  if (styleEl.parentNode) styleParent.removeChild(styleEl);
}

function restoreTransparency() {
  if (!styleEl.parentNode) styleParent.appendChild(styleEl);
}

export class WindowManager {
  constructor(notificationCenter = null) {
    this.openWindows = new Map();
    this.zIndexCounter = 1000;
    this.gameWindowCount = 0;
    this.isDraggingWindow = false;
    this.notificationCenter = notificationCenter;
    this.initialTitle = document.title || "YukiOS";
    const faviconLink = document.querySelector("link[rel~='icon']");
    this.initialFavicon = faviconLink ? faviconLink.href : "";
    this._initVisibilityTracking();
    this.workspaceManager = new WorkspaceManager(this);
    setTimeout(() => {
      audioMixer.init();
    }, 0);
  }

  setNotificationCenter(notificationCenter) {
    this.notificationCenter = notificationCenter;
  }

  notify(title, message, type = "info", duration = 5000, icon = null) {
    if (this.notificationCenter) {
      this.notificationCenter.addNotification(title, message, type, duration, icon);
    } else {
      console.warn("Notification Center not initialized");
      this.sendNotify(message);
    }
  }

  updateTransparency() {
    if (this.gameWindowCount > 0 || !window._settings.transparency) {
      hideTransparency();
    } else {
      restoreTransparency();
    }
  }

  _resolveIconType(iconValue) {
    const isDataUrl = typeof iconValue === "string" && iconValue.startsWith("data:");
    const isHttpUrl = typeof iconValue === "string" && /^https?:\/\//.test(iconValue);
    return {
      isImage: isImageFile(iconValue) || isHttpUrl,
      isDataUrl
    };
  }

  _getFaviconLink() {
    let link = document.querySelector("link[rel~='icon']");
    return link;
  }

  _animateAndRemove(win) {
    win.style.animation = "popUp 0.5s ease forwards";
    setTimeout(() => win.remove(), 500);
  }

  _buildPropertiesWindow(winId) {
    const win = document.getElementById(winId);
    if (!win) return;

    const appInfo = this.openWindows.get(winId);
    if (!appInfo) return;

    const dataset = win.dataset;
    const rect = win.getBoundingClientRect();

    const infoLines = [
      `Window ID: ${winId}`,
      `Title: ${appInfo.title}`,
      dataset.appType ? `Type: ${dataset.appType}` : "",
      dataset.appId ? `App ID: ${dataset.appId}` : "",
      dataset.swf ? `SWF Path: ${dataset.swf}` : "",
      dataset.rom ? `ROM: ${dataset.rom}` : "",
      dataset.core ? `Core: ${dataset.core}` : "",
      dataset.externalUrl ? `URL: ${dataset.externalUrl}` : "",
      `Width: ${Math.round(rect.width)}px`,
      `Height: ${Math.round(rect.height)}px`,
      `Left: ${Math.round(rect.left)}px`,
      `Top: ${Math.round(rect.top)}px`,
      `Z-Index: ${win.style.zIndex}`,
      `Fullscreen: ${dataset.fullscreen === "true" ? "Yes" : "No"}`
    ].filter(Boolean);

    const contentHtml = infoLines.map((line) => `<div style="margin:2px 0;">${line}</div>`).join("");
    const propsWin = this.createWindow(`${winId}-props`, `Properties: ${appInfo.title}`, "40vw", "40vh");
    const propsIconHtml = this.getWindowIconHtml(appInfo.iconValue, appInfo.color);

    propsWin.innerHTML = `
      <div class="window-header">
        <span>${propsIconHtml}Properties: ${appInfo.title}</span>
        ${this.getWindowControls()}
      </div>
      <div class="window-content" style="width:100%; height:100%; overflow:auto; user-select:text;">
        ${contentHtml}
      </div>
    `;

    desktop.appendChild(propsWin);
    this.mountWindow(propsWin, `${winId}-props`, appInfo.title, appInfo.iconValue, appInfo.color);
  }

  _buildContextMenuItems(addMenuItem, win) {
    const winId = win.id;

    addMenuItem(win.style.display === "none" ? "Restore" : "Minimize", () => {
      if (win.style.display === "none") win.style.display = "block";
      else this.minimizeWindow(win);
      this.bringToFront(win);
    });

    addMenuItem(win.dataset.fullscreen === "true" ? "Restore Size" : "Maximize", () => {
      this.toggleFullscreen(win);
      this.bringToFront(win);
    });

    addMenuItem("Bring to Front", () => this.bringToFront(win));

    if (this.workspaceManager && this.workspaceManager.workspaces.length > 1) {
      this.workspaceManager.workspaces.forEach((ws) => {
        if (ws.id !== this.workspaceManager.activeId) {
          addMenuItem(`Move to ${ws.name}`, () => {
            this.workspaceManager.moveWindowTo(winId, ws.id);
          });
        }
      });
    }

    addMenuItem("Properties", () => this._buildPropertiesWindow(winId));

    addMenuItem("Close Window", () => {
      const winToClose = document.getElementById(winId);
      if (winToClose) {
        this._silenceWindow(winToClose);
        this.removeFromTaskbar(winId);
        this._animateAndRemove(winToClose);
      }
    });
  }
  getOpenWindowCount() {
    return this.openWindows.size;
  }
  createWindow(id, title, width = "80vw", height = "80vh", isGame = false) {
    window.achievements.incrementWindowOpen();
    const win = document.createElement("div");
    win.className = "window";
    win.id = id;
    win.dataset.fullscreen = "false";

    const widthStr = width != null ? String(width) : "80vw";
    const heightStr = height != null ? String(height) : "80vh";

    const vw = widthStr.includes("vw") ? (window.innerWidth * parseFloat(widthStr)) / 100 : parseInt(widthStr);
    const vh = heightStr.includes("vh") ? (window.innerHeight * parseFloat(heightStr)) / 100 : parseInt(heightStr);

    Object.assign(win.style, {
      width: `${vw}px`,
      height: `${vh}px`,
      left: "25vw",
      top: "5vh",
      position: "absolute",
      zIndex: this.zIndexCounter++
    });

    if (isGame) this.gameWindowCount++;
    this.updateTransparency();
    if (win.id === "yukiOS-settings") {
      setTimeout(() => {
        win.click();
      }, 0);
    }
    win.addEventListener("mousedown", () => this.bringToFront(win));

    return win;
  }

  mountWindow(win, winId, title, iconValue, color = null) {
    window.achievements.incrementWindowOpen();
    this.makeDraggable(win);
    this.makeResizable(win);
    this.setupWindowControls(win);
    this.addToTaskbar(winId, title, iconValue, color);
    this.bringToFront(win);
  }

  getWindowIconHtml(iconValue, color = null) {
    if (!iconValue) return "";
    const size = 30;
    const { isImage, isDataUrl } = this._resolveIconType(iconValue);

    if (isImage || isDataUrl) {
      return `<img src="${iconValue}" style="width:${size}px;height:${size}px;margin-right:6px;vertical-align:middle;object-fit:contain;" />`;
    } else if (typeof iconValue === "string" && iconValue.length > 0) {
      const cls = iconValue.startsWith("fa") ? iconValue : `fa ${iconValue}`;
      const clr = color ?? "white";
      return `<i class="${cls}" style="color:${clr};margin-right:6px;font-size:${size}px;vertical-align:middle;"></i>`;
    }
    return "";
  }

  _buildTaskbarIcon(iconValue, title, color) {
    const { isImage, isDataUrl } = this._resolveIconType(iconValue);

    if (isImage || isDataUrl) {
      const icon = document.createElement("img");
      icon.src = iconValue;
      icon.onerror = () => {
        const fallback = document.createElement("i");
        fallback.className = "fas fa-window-maximize";
        fallback.style.color = color ?? "white";
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
      icon.style.color = "white";
    }

    return icon;
  }

  addToTaskbar(winId, title, iconValue, color = null) {
    if (document.getElementById(`taskbar-${winId}`)) return;
    if (iconValue === "fas fa-video") color = "6677dd";

    const taskbarItem = document.createElement("div");
    taskbarItem.id = `taskbar-${winId}`;
    taskbarItem.className = "taskbar-item";
    taskbarItem.appendChild(this._buildTaskbarIcon(iconValue, title, color));

    taskbarItem.onclick = () => {
      const win = document.getElementById(winId);
      if (!win) return;
      if (win.style.display === "none") {
        win.style.display = "block";
        taskbarItem.classList.remove("minimized");
      }
      this.bringToFront(win);
    };

    taskbarItem.oncontextmenu = (e) => {
      e.preventDefault();
      const win = document.getElementById(winId);
      showStartStyleMenu(e, (addMenuItem) => this._buildContextMenuItems(addMenuItem, win));
    };

    const taskbarWindows = document.getElementById("taskbar-windows");
    taskbarWindows.appendChild(taskbarItem);
    this.openWindows.set(winId, { taskbarItem, title, iconValue, color });
    this.workspaceManager?.registerWindow(winId);

    audioMixer.registerWindow(winId, title, audioMixer.getIconHtmlForTaskbar(null, iconValue));

    const win = document.getElementById(winId);
    if (win) {
      const headerSpan = win.querySelector(".window-header > span");
      if (headerSpan) {
        const iconHtml = this.getWindowIconHtml(iconValue, color);
        if (iconHtml) {
          const temp = document.createElement("div");
          temp.innerHTML = iconHtml;
          const iconEl = temp.firstElementChild;
          if (iconEl) headerSpan.insertBefore(iconEl, headerSpan.firstChild);
        }
      }
    }
  }

  registerCloseWindow(closeButton, winId) {
    closeButton.addEventListener("click", () => {
      const win = document.getElementById(winId);
      if (!win) return;
      this._animateAndRemove(win);
      this.removeFromTaskbar(winId);
    });
  }

  updatePageFavicon(iconValue, title) {
    document.title = title || this.initialTitle;
    const link = this._getFaviconLink();
    const { isImage, isDataUrl } = this._resolveIconType(iconValue);
    if (isImage || isDataUrl) {
      link.href = iconValue;
    } else {
      link.href = this.initialFavicon || "";
    }
  }

  resetToDefaultState() {
    document.title = this.initialTitle;
    const link = this._getFaviconLink();
    link.href = this.initialFavicon || "";
  }

  _initVisibilityTracking() {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        document.title = this.initialTitle;
        this._getFaviconLink().href = this.initialFavicon || "";
      } else {
        if (this.openWindows.size === 0) {
          this.resetToDefaultState();
        } else {
          const activeEntry =
            Array.from(this.openWindows.values()).findLast((entry) =>
              entry.taskbarItem?.classList.contains("active")
            ) ?? Array.from(this.openWindows.values()).pop();
          if (activeEntry) this.updatePageFavicon(activeEntry.iconValue, activeEntry.title);
        }
      }
    });
  }

  bringToFront(win) {
    if (!win) return;

    this.openWindows.forEach(({ taskbarItem }) => taskbarItem.classList.remove("active"));

    const entry = this.openWindows.get(win.id);
    if (entry?.taskbarItem) {
      entry.taskbarItem.classList.add("active");
      entry.taskbarItem.classList.remove("minimized");
      this.updatePageFavicon(entry.iconValue, entry.title);
      document.title = entry.title || "YukiOS";
    }

    win.style.zIndex = this.zIndexCounter++;
  }

  removeFromTaskbar(winId) {
    const taskbarItem = document.getElementById(`taskbar-${winId}`);
    if (taskbarItem) taskbarItem.remove();
    this.openWindows.delete(winId);
    this.workspaceManager?.unregisterWindow(winId);
    audioMixer.unregisterWindow(winId);

    if (this.openWindows.size === 0) {
      this.resetToDefaultState();
    } else {
      const lastWin = Array.from(this.openWindows.values()).pop();
      if (lastWin) this.updatePageFavicon(lastWin.iconValue, lastWin.title);
    }
  }

  minimizeWindow(win) {
    win.style.display = "none";
    const taskbarItem = document.getElementById(`taskbar-${win.id}`);
    if (taskbarItem) {
      taskbarItem.classList.remove("active");
      taskbarItem.classList.add("minimized");
    }
  }

  toggleFullscreen(win) {
    const wasFullscreen = win.dataset.fullscreen === "true";
    const header = win.querySelector(".window-header");

    if (wasFullscreen) {
      if (document.fullscreenElement === win) document.exitFullscreen();

      Object.assign(win.style, {
        width: win.dataset.prevWidth,
        height: win.dataset.prevHeight,
        left: win.dataset.prevLeft,
        top: win.dataset.prevTop
      });

      if (header) header.style.display = "";
      win.dataset.fullscreen = "false";
    } else {
      Object.assign(win.dataset, {
        prevWidth: win.style.width,
        prevHeight: win.style.height,
        prevLeft: win.style.left,
        prevTop: win.style.top
      });

      const makeFullscreen = () => {
        Object.assign(win.style, { width: "100vw", height: "100vh", left: "0", top: "0" });
        if (header) header.style.display = "none";
      };

      if (win.requestFullscreen) {
        win.requestFullscreen().then(makeFullscreen).catch(makeFullscreen);
      } else {
        makeFullscreen();
      }

      win.dataset.fullscreen = "true";

      const onFullscreenChange = () => {
        if (!document.fullscreenElement) {
          if (header) header.style.display = "";
          win.dataset.fullscreen = "false";
          document.removeEventListener("fullscreenchange", onFullscreenChange);
        }
      };

      document.addEventListener("fullscreenchange", onFullscreenChange);
    }
  }

  setupWindowControls(win) {
    win.querySelector(".close-btn").onclick = () => {
      this._silenceWindow(win);
      this.removeFromTaskbar(win.id);
      if (win.dataset.isGame === "true") {
        this.gameWindowCount = Math.max(0, this.gameWindowCount - 1);
      }
      this.updateTransparency();
      this._animateAndRemove(win);
    };
    win.querySelector(".minimize-btn").onclick = () => this.minimizeWindow(win);
    win.querySelector(".maximize-btn").onclick = () => this.toggleFullscreen(win);
  }
  _silenceWindow(win) {
    const iframes = win.querySelectorAll("iframe");
    iframes.forEach((iframe) => {
      try {
        iframe.src = "about:blank";
        iframe.remove();
      } catch (e) {
        iframe.src = "about:blank";
      }
    });

    const media = win.querySelectorAll("video, audio");
    media.forEach((m) => {
      m.pause();
      m.src = "";
      m.load();
      m.remove();
    });
  }
  _showWindowContextMenu(e, win) {
    showStartStyleMenu(e, (addMenuItem) => this._buildContextMenuItems(addMenuItem, win));
  }

  makeDraggable(win) {
    const header = win.querySelector(".window-header");

    header.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      this._showWindowContextMenu(e, win);
    });

    const bringToFrontIfInside = (e) => {
      if (!win.contains(e.target)) return;
      if (e.target.tagName === "BUTTON") return;
      this.bringToFront(win);
    };

    document.addEventListener("mousedown", bringToFrontIfInside);

    const attachIframeListeners = () => {
      const iframes = win.querySelectorAll("iframe");

      iframes.forEach((iframe) => {
        const onLoad = () => {
          try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            iframeDoc.addEventListener("mousedown", () => {
              this.bringToFront(win);
            });
          } catch (e) {}

          audioMixer.patchIframeAudioContext(win.id, iframe);
        };

        if (iframe.contentDocument?.readyState === "complete") {
          onLoad();
        } else {
          iframe.addEventListener("load", onLoad);
        }
      });
    };

    attachIframeListeners();

    header.onmousedown = (e) => {
      if (e.target.tagName === "BUTTON") return;

      this.bringToFront(win);
      e.stopPropagation();
      this.isDraggingWindow = true;

      const ox = e.clientX - win.offsetLeft;
      const oy = e.clientY - win.offsetTop;

      document.onmousemove = (e) => {
        win.style.left = `${e.clientX - ox}px`;
        win.style.top = `${e.clientY - oy}px`;
      };

      document.onmouseup = () => {
        document.onmousemove = null;
        this.isDraggingWindow = false;
      };
    };
  }
  makeResizable(win, setHeightUnsetElement = null) {
    const margin = 10;

    const getDirection = (e) => {
      const rect = win.getBoundingClientRect();
      let dir = "";
      if (e.clientY - rect.top < margin) dir += "n";
      else if (rect.bottom - e.clientY < margin) dir += "s";
      if (e.clientX - rect.left < margin) dir += "w";
      else if (rect.right - e.clientX < margin) dir += "e";
      return dir;
    };

    const cursorMap = {
      n: "n-resize",
      s: "s-resize",
      w: "w-resize",
      e: "e-resize",
      nw: "nw-resize",
      ne: "ne-resize",
      sw: "sw-resize",
      se: "se-resize",
      "": "default"
    };

    win.addEventListener("mousemove", (e) => {
      win.style.cursor = cursorMap[getDirection(e)] || "default";
    });

    win.addEventListener("mousedown", (e) => {
      const direction = getDirection(e);
      if (!direction) return;

      this.bringToFront(win);
      e.preventDefault();

      const startX = e.clientX;
      const startY = e.clientY;
      const rect = win.getBoundingClientRect();
      const startWidth = rect.width;
      const startHeight = rect.height;
      const startLeft = rect.left;
      const startTop = rect.top;
      const MIN_SIZE = 300;

      const doDrag = (e) => {
        let newWidth = startWidth;
        let newHeight = startHeight;
        let newLeft = startLeft;
        let newTop = startTop;

        if (direction.includes("e")) newWidth = startWidth + (e.clientX - startX);
        if (direction.includes("s")) newHeight = startHeight + (e.clientY - startY);
        if (direction.includes("w")) {
          newWidth = startWidth - (e.clientX - startX);
          newLeft = startLeft + (e.clientX - startX);
        }
        if (direction.includes("n")) {
          newHeight = startHeight - (e.clientY - startY);
          newTop = startTop + (e.clientY - startY);
        }

        if (newWidth > MIN_SIZE) {
          win.style.width = `${newWidth}px`;
          win.style.left = `${newLeft}px`;
        }
        if (newHeight > MIN_SIZE) {
          win.style.height = `${newHeight}px`;
          win.style.top = `${newTop}px`;
        }
        if (setHeightUnsetElement?.style) setHeightUnsetElement.style.height = "unset";
      };

      const stopDrag = () => {
        document.removeEventListener("mousemove", doDrag);
        document.removeEventListener("mouseup", stopDrag);
      };

      document.addEventListener("mousemove", doDrag);
      document.addEventListener("mouseup", stopDrag);
    });
  }

  getWindowControls(externalUrl) {
    const externalBtn = externalUrl ? `<button class="external-btn" title="Open in External">↗</button>` : "";

    if (window._settings?.macOsControls) {
      return `<div class="window-controls mac-controls">
        <button class="close-btn mac-btn mac-close" title="Close"></button>
        ${externalBtn}
        <button class="minimize-btn mac-btn mac-minimize" title="Minimize"></button>
        <button class="maximize-btn mac-btn mac-maximize" title="Maximize"></button>
      </div>`;
    }

    return `<div class="window-controls">
      <button class="minimize-btn" title="Minimize"><svg viewBox="0 0 10 1" xmlns="http://www.w3.org/2000/svg"><path d="M0 0h10v1H0z"></path></svg></button>
      ${externalBtn}
      <button class="maximize-btn" title="Maximize"><svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"><path d="M0 0v10h10V0H0zm1 1h8v8H1V1z"></path></svg></button>
      <button class="close-btn" title="Close"><svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"><path d="M10.2.7L9.5 0 5.1 4.4.7 0 0 .7l4.4 4.4L0 9.5l.7.7 4.4-4.4 4.4 4.4.7-.7-4.4-4.4z"></path></svg></button>
    </div>`;
  }

  sendNotify(text) {
    const popup = document.createElement("div");
    this.notificationCenter.addNotification(text, "");
    popup.innerHTML = `
      <div style="display:flex; align-items:flex-start;">
        <div style="flex-shrink:0; width:24px; height:24px; margin-right:8px; background:#0078d7; color:#fff; font-weight:bold; font-family:sans-serif; display:flex; justify-content:center; align-items:center; border-radius:50%;">i</div>
        <div style="flex:1;">
          <div style="color:#0078d7; font-weight:bold; font-size:13px; line-height:1.2;">Notification</div>
          <div style="margin-top:2px; font-weight:normal; font-size:12px; color:#000;">${text}</div>
        </div>
        <div style="flex-shrink:0; margin-left:8px; font-weight:bold; cursor:pointer; color:#666;">×</div>
      </div>
      <div style="position:absolute; bottom:-8px; right:16px; width:0; height:0; border-left:8px solid transparent; border-right:8px solid transparent; border-top:8px solid #fff;"></div>
    `;
    popup.className = "tray-notify";

    const dismiss = () => {
      popup.style.bottom = "-100px";
      popup.style.opacity = "0";
      setTimeout(() => popup.remove(), 500);
    };

    popup.querySelector("div:last-child").addEventListener("click", (e) => {
      e.stopPropagation();
      popup.style.bottom = "50px";
      popup.style.opacity = "0";
      setTimeout(() => popup.remove(), 500);
    });

    popup.addEventListener("click", dismiss);
    document.body.appendChild(popup);

    setTimeout(() => {
      popup.style.bottom = "50px";
      popup.style.opacity = "1";
    }, 10);
    setTimeout(dismiss, 5000);
  }
}
