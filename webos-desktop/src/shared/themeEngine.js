import { StorageKeys, os } from "../framework.js";

const BUILTIN_THEMES = [
  {
    value: "dark",
    icon: "fas fa-moon",
    label: "Dark",
    category: "basic",
    preview: "linear-gradient(135deg, #1e1e2e, #2d2d44)"
  },
  {
    value: "light",
    icon: "fas fa-sun",
    label: "Light",
    category: "basic",
    preview: "linear-gradient(135deg, #f5f5f5, #e8e8e8)",
    textColor: "#111"
  },
  {
    value: "auto",
    icon: "fas fa-circle-half-stroke",
    label: "Auto",
    category: "basic",
    preview: "linear-gradient(135deg, #1e1e2e 0%, #1e1e2e 50%, #f5f5f5 50%, #f5f5f5 100%)"
  },
  {
    value: "cyber",
    icon: "fas fa-bolt",
    label: "Cyber",
    category: "special",
    preview: "linear-gradient(135deg, #00ffff, #ff00ff)"
  },
  {
    value: "arctic",
    icon: "fas fa-snowflake",
    label: "Arctic",
    category: "special",
    preview: "linear-gradient(135deg, #a5d8ff, #d0e8ff)",
    textColor: "#111"
  },
  {
    value: "crt",
    icon: "fas fa-terminal",
    label: "CRT",
    category: "special",
    preview: "linear-gradient(135deg, #001400, #003300)"
  },
  {
    value: "sakura",
    icon: "fas fa-fan",
    label: "Sakura",
    category: "special",
    preview: "linear-gradient(135deg, #ffb7c5, #ffe4e9)",
    textColor: "#111"
  },
  {
    value: "oled",
    icon: "fas fa-tv",
    label: "OLED",
    category: "special",
    preview: "linear-gradient(135deg, #000000, #111111)"
  },
  {
    value: "nordic",
    icon: "fas fa-mountain",
    label: "Nordic",
    category: "special",
    preview: "linear-gradient(135deg, #5e81ac, #2e3440)"
  },
  {
    value: "forest",
    icon: "fas fa-tree",
    label: "Forest",
    category: "special",
    preview: "linear-gradient(135deg, #2d5a27, #4a7c59)"
  },
  {
    value: "high-contrast",
    icon: "fas fa-adjust",
    label: "High Contrast",
    category: "special",
    preview: "linear-gradient(135deg, #000000 0%, #000000 50%, #ffffff 50%, #ffffff 100%)",
    textColor: "#111"
  },
  {
    value: "vaporwave",
    icon: "fas fa-sun",
    label: "Vaporwave",
    category: "special",
    preview: "linear-gradient(135deg, #ff71ce, #01cdfe)",
    textColor: "#111"
  },
  {
    value: "gameboy",
    icon: "fas fa-gamepad",
    label: "Gameboy",
    category: "special",
    preview: "linear-gradient(135deg, #8bac0f, #306230)"
  },
  {
    value: "frutiger-aero",
    icon: "fas fa-apple-whole",
    label: "Frutiger Aero",
    category: "special",
    preview: "linear-gradient(135deg, #00d4ff, #7bed9f)",
    textColor: "#111"
  },
  {
    value: "dracula",
    icon: "fas fa-skull",
    label: "Dracula",
    category: "special",
    preview: "linear-gradient(135deg, #bd93f9, #6272a4)"
  },
  {
    value: "solarized-dark",
    icon: "fas fa-sun",
    label: "Solarized Dark",
    category: "special",
    preview: "linear-gradient(135deg, #073642, #586e75)"
  },
  {
    value: "solarized-light",
    icon: "fas fa-cloud-sun",
    label: "Solarized Light",
    category: "special",
    preview: "linear-gradient(135deg, #fdf6e3, #eee8d5)",
    textColor: "#111"
  },
  {
    value: "github-light",
    icon: "fab fa-github",
    label: "GitHub Light",
    category: "special",
    preview: "linear-gradient(135deg, #ffffff, #f6f8fa)",
    textColor: "#111"
  },
  {
    value: "github-dark",
    icon: "fab fa-github",
    label: "GitHub Dark",
    category: "special",
    preview: "linear-gradient(135deg, #0d1117, #161b22)"
  },
  {
    value: "minimal-gray",
    icon: "fas fa-circle",
    label: "Minimal Gray",
    category: "special",
    preview: "linear-gradient(135deg, #6b7280, #9ca3af)"
  },
  {
    value: "paper",
    icon: "fas fa-file-alt",
    label: "Paper",
    category: "special",
    preview: "linear-gradient(135deg, #f5f5dc, #efe6c3)",
    textColor: "#111"
  },
  {
    value: "macos-fluent",
    icon: "fab fa-apple",
    label: "MacOS Fluent",
    category: "special",
    preview: "linear-gradient(135deg, #007aff, #5856d6)"
  },
  {
    value: "windows-fluent",
    icon: "fab fa-windows",
    label: "Windows Fluent",
    category: "special",
    preview: "linear-gradient(135deg, #0078d4, #10893e)"
  },
  {
    value: "material-you",
    icon: "fas fa-palette",
    label: "Material You",
    category: "special",
    preview: "linear-gradient(135deg, #6750a4, #7c4dff)"
  },
  {
    value: "sepia",
    icon: "fas fa-book",
    label: "Sepia",
    category: "special",
    preview: "linear-gradient(135deg, #704214, #8b5e3c)"
  },
  {
    value: "hatsune-miku",
    icon: "fas fa-music",
    label: "Hatsune Miku",
    category: "special",
    preview: "linear-gradient(135deg, #39c5bb, #1a8a8a)"
  },
  {
    value: "star-wars-dark",
    icon: "fas fa-skull",
    label: "Star Wars Dark",
    category: "special",
    preview: "linear-gradient(135deg, #000000, #2a2a2a)"
  },
  {
    value: "amber",
    icon: "fas fa-fire",
    label: "Amber",
    category: "special",
    preview: "linear-gradient(135deg, #ffbf00, #ff8c00)",
    textColor: "#111"
  },
  {
    value: "coral",
    icon: "fas fa-water",
    label: "Coral",
    category: "special",
    preview: "linear-gradient(135deg, #ff7f50, #ff6347)"
  },
  {
    value: "slate",
    icon: "fas fa-circle",
    label: "Slate",
    category: "special",
    preview: "linear-gradient(135deg, #475569, #64748b)"
  },
  {
    value: "mint",
    icon: "fas fa-leaf",
    label: "Mint",
    category: "special",
    preview: "linear-gradient(135deg, #98ff98, #66cc66)",
    textColor: "#111"
  },
  {
    value: "cream",
    icon: "fas fa-feather",
    label: "Cream",
    category: "special",
    preview: "linear-gradient(135deg, #fffdd0, #f5f0cb)",
    textColor: "#111"
  },
  {
    value: "glass",
    icon: "fas fa-water",
    label: "Glass",
    category: "special",
    preview: "linear-gradient(135deg, #e0f7fa, #b2ebf2)",
    textColor: "#111"
  },
  {
    value: "neumorphism",
    icon: "fas fa-circle-half-stroke",
    label: "Neumorphism",
    category: "special",
    preview: "linear-gradient(135deg, #e0e0e0, #ffffff)",
    textColor: "#111"
  },
  {
    value: "claymorphism",
    icon: "fas fa-cube",
    label: "Claymorphism",
    category: "special",
    preview: "linear-gradient(135deg, #ff6b6b, #ee5a24)"
  },
  {
    value: "brutalism",
    icon: "fas fa-bolt",
    label: "Brutalism",
    category: "special",
    preview: "linear-gradient(135deg, #ff0000, #000000)"
  },
  {
    value: "y2k",
    icon: "fas fa-floppy-disk",
    label: "Y2K",
    category: "special",
    preview: "linear-gradient(135deg, #ff69b4, #00bfff)",
    textColor: "#111"
  },
  {
    value: "tokyo-night",
    icon: "fas fa-city",
    label: "Tokyo Night",
    category: "special",
    preview: "linear-gradient(135deg, #1a1b2e, #7aa2f7)"
  },
  {
    value: "catppuccin",
    icon: "fas fa-cat",
    label: "Catppuccin",
    category: "special",
    preview: "linear-gradient(135deg, #cba6f7, #89b4fa)",
    textColor: "#111"
  },
  {
    value: "aurora",
    icon: "fas fa-wand-magic-sparkles",
    label: "Aurora",
    category: "special",
    preview: "linear-gradient(135deg, #00ff88, #00d9ff)",
    textColor: "#111"
  },
  {
    value: "aura",
    icon: "fas fa-gem",
    label: "Aura",
    category: "special",
    preview: "linear-gradient(135deg, #a78bfa, #7c3aed)"
  },
  {
    value: "nier",
    icon: "fas fa-robot",
    label: "NieR",
    category: "special",
    preview: "linear-gradient(135deg, #1a1a1a, #e63946)"
  },
  {
    value: "eva-unit-01",
    icon: "fas fa-brain",
    label: "EVA Unit-01",
    category: "special",
    preview: "linear-gradient(135deg, #7c3aed, #10b981)"
  },
  {
    value: "eva-unit-02",
    icon: "fas fa-fire",
    label: "EVA Unit-02",
    category: "special",
    preview: "linear-gradient(135deg, #dc2626, #f59e0b)"
  },
  {
    value: "matrix",
    icon: "fas fa-th",
    label: "Matrix",
    category: "special",
    preview: "linear-gradient(135deg, #001a00, #00ff00)"
  },
  {
    value: "amber-terminal",
    icon: "fas fa-terminal",
    label: "Amber Terminal",
    category: "special",
    preview: "linear-gradient(135deg, #1a0e00, #ffb000)"
  },
  {
    value: "aurora-borealis",
    icon: "fas fa-wand-magic-sparkles",
    label: "Aurora Borealis",
    category: "special",
    preview: "linear-gradient(135deg, #00d9ff, #00ff88, #7c3aed)"
  },
  {
    value: "vice-city",
    icon: "fas fa-umbrella-beach",
    label: "Vice City",
    category: "special",
    preview: "linear-gradient(135deg, #ff6ec7, #00bfff)",
    textColor: "#111"
  }
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
