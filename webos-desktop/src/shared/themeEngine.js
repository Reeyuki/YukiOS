import { StorageKeys, os } from "../framework.js";

const BUILTIN_THEMES = [
  { value: "dark", icon: "fas fa-moon", label: "Dark", category: "basic" },
  { value: "light", icon: "fas fa-sun", label: "Light", category: "basic" },
  { value: "auto", icon: "fas fa-circle-half-stroke", label: "Auto", category: "basic" },
  { value: "cyber", icon: "fas fa-bolt", label: "Cyber", category: "special" },
  { value: "arctic", icon: "fas fa-snowflake", label: "Arctic", category: "special" },
  { value: "crt", icon: "fas fa-terminal", label: "CRT", category: "special" },
  { value: "sakura", icon: "fas fa-fan", label: "Sakura", category: "special" },
  { value: "oled", icon: "fas fa-tv", label: "OLED", category: "special" },
  { value: "nordic", icon: "fas fa-mountain", label: "Nordic", category: "special" },
  { value: "forest", icon: "fas fa-tree", label: "Forest", category: "special" },
  { value: "high-contrast", icon: "fas fa-adjust", label: "High Contrast", category: "special" },
  { value: "vaporwave", icon: "fas fa-sun", label: "Vaporwave", category: "special" },
  { value: "gameboy", icon: "fas fa-gamepad", label: "Gameboy", category: "special" },
  { value: "frutiger-aero", icon: "fas fa-apple-whole", label: "Frutiger Aero", category: "special" },
  { value: "dracula", icon: "fas fa-skull", label: "Dracula", category: "special" },
  { value: "solarized-dark", icon: "fas fa-sun", label: "Solarized Dark", category: "special" },
  { value: "solarized-light", icon: "fas fa-cloud-sun", label: "Solarized Light", category: "special" },
  { value: "github-light", icon: "fab fa-github", label: "GitHub Light", category: "special" },
  { value: "github-dark", icon: "fab fa-github", label: "GitHub Dark", category: "special" },
  { value: "minimal-gray", icon: "fas fa-circle", label: "Minimal Gray", category: "special" },
  { value: "paper", icon: "fas fa-file-alt", label: "Paper", category: "special" },
  { value: "macos-fluent", icon: "fab fa-apple", label: "MacOS Fluent", category: "special" },
  { value: "windows-fluent", icon: "fab fa-windows", label: "Windows Fluent", category: "special" },
  { value: "material-you", icon: "fas fa-palette", label: "Material You", category: "special" },
  { value: "sepia", icon: "fas fa-book", label: "Sepia", category: "special" },
  { value: "hatsune-miku", icon: "fas fa-music", label: "Hatsune Miku", category: "special" },
  { value: "star-wars-dark", icon: "fas fa-skull", label: "Star Wars Dark", category: "special" },
  { value: "amber", icon: "fas fa-fire", label: "Amber", category: "special" },
  { value: "coral", icon: "fas fa-water", label: "Coral", category: "special" },
  { value: "slate", icon: "fas fa-circle", label: "Slate", category: "special" },
  { value: "mint", icon: "fas fa-leaf", label: "Mint", category: "special" },
  { value: "cream", icon: "fas fa-feather", label: "Cream", category: "special" },
  { value: "glass", icon: "fas fa-water", label: "Glass", category: "special" },
  { value: "neumorphism", icon: "fas fa-circle-half-stroke", label: "Neumorphism", category: "special" },
  { value: "claymorphism", icon: "fas fa-cube", label: "Claymorphism", category: "special" },
  { value: "brutalism", icon: "fas fa-bolt", label: "Brutalism", category: "special" },
  { value: "y2k", icon: "fas fa-floppy-disk", label: "Y2K", category: "special" },
  { value: "tokyo-night", icon: "fas fa-city", label: "Tokyo Night", category: "special" },
  { value: "catppuccin", icon: "fas fa-cat", label: "Catppuccin", category: "special" },
  { value: "aurora", icon: "fas fa-wand-magic-sparkles", label: "Aurora", category: "special" },
  { value: "aura", icon: "fas fa-gem", label: "Aura", category: "special" },
  { value: "nier", icon: "fas fa-robot", label: "NieR", category: "special" },
  { value: "eva-unit-01", icon: "fas fa-brain", label: "EVA Unit-01", category: "special" },
  { value: "eva-unit-02", icon: "fas fa-fire", label: "EVA Unit-02", category: "special" }
];
let customThemes = [];
function loadCustomThemes() {
  try {
    const stored = os.storage.get(StorageKeys.customThemes);
    if (stored && Array.isArray(stored)) {
      customThemes = stored;
    }
  } catch (e) {
    console.warn("Failed to load custom themes:", e);
    customThemes = [];
  }
}

function saveCustomThemes() {
  try {
    os.storage.set(StorageKeys.customThemes, JSON.stringify(customThemes));
  } catch (e) {
    console.warn("Failed to save custom themes:", e);
  }
}

export function getAllThemes() {
  if (customThemes.length === 0) {
    loadCustomThemes();
  }
  return [...BUILTIN_THEMES, ...customThemes];
}

export function getBasicThemes() {
  return BUILTIN_THEMES.filter((t) => t.category === "basic");
}

export function getSpecialThemes() {
  if (customThemes.length === 0) {
    loadCustomThemes();
  }
  return [...BUILTIN_THEMES.filter((t) => t.category === "special"), ...customThemes];
}

export function getThemeByValue(value) {
  return getAllThemes().find((t) => t.value === value);
}

export function getThemeColors(value) {
  const theme = getThemeByValue(value);
  if (!theme) return null;
  return theme.colors || null;
}

export function addCustomTheme(theme) {
  if (!theme.value || !theme.label) {
    throw new Error("Custom theme must have value and label");
  }
  if (getThemeByValue(theme.value)) {
    throw new Error("Theme with this value already exists");
  }
  const newTheme = {
    value: theme.value,
    icon: theme.icon || "fas fa-palette",
    label: theme.label,
    category: "custom",
    colors: theme.colors || {}
  };
  customThemes.push(newTheme);
  saveCustomThemes();
  return newTheme;
}

export function getCustomThemes() {
  if (customThemes.length === 0) {
    loadCustomThemes();
  }
  return [...customThemes];
}
