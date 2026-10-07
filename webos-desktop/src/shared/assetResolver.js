import { os } from "../os/index.js";
import { $, $$ } from "./domUtils.js";
import { StorageKeys } from "../StorageKeys.js";
import { PAPIRUS_AVAILABLE, PAPIRUS_SYMLINKS as PAPIRUS_SYMLINKS_FALLBACK } from "./papirusDataLoader.js";

const PAPIRUS_TO_FA = {
  "papirus:apps/accessories-camera": "fas fa-camera",
  "papirus:actions/help-about": "fa fa-circle-info",
  "papirus:apps/accessories-text-editor": "fa fa-newspaper",
  "papirus:apps/calc": "fa fa-calculator",
  "papirus:apps/gnome-system-monitor": "fa fa-list-check",
  "papirus:apps/weather": "fa fa-cloud",
  "papirus:mimetypes/text-markdown": "fab fa-markdown",
  "papirus:apps/code": "fas fa-code",
  "papirus:actions/games-achievements": "fas fa-trophy",
  "papirus:devices/input-keyboard": "fa fa-keyboard",
  "papirus:actions/swap-panels": "fas fa-exchange-alt",
  "papirus:apps/rocketchat": "fas fa-rocket",
  "papirus:devices/network-server-database": "fas fa-database",
  "papirus:apps/accessories-dictionary": "fas fa-book-open",
  "papirus:actions/flag": "fas fa-flag-checkered",
  "papirus:apps/systemsettings": "fas fa-layer-group",
  "papirus:actions/edit-paste": "fas fa-paste",
  "papirus:apps/gnome-robots": "fas fa-robot",
  "papirus:status/network-wireless-100": "fas fa-wifi",
  "papirus:emotes/face-smile": "fas fa-face-smile",
  "papirus:actions/view-grid": "fas fa-th",
  "papirus:apps/audio-player": "fas fa-wave-square",
  "papirus:apps/discord": "fab fa-discord",
  "papirus:apps/org.gnome.Games": "fas fa-gamepad",
  "papirus:apps/codes.nora.gDiceRoller": "fas fa-dice",
  "papirus:apps/preferences-system-firewall": "fas fa-fire",
  "papirus:apps/spotify": "fab fa-spotify",
  "papirus:apps/slack": "fab fa-slack",
  "papirus:apps/email": "fas fa-envelope",
  "papirus:actions/mail-open-multiple": "fas fa-envelope-open",
  "papirus:apps/gbrainy": "fas fa-brain",
  "papirus:devices/camera-video": "fas fa-video",
  "papirus:apps/figma": "fab fa-figma",
  "papirus:apps/twitter": "fab fa-x-twitter",
  "papirus:apps/instagram": "fab fa-instagram",
  "papirus:apps/com.github.PintaProject.Pinta": "fab fa-pinterest",
  "papirus:mimetypes/application-msword": "fas fa-file-word",
  "papirus:apps/org.gnome.design.Palette": "fas fa-palette",
  "papirus:apps/github": "fab fa-github",
  "papirus:apps/gitlab": "fab fa-gitlab",
  "papirus:apps/gnome-twitch": "fab fa-twitch",
  "papirus:apps/soundcloud": "fab fa-soundcloud",
  "papirus:apps/deezer": "fab fa-deezer",
  "papirus:actions/lock": "fas fa-shield",
  "papirus:apps/yahoo-mail": "fab fa-yahoo",
  "papirus:actions/download": "fas fa-download",
  "papirus:mimetypes/image-x-generic": "fas fa-image",
  "papirus:actions/media-play": "fas fa-play-circle",
  "papirus:apps/tiktok": "fab fa-tiktok",
  "papirus:actions/settings": "fa fa-cog",
  "papirus:apps/preferences-desktop-wallpaper": "fas fa-paint-roller",
  "papirus:apps/steam": "fab fa-steam",
  "papirus:apps/kjumpingcube": "fas fa-cubes",
  "papirus:apps/accessories-clock": "fas fa-clock",
  "papirus:devices/network-server": "fas fa-server",
  "papirus:actions/color-picker": "fas fa-eye-dropper",
  "papirus:apps/maps": "fas fa-map",
  "papirus:apps/terminal": "fas fa-terminal",
  "papirus:actions/zoom-in": "fas fa-search-plus",
  "papirus:devices/computer": "fas fa-desktop",
  "papirus:apps/fish": "fas fa-fish",
  "papirus:mimetypes/video-x-generic": "fas fa-film",
  "papirus:devices/video-display": "fas fa-tv",
  "papirus:apps/gpaint": "fas fa-paint-brush",
  "papirus:status/microphone-sensitivity-muted": "fa-microphone-slash",
  "papirus:status/audio-volume-muted": "fa-volume-off",
  "papirus:actions/draw-circle": "fa-circle",
  "papirus:status/weather-clear-night": "fa-moon",
  "papirus:actions/im-ban-user": "fa-ban",
  "papirus:actions/view-hidden": "fa-eye-slash",
  "papirus:actions/cookies": "fa-cookie-bite",
  "papirus:actions/list-add": "fa-plus",
  "papirus:emotes/face-sad": "fa-skull",
  "papirus:status/audio-volume-high": "fa-volume-high",
  "papirus:status/audio-volume-low": "fas fa-volume-low",
  "papirus:actions/object-locked": "fas fa-lock",
  "papirus:actions/system-log-out": "fas fa-sign-out-alt",
  "papirus:actions/system-shutdown": "fas fa-power-off",
  "papirus:apps/system-suspend": "fas fa-bed",
  "papirus:actions/bookmark-new": "fas fa-bookmark",
  "papirus:actions/clock": "far fa-clock",
  "papirus:apps/internet-web-browser": "fas fa-globe",
  "papirus:apps/juk": "fas fa-music",
  "papirus:mimetypes/x-office-document": "far fa-file-word",
  "papirus:apps/vscode": "fas fa-file-code",
  "papirus:apps/preferences-desktop-gaming": "far fa-gamepad",
  "papirus:places/folder-blue": "fas fa-folder",
  "papirus:apps/utilities-tweak-tool": "fa fa-wrench",
  "papirus:actions/configure": "fas fa-cog",
  "papirus:apps/utilities-system-monitor": "fas fa-chart-line",
  "papirus:actions/zoom-out": "fas fa-search-minus",
  "papirus:actions/edit-find": "fas fa-search",
  "papirus:actions/media-playback-stop": "fas fa-stop",
  "papirus:places/user-home": "fas fa-house"
};

