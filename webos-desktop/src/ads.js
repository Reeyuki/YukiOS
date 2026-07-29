import { StorageKeys, os } from "./framework.js";
import { parseBool } from "./utils/utils.js";

export function shouldEnableAds() {
  return true;
  const hostname = window.location.hostname;
  if (hostname.includes("vercel") || hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]") {
    return false;
  }
  const adsDisabled = parseBool(os.storage.get(StorageKeys.adsDisabled));
  if (adsDisabled) {
    return false;
  }
  return true;
}

export function injectAdsterraAd(containerId, key, width, height, delay = 0, format = "iframe") {
  if (!shouldEnableAds()) return;

  const doInject = () => {
    const slot = document.getElementById(containerId);
    if (!slot) return;
    const cfgScript = document.createElement("script");
    cfgScript.text = `atOptions = { 'key': '${key}', 'format': '${format}', 'height': ${height}, 'width': ${width}, 'params': {} };`;
    slot.appendChild(cfgScript);
    const invokeScript = document.createElement("script");
    invokeScript.src = `https://www.highperformanceformat.com/${key}/invoke.js`;
    invokeScript.async = true;
    slot.appendChild(invokeScript);
  };

  if (delay > 0) {
    setTimeout(doInject, delay);
  } else {
    doInject();
  }
}
