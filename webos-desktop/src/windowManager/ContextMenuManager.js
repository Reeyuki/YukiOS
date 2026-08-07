import { showStartStyleMenu } from "../shared/contextMenu.js";
import { parseBool } from "../utils/utils.js";
import { os, $, createElement } from "../framework.js";

export class ContextMenuManager {
  constructor(manager) {
    this.manager = manager;
  }

  buildPropertiesWindow(winId) {
    const win = $("#" + winId);
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
        ["Fullscreen", parseBool(dataset.fullscreen) ? "Yes" : "No"],
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

    const overlay = createElement("div");
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

  buildContextMenuItems(addMenuItem, addSeparator, win) {
    const winId = win.id;
    const isMinimized = win.style.display === "none";
    const isFullscreen = parseBool(win.dataset.fullscreen);
    const appId = win.dataset.appId || this.manager.guessAppIdFromWinId(winId);

    addMenuItem(
      isMinimized ? "Restore" : "Minimize",
      () => {
        if (isMinimized) win.style.display = "";
        else this.manager.minimizeWindow(win);
        this.manager.bringToFront(win);
      },
      isMinimized ? "fa-window-restore" : "fa-window-minimize"
    );

    const isMaximized = win.dataset.snapZone === "maximize";

    addMenuItem(
      isMaximized ? "Restore" : "Maximize",
      () => {
        if (isMaximized) this.manager.unsnap(win);
        else this.manager.applySnap(win, "maximize");
        this.manager.bringToFront(win);
      },
      isMaximized ? "fa-window-restore" : "fa-window-maximize"
    );

    addMenuItem(
      isFullscreen ? "Exit Fullscreen" : "Fullscreen",
      () => {
        this.manager.toggleFullscreen(win);
        this.manager.bringToFront(win);
      },
      isFullscreen ? "fa-compress" : "fa-expand"
    );

    addMenuItem("Bring to Front", () => this.manager.bringToFront(win), "fa-layer-group");

    addSeparator();

    if (appId) {
      addMenuItem("New Window", () => os.app.launch(appId), "fa-plus-square");
      addSeparator();
    }

    addMenuItem("Snap Left", () => this.manager.applySnap(win, "left"), "fa-columns");
    addMenuItem("Snap Right", () => this.manager.applySnap(win, "right"), "fa-columns");
    addMenuItem("Snap Maximize", () => this.manager.applySnap(win, "maximize"), "fa-expand-arrows-alt");

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

    addMenuItem("Properties", () => this.buildPropertiesWindow(winId), "fa-info-circle");

    addSeparator();

    const isPinned = this.manager.isWindowPinned(winId);
    addMenuItem(
      isPinned ? "Unpin from Taskbar" : "Pin to Taskbar",
      () => {
        if (isPinned) this.manager.unpinFromTaskbar(winId);
        else this.manager.pinToTaskbar(winId);
      },
      isPinned ? "fa-thumbtack" : "fa-thumbtack"
    );

    addSeparator();

    addMenuItem(
      "Close Window",
      () => {
        const winToClose = $("#" + winId);
        if (winToClose) {
          this.manager.silenceWindow(winToClose);
          this.manager.removeFromTaskbar(winId);
          this.manager.animateAndRemove(winToClose);
        }
      },
      "fa-times-circle"
    );

    const groupKey = this.getAppGroupKey(win);
    const sameAppIds = [winId, ...this.getSiblingWindowIds(groupKey, winId)];
    if (sameAppIds.length > 1) {
      addSeparator();
      addMenuItem(
        "Close All Windows",
        () => {
          for (const id of sameAppIds) {
            const winToClose = $("#" + id);
            if (winToClose) this.manager.closeWindow(winToClose);
          }
        },
        "fa-window-close"
      );
    }
  }

  getAppGroupKey(win) {
    if (win.dataset.appId) return win.dataset.appId;
    if (win.dataset.dupId) return win.dataset.dupId;
    if (this.manager.appRestorationService) {
      const appId = this.manager.appRestorationService.findAppId({ id: win.id });
      if (appId) return appId;
    }
    return win.id.replace(/-\d+$/, "");
  }

  getSiblingWindowIds(groupKey, excludeWinId) {
    const ids = [];
    this.manager.openWindows.forEach((_, winId) => {
      if (winId === excludeWinId) return;
      const win = $("#" + winId);
      if (win && this.getAppGroupKey(win) === groupKey) ids.push(winId);
    });
    return ids;
  }

  showWindowContextMenu(e, win) {
    showStartStyleMenu(e, (addMenuItem, addSeparator) => this.buildContextMenuItems(addMenuItem, addSeparator, win));
  }
}