const PAPIRUS_CDN_BASE = "https://cdn.jsdelivr.net/gh/PapirusDevelopmentTeam/papirus-icon-theme@master";

export function resolvePapirusUrl(papirusIcon, size = 48) {
  if (typeof papirusIcon !== "string") return papirusIcon;
  let raw = papirusIcon.trim();
  if (raw.startsWith("papirus:")) raw = raw.slice(8);
  raw = raw.replace(/\.svg$/i, "");
  let context = "apps";
  let name = raw;
  if (raw.includes("/")) {
    const parts = raw.split("/");
    name = parts.pop();
    context = parts.join("/") || "apps";
  }
  let key = `${context}/${name}`;
  const seenKeys = new Set([key]);
  for (let hops = 0; hops < 10; hops++) {
    const resolved = PAPIRUS_SYMLINKS_FALLBACK[key];
    if (!resolved || seenKeys.has(resolved)) break;
    seenKeys.add(resolved);
    const parts = resolved.split("/");
    name = parts.pop();
    context = parts.join("/") || context;
    key = `${context}/${name}`;
  }
  let bucket = [16, 22, 24, 32, 48, 64].reduce(
    (best, s) => (Math.abs(s - size) < Math.abs(best - size) ? s : best),
    48
  );
  if (context === "actions") {
    if (![16, 22, 24].includes(bucket)) bucket = 22;
  } else if (context === "status") {
    if (/^(battery|audio-volume|network-wireless)/.test(name)) bucket = 32;
    else if (/^(notification-|weather-)/.test(name) && bucket !== 48) bucket = 48;
    else if ([16, 22, 24].includes(bucket) && !/^(dialog-|avatar-)/.test(name)) {
      const valid = [22, 24, 32, 48];
      bucket = valid.reduce((best, s) => (Math.abs(s - size) < Math.abs(best - size) ? s : best), 32);
    }
  } else if (context === "panel") {
    if (![16, 22, 24].includes(bucket)) bucket = 22;
  } else if (
    context === "apps" ||
    context === "places" ||
    context === "devices" ||
    context === "mimetypes" ||
    context === "emblems"
  ) {
    const valid = [16, 22, 24, 32, 48, 64];
    if (!valid.includes(bucket))
      bucket = valid.reduce((best, s) => (Math.abs(s - size) < Math.abs(best - size) ? s : best), 48);
  }
  const availableSizes = PAPIRUS_AVAILABLE[key];
  if (availableSizes && availableSizes.length > 0) {
    let nearest = bucket;
    let nearestDiff = Infinity;
    for (const entry of availableSizes) {
      const parsed = parseInt(String(entry).split("x")[0], 10);
      if (!Number.isFinite(parsed)) continue;
      const diff = Math.abs(parsed - size);
      if (diff < nearestDiff) {
        nearestDiff = diff;
        nearest = parsed;
      }
    }
    bucket = nearest;
  }
  const url = `${PAPIRUS_CDN_BASE}/Papirus/${bucket}x${bucket}/${context}/${name}.svg`;
  return resolveGhUrl(url);
}

