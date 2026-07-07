import { YUKIOS_VERSION } from "./apps/about.js";
import { StorageKeys, os } from "./framework.js";

const VERSION_URL = "https://raw.githubusercontent.com/reeyuki/YukiOS/main/webos-desktop/version.txt";
const CHECK_INTERVAL = 6 * 60 * 60 * 1000;
const TRAY_ID = "versionChecker";

function isNewer(remote, current) {
  const clean = (v) => v.replace(/^v/i, "").split(".").map(Number);
  const r = clean(remote);
  const c = clean(current);
  if (r.some(isNaN) || c.some(isNaN)) return false;
  for (let i = 0; i < Math.max(r.length, c.length); i++) {
    const a = r[i] || 0;
    const b = c[i] || 0;
    if (a > b) return true;
    if (a < b) return false;
  }
  return false;
}

class VersionChecker {
  constructor() {
    this._intervalId = null;
  }

  async check() {
    try {
      const response = await fetch(VERSION_URL, { cache: "no-cache" });
      if (!response.ok) return;

      const remoteVersion = (await response.text()).trim();
      if (!remoteVersion) return;

      const currentVersion = YUKIOS_VERSION;
      const lastKnownRemote = os.storage.get(StorageKeys.lastKnownRemoteVersion);

      os.storage.set(StorageKeys.lastVersionCheck, Date.now().toString());

      if (isNewer(remoteVersion, currentVersion)) {
        os.storage.set(StorageKeys.lastKnownRemoteVersion, remoteVersion);

        if (lastKnownRemote !== remoteVersion) {
          os.notify.send("Update Available", `YukiOS ${remoteVersion} is now available!`, {
            type: "info",
            duration: 0,
            icon: "fa-download",
            appSource: "Version Checker"
          });
        }

        if (!os.tray.isRegistered(TRAY_ID)) {
          os.tray.register(TRAY_ID, "fas fa-download", `Update: ${remoteVersion}`, {
            resident: true,
            priority: 100,
            onClick: () => {
              window.open("https://github.com/reeyuki/YukiOS/releases", "_blank", "noopener");
            }
          });
        } else {
          os.tray.updateLabel(TRAY_ID, `Update: ${remoteVersion}`);
        }
      } else {
        if (os.tray.isRegistered(TRAY_ID)) {
          os.tray.unregister(TRAY_ID);
        }
        if (lastKnownRemote && !isNewer(lastKnownRemote, currentVersion)) {
          os.storage.remove(StorageKeys.lastKnownRemoteVersion);
        }
      }
    } catch {
      // fail silently
    }
  }

  start() {
    this.check();
    this._intervalId = setInterval(() => this.check(), CHECK_INTERVAL);
  }

  stop() {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
    if (os.tray.isRegistered(TRAY_ID)) {
      os.tray.unregister(TRAY_ID);
    }
  }
}

export const versionChecker = new VersionChecker();
