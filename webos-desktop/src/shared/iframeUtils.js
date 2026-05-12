import {
  looksLikeHtml,
  isCdnGhUrl,
  resolveUrl as resolveUrlCentralized,
  fetchHtmlAsBlobUrl as fetchHtmlAsBlobUrlCentralized,
  CDN_BASES
} from "./assetResolver.js";

export { looksLikeHtml, isCdnGhUrl, fetchHtmlAsBlobUrlCentralized as fetchHtmlAsBlobUrl };

export const STATICALLY_BASE = CDN_BASES.GAMES;
export const YUKIOS_STATICALLY_BASE = CDN_BASES.MAIN;

export async function resolveUrl(url, isStaticallyGh = false) {
  return resolveUrlCentralized(url, isStaticallyGh);
}
