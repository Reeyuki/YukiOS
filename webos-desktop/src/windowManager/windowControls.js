import { os } from "../framework.js";

export function updateMaximizeControls(win) {
  const maxBtn = win.querySelector(".maximize-btn");
  if (!maxBtn) return;
  const isMaximized = win.dataset.snapZone === "maximize";
  const maximizeGlyph = maxBtn.querySelector(".maximize-glyph");
  const restoreGlyph = maxBtn.querySelector(".restore-glyph");
  if (maximizeGlyph) maximizeGlyph.style.display = isMaximized ? "none" : "";
  if (restoreGlyph) restoreGlyph.style.display = isMaximized ? "" : "none";
  maxBtn.title = isMaximized ? "Restore" : "Maximize";
}

export function setupWindowControls(win, wm) {
  const closeBtn = win.querySelector(".close-btn");
  const maxBtn = win.querySelector(".maximize-btn");
  const minBtn = win.querySelector(".minimize-btn");
  const downloadBtn = win.querySelector(".download-btn");

  updateMaximizeControls(win);

  win.addEventListener("transitionend", (e) => {
    if (
      e.propertyName === "width" ||
      e.propertyName === "height" ||
      e.propertyName === "top" ||
      e.propertyName === "left"
    ) {
      win.classList.remove("snapping");
    }
  });

  if (closeBtn) {
    closeBtn.onclick = () => wm.closeWindow(win);
  }

  const header = win.querySelector(".window-header");
  if (header) {
    const isIcon = (target) => !target.closest(".window-controls") && target.matches("img, i, svg, .window-icon");
    const isHeader = (target) => header.contains(target) && !target.closest(".window-controls") && !isIcon(target);
    let lastPressTime = 0;
    const handleDoublePress = (target) => {
      const now = performance.now();
      const isDouble = now - lastPressTime <= 500;
      lastPressTime = isDouble ? 0 : now;
      if (!isDouble) return;
      if (isIcon(target)) {
        wm.closeWindow(win);
      } else if (isHeader(target)) {
        const wasMaximized = win.dataset.snapZone === "maximize";
        setTimeout(() => {
          win.classList.add("snapping");
          if (wasMaximized) {
            wm.unsnap(win);
          } else {
            wm.applySnap(win, "maximize");
          }
        }, 0);
      }
    };
    header.addEventListener("mousedown", (e) => handleDoublePress(e.target));
  }

  if (maxBtn) {
    maxBtn.onclick = () => {
      if (win.dataset.snapZone === "maximize") {
        win.classList.add("snapping");
        wm.unsnap(win);
      } else {
        win.classList.add("snapping");
        wm.applySnap(win, "maximize");
      }
    };
  }

  if (minBtn) {
    minBtn.onclick = () => wm.minimizeWindow(win);
  }

  if (downloadBtn) {
    downloadBtn.onclick = () => wm.downloadWindowContent(win);
  }

  const externalBtn = win.querySelector(".external-btn");
  if (externalBtn) {
    externalBtn.onclick = () => {
      const url = win.dataset.externalUrl || "";
      if (url) window.open(url, "blank", "noopener,noreferrer");
    };
  }
}
