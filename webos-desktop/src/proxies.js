export const PROXIES = [
  { label: "Codetabs", prefix: "https://api.codetabs.com/v1/proxy?quest=" },
  { label: "WhateverOrigin", prefix: "https://whateverorigin.org/get?url=" },
  { label: "proxy.2677929.xyz", prefix: "https://proxy.2677929.xyz/" },
  { label: "cors-anywhere.herokuapp", prefix: "cors-anywhere.herokuapp.com/" },
  { label: "Tor Anonymous", type: "tor" }
];

export function clampProxyIndex(index, proxies = PROXIES) {
  const n = Array.isArray(proxies) ? proxies.length : 0;
  if (!n) return 0;
  const i = Number(index);
  if (!Number.isFinite(i)) return 0;
  if (Math.trunc(i) === -1) return -1;
  return Math.max(0, Math.min(n - 1, Math.trunc(i)));
}

export function buildProxyUrl(url, proxyIndex = 0, proxies = PROXIES) {
  const i = clampProxyIndex(proxyIndex, proxies);
  if (i === -1) return url;
  const proxy = proxies[i];
  if (proxy.type === "tor") return null;
  return proxy.prefix + encodeURIComponent(url);
}

export class ProxyRegistry {
  constructor({ proxies = PROXIES } = {}) {
    this.proxies = Array.isArray(proxies) && proxies.length ? proxies : PROXIES;
  }

  list() {
    return this.proxies;
  }

  build(url, proxyIndex = 0) {
    return buildProxyUrl(url, proxyIndex, this.proxies);
  }
}

export async function fetchHtmlThroughProxy(url, proxyIndex = 0, proxies = PROXIES) {
  const proxyUrl = buildProxyUrl(url, proxyIndex, proxies);
  if (!proxyUrl) throw new Error("Tor proxy not supported in fetchHtmlThroughProxy");
  const res = await fetch(proxyUrl);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${proxyUrl}`);

  let html = await res.text();

  const urlObj = new URL(url);
  const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
  const proxyPrefix = proxies[clampProxyIndex(proxyIndex, proxies)].prefix;

  const rewriteUrl = (resourceUrl) => {
    if (!resourceUrl) return resourceUrl;
    try {
      const absoluteUrl = new URL(resourceUrl, baseUrl);
      return proxyPrefix + encodeURIComponent(absoluteUrl.href);
    } catch {
      return resourceUrl;
    }
  };

  html = html.replace(/(src=|href=|action=|content=)(["'])([^"']+)\2/gi, (match, attr, quote, url) => {
    if (url.startsWith("data:") || url.startsWith("blob:") || url.startsWith("#")) {
      return match;
    }
    return `${attr}${quote}${rewriteUrl(url)}${quote}`;
  });

  html = html.replace(/url\((["']?)([^"')]+)\1\)/gi, (match, quote, url) => {
    if (url.startsWith("data:") || url.startsWith("blob:") || url.startsWith("#")) {
      return match;
    }
    return `url(${quote}${rewriteUrl(url)}${quote})`;
  });

  const blob = new Blob([html], { type: "text/html" });
  return URL.createObjectURL(blob);
}
