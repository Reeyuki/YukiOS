import { createElement } from "../shared/domUtils.js";

export function getBrowserInfo() {
  const ua = navigator.userAgent;
  let name = "Unknown";
  let version = "";
  let engine = "Unknown";
  let engineVersion = "";

  if (/Edg\//.test(ua)) {
    name = "Microsoft Edge";
    version = (ua.match(/Edg\/([\d.]+)/) || [])[1] || "";
    engine = "Blink";
    engineVersion = (ua.match(/Chrome\/([\d.]+)/) || [])[1] || "";
  } else if (/OPR\//.test(ua) || /Opera/.test(ua)) {
    name = "Opera";
    version = (ua.match(/(OPR|Opera)\/([\d.]+)/) || [])[2] || "";
    engine = "Blink";
    engineVersion = (ua.match(/Chrome\/([\d.]+)/) || [])[1] || "";
  } else if (/Firefox\//.test(ua)) {
    name = "Mozilla Firefox";
    version = (ua.match(/Firefox\/([\d.]+)/) || [])[1] || "";
    engine = "Gecko";
    engineVersion = (ua.match(/rv:([\d.]+)/) || [])[1] || "";
  } else if (/Chrome\//.test(ua) && !/Edg\//.test(ua) && !/OPR\//.test(ua)) {
    name = "Google Chrome";
    version = (ua.match(/Chrome\/([\d.]+)/) || [])[1] || "";
    engine = "Blink";
    engineVersion = version;
  } else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) {
    name = "Apple Safari";
    version = (ua.match(/Version\/([\d.]+)/) || [])[1] || "";
    engine = "WebKit";
    engineVersion = (ua.match(/AppleWebKit\/([\d.]+)/) || [])[1] || "";
  }

  return { name, version, engine, engineVersion, ua };
}

export function getOSInfo() {
  const ua = navigator.userAgent;
  let name = "Unknown";
  let version = "";
  const platform = navigator.platform || "";

  if (/Windows NT 10/.test(ua)) {
    name = "Windows";
    version = "11 / 10";
  } else if (/Windows NT 6.3/.test(ua)) {
    name = "Windows";
    version = "8.1";
  } else if (/Windows NT 6.2/.test(ua)) {
    name = "Windows";
    version = "8";
  } else if (/Windows NT 6.1/.test(ua)) {
    name = "Windows";
    version = "7";
  } else if (/Windows NT 6.0/.test(ua)) {
    name = "Windows";
    version = "Vista";
  } else if (/Windows NT 5/.test(ua)) {
    name = "Windows";
    version = "XP";
  } else if (/Mac OS X/.test(ua)) {
    name = "macOS";
    const raw =
      (ua.match(/Mac OS X ([\d_]+)/) || [])[1]?.replace(/_/g, ".") || "";
    const verNum = parseFloat(raw);
    const codenames = {
      10.15: "Catalina",
      11: "Big Sur",
      12: "Monterey",
      13: "Ventura",
      14: "Sonoma",
      15: "Sequoia",
    };
    version = raw;
    if (codenames[verNum]) version += ` (${codenames[verNum]})`;
    else if (codenames[Math.floor(verNum)])
      version += ` (${codenames[Math.floor(verNum)]})`;
  } else if (/Linux/.test(ua) && /Android/.test(ua)) {
    name = "Android";
    version = (ua.match(/Android ([\d.]+)/) || [])[1] || "";
  } else if (/Linux/.test(ua)) {
    name = "Linux";
  } else if (/CrOS/.test(ua)) {
    name = "ChromeOS";
    version = (ua.match(/CrOS\s+\S+\s+([\d.]+)/) || [])[1] || "";
  } else if (/iPhone|iPad|iPod/.test(ua)) {
    name = "iOS";
    version = (ua.match(/OS ([\d_]+)/) || [])[1]?.replace(/_/g, ".") || "";
  }

  return { name, version, platform };
}

export function getGraphicsInfo() {
  const unavailable = { vendor: "Unavailable", renderer: "Unavailable" };
  try {
    const canvas = createElement("canvas");
    const gl =
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) return unavailable;
    const ext = gl.getExtension("WEBGL_debug_rendererinfo");
    if (ext) {
      const vendor = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL);
      const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
      if (vendor && renderer) return { vendor, renderer };
    }
    const vendor = gl.getParameter(gl.VENDOR);
    const renderer = gl.getParameter(gl.RENDERER);
    if (vendor && renderer) return { vendor, renderer };
    return unavailable;
  } catch {
    return unavailable;
  }
}

export function getConnectionInfo() {
  const c =
    navigator.connection ||
    navigator.mozConnection ||
    navigator.webkitConnection;
  if (c) {
    return {
      type: c.effectiveType || "Unknown",
      downlink: c.downlink != null ? `${c.downlink} Mbps` : "Unknown",
      rtt: c.rtt != null ? `${c.rtt} ms` : "Unknown",
      saveData: c.saveData ? "On" : "Off",
    };
  }
  return null;
}

