import { CDN_MIRRORS, resolveIconUrl, resolveGhUrl } from "../shared/assetResolver.js";
import { audioMixer } from "../audioMixer.js";
import { YUKIOS_VERSION } from "../apps/about.js";
import { getBasicThemes, getSpecialThemes, getCustomThemes } from "../shared/themeEngine.js";
import { StorageKeys, os } from "../framework.js";
import { renderSelectMenu } from "../shared/selectMenu.js";
import { renderRangeSlider } from "../shared/rangeSlider.js";
import { renderAccountsSettings } from "./accountsPanel.js";
import { renderTilingSettings } from "./pane-tiling.js";
import { renderChromeOsSettings } from "../modes/chromeos/settings.js";
import { RESOLUTION_PRESETS, getViewportLabel } from "../resolution/resolutionManager.js";

function getBrowserInfo() {
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

function getOSInfo() {
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
    const raw = (ua.match(/Mac OS X ([\d_]+)/) || [])[1]?.replace(/_/g, ".") || "";
    const verNum = parseFloat(raw);
    const codenames = { 10.15: "Catalina", 11: "Big Sur", 12: "Monterey", 13: "Ventura", 14: "Sonoma", 15: "Sequoia" };
    version = raw;
    if (codenames[verNum]) version += ` (${codenames[verNum]})`;
    else if (codenames[Math.floor(verNum)]) version += ` (${codenames[Math.floor(verNum)]})`;
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

function getGraphicsInfo() {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (gl) {
      const ext = gl.getExtension("WEBGL_debug_rendererinfo");
      if (ext) {
        return {
          vendor: gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) || "Unknown",
          renderer: gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || "Unknown"
        };
      }
      return { vendor: "WEBGL_debug_rendererinfo unavailable", renderer: "WEBGL_debug_rendererinfo unavailable" };
    }
    return { vendor: "WebGL not supported", renderer: "WebGL not supported" };
  } catch (e) {
    return { vendor: "Error", renderer: e.message };
  }
}

function getConnectionInfo() {
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (c) {
    return {
      type: c.effectiveType || "Unknown",
      downlink: c.downlink != null ? `${c.downlink} Mbps` : "Unknown",
      rtt: c.rtt != null ? `${c.rtt} ms` : "Unknown",
      saveData: c.saveData ? "On" : "Off"
    };
  }
  return null;
}

function sysinfoRow(label, value, monospace) {
  const valClass = monospace ? ' class="sysinfo-val sysinfo-mono"' : ' class="sysinfo-val"';
  return `<div class="sysinfo-row"><span class="sysinfo-lbl">${label}</span><span${valClass}>${value}</span></div>`;
}

function sysinfoSection(icon, title, rows) {
  return `
    <div class="settings-card" style="margin-top: 16px;">
      <div class="settings-card-header"><i class="${icon}"></i> ${title}</div>
      <div class="sysinfo-list">
        ${rows.join("")}
      </div>
    </div>`;
}

