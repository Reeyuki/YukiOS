import { MODES } from "../../modeManager.js";
import { BusEvents } from "../../core/EventBus.js";
import { StorageKeys, os } from "../../framework.js";
import { $, createElement } from "../../shared/domUtils.js";
import { applyTheme } from "../../settings/settingsApply.js";
import { taskbarPositionManager } from "../../desktopui/taskbarPositionManager.js";
import { SessionMode } from "../shared/sessionBase.js";
import { MINIMIZE_ANIMATIONS, RESTORE_ANIMATIONS, CLOSE_ANIMATIONS } from "../../windowManager/AnimationSystem.js";

const MAC_MINIMIZE = MINIMIZE_ANIMATIONS.magicLamp;
const MAC_RESTORE = RESTORE_ANIMATIONS.genieFromDock;
const MAC_CLOSE = CLOSE_ANIMATIONS.zoomToDock;

const macSession = new SessionMode(MODES.MAC);

export function applyMacSettings() {
  os.storage.set(StorageKeys.dockEnabled, "true");
  macSession.enter();
  os.storage.set(StorageKeys.theme, "macos-fluent");
  applyTheme("macos-fluent", () => os.storage.get(StorageKeys.customColors) || null);
  os.storage.set(StorageKeys.taskbarPosition, "top");
  taskbarPositionManager.setPosition("top");
  os.storage.set(StorageKeys.taskbarAlignment, "center");
  os.storage.set(StorageKeys.windowMinimizeAnimation, MAC_MINIMIZE);
  os.storage.set(StorageKeys.windowRestoreAnimation, MAC_RESTORE);
  os.storage.set(StorageKeys.windowCloseAnimation, MAC_CLOSE);
  const taskbarWindows = $("#taskbar-windows");
  const taskbar = $("#taskbar");
  if (taskbarWindows && taskbar) {
    const isHorizontal = taskbar.classList.contains("position-bottom") || taskbar.classList.contains("position-top");
    taskbarWindows.style.justifyContent = isHorizontal ? "center" : "center";
  }
  loadSfProFonts();
}

export function disableMacSettings() {
  macSession.exit();
  os.storage.set(StorageKeys.dockEnabled, "false");
  os.events.emit(BusEvents.SETTINGS_CHANGED, {});
  const currentTheme = os.storage.get(StorageKeys.theme);
  if (currentTheme === "macos-fluent") {
    os.storage.set(StorageKeys.theme, "yukios");
    applyTheme("yukios", () => os.storage.get(StorageKeys.customColors) || null);
  }
  if (os.storage.get(StorageKeys.windowMinimizeAnimation) === MAC_MINIMIZE) {
    os.storage.set(StorageKeys.windowMinimizeAnimation, MINIMIZE_ANIMATIONS.taskbarShrink);
  }
  if (os.storage.get(StorageKeys.windowRestoreAnimation) === MAC_RESTORE) {
    os.storage.set(StorageKeys.windowRestoreAnimation, RESTORE_ANIMATIONS.fromTaskbar);
  }
  if (os.storage.get(StorageKeys.windowCloseAnimation) === MAC_CLOSE) {
    os.storage.set(StorageKeys.windowCloseAnimation, CLOSE_ANIMATIONS.scaleDownCenter);
  }
  os.storage.set(StorageKeys.taskbarPosition, "bottom");
  taskbarPositionManager.setPosition("bottom");
  os.storage.set(StorageKeys.taskbarAlignment, "left");
  const taskbarWindows = $("#taskbar-windows");
  const taskbar = $("#taskbar");
  if (taskbarWindows && taskbar) {
    const isHorizontal = taskbar.classList.contains("position-bottom") || taskbar.classList.contains("position-top");
    taskbarWindows.style.justifyContent = isHorizontal ? "flex-start" : "center";
  }
}

function loadSfProFonts() {
  const existingLink = $('link[href*="SF-Pro"]');
  if (!existingLink) {
    const link = createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.cdnfonts.com/css/sf-pro-display";
    document.head.appendChild(link);
  }
}
