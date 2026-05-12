export class TaskbarPositionManager {
  constructor() {
    this.positions = ["bottom", "top", "left", "right"];
    this.currentPosition = localStorage.getItem("taskbarPosition") || "bottom";
    this.contextMenu = null;
    this.init();
  }

  init() {
    this.applyPosition(this.currentPosition);
    this.setupContextMenu();
    this.setupEventListeners();
  }

  setupContextMenu() {
    // Create context menu element
    this.contextMenu = document.createElement("div");
    this.contextMenu.id = "taskbar-context-menu";
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

    // Add click handlers to menu items
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

    // Right-click event on taskbar
    taskbar.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      this.showContextMenu(e.clientX, e.clientY);
    });

    // Hide context menu when clicking elsewhere
    document.addEventListener("click", (e) => {
      const target = e.target;
      if (target instanceof Node && target !== this.contextMenu && !this.contextMenu.contains(target)) {
        this.hideContextMenu();
      }
    });

    // Hide context menu on escape key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.hideContextMenu();
      }
    });
  }

  showContextMenu(x, y) {
    this.contextMenu.style.display = "block";

    // Position the menu
    const menuRect = this.contextMenu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = x;
    let top = y;

    // Adjust if menu would go off-screen
    if (left + menuRect.width > viewportWidth) {
      left = viewportWidth - menuRect.width - 10;
    }

    if (top + menuRect.height > viewportHeight) {
      top = viewportHeight - menuRect.height - 10;
    }

    this.contextMenu.style.left = `${left}px`;
    this.contextMenu.style.top = `${top}px`;

    // Update active state
    this.updateMenuActiveState();
  }

  hideContextMenu() {
    this.contextMenu.style.display = "none";
    // Update active state
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
    localStorage.setItem("taskbarPosition", position);
    this.applyPosition(position);
  }

  applyPosition(position) {
    const taskbar = document.getElementById("taskbar");
    const desktop = document.getElementById("desktop");

    // Remove all position classes
    taskbar.classList.remove("position-bottom", "position-top", "position-left", "position-right");
    desktop.classList.remove("taskbar-bottom", "taskbar-top", "taskbar-left", "taskbar-right");

    // Add new position classes
    taskbar.classList.add(`position-${position}`);
    desktop.classList.add(`taskbar-${position}`);

    // Update CSS custom properties for dynamic spacing
    this.updateCSSProperties(position);
  }

  updateCSSProperties(position) {
    const root = document.documentElement;
    const taskbarHeight = getComputedStyle(root).getPropertyValue("--taskbar-h").trim();

    // Reset all padding properties
    root.style.setProperty("--taskbar-padding-top", "0px");
    root.style.setProperty("--taskbar-padding-bottom", "0px");
    root.style.setProperty("--taskbar-padding-left", "0px");
    root.style.setProperty("--taskbar-padding-right", "0px");

    // Set padding based on position
    switch (position) {
      case "top":
        root.style.setProperty("--taskbar-padding-top", taskbarHeight);
        break;
      case "bottom":
        root.style.setProperty("--taskbar-padding-bottom", taskbarHeight);
        break;
      case "left":
        root.style.setProperty("--taskbar-padding-left", taskbarHeight);
        break;
      case "right":
        root.style.setProperty("--taskbar-padding-right", taskbarHeight);
        break;
    }
  }

  getCurrentPosition() {
    return this.currentPosition;
  }
}

// Initialize the taskbar position manager
export const taskbarPositionManager = new TaskbarPositionManager();
