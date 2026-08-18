import { MODES } from "../../modeManager.js";
import { os } from "../../framework.js";
import { SystemUtilities } from "../../system.js";
import { SessionMode } from "../shared/sessionBase.js";

const tilingSession = new SessionMode(MODES.TILING);

export function applyTilingSettings() {
  tilingSession.enter();
  os.tiling.setEnabled(true);
  const tilingWallpapers = ["corndog.jpg", "end_4.jpg", "Kath.jpg", "Meptl.png"];
  const pick = tilingWallpapers[Math.floor(Math.random() * tilingWallpapers.length)];
  SystemUtilities.setWallpaper(`/static/wallpapers/${pick}`);
}

export function disableTilingSettings() {
  tilingSession.exit();
  os.tiling.setEnabled(false);
}
