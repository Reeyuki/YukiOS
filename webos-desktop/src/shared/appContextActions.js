import { os } from "../framework.js";
import { StorageKeys } from "../StorageKeys.js";
import { showFileProperties } from "../fileDisplay.js";
import { addAppToDesktop, isAppOnDesktop } from "./desktopShortcuts.js";

export { addAppToDesktop, isAppOnDesktop };

export function isAppPinnedToTaskbar(appId) {
  const pinnedItems = os.windowManager?.taskbarSystem?.getPinnedItems?.() || [];
  return pinnedItems.some((item) => item.appId === appId);
}

export function toggleTaskbarPin(appId, appData) {
  const displayName = appData.title || appId;
  if (isAppPinnedToTaskbar(appId)) {
    os.windowManager?.taskbarSystem?.unpinFromTaskbar(`${appId}-pinned`);
  } else {
    os.window.pinAppToTaskbar(appId, displayName, appData.icon || "fas fa-star");
  }
}

export function showAppProperties(appId, appData) {
  const fileName = `${appData.title || appId}.desktop`;
  showFileProperties(["Desktop", fileName], fileName, false);
}

export function isAppFavorite(appId) {
  const favorites = os.storage.get(StorageKeys.favoritesKey) || [];
  return favorites.includes(appId);
}

export function toggleAppFavorite(appId) {
  const favorites = os.storage.get(StorageKeys.favoritesKey) || [];
  const idx = favorites.indexOf(appId);
  const nowFavorite = idx < 0;
  if (nowFavorite) favorites.push(appId);
  else favorites.splice(idx, 1);
  os.storage.set(StorageKeys.favoritesKey, favorites);
  return nowFavorite;
}
