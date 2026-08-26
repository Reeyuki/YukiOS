import { os } from "../framework.js";

export const QUICK_SETTINGS_ID = "pane-quick";

export const SETTINGS_GROUPS = [
  {
    title: "Network & Internet",
    icon: "fas fa-network-wired",
    items: [{ id: "wifi-internet", title: "Wi-Fi & Internet", icon: "fas fa-wifi", pane: "pane-network" }]
  },
  {
    title: "Appearance",
    icon: "fas fa-paint-brush",
    items: [
      {
        id: "display-monitor",
        title: "Display & Monitor",
        icon: "fas fa-desktop",
        pane: "pane-appearance",
        target: "sc-display"
      },
      { id: "wallpaper", title: "Wallpaper", icon: "fas fa-images", pane: "pane-appearance", target: "sc-wallpaper" },
      {
        id: "colors-themes",
        title: "Colors & Themes",
        icon: "fas fa-palette",
        pane: "pane-appearance",
        target: "sc-style"
      },
      { id: "text-fonts", title: "Text & Fonts", icon: "fas fa-font", pane: "pane-appearance", target: "sc-style" },
      {
        id: "window-headers",
        title: "Window Headers",
        icon: "fas fa-window-maximize",
        pane: "pane-appearance",
        target: "sc-headers"
      },
      { id: "mouse-touchpad", title: "Mouse", icon: "fas fa-mouse", pane: "pane-appearance", target: "sc-cursor" },
      { id: "sidebar-style", title: "Sidebar", icon: "fas fa-bars", pane: "pane-appearance", target: "sc-sidebar" },
      {
        id: "animations",
        title: "Animations",
        icon: "fas fa-wand-magic-sparkles",
        pane: "pane-appearance",
        target: "sc-animations"
      },
      {
        id: "transparency",
        title: "Transparency",
        icon: "fas fa-layer-group",
        pane: "pane-appearance",
        target: "sc-transparency"
      }
    ]
  },
  {
    title: "Sound",
    icon: "fas fa-volume-high",
    items: [{ id: "sound", title: "Sound", icon: "fas fa-volume-high", pane: "pane-audio" }]
  },
  {
    title: "Apps",
    icon: "fas fa-cubes",
    items: [
      {
        id: "default-applications",
        title: "Default Applications",
        icon: "fas fa-cubes",
        pane: "default-applications",
        launch: "defaultApps"
      },
      { id: "autostart", title: "Autostart", icon: "fas fa-power-off", pane: "pane-autostart" }
    ]
  },
  {
    title: "Desktop",
    icon: "fas fa-desktop",
    items: [
      {
        id: "window-management",
        title: "Window Management",
        icon: "fas fa-border-all",
        pane: "pane-desktop",
        target: "sc-layout"
      },
      { id: "desktop-icons", title: "Desktop Icons", icon: "fas fa-icons", pane: "pane-desktop", target: "sc-icons" },
      { id: "start-menu", title: "Start Menu", icon: "fas fa-bars", pane: "pane-desktop", target: "sc-startmenu" },
      { id: "system-tray", title: "System Tray", icon: "fas fa-layer-group", pane: "pane-desktop", target: "sc-tray" },
      {
        id: "app-switcher",
        title: "App Switcher",
        icon: "fas fa-table-columns",
        pane: "pane-desktop",
        target: "sc-switcher"
      },
      { id: "dock", title: "Dock", icon: "fas fa-window-restore", pane: "pane-desktop", target: "sc-dock" },
      { id: "general-behavior", title: "General Behavior", icon: "fas fa-sliders-h", pane: "pane-general" }
    ]
  },
  {
    title: "Shortcuts",
    icon: "fas fa-keyboard",
    items: [{ id: "keyboard-shortcuts", title: "Keyboard Shortcuts", icon: "fas fa-keyboard", pane: "pane-shortcuts" }]
  },
  {
    title: "System",
    icon: "fas fa-microchip",
    items: [
      { id: "data-storage", title: "Data & Storage", icon: "fas fa-database", pane: "pane-data" },
      { id: "disks", title: "Disks", icon: "fas fa-hdd", pane: "pane-disks" },
      { id: "session", title: "Session", icon: "fas fa-right-to-bracket", pane: "pane-system" },
      { id: "about", title: "About this System", icon: "fas fa-circle-info", pane: "pane-about" }
    ]
  },
  {
    title: "Accounts",
    icon: "fas fa-id-card",
    items: [{ id: "users", title: "Users", icon: "fas fa-users", pane: "pane-accounts" }]
  },
  {
    title: "Privacy & Security",
    icon: "fas fa-shield-halved",
    items: [
      { id: "application-permissions", title: "Privacy & Analytics", icon: "fas fa-user-shield", pane: "pane-privacy" },
      { id: "recent-files", title: "Recent Files", icon: "fas fa-clock-rotate-left", pane: "pane-recent-files" }
    ]
  },
  {
    title: "Notifications",
    icon: "fas fa-bell",
    items: [{ id: "notifications", title: "Notifications", icon: "fas fa-bell", pane: "pane-notifications" }]
  }
];

export const SETTINGS_CATEGORIES = SETTINGS_GROUPS.flatMap((g) =>
  g.items.map((it) => ({ id: it.id, title: it.title, icon: it.icon, pane: it.pane }))
);

export function launchSettingsPane(paneId, target) {
  os.app.launch("settingsApp", target ? { section: paneId, target } : { section: paneId });
}
