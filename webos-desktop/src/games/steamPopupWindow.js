import { $ } from "../shared/domUtils.js";

const DRAG_BAND_HEIGHT = 44;
const INTERACTIVE_SELECTOR =
  "button, input, select, textarea, a, .window-controls, .steam-settings-window-controls";
const TEXT_FIELD_SELECTOR = "input, textarea, select, [contenteditable='true']";

function forwardBandDrag(win, e) {
  if (e.target.closest(".steam-popup-header")) return;
  if (e.target.closest(INTERACTIVE_SELECTOR)) return;
  const rect = win.getBoundingClientRect();
  const y = e.touches ? e.touches[0].clientY : e.clientY;
  if (y < rect.top || y > rect.top + DRAG_BAND_HEIGHT) return;
  const strip = $(".steam-popup-header", win);
  if (!strip) return;
  const x = e.touches ? e.touches[0].clientX : e.clientX;
  strip.dispatchEvent(
    new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      button: 0
    })
  );
}

export function initSteamPopupWindow(win) {
  win.addEventListener("contextmenu", (e) => {
    if (e.defaultPrevented) return;
    if (e.target.closest(TEXT_FIELD_SELECTOR)) return;
    e.preventDefault();
  });

  win.addEventListener("mousedown", (e) => forwardBandDrag(win, e));
  win.addEventListener("touchstart", (e) => forwardBandDrag(win, e), { passive: false });
}
