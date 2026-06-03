import { bus, BusEvents } from "../core/EventBus.js";
import { animateWindowClose, animateWindowMinimize, applyFocusGlow, applyZDepthLift } from "./AnimationSystem.js";

export class WindowStateManager {
  constructor(manager) {
    this.manager = manager;
  }

  bringToFront(win) {
    if (!win) return;

    const allWins = Array.from(this.manager.openWindows.keys())
      .map((id) => document.getElementById(id))
      .filter(Boolean);
    allWins.forEach((w) => applyZDepthLift(w, false));

    this.manager.openWindows.forEach(({ taskbarItem }) => taskbarItem.classList.remove("active"));

    const entry = this.manager.openWindows.get(win.id);
    if (entry?.taskbarItem) {
      entry.taskbarItem.classList.add("active");
      entry.taskbarItem.classList.remove("minimized");
      this.manager.updatePageFavicon(entry.iconValue, entry.title);
      document.title = entry.title || "YukiOS";
      if (entry.record) entry.record.zIndex = this.manager.zIndexCounter;
      os.events.emit(BusEvents.WINDOW_FOCUSED, { winId: win.id, title: entry.title, iconValue: entry.iconValue });
    }

    applyFocusGlow(win);
    applyZDepthLift(win, true);
    win.style.zIndex = this.manager.zIndexCounter++;
    this.manager.triggerSessionSave();
  }

  minimizeWindow(win) {
    const taskbarItem = document.getElementById(`taskbar-${win.id}`);
    if (taskbarItem) {
      taskbarItem.classList.remove("active");
      taskbarItem.classList.add("minimized");
    }
    const entry = this.manager.openWindows.get(win.id);
    if (entry?.record) entry.record.minimized = true;
    animateWindowMinimize(win, () => {
      win.style.display = "none";
      win.style.pointerEvents = "";
      win.style.animation = "";
      win.style.transform = "";
      win.style.opacity = "";
    });
    this.manager.triggerSessionSave();
  }

  toggleFullscreen(win) {
    const wasFullscreen = win.dataset.fullscreen === "true";
    const header = win.querySelector(".window-header");

    if (wasFullscreen) {
      if (document.fullscreenElement === win || document.fullscreenElement === document.documentElement) {
        document.exitFullscreen();
      }

      Object.assign(win.style, {
        width: win.dataset.prevWidth,
        height: win.dataset.prevHeight,
        left: win.dataset.prevLeft,
        top: win.dataset.prevTop,
        zIndex: win.dataset.prevZIndex || win.style.zIndex
      });

      if (header) header.style.display = "";
      win.dataset.fullscreen = "false";
      const entry = this.manager.openWindows.get(win.id);
      if (entry?.record) entry.record.fullscreen = false;
    } else {
      Object.assign(win.dataset, {
        prevWidth: win.style.width,
        prevHeight: win.style.height,
        prevLeft: win.style.left,
        prevTop: win.style.top,
        prevZIndex: win.style.zIndex
      });

      const overFullscreen = window._settings?.notificationsOverFullscreen === true;

      const makeFullscreen = () => {
        Object.assign(win.style, {
          width: "100vw",
          height: "100vh",
          left: "0",
          top: "0",
          zIndex: overFullscreen ? "99999" : win.style.zIndex
        });
        if (header) header.style.display = "none";
      };

      if (overFullscreen) {
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().then(makeFullscreen).catch(makeFullscreen);
        } else {
          makeFullscreen();
        }
      } else {
        if (win.requestFullscreen) {
          win.requestFullscreen().then(makeFullscreen).catch(makeFullscreen);
        } else {
          makeFullscreen();
        }
      }

      win.dataset.fullscreen = "true";
      const entry = this.manager.openWindows.get(win.id);
      if (entry?.record) entry.record.fullscreen = true;

      const onFullscreenChange = () => {
        if (!document.fullscreenElement) {
          if (header) header.style.display = "";
          Object.assign(win.style, {
            width: win.dataset.prevWidth || win.style.width,
            height: win.dataset.prevHeight || win.style.height,
            left: win.dataset.prevLeft || win.style.left,
            top: win.dataset.prevTop || win.style.top,
            zIndex: win.dataset.prevZIndex || win.style.zIndex
          });
          win.dataset.fullscreen = "false";
          const entry = this.manager.openWindows.get(win.id);
          if (entry?.record) entry.record.fullscreen = false;
          document.removeEventListener("fullscreenchange", onFullscreenChange);
        }
      };

      document.addEventListener("fullscreenchange", onFullscreenChange);
    }
    this.manager.triggerSessionSave();
  }

  closeAll() {
    const winIds = Array.from(this.manager.openWindows.keys());
    for (const winId of winIds) {
      const win = document.getElementById(winId);
      if (win) {
        this._silenceWindow(win);
        win.remove();
      }
      this.manager.removeFromTaskbar(winId);
    }
  }

  _silenceWindow(win) {
    const iframes = win.querySelectorAll("iframe");
    iframes.forEach((iframe) => {
      try {
        iframe.src = "about:blank";
        iframe.remove();
      } catch (e) {
        iframe.src = "about:blank";
      }
    });

    const media = win.querySelectorAll("video, audio");
    media.forEach((m) => {
      m.pause();
      m.src = "";
      m.load();
      m.remove();
    });
  }

  _animateAndRemove(win) {
    animateWindowClose(win, () => win.remove());
  }

  registerCloseWindow(closeButton, winId) {
    closeButton.addEventListener("click", () => {
      const win = document.getElementById(winId);
      if (!win) return;
      this._animateAndRemove(win);
      this.manager.removeFromTaskbar(winId);
    });
  }
}
