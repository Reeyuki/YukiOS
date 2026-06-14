import { BaseApp } from "./BaseApp.js";
import { PersistenceTypes } from "../runtime/AppSchema.js";
import { StorageKeys } from "../StorageKeys.js";
import { os } from "../os/index.js";

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

  getDeclarativeSchema(opts) {
    return {
      id: this.getAppId(),
      name: this.getAppName(),
      icon: this.getAppIcon(),
      windows: [
        {
          id: `${this.getAppId()}-window`,
          title: this.getAppName(),
          size: this.getWindowSize(),
          icon: this.getAppIcon(),
          ui: `
            <div class="scramjet-base-container" style="width:100%;height:100%;overflow:hidden;">
              <iframe
                id="${this.getAppId()}-iframe"
                style="width:100%;height:100%;border:none;"
                sandbox="${this.getSandbox()}"
              ></iframe>
            </div>
          `
        }
      ],
      state: {
        initial: {},
        persistence: PersistenceTypes.NONE
      },
      onMount: "initScramjet",
      onClose: "cleanupScramjet"
    };
  }

  getAppId() {
    return "scramjet-base";
  }

  getAppName() {
    return "Scramjet App";
  }

  getAppIcon() {
    return "fas fa-globe";
  }

  getHTMLPath() {
    return `/scramapps/scramjet-template.html`;
  }

  async initScramjet(payload, vt, element, state) {
    this.iframe = element.querySelector(`#${this.getAppId()}-iframe`);
    const wispUrl = this.getWISPURL();
    const targetUrl = this.getTargetURL();
    this.iframe.src =
      window.location.origin +
      this.getHTMLPath() +
      `?wisp=${encodeURIComponent(wispUrl)}&target=${encodeURIComponent(targetUrl)}`;

    this.wm.makeDraggable(element);
    this.wm.makeResizable(element);
  }

  cleanupScramjet() {
    if (this.winId) {
      os.window.removeFromTaskbar(this.winId);
    }
    this.iframe = null;
    this.scramjetController = null;
  }
}
