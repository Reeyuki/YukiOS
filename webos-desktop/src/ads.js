import "./styles/ads.css";
import { StorageKeys, os } from "./framework.js";

const INTERSTITIAL_ENABLED = false;
const ADMAVEN_INTERSTITIAL_URL = "";
const INTERSTITIAL_EVERY_N_CLOSES = 3;

export function shouldEnableAds() {
  const hostname = window.location.hostname;
  if (hostname.includes("vercel") || hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]") {
    return false;
  }
  const adsDisabled = os.storage.get(StorageKeys.adsDisabled) === "true";
  if (adsDisabled) {
    return false;
  }
  return true;
}

export class AdsManager {
  static instance = null;

  constructor(windowManager) {
    this.wm = windowManager;
    AdsManager.instance = this;
  }

  onGameClosed() {
    if (!shouldEnableAds() || !INTERSTITIAL_ENABLED || !ADMAVEN_INTERSTITIAL_URL) return;

    let count = Number(os.storage.get(StorageKeys.interstitialGameCloseCount)) || 0;
    count++;

    if (count >= INTERSTITIAL_EVERY_N_CLOSES) {
      this.showInterstitial();
      count = 0;
    }

    os.storage.set(StorageKeys.interstitialGameCloseCount, String(count));
  }

  showInterstitial() {
    if (document.querySelector(".interstitial-overlay")) return;

    const overlay = document.createElement("div");
    overlay.className = "interstitial-overlay";

    const container = document.createElement("div");
    container.className = "interstitial-container";

    const countdown = document.createElement("div");
    countdown.className = "interstitial-countdown";
    countdown.textContent = "5";

    const closeBtn = document.createElement("button");
    closeBtn.className = "interstitial-close";
    closeBtn.textContent = "Skip";
    closeBtn.addEventListener("click", () => this.dismissInterstitial(overlay));

    container.appendChild(closeBtn);
    container.appendChild(countdown);
    overlay.appendChild(container);
    document.body.appendChild(overlay);

    if (ADMAVEN_INTERSTITIAL_URL) {
      const adSlot = document.createElement("div");
      adSlot.id = "interstitial-ad-slot";
      container.insertBefore(adSlot, closeBtn);

      const s = document.createElement("script");
      s.src = ADMAVEN_INTERSTITIAL_URL;
      s.async = true;
      adSlot.appendChild(s);
    }

    let remaining = 5;
    const timer = setInterval(() => {
      remaining--;
      countdown.textContent = String(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
        this.dismissInterstitial(overlay);
      }
    }, 1000);

    overlay._timer = timer;

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        this.dismissInterstitial(overlay);
      }
    });
  }

  dismissInterstitial(overlay) {
    if (overlay._timer) {
      clearInterval(overlay._timer);
    }
    overlay.remove();
  }

  destroy() {}
}
