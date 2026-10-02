import { resolveGhUrl } from "./assetResolver.js";
import { PAPIRUS_AVAILABLE, PAPIRUS_SYMLINKS, papirusReady, ensurePapirusData } from "./papirusDataLoader.js";

export { PAPIRUS_AVAILABLE, PAPIRUS_SYMLINKS, papirusReady, ensurePapirusData };

export const PAPIRUS_CDN_BASE = "https://cdn.jsdelivr.net/gh/PapirusDevelopmentTeam/papirus-icon-theme@master";
export const PAPIRUS_VARIANT = "Papirus";
export const PAPIRUS_SIZES = [16, 22, 24, 32, 48, 64];

export function getPapirusSizeFor(px) {
  const n = Number(px);
  if (!Number.isFinite(n)) return 48;
  let best = PAPIRUS_SIZES[0];
  let bestDiff = Math.abs(n - best);
  for (let i = 1; i < PAPIRUS_SIZES.length; i++) {
    const s = PAPIRUS_SIZES[i];
    const diff = Math.abs(n - s);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = s;
    }
  }
  return best;
}

export function isPapirusIcon(str) {
  return typeof str === "string" && /^papirus:/.test(str);
}

export function getPapirusName(icon) {
  if (!isPapirusIcon(icon)) return null;
  return icon.slice(8);
}

function pickAvailableSize(requestedBucket, availableSizes) {
  if (!availableSizes || availableSizes.length === 0) return requestedBucket;
  const req = `${requestedBucket}x${requestedBucket}`;
  if (availableSizes.includes(req)) return requestedBucket;
  const order = [48, 32, 22, 24, 16, 64, 128, 96, 42, 84, 18, 8];
  for (const s of order) {
    if (availableSizes.includes(`${s}x${s}`)) return s;
  }
  return parseInt(availableSizes[0].split("x")[0], 10);
}
export function resolvePapirusUrl(name, { size = 48, context = "apps", variant = PAPIRUS_VARIANT } = {}) {
  if (!name) return null;
  let raw = String(name).trim();
  if (raw.startsWith("papirus:")) raw = raw.slice(8);
  raw = raw.replace(/\.svg$/i, "");
  let ctx = context;
  let iconName = raw;
  if (raw.includes("/")) {
    const parts = raw.split("/");
    iconName = parts.pop();
    ctx = parts.join("/") || context;
  }
  let key = `${ctx}/${iconName}`;
  let resolvedKey = PAPIRUS_SYMLINKS[key] || key;
  if (resolvedKey !== key) {
    const parts = resolvedKey.split("/");
    iconName = parts.pop();
    ctx = parts.join("/") || ctx;
    key = resolvedKey;
  }
  const requestedBucket = getPapirusSizeFor(size);
  const available = PAPIRUS_AVAILABLE[key] || PAPIRUS_AVAILABLE[`${ctx}/${iconName.toLowerCase()}`];
  let bucket = requestedBucket;
  if (available && available.length) {
    bucket = pickAvailableSize(requestedBucket, available);
  }
  const url = `${PAPIRUS_CDN_BASE}/${variant}/${bucket}x${bucket}/${ctx}/${iconName}.svg`;
  try {
    if (typeof resolveGhUrl === "function") return resolveGhUrl(url);
  } catch {}
  return url;
}

