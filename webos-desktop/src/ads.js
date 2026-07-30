import { StorageKeys, os } from "./framework.js";
import { parseBool } from "./utils/utils.js";

const POPUNDER_COOLDOWN = 150000;
const POPUNDER_KEY = "yukiOS_ad_popunder";
const SMARTLINK_COOLDOWN = 300000;
const SMARTLINK_KEY = "yukiOS_ad_smartlink";

const POPUNDER_SRC = "https://pl29443507.effectivecpmnetwork.com/e1/d5/61/e1d56103a8984a6c28d083490860b574.js";
const SMARTLINK_URL = "https://www.effectivecpmnetwork.com/t8h6qm0ki?key=0d9e57d41211b42cb2ae88e762a656c0";

export function shouldEnableAds() {
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
  if (!shouldEnableAds()) return;
  const last = localStorage.getItem(SMARTLINK_KEY);
  if (last && Date.now() - Number(last) <= SMARTLINK_COOLDOWN) return;
  localStorage.setItem(SMARTLINK_KEY, String(Date.now()));
  window.open(SMARTLINK_URL, "_blank");
}

export function initPopunder() {
  if (!shouldEnableAds()) return;
  const last = localStorage.getItem(POPUNDER_KEY);
  if (last && Date.now() - Number(last) <= POPUNDER_COOLDOWN) return;

  const handler = () => {
    localStorage.setItem(POPUNDER_KEY, String(Date.now()));
    const s = document.createElement("script");
    s.src = POPUNDER_SRC;
    s.async = true;
    document.body.appendChild(s);
  };

  document.addEventListener("click", handler, { once: true });
}
