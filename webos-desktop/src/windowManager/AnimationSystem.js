import { StorageKeys } from "../settings.js";

export const OPEN_ANIMATIONS = {
  fade: "fade",
  scaleCenter: "scaleCenter",
  scaleFromSource: "scaleFromSource",
  slideUp: "slideUp",
  slideLeft: "slideLeft",
  slideRight: "slideRight",
  instant: "instant",
  glassBlurin: "glassBlurin"
};

export const CLOSE_ANIMATIONS = {
  scaleDownCenter: "scaleDownCenter",
  scaleToOrigin: "scaleToOrigin",
  fadeOut: "fadeOut",
  slideDown: "slideDown",
  burn: "burn",
  instant: "instant"
};

export const MINIMIZE_ANIMATIONS = {
  taskbarShrink: "taskbarShrink",
  dockZoomShrink: "dockZoomShrink",
  magicLamp: "magicLamp",
  fadeToTaskbar: "fadeToTaskbar",
  instant: "instant"
};

function getSetting(key, fallback) {
  return localStorage.getItem(key) ?? fallback;
}

function getOpenAnim() {
  return getSetting(StorageKeys.windowOpenAnimation, OPEN_ANIMATIONS.scaleCenter);
}

function getCloseAnim() {
  return getSetting(StorageKeys.windowCloseAnimation, CLOSE_ANIMATIONS.scaleDownCenter);
}

function getMinimizeAnim() {
  return getSetting(StorageKeys.windowMinimizeAnimation, MINIMIZE_ANIMATIONS.taskbarShrink);
}

function getAnimationSpeed() {
  const speed = getSetting(StorageKeys.windowAnimationSpeed, "normal");
  switch (speed) {
    case "slow":
      return 2.0;
    case "fast":
      return 0.65;
    case "very_fast":
      return 0.35;
    case "normal":
    default:
      return 1.0;
  }
}

function isClickBubbleEnabled() {
  return getSetting(StorageKeys.clickBubbleFeedback, "false") === "true";
}

function isPerformanceMode() {
  const mode = getSetting(StorageKeys.performanceMode, "high");
  return mode === "performance";
}

export function getTaskbarIconRect(winId) {
  const taskbarItem = document.getElementById(`taskbar-${winId}`);
  if (!taskbarItem) return null;
  return taskbarItem.getBoundingClientRect();
}

export function animateWindowOpen(win) {
  if (isPerformanceMode()) return;
  const anim = getOpenAnim();
  if (anim === OPEN_ANIMATIONS.instant) return;

  win.classList.remove("wa-focus-glow");
  win.style.animation = "none";
  win.style.opacity = "";
  win.style.transform = "";
  win.style.filter = "";
  void win.offsetWidth;

  switch (anim) {
    case OPEN_ANIMATIONS.fade:
      _applyKeyframes(win, "wa-fade-in", 0.22);
      break;
    case OPEN_ANIMATIONS.scaleCenter:
      _applyKeyframes(win, "wa-scale-in", 0.3);
      break;
    case OPEN_ANIMATIONS.scaleFromSource:
      _animateOpenFromTaskbar(win);
      break;
    case OPEN_ANIMATIONS.slideUp:
      _applyKeyframes(win, "wa-slide-up-in", 0.3);
      break;
    case OPEN_ANIMATIONS.slideLeft:
      _applyKeyframes(win, "wa-slide-left-in", 0.28);
      break;
    case OPEN_ANIMATIONS.slideRight:
      _applyKeyframes(win, "wa-slide-right-in", 0.28);
      break;
    case OPEN_ANIMATIONS.glassBlurin:
      _applyKeyframes(win, "wa-glass-blur-in", 0.35);
      break;
    default:
      break;
  }
}

