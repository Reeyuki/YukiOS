import { audioMixer } from "../audioMixer.js";
import { performanceManager } from "../shared/performanceManager.js";
import { getThemeColors } from "../shared/themeEngine.js";
import { resolveIconUrl } from "../shared/assetResolver.js";
import { $, $$, createElement } from "../shared/domUtils.js";
import { applyResolution as applyResolutionTransform } from "../resolution/resolutionManager.js";
import { animateThemeChange } from "./themeTransition.js";
import { initThemeEffects } from "../shared/themeEffects.js";
import { os, StorageKeys, BusEvents } from "../framework.js";
const desktop = $("#desktop");

const LIGHT_THEMES = new Set([
  "light",
  "arctic",
  "nordic",
  "sakura",
  "cherry",
  "github-light",
  "minimal-gray",
  "paper",
  "windows-fluent",
  "material-you",
  "sepia",
  "frutiger-aero",
  "gameboy",
  "solarized-light",
  "mint",
  "cream",
  "neumorphism",
  "y2k"
]);

export function applyTheme(theme, getCustomColors) {
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true;
  const effective = theme === "auto" ? (prefersDark ? "dark" : "light") : theme;
  animateThemeChange(() => {
    document.documentElement.setAttribute("data-theme", effective);
    document.documentElement.setAttribute("data-theme-mode", LIGHT_THEMES.has(effective) ? "light" : "dark");
  });

  requestAnimationFrame(() => {
    let styleEl = $("#yukios-theme-override");
    if (!styleEl) {
      styleEl = createElement("style");
      styleEl.id = "yukios-theme-override";
      document.head.appendChild(styleEl);
    }

    let customCSS = "";
    if (effective === "light") {
      customCSS = `:root { --window-bg-color: #f2f2f2; --text-color: #111; }`;
    }

    const themeColors = getThemeColors(effective);
    if (themeColors) {
      Object.entries(themeColors).forEach(([varName, value]) => {
        customCSS += `:root[data-theme], :root[n] { --${varName}: ${value}; }\n`;
      });
    }
    const customColors = getCustomColors();
    if (customColors) {
      Object.entries(customColors).forEach(([varName, value]) => {
        customCSS += `:root[data-theme], :root[n] { --${varName}: ${value}; }\n`;
      });
    }

    styleEl.textContent = customCSS;
  });
  initThemeEffects();
}

