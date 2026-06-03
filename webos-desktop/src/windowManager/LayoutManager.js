import { StorageKeys } from "../settings/settings.js";
import { os } from "../os/index.js";

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
      const bounds = this._getScreenBounds();
      return {
        left: Math.max(bounds.minX, Math.min(bounds.maxX - windowWidth, position.x)),
        top: Math.max(bounds.minY, Math.min(bounds.maxY - windowHeight, position.y))
      };
    }

    if (position === "center") {
      return this._getCenteredPosition(windowWidth, windowHeight);
    }

    if (typeof position === "object" && position.x !== undefined && position.y !== undefined) {
      const bounds = this._getScreenBounds();
      return {
        left: Math.max(bounds.minX, Math.min(bounds.maxX - windowWidth, position.x)),
        top: Math.max(bounds.minY, Math.min(bounds.maxY - windowHeight, position.y))
      };
    }

    return this._getCascadePosition(windowWidth, windowHeight, workspace);
  }

  _getScreenBounds() {
    const taskbarHeight = this._getTaskbarHeight();
    const padding = 20;

    return {
      minX: padding,
      minY: padding,
      maxX: window.innerWidth - padding,
      maxY: window.innerHeight - taskbarHeight - padding
    };
  }

  _getTaskbarHeight() {
    const taskbar = document.getElementById("taskbar");
    if (!taskbar) return 0;

    const rect = taskbar.getBoundingClientRect();
    const taskbarPosition = os.storage.get(StorageKeys.taskbarPosition) || "bottom";

    return taskbarPosition === "bottom" ? rect.height : 0;
  }

  _getCenteredPosition(windowWidth, windowHeight) {
    const bounds = this._getScreenBounds();

    return {
      left: bounds.minX + (bounds.maxX - bounds.minX - windowWidth) / 2,
      top: bounds.minY + (bounds.maxY - bounds.minY - windowHeight) / 2
    };
  }

  _getCascadePosition(windowWidth, windowHeight, workspace) {
    const bounds = this._getScreenBounds();
    const baseOffset = 30;
    const now = Date.now();

    this.manager._lastSpawnTime = now;

    const windows = Array.from(document.querySelectorAll(".window")).filter(
      (win) => win.style.display !== "none" && win.style.visibility !== "hidden" && win.id !== "desktop"
    );

    if (windows.length === 0) {
      this.manager._lastSpawnedPosition = null;
    }

    let referenceLeft = null;
    let referenceTop = null;

    if (this.manager._lastSpawnedPosition) {
      referenceLeft = this.manager._lastSpawnedPosition.left;
      referenceTop = this.manager._lastSpawnedPosition.top;
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

    this.manager._lastSpawnedPosition = finalPos;
    return finalPos;
  }
}
