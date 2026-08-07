import { StorageKeys } from "./StorageKeys.js";
import { os } from "./os/index.js";
import { $, createElement } from "./shared/domUtils.js";

const YURI_THEME_COLORS = {
  brand: "oklch(66% 0.2 352)",
  "brand-hover": "oklch(58% 0.19 352)",
  "brand-dark": "oklch(46% 0.18 352)",
  "brand-glow": "oklch(66% 0.18 352 / 0.2)",
  "brand-dim": "oklch(66% 0.19 352 / 0.13)",
  "bg-base": "oklch(15% 0.035 355)",
  "bg-elev-1": "oklch(20% 0.03 355)",
  "bg-elev-2": "oklch(26% 0.028 355)",
  "bg-elev-3": "oklch(32% 0.026 355)",
  "bg-primary": "oklch(17% 0.035 355)",
  "bg-secondary": "oklch(23% 0.03 355)",
  "surface-solid": "oklch(20% 0.03 355)",
  "surface-hover": "oklch(28% 0.026 355)",
  glass: "oklch(96% 0.05 355 / 0.055)",
  "glass-strong": "oklch(96% 0.05 355 / 0.09)",
  "glass-border": "oklch(98% 0.06 355 / 0.12)",
  "glass-hover": "oklch(96% 0.07 355 / 0.14)",
  "text-primary": "oklch(96% 0.012 355)",
  "text-secondary": "oklch(78% 0.045 355)",
  "text-muted": "oklch(64% 0.045 355)",
  "text-on-brand": "#ffffff",
  "tx-on-brand": "#ffffff",
  border: "oklch(88% 0.05 355 / 0.2)",
  "border-strong": "oklch(88% 0.05 355 / 0.3)",
  "overlay-bg": "oklch(8% 0.02 355 / 0.6)",
  error: "oklch(62% 0.2 12)",
  "error-bg": "oklch(62% 0.2 12 / 0.13)",
  "error-border": "oklch(62% 0.2 12 / 0.26)",
  charging: "oklch(70% 0.16 150)",
  "menu-bg": "oklch(24% 0.028 355)",
  "window-bg": "oklch(20% 0.03 355)",
  "shadow-color": "rgba(30, 0, 18, 0.7)"
};

const YURI_EXTRA_CSS = `
html[data-yuri] {
  color-scheme: dark;
  --yuri-accent-1: #ff2d78;
  --yuri-accent-2: #ff7ab6;
  --yuri-accent-3: #b388ff;
}
html[data-yuri] ::selection {
  background: oklch(66% 0.19 352 / 0.45);
  color: #fff;
}
html[data-yuri] *::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, #ff4d94, #b0578a) !important;
  border: 2px solid oklch(20% 0.03 355) !important;
}
html[data-yuri] *::-webkit-scrollbar-track {
  background: oklch(17% 0.035 355) !important;
}
html[data-yuri] .window-title,
html[data-yuri] .win-titlebar {
  background: linear-gradient(180deg, oklch(30% 0.09 352), oklch(22% 0.06 352)) !important;
}
html[data-yuri] .taskbar,
html[data-yuri] #taskbar,
html[data-yuri] .taskbar-apps {
  background: linear-gradient(180deg, oklch(26% 0.09 352 / 0.9), oklch(19% 0.06 352 / 0.92)) !important;
}
html[data-yuri] .start-menu,
html[data-yuri] #start-menu {
  background: linear-gradient(160deg, oklch(24% 0.08 352 / 0.92), oklch(17% 0.045 355 / 0.95)) !important;
}
html[data-yuri] .start-menu-header,
html[data-yuri] .start-cat-header {
  color: #ff8ab8 !important;
}
html[data-yuri] .start-menu-app-name,
html[data-yuri] .taskbar-item-label {
  color: oklch(88% 0.04 355) !important;
}
html[data-yuri] .app-icon:hover,
html[data-yuri] .desktop-icon:hover {
  filter: drop-shadow(0 0 10px oklch(66% 0.19 352 / 0.6)) !important;
}
html[data-yuri] .window {
  box-shadow:
    0 24px 64px oklch(8% 0.04 355 / 0.7),
    0 0 0 1px oklch(98% 0.06 355 / 0.14),
    inset 0 1px 0 oklch(100% 0 0 / 0.08) !important;
}
html[data-yuri] .window-control-btn:hover,
html[data-yuri] .wm-btn:hover {
  background: oklch(66% 0.19 352 / 0.22) !important;
  color: #ffc2da !important;
}
html[data-yuri] .boot-brand .boot-letter {
  color: #ff7ab6 !important;
  text-shadow: 0 0 18px oklch(66% 0.2 352 / 0.65) !important;
}
html[data-yuri] .session-mode-btn.active,
html[data-yuri] .session-mode-btn:hover {
  border-color: #ff4d94 !important;
  box-shadow: 0 0 16px oklch(66% 0.19 352 / 0.5) !important;
}
html[data-yuri] #session-overlay {
  background: radial-gradient(120% 120% at 50% 0%, oklch(24% 0.07 352), oklch(12% 0.03 355) 70%) !important;
}
html[data-yuri] .session-brand {
  color: var(--yuri-accent-2);
  text-shadow: 0 2px 12px rgba(255, 45, 120, 0.6);
}
`;

