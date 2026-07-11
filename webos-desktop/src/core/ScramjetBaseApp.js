import { BaseApp } from "./BaseApp.js";

import { StorageKeys, os } from "../framework.js";
export class ScramjetBaseApp extends BaseApp {
  constructor(services) {
    super(services);
    this.iframe = null;
    this.scramjetController = null;
  }

  getTargetURL() {
    throw new Error(`${this.constructor.name}.getTargetURL() must be implemented.`);
  }

  getCSS() {
    return "";
  }

  getWISPURL() {
    return os.storage.get(StorageKeys.wispServer) || "wss://hurt-agata-liventcord-api-7072e9a6.koyeb.app/";
  }

  getSandbox() {
    return "allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation-by-user-activation";
  }

  getWindowSize() {
    return ["1024px", "768px"];
  }

  async open(opts = {}) {
    const winId = `${this.getAppId()}-window`;
    const size = this.getWindowSize();

    if (await this.isSingletonOpen(winId)) {
      return;
    }

    const win = os.window.create(winId, this.getAppName(), size[0], size[1], {
      icon: this.getAppIcon(),
      appId: this.getAppId()
    });

    win.innerHTML = `
      <div class="scramjet-base-container" style="width:100%;height:100%;overflow:hidden;">
        <iframe
          id="${this.getAppId()}-iframe"
          style="width:100%;height:100%;border:none;"
          sandbox="${this.getSandbox()}"
        ></iframe>
      </div>
    `;

    this.initScramjet(null, null, win, {});
    return win;
  }

  getAppId() {
    return "scramjet-base";
  }

  getAppName() {
    return "Scramjet App";
  }

  getAppIcon() {
    return resolveIconUrl("static/icons/firefox.webp");
  }

  getHTMLPath() {
    return `/scramapps/scramjet-template.html`;
  }

  async initScramjet(payload, vt, element, state) {
    if (
      location.href.includes("jsdelivr") ||
      location.href.includes("esm.sh") ||
      location.href.includes("statically") ||
      location.href.includes("staticdelivr")
    ) {
      os.dialog.alert(
        "Launch Error",
        "This app you are launching and other web apps does not work inside this url because of svg/iframe limitations on this domain (" +
          location.hostname +
          ")."
      );
    }
    this.iframe = element.querySelector(`#${this.getAppId()}-iframe`);
    const wispUrl = this.getWISPURL();
    const targetUrl = this.getTargetURL();
    this.iframe.src =
      window.location.origin +
      this.getHTMLPath() +
      `?wisp=${encodeURIComponent(wispUrl)}&target=${encodeURIComponent(targetUrl)}`;

    /* makeDraggable/makeResizable handled by os.window.create */
  }

  cleanupScramjet() {
    if (this.winId) {
      os.window.removeFromTaskbar(this.winId);
    }
    this.iframe = null;
    this.scramjetController = null;
  }
}
