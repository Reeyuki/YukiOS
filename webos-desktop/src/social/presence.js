import { os } from "../framework.js";
import { StorageKeys } from "../StorageKeys.js";
import { BusEvents } from "../core/EventBus.js";
import { registerLiveIdentity } from "./userIdentity.js";
import { SteamSettings } from "../games/steam.js";
import { isSocialDisabled } from "./socialSettings.js";

export const PRESENCE = Object.freeze({
  ONLINE: "online",
  INVISIBLE: "invisible",
  OFFLINE: "offline"
});

const PRESENCE_VALUES = new Set(Object.values(PRESENCE));

export function getPresence() {
  const stored = os.storage.get(StorageKeys.socialPresence);
  return PRESENCE_VALUES.has(stored) ? stored : PRESENCE.ONLINE;
}

export function setPresence(value) {
  if (!PRESENCE_VALUES.has(value)) return;
  os.storage.set(StorageKeys.socialPresence, value);
  registerLiveIdentity().catch(() => {});
  os.events.emit(BusEvents.SOCIAL_PRESENCE_CHANGED, { presence: value });
}

export function getDnd() {
  return SteamSettings.get("dnd") === true;
}

export function setDnd(enabled) {
  SteamSettings.set("dnd", Boolean(enabled));
  os.events.emit(BusEvents.SOCIAL_DND_CHANGED, { enabled: Boolean(enabled) });
}

export function isBroadcastAllowed() {
  return !isSocialDisabled() && getPresence() === PRESENCE.ONLINE;
}

export function isPollingAllowed() {
  return !isSocialDisabled() && getPresence() === PRESENCE.ONLINE;
}

export function isPopupAllowed() {
  return !isSocialDisabled() && !getDnd() && SteamSettings.get("currentlyPlayingPopups") !== false;
}
