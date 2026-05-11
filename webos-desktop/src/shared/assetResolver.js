export const CDN_BASES = {
  GAMES: "https://cdn.jsdelivr.net/gh/reeyuki/yukios-games@main",
  MAIN: "https://cdn.jsdelivr.net/gh/reeyuki/yukios@main",
  NPM: "https://cdn.jsdelivr.net/npm"
};

export const JSDELIVR_BASE = CDN_BASES.GAMES;
export const YUKIOS_JSDELIVR_BASE = CDN_BASES.MAIN;
export const JSDELIVR_GH_BASE = CDN_BASES.MAIN;

export const isJsDelivrGhUrl = (url) =>
  typeof url === "string" &&
  (url.startsWith("https://cdn.jsdelivr.net/gh/") || url.startsWith("http://cdn.jsdelivr.net/gh/"));

export function isJsDelivrHostname(hostname) {
  if (typeof hostname !== "string") return false;
  return (
    hostname === "cdn.jsdelivr.net" ||
    hostname.endsWith(".jsdelivr.net") ||
    hostname.includes("quantil.jsdelivr.net") ||
    hostname.includes("originfastly.jsdelivr.net") ||
    hostname.includes("gcore.jsdelivr.net") ||
    hostname.includes("cdn.staticdelivr.com")
  );
}

export const looksLikeHtml = (url) => typeof url === "string" && /\.html?([?#].*)?$/i.test(url);

export function getCurrentJsDelivrRepoBase() {
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

export function getJsDelivrRepoBase(url) {
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

  try {
    const hostname = window.location?.hostname || "";
    const isJsdelivr = isJsDelivrHostname(hostname);
    if (isJsdelivr && url.startsWith("/static/")) {
      return `${CDN_BASES.MAIN}${url}`;
    }
  } catch {}

  if (/^https?:\/\//.test(url)) {
    try {
      const u = new URL(url);
      const isJsdelivr = isJsDelivrHostname(u.hostname);
      if (isJsdelivr && u.pathname.startsWith("/static/")) {
        return `${CDN_BASES.MAIN}${u.pathname}${u.search}${u.hash}`;
      }
    } catch {}
  }

  return url;
}

export function resolveWallpaperUrl(url) {
  if (typeof url !== "string") return null;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    try {
      const u = new URL(url);
      if (isJsDelivrHostname(u.hostname) && u.pathname.startsWith("/static/wallpapers/")) {
        return `${CDN_BASES.MAIN}${u.pathname}${u.search}${u.hash}`;
      }
    } catch {}
    return url;
  }
  if (!url.startsWith("/static/wallpapers/")) return url;
  try {
    if (window.location?.hostname === "cdn.jsdelivr.net") {
      return `${CDN_BASES.MAIN}${url}`;
    }
  } catch {}
  return url;
}

export async function resolveUrl(url, isJsDelivrGh = false) {
  if (!url) return url;
  if (url.startsWith("blob:") || url.startsWith("data:")) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  const currentRepoBase = getCurrentJsDelivrRepoBase();

  if (url.startsWith("/")) {
    const repoBase = currentRepoBase;
    if (repoBase) return `${repoBase}${url}`;
    if (isJsDelivrGh) return `${CDN_BASES.GAMES}${url}`;
    if (looksLikeHtml(url)) {
      try {
        const origin = new URL(window.location.href).origin;
        if (/^https:\/\/cdn\.jsdelivr\.net$/i.test(origin)) {
          return `${CDN_BASES.GAMES}${url}`;
        }
        return new URL(url, window.location.href).href;
      } catch {
        return `${CDN_BASES.GAMES}${url}`;
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
  return `${isHtml ? CDN_BASES.MAIN : CDN_BASES.GAMES}${normalized}`;
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

  if (isJsDelivrGhUrl(urlObj.href)) {
    const p = urlObj.pathname.split("/").filter(Boolean);
    const user = p[1];
    const repoWithRef = p[2];
    const path = p.slice(3).join("/");
    const dirPath = path.replace(/[^/]*$/, "");
    const repoBase = `https://cdn.jsdelivr.net/gh/${user}/${repoWithRef}/`;
    assetDirBase = `${repoBase}${dirPath}`;
    rootBase = repoBase;
  } else {
    assetDirBase = baseHref;
    rootBase = CDN_BASES.GAMES + "/";
  }

  if (baseHrefFromDoc) {
    try {
      assetDirBase = baseHrefFromDoc.endsWith("/") ? baseHrefFromDoc : new URL(".", baseHrefFromDoc).href;
      rootBase = getJsDelivrRepoBase(baseHrefFromDoc) || new URL("/", baseHrefFromDoc).href;
    } catch {}
  }

  const isIgnored =
    ["angrybirds", "subway"].some((p) => url.toLowerCase().includes(p.toLowerCase())) || html.includes("cdn.jsdelivr");

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

  function resolve(url) {
    if (typeof url !== 'string' || !url) return url;
    if (url.startsWith('blob:') || url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('
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
    const url = a.href;
    if (typeof url === 'string' && (url.startsWith(JSDELIVR_GH_BASE) || url.startsWith('blob:'))) {
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
    if (typeof url === 'string' && (url.startsWith(JSDELIVR_GH_BASE) || url.startsWith('blob:'))) {
      e.preventDefault();
      postNavigate(url);
    }
  }, true);
})();
<\/script>`;

  let withBase = rewritten;
  const hasBase = /<base\b[^>]*>/i.test(rewritten);

  if (isIgnored) {
    if (!hasBase) {
      if (/<head\b[^>]*>/i.test(rewritten)) {
        withBase = rewritten.replace(/<head\b[^>]*>/i, (m) => `${m}\n<base href="${baseHref}">`);
      } else {
        withBase = `<base href="${baseHref}">\n${rewritten}`;
      }
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