export const CDN_MIRRORS = [
  {
    id: "jsdelivr",
    name: "jsDelivr (Default)",
    ghTemplate: "https://cdn.jsdelivr.net/gh/${u}/${r}@${b}/${p}",
    npmTemplate: "https://cdn.jsdelivr.net/npm/${p}"
  },
  {
    id: "quantil",
    name: "Quantil (jsDelivr Mirror)",
    ghTemplate: "https://quantil.jsdelivr.net/gh/${u}/${r}@${b}/${p}",
    npmTemplate: "https://quantil.jsdelivr.net/npm/${p}"
  },
  {
    id: "originfastly",
    name: "Fastly (jsDelivr Mirror)",
    ghTemplate: "https://originfastly.jsdelivr.net/gh/${u}/${r}@${b}/${p}",
    npmTemplate: "https://originfastly.jsdelivr.net/npm/${p}"
  },
  {
    id: "gcore",
    name: "GCore (jsDelivr Mirror)",
    ghTemplate: "https://gcore.jsdelivr.net/gh/${u}/${r}@${b}/${p}",
    npmTemplate: "https://gcore.jsdelivr.net/npm/${p}"
  },
  {
    id: "esmsh",
    name: "esm.sh",
    ghTemplate: "https://esm.sh/gh/${u}/${r}@${b}/${p}",
    npmTemplate: "https://esm.sh/${p}"
  },
  {
    id: "statically",
    name: "Statically",
    ghTemplate: "https://cdn.statically.io/gh/${u}/${r}@${b}/${p}",
    npmTemplate: "https://cdn.statically.io/npm/${p}"
  },
  {
    id: "staticdelivr",
    name: "StaticDelivr",
    ghTemplate: "https://cdn.staticdelivr.com/gh/${u}/${r}/${b}/${p}",
    npmTemplate: "https://cdn.staticdelivr.com/npm/${p}"
  }
];

let currentMirrorId = null;

export function getCdnMirror() {
  if (currentMirrorId === null) {
    try {
      currentMirrorId = os.storage.get(StorageKeys.cdnMirror) || "jsdelivr";
    } catch {
      currentMirrorId = "jsdelivr";
    }
  }
  return currentMirrorId;
}

export function setCdnMirror(id) {
  if (CDN_MIRRORS.find((m) => m.id === id)) {
    currentMirrorId = id;
    try {
      os.storage.set(StorageKeys.cdnMirror, id);
    } catch {}
  }
}

export function resolveGhUrl(url) {
  if (typeof url !== "string") return url;
  const match = url.match(
    /https?:\/\/(cdn\.jsdelivr\.net|quantil\.jsdelivr\.net|originfastly\.jsdelivr\.net|gcore\.jsdelivr\.net|esm\.sh|cdn\.statically\.io|cdn\.staticdelivr\.com)\/gh\/([^/]+)\/([^/@]+)(?:@([^/]+))?(?:\/(.*))?/i
  );
  if (!match) return url;

  const u = match[2];
  const r = match[3];
  const b = match[4] || "main";
  const p = match[5];

  const mirror = CDN_MIRRORS.find((m) => m.id === getCdnMirror()) || CDN_MIRRORS[0];
  const cleanP = (p || "").startsWith("/") ? p.substring(1) : p || "";
  let resolved = mirror.ghTemplate.replace("${u}", u).replace("${r}", r).replace("${b}", b).replace("${p}", cleanP);

  if (!cleanP && resolved.endsWith("/")) {
    if (!url.endsWith("/")) {
      resolved = resolved.slice(0, -1);
    }
  }
  return resolved;
}

