import { WindowHelper } from "./utils/WindowHelper.js";
import { StorageKeys } from "./StorageKeys.js";
import { os } from "./os/index.js";

const AD_STORAGE_KEY = StorageKeys.adStorageState;
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
let interactionCount = 0;

const POPUNDER_SCRIPT = "https://pl29443507.profitablecpmratenetwork.com/e1/d5/61/e1d56103a8984a6c28d083490860b574.js";

function loadMeta() {
  try {
    return (
      os.storage.get(AD_STORAGE_KEY) || {
        dailyCount: 0,
        lastShown: 0,
        lastClosed: 0,
        lastReset: Date.now(),
        initialized: false,
        smartlinkShown: false,
        popunderShown: false,
        popunderDate: null
      }
    );
  } catch {
    return {
      dailyCount: 0,
      lastShown: 0,
      lastClosed: 0,
      lastReset: Date.now(),
      initialized: false,
      smartlinkShown: false,
      popunderShown: false,
      popunderDate: null
    };
  }
}

function saveMeta(meta) {
  os.storage.set(AD_STORAGE_KEY, meta);
}

function resetDaily(meta) {
  const now = Date.now();
  const window = 1000 * 60 * 60 * 4;

  if (now - meta.lastReset > window) {
    meta.dailyCount = 0;
    meta.lastReset = now;
    meta.popunderShown = false;
    meta.popunderDate = null;
  }
}

const ADS = {
  banner: {
    key: "66095aa642a3a95fbc1eda8716d518dd",
    src: "https://www.highperformanceformat.com/66095aa642a3a95fbc1eda8716d518dd/invoke.js",
    width: 468,
    height: 60
  },
  native: {
    containerId: "container-5f797791a9771b6940fb9385a69ce168",
    src: "https://pl29381085.profitablecpmratenetwork.com/5f797791a9771b6940fb9385a69ce168/invoke.js"
  }
};

const ENGAGEMENT_TIERS = {
  cold: { min: 0, max: 39, maxPerDay: 2, minInterval: 20 * 60 * 1000, postCloseCooldown: 15 * 60 * 1000 },
  warm: { min: 40, max: 69, maxPerDay: 5, minInterval: 8 * 60 * 1000, postCloseCooldown: 8 * 60 * 1000 },
  hot: { min: 70, max: 100, maxPerDay: 10, minInterval: 4 * 60 * 1000, postCloseCooldown: 5 * 60 * 1000 }
};

function getTier(score) {
  if (score >= ENGAGEMENT_TIERS.hot.min) return ENGAGEMENT_TIERS.hot;
  if (score >= ENGAGEMENT_TIERS.warm.min) return ENGAGEMENT_TIERS.warm;
  return ENGAGEMENT_TIERS.cold;
}

export class AdsManager {
  static instance = null;
  static analyticsBuffer = {
    usageTime: 0,
    usageEvents: 0,
    appSessions: 0
  };

  constructor(windowManager) {
    this.wm = windowManager;
    this.windowHelper = new WindowHelper(windowManager);

    if (!shouldEnableAds()) {
      return;
    }

    AdsManager.instance = this;

    this.sessionStart = Date.now();
    this.minActiveTime = 5000;

    this.providers = [
      {
        containerId: "banner-slot",
        render: () => this.mountBanner()
      },
      {
        containerId: ADS.native.containerId,
        render: () => this.mountNative()
      }
    ];

    setTimeout(() => this.init(), 100);
  }

  static analyticsHook(data) {
    if (!AdsManager.instance) return;

    if (data.event === "usage") {
      AdsManager.analyticsBuffer.usageTime += data.durationMs || 0;
      AdsManager.analyticsBuffer.usageEvents++;
    }

    if (data.event === "launch") {
      AdsManager.analyticsBuffer.appSessions++;
    }
  }

  getEngagementScore() {
    const now = Date.now();

    const sessionTime = now - this.sessionStart;

    const interactionRate = interactionCount / Math.max(sessionTime / 60000, 1);

    const analyticsBoost = Math.min(AdsManager.analyticsBuffer.usageTime / 300000, 1) * 25;

    const sessionBoost = Math.min(AdsManager.analyticsBuffer.appSessions / 8, 1) * 15;

    const timeScore = Math.min(sessionTime / 300000, 1) * 35;

    const interactionScore = Math.min(interactionRate * 8, 25);

    let score = 0;

    score += timeScore;
    score += interactionScore;
    score += analyticsBoost;
    score += sessionBoost;

    return Math.min(score, 100);
  }

  getLimits(score) {
    const tier = getTier(score);

    const boost = score / 100;

    return {
      maxPerDay: Math.round(tier.maxPerDay * (1 + boost)),
      minInterval: Math.max(3 * 60 * 1000, tier.minInterval * (1 - boost * 0.4)),
      postCloseCooldown: Math.max(2 * 60 * 1000, tier.postCloseCooldown * (1 - boost * 0.5))
    };
  }

  pickProvider() {
    return this.providers[Math.floor(Math.random() * this.providers.length)];
  }

  recordAdClosed() {
    const meta = loadMeta();
    meta.lastClosed = Date.now();
    saveMeta(meta);
  }

