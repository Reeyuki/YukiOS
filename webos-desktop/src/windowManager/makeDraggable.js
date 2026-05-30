import { StorageKeys } from "../settings/settings.js";
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

  const startResize = (e) => {
    if (e.button !== 2) return;
    if (!(e.altKey || e.metaKey)) return;
    if (isInteractive(e.target)) return;

    wm.bringToFront(win);
    e.preventDefault();
    e.stopPropagation();

    wm.isDraggingWindow = true;
    document.body.classList.add("is-resizing");

    const wasSnapped = !!win.dataset.snapZone;
    if (wasSnapped) wm._unsnap(win);

    const startX = e.clientX;
    const startY = e.clientY;
    const rect = win.getBoundingClientRect();
    const startWidth = rect.width;
    const startHeight = rect.height;
    const MIN_SIZE = 300;

    const onMouseMove = (e) => {
      const newWidth = Math.max(MIN_SIZE, startWidth + (e.clientX - startX));
      const newHeight = Math.max(MIN_SIZE, startHeight + (e.clientY - startY));
      win.style.width = `${newWidth}px`;
      win.style.height = `${newHeight}px`;

      const entry = wm.openWindows.get(win.id);
      if (entry?.record) {
        entry.record.setGeometry(rect.left, rect.top, newWidth, newHeight);
      }
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      wm.isDraggingWindow = false;
      document.body.classList.remove("is-resizing");
      if (wm.triggerSessionSave) wm.triggerSessionSave();
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const startDrag = (e) => {
    const isAltResize = e.altKey || e.metaKey;

    if (isAltResize) {
      if (e.button !== 2) return;
    } else {
      if (e.button !== 0) return;
    }

    if (isInteractive(e.target)) return;

    wm.bringToFront(win);
    e.preventDefault();
    e.stopPropagation();

    if (isAltResize) {
      wm.isDraggingWindow = true;
      document.body.classList.add("is-resizing");

      const wasSnapped = !!win.dataset.snapZone;
      if (wasSnapped) wm._unsnap(win);

      const startX = e.clientX;
      const startY = e.clientY;
      const rect = win.getBoundingClientRect();
      const startWidth = rect.width;
      const startHeight = rect.height;
      const MIN_SIZE = 300;

      const onMouseMove = (e) => {
        const newWidth = Math.max(MIN_SIZE, startWidth + (e.clientX - startX));
        const newHeight = Math.max(MIN_SIZE, startHeight + (e.clientY - startY));
        win.style.width = `${newWidth}px`;
        win.style.height = `${newHeight}px`;

        const entry = wm.openWindows.get(win.id);
        if (entry?.record) {
          entry.record.setGeometry(rect.left, rect.top, newWidth, newHeight);
        }
      };

      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        wm.isDraggingWindow = false;
        document.body.classList.remove("is-resizing");
        if (wm.triggerSessionSave) wm.triggerSessionSave();
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
      return;
    }

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
      if (wm.triggerSessionSave) wm.triggerSessionSave();
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

  win.addEventListener("mousedown", startResize);
  win.addEventListener("contextmenu", (e) => {
    if (e.altKey || e.metaKey) {
      e.preventDefault();
      e.stopPropagation();
    }
  });
}

export function _getSnapZone(wm, x, y) {
  const margin = 20;
  const w = window.innerWidth;
  const h = window.innerHeight;

  const taskbar = document.getElementById("taskbar");
  let taskbarPosition = "bottom";
  let taskbarWidth = 0;
  let taskbarHeight = 0;

  if (taskbar) {
    taskbarPosition = taskbar.classList.contains("position-left")
      ? "left"
      : taskbar.classList.contains("position-right")
        ? "right"
        : taskbar.classList.contains("position-top")
          ? "top"
          : "bottom";

    if (taskbarPosition === "left" || taskbarPosition === "right") {
      taskbarWidth = taskbar.offsetWidth;
    } else {
      taskbarHeight = taskbar.offsetHeight;
    }
  } else {
    console.warn("Taskbar element not found for snap zone detection, using bottom position as fallback");
    taskbarHeight = 48;
  }

  let leftBoundary = margin;
  let rightBoundary = w - margin;
  let topBoundary = margin;
  let bottomBoundary = h - margin;

  if (taskbarPosition === "left") {
    leftBoundary = taskbarWidth + margin;
  } else if (taskbarPosition === "right") {
    rightBoundary = w - taskbarWidth - margin;
  } else if (taskbarPosition === "top") {
    topBoundary = taskbarHeight + margin;
  } else {
    bottomBoundary = h - taskbarHeight - margin;
  }

  if (y < topBoundary && x < leftBoundary) return "top-left";
  if (y < topBoundary && x > rightBoundary) return "top-right";
  if (y > bottomBoundary && x < leftBoundary) return "bottom-left";
  if (y > bottomBoundary && x > rightBoundary) return "bottom-right";

  if (y < topBoundary) return "maximize";
  if (x < leftBoundary) return "left";
  if (x > rightBoundary) return "right";

  return null;
}

export function _showSnapGhost(wm, zone) {
  let ghost = document.getElementById("snap-ghost");
  if (!ghost) {
    ghost = document.createElement("div");
    ghost.id = "snap-ghost";
    document.getElementById("desktop")?.appendChild(ghost) || document.body.appendChild(ghost);
  }
  ghost.style.display = "";
  ghost.className = `snap-ghost-${zone} snap-ghost-active`;
}

export function _hideSnapGhost(wm) {
  const ghost = document.getElementById("snap-ghost");
  if (ghost) {
    ghost.classList.remove("snap-ghost-active");
  }
}

export function _applySnap(wm, win, zone, skipSavePreSnap = false) {
  const entry = wm.openWindows.get(win.id);
  if (entry?.record) {
    if (!skipSavePreSnap) {
      entry.record.savePreSnapGeometry();
    }
    entry.record.snapZone = zone;
  }
  win.dataset.snapZone = zone;
  win.dataset.oldStyle = win.getAttribute("style");

  const taskbar = document.getElementById("taskbar");
  let taskbarPosition = "bottom";

  if (taskbar) {
    taskbarPosition = taskbar.classList.contains("position-left")
      ? "left"
      : taskbar.classList.contains("position-right")
        ? "right"
        : taskbar.classList.contains("position-top")
          ? "top"
          : "bottom";
  }

  const root = document.documentElement;
  const taskbarH = getComputedStyle(root).getPropertyValue("--taskbar-h").trim() || "3.2em";

  let availableWidth, availableHeight;

  if (taskbarPosition === "left" || taskbarPosition === "right") {
    availableWidth = `calc(100vw - ${taskbarH})`;
    availableHeight = "100vh";
  } else {
    availableWidth = "100vw";
    availableHeight = `calc(100vh - ${taskbarH})`;
  }

  const halfW = taskbarPosition === "left" || taskbarPosition === "right" ? `calc(50vw - ${taskbarH} / 2)` : "50vw";
  const halfH = taskbarPosition === "top" || taskbarPosition === "bottom" ? `calc(50vh - ${taskbarH} / 2)` : "50vh";

  if (zone === "maximize") {
    Object.assign(win.style, {
      top: "0",
      left: "0",
      width: availableWidth,
      height: availableHeight
    });
  } else if (zone === "left") {
    Object.assign(win.style, {
      top: "0",
      left: "0",
      width: halfW,
      height: availableHeight
    });
  } else if (zone === "right") {
    Object.assign(win.style, {
      top: "0",
      left: halfW,
      width: halfW,
      height: availableHeight
    });
  } else if (zone === "top-left") {
    Object.assign(win.style, {
      top: "0",
      left: "0",
      width: halfW,
      height: halfH
    });
  } else if (zone === "top-right") {
    Object.assign(win.style, {
      top: "0",
      left: halfW,
      width: halfW,
      height: halfH
    });
  } else if (zone === "bottom-left") {
    Object.assign(win.style, {
      top: halfH,
      left: "0",
      width: halfW,
      height: halfH
    });
  } else if (zone === "bottom-right") {
    Object.assign(win.style, {
      top: halfH,
      left: halfW,
      width: halfW,
      height: halfH
    });
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
