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

  styleEl = document.createElement("style");
  styleEl.id = "yukios-theme-transition";
  styleEl.textContent = `:root * {
      transition: background ${TRANSITION_DURATION}ms ease,
                  background-color ${TRANSITION_DURATION}ms ease,
                  color ${TRANSITION_DURATION}ms ease,
                  border-color ${TRANSITION_DURATION}ms ease,
                  box-shadow ${TRANSITION_DURATION}ms ease !important;
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
