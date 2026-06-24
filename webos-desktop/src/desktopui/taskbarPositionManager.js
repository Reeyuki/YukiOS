import { StorageKeys, os } from "../framework.js";
import { showStartStyleMenu } from "../shared/contextMenu.js";
export class TaskbarPositionManager {
  constructor() {
    this.positions = ["bottom", "top", "left", "right"];
    this.currentPosition = os.storage.get(StorageKeys.taskbarPosition) || "bottom";
    this.initialized = false;

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.init());
    } else {
      this.init();
    }
  }

  init() {
    if (this.applyPosition(this.currentPosition)) {
      this.setupEventListeners();
    } else {
      setTimeout(() => {
        if (this.applyPosition(this.currentPosition)) {
          this.setupEventListeners();
        } else {
          setTimeout(() => {
            this.applyPosition(this.currentPosition);
            this.setupEventListeners();
          }, 100);
        }
      }, 50);
    }
  }

  setupEventListeners() {
    const taskbar = document.getElementById("taskbar");

    taskbar.addEventListener("contextmenu", (e) => {
      const target = e.target;
      if (target instanceof Element && target.closest(".taskbar-item")) {
        return;
      }
      e.preventDefault();
      showStartStyleMenu(e, (addMenuItem, addSeparator) => {
        this.positions.forEach((position) => {
          const icons = { bottom: "fa-arrow-down", top: "fa-arrow-up", left: "fa-arrow-left", right: "fa-arrow-right" };
          const label = position.charAt(0).toUpperCase() + position.slice(1);
          const isActive = position === this.currentPosition;
          addMenuItem(
            `${isActive ? "✓ " : "  "}Move to ${label}`,
            () => {
              this.setPosition(position);
            },
            icons[position]
          );
        });
      });
    });
  }

  setPosition(position) {
    if (!this.positions.includes(position)) return;

    this.currentPosition = position;
    os.storage.set(StorageKeys.taskbarPosition, position);
    this.applyPosition(position);
  }

  applyPosition(position) {
    const taskbar = document.getElementById("taskbar");
    const desktop = document.getElementById("desktop");

    if (!taskbar || !desktop) {
      console.warn("TaskbarPositionManager: Taskbar or desktop element not found, deferring position application");
      return false;
    }

    taskbar.classList.remove("position-bottom", "position-top", "position-left", "position-right");
    desktop.classList.remove("taskbar-bottom", "taskbar-top", "taskbar-left", "taskbar-right");

    taskbar.classList.add(`position-${position}`);
    desktop.classList.add(`taskbar-${position}`);

    this.updateCSSProperties(position);
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
