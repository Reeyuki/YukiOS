import { getRawSetting } from "../utils/utils.js";
import { StorageKeys, os } from "../framework.js";
export const OPEN_ANIMATIONS = {
  fade: "fade",
  scaleCenter: "scaleCenter",
  scaleFromSource: "scaleFromSource",
  slideUp: "slideUp",
  slideLeft: "slideLeft",
  slideRight: "slideRight",
  instant: "instant",
  glassBlurin: "glassBlurin",
  elasticBounce: "elasticBounce",
  blurReveal: "blurReveal",
  perspective3D: "perspective3D",
  cornerUnfold: "cornerUnfold",
  slideInGrowth: "slideInGrowth"
};

export const CLOSE_ANIMATIONS = {
  scaleDownCenter: "scaleDownCenter",
  scaleToOrigin: "scaleToOrigin",
  fadeOut: "fadeOut",
  slideDown: "slideDown",
  burn: "burn",
  instant: "instant",
  shrinkToPoint: "shrinkToPoint",
  dissolveBlur: "dissolveBlur"
};

export const MINIMIZE_ANIMATIONS = {
  taskbarShrink: "taskbarShrink",
  dockZoomShrink: "dockZoomShrink",
  magicLamp: "magicLamp",
  fadeToTaskbar: "fadeToTaskbar",
  instant: "instant",
  elasticStretch: "elasticStretch",
  spiralDown: "spiralDown"
};

function getOpenAnim() {
  return getRawSetting(StorageKeys.windowOpenAnimation, OPEN_ANIMATIONS.scaleFromSource);
}

function getCloseAnim() {
  return getRawSetting(StorageKeys.windowCloseAnimation, CLOSE_ANIMATIONS.scaleDownCenter);
}

function getMinimizeAnim() {
  return getRawSetting(StorageKeys.windowMinimizeAnimation, MINIMIZE_ANIMATIONS.taskbarShrink);
}

function getAnimationSpeed() {
  const speed = getRawSetting(StorageKeys.windowAnimationSpeed, "normal");
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
  return getRawSetting(StorageKeys.clickBubbleFeedback, "false") === "true";
}

function isTurboMode() {
  const mode = getRawSetting(StorageKeys.turboMode, "high");
  return mode === "turbo";
}

function getTaskbarPosition() {
  const taskbar = document.getElementById("taskbar");
  if (!taskbar) return "bottom";

  if (taskbar.classList.contains("position-top")) return "top";
  if (taskbar.classList.contains("position-bottom")) return "bottom";
  if (taskbar.classList.contains("position-left")) return "left";
  if (taskbar.classList.contains("position-right")) return "right";

  return "bottom";
}

function getSmartShrinkTarget(taskbarItem, winRect, taskbarPosition) {
  const tbRect = taskbarItem.getBoundingClientRect();

  const winCenterX = winRect.left + winRect.width / 2;
  const winCenterY = winRect.top + winRect.height / 2;

  let targetX, targetY;

  switch (taskbarPosition) {
    case "left":
      targetX = tbRect.right;
      targetY = tbRect.top + tbRect.height / 2;
      break;
    case "right":
      targetX = tbRect.left;
      targetY = tbRect.top + tbRect.height / 2;
      break;
    case "top":
      targetX = tbRect.left + tbRect.width / 2;
      targetY = tbRect.bottom;
      break;
    case "bottom":
    default:
      targetX = tbRect.left + tbRect.width / 2;
      targetY = tbRect.top;
      break;
  }

  const dx = targetX - winCenterX;
  const dy = targetY - winCenterY;

  return { dx, dy };
}

export function animateWindowOpen(win, isRestoring = false) {
  if (isTurboMode()) return;

  if (win.id && win.id.startsWith("browser-app-")) return;

  const anim = getOpenAnim();
  if (anim === OPEN_ANIMATIONS.instant) return;

  const duration = 300 * getAnimationSpeed();

  win.getAnimations().forEach((anim) => anim.cancel());
  const wm = window.__windowManager;
  const isSessionRestoring = wm && wm.appRestorationService && wm.appRestorationService.isRestoring;

  const keyframes = getOpenKeyframes(anim, win, isRestoring || isSessionRestoring);

  const animation = win.animate(keyframes, {
    duration: duration,
    easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    fill: "forwards"
  });

  animation.onfinish = () => {
    win.style.opacity = "";
    win.style.transform = "";
    win.style.filter = "";
  };
}

