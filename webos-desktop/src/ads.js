import { WindowHelper } from "./utils/WindowHelper.js";

const AD_STORAGE_KEY = "yukios_ads_state";
export function shouldEnableAds() {
  const hostname = window.location.hostname;
  if (hostname.includes("vercel") || hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]") {
    return false;
  }
  return true;
}
let interactionCount = 0;
let lastInteractionTime = Date.now();

const POPUNDER_SCRIPT = "https://pl29443507.profitablecpmratenetwork.com/e1/d5/61/e1d56103a8984a6c28d083490860b574.js";

function loadMeta() {
  try {
    return (
      JSON.parse(localStorage.getItem(AD_STORAGE_KEY)) || {
        dailyCount: 0,
        lastShown: 0,
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
      lastReset: Date.now(),
      initialized: false,
      smartlinkShown: false,
      popunderShown: false,
      popunderDate: null
    };
  }
}

function saveMeta(meta) {
  localStorage.setItem(AD_STORAGE_KEY, JSON.stringify(meta));
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
    const activeTime = Math.max(sessionTime - (now - lastInteractionTime), 0);

    const interactionRate = interactionCount / Math.max(sessionTime / 60000, 1);

    const analyticsBoost = Math.min(AdsManager.analyticsBuffer.usageTime / 600000, 1) * 30;

    const sessionBoost = Math.min(AdsManager.analyticsBuffer.appSessions / 10, 1) * 15;

    let score = 0;

    score += Math.min(sessionTime / 600000, 1) * 30;
    score += Math.min(interactionRate * 10, 25);
    score += Math.min(activeTime / sessionTime, 1) * 20;
    score += analyticsBoost;
    score += sessionBoost;

    return Math.min(score, 100);
  }

  getLimits(score) {
    return {
      maxPerDay: 100,
      minInterval: 1000 * 30,
      smartlink: 0.7
    };
  }
  pickProvider() {
    return this.providers[Math.floor(Math.random() * this.providers.length)];
  }

  maybeSpawnAd() {
    if (!shouldEnableAds()) return false;

    const meta = loadMeta();
    resetDaily(meta);

    const now = Date.now();
    const sessionTime = now - this.sessionStart;

    const limits = this.getLimits(0);

    if (meta.dailyCount >= limits.maxPerDay) return false;
    if (now - meta.lastShown < limits.minInterval) return false;
    if (sessionTime < this.minActiveTime) return false;

    const existing = document.getElementById("ads-yukios");
    if (existing) return false;

    const activeAds = document.querySelectorAll(".ad-window-active");
    if (activeAds.length > 0) return false;

    const useNative = Math.random() < 0.7;

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

    if (useNative) {
      this.mountNativeSingle(containerId);
    } else {
      this.mountBannerSingle(containerId);
    }

    meta.dailyCount++;
    meta.lastShown = now;
    meta.lastAdType = useNative ? "native" : "banner";

    saveMeta(meta);

    setTimeout(() => {
      const el = document.querySelector(".ad-window-active");
      if (el) el.classList.remove("ad-window-active");
    }, 60000);

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
