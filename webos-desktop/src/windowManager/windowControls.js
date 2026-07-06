import { os } from "../os/index.js";

function closeWindow(win, wm) {
  if (os.tray.isRegistered(win.id)) {
    os.tray.sendToTray(win.id);
    return;
  }
  wm._silenceWindow(win);
  wm.removeFromTaskbar(win.id);
  if (win.dataset.isGame === "true") {
    wm.gameWindowCount = Math.max(0, wm.gameWindowCount - 1);
  }
  wm.updateTransparency();
  wm._animateAndRemove(win);
}

export function setupWindowControls(win, wm) {
  const closeBtn = win.querySelector(".close-btn");
  const maxBtn = win.querySelector(".maximize-btn");
  const minBtn = win.querySelector(".minimize-btn");
  const downloadBtn = win.querySelector(".download-btn");

  if (closeBtn) {
    closeBtn.onclick = () => closeWindow(win, wm);
  }

  const headerSpan = win.querySelector(".window-header > span");
  if (headerSpan) {
    headerSpan.addEventListener("dblclick", (e) => {
      if (e.target === e.currentTarget) return;
      closeWindow(win, wm);
    });
  }

  if (maxBtn) {
    maxBtn.onclick = () => {
      if (win.dataset.snapZone === "maximize") {
        wm.toggleFullscreen(win);
      } else {
        wm._applySnap(win, "maximize");
      }
    };
  }

  if (minBtn) {
    minBtn.onclick = () => wm.minimizeWindow(win);
  }

  if (downloadBtn) {
    downloadBtn.onclick = () => wm._downloadWindowContent(win);
  }

  const externalBtn = win.querySelector(".external-btn");
  if (externalBtn) {
    externalBtn.onclick = () => {
      const url = win.dataset.externalUrl || "";
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    };
  }
}
