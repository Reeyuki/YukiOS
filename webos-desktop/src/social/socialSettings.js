import { SteamSettings } from "../games/steamSettings.js";

export function isSocialDisabled() {
  return SteamSettings.get("socialDisabled") === true;
}
