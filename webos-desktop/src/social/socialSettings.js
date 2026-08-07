import { SteamSettings } from "../games/steam.js";

export function isSocialDisabled() {
  return SteamSettings.get("socialDisabled") === true;
}
