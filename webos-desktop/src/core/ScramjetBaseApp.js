import { BaseApp } from "./BaseApp.js";

import { PersistenceTypes, StorageKeys, os } from "../framework.js";
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
          externalUrl: this.getAppId() !== "discordApp" ? this.getTargetURL() : undefined,
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

  open(opts = {}) {
    const schema = this.getDeclarativeSchema(opts);
    if (!schema || !schema.windows || schema.windows.length === 0) {
      throw new Error(`${this.constructor.name}.getDeclarativeSchema() must return a valid schema with windows.`);
    }

    const windowConfig = schema.windows[0];
    const winId = windowConfig.id;

    if (this.isSingletonOpen(winId)) {
      return;
    }

    const win = os.window.create(winId, windowConfig.title, windowConfig.size[0], windowConfig.size[1], {
      icon: windowConfig.icon,
      appId: schema.id
    });

    win.innerHTML = windowConfig.ui;

    if (schema.onMount && typeof this[schema.onMount] === "function") {
      this[schema.onMount](null, null, win, schema.state?.initial || {});
    }

    this.isDeclarative = true;
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
