import { sanitizeTitle } from "../utils/utils.js";
import { $$ } from "../shared/domUtils.js";

import { StorageKeys, os, $, createElement } from "../framework.js";
import { KeybindManager } from "../keybindManager.js";
import { bus, BusEvents } from "../core/EventBus.js";
export class WorkspaceManager {
  constructor(windowManager) {
    this.wm = windowManager;
    this.workspaces = [{ id: 0, name: "Main", windows: new Set() }];
    this.activeId = 0;
    this.prevActiveId = 0;
    this.barEl = null;
    this.overviewEl = null;
    this.overviewOpen = false;
    this.dragState = null;
    this.render();

    Promise.resolve().then(() => {
      os.events.on(BusEvents.SETTINGS_CHANGED, (settings) => {
        this.updateVisibility(settings.showWorkspace);
      });
      const showWorkspace = os.storage.get(StorageKeys.showWorkspace) !== "false";
      this.updateVisibility(showWorkspace);
    });
  }

  updateVisibility(showWorkspace) {
    if (this.barEl) {
      this.barEl.style.display = showWorkspace ? "flex" : "none";
    }
  }

  get active() {
    return this.workspaces.find((w) => w.id === this.activeId);
  }

  nextId() {
    return this.workspaces.reduce((max, w) => Math.max(max, w.id), -1) + 1;
  }