function getOpenKeyframes(animType, win, isRestoring = false) {
  switch (animType) {
    case OPEN_ANIMATIONS.fade:
      return [{ opacity: 0 }, { opacity: 1 }];
    case OPEN_ANIMATIONS.scaleCenter:
      return [
        { opacity: 0, transform: "scale(0.9)" },
        { opacity: 1, transform: "scale(1)" }
      ];
    case OPEN_ANIMATIONS.scaleFromSource:
      if (!isRestoring) {
        return [
          { opacity: 0, transform: "scale(0.9)" },
          { opacity: 1, transform: "scale(1)" }
        ];
      }
      const taskbarItem = document.getElementById(`taskbar-${win.id}`);
      if (taskbarItem) {
        const winRect = win.getBoundingClientRect();
        const taskbarPosition = getTaskbarPosition();
        const { dx, dy } = getSmartShrinkTarget(taskbarItem, winRect, taskbarPosition);
        return [
          { opacity: 0, transform: `translate(${dx}px, ${dy}px) scale(0.5)` },
          { opacity: 1, transform: "translate(0, 0) scale(1)" }
        ];
      }
      return [
        { opacity: 0, transform: "scale(0.9)" },
        { opacity: 1, transform: "scale(1)" }
      ];
    case OPEN_ANIMATIONS.slideUp:
      return [
        { opacity: 0, transform: "translateY(20px)" },
        { opacity: 1, transform: "translateY(0)" }
      ];
    case OPEN_ANIMATIONS.slideLeft:
      return [
        { opacity: 0, transform: "translateX(20px)" },
        { opacity: 1, transform: "translateX(0)" }
      ];
    case OPEN_ANIMATIONS.slideRight:
      return [
        { opacity: 0, transform: "translateX(-20px)" },
        { opacity: 1, transform: "translateX(0)" }
      ];
    case OPEN_ANIMATIONS.glassBlurin:
      return [
        { opacity: 0, filter: "blur(10px)", transform: "scale(0.95)" },
        { opacity: 1, filter: "blur(0)", transform: "scale(1)" }
      ];
    case OPEN_ANIMATIONS.elasticBounce:
      return [
        { opacity: 0, transform: "scale(0.1)" },
        { opacity: 1, transform: "scale(1.3)", offset: 0.5 },
        { opacity: 1, transform: "scale(0.9)", offset: 0.75 },
        { opacity: 1, transform: "scale(1)" }
      ];
    case OPEN_ANIMATIONS.blurReveal:
      return [
        { opacity: 0, filter: "blur(40px)", transform: "scale(0.5)" },
        { opacity: 0.5, filter: "blur(20px)", transform: "scale(0.8)", offset: 0.5 },
        { opacity: 1, filter: "blur(0)", transform: "scale(1)" }
      ];
    case OPEN_ANIMATIONS.perspective3D:
      return [
        { opacity: 0, transform: "perspective(1000px) rotateX(-30deg) rotateY(-15deg) scale(0.5)" },
        { opacity: 1, transform: "perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)" }
      ];
    case OPEN_ANIMATIONS.cornerUnfold:
      return [
        { opacity: 0, transform: "scale(0) rotate(-45deg)", transformOrigin: "top left" },
        { opacity: 1, transform: "scale(1) rotate(0deg)", transformOrigin: "top left" }
      ];
    case OPEN_ANIMATIONS.slideInGrowth:
      const targetW = parseFloat(win.style.width) || 300;
      return [
        { opacity: 0, transform: "perspective(300px) scale(0.5) rotateY(-20deg)", width: "0px" },
        { opacity: 1, transform: "perspective(300px) scale(1) rotateY(0deg)", width: `${targetW}px`, offset: 1 }
      ];
    default:
      return [{ opacity: 0 }, { opacity: 1 }];
  }
}

export function animateWindowClose(win, onDone) {
  if (isTurboMode()) {
    onDone?.();
    return;
  }
  const anim = getCloseAnim();
  win.style.pointerEvents = "none";

  const duration = 220 * getAnimationSpeed();

  win.getAnimations().forEach((anim) => anim.cancel());

  const keyframes = getCloseKeyframes(anim, win);

  const animation = win.animate(keyframes, {
    duration: duration,
    easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    fill: "forwards"
  });

  animation.onfinish = () => {
    onDone?.();
  };
}

