import { makeDraggable } from "../shared/dragUtils.js";
import { StorageKeys, os, MODES } from "../framework.js";
import { $, $$, createElement } from "../shared/domUtils.js";
import { parseBool } from "../utils/utils.js";
import { wobbleStart, wobbleMove, wobbleEnd, wobbleCancel } from "./AnimationSystem.js";
import { updateMaximizeControls } from "./windowControls.js";
import { BusEvents } from "../core/EventBus.js";
const desktop = $("#desktop");

function getClientXY(e) {
  if (e.touches) {
    const t = e.touches[0] || e.changedTouches[0];
    return { clientX: t.clientX, clientY: t.clientY };
  }
  return { clientX: e.clientX, clientY: e.clientY };
}

export function windowMakeDraggable(win, wm) {
  let drag = null;

  const initDragState = (posX, posY) => {
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
    const rect = win.getBoundingClientRect();
    return {
      offsetX: posX - rect.left,
      offsetY: posY - rect.top,
      isFixed: getComputedStyle(win).position === "fixed",
      desktopRect: desktop.getBoundingClientRect(),
      grabX: posX,
      grabY: posY,
      lastClientX: posX,
      lastClientY: posY,
      unsnapPending: !!win.dataset.snapZone,
      tiling: !!win.dataset.tilingDrag,
      tilingHovered: null,
      snapBounds: getSnapBounds(),
      activeZone: null,
      newLeft: rect.left,
      newTop: rect.top
    };
  };

  const applyDragMove = (clientX, clientY) => {
    if (!drag) return;
    if (drag.unsnapPending) {
      drag.unsnapPending = false;
      wm.unsnap(win);
      const r = win.getBoundingClientRect();
      drag.offsetX = clientX - r.left;
      drag.offsetY = clientY - r.top;
      drag.grabX = clientX;
      drag.grabY = clientY;
      drag.lastClientX = clientX;
      drag.lastClientY = clientY;
    }

    let newLeft = clientX - drag.offsetX;
    let newTop = clientY - drag.offsetY;
    if (!drag.isFixed) {
      newLeft -= drag.desktopRect.left;
      newTop -= drag.desktopRect.top;
    }
    drag.newLeft = newLeft;
    drag.newTop = newTop;
    win.style.left = `${newLeft}px`;
    win.style.top = `${newTop}px`;

    const dxm = clientX - drag.lastClientX;
    const dym = clientY - drag.lastClientY;
    drag.lastClientX = clientX;
    drag.lastClientY = clientY;
    wobbleMove(win, dxm, dym);

    if (drag.tiling) {
      wm.hideSnapGhost();
      if (drag.tilingHovered) {
        drag.tilingHovered.classList.remove("tile-drop-hover");
        drag.tilingHovered = null;
      }
      const tiling = wm.tilingManager;
      const targetWinId = tiling?.getWindowAtCursor();
      if (targetWinId && targetWinId !== win.id) {
        const targetWin = $("#" + targetWinId);
        if (targetWin) {
          targetWin.classList.add("tile-drop-hover");
          drag.tilingHovered = targetWin;
        }
      }
    } else {
      const zone = getSnapZoneFromBounds(clientX, clientY, drag.snapBounds);
      drag.activeZone = zone;
      wm.activeSnapZone = zone;
      if (zone) wm.showSnapGhost(zone);
      else wm.hideSnapGhost();
    }
  };

  const endDrag = () => {
    if (!drag) return;
    wm.isDraggingWindow = false;
    document.body.classList.remove("is-dragging");
    win.classList.remove("dragging");
    win.style.left = `${drag.newLeft}px`;
    win.style.top = `${drag.newTop}px`;

    const entry = wm.openWindows.get(win.id);
    if (entry?.record) entry.record.setGeometry(drag.newLeft, drag.newTop);

    if (drag.tilingHovered) drag.tilingHovered.classList.remove("tile-drop-hover");
    wobbleEnd(win);

    if (drag.tiling) {
      const tiling = wm.tilingManager;
      if (tiling && tiling.enabled) {
        const targetWinId = tiling.getWindowAtCursor();
        if (targetWinId && targetWinId !== win.id) {
          tiling.swapWindowWithTarget(win.id, targetWinId);
        }
      }
    } else if (drag.activeZone) {
      wm.applySnap(win, drag.activeZone);
    }

    wm.activeSnapZone = null;
    wm.hideSnapGhost();
    if (wm.triggerSessionSave) wm.triggerSessionSave();
    drag = null;
  };

  const initHeader = (h) => {
    if (h.dataset.dragReady) return;
    h.dataset.dragReady = "true";

    makeDraggable(
      h,
      {
        start(e, posX, posY) {
          if (e.target instanceof SVGElement) {
            const btn = e.target.closest("button, a, input, select, textarea");
            if (btn) return;
          }

          wm.bringToFront(win);
          wm.isDraggingWindow = true;
          document.body.classList.add("is-dragging");

          const tilingDragTouched = wm.tilingManager;
          if (tilingDragTouched && tilingDragTouched.enabled && parseBool(win.dataset.tiled)) {
            win.dataset.tilingDrag = "true";
            wobbleStart(win);
          } else {
            wobbleStart(win);
          }

          drag = initDragState(posX, posY);
          win.classList.add("dragging");
        },

        move(e, dx, dy, clientX, clientY) {
          applyDragMove(clientX, clientY);
        },

        end() {
          endDrag();
        }
      },
      {
        ignoreFrom:
          "button, input, select, textarea, .browser-tab, .tab-close, .tab-new-btn, .steam-menu-item, .steam-user-profile, .steam-notifications, .app-menubar-item"
      }
    );

    h.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      wm.showWindowContextMenu(e, win);
    });
  };

  const isInteractive = (target) => {
    return !!target.closest(
      "button, input, select, textarea, .browser-tab, .tab-close, .tab-new-btn, .steam-menu-item, .steam-user-profile, .steam-notifications, .app-menubar-item"
    );
  };

  const isDesktopStretchScrollDisabled = () => {
    try {
      return os.storage.get(StorageKeys.disableDesktopStretchScroll) !== "false";
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
    if (wasSnapped) wm.unsnap(win);

    const { clientX: startX, clientY: startY } = getClientXY(e);
    const rect = win.getBoundingClientRect();
    const startWidth = rect.width;
    const startHeight = rect.height;
    const MIN_SIZE = 300;

    const onMouseMove = (e) => {
      const { clientX, clientY } = getClientXY(e);
      const newWidth = Math.max(MIN_SIZE, startWidth + (clientX - startX));
      const newHeight = Math.max(MIN_SIZE, startHeight + (clientY - startY));
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
      document.removeEventListener("touchmove", onMouseMove);
      document.removeEventListener("touchend", onMouseUp);
      document.removeEventListener("touchcancel", onMouseUp);
      wm.isDraggingWindow = false;
      document.body.classList.remove("is-resizing");
      if (wm.triggerSessionSave) wm.triggerSessionSave();
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("touchmove", onMouseMove, { passive: false });
    document.addEventListener("touchend", onMouseUp);
    document.addEventListener("touchcancel", onMouseUp);
  };

  const startAltDrag = (e) => {
    if (e.button !== 0) return;
    if (!e.altKey) return;
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

    if (wasSnapped) wm.unsnap(win);
    wobbleStart(win);

    const { clientX: startX, clientY: startY } = getClientXY(e);
    const rect = win.getBoundingClientRect();
    drag = {
      offsetX: startX - rect.left,
      offsetY: startY - rect.top,
      isFixed: getComputedStyle(win).position === "fixed",
      desktopRect: desktop.getBoundingClientRect(),
      grabX: startX,
      grabY: startY,
      lastClientX: startX,
      lastClientY: startY,
      unsnapPending: false,
      tiling: !!win.dataset.tilingDrag,
      tilingHovered: null,
      snapBounds: getSnapBounds(),
      activeZone: null,
      newLeft: rect.left,
      newTop: rect.top
    };
    win.classList.add("dragging");

    let pendingEvent = null;
    let rafId = null;
    const flush = () => {
      rafId = null;
      if (!pendingEvent) return;
      const ev = pendingEvent;
      pendingEvent = null;
      applyDragMove(ev.clientX, ev.clientY);
    };
    const onMove = (ev) => {
      pendingEvent = ev;
      if (rafId == null) rafId = requestAnimationFrame(flush);
    };
    const onUp = () => {
      if (rafId != null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (pendingEvent) {
        applyDragMove(pendingEvent.clientX, pendingEvent.clientY);
        pendingEvent = null;
      }
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onUp);
      document.removeEventListener("touchcancel", onUp);
      endDrag();
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onUp);
    document.addEventListener("touchcancel", onUp);
  };

  const existing = win.querySelectorAll(".window-header, .browser-tabbar, .app-menubar");
  existing.forEach(initHeader);

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.addedNodes.length) {
        win.querySelectorAll(".app-menubar").forEach(initHeader);
        break;
      }
    }
  });
  observer.observe(win, { childList: true, subtree: true });

  win.addEventListener("mousedown", startResize);
  win.addEventListener("touchstart", startResize, { passive: false });
  win.addEventListener("mousedown", startAltDrag);
  win.addEventListener("touchstart", startAltDrag, { passive: false });
  win.addEventListener("contextmenu", (e) => {
    if (e.altKey || e.metaKey) {
      e.preventDefault();
      e.stopPropagation();
    }
  });
  win.addEventListener("remove", () => observer.disconnect());
}