function renderSystemInfo() {
  const browser = getBrowserInfo();
  const os = getOSInfo();
  const gfx = getGraphicsInfo();
  const conn = getConnectionInfo();
  const screen = window.screen || {};
  const lang = navigator.language || navigator.userLanguage || "Unknown";
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Unknown";
  const mem = navigator.deviceMemory != null ? `${navigator.deviceMemory} GB` : "Unavailable";
  const cores = navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency} logical` : "Unavailable";
  const touch = "ontouchstart" in window ? "Yes" : "No";
  const doNotTrack = navigator.doNotTrack || navigator.msDoNotTrack || window.doNotTrack || "Unspecified";
  const online = navigator.onLine ? "Online" : "Offline";

  const hardwareRows = [
    sysinfoRow("CPU (Logical Cores)", cores),
    sysinfoRow("RAM", mem),
    sysinfoRow("Screen Resolution", `${screen.width || "?"} × ${screen.height || "?"}`),
    sysinfoRow("Available Screen", `${screen.availWidth || "?"} × ${screen.availHeight || "?"}`),
    sysinfoRow("Color Depth", screen.colorDepth ? `${screen.colorDepth}-bit` : "Unknown"),
    sysinfoRow("Pixel Ratio", window.devicePixelRatio ? `${window.devicePixelRatio.toFixed(2)}x` : "1x"),
    sysinfoRow("Touch Support", touch),
    sysinfoRow("Window Size", `${window.innerWidth} × ${window.innerHeight}`)
  ];

  const browserRows = [
    sysinfoRow("Browser", `${browser.name} ${browser.version}`),
    sysinfoRow("Engine", `${browser.engine} ${browser.engineVersion}`),
    sysinfoRow("Language", `${lang}${navigator.languages ? ` (preferred: ${navigator.languages.join(", ")})` : ""}`),
    sysinfoRow("Cookies Enabled", navigator.cookieEnabled ? "Yes" : "No"),
    sysinfoRow("Do Not Track", doNotTrack),
    sysinfoRow("User Agent", browser.ua, true)
  ];

  const osRows = [
    sysinfoRow("Operating System", `${os.name} ${os.version}`.trim()),
    sysinfoRow("Platform", os.platform),
    sysinfoRow("Time Zone", tz)
  ];

  const networkRows = conn
    ? [
        sysinfoRow("Connection Type", conn.type.toUpperCase()),
        sysinfoRow("Downlink Speed", conn.downlink),
        sysinfoRow("Round-Trip Time", conn.rtt),
        sysinfoRow("Data Saver", conn.saveData),
        sysinfoRow("Status", online)
      ]
    : [sysinfoRow("Status", online), sysinfoRow("Network Info API", "Not available in this browser")];

  const gfxRows = [sysinfoRow("WebGL Vendor", gfx.vendor, true), sysinfoRow("WebGL Renderer", gfx.renderer, true)];

  const html = `
    <div style="margin-top: 16px;">
      <div class="settings-card-header" style="border-bottom: none;"><i class="fas fa-info-circle"></i> System Diagnostics</div>
    </div>
    ${sysinfoSection("fas fa-microchip", "Hardware", hardwareRows)}
    ${sysinfoSection("fas fa-globe", "Browser", browserRows)}
    ${sysinfoSection("fas fa-desktop", "Operating System", osRows)}
    ${sysinfoSection("fas fa-wifi", "Network", networkRows)}
    ${sysinfoSection("fas fa-cube", "Graphics", gfxRows)}
  `;

  return html;
}

export function buildSettingsHTML(settings, wm) {
  return `
  <div class="window-header">
    <span><i class="fas fa-cog" style="color:white;margin-right:6px;font-size:25px;vertical-align:middle;"></i>Settings</span>
    ${wm.getWindowControls()}
  </div>
  <div class="window-content" style="padding: 0; gap: 0;">
    <div class="yuki-settings-layout">
      <div class="yuki-settings-sidebar">
        <div class="yuki-settings-search">
          <input type="text" id="settingsSearch" placeholder="Find a setting...">
        </div>
        <ul class="yuki-settings-nav">
          <li class="active" data-target="pane-system"><i class="fas fa-desktop"></i> System</li>
          <li data-target="pane-desktop"><i class="fas fa-home"></i> Desktop</li>
          <li data-target="pane-appearance"><i class="fas fa-paint-brush"></i> Appearance</li>
          <li data-target="pane-tiling"><i class="fas fa-th-large"></i> Tiling</li>
          <li data-target="pane-chromeos"><i class="fab fa-chrome"></i> Chrome OS</li>
          <li data-target="pane-data"><i class="fas fa-database"></i> Data</li>
          <li data-target="pane-network"><i class="fas fa-network-wired"></i> Network</li>
          <li data-target="pane-audio"><i class="fas fa-volume-high"></i> Audio</li>
          <li data-target="pane-accounts"><i class="fas fa-users"></i> Accounts</li>
          <li data-target="pane-about"><i class="fas fa-circle-info"></i> About</li>
        </ul>
      </div>

      <div class="yuki-settings-content">
        ${renderSystemSettings(settings)}
        ${renderDesktopSettings(settings)}
        ${renderAppearanceSettings(settings)}
        ${renderTilingSettings()}
        ${renderChromeOsSettings()}
        ${renderDataSettings()}
        ${renderNetworkSettings(settings)}
        ${renderAudioSettings(settings)}
        ${renderAccountsSettings()}
        ${renderAboutSettings()}
      </div>
  `;
}
export function renderSystemSettings(s) {
  return `
    <div id="pane-system" class="settings-category-pane active">
      <div class="settings-category-header">System</div>

      <div class="settings-card" id="sc-general">
        <div class="settings-card-header"><i class="fas fa-sliders-h"></i> General Behavior</div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Weather</span>
            <span class="settings-label-desc">Show weather in the taskbar</span>
          </div>
          <label class="settings-toggle">
            <input type="checkbox" id="settingsWeather" ${s.weather ? "checked" : ""}/>
            <span class="settings-track"><span class="settings-thumb"></span></span>
          </label>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Clippy</span>
            <span class="settings-label-desc">Show Clippy after boot</span>
          </div>
          <label class="settings-toggle">
            <input type="checkbox" id="settingsClippy" ${s.clippy ? "checked" : ""}/>
            <span class="settings-track"><span class="settings-thumb"></span></span>
          </label>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Clipboard Manager</span>
            <span class="settings-label-desc">Enable system-wide clipboard history with tray icon</span>
          </div>
          <label class="settings-toggle">
            <input type="checkbox" id="settingsClipboardManager" ${s.clipboardManagerEnabled ? "checked" : ""}/>
            <span class="settings-track"><span class="settings-thumb"></span></span>
          </label>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Cursor Launch Effect</span>
            <span class="settings-label-desc">Show a bouncing icon on cursor when launching apps</span>
          </div>
          <label class="settings-toggle">
            <input type="checkbox" id="settingsCursorEffect" ${s.cursorEffectEnabled ? "checked" : ""}/>
            <span class="settings-track"><span class="settings-thumb"></span></span>
          </label>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Turbo Mode</span>
            <span class="settings-label-desc">Reduce heavy visual effects and animations</span>
          </div>
          <div class="settings-button-group">
            <button class="settings-btn ${s.turboMode === "high" ? "active" : ""}" data-turbo-val="high"><i class="fas fa-tachometer-alt"></i> Quality</button>
            <button class="settings-btn ${s.turboMode === "balanced" ? "active" : ""}" data-turbo-val="balanced"><i class="fas fa-balance-scale"></i> Balanced</button>
            <button class="settings-btn ${s.turboMode === "turbo" ? "active" : ""}" data-turbo-val="turbo"><i class="fas fa-bolt"></i> Turbo</button>
          </div>
        </div>
      </div>

      <div class="settings-card" style="margin-top: 16px;">
        <div class="settings-card-header"><i class="fas fa-power-off"></i> Boot &amp; Session</div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Skip Boot Screen</span>
            <span class="settings-label-desc">Skip the boot animation on startup</span>
          </div>
          <label class="settings-toggle">
            <input type="checkbox" id="settingsDisableBootScreen" ${s.disableBootScreen ? "checked" : ""}/>
            <span class="settings-track"><span class="settings-thumb"></span></span>
          </label>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Window Session Persistence</span>
            <span class="settings-label-desc">Remember and restore open windows on startup</span>
          </div>
          <label class="settings-toggle">
            <input type="checkbox" id="settingsWindowSessionPersistence" ${s.windowSessionPersistence ? "checked" : ""}/>
            <span class="settings-track"><span class="settings-thumb"></span></span>
          </label>
        </div>
      </div>

      <div class="settings-card" style="margin-top: 16px;">
        <div class="settings-card-header"><i class="fas fa-shield-alt"></i> Privacy &amp; Analytics</div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Achievements</span>
            <span class="settings-label-desc">Enable or disable achievement system</span>
          </div>
          <label class="settings-toggle">
            <input type="checkbox" id="settingsAchievements" ${!s.achievementsDisabled ? "checked" : ""}/>
            <span class="settings-track"><span class="settings-thumb"></span></span>
          </label>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Analytics</span>
            <span class="settings-label-desc">Allow usage analytics</span>
          </div>
          <label class="settings-toggle">
            <input type="checkbox" id="settingsAnalytics" ${!s.analyticsDisabled ? "checked" : ""}/>
            <span class="settings-track"><span class="settings-thumb"></span></span>
          </label>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Ads</span>
            <span class="settings-label-desc">Show sponsored content 🥺</span>
          </div>
          <label class="settings-toggle">
            <input type="checkbox" id="settingsAds" ${!s.adsDisabled ? "checked" : ""}/>
            <span class="settings-track"><span class="settings-thumb"></span></span>
          </label>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Share Live Activity</span>
            <span class="settings-label-desc">Let others see what game you are playing</span>
          </div>
          <label class="settings-toggle">
            <input type="checkbox" id="settingsFriendsActivity" ${s.friendsLiveActivity !== false ? "checked" : ""}/>
            <span class="settings-track"><span class="settings-thumb"></span></span>
          </label>
        </div>
      </div>

      <div class="settings-card" style="margin-top: 16px;">
        <div class="settings-card-header"><i class="fas fa-bell"></i> Notifications</div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Do Not Disturb</span>
            <span class="settings-label-desc">Silence all toast notifications</span>
          </div>
          <label class="settings-toggle">
            <input type="checkbox" id="settingsDND" ${s.dnd ? "checked" : ""}/>
            <span class="settings-track"><span class="settings-thumb"></span></span>
          </label>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Enable Notifications</span>
            <span class="settings-label-desc">Allow applications to show notifications</span>
          </div>
          <label class="settings-toggle">
            <input type="checkbox" id="settingsNotificationsEnabled" ${s.notificationsEnabled ? "checked" : ""}/>
            <span class="settings-track"><span class="settings-thumb"></span></span>
          </label>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Remove After Timeout</span>
            <span class="settings-label-desc">Automatically dismiss toast notifications after they expire</span>
          </div>
          <label class="settings-toggle">
            <input type="checkbox" id="settingsNotificationsRemoveTimeout" ${s.notificationsRemoveTimeout ? "checked" : ""}/>
            <span class="settings-track"><span class="settings-thumb"></span></span>
          </label>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Pop Animation</span>
            <span class="settings-label-desc">Show sliding pop animation when notifications appear</span>
          </div>
          <label class="settings-toggle">
            <input type="checkbox" id="settingsNotificationsPopAnimation" ${s.notificationsPopAnimation ? "checked" : ""}/>
            <span class="settings-track"><span class="settings-thumb"></span></span>
          </label>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Display Over Fullscreen</span>
            <span class="settings-label-desc">Show notifications over active fullscreen windows</span>
          </div>
          <label class="settings-toggle">
            <input type="checkbox" id="settingsNotificationsOverFullscreen" ${s.notificationsOverFullscreen ? "checked" : ""}/>
            <span class="settings-track"><span class="settings-thumb"></span></span>
          </label>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Notification Duration</span>
            <span class="settings-label-desc">Time in seconds before a notification expires</span>
          </div>
          <div class="settings-range-group" style="display: flex; align-items: center; gap: 12px;">
            ${renderRangeSlider("settingsNotificationsDuration", 1, 30, 1, s.notificationsDuration)}
            <span class="settings-range-value" id="settingsNotificationsDurationVal" style="min-width: 24px; text-align: right; font-size: 0.9em; font-weight: 500;">${s.notificationsDuration}s</span>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Notification Position</span>
            <span class="settings-label-desc">Choose which corner notifications appear in</span>
          </div>
          ${renderSelectMenu(
            "settingsNotificationsPosition",
            [
              { value: "bottom-right", label: "Bottom Right (Default)" },
              { value: "bottom-left", label: "Bottom Left" },
              { value: "top-right", label: "Top Right" },
              { value: "top-left", label: "Top Left" }
            ],
            s.notificationsPosition
          )}
        </div>
      </div>
    </div>
  `;
}
export function renderDesktopSettings(s) {
  return `
    <div id="pane-desktop" class="settings-category-pane">
      <div class="settings-category-header">Desktop</div>

      <div class="settings-card" id="sc-layout">
        <div class="settings-card-header"><i class="fas fa-arrows-alt"></i> Layout &amp; Alignment</div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Disable Desktop Stretch Scroll</span>
            <span class="settings-label-desc">Prevent desktop page from expanding when windows are dragged out</span>
          </div>
          <label class="settings-toggle">
            <input type="checkbox" id="settingsDisableDesktopStretchScroll" ${s.disableDesktopStretchScroll ? "checked" : ""}/>
            <span class="settings-track"><span class="settings-thumb"></span></span>
          </label>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Show Workspaces</span>
            <span class="settings-label-desc">Show the workspaces area in the taskbar</span>
          </div>
          <label class="settings-toggle">
            <input type="checkbox" id="settingsShowWorkspace" ${s.showWorkspace ? "checked" : ""}/>
            <span class="settings-track"><span class="settings-thumb"></span></span>
          </label>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Hide Desktop Icons</span>
            <span class="settings-label-desc">Hide all desktop icons for a cleaner look</span>
          </div>
          <label class="settings-toggle">
            <input type="checkbox" id="settingsHideDesktopIcons" ${s.hideDesktopIcons ? "checked" : ""}/>
            <span class="settings-track"><span class="settings-thumb"></span></span>
          </label>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Taskbar Position</span>
            <span class="settings-label-desc">Dock the taskbar to an edge</span>
          </div>
          <div class="settings-button-group">
            <button class="settings-btn ${s.taskbarPosition === "bottom" ? "active" : ""}" data-taskbar-pos="bottom"><i class="fas fa-arrow-down"></i> Bottom</button>
            <button class="settings-btn ${s.taskbarPosition === "top" ? "active" : ""}" data-taskbar-pos="top"><i class="fas fa-arrow-up"></i> Top</button>
            <button class="settings-btn ${s.taskbarPosition === "left" ? "active" : ""}" data-taskbar-pos="left"><i class="fas fa-arrow-left"></i> Left</button>
            <button class="settings-btn ${s.taskbarPosition === "right" ? "active" : ""}" data-taskbar-pos="right"><i class="fas fa-arrow-right"></i> Right</button>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Taskbar Alignment</span>
            <span class="settings-label-desc">Choose alignment for taskbar icons</span>
          </div>
          <div class="settings-button-group">
            <button class="settings-btn ${s.taskbarAlignment === "left" ? "active" : ""}" data-alignment="left"><i class="fas fa-align-left"></i> Left</button>
            <button class="settings-btn ${s.taskbarAlignment === "center" ? "active" : ""}" data-alignment="center"><i class="fas fa-align-center"></i> Center</button>
            <button class="settings-btn ${s.taskbarAlignment === "right" ? "active" : ""}" data-alignment="right"><i class="fas fa-align-right"></i> Right</button>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Show Taskbar Labels</span>
            <span class="settings-label-desc">Display window titles next to taskbar icons</span>
          </div>
          <label class="settings-toggle">
            <input type="checkbox" id="settingsTaskbarShowLabels" ${s.taskbarShowLabels ? "checked" : ""}/>
            <span class="settings-track"><span class="settings-thumb"></span></span>
          </label>
        </div>
      </div>

      <div class="settings-card" style="margin-top: 16px;">
        <div class="settings-card-header"><i class="fas fa-icons"></i> Icons &amp; Taskbar</div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Desktop Icon Size</span>
            <span class="settings-label-desc">Adjust the size of desktop icons</span>
          </div>
          <div class="settings-range-group">
            ${renderRangeSlider("settingsDesktopIconSize", 32, 128, 8, s.desktopIconSize)}
            <span id="settingsDesktopIconSizeValue" class="settings-range-value">${s.desktopIconSize}px</span>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Taskbar Scale</span>
            <span class="settings-label-desc">Scale the size of the taskbar</span>
          </div>
          <div class="settings-range-group">
            ${renderRangeSlider("settingsTaskbarScale", 50, 200, 10, s.taskbarScale)}
            <span id="settingsTaskbarScaleValue" class="settings-range-value">${s.taskbarScale}%</span>
          </div>
        </div>
      </div>

      <div class="settings-card" style="margin-top: 16px;">
        <div class="settings-card-header"><i class="fas fa-bars"></i> Start Menu</div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Start Menu Width</span>
            <span class="settings-label-desc">Adjust the width of the start menu</span>
          </div>
          <div class="settings-range-group">
            ${renderRangeSlider("settingsStartMenuWidth", 400, 1000, 10, s.startMenuWidth)}
            <span id="settingsStartMenuWidthValue" class="settings-range-value">${s.startMenuWidth}px</span>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Start Menu Height</span>
            <span class="settings-label-desc">Adjust the height of the start menu</span>
          </div>
          <div class="settings-range-group">
            ${renderRangeSlider("settingsStartMenuHeight", 300, 900, 10, s.startMenuHeight)}
            <span id="settingsStartMenuHeightValue" class="settings-range-value">${s.startMenuHeight}px</span>
          </div>
        </div>
        <div class="settings-row settings-row--stacked">
          <div class="settings-label-group">
            <span class="settings-label-title">Start Menu Categories</span>
            <span class="settings-label-desc">Toggle visibility of categories in the start menu sidebar</span>
          </div>
          <div style="margin-top: 10px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; width: 100%;">
            <div class="settings-grid-toggle"><span>Menu</span>
              <label class="settings-toggle"><input type="checkbox" class="settings-start-cat-toggle" data-cat="menu" ${s.startMenuCats.menu !== false ? "checked" : ""}/><span class="settings-track"><span class="settings-thumb"></span></span></label>
            </div>
            <div class="settings-grid-toggle"><span>Games</span>
              <label class="settings-toggle"><input type="checkbox" class="settings-start-cat-toggle" data-cat="games" ${s.startMenuCats.games !== false ? "checked" : ""}/><span class="settings-track"><span class="settings-thumb"></span></span></label>
            </div>
            <div class="settings-grid-toggle"><span>System</span>
              <label class="settings-toggle"><input type="checkbox" class="settings-start-cat-toggle" data-cat="system" ${s.startMenuCats.system !== false ? "checked" : ""}/><span class="settings-track"><span class="settings-thumb"></span></span></label>
            </div>
            <div class="settings-grid-toggle"><span>Favorites</span>
              <label class="settings-toggle"><input type="checkbox" class="settings-start-cat-toggle" data-cat="favorites" ${s.startMenuCats.favorites !== false ? "checked" : ""}/><span class="settings-track"><span class="settings-thumb"></span></span></label>
            </div>
            <div class="settings-grid-toggle"><span>Settings</span>
              <label class="settings-toggle"><input type="checkbox" class="settings-start-cat-toggle" data-cat="settingsApp" ${s.startMenuCats.settingsApp !== false ? "checked" : ""}/><span class="settings-track"><span class="settings-thumb"></span></span></label>
            </div>
          </div>
        </div>
      </div>

      <div class="settings-card" style="margin-top: 16px;">
        <div class="settings-card-header"><i class="fas fa-window-minimize"></i> System Tray</div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Enable Tray</span>
            <span class="settings-label-desc">Show system tray in the taskbar</span>
          </div>
          <label class="settings-toggle">
            <input type="checkbox" id="settingsTrayEnabled" ${s.trayEnabled ? "checked" : ""}/>
            <span class="settings-track"><span class="settings-thumb"></span></span>
          </label>
        </div>
        <div class="settings-row settings-row--stacked">
          <div class="settings-label-group">
            <span class="settings-label-title">Tray Apps</span>
            <span class="settings-label-desc">Toggle visibility of individual tray applications</span>
          </div>
          <div id="trayAppsList" style="margin-top: 10px; width: 100%;">
            <div style="padding: 12px; color: var(--text-muted); font-size: 13px; text-align: center;">No tray apps yet</div>
          </div>
        </div>
      </div>

      <div class="settings-card" style="margin-top: 16px;">
        <div class="settings-card-header"><i class="fas fa-exchange-alt"></i> Window Switcher (Alt+Q)</div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Switching Logic</span>
            <span class="settings-label-desc">Order mode for cycling through windows</span>
          </div>
          ${renderSelectMenu(
            "settingsWindowSwitcherMode",
            [
              { value: "mru", label: "Most Recently Used (MRU)" },
              { value: "stack", label: "Cycle / Stack Order" }
            ],
            s.windowSwitcherMode
          )}
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">UI Display Mode</span>
            <span class="settings-label-desc">Visual representation while cycling</span>
          </div>
          ${renderSelectMenu(
            "settingsWindowSwitcherUI",
            [
              { value: "overlay", label: "App Switcher Overlay (shows previews)" },
              { value: "direct", label: "Fast Switching (no visual UI)" }
            ],
            s.windowSwitcherUI
          )}
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Include Minimized Windows</span>
            <span class="settings-label-desc">Show minimized windows in the switcher</span>
          </div>
          <label class="settings-toggle">
            <input type="checkbox" id="settingsWindowSwitcherIncludeMinimized" ${s.windowSwitcherIncludeMinimized ? "checked" : ""}/>
            <span class="settings-track"><span class="settings-thumb"></span></span>
          </label>
        </div>
      </div>

      <div class="settings-card" style="margin-top: 16px;">
        <div class="settings-card-header"><i class="fab fa-apple"></i> Dock</div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Enable Mac Dock</span>
            <span class="settings-label-desc">Switch from taskbar to a macOS-style dock</span>
          </div>
          <label class="settings-toggle">
            <input type="checkbox" id="settingsDockEnabled" ${s.dockEnabled ? "checked" : ""}/>
            <span class="settings-track"><span class="settings-thumb"></span></span>
          </label>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Position</span>
            <span class="settings-label-desc">Dock screen edge</span>
          </div>
          <div class="settings-button-group">
            <button class="settings-btn ${s.dockPosition === "bottom" ? "active" : ""}" data-dock-pos="bottom"><i class="fas fa-arrow-down"></i> Bottom</button>
            <button class="settings-btn ${s.dockPosition === "left" ? "active" : ""}" data-dock-pos="left"><i class="fas fa-arrow-left"></i> Left</button>
            <button class="settings-btn ${s.dockPosition === "right" ? "active" : ""}" data-dock-pos="right"><i class="fas fa-arrow-right"></i> Right</button>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Auto-Hide</span>
            <span class="settings-label-desc">Dock hides until you hover near the edge</span>
          </div>
          <label class="settings-toggle">
            <input type="checkbox" id="settingsDockAutoHide" ${s.dockAutoHide ? "checked" : ""}/>
            <span class="settings-track"><span class="settings-thumb"></span></span>
          </label>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Magnification</span>
            <span class="settings-label-desc">Hover zoom effect on dock icons</span>
          </div>
          <label class="settings-toggle">
            <input type="checkbox" id="settingsDockMagnification" ${s.dockMagnification ? "checked" : ""}/>
            <span class="settings-track"><span class="settings-thumb"></span></span>
          </label>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Magnification Amount</span>
            <span class="settings-label-desc">How much icons scale up on hover</span>
          </div>
          <div class="settings-range-group">
            ${renderRangeSlider("settingsDockMagnifyAmount", 0.1, 3.0, 0.1, s.dockMagnifyAmount)}
            <span id="settingsDockMagnifyAmountValue" class="settings-range-value">${s.dockMagnifyAmount}x</span>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Magnification Range</span>
            <span class="settings-label-desc">How many adjacent icons are affected</span>
          </div>
          <div class="settings-range-group">
            ${renderRangeSlider("settingsDockMagnifyRange", 1, 5, 1, s.dockMagnifyRange)}
            <span id="settingsDockMagnifyRangeValue" class="settings-range-value">${s.dockMagnifyRange}</span>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Icon Size</span>
            <span class="settings-label-desc">Base size of dock icons</span>
          </div>
          <div class="settings-range-group">
            ${renderRangeSlider("settingsDockIconSize", 28, 80, 4, s.dockIconSize)}
            <span id="settingsDockIconSizeValue" class="settings-range-value">${s.dockIconSize}px</span>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Dock Scale</span>
            <span class="settings-label-desc">Overall size of the dock bar</span>
          </div>
          <div class="settings-range-group">
            ${renderRangeSlider("settingsDockScale", 50, 200, 10, s.dockScale)}
            <span id="settingsDockScaleValue" class="settings-range-value">${s.dockScale}%</span>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Animation Speed</span>
            <span class="settings-label-desc">Hover and transition speed</span>
          </div>
          <div class="settings-range-group">
            ${renderRangeSlider("settingsDockAnimationSpeed", 0.05, 0.5, 0.05, s.dockAnimationSpeed)}
            <span id="settingsDockAnimationSpeedValue" class="settings-range-value">${s.dockAnimationSpeed}s</span>
          </div>
        </div>
      </div>

    </div>
  `;
}
export function renderAppearanceSettings(s) {
  const basicThemes = getBasicThemes();
  const specialThemes = getSpecialThemes();
  const customThemes = getCustomThemes();

  const basicThemeButtons = basicThemes
    .map(
      (theme) => `
      <button class="settings-btn theme-preview-btn ${s.theme === theme.value ? "active" : ""}" data-theme-val="${theme.value}" style="height: 56px; background: ${theme.preview || "#8b5cf6"}; color: ${theme.textColor || "#fff"};">
        <span>${theme.label}</span>
      </button>
    `
    )
    .join("");

  const specialThemeButtons = specialThemes
    .map(
      (theme) => `
      <button class="settings-btn theme-preview-btn ${s.theme === theme.value ? "active" : ""}" data-theme-val="${theme.value}" style="height: 56px; background: ${theme.preview || "#8b5cf6"}; color: ${theme.textColor || "#fff"};">
        <span>${theme.label}</span>
      </button>
    `
    )
    .join("");

  const customThemeButtons = customThemes
    .map(
      (theme) => `
      <button class="settings-btn theme-preview-btn ${s.theme === theme.value ? "active" : ""}" data-theme-val="${theme.value}" style="height: 56px; background: ${theme.preview || "#8b5cf6"}; color: ${theme.textColor || "#fff"};">
        <span>${theme.label}</span>
      </button>
    `
    )
    .join("");

  const viewportLabel = getViewportLabel();
  const resolutionOptions = RESOLUTION_PRESETS.map((p) => ({ value: p.value, label: p.label }));

  return `
    <div id="pane-appearance" class="settings-category-pane">
      <div class="settings-category-header">Appearance</div>

      <div class="settings-card">
        <div class="settings-card-header"><i class="fas fa-display"></i> Display</div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Display Resolution</span>
            <span class="settings-label-desc">Scale desktop to simulate a different resolution. Actual: ${viewportLabel}</span>
          </div>
          ${renderSelectMenu("settingsResolution", resolutionOptions, s.virtualResolution || "native")}
        </div>
      </div>

      <div id="settings-wallpaper-card" class="settings-card" style="margin-top: 16px;">
        <div class="settings-card-header"><i class="fas fa-images"></i> Wallpaper</div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Cycle Wallpapers on Start</span>
            <span class="settings-label-desc">Automatically switch wallpapers on boot</span>
          </div>
          <label class="settings-toggle">
            <input type="checkbox" id="settingsCycleWallpaper" ${s.cycleWallpaper ? "checked" : ""}/>
            <span class="settings-track"><span class="settings-thumb"></span></span>
          </label>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Wallpaper Engine</span>
            <span class="settings-label-desc">Browse, preview, and manage all your wallpapers in the dedicated manager</span>
          </div>
          <button class="settings-btn" id="settingsOpenWallpaperEngine">
            <i class="fas fa-paint-roller"></i> Open
          </button>
        </div>
      </div>

      <div class="settings-card" id="sc-style" style="margin-top: 16px;">
        <div class="settings-card-header"><i class="fas fa-palette"></i> Style &amp; Transparency</div>

        <div class="settings-row settings-row--stacked">
          <div class="settings-label-group">
            <span class="settings-label-title">Theme</span>
            <span class="settings-label-desc">Set the OS color scheme</span>
          </div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 10px;">
            ${basicThemeButtons}
          </div>
        </div>
        <div class="settings-row settings-row--stacked">
          <div class="settings-label-group">
            <span class="settings-label-title">Special Themes</span>
            <span class="settings-label-desc">Additional color schemes</span>
          </div>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 10px;">
            ${specialThemeButtons}
          </div>
        </div>
        <div class="settings-row settings-row--stacked">
          <div class="settings-label-group">
            <span class="settings-label-title">Custom Themes</span>
            <span class="settings-label-desc">Your saved themes</span>
          </div>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 10px;">
            ${customThemeButtons}
            ${customThemes.length === 0 ? '<span style="grid-column: 1/-1; color: var(--text-secondary); font-size: 12px; text-align: center; padding: 8px;">No custom themes yet. Click "Save Theme" to make one</span>' : ""}
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Custom Colors</span>
            <span class="settings-label-desc">Override theme colors manually</span>
          </div>
          <button class="settings-btn" id="settingsCustomColorsBtn">
            <i class="fas fa-palette"></i> Customize
          </button>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Save Custom Theme</span>
            <span class="settings-label-desc">Save current colors as a named theme</span>
          </div>
          <button class="settings-btn" id="settingsSaveThemeBtn">
            <i class="fas fa-save"></i> Save Theme
          </button>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Window Transparency</span>
            <span class="settings-label-desc">Adjust window opacity</span>
          </div>
          <div class="settings-range-group">
            ${renderRangeSlider("settingsWindowTransparency", 20, 100, 1, Math.round(s.windowTransparency * 100))}
            <span id="settingsWindowTransparencyValue" class="settings-range-value">${Math.round(s.windowTransparency * 100)}%</span>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Transparent OS UI</span>
            <span class="settings-label-desc">Make taskbar and start menu fully transparent</span>
          </div>
          <label class="settings-toggle">
            <input type="checkbox" id="settingsTransparentUI" ${s.transparentUI ? "checked" : ""}/>
            <span class="settings-track"><span class="settings-thumb"></span></span>
          </label>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">GUI Scale</span>
            <span class="settings-label-desc">Scale the entire interface</span>
          </div>
          <div class="settings-range-group">
            ${renderRangeSlider("settingsGuiScale", 50, 150, 5, s.guiScale)}
            <span id="settingsGuiScaleValue" class="settings-range-value">${s.guiScale}%</span>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Font Size</span>
            <span class="settings-label-desc">Adjust the base font size</span>
          </div>
          <div class="settings-range-group">
            ${renderRangeSlider("settingsFontSize", 75, 150, 5, s.fontSize)}
            <span id="settingsFontSizeValue" class="settings-range-value">${s.fontSize}%</span>
          </div>
        </div>
        <div class="settings-row settings-row--stacked">
          <div class="settings-label-group">
            <span class="settings-label-title">Font Family</span>
            <span class="settings-label-desc">Choose the UI font</span>
          </div>
          <div style="display:flex;align-items:center;gap:12px;margin-top:10px;">
            <span style="font-size:14px;">${
              s.fontFamily === "__custom__" && os.storage.get(StorageKeys.customFont)
                ? (() => {
                    const cf = os.storage.get(StorageKeys.customFont);
                    return `<i class="fas fa-font" style="color:var(--brand);margin-right:4px;"></i>${cf.family || "Custom Font"}`;
                  })()
                : "Open Sans"
            } <span style="opacity:0.5;font-size:12px;">(default)</span></span>
            <button class="settings-btn" data-fonts-in-system style="margin-left:auto;"><i class="fas fa-folder-open"></i> Fonts in system</button>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">UI Density</span>
            <span class="settings-label-desc">Adjust spacing throughout the interface</span>
          </div>
          <div class="settings-button-group">
            <button class="settings-btn ${s.uiDensity === "compact" ? "active" : ""}" data-ui-density="compact"><i class="fas fa-compress"></i> Compact</button>
            <button class="settings-btn ${s.uiDensity === "comfortable" ? "active" : ""}" data-ui-density="comfortable"><i class="fas fa-check"></i> Comfortable</button>
            <button class="settings-btn ${s.uiDensity === "spacious" ? "active" : ""}" data-ui-density="spacious"><i class="fas fa-expand"></i> Spacious</button>
          </div>
        </div>
      </div>

      <div class="settings-card" style="margin-top: 16px;">
        <div class="settings-card-header"><i class="fas fa-wand-magic-sparkles"></i> Window Animations</div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Open Animation</span>
            <span class="settings-label-desc">Effect when a window opens or is restored</span>
          </div>
          ${renderSelectMenu(
            "settingsOpenAnimation",
            [
              { value: "instant", label: "Instant (No Animation)" },
              { value: "fade", label: "Fade In" },
              { value: "scaleCenter", label: "Scale Center" },
              { value: "scaleFromSource", label: "Scale From Taskbar" },
              { value: "slideUp", label: "Slide Up" },
              { value: "slideLeft", label: "Slide In From Left" },
              { value: "slideRight", label: "Slide In From Right" },
              { value: "glassBlurin", label: "Glass Blur Transition" },
              { value: "elasticBounce", label: "Elastic Bounce" },
              { value: "blurReveal", label: "Blur Reveal" },
              { value: "perspective3D", label: "Perspective 3D" },
              { value: "cornerUnfold", label: "Corner Unfold" }
            ],
            os.storage.get(StorageKeys.windowOpenAnimation) || "scaleCenter"
          )}
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Close Animation</span>
            <span class="settings-label-desc">Effect when a window is closed</span>
          </div>
          ${renderSelectMenu(
            "settingsCloseAnimation",
            [
              { value: "instant", label: "Instant (No Animation)" },
              { value: "scaleDownCenter", label: "Scale Down Center" },
              { value: "scaleToOrigin", label: "Scale to Taskbar Origin" },
              { value: "fadeOut", label: "Fade Out Only" },
              { value: "slideDown", label: "Slide Down Exit" },
              { value: "burn", label: "Window Burn Close" },
              { value: "shrinkToPoint", label: "Shrink to Point" },
              { value: "dissolveBlur", label: "Dissolve with Blur" }
            ],
            os.storage.get(StorageKeys.windowCloseAnimation) || "scaleDownCenter"
          )}
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Minimize Animation</span>
            <span class="settings-label-desc">Effect when a window is minimized</span>
          </div>
          ${renderSelectMenu(
            "settingsMinimizeAnimation",
            [
              { value: "instant", label: "Instant (No Animation)" },
              { value: "taskbarShrink", label: "Taskbar Shrink" },
              { value: "dockZoomShrink", label: "Dock Zoom Shrink" },
              { value: "magicLamp", label: "Magic Lamp Warp" },
              { value: "fadeToTaskbar", label: "Fade to Taskbar" },
              { value: "elasticStretch", label: "Elastic Stretch" },
              { value: "spiralDown", label: "Spiral Down" }
            ],
            os.storage.get(StorageKeys.windowMinimizeAnimation) || "taskbarShrink"
          )}
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Animation Speed</span>
            <span class="settings-label-desc">Control how fast window animations play</span>
          </div>
          ${renderSelectMenu(
            "settingsAnimationSpeed",
            [
              { value: "slow", label: "Slow (0.5x)" },
              { value: "normal", label: "Normal (1x)" },
              { value: "fast", label: "Fast (1.5x)" },
              { value: "very_fast", label: "Very Fast (2x)" }
            ],
            os.storage.get(StorageKeys.windowAnimationSpeed) || "normal"
          )}
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Click Bubble Feedback</span>
            <span class="settings-label-desc">Show ripple effect under cursor on click.</span>
          </div>
          <label class="settings-toggle">
            <input type="checkbox" id="settingsClickBubble" ${os.storage.get(StorageKeys.clickBubbleFeedback) === "true" ? "checked" : ""}/>
            <span class="settings-track"><span class="settings-thumb"></span></span>
          </label>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Wobbly Windows</span>
            <span class="settings-label-desc">Enable wobble effect when dragging windows.</span>
          </div>
          <label class="settings-toggle">
            <input type="checkbox" id="settingsWobblyWindows" ${os.storage.get(StorageKeys.wobblyWindows) === "true" ? "checked" : ""}/>
            <span class="settings-track"><span class="settings-thumb"></span></span>
          </label>
        </div>
        <div class="settings-wobble-subsection" style="display: ${os.storage.get(StorageKeys.wobblyWindows) === "true" ? "block" : "none"}; padding-left: 16px; margin-top: 12px; border-left: 2px solid var(--glass-border);">
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label-title">Spring Stiffness</span>
              <span class="settings-label-desc">Controls how stiff the spring is (higher = stiffer).</span>
            </div>
            <div class="settings-range-group">
              ${renderRangeSlider("settingsWobbleSpringK", 50, 300, 1, s.wobbleSpringK, !s.wobblyWindows)}
              <span id="settingsWobbleSpringKValue" class="settings-range-value">${s.wobbleSpringK}</span>
            </div>
          </div>
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label-title">Damping</span>
              <span class="settings-label-desc">Controls how quickly the wobble settles (higher = less wobble).</span>
            </div>
            <div class="settings-range-group">
              ${renderRangeSlider("settingsWobbleDamping", 1, 50, 1, s.wobbleDamping, !s.wobblyWindows)}
              <span id="settingsWobbleDampingValue" class="settings-range-value">${s.wobbleDamping}</span>
            </div>
          </div>
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label-title">Mass</span>
              <span class="settings-label-desc">Controls the weight of the window (higher = heavier).</span>
            </div>
            <div class="settings-range-group">
              ${renderRangeSlider("settingsWobbleMass", 0.1, 5, 0.1, s.wobbleMass, !s.wobblyWindows)}
              <span id="settingsWobbleMassValue" class="settings-range-value">${s.wobbleMass}</span>
            </div>
          </div>
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label-title">Drag Lag</span>
              <span class="settings-label-desc">Controls how much the window lags behind cursor when dragging.</span>
            </div>
            <div class="settings-range-group">
              ${renderRangeSlider("settingsWobbleDragLag", 0.1, 1, 0.05, s.wobbleDragLag, !s.wobblyWindows)}
              <span id="settingsWobbleDragLagValue" class="settings-range-value">${s.wobbleDragLag}</span>
            </div>
          </div>
          <div class="settings-row">
            <div class="settings-label-group">
              <span class="settings-label-title">Coupling Stiffness</span>
              <span class="settings-label-desc">Controls how adjacent points affect each other (higher = more connected).</span>
            </div>
            <div class="settings-range-group">
              ${renderRangeSlider("settingsWobbleCoupleK", 10, 200, 1, s.wobbleCoupleK, !s.wobblyWindows)}
              <span id="settingsWobbleCoupleKValue" class="settings-range-value">${s.wobbleCoupleK}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="settings-card" style="margin-top: 16px;">
        <div class="settings-card-header"><i class="fas fa-mouse-pointer"></i> Custom Cursor</div>
        <div class="settings-row settings-row--stacked">
          <div class="settings-label-group">
            <span class="settings-label-title">Custom Cursor</span>
            <span class="settings-label-desc">Upload a PNG/JPG/GIF/WEBP cursor image for the OS</span>
          </div>
          <div class="settings-button-group" style="margin-top: 10px;">
            <button class="settings-btn" id="settingsCursorUploadBtn"><i class="fas fa-upload"></i> Upload</button>
            <button class="settings-btn settings-btn-warning" id="settingsCursorClearBtn" ${s.cursorDataUrl ? "" : "disabled"}>
              <i class="fas fa-times"></i> Clear
            </button>
            <span id="settingsCursorStatus" class="settings-status-text">
              ${s.cursorDataUrl ? "Custom cursor enabled" : "Default cursor"}
            </span>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Cursor Size</span>
            <span class="settings-label-desc">Scale the uploaded cursor image</span>
          </div>
          <div class="settings-range-group">
            ${renderRangeSlider("settingsCursorSize", 16, 128, 1, s.cursorSize, !s.cursorDataUrl)}
            <span id="settingsCursorSizeValue" class="settings-range-value">${s.cursorSize}px</span>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Miku Cursor</span>
            <span class="settings-label-desc">Use the Hatsune Miku cursor instead of the default</span>
          </div>
          <label class="settings-toggle">
            <input type="checkbox" id="settingsMikuCursor" ${s.mikuCursor !== false ? "checked" : ""}/>
            <span class="settings-track"><span class="settings-thumb"></span></span>
          </label>
        </div>
      </div>


    </div>
  `;
}
export function renderDataSettings() {
  return `
    <div id="pane-data" class="settings-category-pane">
      <div class="settings-category-header">Data &amp; Storage</div>

      <div class="settings-card">
        <div class="settings-card-header"><i class="fas fa-copy"></i> Import / Export</div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Export Data</span>
            <span class="settings-label-desc">Backup your system settings, files, and configuration</span>
          </div>
          <button class="settings-btn" id="btnExportData"><i class="fas fa-file-export"></i> Export</button>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Import Data</span>
            <span class="settings-label-desc">Restore a previously saved system backup</span>
          </div>
          <button class="settings-btn" id="btnImportData"><i class="fas fa-file-import"></i> Import</button>
        </div>
      </div>

      <div class="settings-card" style="margin-top: 16px;">
        <div class="settings-card-header"><i class="fas fa-download"></i> Save YukiOS</div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Download Page</span>
            <span class="settings-label-desc">Save a local copy of YukiOS</span>
          </div>
          <button class="settings-btn" id="settingsDownloadPageBtn"><i class="fas fa-download"></i> Download</button>
        </div>
      </div>

      <div class="settings-card" style="margin-top: 16px;">
        <div class="settings-card-header"><i class="fas fa-undo-alt"></i> Revert Options</div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Reset Toggles</span>
            <span class="settings-label-desc">Revert all OS switches back to default</span>
          </div>
          <button class="settings-btn settings-btn-warning" id="btnResetToggles"><i class="fas fa-sliders-h"></i> Reset</button>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Reset to Saved</span>
            <span class="settings-label-desc">Revert any unsaved changes to stored configuration</span>
          </div>
          <button class="settings-btn" id="btnResetSaved"><i class="fas fa-undo"></i> Revert</button>
        </div>
      </div>

      <div class="settings-card" style="margin-top: 16px; border-color: var(--error-border);">
        <div class="settings-card-header" style="color: var(--error);"><i class="fas fa-exclamation-triangle"></i> Danger Zone</div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title" style="color: var(--error);">Delete All Data</span>
            <span class="settings-label-desc">Permanently wipe all games, files, and OS settings</span>
          </div>
          <button class="settings-btn danger" style="background: var(--error); color: var(--text-on-brand); border: none;" id="btnDeleteAllData">
            <i class="fas fa-trash"></i> Wipe
          </button>
        </div>
      </div>
    </div>
  `;
}
export function renderNetworkSettings(s) {
  const wispServers = [
    { name: "Reeyuki Wisp", url: "wss://hurt-agata-liventcord-api-7072e9a6.koyeb.app/" },
    { name: "Reeyuki Wisp 2", url: "wss://reeyukiwisp.onrender.com/" }
  ];
  const currentWisp = s.wispServer || wispServers[0].url;
  const isCustomWisp = !wispServers.some((w) => w.url === currentWisp);

  return `
    <div id="pane-network" class="settings-category-pane">
      <div class="settings-category-header">Network</div>
      <div class="settings-card">
        <div class="settings-card-header"><i class="fas fa-server"></i> Content Delivery Network</div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">CDN Mirror</span>
            <span class="settings-label-desc">Choose a mirror for fetching game assets</span>
          </div>
          ${renderSelectMenu(
            "settingsCdnMirror",
            CDN_MIRRORS.map((m) => ({ value: m.id, label: m.name })),
            s.cdnMirror
          )}
        </div>
      </div>

      <div class="settings-card" style="margin-top: 16px;">
        <div class="settings-card-header"><i class="fas fa-shield-alt"></i> WISP Server</div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">WISP Server</span>
            <span class="settings-label-desc">Choose a WISP proxy server for Scramjet</span>
          </div>
          ${renderSelectMenu(
            "settingsWispServer",
            [...wispServers.map((w) => ({ value: w.url, label: w.name })), { value: "custom", label: "Custom..." }],
            currentWisp
          )}
        </div>
        <div class="settings-row ${isCustomWisp ? "" : "hidden"}" id="settingsCustomWispRow">
          <div class="settings-label-group">
            <span class="settings-label-title">Custom WISP URL</span>
            <span class="settings-label-desc">Enter your own WISP server URL</span>
          </div>
          <input type="text" id="settingsCustomWispUrl" class="settings-input" value="${isCustomWisp ? currentWisp : ""}" placeholder="wss://your-wisp-server.com/" style="width: 300px; padding: 8px; border: 1px solid var(--glass-border); border-radius: 6px; background: var(--bg-secondary); color: var(--text-primary); font-size: 13px;" />
        </div>
      </div>

      <div class="settings-card" style="margin-top: 16px;">
        <div class="settings-card-header"><i class="fas fa-exchange-alt"></i> Transport Protocol</div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Transport Protocol</span>
            <span class="settings-label-desc">Choose the proxy transport for Scramjet browser</span>
          </div>
          <div class="transport-pills" id="settingsBrowserTransport">
            ${renderTransportPills(s.browserTransport || "epoxy", "settingsTransport")}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderTransportPills(current, name) {
  const types = {
    epoxy: { name: "Epoxy (Wisp)", desc: "Default WebSocket-based transport" },
    libcurl: { name: "libcurl (Wisp)", desc: "Alternative WebSocket-based transport" },
    bare: { name: "Bare Server", desc: "HTTP-based proxy transport" }
  };
  return Object.entries(types)
    .map(function (entry) {
      var key = entry[0],
        t = entry[1];
      return (
        '<span class="settings-option-pill' +
        (key === current ? " active" : "") +
        '" data-transport="' +
        key +
        '" data-tooltip="' +
        t.desc +
        '">' +
        t.name +
        "</span>"
      );
    })
    .join("");
}
export function renderAudioSettings(s) {
  const vol = Math.round((s.soundEnabled ? s.masterVolume : audioMixer().masterVolume) * 100);
  const sysVol = Math.round((s.systemAudioEnabled ? s.systemVolume : audioMixer().systemVolume) * 100);
  return `
    <div id="pane-audio" class="settings-category-pane">
      <div class="settings-category-header">Audio</div>

      <div class="settings-card">
        <div class="settings-card-header"><i class="fas fa-volume-up"></i> Volume Control</div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Sound</span>
            <span class="settings-label-desc">Enable or mute all OS audio</span>
          </div>
          <label class="settings-toggle">
            <input type="checkbox" id="settingsSoundEnabled" ${s.soundEnabled ? "checked" : ""}/>
            <span class="settings-track"><span class="settings-thumb"></span></span>
          </label>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Master Volume</span>
            <span class="settings-label-desc">Global volume level for all apps</span>
          </div>
          <div class="settings-range-group">
            ${renderRangeSlider("settingsMasterVolume", 0, 100, 1, vol, !s.soundEnabled)}
            <span id="settingsMasterVolumeValue" class="settings-range-value">${vol}%</span>
          </div>
        </div>
      </div>

      <div class="settings-card">
        <div class="settings-card-header"><i class="fas fa-bell"></i> System Sounds</div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">System Audio</span>
            <span class="settings-label-desc">Enable login, logout, error, and warning sounds</span>
          </div>
          <label class="settings-toggle">
            <input type="checkbox" id="settingsSystemAudioEnabled" ${s.systemAudioEnabled ? "checked" : ""}/>
            <span class="settings-track"><span class="settings-thumb"></span></span>
          </label>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">System Volume</span>
            <span class="settings-label-desc">Volume for system sounds only</span>
          </div>
          <div class="settings-range-group">
            ${renderRangeSlider("settingsSystemVolume", 0, 100, 1, sysVol, !s.systemAudioEnabled)}
            <span id="settingsSystemVolumeValue" class="settings-range-value">${sysVol}%</span>
          </div>
        </div>
      </div>
    </div>
  `;
}
export function renderAboutSettings() {
  return `
    <div id="pane-about" class="settings-category-pane">
      <div class="settings-category-header">About</div>

      <div class="settings-card">
        <div class="settings-card-header"><i class="fas fa-info-circle"></i> OS Information</div>
        <div class="settings-row" style="flex-direction: column; align-items: flex-start; gap: 12px; padding: 20px;">
          <div style="display: flex; align-items: center; gap: 16px;">
            <img src="${resolveIconUrl("static/icons/logo.png")}" style="width: 48px; height: 48px; object-fit: contain;" onerror="this.src='favicon.ico'"/>
            <div>
              <h2 style="margin:0;font-size:1.3em;font-weight:600;display:flex;align-items:center;gap:8px;color:var(--text-primary);">YukiOS <span style="font-size:0.65em;background:var(--brand-dim);color:var(--brand);padding:2px 8px;border-radius:4px;font-weight:500;">${YUKIOS_VERSION}</span></h2>
              <p style="margin:4px 0 0 0;color:var(--text-secondary);font-size:0.8em;">Desktop, in your browser</p>
            </div>
          </div>
          <p style="margin:0;color:var(--text-primary);font-size:0.9em;line-height:1.5;opacity:0.75;">
            A full desktop OS in your browser with emulators, tools, PWA support, virtual filesystem, and 2900+ games included.
          </p>
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="color:var(--text-muted);font-size:0.78em;font-weight:500;">Build</span>
            <a href="https://github.com/Reeyuki/yukios/commit/${__GIT_COMMIT__}" target="_blank" rel="noopener noreferrer" style="font-family:monospace;font-size:0.78em;color:var(--text-secondary);text-decoration:none;background:var(--glass);padding:2px 8px;border-radius:4px;border:1px solid var(--glass-border);transition:color 0.15s,background 0.15s,border-color 0.15s;" onmouseover="this.style.color='var(--brand-hover)';this.style.background='var(--brand-dim)';this.style.borderColor='var(--brand)'" onmouseout="this.style.color='var(--text-secondary)';this.style.background='var(--glass)';this.style.borderColor='var(--glass-border)'">${__GIT_COMMIT__}</a>
          </div>
        </div>
      </div>

      <div class="settings-card" style="margin-top: 16px;">
        <div class="settings-card-header"><i class="fab fa-discord"></i> Community</div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">YukiCord</span>
            <span class="settings-label-desc">Join our Discord server</span>
          </div>
          <a href="https://discord.gg/2Z8Gvtqt7" target="_blank" rel="noopener noreferrer" class="settings-discord-link">
            <button class="settings-btn settings-btn-discord"><i class="fab fa-discord"></i> Join</button>
          </a>
        </div>
      </div>

      ${renderSystemInfo()}

      <div class="settings-card" style="margin-top: 16px; text-align: center; padding: 20px;">
        <a href="https://github.com/reeyuki" target="_blank" rel="noopener noreferrer" style="color: var(--text-muted); font-size: 0.82em; text-decoration: none; transition: color 0.15s;" onmouseover="this.style.color='var(--text-primary)'" onmouseout="this.style.color='var(--text-muted)'">made by reeyuki <i class="fab fa-github"></i></a>
      </div>
    </div>
  `;
}
