export const SETTINGS = {
  runOnStartup: { title: "Run on Startup", description: "Launch Yuki Steam when your computer starts", type: "toggle", panel: "account", default: false },
  startMinimized: { title: "Start Minimized", description: "Start Yuki Steam minimized to system tray", type: "toggle", panel: "account", default: false },
  autoLogin: { title: "Auto Login", description: "Automatically log in on startup", type: "toggle", panel: "account", default: false },
  windowSessionPersistence: { title: "Session Persistence", description: "Save window positions and states between sessions", type: "toggle", panel: "account", default: true },
  socialDisabled: { title: "Disable Social Features", description: "Turn off friends, community, live activity and account sign-in", type: "toggle", panel: "account", default: false },
  currentlyPlayingPopups: { title: "Currently Playing Popups", description: "Show popups when friends start playing a game", type: "toggle", panel: "friends", default: true },
  shareLiveActivity: { title: "Share My Activity", description: "Send what you're playing and load friends' live activity", type: "toggle", panel: "friends", default: true },
  friendsLiveActivity: { title: "Friends Live Activity", description: "Enable live activity updates from friends", type: "toggle", panel: "friends", default: true },
  socialPresence: { title: "Social Presence", description: "Share your online status with friends", type: "toggle", panel: "friends", default: true },
  socialDnd: { title: "Social Do Not Disturb", description: "Hide your status and mute notifications", type: "toggle", panel: "friends", default: false },
  notificationsEnabled: { title: "Enable Notifications", description: "Show system notifications", type: "toggle", panel: "notifications", default: true },
  dnd: { title: "Do Not Disturb", description: "Mute activity popups from friends", type: "toggle", panel: "notifications", default: false },
  notificationsPosition: { title: "Notifications Position", description: "Where notifications appear on screen", type: "select", panel: "notifications", default: "bottom-right" },
  notificationsDuration: { title: "Notification Duration", description: "How long notifications stay visible (seconds)", type: "select", panel: "notifications", default: 5 },
  notificationsOverFullscreen: { title: "Show Over Fullscreen", description: "Display notifications over fullscreen apps", type: "toggle", panel: "notifications", default: false },
  notificationsPopAnimation: { title: "Pop Animation", description: "Animate notification appearance", type: "toggle", panel: "notifications", default: true },
  notificationsRemoveTimeout: { title: "Auto Remove Timeout", description: "Time before notifications auto-dismiss (seconds)", type: "select", panel: "notifications", default: 5 },
  enableStartupAnimation: { title: "Enable Startup Animation", description: "Show loading animation when Yuki Steam starts", type: "toggle", panel: "interface", default: true },
  deckBootAnimation: { title: "Deck Boot Video", description: "Play the fullscreen boot video when Yuki Deck starts", type: "toggle", panel: "interface", default: true },
  guiScale: { title: "GUI Scale", description: "Overall UI scaling percentage", type: "select", panel: "interface", default: 100 },
  fontSize: { title: "Font Size", description: "Base font size in pixels", type: "select", panel: "interface", default: 14 },
  fontFamily: { title: "Font Family", description: "Primary font family", type: "select", panel: "interface", default: "system" },
  uiDensity: { title: "UI Density", description: "Spacing and padding density", type: "select", panel: "interface", default: "medium" },
  theme: { title: "Theme", description: "Color theme selection", type: "select", panel: "interface", default: "default" },
  windowTransparency: { title: "Window Transparency", description: "Window background opacity", type: "select", panel: "interface", default: 95 },
  brightness: { title: "Brightness", description: "Display brightness level", type: "select", panel: "interface", default: 100 },
  nightModeEnabled: { title: "Night Mode", description: "Enable automatic night mode", type: "toggle", panel: "interface", default: false },
  steamAudioEnabled: { title: "Steam Audio", description: "Play UI sound effects in Steam and Yuki Deck", type: "toggle", panel: "interface", default: true },
  cdnMirror: { title: "CDN Mirror", description: "Content delivery network selection", type: "select", panel: "interface", default: "jsdelivr" },
  recentlyPlayedRow: { title: "Recently Played Row", description: "Show recently played games section in library", type: "toggle", panel: "library", default: true },
  gridSize: { title: "Grid Size", description: "Set the size of game tiles in library", type: "select", panel: "library", default: "medium" },
  hideArchiveGames: { title: "Hide Archive Games", description: "Hide archive games from library view", type: "toggle", panel: "library", default: false },
  hideLuminSDK: { title: "Hide LuminSDK Games", description: "Hide LuminSDK game catalog section from library view", type: "toggle", panel: "library", default: false },
  accountSyncEnabled: { title: "Account Sync", description: "Sync settings across devices", type: "toggle", panel: "cloud", default: false },
  overlayEnabled: { title: "Enable Overlay", description: "Enable in-game overlay (Shift+Tab)", type: "toggle", panel: "ingame", default: true },
  overlayRestoreTabs: { title: "Restore Tabs", description: "Restore previously open overlay tabs", type: "toggle", panel: "ingame", default: true },
  overlayPerfMonitor: { title: "Performance Monitor", description: "Show FPS and frame time in overlay", type: "toggle", panel: "ingame", default: false },
  performanceMode: { title: "Performance Mode", description: "System performance profile", type: "select", panel: "compatibility", default: "balanced" },
  powerMode: { title: "Power Mode", description: "Power management profile", type: "select", panel: "compatibility", default: "balanced" },
  batterySaverEnabled: { title: "Battery Saver", description: "Enable battery saving mode", type: "toggle", panel: "compatibility", default: false },
  batterySaverThreshold: { title: "Battery Threshold", description: "Battery level to trigger saver (%)", type: "select", panel: "compatibility", default: 20 },
  screenshotsEnabled: { title: "Enable Screenshots", description: "Allow taking screenshots during gameplay", type: "toggle", panel: "recording", default: true },
  screenshotFormat: { title: "Screenshot Format", description: "Image format for screenshots", type: "select", panel: "recording", default: "png" },
  autoRecordHighlights: { title: "Auto-Record Highlights", description: "Automatically record gameplay highlights", type: "toggle", panel: "recording", default: false },
  customFont: { default: "" },
  contrast: { default: 100 },
  temperature: { default: 6500 },
  overlayDockItems: { default: null },
  gamepadEnabled: { default: true },
  controllerDeadzone: { default: 10 },
  vibrationIntensity: { default: 50 }
};

