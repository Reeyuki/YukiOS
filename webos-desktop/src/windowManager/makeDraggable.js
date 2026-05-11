import { StorageKeys } from "../settings.js";
import { desktop } from "../desktop.js";

export function makeDraggable(win, wm) {
  const headers = win.querySelectorAll(".window-header, .browser-tabbar");

  const isInteractive = (target) => {
    return !!target.closest(
      "button, input, select, textarea, .browser-tab, .tab-close, .tab-new-btn, .steam-menu-item, .steam-user-profile, .steam-notifications"
    );
  };

  const isDesktopStretchScrollDisabled = () => {
    try {
      return localStorage.getItem(StorageKeys.disableDesktopStretchScroll) === "true";
    } catch {
      return false;
    }
  };

  const startDrag = (e) => {
    if (e.button !== 0) return;
    if (isInteractive(e.target)) return;

    wm.bringToFront(win);
    e.preventDefault();
    e.stopPropagation();

    wm.isDraggingWindow = true;
    document.body.classList.add("is-dragging");

    const wasSnapped = !!win.dataset.snapZone;
    const disableStretch = isDesktopStretchScrollDisabled();

    if (disableStretch) {
      if (getComputedStyle(win).position !== "fixed") {
        const rect = win.getBoundingClientRect();
        win.style.left = `${rect.left}px`;
        win.style.top = `${rect.top}px`;
        win.style.position = "fixed";
      }
    } else if (getComputedStyle(win).position === "fixed") {
      const rect = win.getBoundingClientRect();
      const desktopRect = desktop.getBoundingClientRect();
      const left = rect.left - desktopRect.left + desktop.scrollLeft;
      const top = rect.top - desktopRect.top + desktop.scrollTop;
      win.style.left = `${left}px`;
      win.style.top = `${top}px`;
      win.style.position = "absolute";
    }

    const winRect = win.getBoundingClientRect();
    const ox = e.clientX - winRect.left;
    const oy = e.clientY - winRect.top;

    if (wasSnapped) wm._unsnap(win);

    const onMouseMove = (e) => {
      const newLeft = e.clientX - ox;
      const newTop = e.clientY - oy;
      win.style.left = `${newLeft}px`;
      win.style.top = `${newTop}px`;

      const entry = wm.openWindows.get(win.id);
      if (entry?.record) {
        entry.record.setGeometry(newLeft, newTop);
      }

      const zone = wm._getSnapZone(e.clientX, e.clientY);
      wm._activeSnapZone = zone;

      if (zone) wm._showSnapGhost(zone);
      else wm._hideSnapGhost();
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);

      wm.isDraggingWindow = false;
      document.body.classList.remove("is-dragging");

      if (wm._activeSnapZone) {
        wm._applySnap(win, wm._activeSnapZone);
        wm._activeSnapZone = null;
        wm._hideSnapGhost();
      }
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  headers.forEach((h) => {
    h.addEventListener("mousedown", startDrag);
    h.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      wm._showWindowContextMenu(e, win);
    });
  });
}

export function _getSnapZone(wm, x, y) {
  const margin = 20;
  const w = window.innerWidth;
  const h = window.innerHeight;

  if (y < margin && x < margin) return "top-left";
  if (y < margin && x > w - margin) return "top-right";
  if (y > h - margin - 48 && x < margin) return "bottom-left";
  if (y > h - margin - 48 && x > w - margin) return "bottom-right";

  if (y < margin) return "maximize";
  if (x < margin) return "left";
  if (x > w - margin) return "right";

  return null;
}

export function _showSnapGhost(wm, zone) {
  let ghost = document.getElementById("snap-ghost");
  if (!ghost) {
    ghost = document.createElement("div");
    ghost.id = "snap-ghost";
    document.getElementById("desktop")?.appendChild(ghost) || document.body.appendChild(ghost);
  }
  ghost.style.display = "block";
  ghost.className = "";
  ghost.classList.add("snap-ghost-active");
  ghost.classList.add(`snap-ghost-${zone}`);
}

export function _hideSnapGhost(wm) {
  const ghost = document.getElementById("snap-ghost");
  if (ghost) {
    ghost.style.display = "none";
    ghost.className = "";
  }
}

export function _applySnap(wm, win, zone) {
  const entry = wm.openWindows.get(win.id);
  if (entry?.record) {
    entry.record.savePreSnapGeometry();
    entry.record.snapZone = zone;
  }
  win.dataset.snapZone = zone;
  win.dataset.oldStyle = win.getAttribute("style");

  const taskbarHeight = 48;
  const h = `calc(100vh - ${taskbarHeight}px)`;
  const halfH = `calc(50vh - ${taskbarHeight / 2}px)`;

  if (zone === "maximize") {
    Object.assign(win.style, { top: "0", left: "0", width: "100vw", height: h });
  } else if (zone === "left") {
    Object.assign(win.style, { top: "0", left: "0", width: "50vw", height: h });
  } else if (zone === "right") {
    Object.assign(win.style, { top: "0", left: "50vw", width: "50vw", height: h });
  } else if (zone === "top-left") {
    Object.assign(win.style, { top: "0", left: "0", width: "50vw", height: halfH });
  } else if (zone === "top-right") {
    Object.assign(win.style, { top: "0", left: "50vw", width: "50vw", height: halfH });
  } else if (zone === "bottom-left") {
    Object.assign(win.style, { top: halfH, left: "0", width: "50vw", height: halfH });
  } else if (zone === "bottom-right") {
    Object.assign(win.style, { top: halfH, left: "50vw", width: "50vw", height: halfH });
  }
}

export function _unsnap(wm, win) {
  const entry = wm.openWindows.get(win.id);
  if (entry?.record) {
    entry.record.restorePreSnapGeometry();
  }
  const old = win.dataset.oldStyle;
  if (old) {
    win.setAttribute("style", old);
    delete win.dataset.oldStyle;
  }
  delete win.dataset.snapZone;
}
