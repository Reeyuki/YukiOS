import { makeResizable } from "../shared/dragUtils.js";
import { StorageKeys, os, MODES } from "../framework.js";
import { $ } from "../shared/domUtils.js";

function isMagnetEnabledResizable() {
  try {
    const v = os.storage.get(StorageKeys.windowMagnetEnabled);
    return v !== "false" && v !== false;
  } catch {
    return true;
  }
}

function getMagnetThresholdResizable() {
  try {
    const raw = os.storage.get(StorageKeys.windowMagnetThreshold);
    const n = parseInt(raw, 10);
    if (!Number.isNaN(n)) return Math.max(4, Math.min(40, n));
  } catch {}
  return 10;
}

function getTilingBarInsetResizable() {
  try {
    const bar = $("#tiling-bar");
    if (!bar || bar.style.display === "none" || !os.modes.isActive(MODES.TILING)) return { top: 0, bottom: 0 };
    const h = bar.getBoundingClientRect().height || parseInt(getComputedStyle(bar).height, 10) || 0;
    if (!h) return { top: 0, bottom: 0 };
    const isBottom = bar.classList.contains("position-bottom");
    return isBottom ? { top: 0, bottom: h } : { top: h, bottom: 0 };
  } catch {
    return { top: 0, bottom: 0 };
  }
}

export function windowMakeResizable(win, wm, setHeightUnsetElement = null) {
  const id = ((win.dataset.appId || "") + " " + (win.id || "")).toLowerCase();
  let minW = 300;
  let minH = 300;
  if (id.includes("calculator")) {
    minW = 280;
    minH = 340;
  } else if (id.includes("explorer")) {
    minW = 560;
    minH = 380;
  }
  makeResizable(
    win,
    {
      start() {
        wm.isDraggingWindow = true;
        document.body.classList.add("is-resizing");
      },
      move(e, rect, activeEdges) {
        if (isMagnetEnabledResizable() && !win.dataset.tilingDrag && activeEdges) {
          const threshold = getMagnetThresholdResizable();
          const taskbar = $("#taskbar");
          let taskbarPos = "bottom";
          let taskbarRect = null;
          if (taskbar) {
            const tr = taskbar.getBoundingClientRect();
            taskbarRect = tr;
            taskbarPos = taskbar.classList.contains("position-left")
              ? "left"
              : taskbar.classList.contains("position-right")
                ? "right"
                : taskbar.classList.contains("position-top")
                  ? "top"
                  : "bottom";
          }
          const tilingInset = getTilingBarInsetResizable();
          const screenLeft = 0;
          const screenRight = window.innerWidth;
          const screenTop = tilingInset.top;
          const screenBottom = window.innerHeight - tilingInset.bottom;
          let magnetized = false;

          if (activeEdges.left) {
            let snapLeft = null;
            if (taskbarPos === "left" && taskbarRect) snapLeft = taskbarRect.right;
            else if (taskbarPos !== "left") snapLeft = screenLeft;
            if (snapLeft !== null && Math.abs(rect.left - snapLeft) <= threshold) {
              const newLeft = snapLeft;
              const right = rect.left + rect.width;
              const newWidth = right - newLeft;
              if (newWidth >= minW) {
                rect.left = newLeft;
                rect.width = newWidth;
                magnetized = true;
              }
            }
          }
          if (activeEdges.right) {
            let snapRight = null;
            if (taskbarPos === "right" && taskbarRect) snapRight = taskbarRect.left;
            else if (taskbarPos !== "right") snapRight = screenRight;
            if (snapRight !== null) {
              const curRight = rect.left + rect.width;
              if (Math.abs(curRight - snapRight) <= threshold) {
                const newWidth = snapRight - rect.left;
                if (newWidth >= minW) {
                  rect.width = newWidth;
                  magnetized = true;
                }
              }
            }
          }
          if (activeEdges.top) {
            let snapTop = null;
            if (taskbarPos === "top" && taskbarRect) snapTop = taskbarRect.bottom;
            else if (taskbarPos !== "top") snapTop = screenTop;
            if (snapTop !== null && Math.abs(rect.top - snapTop) <= threshold) {
              const newTop = snapTop;
              const bottom = rect.top + rect.height;
              const newHeight = bottom - newTop;
              if (newHeight >= minH) {
                rect.top = newTop;
                rect.height = newHeight;
                magnetized = true;
              }
            }
          }
          if (activeEdges.bottom) {
            let snapBottom = null;
            if (taskbarPos === "bottom" && taskbarRect) snapBottom = taskbarRect.top;
            else if (taskbarPos !== "bottom") snapBottom = screenBottom;
            if (snapBottom !== null) {
              const curBottom = rect.top + rect.height;
              if (Math.abs(curBottom - snapBottom) <= threshold) {
                const newHeight = snapBottom - rect.top;
                if (newHeight >= minH) {
                  rect.height = newHeight;
                  magnetized = true;
                }
              }
            }
          }
          win.classList.toggle("magnetized", magnetized);
        } else {
          win.classList.remove("magnetized");
        }
        win.style.width = `${rect.width}px`;
        win.style.height = `${rect.height}px`;
        win.style.top = `${rect.top}px`;
        win.style.left = `${rect.left}px`;

        const entry = wm.openWindows.get(win.id);
        if (entry?.record) {
          entry.record.setGeometry(rect.left, rect.top, rect.width, rect.height);
        }
        if (setHeightUnsetElement?.style) {
          setHeightUnsetElement.style.height = "unset";
        }
      },
      end() {
        wm.isDraggingWindow = false;
        document.body.classList.remove("is-resizing");
        win.classList.remove("magnetized");
        if (wm.triggerSessionSave) wm.triggerSessionSave();
      }
    },
    { minWidth: minW, minHeight: minH }
  );
}