export function animateWindowClose(win, onDone) {
  if (isPerformanceMode()) {
    onDone?.();
    return;
  }
  const anim = getCloseAnim();
  win.style.pointerEvents = "none";

  switch (anim) {
    case CLOSE_ANIMATIONS.scaleDownCenter:
      _applyKeyframes(win, "wa-scale-out", 0.22, onDone);
      break;
    case CLOSE_ANIMATIONS.scaleToOrigin:
      _animateCloseToTaskbar(win, onDone);
      break;
    case CLOSE_ANIMATIONS.fadeOut:
      _applyKeyframes(win, "wa-fade-out", 0.2, onDone);
      break;
    case CLOSE_ANIMATIONS.slideDown:
      _applyKeyframes(win, "wa-slide-down-out", 0.28, onDone);
      break;
    case CLOSE_ANIMATIONS.burn:
      _applyKeyframes(win, "wa-burn-out", 0.65, onDone);
      break;
    case CLOSE_ANIMATIONS.instant:
    default:
      onDone?.();
      break;
  }
}

export function animateWindowMinimize(win, onDone) {
  if (isPerformanceMode()) {
    onDone?.();
    return;
  }
  const anim = getMinimizeAnim();
  win.style.pointerEvents = "none";

  switch (anim) {
    case MINIMIZE_ANIMATIONS.taskbarShrink:
      _animateMinimizeToTaskbar(win, onDone);
      break;
    case MINIMIZE_ANIMATIONS.dockZoomShrink:
      _animateDockZoomShrink(win, onDone);
      break;
    case MINIMIZE_ANIMATIONS.magicLamp:
      _animateMagicLamp(win, onDone);
      break;
    case MINIMIZE_ANIMATIONS.fadeToTaskbar:
      _applyKeyframes(win, "wa-fade-out", 0.22, onDone);
      break;
    case MINIMIZE_ANIMATIONS.instant:
    default:
      onDone?.();
      break;
  }
}

function _applyKeyframes(win, name, baseDuration, onDone = null) {
  const duration = baseDuration * getAnimationSpeed();
  win.style.animation = `${name} ${duration}s cubic-bezier(0.22,1,0.36,1) forwards`;
  const tid = setTimeout(
    () => {
      win.style.animation = "";
      onDone?.();
    },
    duration * 1000 + 16
  );
  if (onDone) win._animTid = tid;
}

function _animateOpenFromTaskbar(win) {
  const taskbarItem = document.getElementById(`taskbar-${win.id}`);
  if (!taskbarItem) {
    _applyKeyframes(win, "wa-scale-in", 0.3);
    return;
  }
  const tbRect = taskbarItem.getBoundingClientRect();
  const winRect = win.getBoundingClientRect();
  const dx = tbRect.left + tbRect.width / 2 - (winRect.left + winRect.width / 2);
  const dy = tbRect.top + tbRect.height / 2 - (winRect.top + winRect.height / 2);
  win.style.transformOrigin = "center center";
  win.style.setProperty("--wa-ox", `${dx}px`);
  win.style.setProperty("--wa-oy", `${dy}px`);
  _applyKeyframes(win, "wa-source-in", 0.35);
}

function _animateCloseToTaskbar(win, onDone) {
  const taskbarItem = document.getElementById(`taskbar-${win.id}`);
  if (!taskbarItem) {
    _applyKeyframes(win, "wa-scale-out", 0.22, onDone);
    return;
  }
  const tbRect = taskbarItem.getBoundingClientRect();
  const winRect = win.getBoundingClientRect();
  const dx = tbRect.left + tbRect.width / 2 - (winRect.left + winRect.width / 2);
  const dy = tbRect.top + tbRect.height / 2 - (winRect.top + winRect.height / 2);
  win.style.transformOrigin = "center center";
  win.style.setProperty("--wa-ox", `${dx}px`);
  win.style.setProperty("--wa-oy", `${dy}px`);
  _applyKeyframes(win, "wa-source-out", 0.3, onDone);
}