export function resolveNpmUrl(url) {
  if (typeof url !== "string") return url;
  const match = url.match(
    /https?:\/\/(cdn\.jsdelivr\.net|quantil\.jsdelivr\.net|originfastly\.jsdelivr\.net|gcore\.jsdelivr\.net|esm\.sh|cdn\.statically\.io|cdn\.staticdelivr\.com)\/(?:npm(?:\/|$))?(.*)/
  );
  if (!match) return url;

  const p = match[2];

  const mirror = CDN_MIRRORS.find((m) => m.id === getCdnMirror()) || CDN_MIRRORS[0];
  return mirror.npmTemplate.replace("${p}", p);
}

const CDN_PROVIDERS = {
  jsdelivr: {
    get GAMES() {
      return resolveGhUrl("https://cdn.jsdelivr.net/gh/NaoTomori1/yukios-games@main");
    },
    get MAIN() {
      return resolveGhUrl("https://cdn.jsdelivr.net/gh/NaoTomori1/yukios@main");
    },
    get NPM() {
      return resolveNpmUrl("https://cdn.jsdelivr.net/npm");
    },
    PATTERN:
      /^https?:\/\/(cdn\.jsdelivr\.net|quantil\.jsdelivr\.net|originfastly\.jsdelivr\.net|gcore\.jsdelivr\.net|esm\.sh|cdn\.statically\.io|cdn\.staticdelivr\.com)\//,
    HOSTNAMES: [
      "cdn.jsdelivr.net",
      "quantil.jsdelivr.net",
      "originfastly.jsdelivr.net",
      "gcore.jsdelivr.net",
      "esm.sh",
      "cdn.statically.io",
      "cdn.staticdelivr.com"
    ],
    GH_PATH: "/gh/"
  }
};

export function initializeMirrors(appMap) {
  try {
    const base = $("base");
    if (base && base.href.includes("cdn.jsdelivr.net/gh/")) {
      base.href = resolveGhUrl(base.href);
    }

    $$("img[src]").forEach((img) => {
      const src = img.getAttribute("src");
      if (src && !src.startsWith("http") && !src.startsWith("blob:") && !src.startsWith("data:")) {
        const newSrc = resolveIconUrl(src);
        if (newSrc !== src) {
          img.setAttribute("src", newSrc);
        }
      }
    });

    if (appMap) {
      Object.values(appMap).forEach((app) => {
        if (app.icon && typeof app.icon === "string") {
          if (app.icon.includes("cdn.jsdelivr.net/gh/")) {
            app.icon = resolveGhUrl(app.icon);
          } else if (app.icon.startsWith("/static/") || app.icon.startsWith("static/")) {
            app.icon = resolveIconUrl(app.icon);
          }
        }
        if (app.url && typeof app.url === "string") {
          if (app.url.includes("cdn.jsdelivr.net/gh/")) {
            app.url = resolveGhUrl(app.url);
          } else if (app.url.startsWith("/static/") || app.url.startsWith("static/")) {
            app.url = resolveIconUrl(app.url);
          }
        }
      });
    }

    const customStartIcon = (() => {
      try {
        return os.storage.get(StorageKeys.startButtonIcon);
      } catch {
        return null;
      }
    })();
    if (!customStartIcon) {
      const logoUrl = resolveYukiAsset("static/icons/logo.png");
      document.documentElement.style.setProperty("--start-logo-url", `url("${logoUrl}")`);
    }
  } catch (err) {
    console.error("Failed to initialize mirrors:", err);
  }
}

export const CDN_BASES = CDN_PROVIDERS.jsdelivr;
export const JSDELIVR_BASE = CDN_BASES.GAMES;
export const YUKIOS_JSDELIVR_BASE = CDN_BASES.MAIN;
export const JSDELIVR_GH_BASE = CDN_BASES.MAIN;

export const isCdnGhUrl = (url) => {
  if (typeof url !== "string") return false;
  return Object.values(CDN_PROVIDERS).some((provider) => provider.PATTERN.test(url) && url.includes(provider.GH_PATH));
};

export const isJsdelivrGhUrl = (url) =>
  typeof url === "string" &&
  (url.startsWith("https://cdn.jsdelivr.net/gh/") || url.startsWith("http://cdn.jsdelivr.net/gh/"));