export function getSnapBounds() {
  const margin = 20;
  const w = window.innerWidth;
  const h = window.innerHeight;

  const taskbar = $("#taskbar");
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

  return { leftBoundary, rightBoundary, topBoundary, bottomBoundary };
}

export function getSnapZoneFromBounds(x, y, bounds) {
  if (y < bounds.topBoundary && x < bounds.leftBoundary) return "top-left";
  if (y < bounds.topBoundary && x > bounds.rightBoundary) return "top-right";
  if (y > bounds.bottomBoundary && x < bounds.leftBoundary) return "bottom-left";
  if (y > bounds.bottomBoundary && x > bounds.rightBoundary) return "bottom-right";

  if (y < bounds.topBoundary) return "maximize";
  if (x < bounds.leftBoundary) return "left";
  if (x > bounds.rightBoundary) return "right";

  return null;
}

export function getSnapZone(wm, x, y) {
  return getSnapZoneFromBounds(x, y, getSnapBounds());
}

export function showSnapGhost(wm, zone) {
  let ghost = $("#snap-ghost");
  if (!ghost) {
    ghost = createElement("div");
    ghost.id = "snap-ghost";
    $("#desktop")?.appendChild(ghost) || document.body.appendChild(ghost);
  }
  ghost.style.display = "";
  ghost.className = `snap-ghost-${zone} snap-ghost-active`;
}

