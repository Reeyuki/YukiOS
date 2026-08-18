import { MODES } from "../../modeManager.js";
import { os } from "../../framework.js";
import { SystemUtilities } from "../../system.js";
import { SessionMode } from "../shared/sessionBase.js";

const chromeSession = new SessionMode(MODES.CHROME_OS);

export function applyChromeOsSettings() {
  chromeSession.enter();
  const chromeWallpapers = [
    "Blues-Dark.jpg",
    "Blues.jpg",
    "Earth-Dark.jpg",
    "Earth-Light.jpg",
    "Fire-Dark.jpg",
    "Fire-Light.jpg",
    "Greens-Dark.jpg",
    "Greens.jpg",
    "Reds-Dark.jpg",
    "Reds.jpg",
    "Water-Dark.jpg",
    "Water-Light.jpg",
    "Wind-Dark.jpg",
    "Wind-Light.jpg",
    "Yellows-Dark.jpg",
    "Yellows.jpg",
    "chromeos-default.jpg"
  ];
  const pick = chromeWallpapers[Math.floor(Math.random() * chromeWallpapers.length)];
  SystemUtilities.setWallpaper(`/static/wallpapers/chromeos-wallpapers/${pick}`);
}

export function disableChromeOsSettings() {
  chromeSession.exit();
}