let active = false;
let initialized = false;
let randomTriggered = false;

function isTrue(value) {
  return value === true || value === "true" || value === "1";
}

function isForced() {
  try {
    const viaBridge = os.storage.get(StorageKeys.yuriMode);
    if (viaBridge !== null) return isTrue(viaBridge);
  } catch {}
  try {
    const raw = localStorage.getItem(StorageKeys.yuriMode);
    if (raw === null) return false;
    let parsed = raw;
    try {
      parsed = JSON.parse(raw);
    } catch {}
    return isTrue(parsed);
  } catch {
    return false;
  }
}

export function initYuriEasterEgg() {
  if (initialized) return active;
  initialized = true;
  try {
    const urlParam = new URLSearchParams(window.location.search).get("yuri");
    const forced = urlParam !== null ? isTrue(urlParam) : null;
    if (forced === true) {
      active = true;
    } else if (urlParam !== null) {
      active = false;
    } else if (isForced()) {
      active = true;
    } else {
      active = Math.random() < 0.01;
      randomTriggered = active;
    }
  } catch {
    active = false;
  }
  return active;
}

export function wasRandomYuriTrigger() {
  return randomTriggered;
}

export function isYuri() {
  return initYuriEasterEgg();
}

export function osName() {
  return isYuri() ? "YuriOS" : "YukiOS";
}

export function yuriPageTitle() {
  return isYuri() ? "Yuri OS" : null;
}

export function brand(text) {
  if (!isYuri() || typeof text !== "string") return text;
  return text.replace(/YukiOS|Yuki OS/gi, "YuriOS").replace(/Yuki/gi, "Yuri");
}

export function applyYuriTheme() {
  if (!isYuri()) return;
  const root = document.documentElement;
  root.setAttribute("data-yuri", "true");
  root.setAttribute("data-theme", "yuri");
  root.setAttribute("data-theme-mode", "dark");
  let override = $("#yuri-theme-override");
  if (!override) {
    override = createElement("style");
    override.id = "yuri-theme-override";
    document.head.appendChild(override);
  }
  const vars = Object.entries(YURI_THEME_COLORS)
    .map(([name, value]) => `--${name}: ${value} !important;`)
    .join("\n  ");
  override.textContent = `:root { ${vars} } ${YURI_EXTRA_CSS}`;
  if (!override.parentNode) {
    document.head.appendChild(override);
  }
  const themeOverride = $("#yukios-theme-override");
  if (themeOverride && themeOverride.nextSibling) {
    document.head.insertBefore(override, themeOverride.nextSibling);
  }
}

export function toggleYuriMode(enabled) {
  os.storage.set(StorageKeys.yuriMode, enabled ? "true" : "false");
}
