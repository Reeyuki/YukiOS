import {
  looksLikeHtml,
  isJsDelivrGhUrl,
  resolveUrl as resolveUrlCentralized,
  fetchHtmlAsBlobUrl as fetchHtmlAsBlobUrlCentralized,
  CDN_BASES
} from "./assetResolver.js";

export { looksLikeHtml, isJsDelivrGhUrl, fetchHtmlAsBlobUrlCentralized as fetchHtmlAsBlobUrl };

export const JSDELIVR_BASE = CDN_BASES.GAMES;
export const YUKIOS_JSDELIVR_BASE = CDN_BASES.MAIN;

export async function resolveUrl(url, isJsDelivrGh = false) {
  return resolveUrlCentralized(url, isJsDelivrGh);
}
