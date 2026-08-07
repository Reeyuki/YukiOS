import { StorageKeys, os } from "../framework.js";
import { $, $$ } from "../shared/domUtils.js";
export class LayoutManager {
  constructor(manager) {
    this.manager = manager;
  }

  calculateWindowPosition(windowWidth, windowHeight, options = {}) {
    const {
      position = "auto",
      workspace = this.manager.workspaceManager?.activeId || "default",
      allowManualPosition = false
    } = options;

    if (allowManualPosition && position.x !== undefined && position.y !== undefined) {
      const bounds = this.getScreenBounds();
      return {
        left: Math.max(bounds.minX, Math.min(bounds.maxX - windowWidth, position.x)),
        top: Math.max(bounds.minY, Math.min(bounds.maxY - windowHeight, position.y))
      };
    }

    if (position === "center") {
      return this.getCenteredPosition(windowWidth, windowHeight);
    }

    if (typeof position === "object" && position.x !== undefined && position.y !== undefined) {
      const bounds = this.getScreenBounds();
      return {
        left: Math.max(bounds.minX, Math.min(bounds.maxX - windowWidth, position.x)),
        top: Math.max(bounds.minY, Math.min(bounds.maxY - windowHeight, position.y))
      };
    }

    return this.getCascadePosition(windowWidth, windowHeight, workspace);
  }

  getScreenBounds() {
    const padding = 20;
    const taskbarPosition = os.storage.get(StorageKeys.taskbarPosition) || "bottom";
    const taskbar = $("#taskbar");
    let taskbarSize = 0;
    if (taskbar) {
      const rect = taskbar.getBoundingClientRect();
      taskbarSize = taskbarPosition === "left" || taskbarPosition === "right" ? rect.width : rect.height;
    }

    let minX = padding;
    let minY = padding;
    let maxX = window.innerWidth - padding;
    let maxY = window.innerHeight - padding;

    if (taskbarPosition === "left") minX += taskbarSize;
    else if (taskbarPosition === "right") maxX -= taskbarSize;
    else if (taskbarPosition === "top") minY += taskbarSize;
    else maxY -= taskbarSize;

    return { minX, minY, maxX, maxY };
  }

  getTaskbarOffset() {
    const taskbar = $("#taskbar");
    if (!taskbar) return { top: 0, left: 0, width: 0, height: 0 };
    const rect = taskbar.getBoundingClientRect();
    const taskbarPosition = os.storage.get(StorageKeys.taskbarPosition) || "bottom";
    if (taskbarPosition === "left") return { top: 0, left: 0, width: rect.width, height: 0 };
    if (taskbarPosition === "right") return { top: 0, left: 0, width: rect.width, height: 0 };
    if (taskbarPosition === "top") return { top: 0, left: 0, width: 0, height: rect.height };
    return { top: 0, left: 0, width: 0, height: rect.height };
  }

  getTaskbarHeight() {
    const taskbar = $("#taskbar");
    if (!taskbar) return 0;
    const rect = taskbar.getBoundingClientRect();
    const taskbarPosition = os.storage.get(StorageKeys.taskbarPosition) || "bottom";
    return taskbarPosition === "bottom" ? rect.height : 0;
  }

  getCenteredPosition(windowWidth, windowHeight) {
    const bounds = this.getScreenBounds();

    return {
      left: bounds.minX + (bounds.maxX - bounds.minX - windowWidth) / 2,
      top: bounds.minY + (bounds.maxY - bounds.minY - windowHeight) / 2
    };
  }

  getCascadePosition(windowWidth, windowHeight, workspace) {
    const bounds = this.getScreenBounds();
    const baseOffset = 30;
    const now = Date.now();

    this.manager.lastSpawnTime = now;

    const windows = $$(".window").filter(
      (win) => win.style.display !== "none" && win.style.visibility !== "hidden" && win.id !== "desktop"
    );

    if (windows.length === 0) {
      this.manager.lastSpawnedPosition = null;
    }

    let referenceLeft = null;
    let referenceTop = null;

    if (this.manager.lastSpawnedPosition) {
      referenceLeft = this.manager.lastSpawnedPosition.left;
      referenceTop = this.manager.lastSpawnedPosition.top;
    } else if (windows.length > 0) {
      const topWin = windows.reduce((prev, curr) => {
        const zPrev = parseInt(prev.style.zIndex) || 0;
        const zCurr = parseInt(curr.style.zIndex) || 0;
        return zCurr > zPrev ? curr : prev;
      });
      referenceLeft = parseFloat(topWin.style.left);
      referenceTop = parseFloat(topWin.style.top);
    }

    let targetLeft, targetTop;

    if (referenceLeft !== null && !isNaN(referenceLeft)) {
      targetLeft = referenceLeft + baseOffset;
      targetTop = referenceTop + baseOffset;
    } else {
      const screenCenterX = (bounds.minX + bounds.maxX) / 2;
      const screenCenterY = (bounds.minY + bounds.maxY) / 2;
      targetLeft = screenCenterX - windowWidth / 2;
      targetTop = screenCenterY - windowHeight / 2;
    }

    if (targetLeft + 150 > bounds.maxX || targetTop + 100 > bounds.maxY) {
      targetLeft = bounds.minX + 60;
      targetTop = bounds.minY + 60;
    }

    const finalPos = {
      left: Math.max(bounds.minX, Math.min(bounds.maxX - windowWidth, targetLeft)),
      top: Math.max(bounds.minY, Math.min(bounds.maxY - windowHeight, targetTop))
    };

    this.manager.lastSpawnedPosition = finalPos;
    return finalPos;
  }
}