function getCloseKeyframes(animType, win) {
  switch (animType) {
    case CLOSE_ANIMATIONS.scaleDownCenter:
      return [
        { opacity: 1, transform: "scale(1)" },
        { opacity: 0, transform: "scale(0.85)" }
      ];
    case CLOSE_ANIMATIONS.scaleToOrigin:
      const taskbarItem = document.getElementById(`taskbar-${win.id}`);
      if (taskbarItem) {
        const winRect = win.getBoundingClientRect();
        const taskbarPosition = getTaskbarPosition();
        const { dx, dy } = getSmartShrinkTarget(taskbarItem, winRect, taskbarPosition);
        return [
          { opacity: 1, transform: "translate(0, 0) scale(1)" },
          { opacity: 0, transform: `translate(${dx}px, ${dy}px) scale(0.1)` }
        ];
      }
      return [
        { opacity: 1, transform: "scale(1)" },
        { opacity: 0, transform: "scale(0.1)" }
      ];
    case CLOSE_ANIMATIONS.fadeOut:
      return [{ opacity: 1 }, { opacity: 0 }];
    case CLOSE_ANIMATIONS.slideDown:
      return [
        { opacity: 1, transform: "translateY(0)" },
        { opacity: 0, transform: "translateY(20px)" }
      ];
    case CLOSE_ANIMATIONS.burn:
      return [
        { opacity: 1, filter: "brightness(1) blur(0px)", transform: "scaleY(1)" },
        { opacity: 0.8, filter: "brightness(3) blur(2px)", transform: "scaleY(0.95)", offset: 0.3 },
        { opacity: 0, filter: "brightness(0) blur(8px)", transform: "scaleY(0)" }
      ];
    case CLOSE_ANIMATIONS.shrinkToPoint:
      return [
        { opacity: 1, transform: "scale(1)", transformOrigin: "center center" },
        { opacity: 0, transform: "scale(0)", transformOrigin: "center center" }
      ];
    case CLOSE_ANIMATIONS.dissolveBlur:
      return [
        { opacity: 1, filter: "blur(0px)" },
        { opacity: 0, filter: "blur(20px)" }
      ];
    default:
      return [{ opacity: 1 }, { opacity: 0 }];
  }
}

export function animateWindowMinimize(win, onDone) {
  if (isTurboMode()) {
    onDone?.();
    return;
  }
  const anim = getMinimizeAnim();
  win.style.pointerEvents = "none";

  const duration = 260 * getAnimationSpeed();

  win.getAnimations().forEach((anim) => anim.cancel());

  const keyframes = getMinimizeKeyframes(anim, win);

  const animation = win.animate(keyframes, {
    duration: duration,
    easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    fill: "forwards"
  });

  animation.onfinish = () => {
    onDone?.();
  };
}

function getMinimizeKeyframes(animType, win) {
  const taskbarPosition = getTaskbarPosition();
  const isBottom = taskbarPosition === "bottom" || taskbarPosition === "top";

  switch (animType) {
    case MINIMIZE_ANIMATIONS.taskbarShrink:
      const taskbarItem = document.getElementById(`taskbar-${win.id}`);
      if (taskbarItem) {
        const winRect = win.getBoundingClientRect();
        const { dx, dy } = getSmartShrinkTarget(taskbarItem, winRect, taskbarPosition);
        return [
          { opacity: 1, transform: "translate(0, 0) scale(1)" },
          { opacity: 0, transform: `translate(${dx}px, ${dy}px) scale(0.1)` }
        ];
      }
      return [{ opacity: 1 }, { opacity: 0 }];
    case MINIMIZE_ANIMATIONS.dockZoomShrink:
      return [
        { opacity: 1, transform: "scale(1)" },
        { opacity: 0, transform: "scale(0)" }
      ];
    case MINIMIZE_ANIMATIONS.magicLamp:
      const tbItem = document.getElementById(`taskbar-${win.id}`);
      if (tbItem) {
        const tbRect = tbItem.getBoundingClientRect();
        const winRect = win.getBoundingClientRect();
        const dx = tbRect.left + tbRect.width / 2 - (winRect.left + winRect.width / 2);
        return [
          { opacity: 1, transform: "translateX(0)" },
          { opacity: 0, transform: `translateX(${dx}px) scaleX(0.1)` }
        ];
      }
      return [{ opacity: 1 }, { opacity: 0 }];
    case MINIMIZE_ANIMATIONS.fadeToTaskbar:
      return [{ opacity: 1 }, { opacity: 0 }];
    case MINIMIZE_ANIMATIONS.elasticStretch:
      const elasticTaskbarItem = document.getElementById(`taskbar-${win.id}`);
      if (elasticTaskbarItem) {
        const winRect = win.getBoundingClientRect();
        const { dx, dy } = getSmartShrinkTarget(elasticTaskbarItem, winRect, taskbarPosition);
        return [
          { opacity: 1, transform: "translate(0, 0) scale(1)" },
          { opacity: 1, transform: `translate(${dx * 0.4}px, ${dy * 0.4}px) scale(1.4)`, offset: 0.4 },
          { opacity: 1, transform: `translate(${dx * 0.7}px, ${dy * 0.7}px) scale(0.8)`, offset: 0.7 },
          { opacity: 0, transform: `translate(${dx}px, ${dy}px) scale(0.1)` }
        ];
      }
      return [{ opacity: 1 }, { opacity: 0 }];
    case MINIMIZE_ANIMATIONS.spiralDown:
      const spiralTaskbarItem = document.getElementById(`taskbar-${win.id}`);
      if (spiralTaskbarItem) {
        const winRect = win.getBoundingClientRect();
        const { dx, dy } = getSmartShrinkTarget(spiralTaskbarItem, winRect, taskbarPosition);
        return [
          { opacity: 1, transform: "translate(0, 0) rotate(0deg) scale(1)" },
          {
            opacity: 0.8,
            transform: `translate(${dx * 0.3}px, ${dy * 0.3}px) rotate(120deg) scale(0.7)`,
            offset: 0.25
          },
          { opacity: 0.5, transform: `translate(${dx * 0.6}px, ${dy * 0.6}px) rotate(240deg) scale(0.4)`, offset: 0.5 },
          {
            opacity: 0.2,
            transform: `translate(${dx * 0.8}px, ${dy * 0.8}px) rotate(360deg) scale(0.2)`,
            offset: 0.75
          },
          { opacity: 0, transform: `translate(${dx}px, ${dy}px) rotate(480deg) scale(0.1)` }
        ];
      }
      return [{ opacity: 1 }, { opacity: 0 }];
    default:
      return [{ opacity: 1 }, { opacity: 0 }];
  }
}