export const FA_TO_PAPIRUS = {
  "fas fa-camera": "apps/accessories-camera",
  "fa fa-camera": "apps/accessories-camera",
  "fa fa-circle-info": "actions/help-about",
  "fas fa-circle-info": "actions/help-about",
  "fa fa-newspaper": "apps/accessories-text-editor",
  "fas fa-newspaper": "apps/accessories-text-editor",
  "fa fa-calculator": "apps/calc",
  "fas fa-calculator": "apps/calc",
  "fa fa-list-check": "apps/gnome-system-monitor",
  "fas fa-list-check": "apps/gnome-system-monitor",
  "fa fa-cloud": "apps/weather",
  "fas fa-cloud": "apps/weather",
  "fab fa-markdown": "mimetypes/text-markdown",
  "fas fa-code": "apps/code",
  "fa fa-code": "apps/code",
  "fas fa-trophy": "actions/games-achievements",
  "fa fa-trophy": "actions/games-achievements",
  "fa fa-keyboard": "devices/input-keyboard",
  "fas fa-keyboard": "devices/input-keyboard",
  "fas fa-exchange-alt": "actions/swap-panels",
  "fa fa-exchange-alt": "actions/swap-panels",
  "fas fa-rocket": "apps/rocketchat",
  "fa fa-rocket": "apps/rocketchat",
  "fas fa-database": "devices/network-server-database",
  "fa fa-database": "devices/network-server-database",
  "fas fa-book-open": "apps/accessories-dictionary",
  "fa fa-book-open": "apps/accessories-dictionary",
  "fas fa-flag-checkered": "actions/flag",
  "fa fa-flag-checkered": "actions/flag",
  "fas fa-layer-group": "apps/systemsettings",
  "fa fa-layer-group": "apps/systemsettings",
  "fas fa-paste": "actions/edit-paste",
  "fa fa-paste": "actions/edit-paste",
  "fas fa-robot": "apps/gnome-robots",
  "fa fa-robot": "apps/gnome-robots",
  "fas fa-tachometer-alt": "apps/gnome-system-monitor",
  "fa fa-tachometer-alt": "apps/gnome-system-monitor",
  "fas fa-gauge-high": "apps/gnome-system-monitor",
  "fas fa-wifi": "status/network-wireless-100",
  "fa fa-wifi": "status/network-wireless-100",
  "fas fa-face-smile": "emotes/face-smile",
  "fa fa-face-smile": "emotes/face-smile",
  "fas fa-screwdriver-wrench": "apps/systemsettings",
  "fa fa-screwdriver-wrench": "apps/systemsettings",
  "fas fa-th": "actions/view-grid",
  "fa fa-th": "actions/view-grid",
  "fas fa-wave-square": "apps/audio-player",
  "fa fa-wave-square": "apps/audio-player",
  "fab fa-discord": "apps/discord",
  "fas fa-gamepad": "apps/org.gnome.Games",
  "fa fa-gamepad": "apps/org.gnome.Games",
  "fas fa-dice": "apps/codes.nora.gDiceRoller",
  "fa fa-dice": "apps/codes.nora.gDiceRoller",
  "fas fa-fire": "apps/preferences-system-firewall",
  "fa fa-fire": "apps/preferences-system-firewall",
  "fab fa-spotify": "apps/spotify",
  "fab fa-slack": "apps/slack",
  "fas fa-envelope": "apps/email",
  "fa fa-envelope": "apps/email",
  "fas fa-envelope-open": "actions/mail-open-multiple",
  "fa fa-envelope-open": "actions/mail-open-multiple",
  "fas fa-brain": "apps/gbrainy",
  "fa fa-brain": "apps/gbrainy",
  "fas fa-video": "devices/camera-video",
  "fa fa-video": "devices/camera-video",
  "fas fa-book": "apps/accessories-dictionary",
  "fa fa-book": "apps/accessories-dictionary",
  "fab fa-figma": "apps/figma",
  "fab fa-x-twitter": "apps/twitter",
  "fab fa-instagram": "apps/instagram",
  "fab fa-pinterest": "apps/com.github.PintaProject.Pinta",
  "fas fa-file-word": "mimetypes/application-msword",
  "fa fa-file-word": "mimetypes/application-msword",
  "fas fa-palette": "apps/org.gnome.design.Palette",
  "fa fa-palette": "apps/org.gnome.design.Palette",
  "fab fa-github": "apps/github",
  "fab fa-gitlab": "apps/gitlab",
  "fab fa-codepen": "apps/code",
  "fab fa-twitch": "apps/gnome-twitch",
  "fab fa-soundcloud": "apps/soundcloud",
  "fab fa-deezer": "apps/deezer",
  "fas fa-shield": "actions/lock",
  "fa fa-shield": "actions/lock",
  "fas fa-shield-alt": "actions/lock",
  "fab fa-yahoo": "apps/yahoo-mail",
  "fas fa-download": "actions/download",
  "fa fa-download": "actions/download",
  "fas fa-image": "mimetypes/image-x-generic",
  "fa fa-image": "mimetypes/image-x-generic",
  "fas fa-play-circle": "actions/media-play",
  "fa fa-play-circle": "actions/media-play",
  "fas fa-circle-play": "actions/media-play",
  "fab fa-tiktok": "apps/tiktok",
  "fa fa-cog": "actions/settings",
  "fas fa-cog": "actions/settings",
  "fas fa-gear": "actions/settings",
  "fa fa-gear": "actions/settings",
  "fas fa-paint-roller": "apps/preferences-desktop-wallpaper",
  "fa fa-paint-roller": "apps/preferences-desktop-wallpaper",
  "fab fa-steam": "apps/steam",
  "fas fa-cubes": "apps/kjumpingcube",
  "fa fa-cubes": "apps/kjumpingcube",
  "fas fa-clock": "apps/accessories-clock",
  "fa fa-clock": "apps/accessories-clock",
  "fas fa-server": "devices/network-server",
  "fa fa-server": "devices/network-server",
  "fas fa-eye-dropper": "actions/color-picker",
  "fa fa-eye-dropper": "actions/color-picker",
  "fas fa-map": "apps/maps",
  "fa fa-map": "apps/maps",
  "fas fa-shield-halved": "actions/lock",
  "fa fa-shield-halved": "actions/lock",
  "fas fa-terminal": "apps/terminal",
  "fa fa-terminal": "apps/terminal",
  "fas fa-cube": "apps/kjumpingcube",
  "fa fa-cube": "apps/kjumpingcube",
  "fas fa-search-plus": "actions/zoom-in",
  "fa fa-search-plus": "actions/zoom-in",
  "fas fa-desktop": "devices/computer",
  "fa fa-desktop": "devices/computer",
  "fas fa-display": "devices/computer",
  "fas fa-fish": "apps/fish",
  "fa fa-fish": "apps/fish",
  "fas fa-th-large": "actions/view-grid",
  "fa fa-th-large": "actions/view-grid",
  "fas fa-film": "mimetypes/video-x-generic",
  "fa fa-film": "mimetypes/video-x-generic",
  "fas fa-tv": "devices/video-display",
  "fa fa-tv": "devices/video-display",
  "fas fa-paint-brush": "apps/gpaint",
  "fa fa-paint-brush": "apps/gpaint",
  "fa-microphone-slash": "status/microphone-sensitivity-muted",
  "fas fa-microphone-slash": "status/microphone-sensitivity-muted",
  "fa fa-microphone-slash": "status/microphone-sensitivity-muted",
  "fa-volume-off": "status/audio-volume-muted",
  "fas fa-volume-off": "status/audio-volume-muted",
  "fa fa-volume-off": "status/audio-volume-muted",
  "fas fa-volume-xmark": "status/audio-volume-muted",
  "fas fa-volume-mute": "status/audio-volume-muted",
  "fa-circle": "actions/draw-circle",
  "fas fa-circle": "actions/draw-circle",
  "fa fa-circle": "actions/draw-circle",
  "fa-moon": "status/weather-clear-night",
  "fas fa-moon": "status/weather-clear-night",
  "fa fa-moon": "status/weather-clear-night",
  "fa-ban": "actions/im-ban-user",
  "fas fa-ban": "actions/im-ban-user",
  "fa fa-ban": "actions/im-ban-user",
  "fa-eye-slash": "actions/view-hidden",
  "fas fa-eye-slash": "actions/view-hidden",
  "fa fa-eye-slash": "actions/view-hidden",
  "fa-cookie-bite": "actions/cookies",
  "fas fa-cookie-bite": "actions/cookies",
  "fa fa-cookie-bite": "actions/cookies",
  "fa-plus": "actions/list-add",
  "fas fa-plus": "actions/list-add",
  "fa fa-plus": "actions/list-add",
  "fa-table-cells": "actions/view-grid",
  "fas fa-table-cells": "actions/view-grid",
  "fa fa-table-cells": "actions/view-grid",
  "fa-skull": "emotes/face-sad",
  "fas fa-skull": "emotes/face-sad",
  "fa fa-skull": "emotes/face-sad",
  "fa-volume-high": "status/audio-volume-high",
  "fas fa-volume-high": "status/audio-volume-high",
  "fa fa-volume-high": "status/audio-volume-high",
  "fas fa-volume-up": "status/audio-volume-high",
  "fas fa-volume-low": "status/audio-volume-low",
  "fas fa-info-circle": "actions/help-about",
  "fas fa-info": "actions/help-about",
  "fas fa-question": "actions/help-about",
  "fas fa-cogs": "actions/settings",
  "fas fa-tools": "apps/systemsettings",
  "fas fa-wrench": "apps/systemsettings",
  "fas fa-lock": "actions/object-locked",
  "fas fa-sign-out-alt": "actions/system-log-out",
  "fas fa-sign-out": "actions/system-log-out",
  "fas fa-power-off": "actions/system-shutdown",
  "fas fa-bed": "apps/system-suspend",
  "fas fa-network-wired": "devices/network-wired",
  "fas fa-paint-brush": "apps/preferences-desktop-theme",
  "fas fa-microchip": "devices/cpu",
  "fas fa-id-card": "apps/system-users",
  "fas fa-bell": "apps/preferences-desktop-notification-bell",
  "fas fa-shield-halved": "actions/object-locked",
  "fas fa-bookmark": "actions/bookmark-new",
  "far fa-clock": "actions/clock",
  "fas fa-globe": "apps/internet-web-browser",
  "fas fa-music": "apps/juk",
  "far fa-file-word": "mimetypes/x-office-document",
  "fas fa-file-code": "apps/vscode",
  "fas fa-folder": "places/folder-blue",
  "fa fa-wrench": "apps/utilities-tweak-tool",
  "fas fa-cogs": "actions/configure",
  "fas fa-cog": "actions/configure"
};

export function papirusForFa(faClass) {
  if (typeof faClass !== "string") return null;
  const trimmed = faClass.trim();
  if (!trimmed) return null;
  if (FA_TO_PAPIRUS[trimmed]) return `papirus:${FA_TO_PAPIRUS[trimmed]}`;
  const lower = trimmed.toLowerCase();
  if (FA_TO_PAPIRUS[lower]) return `papirus:${FA_TO_PAPIRUS[lower]}`;
  const isFa = /^fa[bsr]?\s+fa-/.test(trimmed) || /^fa\s+fa-/.test(trimmed) || /^fa-[a-z0-9-]+$/.test(trimmed);
  if (isFa) return "papirus:apps/application-default-icon";
  return null;
}

export function resolvePapirusIcon(icon) {
  if (typeof icon !== "string") return null;
  const trimmed = icon.trim();
  if (!trimmed) return null;
  if (isPapirusIcon(trimmed)) {
    const name = getPapirusName(trimmed);
    return resolvePapirusUrl(name);
  }
  const papirus = papirusForFa(trimmed);
  if (papirus) {
    const name = getPapirusName(papirus);
    return resolvePapirusUrl(name);
  }
  return null;
}