export const DEFAULT_SETTINGS = Object.fromEntries(
  Object.entries(SETTINGS).map(([key, def]) => [key, def.default])
);

export const SETTINGS_SELECT_OPTIONS = {
  notificationsPosition: [
    { value: "top-right", label: "Top Right" },
    { value: "top-left", label: "Top Left" },
    { value: "bottom-right", label: "Bottom Right" },
    { value: "bottom-left", label: "Bottom Left" }
  ],
  notificationsDuration: [
    { value: "3", label: "3 seconds" },
    { value: "5", label: "5 seconds" },
    { value: "10", label: "10 seconds" },
    { value: "15", label: "15 seconds" }
  ],
  notificationsRemoveTimeout: [
    { value: "3", label: "3 seconds" },
    { value: "5", label: "5 seconds" },
    { value: "10", label: "10 seconds" }
  ],
  guiScale: [
    { value: "75", label: "75%" },
    { value: "85", label: "85%" },
    { value: "90", label: "90%" },
    { value: "95", label: "95%" },
    { value: "100", label: "100%" },
    { value: "110", label: "110%" },
    { value: "125", label: "125%" },
    { value: "150", label: "150%" }
  ],
  fontSize: [
    { value: "12", label: "12px" },
    { value: "13", label: "13px" },
    { value: "14", label: "14px" },
    { value: "15", label: "15px" },
    { value: "16", label: "16px" },
    { value: "18", label: "18px" }
  ],
  fontFamily: [
    { value: "system", label: "System Default" },
    { value: "sans-serif", label: "Sans Serif" },
    { value: "serif", label: "Serif" },
    { value: "monospace", label: "Monospace" }
  ],
  uiDensity: [
    { value: "compact", label: "Compact" },
    { value: "medium", label: "Medium" },
    { value: "comfortable", label: "Comfortable" }
  ],
  theme: [
    { value: "default", label: "Default" },
    { value: "dark", label: "Dark" },
    { value: "light", label: "Light" }
  ],
  windowTransparency: [
    { value: "80", label: "80%" },
    { value: "85", label: "85%" },
    { value: "90", label: "90%" },
    { value: "95", label: "95%" },
    { value: "100", label: "100%" }
  ],
  brightness: [
    { value: "80", label: "80%" },
    { value: "90", label: "90%" },
    { value: "100", label: "100%" },
    { value: "110", label: "110%" },
    { value: "120", label: "120%" }
  ],
  cdnMirror: [
    { value: "jsdelivr", label: "jsDelivr" },
    { value: "ghproxy", label: "GitHub Proxy" },
    { value: "fastgit", label: "FastGit" }
  ],
  gridSize: [
    { value: "small", label: "Small" },
    { value: "medium", label: "Medium" },
    { value: "large", label: "Large" }
  ],
  performanceMode: [
    { value: "performance", label: "Performance" },
    { value: "balanced", label: "Balanced" },
    { value: "high", label: "High Performance" }
  ],
  powerMode: [
    { value: "performance", label: "Performance" },
    { value: "balanced", label: "Balanced" },
    { value: "high", label: "High Performance" }
  ],
  batterySaverThreshold: [
    { value: "10", label: "10%" },
    { value: "15", label: "15%" },
    { value: "20", label: "20%" },
    { value: "25", label: "25%" },
    { value: "30", label: "30%" }
  ],
  screenshotFormat: [
    { value: "png", label: "PNG" },
    { value: "jpg", label: "JPG" },
    { value: "webp", label: "WebP" }
  ]
};

export const SETTINGS_PANELS = [
  { id: "account", title: "Account", icon: "fas fa-id-card" },
  { id: "friends", title: "Friends & Chat", icon: "fas fa-user-group" },
  { id: "notifications", title: "Notifications", icon: "fas fa-circle-exclamation" },
  { id: "interface", title: "Interface", icon: "fas fa-desktop" },
  { id: "library", title: "Library", icon: "fas fa-grip" },
  {
    id: "cloud",
    title: "Cloud",
    icon: "fas fa-cloud",
    customHtml: `
      <div class="settings-item">
        <div class="settings-item-label">
          <div class="settings-item-title">Sync Components</div>
          <div class="settings-item-description">Choose what to sync</div>
        </div>
      </div>
      <div class="sync-components-list"></div>
      <div class="settings-item">
        <button class="settings-button steam-sync-now-btn">Sync Now</button>
      </div>
      <div class="sync-status"></div>
    `
  },
  { id: "ingame", title: "In Game", icon: "fas fa-gamepad" },
  { id: "compatibility", title: "Compatibility", icon: "fas fa-snowflake" },
  { id: "recording", title: "Game Recording", icon: "fas fa-video" }
];

export const SETTINGS_NAV = [
  ["account", "friends"],
  ["notifications", "interface", "library", "cloud", "ingame", "compatibility"],
  ["recording"]
];
