import { os } from "../os/index.js";
import { customPrompt } from "../shared/dialogs.js";
import { StorageKeys } from "../StorageKeys.js";

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

    import("../core/EventBus.js").then(({ bus, BusEvents }) => {
      os.events.on(BusEvents.SETTINGS_CHANGED, (settings) => {
        this.updateVisibility(settings.showWorkspace);
      });
      const showWorkspace = localStorage.getItem(StorageKeys.showWorkspace) !== "false";
      this.updateVisibility(showWorkspace);
    });
  }

  updateVisibility(showWorkspace) {
    if (this._barEl) {
      this._barEl.style.display = showWorkspace ? "flex" : "none";
    }
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
      if (taskbar) {
        taskbar.insertBefore(this._barEl, document.getElementById("system-tray"));
      }
      const showWorkspace = localStorage.getItem(StorageKeys.showWorkspace) !== "false";
      this.updateVisibility(showWorkspace);
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

      btn.addEventListener("dblclick", async () => {
        const newName = await customPrompt("Rename workspace:", ws.name);
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
        os.window.removeFromTaskbar(winId);
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

    if (this._escHandler) {
      document.removeEventListener("keydown", this._escHandler);
    }
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
    const taskbarH = document.getElementById("taskbar")?.offsetHeight ?? 20;
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
    });
  }
}
