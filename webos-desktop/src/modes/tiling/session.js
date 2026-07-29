import { modeManager, MODES } from "../../modeManager.js";
import { BusEvents } from "../../core/EventBus.js";
import { os } from "../../framework.js";
import { SystemUtilities } from "../../system.js";

export function applyTilingSettings() {
  modeManager.enter(MODES.TILING);
  os.tiling.setEnabled(true);
  os.events.emit(BusEvents.SETTINGS_CHANGED, {});
  const tilingWallpapers = ["corndog.jpg", "end_4.jpg", "Kath.jpg", "Meptl.png"];
  const pick = tilingWallpapers[Math.floor(Math.random() * tilingWallpapers.length)];
  SystemUtilities.setWallpaper(`/static/wallpapers/${pick}`);
}

export function disableTilingSettings() {
  modeManager.exit(MODES.TILING);
  os.tiling.setEnabled(false);
}