export function getRuntimeInfo() {
  const screen = window.screen || {};
  const lang = navigator.language || navigator.userLanguage || "Unknown";
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Unknown";
  const mem =
    navigator.deviceMemory != null
      ? `${navigator.deviceMemory} GB`
      : "Unavailable";
  const cores = navigator.hardwareConcurrency
    ? `${navigator.hardwareConcurrency} logical`
    : "Unavailable";
  const touch = "ontouchstart" in window ? "Yes" : "No";
  const doNotTrack =
    navigator.doNotTrack ||
    navigator.msDoNotTrack ||
    window.doNotTrack ||
    "Unspecified";
  const online = navigator.onLine ? "Online" : "Offline";
  const browser = getBrowserInfo();
  const os = getOSInfo();
  const gfx = getGraphicsInfo();
  const conn = getConnectionInfo();

  return {
    browser,
    os,
    gfx,
    conn,
    online,
    hardware: [
      ["CPU (Logical Cores)", cores, false],
      ["RAM", mem, false],
      [
        "Screen Resolution",
        `${screen.width || "?"} × ${screen.height || "?"}`,
        false,
      ],
      [
        "Available Screen",
        `${screen.availWidth || "?"} × ${screen.availHeight || "?"}`,
        false,
      ],
      [
        "Color Depth",
        screen.colorDepth ? `${screen.colorDepth}-bit` : "Unknown",
        false,
      ],
      [
        "Pixel Ratio",
        window.devicePixelRatio
          ? `${window.devicePixelRatio.toFixed(2)}x`
          : "1x",
        false,
      ],
      ["Touch Support", touch, false],
      ["Window Size", `${window.innerWidth} × ${window.innerHeight}`, false],
    ],
    browserRows: [
      ["Browser", `${browser.name} ${browser.version}`, false],
      ["Engine", `${browser.engine} ${browser.engineVersion}`, false],
      [
        "Language",
        `${lang}${navigator.languages ? ` (preferred: ${navigator.languages.join(", ")})` : ""}`,
        false,
      ],
      ["Cookies Enabled", navigator.cookieEnabled ? "Yes" : "No", false],
      ["Do Not Track", doNotTrack, false],
      ["User Agent", browser.ua, true],
    ],
    osRows: [
      ["Operating System", `${os.name} ${os.version}`.trim(), false],
      ["Platform", os.platform, false],
      ["Time Zone", tz, false],
    ],
    networkRows: conn
      ? [
          ["Connection Type", conn.type.toUpperCase(), false],
          ["Downlink Speed", conn.downlink, false],
          ["Round-Trip Time", conn.rtt, false],
          ["Data Saver", conn.saveData, false],
          ["Status", online, false],
        ]
      : [
          ["Status", online, false],
          ["Network Info API", "Not available in this browser", false],
        ],
    graphicsRows: [
      ["WebGL Vendor", gfx.vendor, true],
      ["WebGL Renderer", gfx.renderer, true],
    ],
  };
}

export const EXTERNAL_SERVICES = [
  {
    name: "CraxGPT",
    detail: "Free AI chat backend",
    credit: "by Crax",
    url: "https://gpt.crax.lol",
    icon: "static/icons/favicons/craxgpt.svg",
  },
  {
    name: "Nodium Roblox Studio",
    detail: "Roblox Studio webport",
    credit: "by Nodium",
    url: "https://studio.nodium.lol",
    icon: "static/icons/roblox-studio.webp",
  },
  {
    name: "Nodium Roblox Player",
    detail: "Roblox player webport",
    credit: "by Nodium",
    url: "https://player.nodium.lol",
    icon: "static/icons/roblox.webp",
  },
  {
    name: "Azerun",
    detail: "World of Warcraft in browser",
    credit: "by Azerun",
    url: "https://azerun.com/play/",
    icon: "static/icons/worldOfWarcraft.webp",
  },
  {
    name: "Eaglercraft Launcher",
    detail: "Minecraft web launcher",
    credit: "by redflamz",
    url: "https://redflamz.github.io/Eaglercraft-Launcher/",
    icon: "static/icons/favicons/eaglercraft.webp",
  },
  {
    name: "JSPaint",
    detail: "Classic paint remade for web",
    credit: "by Isaiah Odhner",
    url: "https://jspaint.app",
    icon: "static/icons/paint.webp",
  },
  {
    name: "LibreSprite",
    detail: "Pixel art editor",
    credit: "by LibreSprite",
    url: "https://libresprite.github.io/online",
    icon: "static/icons/favicons/libresprite.webp",
  },
  {
    name: "Emupedia",
    detail: "Retro games and web ports",
    credit: "by Emupedia",
    url: "https://emupedia.net",
    icon: "static/icons/emupedia.svg",
  },
  {
    name: "Truffled",
    detail: "Browser game ports",
    credit: "by Truffled",
    url: "https://truffled.lol",
    icon: "static/icons/truffled.png",
  },
  {
    name: "Aether",
    detail: "Movie streaming frontend",
    credit: "by Aether",
    url: "https://aether.ist/",
    icon: "static/icons/favicons/movies.webp",
  },
  {
    name: "Famelack",
    detail: "Live TV streaming frontend",
    credit: "by Famelack",
    url: "https://famelack.com",
    icon: "static/icons/favicons/tv-streaming.webp",
  },
];

export function getPackageLicenses() {
  return typeof __PACKAGE_LICENSES__ !== "undefined"
    ? __PACKAGE_LICENSES__
    : [];
}
