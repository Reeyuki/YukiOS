import { StorageKeys, os } from "./framework.js";
import { parseBool } from "./utils/utils.js";

export function shouldEnableAds() {
  const hostname = window.location.hostname;
  if (hostname.includes("vercel")) {
    return false;
  }
  const adsDisabled = parseBool(os.storage.get(StorageKeys.adsDisabled));
  if (adsDisabled) {
    return false;
  }
  return true;
}

export function injectAdsterraAd(containerId, key, width, height, delay = 0, format = "iframe") {
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

export function injectNativeAd(containerId) {
  const slot = document.getElementById(containerId);
  if (!slot) return;
  const s = document.createElement("script");
  s.async = true;
  s.setAttribute("data-cfasync", "false");
  s.src = "https://pl29381085.effectivecpmnetwork.com/5f797791a9771b6940fb9385a69ce168/invoke.js";
  slot.appendChild(s);
}

export function maybeTriggerSmartlink() {
  return;
}

export function initPopunder() {
  return;
}
