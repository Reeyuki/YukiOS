import { ScramjetBaseApp } from "./ScramjetBaseApp.js";
import { os } from "../framework.js";
import { $ } from "../shared/domUtils.js";

export function createScramjetWebApp(config) {
  const { appId, appName, targetUrl, appIcon, windowSize = ["1280px", "800px"], trayOptions = null } = config;

  class ScramjetWebApp extends ScramjetBaseApp {
    constructor(services) {
      super(services);
      this.winId = null;
      this.trayOptions = trayOptions;
    }

    getTargetURL() {
      return targetUrl;
    }

    getAppId() {
      return appId;
    }

    getAppName() {
      return appName;
    }

    getAppIcon() {
      return appIcon;
    }

    getWindowSize() {
      return windowSize;
    }

    getDeclarativeSchema(opts) {
      const schema = super.getDeclarativeSchema(opts);
      this.winId = `${this.getAppId()}-window`;
      return schema;
    }

    async initScramjet(payload, vt, element, state) {
      await super.initScramjet(payload, vt, element, state);

      if (this.trayOptions) {
        os.tray.register(this.winId, this.getAppIcon(), this.getAppName(), {
          showInTray: true,
          priority: 50,
          ...this.trayOptions,
          onClick: () => {
            if (this.trayOptions.onClick) {
              this.trayOptions.onClick();
            } else {
              os.tray.restoreFromTray(this.winId);
            }
          },
          onQuit: () => {
            if (this.trayOptions.onQuit) {
              this.trayOptions.onQuit();
            } else {
              os.window.close(this.winId);
            }
          }
        });
      }
    }

    cleanupScramjet() {
      if (this.winId) {
        os.tray.unregister(this.winId);
      }
      super.cleanupScramjet();
    }
  }

  ScramjetWebApp.appId = appId;
  ScramjetWebApp.appName = appName;

  return ScramjetWebApp;
}
