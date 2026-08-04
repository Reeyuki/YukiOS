import { os, StorageKeys, BusEvents } from "../framework.js";
import { sanitizeBackground, THEME_EFFECT_OPTIONS } from "./themeContract.js";

const EFFECTS_STYLE_ID = "yukios-theme-effects";

function applyEffectsStyle(effects) {
  const hasBg = effects && typeof effects.background === "string" && effects.background.length > 0;
  const existing = document.getElementById(EFFECTS_STYLE_ID);
  if (!hasBg) {
    if (existing) existing.remove();
    return;
  }
  const el = existing || document.createElement("style");
  el.id = EFFECTS_STYLE_ID;
  let css = ":root { } ";
  if (hasBg) css += `body { background: ${effects.background} !important; }`;
  el.textContent = css;
  if (!existing) document.head.appendChild(el);
}

export function getStoredEffects() {
  try {
    const stored = os.storage.get(StorageKeys.themeHubEffects);
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) return null;
    return stored;
  } catch (e) {
    return null;
  }
}

export function applyThemeEffects(effects) {
  try {
    if (!effects || typeof effects !== "object") return;
    const sanitized = {};
    if (typeof effects.windowAnimation === "string" && THEME_EFFECT_OPTIONS.open.includes(effects.windowAnimation)) {
      os.storage.set(StorageKeys.windowOpenAnimation, effects.windowAnimation);
      sanitized.windowAnimation = effects.windowAnimation;
    }
    if (typeof effects.closeAnimation === "string" && THEME_EFFECT_OPTIONS.close.includes(effects.closeAnimation)) {
      os.storage.set(StorageKeys.windowCloseAnimation, effects.closeAnimation);
      sanitized.closeAnimation = effects.closeAnimation;
    }
    if (typeof effects.minimizeAnimation === "string" && THEME_EFFECT_OPTIONS.minimize.includes(effects.minimizeAnimation)) {
      os.storage.set(StorageKeys.windowMinimizeAnimation, effects.minimizeAnimation);
      sanitized.minimizeAnimation = effects.minimizeAnimation;
    }
    if (typeof effects.cursorOff === "boolean") {
      if (effects.cursorOff) {
        os.storage.set(StorageKeys.cursorEffectEnabled, false);
      }
      sanitized.cursorOff = effects.cursorOff;
    }
    if (typeof effects.background === "string") {
      const background = sanitizeBackground(effects.background);
      if (background !== null) sanitized.background = background;
    }
    applyEffectsStyle(sanitized);
    if (Object.keys(sanitized).length > 0) {
      os.storage.set(StorageKeys.themeHubEffects, sanitized);
    }
    os.events.emit(BusEvents.SETTINGS_CHANGED, { key: "themeEffects", value: sanitized });
  } catch (e) {
    console.warn("Failed to apply theme effects:", e);
  }
}

export function clearThemeEffects() {
  try {
    os.storage.set(StorageKeys.windowOpenAnimation, "scaleCenter");
    os.storage.set(StorageKeys.windowCloseAnimation, "scaleDownCenter");
    os.storage.set(StorageKeys.windowMinimizeAnimation, "taskbarShrink");
    os.storage.set(StorageKeys.cursorEffectEnabled, true);
    const existing = document.getElementById(EFFECTS_STYLE_ID);
    if (existing) existing.remove();
    os.storage.remove(StorageKeys.themeHubEffects);
    os.events.emit(BusEvents.SETTINGS_CHANGED, { key: "themeEffects", value: {} });
  } catch (e) {
    console.warn("Failed to clear theme effects:", e);
  }
}

export function initThemeEffects() {
  try {
    const stored = getStoredEffects();
    if (!stored) return;
    if (stored.background) {
      applyEffectsStyle(stored);
    }
  } catch (e) {
    console.warn("Failed to init theme effects:", e);
  }
}

export function collectCurrentEffects() {
  return {
    windowAnimation: os.storage.get(StorageKeys.windowOpenAnimation) || null,
    closeAnimation: os.storage.get(StorageKeys.windowCloseAnimation) || null,
    minimizeAnimation: os.storage.get(StorageKeys.windowMinimizeAnimation) || null,
    cursorOff: os.storage.get(StorageKeys.cursorEffectEnabled) === false,
    background: null
  };
}
