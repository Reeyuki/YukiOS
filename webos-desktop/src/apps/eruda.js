import { BaseApp, os } from "../framework.js";

export class ErudaApp extends BaseApp {
  constructor(services) {
    super(services);
    this.openWindows = new Set();
  }

  async open() {
    const winId = "eruda";
    if (this.openWindows.has(winId)) return;

    const win = os.window.create(winId, "Dev Tools (Eruda)", "450px", "400px", {
      icon: "fas fa-code"
    });

    win.innerHTML = this.buildUI();
    this.openWindows.add(winId);

    await this.initEruda();

    win.addEventListener("remove", () => {
      this.openWindows.delete(winId);
    });
  }

  buildUI() {
    return `
      <div class="window-content" style="padding: 0; height: 100%; overflow: hidden;">
        <div id="eruda-container" style="width: 100%; height: 100%;"></div>
      </div>
    `;
  }

  async initEruda() {
    const container = document.getElementById("eruda-container");
    if (container) {
      const eruda = await import("eruda");
      eruda.default.init({
        container: container
      });
      eruda.default.show();
      os.notify.send("Dev Tools", "Eruda debugging tool launched");
    }
  }

  onClose(winId) {
    this.openWindows.delete(winId);
  }
}
