import { BaseApp, os } from "../framework.js";
import { mountShortcutsPanel } from "../shared/shortcutsPanel.js";

export class ShortcutsApp extends BaseApp {
  singletonWindowIds = ["shortcuts-app"];

  constructor(services) {
    super(services);
    this.panelHandle = null;
  }

  open() {
    const win = os.window.create("shortcuts-app", "Keyboard Shortcuts", "820px", "620px", {
      icon: "fa fa-keyboard"
    });
    this.panelHandle?.destroy();
    this.panelHandle = mountShortcutsPanel(win);
    win.addEventListener("remove", () => {
      this.panelHandle?.destroy();
      this.panelHandle = null;
    });
  }

  onClose(winId) {
    this.panelHandle?.destroy();
    this.panelHandle = null;
  }
}
