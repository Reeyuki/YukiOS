import { createElement } from "../shared/domUtils.js";

const TRANSITION_DURATION = 400;
let styleEl = null;
let timer = null;

export function animateThemeChange(changeFn) {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (styleEl) {
    styleEl.remove();
    styleEl = null;
  }

  styleEl = createElement("style");
  styleEl.id = "yukios-theme-transition";
  styleEl.textContent = `:root, .window, .window-header, .taskbar, .start-menu, .desktop,
.desktop-context-menu, .taskbar-preview, .dialog-box,
.dialog-overlay, .notification-toast, .context-menu,
.taskbar-item, .desktop-icon, .start-menu-item, .start-grid,
.settings-panel, .settings-sidebar {
      transition: background ${TRANSITION_DURATION}ms ease,
                  background-color ${TRANSITION_DURATION}ms ease,
                  color ${TRANSITION_DURATION}ms ease,
                  border-color ${TRANSITION_DURATION}ms ease,
                  box-shadow ${TRANSITION_DURATION}ms ease;
    }`;
  document.head.appendChild(styleEl);

  requestAnimationFrame(() => {
    changeFn();
  });

  timer = setTimeout(() => {
    if (styleEl) {
      styleEl.remove();
      styleEl = null;
    }
    timer = null;
  }, TRANSITION_DURATION + 50);
}
