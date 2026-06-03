import { CDN_MIRRORS } from "../shared/assetResolver.js";
import { audioMixer } from "../audioMixer.js";
import { resolveGhUrl } from "../shared/assetResolver.js";
import { YUKIOS_VERSION } from "../apps/about.js";
import { StorageKeys } from "../StorageKeys.js";
import { os } from "../os/index.js";
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
          <li data-target="pane-data"><i class="fas fa-database"></i> Data</li>
          <li data-target="pane-network"><i class="fas fa-network-wired"></i> Network</li>
          <li data-target="pane-audio"><i class="fas fa-volume-high"></i> Audio</li>
          <li data-target="pane-about"><i class="fas fa-circle-info"></i> About</li>
        </ul>
      </div>

      <div class="yuki-settings-content">
        ${renderSystemSettings(settings)}
        ${renderDesktopSettings(settings)}
        ${renderAppearanceSettings(settings)}
        ${renderDataSettings()}
        ${renderNetworkSettings(settings)}
        ${renderAudioSettings(settings)}
        ${renderAboutSettings()}
      </div>
    </div>
  </div>
  `;
}
export function renderSystemSettings(s) {
  return `
    <div id="pane-system" class="settings-category-pane active">
      <div class="settings-category-header">System</div>

      <div class="settings-card">
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
            <span class="settings-label-desc">Bypass the login screen on startup</span>
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
            <input type="range" id="settingsNotificationsDuration" min="1" max="30" step="1" value="${s.notificationsDuration}" style="width: 120px;"/>
            <span class="settings-range-value" id="settingsNotificationsDurationVal" style="min-width: 24px; text-align: right; font-size: 0.9em; font-weight: 500;">${s.notificationsDuration}s</span>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Notification Position</span>
            <span class="settings-label-desc">Choose which corner notifications appear in</span>
          </div>
          <select id="settingsNotificationsPosition" class="settings-select">
            <option value="bottom-right" ${s.notificationsPosition === "bottom-right" ? "selected" : ""}>Bottom Right (Default)</option>
            <option value="bottom-left"  ${s.notificationsPosition === "bottom-left" ? "selected" : ""}>Bottom Left</option>
            <option value="top-right"    ${s.notificationsPosition === "top-right" ? "selected" : ""}>Top Right</option>
            <option value="top-left"     ${s.notificationsPosition === "top-left" ? "selected" : ""}>Top Left</option>
          </select>
        </div>
      </div>
    </div>
  `;
}
export function renderDesktopSettings(s) {
  return `
    <div id="pane-desktop" class="settings-category-pane">
      <div class="settings-category-header">Desktop</div>

      <div class="settings-card">
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
      </div>

      <div class="settings-card" style="margin-top: 16px;">
        <div class="settings-card-header"><i class="fas fa-bars"></i> Start Menu</div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Start Menu Width</span>
            <span class="settings-label-desc">Adjust the width of the start menu</span>
          </div>
          <div class="settings-range-group">
            <input id="settingsStartMenuWidth" type="range" min="400" max="1000" step="10" value="${s.startMenuWidth}"/>
            <span id="settingsStartMenuWidthValue" class="settings-range-value">${s.startMenuWidth}px</span>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Start Menu Height</span>
            <span class="settings-label-desc">Adjust the height of the start menu</span>
          </div>
          <div class="settings-range-group">
            <input id="settingsStartMenuHeight" type="range" min="300" max="900" step="10" value="${s.startMenuHeight}"/>
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
            <div class="settings-grid-toggle"><span>Customize Profile</span>
              <label class="settings-toggle"><input type="checkbox" class="settings-start-cat-toggle" data-cat="customize" ${s.startMenuCats.customize !== false ? "checked" : ""}/><span class="settings-track"><span class="settings-thumb"></span></span></label>
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
            <div style="padding: 12px; color: var(--text-muted); font-size: 13px; text-align: center;">No tray apps registered</div>
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
          <select id="settingsWindowSwitcherMode" class="settings-select">
            <option value="mru"   ${s.windowSwitcherMode === "mru" ? "selected" : ""}>Most Recently Used (MRU)</option>
            <option value="stack" ${s.windowSwitcherMode === "stack" ? "selected" : ""}>Cycle / Stack Order</option>
          </select>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">UI Display Mode</span>
            <span class="settings-label-desc">Visual representation while cycling</span>
          </div>
          <select id="settingsWindowSwitcherUI" class="settings-select">
            <option value="overlay"  ${s.windowSwitcherUI === "overlay" ? "selected" : ""}>App Switcher Overlay (shows previews)</option>
            <option value="direct"   ${s.windowSwitcherUI === "direct" ? "selected" : ""}>Fast Switching (no visual UI)</option>
            <option value="taskbar"  ${s.windowSwitcherUI === "taskbar" ? "selected" : ""}>Switch using Taskbar highlight</option>
          </select>
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
        <div class="settings-card-header"><i class="fas fa-eye-slash"></i> Desktop Visibility</div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Hide Games</span>
            <span class="settings-label-desc">Toggle visibility of game icons on desktop</span>
          </div>
          <button class="settings-btn" id="settingsHideGamesBtn">
            <i class="fas fa-eye-slash"></i> Toggle
          </button>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Hide System Apps</span>
            <span class="settings-label-desc">Toggle visibility of system apps on desktop</span>
          </div>
          <button class="settings-btn" id="settingsHideAppsBtn">
            <i class="fas fa-eye-slash"></i> Toggle
          </button>
        </div>
      </div>
    </div>
  `;
}
export function renderAppearanceSettings(s) {
  return `
    <div id="pane-appearance" class="settings-category-pane">
      <div class="settings-category-header">Appearance</div>

      <div class="settings-card">
        <div class="settings-card-header"><i class="fas fa-palette"></i> Style &amp; Transparency</div>

        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">macOS Window Controls</span>
            <span class="settings-label-desc">Use macOS-style traffic light buttons</span>
          </div>
          <label class="settings-toggle">
            <input type="checkbox" id="settingsMacControls" ${s.macOsControls ? "checked" : ""}/>
            <span class="settings-track"><span class="settings-thumb"></span></span>
          </label>
        </div>

        <div class="settings-row settings-row--stacked">
          <div class="settings-label-group">
            <span class="settings-label-title">Theme</span>
            <span class="settings-label-desc">Set the OS color scheme</span>
          </div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 10px;">
            <button class="settings-btn ${s.theme === "dark" ? "active" : ""}" data-theme-val="dark"><i class="fas fa-moon"></i> Dark</button>
            <button class="settings-btn ${s.theme === "light" ? "active" : ""}" data-theme-val="light"><i class="fas fa-sun"></i> Light</button>
            <button class="settings-btn ${s.theme === "auto" ? "active" : ""}" data-theme-val="auto"><i class="fas fa-circle-half-stroke"></i> Auto</button>
          </div>
        </div>
        <div class="settings-row settings-row--stacked">
          <div class="settings-label-group">
            <span class="settings-label-title">Special Themes</span>
            <span class="settings-label-desc">Additional color schemes</span>
          </div>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 10px;">
            <button class="settings-btn ${s.theme === "cyber" ? "active" : ""}" data-theme-val="cyber"><i class="fas fa-bolt"></i> Cyber</button>
            <button class="settings-btn ${s.theme === "arctic" ? "active" : ""}" data-theme-val="arctic"><i class="fas fa-snowflake"></i> Arctic</button>
            <button class="settings-btn ${s.theme === "crt" ? "active" : ""}" data-theme-val="crt"><i class="fas fa-terminal"></i> CRT</button>
            <button class="settings-btn ${s.theme === "sakura" ? "active" : ""}" data-theme-val="sakura"><i class="fas fa-fan"></i> Sakura</button>
            <button class="settings-btn ${s.theme === "cherry" ? "active" : ""}" data-theme-val="cherry"><i class="fas fa-heart"></i> Cherry</button>
            <button class="settings-btn ${s.theme === "oled" ? "active" : ""}" data-theme-val="oled"><i class="fas fa-tv"></i> OLED</button>
            <button class="settings-btn ${s.theme === "synthwave" ? "active" : ""}" data-theme-val="synthwave"><i class="fas fa-music"></i> Synthwave</button>
            <button class="settings-btn ${s.theme === "nordic" ? "active" : ""}" data-theme-val="nordic"><i class="fas fa-mountain"></i> Nordic</button>
            <button class="settings-btn ${s.theme === "forest" ? "active" : ""}" data-theme-val="forest"><i class="fas fa-tree"></i> Forest</button>
            <button class="settings-btn ${s.theme === "high-contrast" ? "active" : ""}" data-theme-val="high-contrast"><i class="fas fa-adjust"></i> High Contrast</button>
            <button class="settings-btn ${s.theme === "vaporwave" ? "active" : ""}" data-theme-val="vaporwave"><i class="fas fa-sun"></i> Vaporwave</button>
            <button class="settings-btn ${s.theme === "gameboy" ? "active" : ""}" data-theme-val="gameboy"><i class="fas fa-gamepad"></i> Gameboy</button>
            <button class="settings-btn ${s.theme === "frutiger-aero" ? "active" : ""}" data-theme-val="frutiger-aero"><i class="fas fa-apple-whole"></i> Frutiger Aero</button>
            <button class="settings-btn ${s.theme === "dracula" ? "active" : ""}" data-theme-val="dracula"><i class="fas fa-skull"></i> Dracula</button>
            <button class="settings-btn ${s.theme === "solarized-dark" ? "active" : ""}" data-theme-val="solarized-dark"><i class="fas fa-sun"></i> Solarized Dark</button>
            <button class="settings-btn ${s.theme === "solarized-light" ? "active" : ""}" data-theme-val="solarized-light"><i class="fas fa-cloud-sun"></i> Solarized Light</button>
            <button class="settings-btn ${s.theme === "github-light" ? "active" : ""}" data-theme-val="github-light"><i class="fab fa-github"></i> GitHub Light</button>
            <button class="settings-btn ${s.theme === "github-dark" ? "active" : ""}" data-theme-val="github-dark"><i class="fab fa-github"></i> GitHub Dark</button>
            <button class="settings-btn ${s.theme === "minimal-gray" ? "active" : ""}" data-theme-val="minimal-gray"><i class="fas fa-circle"></i> Minimal Gray</button>
            <button class="settings-btn ${s.theme === "paper" ? "active" : ""}" data-theme-val="paper"><i class="fas fa-file-alt"></i> Paper</button>
            <button class="settings-btn ${s.theme === "macos-fluent" ? "active" : ""}" data-theme-val="macos-fluent"><i class="fab fa-apple"></i> MacOS Fluent</button>
            <button class="settings-btn ${s.theme === "windows-fluent" ? "active" : ""}" data-theme-val="windows-fluent"><i class="fab fa-windows"></i> Windows Fluent</button>
            <button class="settings-btn ${s.theme === "material-you" ? "active" : ""}" data-theme-val="material-you"><i class="fas fa-palette"></i> Material You</button>
            <button class="settings-btn ${s.theme === "sepia" ? "active" : ""}" data-theme-val="sepia"><i class="fas fa-book"></i> Sepia</button>
            <button class="settings-btn ${s.theme === "warm-night" ? "active" : ""}" data-theme-val="warm-night"><i class="fas fa-moon"></i> Warm Night</button>
            <button class="settings-btn ${s.theme === "star-wars-dark" ? "active" : ""}" data-theme-val="star-wars-dark"><i class="fas fa-skull"></i> Star Wars Dark</button>
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
            <span class="settings-label-title">Window Transparency</span>
            <span class="settings-label-desc">Adjust window opacity</span>
          </div>
          <div class="settings-range-group">
            <input id="settingsWindowTransparency" type="range" min="20" max="100" step="1" value="${Math.round(s.windowTransparency * 100)}"/>
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
            <input id="settingsGuiScale" type="range" min="50" max="150" step="5" value="${s.guiScale}"/>
            <span id="settingsGuiScaleValue" class="settings-range-value">${s.guiScale}%</span>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Font Size</span>
            <span class="settings-label-desc">Adjust the base font size</span>
          </div>
          <div class="settings-range-group">
            <input id="settingsFontSize" type="range" min="75" max="150" step="5" value="${s.fontSize}"/>
            <span id="settingsFontSizeValue" class="settings-range-value">${s.fontSize}%</span>
          </div>
        </div>
        <div class="settings-row settings-row--stacked">
          <div class="settings-label-group">
            <span class="settings-label-title">Font Family</span>
            <span class="settings-label-desc">Choose the UI font</span>
          </div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 10px;">
            <button class="settings-btn ${s.fontFamily === "opensans" ? "active" : ""}" data-font-family="opensans">Open Sans</button>
            <button class="settings-btn ${s.fontFamily === "inter" ? "active" : ""}" data-font-family="inter">Inter</button>
            <button class="settings-btn ${s.fontFamily === "rubik" ? "active" : ""}" data-font-family="rubik">Rubik</button>
            <button class="settings-btn ${s.fontFamily === "sora" ? "active" : ""}" data-font-family="sora">Sora</button>
            <button class="settings-btn ${s.fontFamily === "jetbrainsmono" ? "active" : ""}" data-font-family="jetbrainsmono">JetBrains Mono</button>
            <button class="settings-btn ${s.fontFamily === "monocraft" ? "active" : ""}" data-font-family="monocraft">Monocraft</button>
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
          <select id="settingsOpenAnimation" class="settings-select">
            <option value="instant"        ${(os.storage.get(StorageKeys.windowOpenAnimation) || "scaleCenter") === "instant" ? "selected" : ""}>Instant (No Animation)</option>
            <option value="fade"           ${(os.storage.get(StorageKeys.windowOpenAnimation) || "scaleCenter") === "fade" ? "selected" : ""}>Fade In</option>
            <option value="scaleCenter"    ${(os.storage.get(StorageKeys.windowOpenAnimation) || "scaleCenter") === "scaleCenter" ? "selected" : ""}>Scale Center</option>
            <option value="scaleFromSource"${(os.storage.get(StorageKeys.windowOpenAnimation) || "scaleCenter") === "scaleFromSource" ? "selected" : ""}>Scale From Taskbar</option>
            <option value="slideUp"        ${(os.storage.get(StorageKeys.windowOpenAnimation) || "scaleCenter") === "slideUp" ? "selected" : ""}>Slide Up</option>
            <option value="slideLeft"      ${(os.storage.get(StorageKeys.windowOpenAnimation) || "scaleCenter") === "slideLeft" ? "selected" : ""}>Slide In From Left</option>
            <option value="slideRight"     ${(os.storage.get(StorageKeys.windowOpenAnimation) || "scaleCenter") === "slideRight" ? "selected" : ""}>Slide In From Right</option>
            <option value="glassBlurin"    ${(os.storage.get(StorageKeys.windowOpenAnimation) || "scaleCenter") === "glassBlurin" ? "selected" : ""}>Glass Blur Transition</option>
            <option value="elasticBounce"  ${(os.storage.get(StorageKeys.windowOpenAnimation) || "scaleCenter") === "elasticBounce" ? "selected" : ""}>Elastic Bounce</option>
            <option value="blurReveal"     ${(os.storage.get(StorageKeys.windowOpenAnimation) || "scaleCenter") === "blurReveal" ? "selected" : ""}>Blur Reveal</option>
            <option value="perspective3D"  ${(os.storage.get(StorageKeys.windowOpenAnimation) || "scaleCenter") === "perspective3D" ? "selected" : ""}>Perspective 3D</option>
            <option value="cornerUnfold"   ${(os.storage.get(StorageKeys.windowOpenAnimation) || "scaleCenter") === "cornerUnfold" ? "selected" : ""}>Corner Unfold</option>
          </select>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Close Animation</span>
            <span class="settings-label-desc">Effect when a window is closed</span>
          </div>
          <select id="settingsCloseAnimation" class="settings-select">
            <option value="instant"        ${(os.storage.get(StorageKeys.windowCloseAnimation) || "scaleDownCenter") === "instant" ? "selected" : ""}>Instant (No Animation)</option>
            <option value="scaleDownCenter"${(os.storage.get(StorageKeys.windowCloseAnimation) || "scaleDownCenter") === "scaleDownCenter" ? "selected" : ""}>Scale Down Center</option>
            <option value="scaleToOrigin"  ${(os.storage.get(StorageKeys.windowCloseAnimation) || "scaleDownCenter") === "scaleToOrigin" ? "selected" : ""}>Scale to Taskbar Origin</option>
            <option value="fadeOut"        ${(os.storage.get(StorageKeys.windowCloseAnimation) || "scaleDownCenter") === "fadeOut" ? "selected" : ""}>Fade Out Only</option>
            <option value="slideDown"      ${(os.storage.get(StorageKeys.windowCloseAnimation) || "scaleDownCenter") === "slideDown" ? "selected" : ""}>Slide Down Exit</option>
            <option value="burn"           ${(os.storage.get(StorageKeys.windowCloseAnimation) || "scaleDownCenter") === "burn" ? "selected" : ""}>Window Burn Close</option>
            <option value="shrinkToPoint"  ${(os.storage.get(StorageKeys.windowCloseAnimation) || "scaleDownCenter") === "shrinkToPoint" ? "selected" : ""}>Shrink to Point</option>
            <option value="dissolveBlur"   ${(os.storage.get(StorageKeys.windowCloseAnimation) || "scaleDownCenter") === "dissolveBlur" ? "selected" : ""}>Dissolve with Blur</option>
          </select>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Minimize Animation</span>
            <span class="settings-label-desc">Effect when a window is minimized</span>
          </div>
          <select id="settingsMinimizeAnimation" class="settings-select">
            <option value="instant"       ${(os.storage.get(StorageKeys.windowMinimizeAnimation) || "taskbarShrink") === "instant" ? "selected" : ""}>Instant (No Animation)</option>
            <option value="taskbarShrink" ${(os.storage.get(StorageKeys.windowMinimizeAnimation) || "taskbarShrink") === "taskbarShrink" ? "selected" : ""}>Taskbar Shrink</option>
            <option value="dockZoomShrink"${(os.storage.get(StorageKeys.windowMinimizeAnimation) || "taskbarShrink") === "dockZoomShrink" ? "selected" : ""}>Dock Zoom Shrink</option>
            <option value="magicLamp"     ${(os.storage.get(StorageKeys.windowMinimizeAnimation) || "taskbarShrink") === "magicLamp" ? "selected" : ""}>Magic Lamp Warp</option>
            <option value="fadeToTaskbar" ${(os.storage.get(StorageKeys.windowMinimizeAnimation) || "taskbarShrink") === "fadeToTaskbar" ? "selected" : ""}>Fade to Taskbar</option>
            <option value="elasticStretch"${(os.storage.get(StorageKeys.windowMinimizeAnimation) || "taskbarShrink") === "elasticStretch" ? "selected" : ""}>Elastic Stretch</option>
            <option value="spiralDown"    ${(os.storage.get(StorageKeys.windowMinimizeAnimation) || "taskbarShrink") === "spiralDown" ? "selected" : ""}>Spiral Down</option>
          </select>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Animation Speed</span>
            <span class="settings-label-desc">Control how fast window animations play</span>
          </div>
          <select id="settingsAnimationSpeed" class="settings-select">
            <option value="slow"      ${(os.storage.get(StorageKeys.windowAnimationSpeed) || "normal") === "slow" ? "selected" : ""}>Slow (0.5x)</option>
            <option value="normal"    ${(os.storage.get(StorageKeys.windowAnimationSpeed) || "normal") === "normal" ? "selected" : ""}>Normal (1x)</option>
            <option value="fast"      ${(os.storage.get(StorageKeys.windowAnimationSpeed) || "normal") === "fast" ? "selected" : ""}>Fast (1.5x)</option>
            <option value="very_fast" ${(os.storage.get(StorageKeys.windowAnimationSpeed) || "normal") === "very_fast" ? "selected" : ""}>Very Fast (2x)</option>
          </select>
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Click Bubble Feedback</span>
            <span class="settings-label-desc">Show ripple effect under cursor on click (disabled by default)</span>
          </div>
          <label class="settings-toggle">
            <input type="checkbox" id="settingsClickBubble" ${os.storage.get(StorageKeys.clickBubbleFeedback) === "true" ? "checked" : ""}/>
            <span class="settings-track"><span class="settings-thumb"></span></span>
          </label>
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
            <input id="settingsCursorSize" type="range" min="16" max="128" step="1" value="${s.cursorSize}" ${s.cursorDataUrl ? "" : "disabled"}/>
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
        <div style="padding: 16px;">
          <div id="settings-wallpapers-container"></div>
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
        <div class="settings-card-header"><i class="fas fa-download"></i> Save Yuki OS</div>
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
          <select id="settingsCdnMirror" class="settings-select">
            ${CDN_MIRRORS.map((m) => `<option value="${m.id}" ${s.cdnMirror === m.id ? "selected" : ""}>${m.name}</option>`).join("")}
          </select>
        </div>
      </div>
    </div>
  `;
}
export function renderAudioSettings(s) {
  const vol = Math.round((s.soundEnabled ? s.masterVolume : audioMixer.masterVolume) * 100);
  const sysVol = Math.round((s.systemAudioEnabled ? s.systemVolume : audioMixer.systemVolume) * 100);
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
            <input id="settingsMasterVolume" type="range" min="0" max="100" step="1" value="${vol}" ${!s.soundEnabled ? "disabled" : ""}/>
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
            <input id="settingsSystemVolume" type="range" min="0" max="100" step="1" value="${sysVol}" ${!s.systemAudioEnabled ? "disabled" : ""}/>
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
            <img src="${resolveGhUrl("static/icons/logo.png")}" style="width: 48px; height: 48px; object-fit: contain;" onerror="this.src='favicon.ico'"/>
            <div>
              <h2 style="margin:0;font-size:1.3em;font-weight:600;display:flex;align-items:center;gap:8px;color:var(--text-primary);">Yuki OS <span style="font-size:0.65em;background:var(--brand-dim);color:var(--brand);padding:2px 8px;border-radius:4px;font-weight:500;">${YUKIOS_VERSION}</span></h2>
              <p style="margin:4px 0 0 0;color:var(--text-secondary);font-size:0.8em;">Browser desktop environment</p>
            </div>
          </div>
          <p style="margin:0;color:var(--text-primary);font-size:0.9em;line-height:1.5;opacity:0.75;">
            A fully featured desktop OS experience running directly in your web browser. Includes emulators, tools, PWA support, virtual filesystem, and 3700+ games.
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
    </div>
  `;
}
