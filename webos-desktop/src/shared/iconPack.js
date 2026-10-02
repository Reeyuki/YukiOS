import { StorageKeys, os } from "../framework.js";
import { FA_TO_PAPIRUS } from "./papirusIcons.js";

export const ICON_PACKS = {
  PAPIRUS: "papirus",
  FA: "fontawesome"
};

export const PAPIRUS_TO_FA = (() => {
  const map = {};
  for (const [fa, pap] of Object.entries(FA_TO_PAPIRUS)) {
    const key = `papirus:${pap}`;
    if (!map[key]) map[key] = fa;
  }
  return map;
})();

export function getIconPack() {
  try {
    const v = os.storage.get(StorageKeys.iconPack);
    if (v === ICON_PACKS.FA || v === ICON_PACKS.PAPIRUS) return v;
    const enabled = os.storage.get(StorageKeys.papirusEnabled);
    if (enabled === false || enabled === "false" || enabled === "0") return ICON_PACKS.FA;
  } catch {}
  return ICON_PACKS.PAPIRUS;
}

export function applyIconPack(pack) {
  const normalized = pack === ICON_PACKS.FA ? ICON_PACKS.FA : ICON_PACKS.PAPIRUS;
  document.documentElement.dataset.iconPack = normalized;
  try {
    os.storage.set(StorageKeys.iconPack, normalized);
    os.storage.set(StorageKeys.papirusEnabled, String(normalized === ICON_PACKS.PAPIRUS));
  } catch {}
  try {
    const hasFa = document.querySelector(
      'link[href*="font-awesome"], link[href*="fontawesome"], script[src*="font-awesome"], script[src*="fontawesome"]'
    );
    if (!hasFa) {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/js/all.min.js";
      s.defer = true;
      s.crossOrigin = "anonymous";
      document.head.appendChild(s);
    }
  } catch {}
}

export function setIconPack(pack) {
  const normalized = pack === ICON_PACKS.FA ? ICON_PACKS.FA : ICON_PACKS.PAPIRUS;
  applyIconPack(normalized);
  try {
    os.events.emit("icon-pack-changed", normalized);
  } catch {}
  return normalized;
}

export function getEffectiveIcon(icon) {
  if (!icon || typeof icon !== "string") return icon;
  const pack = getIconPack();
  if (pack === ICON_PACKS.FA) {
    if (icon.startsWith("papirus:")) return PAPIRUS_TO_FA[icon] || "fas fa-cube";
    return icon;
  }
  if (icon.startsWith("fa") || icon.startsWith("fas ") || icon.startsWith("fab ") || icon.startsWith("far ")) {
    const mapped = FA_TO_PAPIRUS[icon.trim()] || FA_TO_PAPIRUS[icon.trim().toLowerCase()];
    if (mapped) return `papirus:${mapped}`;
    return icon;
  }
  return icon;
}

export const SAMPLE_ICONS = [
  { label: "Folder", fa: "fas fa-folder", papirus: "papirus:places/folder-blue" },
  { label: "Browser", fa: "fas fa-globe", papirus: "papirus:apps/internet-web-browser" },
  { label: "Calculator", fa: "fas fa-calculator", papirus: "papirus:apps/accessories-calculator" },
  { label: "Camera", fa: "fas fa-camera", papirus: "papirus:apps/accessories-camera" },
  { label: "Games", fa: "fas fa-gamepad", papirus: "papirus:apps/preferences-desktop-gaming" },
  { label: "Settings", fa: "fas fa-cog", papirus: "papirus:actions/configure" }
];
