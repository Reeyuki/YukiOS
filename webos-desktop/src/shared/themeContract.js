export const THEME_CONTRACT_VERSION = 2;

export const THEME_COLOR_KEYS = [
  "brand",
  "brand-hover",
  "brand-dark",
  "brand-glow",
  "brand-dim",
  "bg-base",
  "bg-elev-1",
  "bg-elev-2",
  "bg-elev-3",
  "bg-primary",
  "bg-secondary",
  "surface-solid",
  "surface-hover",
  "glass",
  "glass-strong",
  "glass-border",
  "glass-hover",
  "text-primary",
  "text-secondary",
  "text-muted",
  "text-on-brand",
  "tx-on-brand",
  "border",
  "border-strong",
  "overlay-bg",
  "error",
  "error-bg",
  "error-border",
  "charging",
  "menu-bg",
  "window-bg",
  "shadow-color"
];

export const THEME_EFFECT_OPTIONS = {
  open: [
    "instant",
    "fade",
    "scaleCenter",
    "scaleFromSource",
    "slideUp",
    "slideLeft",
    "slideRight",
    "glassBlurin",
    "elasticBounce",
    "blurReveal",
    "perspective3D",
    "cornerUnfold",
    "slideInGrowth"
  ],
  close: [
    "instant",
    "scaleDownCenter",
    "scaleToOrigin",
    "fadeOut",
    "slideDown",
    "burn",
    "shrinkToPoint",
    "dissolveBlur",
    "fallApart"
  ],
  minimize: [
    "instant",
    "taskbarShrink",
    "dockZoomShrink",
    "magicLamp",
    "fadeToTaskbar",
    "elasticStretch",
    "spiralDown"
  ],
  restore: ["fromTaskbar", "scaleCenter", "fade", "slideUp", "instant"]
};

export const THEME_CONFIG_FONTS = ["opensans", "inter", "rubik", "sora", "jetbrainsmono", "monocraft"];
export const THEME_CONFIG_DENSITIES = ["compact", "comfortable", "spacious"];

