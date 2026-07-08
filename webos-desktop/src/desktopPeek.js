import { animateWindowOpen } from "./windowManager/AnimationSystem.js";

export class DesktopPeekManager {
  constructor(windowManager) {
    this.wm = windowManager;
    this._peekActive = false;
    this._windowStates = new Map();
    this._hoverWindows = [];
    this.button = null;
    this._hoverTimer = null;
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

    const ntfBtn = document.getElementById("ntf-tray-btn");
    if (ntfBtn && ntfBtn.nextSibling) {
      systemTray.insertBefore(btn, ntfBtn.nextSibling);
    } else {
      systemTray.insertBefore(btn, systemTray.lastChild);
    }

    btn.addEventListener("click", () => this.togglePeek());
    btn.addEventListener("mouseenter", () => this.delayedHoverPeek());
    btn.addEventListener("mouseleave", () => this.cancelHoverPeek());

    this.button = btn;
  }

  togglePeek() {
    this.cancelHoverPeek();

    if (this._peekActive) {
      this.restoreAllWindows();
      this._peekActive = false;
      this.button?.classList.remove("active");
      this.button?.setAttribute("title", "Show Desktop");
    } else {
      this.minimizeAllWindows();
      this._peekActive = true;
      this.button?.classList.add("active");
      this.button?.setAttribute("title", "Show Windows");
    }
  }

  minimizeAllWindows() {
    this._windowStates.clear();
    this.wm.openWindows.forEach((entry, id) => {
      const win = document.getElementById(id);
      if (win && entry.record && !entry.record.minimized) {
        this._windowStates.set(id, { wasMinimized: false });
        this.wm.minimizeWindow(win);
      } else {
        this._windowStates.set(id, { wasMinimized: true });
      }
    });
  }

  restoreAllWindows() {
    this.wm.openWindows.forEach((entry, id) => {
      const state = this._windowStates.get(id);
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
    this._windowStates.clear();
  }

  delayedHoverPeek() {
    if (this._peekActive) return;
    this.cancelHoverPeek();
    this._hoverTimer = setTimeout(() => {
      if (this._peekActive) return;
      this.wm.openWindows.forEach((entry, id) => {
        const win = document.getElementById(id);
        if (win && win.style.display !== "none" && entry.record && !entry.record.minimized) {
          this._hoverWindows.push(win);
          win.classList.add("desktop-peek-hidden");
        }
      });
    }, 2000);
  }

  cancelHoverPeek() {
    if (this._hoverTimer) {
      clearTimeout(this._hoverTimer);
      this._hoverTimer = null;
    }
    this._hoverWindows.forEach((win) => {
      win.classList.remove("desktop-peek-hidden");
    });
    this._hoverWindows = [];
  }
}
