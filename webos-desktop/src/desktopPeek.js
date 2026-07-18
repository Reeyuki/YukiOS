import { animateWindowOpen } from "./windowManager/AnimationSystem.js";

export class DesktopPeekManager {
  constructor(windowManager) {
    this.wm = windowManager;
    this.peekActive = false;
    this.windowStates = new Map();
    this.hoverWindows = [];
    this.button = null;
    this.hoverTimer = null;
  }

  setupPeekButton() {
    const systemTray = document.getElementById("system-tray");
    if (!systemTray) return;

    const btn = document.createElement("div");
    btn.id = "desktop-peek-btn";
    btn.className = "desktop-peek-btn";
    btn.title = "Show Desktop";

    btn.innerHTML = `
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/>
      </svg>
    `;

    systemTray.insertBefore(btn, systemTray.lastChild);

    btn.addEventListener("click", () => this.togglePeek());
    btn.addEventListener("mouseenter", () => this.delayedHoverPeek());
    btn.addEventListener("mouseleave", () => this.cancelHoverPeek());

    this.button = btn;
  }

  togglePeek() {
    this.cancelHoverPeek();

    if (this.peekActive) {
      this.restoreAllWindows();
      this.peekActive = false;
      this.button?.classList.remove("active");
      this.button?.setAttribute("title", "Show Desktop");
    } else {
      this.minimizeAllWindows();
      this.peekActive = true;
      this.button?.classList.add("active");
      this.button?.setAttribute("title", "Show Windows");
    }
  }

  minimizeAllWindows() {
    this.windowStates.clear();
    this.wm.openWindows.forEach((entry, id) => {
      const win = document.getElementById(id);
      if (win && entry.record && !entry.record.minimized) {
        this.windowStates.set(id, { wasMinimized: false });
        this.wm.minimizeWindow(win);
      } else {
        this.windowStates.set(id, { wasMinimized: true });
      }
    });
  }

  restoreAllWindows() {
    this.wm.openWindows.forEach((entry, id) => {
      const state = this.windowStates.get(id);
      if (state && !state.wasMinimized) {
        const win = document.getElementById(id);
        if (!win) return;
        win.style.display = "";
        const taskbarItem = document.getElementById(`taskbar-${win.id}`);
        if (taskbarItem) {
          taskbarItem.classList.remove("minimized");
        }
        if (entry.record) {
          entry.record.minimized = false;
        }
        requestAnimationFrame(() => animateWindowOpen(win, true));
      }
    });
    this.windowStates.clear();
  }

  delayedHoverPeek() {
    if (this.peekActive) return;
    this.cancelHoverPeek();
    this.hoverTimer = setTimeout(() => {
      if (this.peekActive) return;
      this.wm.openWindows.forEach((entry, id) => {
        const win = document.getElementById(id);
        if (win && win.style.display !== "none" && entry.record && !entry.record.minimized) {
          this.hoverWindows.push(win);
          win.classList.add("desktop-peek-hidden");
        }
      });
    }, 2000);
  }

  cancelHoverPeek() {
    if (this.hoverTimer) {
      clearTimeout(this.hoverTimer);
      this.hoverTimer = null;
    }
    this.hoverWindows.forEach((win) => {
      win.classList.remove("desktop-peek-hidden");
    });
    this.hoverWindows = [];
  }
}