const COLOR_VALUE_RE =
  /^(#[0-9a-fA-F]{3,8}|rgba?\([^()]{1,80}\)|hsla?\([^()]{1,80}\)|oklch\([^()]{1,120}\)|var\(--[a-zA-Z0-9-]{1,64}\)|transparent|currentcolor|none|inherit)$/i;
const COLOR_BLOCKED_RE = /url\(|expression|javascript/i;
const BACKGROUND_VALUE_RE = /^[a-zA-Z0-9#%(),.#\s\-/]+$/;
const BACKGROUND_BLOCKED_RE = /url\(|expression|javascript/i;

export function sanitizeColorValue(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!COLOR_VALUE_RE.test(trimmed)) return null;
  if (COLOR_BLOCKED_RE.test(trimmed)) return null;
  return trimmed;
}

export function sanitizeBackground(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 300) return null;
  if (!BACKGROUND_VALUE_RE.test(trimmed)) return null;
  if (BACKGROUND_BLOCKED_RE.test(trimmed)) return null;
  return trimmed;
}

export function sanitizeThemeContract(input) {
  const errors = [];
  if (!input || typeof input !== "object") {
    return { ok: false, contract: null, errors: ["Invalid theme data"] };
  }
  if (input.schemaVersion !== 1 && input.schemaVersion !== 2) {
    errors.push("Unsupported schema version");
  }
  if (input.type !== "yukios-theme") {
    errors.push("Invalid theme type");
  }
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name || name.length > 48) {
    errors.push("Theme name must be 1-48 characters");
  }
  const description = typeof input.description === "string" ? input.description.trim().slice(0, 200) : "";
  const author = typeof input.author === "string" ? input.author.trim().slice(0, 32) : "";
  const icon = typeof input.icon === "string" ? input.icon.trim().slice(0, 64) : "";

  const colors = {};
  const rawColors = input.colors && typeof input.colors === "object" ? input.colors : {};
  THEME_COLOR_KEYS.forEach((key) => {
    const value = sanitizeColorValue(rawColors[key]);
    if (value !== null) colors[key] = value;
  });
  if (Object.keys(colors).length === 0) {
    errors.push("Theme must contain at least one valid color");
  }

  const effects = {};
  const rawEffects = input.effects && typeof input.effects === "object" ? input.effects : {};
  if (rawEffects.windowAnimation != null) {
    if (THEME_EFFECT_OPTIONS.open.includes(rawEffects.windowAnimation)) {
      effects.windowAnimation = rawEffects.windowAnimation;
    }
  }
  if (rawEffects.closeAnimation != null) {
    if (THEME_EFFECT_OPTIONS.close.includes(rawEffects.closeAnimation)) {
      effects.closeAnimation = rawEffects.closeAnimation;
    }
  }
  if (rawEffects.minimizeAnimation != null) {
    if (THEME_EFFECT_OPTIONS.minimize.includes(rawEffects.minimizeAnimation)) {
      effects.minimizeAnimation = rawEffects.minimizeAnimation;
    }
  }
  if (rawEffects.restoreAnimation != null) {
    if (THEME_EFFECT_OPTIONS.restore.includes(rawEffects.restoreAnimation)) {
      effects.restoreAnimation = rawEffects.restoreAnimation;
    }
  }
  if (typeof rawEffects.cursorOff === "boolean") {
    effects.cursorOff = rawEffects.cursorOff;
  }
  const background = sanitizeBackground(rawEffects.background);
  if (background !== null) {
    effects.background = background;
  }

  const config = {};
  const rawConfig = input.config && typeof input.config === "object" ? input.config : {};
  if (THEME_CONFIG_FONTS.includes(rawConfig.fontFamily)) config.fontFamily = rawConfig.fontFamily;
  if (THEME_CONFIG_DENSITIES.includes(rawConfig.density)) config.density = rawConfig.density;
  if (typeof rawConfig.windowTransparency === "number" && Number.isFinite(rawConfig.windowTransparency)) {
    config.windowTransparency = Math.max(20, Math.min(100, Math.round(rawConfig.windowTransparency)));
  }

  if (errors.length > 0) {
    return { ok: false, contract: null, errors };
  }

  const contract = {
    schemaVersion: THEME_CONTRACT_VERSION,
    type: "yukios-theme",
    name,
    description,
    author,
    icon: icon || "fas fa-palette",
    colors,
    effects,
    config
  };
  return { ok: true, contract, errors: [] };
}

export function buildThemeContract({ name, description, author, icon, colors, effects, config } = {}) {
  const result = sanitizeThemeContract({
    schemaVersion: THEME_CONTRACT_VERSION,
    type: "yukios-theme",
    name,
    description,
    author,
    icon,
    colors,
    effects: effects || {},
    config: config || {}
  });
  if (!result.ok) {
    throw new Error(result.errors[0]);
  }
  return result.contract;
}

export function themeToContract(theme, effects) {
  return buildThemeContract({
    name: theme.label,
    description: "",
    author: "",
    icon: theme.icon || "fas fa-palette",
    colors: theme.colors,
    effects: effects || {}
  });
}

function slugifyName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/^-+|-+$/g, "");
}

function randomSuffix(length) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function contractToThemeData(contract) {
  const slug = slugifyName(contract.name);
  const suffix = `-${randomSuffix(4)}`;
  const value = slug ? `${slug}${suffix}` : `theme${suffix}`;
  return {
    value,
    label: contract.name,
    icon: contract.icon,
    colors: contract.colors,
    effects: contract.effects
  };
}

export function themeShareCode(contract) {
  try {
    const json = JSON.stringify(contract);
    return btoa(unescape(encodeURIComponent(json)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  } catch (e) {
    return "";
  }
}

export function parseShareCode(code) {
  try {
    if (typeof code !== "string" || !code) return null;
    const normalized = code.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const json = decodeURIComponent(escape(atob(padded)));
    const parsed = JSON.parse(json);
    const result = sanitizeThemeContract(parsed);
    if (!result.ok) return null;
    return result.contract;
  } catch (e) {
    return null;
  }
}

export function buildPreviewGradient(contract) {
  const colors = contract && contract.colors ? contract.colors : {};
  const brand = colors.brand;
  const bgPrimary = colors["bg-primary"];
  if (brand && bgPrimary) {
    return `linear-gradient(135deg, ${brand}, ${bgPrimary})`;
  }
  if (brand) {
    return `linear-gradient(135deg, ${brand}, ${brand})`;
  }
  if (bgPrimary) {
    return `linear-gradient(135deg, ${bgPrimary}, ${bgPrimary})`;
  }
  return "linear-gradient(135deg, #8b5cf6, #312e81)";
}

export function themeScoreLabel(theme) {
  if (theme && typeof theme.score === "number") {
    if (theme.score > 0) return `+${theme.score}`;
    if (theme.score < 0) return `${theme.score}`;
    return "0";
  }
  return "0";
}