export function isCdnHostname(hostname) {
  if (typeof hostname !== "string") return false;
  return Object.values(CDN_PROVIDERS).some(
    (provider) => provider.HOSTNAMES.includes(hostname) || hostname.endsWith(`.${provider.HOSTNAMES[0].split(".")[1]}`)
  );
}

function getCdnProvider(url) {
  if (typeof url !== "string") return null;

  const urlObj = new URL(url);
  return Object.values(CDN_PROVIDERS).find((provider) => provider.HOSTNAMES.includes(urlObj.hostname));
}

export function resolveYukiAsset(path) {
  if (typeof path !== "string") return path;

  const cleanPath = path.startsWith("/") ? path.substring(1) : path;

  const mirror = CDN_MIRRORS.find((m) => m.id === getCdnMirror()) || CDN_MIRRORS[0];

  const user = "Reeyuki";
  const repo = "yukios";
  const branch = "main";

  return mirror.ghTemplate
    .replace("${u}", user)
    .replace("${r}", repo)
    .replace("${b}", branch)
    .replace("${p}", cleanPath);
}

function getCdnProviderByHostname(hostname) {
  if (typeof hostname !== "string") return null;
  return Object.values(CDN_PROVIDERS).find((provider) => provider.HOSTNAMES.includes(hostname));
}

export const looksLikeHtml = (url) => typeof url === "string" && /\.html?([?#].*)?$/i.test(url);

export function getCurrentCdnRepoBase() {
  try {
    const here = new URL(window.location.href);
    const provider = getCdnProviderByHostname(here.hostname);
    if (!provider) return null;

    const p = here.pathname.split("/").filter(Boolean);
    if (p[0] !== "gh" || !p[1] || !p[2]) return null;

    return `${here.origin}${provider.GH_PATH}${p[1]}/${p[2]}`;
  } catch {
    return null;
  }
}

export function getCdnRepoBase(url) {
  try {
    const uo = new URL(url);
    const provider = getCdnProvider(uo);
    if (!provider) return null;

    const p = uo.pathname.split("/").filter(Boolean);
    if (p[0] === "gh" && p[1] && p[2]) {
      return `${uo.origin}${provider.GH_PATH}${p[1]}/${p[2]}/`;
    }
  } catch {}
  return null;
}

export function resolveIconUrl(url) {
  if (typeof url !== "string") return url;
  if (url.startsWith("papirus:")) {
    try {
      let isFA = false;
      try {
        const pack = os.storage.get(StorageKeys.iconPack);
        if (pack === "fontawesome") isFA = true;
      } catch {}
      if (!isFA) {
        try {
          const enabled = os.storage.get(StorageKeys.papirusEnabled);
          if (enabled === false || enabled === "false" || enabled === "0") isFA = true;
        } catch {}
      }
      if (isFA) {
        const mapped = PAPIRUS_TO_FA[url] || PAPIRUS_TO_FA[url.trim()];
        if (mapped) return mapped;
        return "fas fa-cube";
      }
    } catch {}
    return resolvePapirusUrl(url, 48);
  }
  if (url.startsWith("data:") || url.startsWith("blob:") || url === "@content") return url;

  const hostname = window.location?.hostname || "";
  const isCdn = isCdnHostname(hostname);
  const normalizedUrl = url.startsWith("/") ? url : `/${url}`;

  if (normalizedUrl === "/static/apps/azahar/index.html") {
    return normalizedUrl;
  }

  if (normalizedUrl.startsWith("/static/")) {
    return resolveYukiAsset(normalizedUrl);
  }

  if (/^https?:\/\//.test(url)) {
    try {
      const u = new URL(url);
      const isCdnUrl = isCdnHostname(u.hostname);
      if (isCdnUrl && u.pathname.startsWith("/static/")) {
        return resolveYukiAsset(u.pathname + u.search + u.hash);
      }
    } catch {}
    return resolveGhUrl(url);
  }

  return url;
}

export function resolveWallpaperUrl(url) {
  if (typeof url !== "string") return null;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    try {
      const u = new URL(url);
      if (isCdnHostname(u.hostname) && u.pathname.startsWith("/static/wallpapers/")) {
        return resolveYukiAsset(u.pathname + u.search + u.hash);
      }
    } catch {}
    return resolveGhUrl(url);
  }
  if (url.startsWith("/static/wallpapers/") || url.startsWith("static/wallpapers/")) {
    return resolveYukiAsset(url);
  }
  return url;
}

export async function resolveUrl(url, isCdnGh = false) {
  if (!url) return url;
  if (url.startsWith("blob:") || url.startsWith("data:")) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return resolveGhUrl(url);
  }

  const currentRepoBase = getCurrentCdnRepoBase();
  const hostname = window.location?.hostname || "";
  const currentProvider = getCdnProviderByHostname(hostname) || CDN_PROVIDERS.jsdelivr;

  if (url.startsWith("/")) {
    const repoBase = currentRepoBase;
    if (repoBase) return `${repoBase}${url}`;
    if (isCdnGh) return `${currentProvider.GAMES}${url}`;
    if (looksLikeHtml(url)) {
      try {
        const origin = new URL(window.location.href).origin;
        if (isCdnHostname(new URL(origin).hostname)) {
          return `${currentProvider.GAMES}${url}`;
        }
        return new URL(url, window.location.href).href;
      } catch {
        return `${currentProvider.GAMES}${url}`;
      }
    }
    try {
      return new URL(url, window.location.href).href;
    } catch {
      return url;
    }
  }

  const normalized = `/${url}`;
  const isHtml = looksLikeHtml(url);
  return `${isHtml ? currentProvider.MAIN : currentProvider.GAMES}${normalized}`;
}