  render() {
    if (!this.barEl) {
      this.barEl = createElement("div");
      this.barEl.id = "workspace-bar";
      const taskbar = $("#taskbar");
      if (taskbar) {
        taskbar.insertBefore(this.barEl, $("#system-tray"));
      }
      Promise.resolve().then(() => {
        const showWorkspace = os.storage.get(StorageKeys.showWorkspace) !== "false";
        this.updateVisibility(showWorkspace);
      });
    }

    this.barEl.innerHTML = "";

    const overviewBtn = createElement("button");
    overviewBtn.className = "workspace-btn workspace-overview-btn" + (this.overviewOpen ? " active" : "");
    overviewBtn.title = "Workspace Overview";
    overviewBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <rect x="0" y="0" width="6" height="6" rx="1"/><rect x="8" y="0" width="6" height="6" rx="1"/>
      <rect x="0" y="8" width="6" height="6" rx="1"/><rect x="8" y="8" width="6" height="6" rx="1"/>
    </svg>`;
    overviewBtn.addEventListener("click", () => this.toggleOverview());
    this.barEl.appendChild(overviewBtn);

    const sep = createElement("div");
    sep.className = "workspace-sep";
    this.barEl.appendChild(sep);

    this.workspaces.forEach((ws) => {
      const btn = createElement("button");
      btn.className = "workspace-btn" + (ws.id === this.activeId ? " active" : "");
      btn.textContent = ws.name;
      btn.title = `Switch to ${ws.name} (dblclick to rename)`;

      btn.addEventListener("click", (e) => {
        if (e.target === btn) this.switchTo(ws.id);
      });

      btn.addEventListener("dblclick", async () => {
        const newName = await os.dialog.prompt("Prompt", "Rename workspace:", ws.name);
        if (newName && newName.trim()) {
          ws.name = newName.trim();
          this.render();
          if (this.overviewOpen) this.renderOverview();
        }
      });

      btn.addEventListener("wheel", (e) => {
        e.preventDefault();
        const idx = this.workspaces.findIndex((w) => w.id === this.activeId);
        if (e.deltaY > 0) {
          const next = this.workspaces[Math.min(idx + 1, this.workspaces.length - 1)];
          if (next) this.switchTo(next.id);
        } else {
          const prev = this.workspaces[Math.max(idx - 1, 0)];
          if (prev) this.switchTo(prev.id);
        }
      });

      if (this.workspaces.length > 1) {
        const del = createElement("span");
        del.className = "workspace-close";
        del.textContent = "×";
        del.title = "Remove workspace";
        del.addEventListener("click", (e) => {
          e.stopPropagation();
          this.removeWorkspace(ws.id);
        });
        btn.appendChild(del);
      }

      this.barEl.appendChild(btn);
    });

    const addBtn = createElement("button");
    addBtn.className = "workspace-btn workspace-add";
    addBtn.textContent = "+";
    addBtn.title = "New workspace";
    addBtn.addEventListener("click", () => this.addWorkspace());
    this.barEl.appendChild(addBtn);
  }

  addWorkspace(name) {
    const id = this.nextId();
    this.workspaces.push({ id, name: name || `WS ${id + 1}`, windows: new Set() });
    this.render();
    if (this.overviewOpen) {
      this.switchInstant(id);
      this.renderOverview();
    } else {
      this.switchInstant(id);
    }
    os.events.emit(BusEvents.WORKSPACE_ADDED);
  }

  removeWorkspace(id) {
    if (this.workspaces.length <= 1) return;
    const ws = this.workspaces.find((w) => w.id === id);
    if (!ws) return;

    ws.windows.forEach((winId) => {
      const win = $("#" + winId);
      if (win) {
        this.wm.silenceWindow(win);
        os.window.removeFromTaskbar(winId);
        win.remove();
      }
    });

    this.workspaces = this.workspaces.filter((w) => w.id !== id);

    if (this.activeId === id) {
      this.activeId = this.workspaces[this.workspaces.length - 1].id;
    }

    this.render();
    this.applyVisibility();
    if (this.overviewOpen) this.renderOverview();
    os.events.emit(BusEvents.WORKSPACE_REMOVED, { workspaceId: id });
  }

  removeEmptyWorkspace(id) {
    const ws = this.workspaces.find((w) => w.id === id);
    if (ws && ws.windows.size === 0) {
      this.removeWorkspace(id);
    }
  }

  registerWindow(winId) {
    this.active?.windows.add(winId);
  }

  unregisterWindow(winId) {
    this.workspaces.forEach((ws) => ws.windows.delete(winId));
  }

  switchInstant(id) {
    this.prevActiveId = this.activeId;
    this.activeId = id;
    this.applyVisibility();
    this.render();
    if (!this.overviewOpen) {
      this.closeOverview();
    }
    this.removeEmptyWorkspace(this.prevActiveId);
    os.events.emit(BusEvents.WORKSPACE_SWITCHED);
  }

  switchTo(id) {
    if (id === this.activeId) return;
    this.prevActiveId = this.activeId;

    const prevIdx = this.workspaces.findIndex((w) => w.id === this.activeId);
    const nextIdx = this.workspaces.findIndex((w) => w.id === id);
    const direction = nextIdx > prevIdx ? 1 : -1;

    this.activeId = id;
    this.render();
    if (!this.overviewOpen) {
      this.closeOverview();
    }

    this.removeEmptyWorkspace(this.prevActiveId);
    this.animateWorkspaceSwitch(direction);
    os.events.emit(BusEvents.WORKSPACE_SWITCHED);
  }

  animateWorkspaceSwitch(direction) {
    const VW = window.innerWidth;
    const DURATION = 300;
    const EASING = "cubic-bezier(0.4, 0, 0.2, 1)";

    const prevId = this.prevActiveId;
    const nextId = this.activeId;

    const prevWs = this.workspaces.find((w) => w.id === prevId);
    const nextWs = this.workspaces.find((w) => w.id === nextId);

    const outgoingWins = [];
    const incomingWins = [];

    prevWs?.windows.forEach((winId) => {
      const win = $("#" + winId);
      if (win) outgoingWins.push(win);
    });

    nextWs?.windows.forEach((winId) => {
      const win = $("#" + winId);
      if (win) incomingWins.push(win);
    });

    const desktop = $("#desktop");
    if (desktop) desktop.classList.add("workspace-clipping");

    const incomingStartX = direction * VW;
    const outgoingEndX = -direction * VW;

    incomingWins.forEach((win) => {
      win.style.visibility = "visible";
      win.style.pointerEvents = "none";
      win.style.transition = "none";
      win.style.transform = `translateX(${incomingStartX}px)`;
    });
    outgoingWins.forEach((win) => {
      win.style.transition = "none";
      win.style.transform = "translateX(0px)";
    });
    document.body.offsetHeight;

    const transitionStyle = `transform ${DURATION}ms ${EASING}`;

    outgoingWins.forEach((win) => {
      win.style.transition = transitionStyle;
      win.style.transform = `translateX(${outgoingEndX}px)`;
    });

    incomingWins.forEach((win) => {
      win.style.transition = transitionStyle;
      win.style.transform = "translateX(0px)";
    });

    setTimeout(() => {
      if (desktop) desktop.classList.remove("workspace-clipping");

      outgoingWins.forEach((win) => {
        win.style.transition = "none";
        win.style.transform = "";
        win.style.visibility = "hidden";
        win.style.pointerEvents = "none";
      });

      incomingWins.forEach((win) => {
        win.style.transition = "none";
        win.style.transform = "";
        win.style.visibility = "";
        win.style.pointerEvents = "";
      });

      this.applyVisibility();
    }, DURATION + 20);

    this.workspaces.forEach((ws) => {
      const isActive = ws.id === this.activeId;
      ws.windows.forEach((winId) => {
        const taskItem = $(`#taskbar-${winId}`);
        if (taskItem) taskItem.style.display = isActive ? "" : "none";
      });
    });
  }

  applyVisibility() {
    this.workspaces.forEach((ws) => {
      const isActive = ws.id === this.activeId;
      ws.windows.forEach((winId) => {
        const win = $("#" + winId);
        const taskItem = $(`#taskbar-${winId}`);
        if (win) {
          win.style.visibility = isActive ? "" : "hidden";
          win.style.pointerEvents = isActive ? "" : "none";
          if (win.style.transform) win.style.transform = "";
          if (win.style.transition) win.style.transition = "";
        }
        if (taskItem) taskItem.style.display = isActive ? "" : "none";
      });
    });
  }

  moveWindowTo(winId, targetWorkspaceId) {
    this.unregisterWindow(winId);
    const target = this.workspaces.find((w) => w.id === targetWorkspaceId);
    if (target) target.windows.add(winId);
    const win = $("#" + winId);
    if (win) {
      win.style.transition = "none";
      win.style.transform = "";
    }
    this.applyVisibility();
    if (this.overviewOpen) this.renderOverview();
  }

  toggleOverview() {
    if (this.overviewOpen) {
      this.closeOverview();
    } else {
      this.openOverview();
    }
  }

  openOverview() {
    this.overviewOpen = true;
    this.render();

    if (!this.overviewEl) {
      this.overviewEl = createElement("div");
      this.overviewEl.id = "workspace-overview";
      document.body.appendChild(this.overviewEl);
    }

    this.overviewEl.style.display = "flex";
    this.renderOverview();

    if (this.escHandler) {
      document.removeEventListener("keydown", this.escHandler);
    }
    this.escHandler = (e) => {
      if (KeybindManager.matches(e, "workspace.closeOverview")) this.closeOverview();
    };
    document.addEventListener("keydown", this.escHandler);
  }

  closeOverview() {
    this.overviewOpen = false;
    if (this.overviewEl) this.overviewEl.style.display = "none";
    document.removeEventListener("keydown", this.escHandler);
    this.render();
  }

  cloneWindowForPreview(win, meta, containerW, containerH, realDesktopW, realDesktopH) {
    const clone = win.cloneNode(true);
    clone.removeAttribute("id");
    clone.classList.add("ov-win-clone");
    clone.style.position = "absolute";
    clone.style.margin = "0";
    clone.style.maxWidth = "none";
    clone.style.maxHeight = "none";
    clone.style.pointerEvents = "none";
    clone.style.visibility = "visible";
    clone.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
    clone.querySelectorAll(".window-controls").forEach((n) => (n.style.visibility = "hidden"));
    clone.querySelectorAll("input,textarea,button,select").forEach((n) => n.setAttribute("disabled", "disabled"));

    clone.querySelectorAll("iframe, video, audio, canvas").forEach((n) => {
      const placeholder = createElement("div");
      placeholder.style.cssText =
        "width:100%;height:100%;background:var(--surface-1);display:flex;align-items:center;justify-content:center;";
      const tempDiv = createElement("div");
      tempDiv.innerHTML = this.wm.getWindowIconHtml(meta?.iconValue, meta?.color || "white");
      const iconEl = tempDiv.firstElementChild;
      if (iconEl) {
        iconEl.style.fontSize = "32px";
        iconEl.style.width = "32px";
        iconEl.style.height = "32px";
        iconEl.style.opacity = "0.6";
        placeholder.appendChild(iconEl);
      }
      n.replaceWith(placeholder);
    });

    const scaleX = containerW / realDesktopW;
    const scaleY = containerH / realDesktopH;
    const scale = Math.min(scaleX, scaleY);

    const winLeft = parseFloat(win.style.left) || 0;
    const winTop = parseFloat(win.style.top) || 0;
    const winW = parseFloat(win.style.width) || win.offsetWidth;
    const winH = parseFloat(win.style.height) || win.offsetHeight;

    clone.style.left = winLeft * scale + "px";
    clone.style.top = winTop * scale + "px";
    clone.style.width = "916px";
    clone.style.height = winH + "px";
    clone.style.transform = `scale(${scale})`;
    clone.style.transformOrigin = "top left";
    clone.style.zIndex = win.style.zIndex || "1000";

    return clone;
  }

  renderOverview() {
    const el = this.overviewEl;
    el.innerHTML = "";

    const desktop = $("#desktop");
    const dw = desktop.offsetWidth;
    const dh = desktop.offsetHeight;

    const desktopBg = window.getComputedStyle(desktop).backgroundImage;
    const desktopBgColor = window.getComputedStyle(desktop).backgroundColor;

    const header = createElement("div");
    header.className = "ov-header";

    const previewAspect = dw / dh;

    this.workspaces.forEach((ws) => {
      const wsBtn = createElement("button");
      wsBtn.className = "ov-ws-btn" + (ws.id === this.activeId ? " ov-ws-active" : "");
      wsBtn.dataset.wsId = String(ws.id);

      const wsLabel = createElement("span");
      wsLabel.className = "ov-ws-label";
      wsLabel.textContent = ws.name;
      wsBtn.appendChild(wsLabel);

      const previewH = 100;
      const previewW = Math.round(previewH * previewAspect);

      const wsPreview = createElement("div");
      wsPreview.className = "ov-ws-preview";
      wsPreview.style.width = previewW + "px";
      wsPreview.style.height = previewH + "px";
      wsPreview.style.backgroundImage = desktopBg;
      wsPreview.style.backgroundColor = desktopBgColor;
      wsPreview.style.backgroundSize = "cover";
      wsPreview.style.backgroundPosition = "center";
      wsPreview.style.overflow = "hidden";

      ws.windows.forEach((winId) => {
        const realWin = $("#" + winId);
        if (!realWin || realWin.style.display === "none") return;
        const entry = this.wm.openWindows.get(winId);
        const clone = this.cloneWindowForPreview(realWin, entry, previewW, previewH, dw, dh);
        wsPreview.appendChild(clone);
      });

      wsBtn.appendChild(wsPreview);

      wsBtn.addEventListener("click", () => {
        if (ws.id === this.activeId) {
          this.closeOverview();
        } else {
          const prevIdx = this.workspaces.findIndex((w) => w.id === this.activeId);
          const nextIdx = this.workspaces.findIndex((w) => w.id === ws.id);
          this.slideDirection = nextIdx > prevIdx ? 1 : -1;
          this.switchTo(ws.id);
          this.renderOverviewSlide();
        }
      });

      wsBtn.addEventListener("dragover", (e) => {
        e.preventDefault();
        wsBtn.classList.add("ov-drop-target");
      });

      wsBtn.addEventListener("dragleave", () => {
        wsBtn.classList.remove("ov-drop-target");
      });

      wsBtn.addEventListener("drop", (e) => {
        e.preventDefault();
        wsBtn.classList.remove("ov-drop-target");
        const winId = e.dataTransfer.getData("text/plain");
        if (winId) this.moveWindowTo(winId, ws.id);
      });

      header.appendChild(wsBtn);
    });

    const addWsBtn = createElement("button");
    addWsBtn.className = "ov-ws-btn ov-ws-add";
    addWsBtn.textContent = "+";
    addWsBtn.title = "Add workspace";
    addWsBtn.addEventListener("click", () => this.addWorkspace());
    header.appendChild(addWsBtn);

    el.appendChild(header);

    const taskbarH = $("#taskbar")?.offsetHeight ?? 40;
    const vpW = window.innerWidth;
    const vpH = window.innerHeight - taskbarH - 160;

    const activeWs = this.workspaces.find((w) => w.id === this.activeId);

    const mainArea = createElement("div");
    mainArea.className = "ov-main-area";
    mainArea.style.width = "100%";
    mainArea.style.height = vpH + "px";

    const bgLayer = createElement("div");
    bgLayer.className = "ov-section-bg";
    bgLayer.style.backgroundImage = desktopBg;
    bgLayer.style.backgroundColor = desktopBgColor;
    bgLayer.style.backgroundSize = "cover";
    bgLayer.style.backgroundPosition = "center";
    mainArea.appendChild(bgLayer);

    const tilesLayer = createElement("div");
    tilesLayer.className = "ov-tiles-layer";

    if (activeWs && activeWs.windows.size > 0) {
      const winCount = activeWs.windows.size;
      const gap = 20;
      const padding = 40;

      const areaW = vpW - padding * 2;
      const areaH = vpH;

      const cols = Math.ceil(Math.sqrt(winCount * (areaW / areaH)));
      const rows = Math.ceil(winCount / cols);

      const cellW = Math.floor((areaW - gap * (cols - 1)) / cols);
      const cellH = Math.floor((areaH - gap * (rows - 1)) / rows);

      const totalGridH = rows * cellH + (rows - 1) * gap;
      const startY = Math.max(0, Math.round((areaH - totalGridH) / 2));

      let idx = 0;
      activeWs.windows.forEach((winId) => {
        const realWin = $("#" + winId);
        if (!realWin) return;

        const entry = this.wm.openWindows.get(winId);
        const title = entry?.title ?? winId;

        const col = idx % cols;
        const row = Math.floor(idx / cols);

        const realW = parseFloat(realWin.style.width) || realWin.offsetWidth || 800;
        const realH = parseFloat(realWin.style.height) || realWin.offsetHeight || 600;
        const winAspect = realW / realH;

        let tileW, tileH;
        if (cellW / cellH > winAspect) {
          tileH = cellH;
          tileW = Math.floor(cellH * winAspect);
        } else {
          tileW = cellW;
          tileH = Math.floor(cellW / winAspect);
        }

        const isLastRow = row === rows - 1;
        const itemsInLastRow = winCount - (rows - 1) * cols;
        const rowCols = isLastRow ? itemsInLastRow : cols;
        const rowTotalW = rowCols * cellW + (rowCols - 1) * gap;
        const rowStartX = padding + Math.round((areaW - rowTotalW) / 2);

        const cellOffsetX = (col % cols) * (cellW + gap);
        const tileOffsetX = Math.round((cellW - tileW) / 2);
        const tileOffsetY = Math.round((cellH - tileH) / 2);

        const x = rowStartX + cellOffsetX + tileOffsetX;
        const y = startY + row * (cellH + gap) + tileOffsetY;

        const tile = createElement("div");
        tile.className = "ov-window-tile";
        tile.dataset.winId = winId;
        tile.style.width = tileW + "px";
        tile.style.height = tileH + "px";

        const cloneArea = createElement("div");
        cloneArea.className = "ov-tile-clone-area";
        cloneArea.style.width = tileW + "px";
        cloneArea.style.height = tileH + "px";
        cloneArea.style.overflow = "hidden";

        if (realWin.style.display !== "none") {
          const clone = realWin.cloneNode(true);
          clone.removeAttribute("id");
          clone.classList.add("ov-win-clone");
          clone.style.position = "absolute";
          clone.style.left = "0";
          clone.style.top = "0";
          clone.style.margin = "0";
          clone.style.maxWidth = "none";
          clone.style.maxHeight = "none";
          clone.style.pointerEvents = "none";
          clone.style.visibility = "visible";

          clone.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
          clone.querySelectorAll(".window-controls").forEach((n) => {
            n.style.visibility = "hidden";
          });
          clone.querySelectorAll("input,textarea,button,select").forEach((n) => {
            n.setAttribute("disabled", "disabled");
          });

          clone.querySelectorAll("iframe, video, audio, canvas").forEach((n) => {
            const placeholder = createElement("div");
            placeholder.style.cssText =
              "width:100%;height:100%;background:var(--surface-1);display:flex;align-items:center;justify-content:center;";

            const tempDiv = createElement("div");
            tempDiv.innerHTML = this.wm.getWindowIconHtml(entry?.iconValue, entry?.color || "white");
            const iconEl = tempDiv.firstElementChild;

            if (iconEl) {
              iconEl.style.fontSize = "48px";
              iconEl.style.width = "48px";
              iconEl.style.height = "48px";
              iconEl.style.opacity = "0.6";
              placeholder.appendChild(iconEl);
            }

            n.replaceWith(placeholder);
          });

          const realW = parseFloat(realWin.style.width) || realWin.offsetWidth || 800;
          const realH = parseFloat(realWin.style.height) || realWin.offsetHeight || 600;

          const scaleX = tileW / realW;
          const scaleY = tileH / realH;
          const scale = Math.min(scaleX, scaleY);

          clone.style.width = realW + "px";
          clone.style.height = realH + "px";
          clone.style.transform = "scale(" + scale + ")";
          clone.style.transformOrigin = "top left";

          cloneArea.appendChild(clone);
        } else {
          const iconWrap = createElement("div");
          iconWrap.style.cssText =
            "width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:var(--surface-1);";
          iconWrap.innerHTML = this.wm.getWindowIconHtml(entry?.iconValue, entry?.color || "white");

          const ic = iconWrap.querySelector("i, svg, img");
          if (ic) {
            ic.style.fontSize = "48px";
            ic.style.width = "48px";
            ic.style.height = "48px";
          }

          cloneArea.appendChild(iconWrap);
        }

        tile.appendChild(cloneArea);

        const closeBtn = createElement("button");
        closeBtn.className = "ov-tile-close";
        closeBtn.innerHTML = "×";
        closeBtn.title = "Close window";

        closeBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.wm.closeWindow(winId);
          this.renderOverview();
        });

        tile.appendChild(closeBtn);

        const tileHeader = createElement("div");
        tileHeader.className = "ov-tile-header";
        tileHeader.textContent = sanitizeTitle(title);
        tile.appendChild(tileHeader);

        const tileWrapper = createElement("div");
        tileWrapper.style.position = "absolute";
        tileWrapper.style.width = tileW + "px";
        tileWrapper.style.height = tileH + "px";
        tileWrapper.style.left = x + "px";
        tileWrapper.style.top = y + "px";
        tileWrapper.style.setProperty("--glide-x", col < cols / 2 ? "-48px" : "48px");
        tileWrapper.style.animation = "ovTileGlide 0.38s cubic-bezier(0.22, 1, 0.36, 1) " + idx * 50 + "ms both";

        tile.style.position = "relative";

        tileWrapper.appendChild(tile);

        this.makeTileDraggable(tile, winId, activeWs.id);

        tile.addEventListener("click", (e) => {
          e.stopPropagation();
          this.closeOverview();
          setTimeout(() => {
            const win = $("#" + winId);
            if (win) this.wm.bringToFront(win);
          }, 0);
        });

        tilesLayer.appendChild(tileWrapper);
        idx++;
      });
    } else {
      const emptyMsg = createElement("div");
      emptyMsg.className = "ov-empty";
      emptyMsg.textContent = "No windows in this workspace";
      tilesLayer.appendChild(emptyMsg);
    }

    mainArea.appendChild(tilesLayer);
    el.appendChild(mainArea);
  }

  makeTileDraggable(tile, winId, fromWsId) {
    tile.draggable = true;

    tile.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", winId);
      e.dataTransfer.effectAllowed = "move";
      tile.classList.add("ov-dragging");
    });

    tile.addEventListener("dragend", () => {
      tile.classList.remove("ov-dragging");
      $$(".ov-drop-target").forEach((p) => p.classList.remove("ov-drop-target"));
    });
  }

  makeThumbDraggable(thumb, winId, fromWsId, fromPanel, scale) {
    thumb.draggable = true;

    thumb.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", winId);
      e.dataTransfer.effectAllowed = "move";
      thumb.classList.add("ov-dragging");
    });

    thumb.addEventListener("dragend", () => {
      thumb.classList.remove("ov-dragging");
      $$(".ov-drop-target").forEach((p) => p.classList.remove("ov-drop-target"));
    });

    thumb.addEventListener("click", (e) => {
      e.stopPropagation();
      this.moveWindowTo(winId, this.activeId);
    });
  }
  renderOverviewSlide() {
    if (!this.overviewEl) return;

    const el = this.overviewEl;
    const old = el.querySelector(".ov-main-area");

    const desktop = $("#desktop");
    const dw = desktop.offsetWidth;
    const dh = desktop.offsetHeight;

    const taskbarH = $("#taskbar")?.offsetHeight ?? 40;
    const vpH = window.innerHeight - taskbarH - 160;

    const newMain = createElement("div");
    newMain.className = "ov-main-area";
    newMain.style.width = "100%";
    newMain.style.height = vpH + "px";
    newMain.style.position = "relative";

    const desktopBg = window.getComputedStyle(desktop).backgroundImage;
    const desktopBgColor = window.getComputedStyle(desktop).backgroundColor;

    const bgLayer = createElement("div");
    bgLayer.className = "ov-section-bg";
    bgLayer.style.backgroundImage = desktopBg;
    bgLayer.style.backgroundColor = desktopBgColor;
    bgLayer.style.backgroundSize = "cover";
    bgLayer.style.backgroundPosition = "center";

    const tilesLayer = createElement("div");
    tilesLayer.className = "ov-tiles-layer";

    newMain.appendChild(bgLayer);
    newMain.appendChild(tilesLayer);

    const incoming = newMain;
    const outgoing = old;

    incoming.style.position = "absolute";
    incoming.style.top = "0";
    incoming.style.left = "0";
    incoming.style.width = "100%";
    incoming.style.transform = `translateX(${(this.slideDirection || 1) * 40}px)`;
    incoming.style.opacity = "0";

    el.appendChild(incoming);

    requestAnimationFrame(() => {
      incoming.style.transition = "transform 220ms ease, opacity 220ms ease";
      outgoing.style.transition = "transform 220ms ease, opacity 220ms ease";

      incoming.style.transform = "translateX(0px)";
      incoming.style.opacity = "1";

      outgoing.style.transform = `translateX(${(this.slideDirection || 1) * -40}px)`;
      outgoing.style.opacity = "0";
    });

    setTimeout(() => {
      if (outgoing && outgoing.parentNode) outgoing.remove();
    }, 240);

    this.renderOverview();
  }
}