export function hideSnapGhost(wm) {
  const ghost = $("#snap-ghost");
  if (ghost) {
    ghost.classList.remove("snap-ghost-active");
  }
}

export function applySnap(wm, win, zone, skipSavePreSnap = false) {
  const entry = wm.openWindows.get(win.id);
  if (entry?.record) {
    if (!skipSavePreSnap) {
      entry.record.savePreSnapGeometry();
    }
    entry.record.snapZone = zone;
  }
  win.dataset.snapZone = zone;
  win.dataset.oldStyle = win.getAttribute("style");
  updateMaximizeControls(win);

  const taskbar = $("#taskbar");
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
  const taskbarH = taskbar
    ? `${taskbar.getBoundingClientRect().height}px`
    : getComputedStyle(root).getPropertyValue("--taskbar-h").trim() || "3.2em";

  let tilingBarH = "0px";
  let tilingBarTop = "0px";
  const tilingBar = $("#tiling-bar");
  if (tilingBar && tilingBar.style.display !== "none" && os.modes.isActive(MODES.TILING)) {
    tilingBarH = getComputedStyle(tilingBar).height || "38px";
    tilingBarTop = tilingBar.classList.contains("position-bottom") ? "0px" : tilingBarH;
  }

  const topOffset = taskbarPosition === "top" ? `calc(${taskbarH} + ${tilingBarTop})` : tilingBarTop;

  let availableWidth, availableHeight;

  if (taskbarPosition === "left" || taskbarPosition === "right") {
    availableWidth = `calc(100vw - ${taskbarH})`;
    availableHeight = "100vh";
  } else {
    availableWidth = "100vw";
    availableHeight = `calc(100vh - ${taskbarH} - ${tilingBarH})`;
  }

  const halfW = taskbarPosition === "left" || taskbarPosition === "right" ? `calc(50vw - ${taskbarH} / 2)` : "50vw";
  const halfH = taskbarPosition === "top" || taskbarPosition === "bottom" ? `calc(50vh - ${taskbarH} / 2)` : "50vh";

  if (zone === "maximize") {
    Object.assign(win.style, {
      top: topOffset,
      left: "0",
      width: availableWidth,
      height: availableHeight
    });
  } else if (zone === "left") {
    Object.assign(win.style, {
      top: topOffset,
      left: "0",
      width: halfW,
      height: availableHeight
    });
  } else if (zone === "right") {
    Object.assign(win.style, {
      top: topOffset,
      left: halfW,
      width: halfW,
      height: availableHeight
    });
  } else if (zone === "top-left") {
    Object.assign(win.style, {
      top: topOffset,
      left: "0",
      width: halfW,
      height: halfH
    });
  } else if (zone === "top-right") {
    Object.assign(win.style, {
      top: topOffset,
      left: halfW,
      width: halfW,
      height: halfH
    });
  } else if (zone === "bottom-left") {
    Object.assign(win.style, {
      top: `calc(${topOffset} + ${halfH})`,
      left: "0",
      width: halfW,
      height: halfH
    });
  } else if (zone === "bottom-right") {
    Object.assign(win.style, {
      top: `calc(${topOffset} + ${halfH})`,
      left: halfW,
      width: halfW,
      height: halfH
    });
  }
  os.events.emit(BusEvents.WINDOW_SNAPPED);
}

export function unsnap(wm, win) {
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
  updateMaximizeControls(win);
}
