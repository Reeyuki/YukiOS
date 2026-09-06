import { getRawSetting } from "../utils/utils.js";
import { StorageKeys, os, $, createElement } from "../framework.js";
import { playFallApartAnimation } from "./FallApartAnimation.js";

let animToken = 0;
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
  dissolveBlur: "dissolveBlur",
  zoomToDock: "zoomToDock",
  fallApart: "fallApart"
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

export const RESTORE_ANIMATIONS = {
  fromTaskbar: "fromTaskbar",
  scaleCenter: "scaleCenter",
  fade: "fade",
  slideUp: "slideUp",
  instant: "instant",
  genieFromDock: "genieFromDock"
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

function getRestoreAnim() {
  return getRawSetting(StorageKeys.windowRestoreAnimation, RESTORE_ANIMATIONS.fromTaskbar);
}

function getAnimationSpeed() {
  const speed = getRawSetting(StorageKeys.windowAnimationSpeed, 1.0);
  if (typeof speed === "number") return speed;
  const num = Number(speed);
  if (!isNaN(num)) return num;
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

function isPerformanceMode() {
  const mode = getRawSetting(StorageKeys.performanceMode, "high");
  return mode === "performance";
}

function getTaskbarPosition() {
  const dock = $("#mac-dock");
  if (dock && dock.dataset.position) {
    const pos = dock.dataset.position;
    if (pos === "left" || pos === "right" || pos === "bottom") {
      return pos;
    }
  }

  const taskbar = $("#taskbar");
  if (!taskbar) return "bottom";

  if (taskbar.classList.contains("position-top")) return "top";
  if (taskbar.classList.contains("position-bottom")) return "bottom";
  if (taskbar.classList.contains("position-left")) return "left";
  if (taskbar.classList.contains("position-right")) return "right";

  return "bottom";
}

function getDockItemRect(win) {
  const dock = $("#mac-dock");
  if (!dock) return null;
  const byWin = dock.querySelector(`.dock-item[data-win-id="${win.id}"]`);
  if (byWin) return byWin.getBoundingClientRect();
  const appId = win.dataset?.appId;
  if (appId) {
    const byApp = dock.querySelector(`.dock-item[data-app-id="${appId}"]`);
    if (byApp) return byApp.getBoundingClientRect();
  }
  return null;
}

function genieClipPath(winRect, targetRect, pos, t) {
  const W = winRect.width || 1;
  const H = winRect.height || 1;
  const M = 9;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const lerp = (a, b, f) => a + (b - a) * f;
  const dockX = clamp01((targetRect.left + targetRect.width / 2 - winRect.left) / W);
  const dockY = clamp01((targetRect.top + targetRect.height / 2 - winRect.top) / H);
  const pts = [];
  if (pos === "left" || pos === "right") {
    const right = [],
      left = [];
    for (let i = 0; i < M; i++) {
      const yf = i / (M - 1);
      const d = Math.abs(yf - dockY);
      const shape = 1 - 0.35 * d;
      const y = lerp(yf * 100, 50, t);
      const xRight = lerp(100, 50, Math.min(1, t * shape));
      const xLeft = lerp(0, 50, t);
      right.push([xRight, y]);
      left.push([xLeft, y]);
    }
    for (let i = 0; i < M; i++) pts.push(right[i]);
    for (let i = M - 1; i >= 0; i--) pts.push(left[i]);
  } else {
    const top = [],
      bot = [];
    for (let i = 0; i < M; i++) {
      const xf = i / (M - 1);
      const d = Math.abs(xf - dockX);
      const shape = 1 - 0.35 * d;
      const x = lerp(xf * 100, 50, t);
      const yTop = lerp(0, 50, Math.min(1, t * shape));
      const yBot = lerp(100, 50, t);
      top.push([x, yTop]);
      bot.push([x, yBot]);
    }
    for (let i = 0; i < M; i++) pts.push(top[i]);
    for (let i = M - 1; i >= 0; i--) pts.push(bot[i]);
  }
  return `polygon(${pts.map(([x, y]) => `${x.toFixed(2)}% ${y.toFixed(2)}%`).join(", ")})`;
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

function captureCurrentVisual(win) {
  const cs = getComputedStyle(win);
  return {
    transform: cs.transform !== "none" ? cs.transform : "translate(0px, 0px) scale(1)",
    opacity: cs.opacity,
    filter: cs.filter !== "none" ? cs.filter : "none",
    clipPath: cs.clipPath !== "none" ? cs.clipPath : "none",
    borderRadius: cs.borderRadius
  };
}

function getOpenEndState() {
  return {
    transform: "translate(0px, 0px) scale(1)",
    opacity: "1",
    filter: "none",
    clipPath: "none",
    borderRadius: "0px"
  };
}

function getMinimizeEndState(win) {
  const taskbarItem = $(`#taskbar-${win.id}`);
  if (taskbarItem) {
    const winRect = win.getBoundingClientRect();
    const { dx, dy } = getSmartShrinkTarget(taskbarItem, winRect, getTaskbarPosition());
    return {
      transform: `translate(${dx}px, ${dy}px) scale(0.1)`,
      opacity: "0",
      filter: "none",
      clipPath: "none",
      borderRadius: "10px"
    };
  }
  return {
    transform: "translate(0px, 0px) scale(1)",
    opacity: "0",
    filter: "none",
    clipPath: "none",
    borderRadius: "0px"
  };
}

export function animateWindowOpen(win, isRestoring = false) {
  if (isPerformanceMode()) return;

  if (win.id && (win.id.startsWith("browser-app-") || win.id.startsWith("scramjet-window-"))) return;

  const wm = os.windowManager;
  const isSessionRestoring = wm && wm.appRestorationService && wm.appRestorationService.isRestoring;

  if (isSessionRestoring) return;

  const restoring = isRestoring || isSessionRestoring;

  playWindowAnimation(win, { mode: "open", isRestoring: restoring });
}

export function restoreWindowAnimated(win) {
  if (!win) return;
  const token = ++animToken;
  win._lastAnimToken = token;
  requestAnimationFrame(() => {
    if (win._lastAnimToken !== token) return;
    animateWindowOpen(win, true);
  });
}

function playWindowAnimation(win, { mode, isRestoring = false, onDone = null }) {
  win._lastAnimToken = ++animToken;

  if (mode === "open" && win.style.display === "none") win.style.display = "";

  const running = win.getAnimations().find((a) => a.id === "window-state" && a.playState === "running");
  if (running) {
    const from = captureCurrentVisual(win);
    win.getAnimations().forEach((a) => a.cancel());

    const to = mode === "open" ? getOpenEndState() : getMinimizeEndState(win);
    const duration = 180 * getAnimationSpeed();

    win.style.pointerEvents = mode === "open" ? "" : "none";

    const animation = win.animate([from, to], {
      duration,
      easing: mode === "open" ? "cubic-bezier(0.16,1,0.3,1)" : "cubic-bezier(0.3,0,1,1)",
      fill: "forwards"
    });
    animation.id = "window-state";

    animation.onfinish = () => {
      if (mode === "minimize") {
        win.style.clipPath = "";
        win.style.borderRadius = "";
        onDone?.();
      } else {
        win.style.opacity = "";
        win.style.transform = "";
        win.style.filter = "";
        win.style.clipPath = "";
        win.style.borderRadius = "";
      }
    };
    return;
  }

  if (mode === "open") {
    const anim = isRestoring ? getRestoreAnim() : getOpenAnim();
    if (anim === OPEN_ANIMATIONS.instant || anim === RESTORE_ANIMATIONS.instant) return;
    if (win.style.display === "none") win.style.display = "";

    const duration = 220 * getAnimationSpeed();
    win.getAnimations().forEach((a) => a.cancel());

    const keyframes = isRestoring ? getRestoreKeyframes(anim, win) : getOpenKeyframes(anim, win, false);

    const animation = win.animate(keyframes, {
      duration,
      easing: anim === OPEN_ANIMATIONS.elasticBounce ? "cubic-bezier(0.34,1.56,0.64,1)" : "cubic-bezier(0.16,1,0.3,1)",
      fill: "forwards"
    });
    animation.id = "window-state";

    animation.onfinish = () => {
      win.style.opacity = "";
      win.style.transform = "";
      win.style.filter = "";
      win.style.clipPath = "";
      win.style.borderRadius = "";
    };
  } else {
    const anim = getMinimizeAnim();
    win.style.pointerEvents = "none";

    const duration = 200 * getAnimationSpeed();
    win.getAnimations().forEach((a) => a.cancel());

    const keyframes = getMinimizeKeyframes(anim, win);

    const animation = win.animate(keyframes, {
      duration,
      easing:
        anim === MINIMIZE_ANIMATIONS.elasticStretch ? "cubic-bezier(0.34,1.56,0.64,1)" : "cubic-bezier(0.3,0,1,1)",
      fill: "forwards"
    });
    animation.id = "window-state";

    animation.onfinish = () => {
      win.style.clipPath = "";
      win.style.borderRadius = "";
      onDone?.();
    };
  }
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
      const taskbarItem = $(`#taskbar-${win.id}`);
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

function getRestoreKeyframes(animType, win) {
  const taskbarPosition = getTaskbarPosition();
  switch (animType) {
    case RESTORE_ANIMATIONS.fromTaskbar: {
      const taskbarItem = $(`#taskbar-${win.id}`);
      if (taskbarItem) {
        const winRect = win.getBoundingClientRect();
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
    }
    case RESTORE_ANIMATIONS.scaleCenter:
      return [
        { opacity: 0, transform: "scale(0.85)" },
        { opacity: 1, transform: "scale(1)" }
      ];
    case RESTORE_ANIMATIONS.fade:
      return [{ opacity: 0 }, { opacity: 1 }];
    case RESTORE_ANIMATIONS.slideUp:
      return [
        { opacity: 0, transform: "translateY(20px)" },
        { opacity: 1, transform: "translateY(0)" }
      ];
    case RESTORE_ANIMATIONS.genieFromDock: {
      const dockRect = getDockItemRect(win);
      const tbItem = dockRect ? null : $(`#taskbar-${win.id}`);
      const targetRect = dockRect || (tbItem ? tbItem.getBoundingClientRect() : null);
      if (targetRect) {
        const winRect = win.getBoundingClientRect();
        const pos = dockRect ? getTaskbarPosition() : taskbarPosition;
        const isVertical = pos === "bottom" || pos === "top";
        const startCX = winRect.left + winRect.width / 2;
        const startCY = winRect.top + winRect.height / 2;
        const targetCX = targetRect.left + targetRect.width / 2;
        const targetCY = targetRect.top + targetRect.height / 2;
        const startX = targetCX - startCX;
        const startY = targetCY - startCY;
        const skewAxis = isVertical ? "Y" : "X";
        const phases = [
          { p: 0.0, t: 1.0, sx: 0, sy: 0, sk: 0, op: 0 },
          { p: 0.1, t: 0.985, sx: 0.15, sy: 0.08, sk: 0, op: 0.3 },
          { p: 0.3, t: 0.9, sx: 0.4, sy: 0.3, sk: isVertical ? 0 : 9, op: 0.7 },
          { p: 0.58, t: 0.68, sx: 0.72, sy: 0.6, sk: isVertical ? 0 : 5, op: 0.95 },
          { p: 0.82, t: 0.35, sx: 0.92, sy: 0.86, sk: 0, op: 1 },
          { p: 1.0, t: 0.0, sx: 1, sy: 1, sk: 0, op: 1 }
        ];
        return phases.map((ph) => ({
          transform: `translate(${(startX * ph.p).toFixed(2)}px, ${(startY * ph.p).toFixed(2)}px) scaleX(${ph.sx}) scaleY(${ph.sy}) skew${skewAxis}(${ph.sk}deg)`,
          borderRadius: ph.p === 1 ? "0px" : "10px",
          opacity: ph.op,
          clipPath: genieClipPath(winRect, targetRect, pos, ph.t),
          offset: ph.p
        }));
      }
      return [
        { opacity: 0, transform: "scale(0.9)" },
        { opacity: 1, transform: "scale(1)" }
      ];
    }
    default:
      return [{ opacity: 0 }, { opacity: 1 }];
  }
}

export function animateWindowClose(win, onDone) {
  if (isPerformanceMode()) {
    onDone?.();
    return;
  }
  const selectedCloseAnim = getCloseAnim();
  if (selectedCloseAnim === CLOSE_ANIMATIONS.fallApart) {
    win.style.pointerEvents = "none";
    playFallApartAnimation(win, onDone, getAnimationSpeed());
    return;
  }
  const anim = selectedCloseAnim;
  win.style.pointerEvents = "none";

  const duration = 140 * getAnimationSpeed();

  win.getAnimations().forEach((existing) => existing.cancel());

  const keyframes = getCloseKeyframes(anim, win);

  let finished = false;
  const finishOnce = () => {
    if (finished) return;
    finished = true;
    onDone?.();
  };

  const animation = win.animate(keyframes, {
    duration: duration,
    easing: "cubic-bezier(0.3,0,1,1)",
    fill: "forwards"
  });
  animation.id = "window-close";
  animation.onfinish = finishOnce;
  animation.oncancel = finishOnce;
  setTimeout(finishOnce, duration + 150);
}

function getCloseKeyframes(animType, win) {
  switch (animType) {
    case CLOSE_ANIMATIONS.scaleDownCenter:
      return [
        { opacity: 1, transform: "scale(1)" },
        { opacity: 0, transform: "scale(0.85)" }
      ];
    case CLOSE_ANIMATIONS.scaleToOrigin:
      const taskbarItem = $(`#taskbar-${win.id}`);
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
    case CLOSE_ANIMATIONS.zoomToDock: {
      const dockRect = getDockItemRect(win);
      if (dockRect) {
        const winRect = win.getBoundingClientRect();
        const startCX = winRect.left + winRect.width / 2;
        const startCY = winRect.top + winRect.height / 2;
        const targetCX = dockRect.left + dockRect.width / 2;
        const targetCY = dockRect.top + dockRect.height / 2;
        const dx = targetCX - startCX;
        const dy = targetCY - startCY;
        return [
          { opacity: 1, transform: "translate(0, 0) scale(1)" },
          {
            opacity: 0.6,
            transform: `translate(${(dx * 0.6).toFixed(2)}px, ${(dy * 0.6).toFixed(2)}px) scale(0.4)`,
            offset: 0.6
          },
          { opacity: 0, transform: `translate(${dx}px, ${dy}px) scale(0.05)` }
        ];
      }
      return [
        { opacity: 1, transform: "scale(1)" },
        { opacity: 0, transform: "scale(0.85)" }
      ];
    }
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
  if (isPerformanceMode()) {
    onDone?.();
    return;
  }
  playWindowAnimation(win, { mode: "minimize", onDone });
}

function getMinimizeKeyframes(animType, win) {
  const taskbarPosition = getTaskbarPosition();
  const isBottom = taskbarPosition === "bottom" || taskbarPosition === "top";

  switch (animType) {
    case MINIMIZE_ANIMATIONS.taskbarShrink:
      const taskbarItem = $(`#taskbar-${win.id}`);
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
    case MINIMIZE_ANIMATIONS.magicLamp: {
      const dockRect = getDockItemRect(win);
      const tbItem = dockRect ? null : $(`#taskbar-${win.id}`);
      const targetRect = dockRect || (tbItem ? tbItem.getBoundingClientRect() : null);
      if (targetRect) {
        const winRect = win.getBoundingClientRect();
        const pos = dockRect ? getTaskbarPosition() : taskbarPosition;
        const isVertical = pos === "bottom" || pos === "top";
        const startCX = winRect.left + winRect.width / 2;
        const startCY = winRect.top + winRect.height / 2;
        const targetCX = targetRect.left + targetRect.width / 2;
        const targetCY = targetRect.top + targetRect.height / 2;
        const endX = targetCX - startCX;
        const endY = targetCY - startCY;
        const skewAxis = isVertical ? "Y" : "X";
        const phases = [
          { p: 0.0, t: 0.0, sx: 1, sy: 1, sk: 0, op: 1 },
          { p: 0.18, t: 0.35, sx: 0.92, sy: 0.86, sk: 0, op: 1 },
          { p: 0.42, t: 0.68, sx: 0.72, sy: 0.6, sk: isVertical ? 0 : 5, op: 0.95 },
          { p: 0.7, t: 0.9, sx: 0.4, sy: 0.3, sk: isVertical ? 0 : 9, op: 0.7 },
          { p: 0.9, t: 0.985, sx: 0.15, sy: 0.08, sk: 0, op: 0.3 },
          { p: 1.0, t: 1.0, sx: 0, sy: 0, sk: 0, op: 0 }
        ];
        return phases.map((ph) => ({
          transform: `translate(${(endX * ph.p).toFixed(2)}px, ${(endY * ph.p).toFixed(2)}px) scaleX(${ph.sx}) scaleY(${ph.sy}) skew${skewAxis}(${ph.sk}deg)`,
          borderRadius: ph.p === 0 ? "0px" : "10px",
          opacity: ph.op,
          clipPath: genieClipPath(winRect, targetRect, pos, ph.t),
          offset: ph.p
        }));
      }
      return [{ opacity: 1 }, { opacity: 0 }];
    }
    case MINIMIZE_ANIMATIONS.fadeToTaskbar:
      return [{ opacity: 1 }, { opacity: 0 }];
    case MINIMIZE_ANIMATIONS.elasticStretch:
      const elasticTaskbarItem = $(`#taskbar-${win.id}`);
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
      const spiralTaskbarItem = $(`#taskbar-${win.id}`);
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
  if (isPerformanceMode()) return;
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
  const ripple = createElement("div");
  ripple.className = "wa-ripple";
  ripple.style.left = `${e.clientX}px`;
  ripple.style.top = `${e.clientY}px`;
  document.body.appendChild(ripple);
  ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
}

export function applyAnimationSettings(settings) {
  if (settings.openAnimation) os.storage.set(StorageKeys.windowOpenAnimation, settings.openAnimation);
  if (settings.closeAnimation) {
    os.storage.set(StorageKeys.windowCloseAnimation, settings.closeAnimation);
  }
  if (settings.minimizeAnimation) os.storage.set(StorageKeys.windowMinimizeAnimation, settings.minimizeAnimation);
  if (settings.restoreAnimation) os.storage.set(StorageKeys.windowRestoreAnimation, settings.restoreAnimation);
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
  if (isPerformanceMode()) return;
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
