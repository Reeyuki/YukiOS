import { SystemAppRenderer } from "../games/games.js";

import { BaseApp, os } from "../framework.js";
export class SystemAppsApp extends BaseApp {
  constructor(services) {
    super(services);
  }

  async open(opts = {}) {
    const winId = "system-apps-win";
    if (await this._isSingletonOpen(winId)) return;

    const win = os.window.create(winId, "System Apps", "800px", "600px", {
      icon: "fas fa-screwdriver-wrench"
    });
    win.classList.add("window-root");

    const appLauncher = this._services.appLauncher;
    const appMap = appLauncher?.appMap;
    const systemRenderer = new SystemAppRenderer(appMap);

    win.innerHTML = `
      <div class="window-header">
        <span><svg class="svg-inline--fa fa-desktop" style="color: white;margin-right: 6px;font-size: 25px;vertical-align: middle;" data-prefix="fas" data-icon="desktop" role="img" viewBox="0 0 512 512" aria-hidden="true" data-fa-i2svg=""><path fill="currentColor" d="M64 32C28.7 32 0 60.7 0 96L0 352c0 35.3 28.7 64 64 64l144 0-16 48-72 0c-13.3 0-24 10.7-24 24s10.7 24 24 24l272 0c13.3 0 24-10.7 24-24s-10.7-24-24-24l-72 0-16-48 144 0c35.3 0 64-28.7 64-64l0-256c0-35.3-28.7-64-64-64L64 32zM96 96l320 0c17.7 0 32 14.3 32 32l0 160c0 17.7-14.3 32-32 32L96 320c-17.7 0-32-14.3-32-32l0-160c0-17.7 14.3-32 32-32z"></path></svg>System Apps</span>
        ${os.window.getWindowControls()}
      </div>
      <div class="window-content system-apps-window" style="width:100%;height:100%;overflow:auto;padding:24px;box-sizing:border-box;">
        <div id="system-app-container"></div>
      </div>`;

    const container = win.querySelector("#system-app-container");
    systemRenderer.render(container, (appId) => {
      if (appLauncher) os.app.launch(appId);
    });
  }
}
