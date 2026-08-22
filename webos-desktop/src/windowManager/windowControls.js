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
    header.addEventListener("dblclick", (e) => {
      if (e.target.closest(".window-controls")) return;
      const icon = header.querySelector("span > img, span > i, span > svg");
      if (icon && (e.target === icon || icon.contains(e.target))) {
        wm.closeWindow(win);
        return;
      }
      win.classList.add("snapping");
      if (win.dataset.snapZone === "maximize") {
        wm.unsnap(win);
      } else {
        wm.applySnap(win, "maximize");
      }
    });
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