export function applyFocusGlow(win) {
  if (isTurboMode()) return;
  win.classList.add("wa-focus-glow");
  const tid = setTimeout(() => win.classList.remove("wa-focus-glow"), 600);
  win.focusTid = tid;
}

export function applyZDepthLift(win, active) {
  if (active) {
    win.classList.add("wa-z-lift");
  } else {
    win.classList.remove("wa-z-lift");
  }
}

export function initClickBubble() {
  Promise.resolve().then(() => {
    if (!isClickBubbleEnabled()) return;
    document.addEventListener("pointerdown", handleClickBubble, { passive: true });
  });
}

export function destroyClickBubble() {
  document.removeEventListener("pointerdown", handleClickBubble);
}

function handleClickBubble(e) {
  if (!isClickBubbleEnabled()) return;
  const ripple = document.createElement("div");
  ripple.className = "wa-ripple";
  ripple.style.left = `${e.clientX}px`;
  ripple.style.top = `${e.clientY}px`;
  document.body.appendChild(ripple);
  ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
}

export function applyAnimationSettings(settings) {
  if (settings.openAnimation) os.storage.set(StorageKeys.windowOpenAnimation, settings.openAnimation);
  if (settings.closeAnimation) os.storage.set(StorageKeys.windowCloseAnimation, settings.closeAnimation);
  if (settings.minimizeAnimation) os.storage.set(StorageKeys.windowMinimizeAnimation, settings.minimizeAnimation);
  if (settings.animationSpeed) os.storage.set(StorageKeys.windowAnimationSpeed, settings.animationSpeed);
  if (typeof settings.clickBubble === "boolean") {
    os.storage.set(StorageKeys.clickBubbleFeedback, String(settings.clickBubble));
    if (settings.clickBubble) {
      initClickBubble();
    } else {
      destroyClickBubble();
    }
  }
}

function getWobbleSpringK() {
  return getRawSetting(StorageKeys.wobbleSpringK, 170);
}

function getWobbleDamping() {
  return getRawSetting(StorageKeys.wobbleDamping, 15);
}

function getWobbleMass() {
  return getRawSetting(StorageKeys.wobbleMass, 1.0);
}

function getWobbleDragLag() {
  return getRawSetting(StorageKeys.wobbleDragLag, 0.55);
}

function getWobbleCoupleK() {
  return getRawSetting(StorageKeys.wobbleCoupleK, 90);
}

/** @type {WeakMap<HTMLElement, WobbleState>} */
const wobbleMap = new WeakMap();

/**
 * @typedef {Object} SpringPoint
 * @property {number} x
 * @property {number} y
 * @property {number} vx
 * @property {number} vy
 * @property {number} anchorX
 * @property {number} anchorY
 */

/**
 * @typedef {Object} WobbleState
 * @property {SpringPoint[]} points
 * @property {number} rafId
 * @property {boolean} dragging
 * @property {number} lastTime
 * @property {number} winW
 * @property {number} winH
 */

