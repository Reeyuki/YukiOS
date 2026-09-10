import { StorageKeys, os, $, $$, BusEvents, createElement } from "../framework.js";
import { showStartStyleMenu } from "../shared/contextMenu.js";
export class TaskbarPositionManager {
  constructor() {
    this.positions = ["bottom", "top", "left", "right"];
    this.alignments = ["left", "center", "right"];
    this.currentPosition = "bottom";
    this.initialized = false;
    this.contextMenuBound = false;
    this.dragBound = false;
    this.dragState = null;
    this.dragSuppressClick = false;

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.init());
    } else {
      setTimeout(() => this.init(), 0);
    }
  }

  readStoredPosition() {
    const v = os.storage.get(StorageKeys.taskbarPosition);
    if (v && this.positions.includes(v)) return v;
    return "bottom";
  }

  persistPosition(position) {
    os.storage.set(StorageKeys.taskbarPosition, position);
  }

  restorePersistedPosition() {
    const stored = this.readStoredPosition();
    if (stored !== this.currentPosition) {
      this.currentPosition = stored;
    }
    this.applyPosition(this.currentPosition);
    return this.currentPosition;
  }

  init() {
    this.currentPosition = this.readStoredPosition();
    if (this.applyPosition(this.currentPosition)) {
      this.setupEventListeners();
    } else {
      setTimeout(() => {
        this.currentPosition = this.readStoredPosition();
        if (this.applyPosition(this.currentPosition)) {
          this.setupEventListeners();
        } else {
          setTimeout(() => {
            this.currentPosition = this.readStoredPosition();
            this.applyPosition(this.currentPosition);
            this.setupEventListeners();
          }, 100);
        }
      }, 50);
    }
    setTimeout(() => this.restorePersistedPosition(), 350);
    setTimeout(() => this.restorePersistedPosition(), 1200);
    window.addEventListener("load", () => this.restorePersistedPosition());
    os.storage.subscribe(StorageKeys.taskbarPosition, () => this.restorePersistedPosition());
  }

  setupEventListeners() {
    if (this.contextMenuBound) return;
    this.contextMenuBound = true;

    const handleContextMenu = (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const taskbar = target.closest("#taskbar");
      if (!taskbar) return;
      if (target.closest(".taskbar-item")) return;
      const onTaskbarWindows = target.closest("#taskbar-windows");
      const isEmptyTaskbarWindows = !!onTaskbarWindows;
      const isEmptyTaskbarBg =
        !onTaskbarWindows &&
        !target.closest(
          "#system-tray, #start-button, #mac-menu-bar, #workspace-bar, #tray-overflow-popup, #clock, #date"
        );
      if (!isEmptyTaskbarWindows && !isEmptyTaskbarBg) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      showStartStyleMenu(e, (addMenuItem, addSeparator) => {
        const alignIcons = { left: "fa-align-left", center: "fa-align-center", right: "fa-align-right" };
        this.alignments.forEach((alignment) => {
          const label = alignment.charAt(0).toUpperCase() + alignment.slice(1);
          addMenuItem(
            `Align ${label}`,
            () => {
              this.setAlignment(alignment);
            },
            alignIcons[alignment]
          );
        });
        addSeparator();
        this.positions.forEach((position) => {
          const icons = { bottom: "fa-arrow-down", top: "fa-arrow-up", left: "fa-arrow-left", right: "fa-arrow-right" };
          const label = position.charAt(0).toUpperCase() + position.slice(1);
          addMenuItem(
            `Move to ${label}`,
            () => {
              this.setPosition(position);
            },
            icons[position]
          );
        });
        addSeparator();
        const rawShowLabels = os.storage.get(StorageKeys.taskbarShowLabels);
        const showLabels = rawShowLabels === "true" || rawShowLabels === true || rawShowLabels === "1";
        addMenuItem(
          "Show Taskbar Labels",
          () => {
            const next = !showLabels;
            os.storage.set(StorageKeys.taskbarShowLabels, String(next));
            const taskbarWindows = $("#taskbar-windows");
            if (taskbarWindows) {
              $$(".taskbar-item:not(.pinned)", taskbarWindows).forEach((item) => {
                let label = $(".taskbar-item-label", item);
                if (next) {
                  if (!label) {
                    label = createElement("span", { className: "taskbar-item-label", text: item.dataset.title || "" });
                    item.appendChild(label);
                  }
                } else if (label) {
                  label.remove();
                }
              });
            }
            if (os.windowManager?.taskbarSystem?.applyTaskbarLabels) {
              try {
                os.windowManager.taskbarSystem.applyTaskbarLabels();
              } catch {}
            } else if (os.window.wm?.taskbarSystem?.applyTaskbarLabels) {
              try {
                os.window.wm.taskbarSystem.applyTaskbarLabels();
              } catch {}
            }
            os.events.emit(BusEvents.SETTINGS_CHANGED, { key: StorageKeys.taskbarShowLabels, value: String(next) });
          },
          showLabels ? "fa-toggle-on" : "fa-toggle-off"
        );
        addSeparator();
        addMenuItem(
          "Taskbar Settings",
          () => {
            os.app.launch("settingsApp");
          },
          "fa-cog"
        );
      });
    };

    document.addEventListener("contextmenu", handleContextMenu, true);
    this.enableTaskbarDragging();
  }

  isValidDragTarget(target) {
    if (!(target instanceof Element)) return false;
    if (document.documentElement.classList.contains("mac-mode") || document.body.classList.contains("mac-mode"))
      return false;
    if (document.documentElement.classList.contains("chromeos-mode")) return false;
    const taskbar = target.closest("#taskbar");
    if (!taskbar) return false;
    if (target.closest(".taskbar-item")) return false;
    if (target.closest("#system-tray")) return false;
    if (target.closest("#start-button")) return false;
    if (target.closest("#mac-menu-bar")) return false;
    if (target.closest("#workspace-bar")) return false;
    if (target.closest("button")) return false;
    if (target.closest("a")) return false;
    if (target.closest("input")) return false;
    return true;
  }

  detectEdgePosition(x, y) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dTop = y;
    const dBottom = h - y;
    const dLeft = x;
    const dRight = w - x;
    const min = Math.min(dTop, dBottom, dLeft, dRight);
    if (min === dTop) return "top";
    if (min === dBottom) return "bottom";
    if (min === dLeft) return "left";
    return "right";
  }

  cleanupDrag() {
    document.body.classList.remove("taskbar-drag-active");
    this.dragState = null;
  }

  enableTaskbarDragging() {
    if (this.dragBound) return;
    const taskbar = $("#taskbar");
    if (!taskbar) {
      setTimeout(() => this.enableTaskbarDragging(), 200);
      return;
    }
    this.dragBound = true;
    const onPointerDown = (e) => {
      if (e.button !== 0) return;
      if (this.dragSuppressClick) return;
      if (!this.isValidDragTarget(e.target)) return;
      const taskbarEl = $("#taskbar");
      if (!taskbarEl) return;
      this.dragState = {
        startX: e.clientX,
        startY: e.clientY,
        started: false
      };
      const onMove = (ev) => {
        if (!this.dragState) return;
        const dx = ev.clientX - this.dragState.startX;
        const dy = ev.clientY - this.dragState.startY;
        if (!this.dragState.started) {
          if (Math.hypot(dx, dy) < 8) return;
          this.dragState.started = true;
          document.body.classList.add("taskbar-drag-active");
        }
        if (this.dragState.started) {
          ev.preventDefault();
        }
      };
      const onUp = (ev) => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onUp);
        window.removeEventListener("blur", onUp);
        if (!this.dragState) {
          this.cleanupDrag();
          return;
        }
        const wasStarted = this.dragState.started;
        const clientX = ev.clientX ?? this.dragState.startX;
        const clientY = ev.clientY ?? this.dragState.startY;
        const finalPos = wasStarted ? this.detectEdgePosition(clientX, clientY) : null;
        this.cleanupDrag();
        if (wasStarted && finalPos && finalPos !== this.currentPosition) {
          this.setPosition(finalPos);
        }
        if (wasStarted) {
          this.dragSuppressClick = true;
          setTimeout(() => {
            this.dragSuppressClick = false;
          }, 300);
          if (ev && typeof ev.preventDefault === "function") ev.preventDefault();
          if (ev && typeof ev.stopPropagation === "function") ev.stopPropagation();
        }
        this.dragState = null;
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onUp);
      window.addEventListener("blur", onUp);
    };
    taskbar.addEventListener("pointerdown", onPointerDown);
    taskbar.addEventListener(
      "click",
      (e) => {
        if (this.dragSuppressClick) {
          e.preventDefault();
          e.stopPropagation();
        }
      },
      true
    );
  }

  setAlignment(alignment) {
    if (!this.alignments.includes(alignment)) return;
    os.storage.set(StorageKeys.taskbarAlignment, alignment);
    const taskbar = $("#taskbar");
    const taskbarWindows = $("#taskbar-windows");
    if (taskbar && taskbarWindows) {
      const isHorizontal = taskbar.classList.contains("position-bottom") || taskbar.classList.contains("position-top");
      if (isHorizontal) {
        const justifyMap = { left: "flex-start", center: "center", right: "flex-end" };
        taskbarWindows.style.justifyContent = justifyMap[alignment] || "flex-start";
      } else {
        taskbarWindows.style.justifyContent = "";
        taskbarWindows.style.alignItems = "center";
      }
    }
    os.events.emit(BusEvents.SETTINGS_CHANGED, { key: StorageKeys.taskbarAlignment, value: alignment });
  }

  setPosition(position) {
    if (!this.positions.includes(position)) return;

    this.currentPosition = position;
    this.persistPosition(position);
    this.applyPosition(position);
    try {
      import("../account/session.js").then(({ isLoggedIn }) => {
        import("../account/syncEngine.js").then(({ isSyncEnabledPref, syncPush }) => {
          if (isLoggedIn() && isSyncEnabledPref()) syncPush().catch(() => {});
        });
      });
    } catch {}
    const currentAlignment = os.storage.get(StorageKeys.taskbarAlignment) || "left";
    const taskbar = $("#taskbar");
    const taskbarWindows = $("#taskbar-windows");
    if (taskbar && taskbarWindows) {
      const isHorizontal = taskbar.classList.contains("position-bottom") || taskbar.classList.contains("position-top");
      if (isHorizontal) {
        taskbarWindows.style.alignItems = "";
        const justifyMap = { left: "flex-start", center: "center", right: "flex-end" };
        taskbarWindows.style.justifyContent = justifyMap[currentAlignment] || "flex-start";
      } else {
        taskbarWindows.style.justifyContent = "";
        taskbarWindows.style.alignItems = "center";
      }
    }
  }

  applyPosition(position) {
    const taskbar = $("#taskbar");
    const desktop = $("#desktop");

    if (!taskbar || !desktop) {
      console.warn("TaskbarPositionManager: Taskbar or desktop element not found, deferring position application");
      return false;
    }

    taskbar.classList.remove("position-bottom", "position-top", "position-left", "position-right");
    desktop.classList.remove("taskbar-bottom", "taskbar-top", "taskbar-left", "taskbar-right");

    taskbar.classList.add(`position-${position}`);
    desktop.classList.add(`taskbar-${position}`);

    this.updateCSSProperties(position);
    const currentAlignment = os.storage.get(StorageKeys.taskbarAlignment) || "left";
    const taskbarWindows = $("#taskbar-windows");
    if (taskbarWindows) {
      const isHorizontal = taskbar.classList.contains("position-bottom") || taskbar.classList.contains("position-top");
      if (isHorizontal) {
        taskbarWindows.style.alignItems = "";
        const justifyMap = { left: "flex-start", center: "center", right: "flex-end" };
        taskbarWindows.style.justifyContent = justifyMap[currentAlignment] || "flex-start";
      } else {
        taskbarWindows.style.justifyContent = "";
        taskbarWindows.style.alignItems = "center";
      }
    }
    this.initialized = true;
    return true;
  }

  updateCSSProperties(position) {
    const root = document.documentElement;
    const taskbarHeight = getComputedStyle(root).getPropertyValue("--taskbar-h").trim();
    const taskbarWidthV = getComputedStyle(root).getPropertyValue("--taskbar-v-w").trim() || "4.8em";

    root.style.setProperty("--taskbar-padding-top", "0px");
    root.style.setProperty("--taskbar-padding-bottom", "0px");
    root.style.setProperty("--taskbar-padding-left", "0px");
    root.style.setProperty("--taskbar-padding-right", "0px");

    switch (position) {
      case "top":
        root.style.setProperty("--taskbar-padding-top", taskbarHeight);
        break;
      case "bottom":
        root.style.setProperty("--taskbar-padding-bottom", taskbarHeight);
        break;
      case "left":
        root.style.setProperty("--taskbar-padding-left", taskbarWidthV);
        break;
      case "right":
        root.style.setProperty("--taskbar-padding-right", taskbarWidthV);
        break;
    }
  }

  getCurrentPosition() {
    return this.currentPosition;
  }

  isInitialized() {
    return this.initialized;
  }

  reinitialize() {
    if (!this.initialized) {
      this.init();
    }
  }
}

export const taskbarPositionManager = new TaskbarPositionManager();
