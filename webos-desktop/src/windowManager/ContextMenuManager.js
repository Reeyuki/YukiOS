import { showStartStyleMenu } from "../shared/contextMenu.js";

export class ContextMenuManager {
  constructor(manager) {
    this.manager = manager;
  }

  _buildPropertiesWindow(winId) {
    const win = document.getElementById(winId);
    if (!win) return;

    const appInfo = this.manager.openWindows.get(winId);
    if (!appInfo) return;

    const content = win.querySelector(".window-content");
    if (!content) return;

    const existingOverlay = win.querySelector(":scope > .window-props-overlay");
    if (existingOverlay) {
      try {
        existingOverlay.remove();
      } finally {
        content.style.display = content.dataset.prevDisplay || "";
        delete content.dataset.prevDisplay;
      }
    }

    const dataset = win.dataset;
    const rect = win.getBoundingClientRect();

    const info = {
      identity: [
        ["Window ID", winId],
        ["Title", appInfo.title],
        ["Type", dataset.appType || "-"],
        ["App ID", dataset.appId || "-"],
        ["URL", dataset.externalUrl || "-"]
      ],
      geometry: [
        ["Width", `${Math.round(rect.width)}px`],
        ["Height", `${Math.round(rect.height)}px`],
        ["Left", `${Math.round(rect.left)}px`],
        ["Top", `${Math.round(rect.top)}px`]
      ],
      system: [
        ["Z-Index", win.style.zIndex || "-"],
        ["Fullscreen", dataset.fullscreen === "true" ? "Yes" : "No"],
        ["SWF", dataset.swf || "-"],
        ["ROM", dataset.rom || "-"],
        ["Core", dataset.core || "-"]
      ]
    };

    const buildSection = (title, rows) => `
    <div class="props-section">
      <div class="props-section-title">${title}</div>
      ${rows
        .map(
          ([k, v]) => `
        <div class="props-row">
          <div class="props-key">${k}</div>
          <div class="props-val">${v}</div>
        </div>
      `
        )
        .join("")}
    </div>
  `;

    const overlayHtml = `
    <div class="window-props-header">
      <div class="window-props-title">Properties</div>
      <button type="button" class="window-props-close">Close</button>
    </div>
    <div class="props-content">
      ${buildSection("Identity", info.identity)}
      ${buildSection("Geometry", info.geometry)}
      ${buildSection("System", info.system)}
    </div>
  `;

    const overlay = document.createElement("div");
    overlay.className = "window-props-overlay";
    overlay.innerHTML = overlayHtml;

    if (!content.dataset.prevDisplay) content.dataset.prevDisplay = content.style.display || "";
    content.style.display = "none";

    win.appendChild(overlay);
    overlay.querySelector(".window-props-close")?.addEventListener("click", () => {
      try {
        overlay.remove();
      } finally {
        content.style.display = content.dataset.prevDisplay || "";
        delete content.dataset.prevDisplay;
      }
    });
  }

  _buildContextMenuItems(addMenuItem, addSeparator, win) {
    const winId = win.id;
    const isMinimized = win.style.display === "none";
    const isFullscreen = win.dataset.fullscreen === "true";

    addMenuItem(
      isMinimized ? "Restore" : "Minimize",
      () => {
        if (isMinimized) win.style.display = "block";
        else this.manager.minimizeWindow(win);
        this.manager.bringToFront(win);
      },
      isMinimized ? "fa-window-restore" : "fa-window-minimize"
    );

    addMenuItem(
      isFullscreen ? "Restore Size" : "Maximize",
      () => {
        this.manager.toggleFullscreen(win);
        this.manager.bringToFront(win);
      },
      isFullscreen ? "fa-compress" : "fa-window-maximize"
    );

    addMenuItem("Bring to Front", () => this.manager.bringToFront(win), "fa-layer-group");

    addSeparator();

    addMenuItem("Snap Left", () => this.manager._applySnap(win, "left"), "fa-columns");
    addMenuItem("Snap Right", () => this.manager._applySnap(win, "right"), "fa-columns");
    addMenuItem("Snap Maximize", () => this.manager._applySnap(win, "maximize"), "fa-expand-arrows-alt");

    addSeparator();

    if (this.manager.workspaceManager && this.manager.workspaceManager.workspaces.length > 1) {
      this.manager.workspaceManager.workspaces.forEach((ws) => {
        if (ws.id !== this.manager.workspaceManager.activeId) {
          addMenuItem(
            `Move to ${ws.name}`,
            () => {
              this.manager.workspaceManager.moveWindowTo(winId, ws.id);
            },
            "fa-exchange-alt"
          );
        }
      });
      addSeparator();
    }

    addMenuItem("Properties", () => this._buildPropertiesWindow(winId), "fa-info-circle");

    addSeparator();

    const isPinned = this.manager._isWindowPinned(winId);
    addMenuItem(
      isPinned ? "Unpin from Taskbar" : "Pin to Taskbar",
      () => {
        if (isPinned) this.manager._unpinFromTaskbar(winId);
        else this.manager._pinToTaskbar(winId);
      },
      isPinned ? "fa-thumbtack" : "fa-thumbtack"
    );

    addSeparator();

    addMenuItem(
      "Close Window",
      () => {
        const winToClose = document.getElementById(winId);
        if (winToClose) {
          this.manager._silenceWindow(winToClose);
          this.manager.removeFromTaskbar(winId);
          this.manager._animateAndRemove(winToClose);
        }
      },
      "fa-times-circle"
    );
  }

  _showWindowContextMenu(e, win) {
    showStartStyleMenu(e, (addMenuItem, addSeparator) => this._buildContextMenuItems(addMenuItem, addSeparator, win));
  }
}