function anchors(w, h) {
  return [
    { ax: 0, ay: 0 },
    { ax: w / 3, ay: 0 },
    { ax: (2 * w) / 3, ay: 0 },
    { ax: w, ay: 0 },
    { ax: w, ay: h / 3 },
    { ax: w, ay: (2 * h) / 3 },
    { ax: w, ay: h },
    { ax: (2 * w) / 3, ay: h },
    { ax: w / 3, ay: h },
    { ax: 0, ay: h },
    { ax: 0, ay: (2 * h) / 3 },
    { ax: 0, ay: h / 3 }
  ];
}

function smoothClosedPath(pts) {
  const n = pts.length;
  const at = (i) => pts[((i % n) + n) % n];
  const px = (v) => v.toFixed(2);

  let d = `M ${px(at(0).x)} ${px(at(0).y)} `;
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);

    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;

    d += `C ${px(c1x)} ${px(c1y)}, ${px(c2x)} ${px(c2y)}, ${px(p2.x)} ${px(p2.y)} `;
  }
  return `${d}Z`;
}

function buildClipPath(pts) {
  return `path('${smoothClosedPath(pts)}')`;
}
export function wobbleStart(win) {
  if (isTurboMode()) return;
  if (getRawSetting(StorageKeys.wobblyWindows, "false") !== "true") return;

  wobbleCancel(win);

  const rect = win.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;

  const anc = anchors(w, h);
  const points = anc.map(({ ax, ay }) => ({
    x: ax,
    y: ay,
    vx: 0,
    vy: 0,
    anchorX: ax,
    anchorY: ay
  }));

  /** @type {WobbleState} */
  const state = {
    points,
    rafId: null,
    dragging: true,
    lastTime: null,
    winW: w,
    winH: h
  };

  wobbleMap.set(win, state);
  wobbleRaf(win);
}

export function wobbleMove(win, vx, vy) {
  const state = wobbleMap.get(win);
  if (!state) return;

  const rect = win.getBoundingClientRect();
  state.winW = rect.width;
  state.winH = rect.height;

  const anc = anchors(state.winW, state.winH);
  const lag = getWobbleDragLag();

  state.points.forEach((pt, i) => {
    pt.anchorX = anc[i].ax;
    pt.anchorY = anc[i].ay;

    const grabFalloff = 1 - 0.55 * (pt.anchorY / state.winH);
    pt.x += vx * lag * grabFalloff;
    pt.y += vy * lag * grabFalloff;
    pt.vx += vx * lag * 0.5 * grabFalloff;
    pt.vy += vy * lag * 0.5 * grabFalloff;
  });
}
export function wobbleEnd(win) {
  const state = wobbleMap.get(win);
  if (!state) return;
  state.dragging = false;
}

export function wobbleCancel(win) {
  const state = wobbleMap.get(win);
  if (state?.rafId) cancelAnimationFrame(state.rafId);
  wobbleMap.delete(win);
  win.style.clipPath = "";
}

function wobbleRaf(win) {
  const state = wobbleMap.get(win);
  if (!state) return;

  const tick = (now) => {
    const s = wobbleMap.get(win);
    if (!s) return;

    const dt = s.lastTime ? Math.min((now - s.lastTime) / 1000, 0.05) : 0.016;
    s.lastTime = now;

    const n = s.points.length;
    let settled = true;

    s.points.forEach((pt, i) => {
      const prev = s.points[(i - 1 + n) % n];
      const next = s.points[(i + 1) % n];

      const dx = pt.anchorX - pt.x;
      const dy = pt.anchorY - pt.y;

      const coupleX = getWobbleCoupleK() * (prev.x - prev.anchorX + (next.x - next.anchorX) - 2 * (pt.x - pt.anchorX));
      const coupleY = getWobbleCoupleK() * (prev.y - prev.anchorY + (next.y - next.anchorY) - 2 * (pt.y - pt.anchorY));

      const ax = (getWobbleSpringK() * dx - getWobbleDamping() * pt.vx + coupleX) / getWobbleMass();
      const ay = (getWobbleSpringK() * dy - getWobbleDamping() * pt.vy + coupleY) / getWobbleMass();

      pt.vx += ax * dt;
      pt.vy += ay * dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;

      if (Math.abs(dx) > 0.4 || Math.abs(dy) > 0.4 || Math.abs(pt.vx) > 0.4 || Math.abs(pt.vy) > 0.4) {
        settled = false;
      }
    });

    if (settled && !s.dragging) {
      win.style.clipPath = "";
      wobbleMap.delete(win);
      return;
    }

    win.style.clipPath = buildClipPath(s.points);
    s.rafId = requestAnimationFrame(tick);
  };

  state.rafId = requestAnimationFrame(tick);
}
