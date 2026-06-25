import { audioMixer } from "../audioMixer.js";
import { turboManager } from "../shared/turboManager.js";
import { getThemeColors } from "../shared/themeEngine.js";
import { resolveIconUrl } from "../shared/assetResolver.js";
const desktop = document.getElementById("desktop");

const LIGHT_THEMES = new Set([
  "light",
  "arctic",
  "nordic",
  "sakura",
  "cherry",
  "github-light",
  "minimal-gray",
  "paper",
  "macos-fluent",
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
  document.documentElement.setAttribute("data-theme", effective);
  document.documentElement.setAttribute("data-theme-mode", LIGHT_THEMES.has(effective) ? "light" : "dark");

  let styleEl = document.getElementById("yukios-theme-override");
  if (!styleEl) {
    styleEl = document.createElement("style");
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
      customCSS += `:root { --${varName}: ${value}; }\n`;
    });
  } else {
    const customColors = getCustomColors();
    if (customColors) {
      Object.entries(customColors).forEach(([varName, value]) => {
        customCSS += `:root { --${varName}: ${value}; }\n`;
      });
    }
  }

  styleEl.textContent = customCSS;
}

export function applyWindowTransparency(value) {
  const opacity = Math.max(0.2, Math.min(1, Number(value)));
  let styleEl = document.getElementById("yukios-transparency-override");
  if (!styleEl) {
    styleEl = document.createElement("style");
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
  const scaleValue = scale / 100;
  document.documentElement.style.setProperty("--gui-scale", String(scaleValue));
  document.documentElement.style.transform = `scale(${scaleValue})`;
  document.documentElement.style.transformOrigin = "top left";
  document.documentElement.style.width = `${100 / scaleValue}%`;
  document.documentElement.style.height = `${100 / scaleValue}%`;
}

export function applyFontSize(size) {
  document.documentElement.style.setProperty("--font-size-scale", String(size / 100));
}

export function applyCursor(dataUrl) {
  const styleId = "yukios-custom-cursor";
  const existing = document.getElementById(styleId);
  if (!dataUrl) {
    existing?.remove();
    return;
  }

  const safeUrl = String(dataUrl).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const css = `
    html, body, body * { cursor: url("${safeUrl}") 0 0, auto !important; }
    input, textarea { cursor: text !important; }
  `;

  const el = existing || document.createElement("style");
  el.id = styleId;
  el.textContent = css;
  if (!existing) document.head.appendChild(el);
  else document.head.appendChild(el);
}

export function applyMikuCursor(enabled) {
  const styleId = "yukios-miku-cursor";
  const existing = document.getElementById(styleId);
  if (!enabled) {
    existing?.remove();
    return;
  }
  if (existing) return;
  const el = document.createElement("style");
  el.id = styleId;
  el.textContent = `html, body, body * { cursor: url("${resolveIconUrl("static/icons/cursor.webp")}"), auto; }`;
  document.head.appendChild(el);
}

export function applyDesktopStretchScrollDisabled(disabled) {
  if (!desktop) return;
  desktop.style.overflow = "auto";

  const desktopRect = desktop.getBoundingClientRect();
  const windows = document.querySelectorAll(".window");
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
  const el = document.getElementById("start-menu") || document.querySelector(".start-menu");
  if (el) {
    el.style.width = `${width}px`;
    el.style.height = `${height}px`;
  }
}

export function applyStartMenuCats(cats) {
  const el = document.getElementById("start-menu") || document.querySelector(".start-menu");
  if (!el) return;
  const catNames = ["menu", "games", "system", "favorites", "customize", "settingsApp"];
  catNames.forEach((catName) => {
    const catEl = el.querySelector(`.start-cat[data-cat="${catName}"]`);
    if (catEl) catEl.style.display = cats[catName] !== false ? "flex" : "none";
  });
}

export function applyTurboMode(mode, services) {
  turboManager.setMode(mode);
}

export function applyTrayEnabled(enabled) {
  const trayEl = document.getElementById("app-tray");
  if (trayEl) trayEl.style.display = enabled ? "flex" : "none";
}

export function applyFontFamily(fontFamily) {
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

  const fontConfig = fontMap[fontFamily] || fontMap.opensans;

  const style = document.createElement("style");
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
  const iconSize = Math.max(32, Math.min(128, Number(size) || 64));
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
