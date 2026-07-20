import { os } from "../framework.js";

export const SETTINGS_CATEGORIES = [
  { id: "pane-system", title: "System", icon: "fas fa-desktop" },
  { id: "pane-desktop", title: "Desktop", icon: "fas fa-home" },
  { id: "pane-appearance", title: "Appearance", icon: "fas fa-paint-brush" },
  { id: "pane-tiling", title: "Tiling", icon: "fas fa-th-large" },
  { id: "pane-data", title: "Data & Storage", icon: "fas fa-database" },
  { id: "pane-network", title: "Network", icon: "fas fa-network-wired" },
  { id: "pane-audio", title: "Audio", icon: "fas fa-volume-high" },
  { id: "pane-accounts", title: "Accounts", icon: "fas fa-users" },
  { id: "pane-about", title: "About", icon: "fas fa-circle-info" }
];

export function launchSettingsPane(paneId, target) {
  os.app.launch("settingsApp", target ? { section: paneId, target } : { section: paneId });
}
