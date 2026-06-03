import { os } from "../os/index.js";

export function setupWindowControls(win, wm) {
  const closeBtn = win.querySelector(".close-btn");
  const maxBtn = win.querySelector(".maximize-btn");
  const minBtn = win.querySelector(".minimize-btn");
  const downloadBtn = win.querySelector(".download-btn");

  if (closeBtn) {
    closeBtn.onclick = () => {
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
    };
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
}
