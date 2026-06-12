import { getSetting } from "../shared/settingsUtils.js";

const styleEl = document.getElementById("window-style");
const styleParent = styleEl?.parentNode;

export function hideTransparency() {
  if (styleEl?.parentNode) styleParent.removeChild(styleEl);
}

export function restoreTransparency() {
  if (styleEl && !styleEl.parentNode && styleParent) styleParent.appendChild(styleEl);
}

export function updateTransparency(wm) {
  const transparencyEnabled = getSetting("transparency", true) !== false;
  if (wm.gameWindowCount > 0 || !transparencyEnabled) {
    hideTransparency();
  } else {
    restoreTransparency();
  }
}
