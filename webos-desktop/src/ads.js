import { StorageKeys, os, $, createElement } from "./framework.js";
import { parseBool } from "./utils/utils.js";

export const ADSTERRA_KEYS = {
  leaderboard: "28c33f91ee21bcf1063e489aae3024f8",
  rectangle: "914131b4a8e7414d1576d6d7c5a6c87f",
  storeWide: "f88fd46583493c3820f283948e5e5391",
  storeRect: "ee9dc67de90729e2804aa8aba6454ec8"
};

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
    const slot = $("#" + containerId);
    if (!slot) return;
    const cfgScript = createElement("script");
    cfgScript.text = `atOptions = { 'key': '${key}', 'format': '${format}', 'height': ${height}, 'width': ${width}, 'params': {} };`;
    slot.appendChild(cfgScript);
    const invokeScript = createElement("script");
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
  const slot = $("#" + containerId);
  if (!slot) return;
  const s = createElement("script");
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

export function suppressAdBlocks(container) {
  if (!container) return;
  container.querySelectorAll(".store-ad-block, [id^='container-']").forEach((el) => {
    el.style.display = "none";
  });
}

export function buildGameAdBannerHtml(key) {
  return `<div id="yukios-game-ad-banner">
  <div class="yukios-game-ad-label">Advertisement</div>
  <button class="yukios-game-ad-close" title="Close advertisement">&times;</button>
  <div id="yukios-game-ad-slot"></div>
</div>
<style>
#yukios-game-ad-banner{position:fixed;top:0;left:0;right:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;gap:12px;padding:8px;background:rgba(16,16,22,0.92);border-bottom:1px solid rgba(255,255,255,0.08);font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif}
#yukios-game-ad-banner .yukios-game-ad-label{font-size:11px;color:rgba(255,255,255,0.6);letter-spacing:1px;text-transform:uppercase;white-space:nowrap}
#yukios-game-ad-banner .yukios-game-ad-close{position:absolute;top:8px;right:8px;border:none;background:rgba(255,255,255,0.1);color:#fff;width:24px;height:24px;border-radius:6px;cursor:pointer;font-size:18px;line-height:1;display:flex;align-items:center;justify-content:center}
#yukios-game-ad-banner .yukios-game-ad-close:hover{background:rgba(255,255,255,0.2)}
</style>
<script>
(function(){
  function init(){
    var banner=document.getElementById('yukios-game-ad-banner');
    if(!banner) return;
    var close=banner.querySelector('.yukios-game-ad-close');
    if(close) close.addEventListener('click',function(){ banner.remove(); });
    var slot=document.getElementById('yukios-game-ad-slot');
    if(!slot) return;
    var cfg=document.createElement('script');
    cfg.text="atOptions = { 'key': '${key}', 'format': 'iframe', 'height': 90, 'width': 728, 'params': {} };";
    slot.appendChild(cfg);
    var invoke=document.createElement('script');
    invoke.src='https://www.highperformanceformat.com/${key}/invoke.js';
    invoke.async=true;
    slot.appendChild(invoke);
  }
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',init);}else{init();}
  window.addEventListener('load',init);
})();
</script>`;
}
