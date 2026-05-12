import { desktop } from "./desktop.js";

const AD_STORAGE_KEY = "yukios_ads_state";

export function shouldEnableAds() {
  if (window.location.hostname.includes("vercel")) return false;
  return true;
}

function loadMeta() {
  try {
    return (
      JSON.parse(localStorage.getItem(AD_STORAGE_KEY)) || {
        dailyCount: 0,
        lastShown: 0,
        lastReset: Date.now(),
        initialized: false
      }
    );
  } catch {
    return {
      dailyCount: 0,
      lastShown: 0,
      lastReset: Date.now(),
      initialized: false
    };
  }
}

function saveMeta(meta) {
  localStorage.setItem(AD_STORAGE_KEY, JSON.stringify(meta));
}

function resetDaily(meta) {
  const day = 1000 * 60 * 60 * 24;

  if (Date.now() - meta.lastReset > day) {
    meta.dailyCount = 0;
    meta.lastReset = Date.now();
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
  constructor(windowManager) {
    this.wm = windowManager;

    this.lastInteraction = Date.now();
    this.minActiveTime = 30000;

    this.maxPerDay = 80;
    this.minInterval = 1000 * 60 * 3;
    this.providers = [
      {
        type: "banner",
        containerId: "banner-slot",
        render: () => this.mountBanner()
      },
      {
        type: "native",
        containerId: ADS.native.containerId,
        render: () => this.mountNative()
      }
    ];

    setTimeout(() => this.init(), 100);
  }

  init() {
    if (!shouldEnableAds()) return;

    const meta = loadMeta();
    if (meta.initialized) return;

    this.createAdWindow();

    meta.initialized = true;
    saveMeta(meta);
    this.startIdleSmartlink();
  }

  userIsActiveLongEnough() {
    return Date.now() - this.lastInteraction >= this.minActiveTime;
  }

  pickProvider() {
    return this.providers[Math.floor(Math.random() * this.providers.length)];
  }

  maybeSpawnAd() {
    if (!shouldEnableAds()) return false;

    const meta = loadMeta();
    resetDaily(meta);

    const now = Date.now();

    if (meta.dailyCount >= this.maxPerDay) return false;
    if (now - meta.lastShown < this.minInterval) return false;
    if (!this.userIsActiveLongEnough()) return false;

    const provider = this.pickProvider();

    const winId = "ads-yukios";
    const existing = document.getElementById(winId);

    if (existing) {
      this.wm.bringToFront(existing);
      return false;
    }

    const win = this.wm.createWindow(winId, "Sponsored", "420px", "300px", false, {
      position: { x: window.innerWidth - 420 - 40, y: window.innerHeight - 300 - 40 },
      allowManualPosition: true
    });

    win.innerHTML = `
      <div class="window-header">
        <span>Sponsored</span>
        ${this.wm.getWindowControls()}
      </div>
      <div class="window-content" style="padding:12px;">
        <div id="${provider.containerId}"></div>
      </div>
    `;

    desktop.appendChild(win);

    this.wm.makeDraggable(win);
    this.wm.setupWindowControls(win);
    this.wm.addToTaskbar(win.id, "Sponsored", "fa fa-bullhorn");

    provider.render();

    meta.dailyCount++;
    meta.lastShown = Date.now();
    saveMeta(meta);

    return true;
  }

  createAdWindow() {
    const win = this.wm.createWindow("ads_main_window", "Sponsored", "520px", "360px", false, {
      position: { x: (window.innerWidth - 520) / 2, y: 40 },
      allowManualPosition: true
    });
    win.style.zIndex = 50;

    win.innerHTML = `
      <div class="window-header">
        <span>Sponsored</span>
        ${this.wm.getWindowControls()}
      </div>

      <div class="window-content ad-split-container">
        <div class="ad-section">
          <div id="banner-slot"></div>
        </div>

        <div class="ad-divider"></div>

        <div class="ad-section">
          <div id="${ADS.native.containerId}"></div>
        </div>
      </div>
    `;

    desktop.appendChild(win);

    this.wm.makeDraggable(win);
    this.wm.setupWindowControls(win);
    this.wm.addToTaskbar(win.id, "Sponsored", "fa fa-bullhorn");

    this.mountBanner();
    this.mountNative();
  }

  mountBanner() {
    const container = document.getElementById("banner-slot");
    if (!container) return;

    container.innerHTML = "";

    const configScript = document.createElement("script");
    configScript.innerHTML = `
      atOptions = {
        key: '${ADS.banner.key}',
        format: 'iframe',
        height: ${ADS.banner.height},
        width: ${ADS.banner.width},
        params: {}
      };
    `;

    const adScript = document.createElement("script");
    adScript.src = ADS.banner.src;
    adScript.async = true;

    container.appendChild(configScript);
    container.appendChild(adScript);
  }

  mountNative() {
    const container = document.getElementById(ADS.native.containerId);
    if (!container) return;

    container.innerHTML = "";

    const script = document.createElement("script");
    script.async = true;
    script.dataset.cfasync = "false";
    script.src = ADS.native.src;

    container.appendChild(script);
  }
  injectSmartlinkOnce() {
    if (!shouldEnableAds()) return;

    const meta = loadMeta();
    if (meta.smartlinkShown) return;

    const a = document.createElement("a");
    a.href = "https://www.profitablecpmratenetwork.com/t8h6qm0ki?key=0d9e57d41211b42cb2ae88e762a656c0";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.style.display = "none";

    document.body.appendChild(a);

    a.click();

    meta.smartlinkShown = true;
    saveMeta(meta);
  }
  startIdleSmartlink() {
    let idleTime = 0;

    const reset = () => (idleTime = 0);

    window.addEventListener("mousemove", reset);
    window.addEventListener("keydown", reset);
    window.addEventListener("click", reset);

    setInterval(() => {
      idleTime += 1;

      if (idleTime > 120 && !this.smartlinkFired) {
        this.injectSmartlinkOnce();
        this.smartlinkFired = true;
      }
    }, 1000);
  }
}