export function applyWindowTransparency(value) {
  const opacity = Math.max(0.2, Math.min(1, Number(value)));
  let styleEl = $("#yukios-transparency-override");
  if (!styleEl) {
    styleEl = createElement("style");
    styleEl.id = "yukios-transparency-override";
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = opacity < 1 ? `.window { opacity: ${opacity} !important; }` : "";
}

export function applyTransparentUI(enabled) {
  document.documentElement.classList.toggle("transparent-ui", enabled);
}

export function applySound(enabled, volume) {
  const vol = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 1;
  audioMixer().setMaster(enabled ? vol : 0);
}

export function applyGuiScale(scale) {
  document.documentElement.style.setProperty("--gui-scale", String(scale / 100));
}

export function applyVirtualResolution(resolution, guiScale) {
  applyResolutionTransform(resolution, guiScale);
}

export function applyFontSize(size) {
  document.documentElement.style.setProperty("--font-size-scale", String(size / 100));
}

export function applyCursor(dataUrl) {
  const styleId = "yukios-custom-cursor";
  const existing = $("#" + styleId);
  if (!dataUrl) {
    existing?.remove();
    return;
  }

  const safeUrl = String(dataUrl).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const css = `
    html, body, body * { cursor: url("${safeUrl}") 0 0, auto !important; }
    input, textarea { cursor: text !important; }
  `;

  const el = existing || createElement("style");
  el.id = styleId;
  el.textContent = css;
  if (!existing) document.head.appendChild(el);
  else document.head.appendChild(el);
}

export function applyMikuCursor(enabled) {
  const styleId = "yukios-miku-cursor";
  const existing = $("#" + styleId);
  if (!enabled) {
    existing?.remove();
    return;
  }
  if (existing) return;
  const el = createElement("style");
  el.id = styleId;
  el.textContent = `html, body, body * { cursor: url("${resolveIconUrl("static/icons/cursor.webp")}"), auto; }`;
  document.head.appendChild(el);
}

export function applyDesktopStretchScrollDisabled(disabled) {
  if (!desktop) return;
  desktop.style.overflow = disabled ? "hidden" : "auto";

  const desktopRect = desktop.getBoundingClientRect();
  const windows = $$(".window");
  windows.forEach((win) => {
    if (!(win instanceof HTMLElement)) return;
    if (win.dataset.fullscreen === "true") return;

    const rect = win.getBoundingClientRect();
    const currentPos = getComputedStyle(win).position;

    if (disabled) {
      if (currentPos === "fixed") return;
      win.style.left = `${rect.left}px`;
      win.style.top = `${rect.top}px`;
      win.style.position = "fixed";
    } else {
      if (currentPos !== "fixed") return;
      const left = rect.left - desktopRect.left + desktop.scrollLeft;
      const top = rect.top - desktopRect.top + desktop.scrollTop;
      win.style.left = `${left}px`;
      win.style.top = `${top}px`;
      win.style.position = "absolute";
    }
  });
}

export function applyStartMenuSize(width, height) {
  const el = $("#start-menu") || $(".start-menu");
  if (el) {
    el.style.width = `${width}px`;
    el.style.height = `${height}px`;
  }
}

export function applyStartMenuCats(cats) {
  const el = $("#start-menu") || $(".start-menu");
  if (!el) return;
  const catNames = ["menu", "games", "system", "favorites", "settingsApp"];
  catNames.forEach((catName) => {
    const catEl =
      catName === "menu"
        ? el.querySelector('.start-cat[data-cat="all"]')
        : el.querySelector(`.start-cat[data-cat="${catName}"]`);
    if (catEl) catEl.style.display = cats[catName] !== false ? "flex" : "none";
  });
}

export function applyTrayEnabled(enabled) {
  const trayEl = $("#app-tray");
  if (trayEl) trayEl.style.display = enabled ? "flex" : "none";
}

export function applyFontFamily(fontFamily, customFontData = null) {
  const fontMap = {
    opensans: {
      family: "Open Sans",
      stack: '"Open Sans", sans-serif',
      url: "https://cdn.jsdelivr.net/fontsource/fonts/open-sans:vf@latest/latin-wght-normal.woff2",
      format: "woff2-variations",
      weight: "300 800"
    },
    inter: {
      family: "Inter",
      stack: '"Inter", sans-serif',
      url: "https://cdn.jsdelivr.net/gh/rsms/inter@master/docs/font-files/Inter-Regular.woff2",
      format: "woff2"
    },
    rubik: {
      family: "Rubik",
      stack: '"Rubik", sans-serif',
      url: "https://cdn.jsdelivr.net/gh/google/fonts/ofl/rubik/Rubik-Regular.ttf",
      format: "truetype"
    },
    sora: {
      family: "Sora",
      stack: '"Sora", sans-serif',
      url: "https://cdn.jsdelivr.net/fontsource/fonts/sora:vf@latest/latin-wght-normal.woff2",
      format: "woff2-variations",
      weight: "100 800"
    },
    jetbrainsmono: {
      family: "JetBrains Mono",
      stack: '"JetBrains Mono", monospace',
      url: "https://cdn.jsdelivr.net/gh/JetBrains/JetBrainsMono/web/woff2/JetBrainsMono-Regular.woff2",
      format: "woff2"
    },
    monocraft: {
      family: "Monocraft",
      stack: '"Monocraft", monospace',
      url: "https://cdn.jsdelivr.net/gh/IdreesInc/Monocraft@main/dist/Monocraft-ttf/Monocraft.ttf",
      format: "truetype"
    }
  };

  const fontConfig = customFontData || fontMap[fontFamily] || fontMap.opensans;

  const style = createElement("style");
  style.textContent = `
@font-face {
    font-family: '${fontConfig.family}';
    src: url('${fontConfig.url}') format('${fontConfig.format}');
    font-weight: ${fontConfig.weight || "normal"};
    font-style: normal;
}
*, *::before, *::after {
    font-family: ${fontConfig.stack} !important;
}
`;
  document.head.appendChild(style);

  document.documentElement.style.setProperty("--font-ui", fontConfig.stack);
}

export function applyUiDensity(density) {
  const densityMap = {
    compact: 0.75,
    comfortable: 1,
    spacious: 1.25
  };
  const densityValue = densityMap[density] || 1;
  document.documentElement.style.setProperty("--spacing-scale", String(densityValue));
}

export function applyDesktopIconSize(size) {
  const iconSize = Math.max(32, Math.min(128, Number(size) || 48));
  document.documentElement.style.setProperty("--icon-w", `${iconSize}px`);
  document.documentElement.style.setProperty("--icon-img-s", `${iconSize}px`);
  document.documentElement.style.setProperty("--icon-h", `${iconSize + 20}px`);
}

export function applyTaskbarScale(scale) {
  const s = Math.max(50, Math.min(200, Number(scale) || 100)) / 100;
  document.documentElement.style.setProperty("--taskbar-scale", String(s));
  document.documentElement.style.setProperty("--taskbar-h", `${3.2 * s}em`);
  document.documentElement.style.setProperty("--taskbar-v-w", `${3.2 * s}em`);
}

export function applyDockIconSize(size) {
  const iconSize = Math.max(28, Math.min(80, Number(size) || 43));
  document.documentElement.style.setProperty("--dock-icon-size", `${iconSize}px`);
}

export function applyDockScale(scale) {
  const s = Math.max(50, Math.min(200, Number(scale) || 100)) / 100;
  document.documentElement.style.setProperty("--dock-scale", String(s));
}

export function applyDockAnimationSpeed(speed) {
  const s = Math.max(0.05, Math.min(0.5, Number(speed) || 0.2));
  document.documentElement.style.setProperty("--dock-anim-speed", `${s}s`);
}

export function applyThemeConfig(config) {
  if (!config || typeof config !== "object") return;
  if (config.fontFamily && typeof config.fontFamily === "string") {
    applyFontFamily(config.fontFamily);
    os.storage.set(StorageKeys.fontFamily, config.fontFamily);
  }
  if (config.density && typeof config.density === "string") {
    applyUiDensity(config.density);
    os.storage.set(StorageKeys.uiDensity, config.density);
  }
  if (typeof config.windowTransparency === "number" && Number.isFinite(config.windowTransparency)) {
    const pct = Math.max(20, Math.min(100, Math.round(config.windowTransparency)));
    applyWindowTransparency(pct / 100);
    os.storage.set(StorageKeys.windowTransparency, String(pct));
  }
  os.events.emit(BusEvents.SETTINGS_CHANGED, { key: "themeConfig", value: config });
}
