import { StorageKeys } from "./settings.js";

export class TaskbarPositionManager {
  constructor() {
    this.positions = ["bottom", "top", "left", "right"];
    this.currentPosition = localStorage.getItem(StorageKeys.taskbarPosition) || "bottom";
    this.contextMenu = null;
    this.initialized = false;

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.init());
    } else {
      this.init();
    }
  }

  init() {
    if (this.applyPosition(this.currentPosition)) {
      this.setupContextMenu();
      this.setupEventListeners();
    } else {
      setTimeout(() => {
        if (this.applyPosition(this.currentPosition)) {
          this.setupContextMenu();
          this.setupEventListeners();
        } else {
          setTimeout(() => {
            this.applyPosition(this.currentPosition);
            this.setupContextMenu();
            this.setupEventListeners();
          }, 100);
        }
      }, 50);
    }
  }

  setupContextMenu() {
    this.contextMenu = document.createElement("div");
    this.contextMenu.id = "taskbar-pos-menu";
    this.contextMenu.className = "taskbar-context-menu";
    this.contextMenu.innerHTML = `
      <div class="context-menu-item" data-position="bottom">
        <i class="fas fa-arrow-down"></i> Move to Bottom
      </div>
      <div class="context-menu-item" data-position="top">
        <i class="fas fa-arrow-up"></i> Move to Top
      </div>
      <div class="context-menu-item" data-position="left">
        <i class="fas fa-arrow-left"></i> Move to Left
      </div>
      <div class="context-menu-item" data-position="right">
        <i class="fas fa-arrow-right"></i> Move to Right
      </div>
    `;

    document.body.appendChild(this.contextMenu);

    this.contextMenu.querySelectorAll(".context-menu-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        const position = item.getAttribute("data-position");
        this.setPosition(position);
        this.hideContextMenu();
      });
    });
  }

  setupEventListeners() {
    const taskbar = document.getElementById("taskbar");

    taskbar.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      this.showContextMenu(e.clientX, e.clientY);
    });

    document.addEventListener("click", (e) => {
      const target = e.target;
      if (target instanceof Node && target !== this.contextMenu && !this.contextMenu.contains(target)) {
        this.hideContextMenu();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.hideContextMenu();
      }
    });
  }

  showContextMenu(x, y) {
    this.contextMenu.style.display = "block";

    const menuRect = this.contextMenu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = x;
    let top = y;

    if (left + menuRect.width > viewportWidth) {
      left = Math.max(10, viewportWidth - menuRect.width - 10);
    } else if (left < 0) {
      left = 10;
    }

    if (top + menuRect.height > viewportHeight) {
      top = Math.max(10, viewportHeight - menuRect.height - 10);
    } else if (top < 0) {
      top = 10;
    }

    this.contextMenu.style.left = `${left}px`;
    this.contextMenu.style.top = `${top}px`;

    this.updateMenuActiveState();
  }

  hideContextMenu() {
    this.contextMenu.style.display = "none";
    this.contextMenu.querySelectorAll(".context-menu-item").forEach((item) => {
      const position = item.getAttribute("data-position");
      if (position === this.currentPosition) {
        item.classList.add("active");
      } else {
        item.classList.remove("active");
      }
    });
  }

  updateMenuActiveState() {
    this.contextMenu.querySelectorAll(".context-menu-item").forEach((item) => {
      const position = item.getAttribute("data-position");
      if (position === this.currentPosition) {
        item.classList.add("active");
      } else {
        item.classList.remove("active");
      }
    });
  }

  setPosition(position) {
    if (!this.positions.includes(position)) return;

    this.currentPosition = position;
    localStorage.setItem(StorageKeys.taskbarPosition, position);
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
