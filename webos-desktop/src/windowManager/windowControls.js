import { os } from "../framework.js";

function closeWindow(win, wm) {
  if (os.tray.isRegistered(win.id)) {
    os.tray.sendToTray(win.id);
    return;
  }
  wm.silenceWindow(win);
  wm.removeFromTaskbar(win.id);
  if (win.dataset.isGame === "true") {
    wm.gameWindowCount = Math.max(0, wm.gameWindowCount - 1);
  }
  wm.updateTransparency();
  wm.animateAndRemove(win);
}

export function setupWindowControls(win, wm) {
  const closeBtn = win.querySelector(".close-btn");
  const maxBtn = win.querySelector(".maximize-btn");
  const minBtn = win.querySelector(".minimize-btn");
  const downloadBtn = win.querySelector(".download-btn");

  win.addEventListener("transitionend", (e) => {
    if (e.propertyName === "width" || e.propertyName === "height" || e.propertyName === "top" || e.propertyName === "left") {
      win.classList.remove("snapping");
    }
  });

  if (closeBtn) {
    closeBtn.onclick = () => closeWindow(win, wm);
  }

  const header = win.querySelector(".window-header");
  if (header) {
    header.addEventListener("dblclick", (e) => {
      if (e.target.closest(".window-controls")) return;
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
        wm.toggleFullscreen(win);
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
