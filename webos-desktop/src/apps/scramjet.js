import { BaseApp } from "../core/BaseApp.js";
import { os } from "../os/index.js";
import { getRepoUrl } from "../shared/cdnConfig.js";
import { fetchHtmlAsBlobUrl } from "../shared/assetResolver.js";
import { PersistenceTypes } from "../runtime/AppSchema.js";

export class ScramjetApp extends BaseApp {
  constructor(services) {
    super(services);
    this.iframe = null;
  }

  getDeclarativeSchema(opts) {
    return {
      id: "scramjet",
      name: "Scramjet Browser",
      icon: "fas fa-globe",
      windows: [
        {
          id: "scramjet-window",
          title: "Scramjet Browser",
          size: ["1024px", "768px"],
          icon: "fas fa-globe",
          ui: `
            <div class="scramjet-container" style="width:100%;height:100%;overflow:hidden;">
              <iframe
                id="scramjet-iframe"
                style="width:100%;height:100%;border:none;"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation-by-user-activation"
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

  async initScramjet(payload, vt, element, state) {
    this.iframe = element.querySelector("#scramjet-iframe");

    const scramUrl = getRepoUrl("main", "/static/apps/scram/index.html");

    try {
      const blobUrl = await fetchHtmlAsBlobUrl(scramUrl);
      this.iframe.src = blobUrl;
    } catch (err) {
      console.error("Failed to fetch scramjet HTML:", err);
      this.iframe.src = scramUrl;
    }

    setTimeout(() => {
      const header = element.querySelector(".window-header");
      if (header) {
        const titleSpan = header.querySelector("span");
        if (titleSpan) {
          const currentHTML = titleSpan.innerHTML;
          if (currentHTML.includes("[object Object]")) {
            titleSpan.innerHTML = currentHTML.replace("[object Object]", "Scramjet").trim();
          }
        }
      }
    }, 100);
  }

  open(title = "Scramjet Browser") {
    if (this._isSingletonOpen(this.winId)) return;
    this.winId = `scramjet-${Date.now()}`;
    const schema = this.getDeclarativeSchema();
    const windowConfig = schema.windows[0];
    this.win = os.window.create(this.winId, title, windowConfig.size[0], windowConfig.size[1], {
      icon: windowConfig.icon,
      autoMount: true
    });
    this.win.innerHTML = windowConfig.ui;
    os.window.focus(this.win);
    this.initScramjet(null, null, this.win, {});
  }

  cleanupScramjet() {
    this.iframe = null;
  }
}
