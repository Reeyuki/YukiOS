import { BaseApp } from "./BaseApp.js";
import "../styles/scramjet.css";
import {
  handlePopupMessage,
  handlePopupTitleMessage,
} from "./ScramjetPopupManager.js";
import { os } from "../framework.js";
import { getWispUrl } from "../shared/wispConfig.js";
import {
  injectFileProtocolFallback,
  isFileProtocol,
} from "../shared/fileProtocolFallback.js";
import { mountFileProtocolView } from "../shared/fileProtocolEngine.js";
export class ScramjetBaseApp extends BaseApp {
  popupMessageHandler = null;

  constructor(services) {
    super(services);
    this.iframe = null;
    this.scramjetController = null;
  }

  getPopupBridgeMeta() {
    return {
      parentAppId: this.getAppId(),
      parentName: this.getAppName(),
      parentIcon: this.getAppIcon(),
    };
  }

  bindPopupBridge(win) {
    if (win.dataset.popupBridgeBound) {
      return;
    }
    const iframe = win.querySelector(`#${this.getAppId()}-iframe`);
    if (!iframe) {
      return;
    }
    win.dataset.popupBridgeBound = "true";
    const handler = (event) => {
      try {
        const meta = this.getPopupBridgeMeta();
        if (handlePopupTitleMessage(event)) {
          return;
        }
        handlePopupMessage(event, iframe, meta);
      } catch {}
    };
    this.popupMessageHandler = handler;
    window.addEventListener("message", handler);
    win.addEventListener("remove", () => {
      try {
        window.removeEventListener("message", handler);
      } catch {}
    });
  }

  getTargetURL() {
    throw new Error(
      `${this.constructor.name}.getTargetURL() must be implemented.`,
    );
  }

  getCSS() {
    return "";
  }

  getWISPURL() {
    return getWispUrl();
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
      appId: this.getAppId(),
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

    await this.initScramjet(null, null, win, {});
    this.bindPopupBridge(win);
    return win;
  }

  getAppId() {
    return "scramjet-base";
  }

  getAppName() {
    return "Scramjet App";
  }

  getAppIcon() {
    return resolveIconUrl("static/icons/chrome.webp");
  }

  getHTMLPath() {
    return `/sapps/set-template.html`;
  }

  async initScramjet(payload, vt, element, state) {
    if (isFileProtocol()) {
      const container = element.querySelector(".scramjet-base-container");
      if (container) {
        try {
          await mountFileProtocolView(container, {
            targetUrl: this.getTargetURL(),
            appId: this.getAppId(),
            showChrome: false,
          });
        } catch {
          await injectFileProtocolFallback(
            container,
            this.getAppId(),
            this.getTargetURL(),
          );
        }
      }
      return;
    }
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
          ").",
      );
    }
    this.iframe = element.querySelector(`#${this.getAppId()}-iframe`);
    const wispUrl = this.getWISPURL();
    const targetUrl = this.getTargetURL();
    this.iframe.src =
      window.location.origin +
      this.getHTMLPath() +
      `?wisp=${encodeURIComponent(wispUrl)}&target=${encodeURIComponent(targetUrl)}`;
  }

  cleanupScramjet() {
    if (this.winId) {
      os.window.removeFromTaskbar(this.winId);
    }
    this.iframe = null;
    this.scramjetController = null;
  }
}