  maybeSpawnAd() {
    if (!shouldEnableAds()) return false;

    const meta = loadMeta();
    resetDaily(meta);

    const now = Date.now();
    const sessionTime = now - this.sessionStart;

    const score = this.getEngagementScore();
    const limits = this.getLimits(score);

    if (meta.dailyCount >= limits.maxPerDay) return false;

    if (now - meta.lastShown < limits.minInterval) return false;

    if (meta.lastClosed && now - meta.lastClosed < limits.postCloseCooldown) return false;

    if (sessionTime < this.minActiveTime) return false;

    const recentAds = document.querySelectorAll(".ad-window-active");
    if (recentAds.length >= 1) return false;

    const containerId = "banner-slot-single";

    const win = this.windowHelper.createAndMountWindow(
      "ads-yukios",
      "Sponsored",
      `
      <div class="window-content ad-window-active" style="padding:12px;">
        <div id="${containerId}"></div>
      </div>
    `,
      "420px",
      "300px",
      {
        icon: "fa fa-bullhorn",
        style: {
          position: "absolute",
          left: `${Math.max(20, window.innerWidth - 420 - 40)}px`,
          top: `${Math.max(20, window.innerHeight - 300 - 40)}px`,
          zIndex: "50"
        }
      }
    );

    if (win) {
      const closeBtn = win.querySelector(".window-close, [data-action='close'], .close-btn");

      if (closeBtn) {
        closeBtn.addEventListener("click", () => this.recordAdClosed(), { once: true });
      }

      const observer = new MutationObserver(() => {
        if (!document.getElementById("ads-yukios")) {
          this.recordAdClosed();
          observer.disconnect();
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });
    }

    const useNative = Math.random() < 0.65;

    if (useNative) {
      this.mountNativeSingle(containerId);
    } else {
      this.mountBannerSingle(containerId);
    }

    meta.dailyCount++;
    meta.lastShown = now;
    meta.lastAdType = useNative ? "native" : "banner";

    saveMeta(meta);

    document.body.setAttribute("data-last-ad", now.toString());

    setTimeout(() => {
      const el = document.querySelector(".ad-window-active");
      if (el) el.classList.remove("ad-window-active");
    }, 45000);

    return true;
  }
  mountNativeSingle(id) {
    if (!shouldEnableAds()) return;

    const c = document.getElementById(id);
    if (!c) return;

    c.innerHTML = "";

    const s = document.createElement("script");
    s.src = ADS.native.src;
    s.async = true;
    s.dataset.cfasync = "false";

    c.appendChild(s);
  }

  mountBannerSingle(id) {
    if (!shouldEnableAds()) return;

    const c = document.getElementById(id);
    if (!c) return;

    c.innerHTML = "";

    const s1 = document.createElement("script");
    s1.innerHTML = `
    atOptions = {
      key: '${ADS.banner.key}',
      format: 'iframe',
      height: ${ADS.banner.height},
      width: ${ADS.banner.width},
      params: {}
    };
  `;

    const s2 = document.createElement("script");
    s2.src = ADS.banner.src;
    s2.async = true;

    c.appendChild(s1);
    c.appendChild(s2);
  }

  maybeFirePopunder() {
    return;
    if (!shouldEnableAds()) return;

    const meta = loadMeta();
    resetDaily(meta);

    const now = Date.now();
    const sessionTime = now - this.sessionStart;

    const today = new Date().toDateString();

    if (sessionTime < 30000) return;
    if (meta.popunderDate === today) return;

    const script = document.createElement("script");
    script.src = POPUNDER_SCRIPT;
    script.async = true;

    document.body.appendChild(script);

    meta.popunderShown = true;
    meta.popunderDate = today;
    saveMeta(meta);
  }

  init() {
    const meta = loadMeta();
    if (meta.initialized) return;

    this.createAdWindow();
    meta.initialized = true;
    saveMeta(meta);

    setTimeout(() => this.maybeFirePopunder(), 5000);

    setInterval(() => this.maybeSpawnAd(), 35000);
  }

  createAdWindow() {
    if (!shouldEnableAds()) return;
    this.windowHelper.createAndMountWindow(
      "ads_main_window",
      "Sponsored",
      `
      <div class="window-content ad-split-container">
        <div class="ad-section">
          <div id="banner-slot"></div>
        </div>

        <div class="ad-divider"></div>

        <div class="ad-section">
          <div id="${ADS.native.containerId}"></div>
        </div>
      </div>
      `,
      "520px",
      "360px",
      {
        icon: "fa fa-bullhorn",
        style: {
          position: "absolute",
          left: `${(window.innerWidth - 520) / 2}px`,
          top: "40px",
          zIndex: "50"
        }
      }
    );

    this.mountBanner();
    this.mountNative();
  }

  mountBanner() {
    if (!shouldEnableAds()) return;
    const c = document.getElementById("banner-slot");
    if (!c) return;

    c.innerHTML = "";

    const s1 = document.createElement("script");
    s1.innerHTML = `
      atOptions = {
        key: '${ADS.banner.key}',
        format: 'iframe',
        height: ${ADS.banner.height},
        width: ${ADS.banner.width},
        params: {}
      };
    `;

    const s2 = document.createElement("script");
    s2.src = ADS.banner.src;
    s2.async = true;

    c.appendChild(s1);
    c.appendChild(s2);
  }

  mountNative() {
    if (!shouldEnableAds()) return;
    if (this.nativeShown) return;

    this.nativeShown = true;

    const c = document.getElementById(ADS.native.containerId);
    if (!c) return;

    c.innerHTML = "";

    const s = document.createElement("script");
    s.src = ADS.native.src;
    s.async = true;
    s.dataset.cfasync = "false";

    c.appendChild(s);
  }
}