function _animateMinimizeToTaskbar(win, onDone) {
  const taskbarItem = document.getElementById(`taskbar-${win.id}`);
  if (!taskbarItem) {
    _applyKeyframes(win, "wa-fade-out", 0.22, onDone);
    return;
  }
  const tbRect = taskbarItem.getBoundingClientRect();
  const winRect = win.getBoundingClientRect();
  const dx = tbRect.left + tbRect.width / 2 - (winRect.left + winRect.width / 2);
  const dy = tbRect.top + tbRect.height / 2 - (winRect.top + winRect.height / 2);
  win.style.transformOrigin = "center center";
  win.style.setProperty("--wa-ox", `${dx}px`);
  win.style.setProperty("--wa-oy", `${dy}px`);
  _applyKeyframes(win, "wa-source-out", 0.3, onDone);
}

function _animateDockZoomShrink(win, onDone) {
  const taskbarItem = document.getElementById(`taskbar-${win.id}`);
  if (!taskbarItem) {
    _applyKeyframes(win, "wa-scale-out", 0.3, onDone);
    return;
  }
  const tbRect = taskbarItem.getBoundingClientRect();
  const winRect = win.getBoundingClientRect();
  const taskbar = document.getElementById("taskbar");
  const isBottom = !taskbar || taskbar.classList.contains("position-bottom");
  const dy = isBottom ? tbRect.top - (winRect.top + winRect.height / 2) : tbRect.bottom - winRect.top;
  win.style.setProperty("--wa-oy", `${dy}px`);
  win.style.transformOrigin = "center center";
  _applyKeyframes(win, "wa-dock-zoom-out", 0.32, onDone);
}

function _animateMagicLamp(win, onDone) {
  const taskbarItem = document.getElementById(`taskbar-${win.id}`);
  if (!taskbarItem) {
    _applyKeyframes(win, "wa-slide-down-out", 0.4, onDone);
    return;
  }
  const tbRect = taskbarItem.getBoundingClientRect();
  const winRect = win.getBoundingClientRect();
  const dx = tbRect.left + tbRect.width / 2 - (winRect.left + winRect.width / 2);
  const dy = tbRect.top + tbRect.height / 2 - (winRect.top + winRect.height / 2);
  win.style.setProperty("--wa-ox", `${dx}px`);
  win.style.setProperty("--wa-oy", `${dy}px`);
  win.style.transformOrigin = "center center";
  _applyKeyframes(win, "wa-magic-lamp", 0.5, onDone);
}

export function initFocusEffects(wm) {
  if (isPerformanceMode()) return;
}

export function applyFocusGlow(win) {
  if (isPerformanceMode()) return;
  win.classList.add("wa-focus-glow");
  const tid = setTimeout(() => win.classList.remove("wa-focus-glow"), 600);
  win._focusTid = tid;
}

export function applyZDepthLift(win, active) {
  if (active) {
    win.classList.add("wa-z-lift");
  } else {
    win.classList.remove("wa-z-lift");
  }
}

export function applyBackgroundDim(allWins, focusedWin) {
  if (isPerformanceMode()) return;
  allWins.forEach((w) => {
    if (w === focusedWin) {
      w.classList.remove("wa-dimmed");
      w.classList.add("wa-spotlight");
    } else {
      w.classList.add("wa-dimmed");
      w.classList.remove("wa-spotlight");
    }
  });
}

export function clearFocusEffects(allWins) {
  allWins.forEach((w) => {
    w.classList.remove("wa-dimmed", "wa-spotlight", "wa-z-lift", "wa-focus-glow");
  });
}

export function initWobblyDrag(win, wm) {
  if (isPerformanceMode()) return;
}

export function applyWobblyDragStart(win) {
  if (isPerformanceMode()) return;
  win.classList.add("wa-wobble-drag");
}

export function applyWobblyDragEnd(win) {
  win.classList.remove("wa-wobble-drag");
  win.classList.add("wa-wobble-settle");
  setTimeout(() => win.classList.remove("wa-wobble-settle"), 500);
}