export async function fetchHtmlAsBlobUrl(url, options = {}) {
  const { injectBannerHtml = "", skipRewrite = false } = options;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  const html = await res.text();

  const urlObj = new URL(url);
  const baseHref = url.replace(/[^/]*$/, "");

  const baseHrefFromDoc = (() => {
    const m = html.match(/<base\b[^>]*\bhref\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s"'<>]+))[^>]*>/i);
    const href = m ? m[1] || m[2] || m[3] : null;
    if (!href) return null;
    try {
      return new URL(href, urlObj).href;
    } catch {
      return null;
    }
  })();

  let assetDirBase;
  let rootBase;

  if (isCdnGhUrl(urlObj.href)) {
    const p = urlObj.pathname.split("/").filter(Boolean);
    const user = p[1];
    const repoWithRef = p[2];
    const path = p.slice(3).join("/");
    const dirPath = path.replace(/[^/]*$/, "");
    const provider = getCdnProvider(urlObj) || CDN_PROVIDERS.jsdelivr;
    const baseUrl = provider.HOSTNAMES[0].includes("jsdelivr")
      ? "https://cdn.jsdelivr.net"
      : "https://cdn.jsdelivr.net";
    const repoBase = `${baseUrl}${provider.GH_PATH}${user}/${repoWithRef}/`;
    assetDirBase = `${repoBase}${dirPath}`;
    rootBase = repoBase;
  } else {
    assetDirBase = baseHref;
    const hostname = window.location?.hostname || "";
    const currentProvider = getCdnProviderByHostname(hostname) || CDN_PROVIDERS.jsdelivr;
    rootBase = currentProvider.GAMES + "/";
  }

  if (baseHrefFromDoc) {
    try {
      assetDirBase = baseHrefFromDoc.endsWith("/") ? baseHrefFromDoc : new URL(".", baseHrefFromDoc).href;
      rootBase = getCdnRepoBase(baseHrefFromDoc) || new URL("/", baseHrefFromDoc).href;
    } catch {}
  }
  const lowerUrl = url.toLowerCase();
  const isWasmAutoIgnored = lowerUrl.includes("/static/games/wasm/") || lowerUrl.includes("/static/apps/");
  const legacyIgnored =
    [
      "angrybirds",
      "subway",
      "azahar",
      "catgoesfishing",
      "cat goes fishing",
      "tabs",
      "catfish",
      "roblox",
      "gamesforaetheris",
      "cat_fish",
      "undertale"
    ].some((p) => lowerUrl.includes(p.toLowerCase())) || lowerUrl.includes("catgoesfishing.html");
  const isIgnored = skipRewrite || isWasmAutoIgnored || legacyIgnored;

  let rewritten = html;
  if (!isIgnored) {
    rewritten = html
      .replace(/\b(src|poster|data)=([\"'])\/next\/(?!\/)/gi, `$1=$2${assetDirBase}next/`)
      .replace(/<(link|a|form)\b([^>]*?)\b(href|action)=([\"'])\/next\/(?!\/)/gi, `<$1$2$3=$4${assetDirBase}next/`)
      .replace(/\burl\(\s*([\"']?)\/next\/(?!\/)/g, `url($1${assetDirBase}next/`)
      .replace(/\b(src|poster|data)=([\"'])\/static\/games\/(?!\/)/gi, `$1=$2${rootBase}`)
      .replace(/\b(src|poster|data)=([\"'])\/(?!\/)/gi, `$1=$2${rootBase}`)
      .replace(/<(link|a|form)\b([^>]*?)\b(href|action)=([\"'])\/static\/games\/(?!\/)/gi, `<$1$2$3=$4${rootBase}`)
      .replace(/<(link|a|form)\b([^>]*?)\b(href|action)=([\"'])\/(?!\/)/gi, `<$1$2$3=$4${rootBase}`)
      .replace(/\burl\(\s*([\"']?)\/static\/games\/(?!\/)/g, `url($1${rootBase}`)
      .replace(/\burl\(\s*([\"']?)\/(?!\/)/g, `url($1${rootBase}`)
      .replace(/\b(src|poster|data)=([\"'])(?!https?:|data:|blob:|\/\/|#|\/)/gi, `$1=$2${assetDirBase}`)
      .replace(
        /<(link|a|form)\b([^>]*?)\b(href|action)=([\"'])(?!https?:|data:|blob:|\/\/|#|\/)/gi,
        `<$1$2$3=$4${assetDirBase}`
      )
      .replace(/\burl\(\s*([\"']?)(?!https?:|data:|blob:|\/\/|#|\/)/g, `url($1${assetDirBase}`);
  }

  const looksLikeUnityWebgl =
    /\bcreateUnityInstance\s*\(/.test(rewritten) ||
    /\bunityVersion\s*:\s*["']/.test(rewritten) ||
    (/\bUnity WebGL\b/i.test(rewritten) && /\bBuild\/.*\.loader\.js\b/i.test(rewritten));
  if (looksLikeUnityWebgl) {
    const isAlreadyAbsolute = (value) => /^(https?:|data:|blob:|\/)/i.test(value);
    rewritten = rewritten.replace(
      /\b(dataUrl|frameworkUrl|codeUrl|streamingAssetsUrl|unityWebglBuildUrl)\s*:\s*(["'])([^"']+)\2/g,
      (m, key, quote, value) => {
        if (isAlreadyAbsolute(value)) return m;
        const abs = new URL(value, assetDirBase).href;
        return `${key}: ${quote}${abs}${quote}`;
      }
    );
  }

  const unityDocumentUrlShim = looksLikeUnityWebgl
    ? "<script>try{(function(){var u=" +
      JSON.stringify(url) +
      ';try{Object.defineProperty(document,"URL",{configurable:true,get:function(){return u;}});}catch(e){}})();}catch(e){}<\/script>'
    : "";

  const injectedScripts = `<script>
(function() {
  try {
    const _rs = history.replaceState.bind(history);
    const _ps = history.pushState.bind(history);
    history.replaceState = function(s,t,u){ try{ return _rs(s,t,u);}catch(e){ if(String(e).includes("SecurityError")&&String(u||"").startsWith("blob:")) return; throw e; } };
    history.pushState = function(s,t,u){ try{ return _ps(s,t,u);}catch(e){ if(String(e).includes("SecurityError")&&String(u||"").startsWith("blob:")) return; throw e; } };
  } catch {}
  const ROOT_BASE = "${rootBase}";
  const ASSET_DIR_BASE = "${assetDirBase}";
  const JSDELIVR_GH_BASE = "https://cdn.jsdelivr.net/gh/";
  const STATICALLY_GH_BASE = "https://cdn.jsdelivr.net/gh/";

  function resolve(url) {
    if (typeof url !== 'string' || !url) return url;
    if (url.startsWith('blob:') || url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')) return url;
    let p = url;
    if (p.startsWith('/')) {
      p = p.slice(1);
      if (p.startsWith('next/')) return ASSET_DIR_BASE + p;
      if (p.startsWith('static/games/')) p = p.replace('static/games/', '');
      return ROOT_BASE + p;
    }
    return ASSET_DIR_BASE + url;
  }

  function postNavigate(url) {
    try { parent.postMessage({ __yukios: 'navigate', url }, '*'); } catch {}
  }

  const createElement = document.createElement.bind(document);
  document.createElement = function(tag) {
    const el = createElement(tag);
    const tagName = tag.toLowerCase();
    if (tagName === 'script') {
      let src = '';
      Object.defineProperty(el, 'src', {
        get() { return src; },
        set(val) {
          src = resolve(val);
        },
        configurable: true
      });
    } else if (tagName === 'iframe' || tagName === 'frame') {
      Object.defineProperty(el, 'src', {
        get() { return el.getAttribute('src'); },
        set(val) { el.setAttribute('src', resolve(val)); },
        configurable: true
      });
    }
    return el;
  };

  const setAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function(name, value) {
    const tagName = this.tagName.toLowerCase();
    const attrName = name.toLowerCase();
    if ((tagName === 'iframe' || tagName === 'frame' || tagName === 'script' || tagName === 'img') && attrName === 'src') {
      value = resolve(value);
    } else if ((tagName === 'link' || tagName === 'a') && attrName === 'href') {
      value = resolve(value);
    }
    return setAttribute.call(this, name, value);
  };

  document.addEventListener('click', function(e) {
    const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    const rawHref = a.getAttribute('href');
    if (!rawHref || rawHref[0] === '#' || /^javascript:/i.test(rawHref)) return;
    if (typeof url === 'string' && (url.startsWith(JSDELIVR_GH_BASE) || url.startsWith(STATICALLY_GH_BASE) || url.startsWith('blob:'))) {
      e.preventDefault();
      postNavigate(url);
    }
  }, true);

  document.addEventListener('submit', function(e) {
    const form = e.target;
    if (!form || !form.getAttribute) return;
    const action = form.getAttribute('action') || document.baseURI;
    let url = null;
    try { url = new URL(action, document.baseURI).href; } catch { return; }
    if (typeof url === 'string' && (url.startsWith(JSDELIVR_GH_BASE) || url.startsWith(STATICALLY_GH_BASE) || url.startsWith('blob:'))) {
      e.preventDefault();
      postNavigate(url);
    }
  }, true);
})();
<\/script>${unityDocumentUrlShim}`;

  let withBase = rewritten;

  if (injectBannerHtml) {
    if (/<\/body\s*>/i.test(withBase)) {
      withBase = withBase.replace(/<\/body\s*>/i, `${injectBannerHtml}</body>`);
    } else {
      withBase = `${withBase}\n${injectBannerHtml}`;
    }
  }

  const historyGuard = `<script>try{const _rs=history.replaceState.bind(history),_ps=history.pushState.bind(history);history.replaceState=function(s,t,u){try{return _rs(s,t,u);}catch(e){if(String(e).includes("SecurityError")&&String(u||"").startsWith("blob:"))return;throw e;}};history.pushState=function(s,t,u){try{return _ps(s,t,u);}catch(e){if(String(e).includes("SecurityError")&&String(u||"").startsWith("blob:"))return;throw e;}};}catch{}<\/script>${unityDocumentUrlShim}`;
  if (lowerUrl.includes("wasmdotrip") || lowerUrl.includes("peak-port")) {
    rewritten = rewritten.replace(
      /history\.replaceState\s*\(\s*null\s*,\s*""\s*,\s*u\.toString\(\)\s*\)\s*;/g,
      'try{history.replaceState(null,"",u.toString());}catch(e){}'
    );
  }
  const hasBase = /<base\b[^>]*>/i.test(rewritten);

  if (isIgnored) {
    if (hasBase) {
      withBase = rewritten.replace(/<base\b[^>]*>/i, (m) => `${m}\n${historyGuard}`);
    } else if (/<head\b[^>]*>/i.test(rewritten)) {
      withBase = rewritten.replace(/<head\b[^>]*>/i, (m) => `${m}\n<base href="${baseHref}">\n${historyGuard}`);
    } else {
      withBase = `<base href="${baseHref}">\n${historyGuard}\n${rewritten}`;
    }
  } else if (hasBase) {
    withBase = rewritten.replace(/<base\b[^>]*>/i, (m) => `${m}\n${injectedScripts}`);
  } else if (/<head\b[^>]*>/i.test(rewritten)) {
    withBase = rewritten.replace(/<head\b[^>]*>/i, (m) => `${m}\n<base href="${baseHref}">\n${injectedScripts}`);
  } else {
    withBase = `<base href="${baseHref}">\n${injectedScripts}\n${rewritten}`;
  }

  return URL.createObjectURL(new Blob([withBase], { type: "text/html" }));
}
