import { StorageKeys } from "../settings/settings.js";
import { os } from "../os/index.js";

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
  cornerUnfold: "cornerUnfold"
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

function getSetting(key, fallback) {
  return os.storage.get(key) ?? fallback;
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

function isTurboMode() {
  const mode = getSetting(StorageKeys.turboMode, "high");
  return mode === "turbo";
}

export function getTaskbarIconRect(winId) {
  const taskbarItem = document.getElementById(`taskbar-${winId}`);
  if (!taskbarItem) return null;
  return taskbarItem.getBoundingClientRect();
}

export function animateWindowOpen(win) {
  if (isTurboMode()) return;

  // Exclude browser app from animations
  if (win.id && win.id.startsWith("browser-app-")) return;

  const anim = getOpenAnim();
  if (anim === OPEN_ANIMATIONS.instant) return;

  const duration = 300 * getAnimationSpeed();

  win.getAnimations().forEach((anim) => anim.cancel());

  const keyframes = getOpenKeyframes(anim, win);

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

function getOpenKeyframes(animType, win) {
  switch (animType) {
    case OPEN_ANIMATIONS.fade:
      return [{ opacity: 0 }, { opacity: 1 }];
    case OPEN_ANIMATIONS.scaleCenter:
      return [
        { opacity: 0, transform: "scale(0.9)" },
        { opacity: 1, transform: "scale(1)" }
      ];
    case OPEN_ANIMATIONS.scaleFromSource:
      const taskbarItem = document.getElementById(`taskbar-${win.id}`);
      if (taskbarItem) {
        const tbRect = taskbarItem.getBoundingClientRect();
        const winRect = win.getBoundingClientRect();
        const dx = tbRect.left + tbRect.width / 2 - (winRect.left + winRect.width / 2);
        const dy = tbRect.top + tbRect.height / 2 - (winRect.top + winRect.height / 2);
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
        { opacity: 0, transform: "scale(0.9)" }
      ];
    case CLOSE_ANIMATIONS.scaleToOrigin:
      const taskbarItem = document.getElementById(`taskbar-${win.id}`);
      if (taskbarItem) {
        const tbRect = taskbarItem.getBoundingClientRect();
        const winRect = win.getBoundingClientRect();
        const dx = tbRect.left + tbRect.width / 2 - (winRect.left + winRect.width / 2);
        const dy = tbRect.top + tbRect.height / 2 - (winRect.top + winRect.height / 2);
        return [
          { opacity: 1, transform: "translate(0, 0) scale(1)" },
          { opacity: 0, transform: `translate(${dx}px, ${dy}px) scale(0.5)` }
        ];
      }
      return [
        { opacity: 1, transform: "scale(1)" },
        { opacity: 0, transform: "scale(0.9)" }
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
        { opacity: 1, filter: "brightness(1)" },
        { opacity: 0, filter: "brightness(2) blur(5px)" }
      ];
    case CLOSE_ANIMATIONS.shrinkToPoint:
      return [
        { opacity: 1, transform: "scale(1)" },
        { opacity: 0.5, transform: "scale(0.3)", offset: 0.5 },
        { opacity: 0, transform: "scale(0)" }
      ];
    case CLOSE_ANIMATIONS.dissolveBlur:
      return [
        { opacity: 1, filter: "blur(0)" },
        { opacity: 0.5, filter: "blur(15px)", offset: 0.5 },
        { opacity: 0, filter: "blur(30px)" }
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

  const duration = 300 * getAnimationSpeed();

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
  switch (animType) {
    case MINIMIZE_ANIMATIONS.taskbarShrink:
      const taskbarItem = document.getElementById(`taskbar-${win.id}`);
      if (taskbarItem) {
        const tbRect = taskbarItem.getBoundingClientRect();
        const winRect = win.getBoundingClientRect();
        const dx = tbRect.left + tbRect.width / 2 - (winRect.left + winRect.width / 2);
        const dy = tbRect.top + tbRect.height / 2 - (winRect.top + winRect.height / 2);
        return [
          { opacity: 1, transform: "translate(0, 0) scale(1)" },
          { opacity: 0, transform: `translate(${dx}px, ${dy}px) scale(0.1)` }
        ];
      }
      return [{ opacity: 1 }, { opacity: 0 }];
    case MINIMIZE_ANIMATIONS.dockZoomShrink:
      const taskbar = document.getElementById("taskbar");
      const isBottom = !taskbar || taskbar.classList.contains("position-bottom");
      return [
        { opacity: 1, transform: "scale(1)" },
        { opacity: 0, transform: isBottom ? "scaleY(0)" : "scaleX(0)" }
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
        const tbRect = elasticTaskbarItem.getBoundingClientRect();
        const winRect = win.getBoundingClientRect();
        const dx = tbRect.left + tbRect.width / 2 - (winRect.left + winRect.width / 2);
        const dy = tbRect.top + tbRect.height / 2 - (winRect.top + winRect.height / 2);
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
        const tbRect = spiralTaskbarItem.getBoundingClientRect();
        const winRect = win.getBoundingClientRect();
        const dx = tbRect.left + tbRect.width / 2 - (winRect.left + winRect.width / 2);
        const dy = tbRect.top + tbRect.height / 2 - (winRect.top + winRect.height / 2);
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

export function initFocusEffects(wm) {
  if (isTurboMode()) return;
}

export function applyFocusGlow(win) {
  if (isTurboMode()) return;
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
  if (isTurboMode()) return;
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

export function applyPhysicsInertia(win, vx, vy) {
  if (isTurboMode()) return;
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
  if (isTurboMode()) return;
  el.animate(
    [
      { opacity: 0, transform: "scale(0.95)" },
      { opacity: 1, transform: "scale(1)" }
    ],
    {
      duration: 200,
      easing: "cubic-bezier(0.16, 1, 0.3, 1)",
      fill: "forwards"
    }
  );
}

export function animateStartMenuClose(el) {
  if (isTurboMode()) return;
  el.animate(
    [
      { opacity: 1, transform: "scale(1)" },
      { opacity: 0, transform: "scale(0.95)" }
    ],
    {
      duration: 150,
      easing: "ease-in",
      fill: "forwards"
    }
  );
}

export function animateContextMenuPop(el) {
  if (isTurboMode()) return;
  el.animate(
    [
      { opacity: 0, transform: "scale(0.95)" },
      { opacity: 1, transform: "scale(1)" }
    ],
    {
      duration: 120,
      easing: "cubic-bezier(0.16, 1, 0.3, 1)",
      fill: "forwards"
    }
  );
}

export function animateNotificationIn(el) {
  if (isTurboMode()) return;
  el.animate(
    [
      { opacity: 0, transform: "translateY(10px)" },
      { opacity: 1, transform: "translateY(0)" }
    ],
    {
      duration: 250,
      easing: "cubic-bezier(0.16, 1, 0.3, 1)",
      fill: "forwards"
    }
  );
}

export function animateWorkspaceSlide(direction, onDone) {
  if (isTurboMode()) {
    onDone?.();
    return;
  }
  const desktop = document.getElementById("desktop");
  if (!desktop) {
    onDone?.();
    return;
  }
  const translateX = direction === "left" ? "-20px" : "20px";
  desktop.animate(
    [{ transform: "translateX(0)" }, { transform: `translateX(${translateX})` }, { transform: "translateX(0)" }],
    {
      duration: 350,
      easing: "ease-in-out"
    }
  ).onfinish = () => onDone?.();
}

export function animateScreenFreezeBlur(onDone) {
  if (isTurboMode()) {
    onDone?.();
    return;
  }
  const overlay = document.createElement("div");
  overlay.className = "wa-freeze-overlay";
  document.body.appendChild(overlay);

  overlay.animate([{ opacity: 0 }, { opacity: 1 }], {
    duration: 80,
    fill: "forwards"
  }).onfinish = () => {
    overlay.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 250,
      fill: "forwards"
    }).onfinish = () => {
      overlay.remove();
      onDone?.();
    };
  };
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
