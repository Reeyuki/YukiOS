import { StorageKeys } from "../StorageKeys.js";

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
    currentMirrorId = localStorage.getItem(StorageKeys.cdnMirror) || "jsdelivr";
  }
  return currentMirrorId;
}

export function setCdnMirror(id) {
  if (CDN_MIRRORS.find((m) => m.id === id)) {
    currentMirrorId = id;
    localStorage.setItem(StorageKeys.cdnMirror, id);
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
      return resolveGhUrl("https://cdn.jsdelivr.net/gh/Reeyuki/yukios-games@main");
    },
    get MAIN() {
      return resolveGhUrl("https://cdn.jsdelivr.net/gh/Reeyuki/yukios@main");
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
    const base = document.querySelector("base");
    if (base && base.href.includes("cdn.jsdelivr.net/gh/")) {
      base.href = resolveGhUrl(base.href);
    }

    document.querySelectorAll("img[src]").forEach((img) => {
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

    const logoUrl = resolveYukiAsset("static/icons/logo.png");
    document.documentElement.style.setProperty("--start-logo-url", `url("${logoUrl}")`);
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

export function isJsdelivrHostname(hostname) {
  if (typeof hostname !== "string") return false;
  return hostname === "cdn.jsdelivr.net" || hostname.endsWith(".jsdelivr.net");
}

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

export function getCurrentJsdelivrRepoBase() {
  try {
    const here = new URL(window.location.href);
    if (here.hostname !== "cdn.jsdelivr.net") return null;
    const p = here.pathname.split("/").filter(Boolean);
    if (p[0] !== "gh" || !p[1] || !p[2]) return null;
    return `https://cdn.jsdelivr.net/gh/${p[1]}/${p[2]}`;
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

export function getJsdelivrRepoBase(url) {
  try {
    const uo = new URL(url);
    if (uo.hostname === "cdn.jsdelivr.net") {
      const p = uo.pathname.split("/").filter(Boolean);
      if (p[0] === "gh" && p[1] && p[2]) {
        return `https://cdn.jsdelivr.net/gh/${p[1]}/${p[2]}/`;
      }
    }
  } catch {}
  return null;
}

export function resolveIconUrl(url) {
  if (typeof url !== "string") return url;
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

export async function fetchHtmlAsBlobUrl(url) {
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
  const isIgnored =
    ["angrybirds", "subway", "azahar", "catgoesfishing", "cat goes fishing", "catfish", "cat_fish"].some((p) =>
      url.toLowerCase().includes(p.toLowerCase())
    ) || url.toLowerCase().includes("catgoesfishing.html");

  let rewritten = html;
  if (!isIgnored) {
    rewritten = html
      .replace(/\b(src|poster|data)=([\"'])\/_next\/(?!\/)/gi, `$1=$2${assetDirBase}_next/`)
      .replace(/<(link|a|form)\b([^>]*?)\b(href|action)=([\"'])\/_next\/(?!\/)/gi, `<$1$2$3=$4${assetDirBase}_next/`)
      .replace(/\burl\(\s*([\"']?)\/_next\/(?!\/)/gi, `url($1${assetDirBase}_next/`)
      .replace(/\b(src|poster|data)=([\"'])\/static\/games\/(?!\/)/gi, `$1=$2${rootBase}`)
      .replace(/\b(src|poster|data)=([\"'])\/(?!\/)/gi, `$1=$2${rootBase}`)
      .replace(/<(link|a|form)\b([^>]*?)\b(href|action)=([\"'])\/static\/games\/(?!\/)/gi, `<$1$2$3=$4${rootBase}`)
      .replace(/<(link|a|form)\b([^>]*?)\b(href|action)=([\"'])\/(?!\/)/gi, `<$1$2$3=$4${rootBase}`)
      .replace(/\burl\(\s*([\"']?)\/static\/games\/(?!\/)/gi, `url($1${rootBase}`)
      .replace(/\burl\(\s*([\"']?)\/(?!\/)/gi, `url($1${rootBase}`)
      .replace(/\b(src|poster|data)=([\"'])(?!https?:|data:|blob:|\/\/|#|\/)/gi, `$1=$2${assetDirBase}`)
      .replace(
        /<(link|a|form)\b([^>]*?)\b(href|action)=([\"'])(?!https?:|data:|blob:|\/\/|#|\/)/gi,
        `<$1$2$3=$4${assetDirBase}`
      )
      .replace(/\burl\(\s*([\"']?)(?!https?:|data:|blob:|\/\/|#|\/)/gi, `url($1${assetDirBase}`);
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

  const injectedScripts = `<script>
(function() {
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
      if (p.startsWith('_next/')) return ASSET_DIR_BASE + p;
      if (p.startsWith('static/games/')) p = p.replace('static/games/', '');
      return ROOT_BASE + p;
    }
    return ASSET_DIR_BASE + url;
  }

  function postNavigate(url) {
    try { parent.postMessage({ __yukios: 'navigate', url }, '*'); } catch {}
  }

  const _createElement = document.createElement.bind(document);
  document.createElement = function(tag) {
    const el = _createElement(tag);
    const tagName = tag.toLowerCase();
    if (tagName === 'script') {
      let _src = '';
      Object.defineProperty(el, 'src', {
        get() { return _src; },
        set(val) {
          _src = resolve(val);
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

  const _setAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function(name, value) {
    const tagName = this.tagName.toLowerCase();
    const attrName = name.toLowerCase();
    if ((tagName === 'iframe' || tagName === 'frame' || tagName === 'script' || tagName === 'img') && attrName === 'src') {
      value = resolve(value);
    } else if ((tagName === 'link' || tagName === 'a') && attrName === 'href') {
      value = resolve(value);
    }
    return _setAttribute.call(this, name, value);
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
<\/script>`;

  let withBase = rewritten;
  const hasBase = /<base\b[^>]*>/i.test(rewritten);

  if (isIgnored) {
    withBase = rewritten;
  } else if (hasBase) {
    withBase = rewritten.replace(/<base\b[^>]*>/i, (m) => `${m}\n${injectedScripts}`);
  } else if (/<head\b[^>]*>/i.test(rewritten)) {
    withBase = rewritten.replace(/<head\b[^>]*>/i, (m) => `${m}\n<base href="${baseHref}">\n${injectedScripts}`);
  } else {
    withBase = `<base href="${baseHref}">\n${injectedScripts}\n${rewritten}`;
  }

  return URL.createObjectURL(new Blob([withBase], { type: "text/html" }));
}