export function applyPhysicsInertia(win, vx, vy) {
  if (isPerformanceMode()) return;
  const decayMs = 400;
  const startTime = performance.now();
  let lastX = parseFloat(win.style.left) || 0;
  let lastY = parseFloat(win.style.top) || 0;

  const tick = (now) => {
    const t = Math.min(1, (now - startTime) / decayMs);
    const ease = 1 - t * t;
    if (ease < 0.01) return;
    const newX = lastX + vx * ease * 0.016;
    const newY = lastY + vy * ease * 0.016;
    win.style.left = `${newX}px`;
    win.style.top = `${newY}px`;
    lastX = newX;
    lastY = newY;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export function initClickBubble() {
  if (!isClickBubbleEnabled()) return;
  document.addEventListener("pointerdown", _handleClickBubble, { passive: true });
}

export function destroyClickBubble() {
  document.removeEventListener("pointerdown", _handleClickBubble);
}

function _handleClickBubble(e) {
  if (!isClickBubbleEnabled()) return;
  const ripple = document.createElement("div");
  ripple.className = "wa-ripple";
  ripple.style.left = `${e.clientX}px`;
  ripple.style.top = `${e.clientY}px`;
  document.body.appendChild(ripple);
  ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
}

export function animateStartMenuOpen(el) {
  if (isPerformanceMode()) return;
  el.style.animation = "none";
  void el.offsetWidth;
  el.style.animation = "wa-start-expand 0.2s cubic-bezier(0.16,1,0.3,1) forwards";
}

export function animateStartMenuClose(el) {
  if (isPerformanceMode()) return;
  el.style.animation = "wa-start-collapse 0.15s ease-in forwards";
}

export function animateContextMenuPop(el) {
  if (isPerformanceMode()) return;
  el.style.animation = "none";
  void el.offsetWidth;
  el.style.animation = "wa-ctx-pop 0.12s cubic-bezier(0.16,1,0.3,1) forwards";
}

export function animateNotificationIn(el) {
  if (isPerformanceMode()) return;
  el.style.animation = "wa-notif-in 0.25s cubic-bezier(0.16,1,0.3,1) forwards";
}

export function animateWorkspaceSlide(direction, onDone) {
  if (isPerformanceMode()) {
    onDone?.();
    return;
  }
  const desktop = document.getElementById("desktop");
  if (!desktop) {
    onDone?.();
    return;
  }
  const cls = direction === "left" ? "wa-ws-slide-left" : "wa-ws-slide-right";
  desktop.classList.add(cls);
  setTimeout(() => {
    desktop.classList.remove(cls);
    onDone?.();
  }, 350);
}

export function animateScreenFreezeBlur(onDone) {
  if (isPerformanceMode()) {
    onDone?.();
    return;
  }
  const overlay = document.createElement("div");
  overlay.className = "wa-freeze-overlay";
  document.body.appendChild(overlay);
  setTimeout(() => {
    overlay.classList.add("wa-freeze-resolve");
    setTimeout(() => {
      overlay.remove();
      onDone?.();
    }, 250);
  }, 80);
}

export function getAnimationSettings() {
  return {
    openAnimation: getOpenAnim(),
    closeAnimation: getCloseAnim(),
    minimizeAnimation: getMinimizeAnim(),
    animationSpeed: getSetting(StorageKeys.windowAnimationSpeed, "normal"),
    clickBubble: isClickBubbleEnabled()
  };
}

export function applyAnimationSettings(settings) {
  if (settings.openAnimation) localStorage.setItem(StorageKeys.windowOpenAnimation, settings.openAnimation);
  if (settings.closeAnimation) localStorage.setItem(StorageKeys.windowCloseAnimation, settings.closeAnimation);
  if (settings.minimizeAnimation) localStorage.setItem(StorageKeys.windowMinimizeAnimation, settings.minimizeAnimation);
  if (settings.animationSpeed) localStorage.setItem(StorageKeys.windowAnimationSpeed, settings.animationSpeed);
  if (typeof settings.clickBubble === "boolean") {
    localStorage.setItem(StorageKeys.clickBubbleFeedback, String(settings.clickBubble));
    if (settings.clickBubble) {
      initClickBubble();
    } else {
      destroyClickBubble();
    }
  }
}
