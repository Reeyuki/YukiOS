import { desktop } from "../desktop.js";
import { audioMixer } from "../audioMixer.js";
import { turboManager } from "../shared/turboManager.js";

export function applyTheme(theme, getCustomColors) {
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true;
  const effective = theme === "auto" ? (prefersDark ? "dark" : "light") : theme;
  document.documentElement.setAttribute("data-theme", effective);

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

  const customColors = getCustomColors();
  if (customColors) {
    Object.entries(customColors).forEach(([varName, value]) => {
      customCSS += `:root { --${varName}: ${value}; }\n`;
    });
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
  audioMixer.setMaster(enabled ? vol : 0);
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
  el.textContent = `html, body, body * { cursor: url("static/icons/cursor.webp"), auto; }`;
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
