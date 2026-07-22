import { BaseApp, os } from "../framework.js";

export class BtopApp extends BaseApp {
  constructor(services) {
    super(services);
  }

  open(opts) {
    const terminalApp = os.app.getInstance("terminalApp");
    if (!terminalApp) {
      os.dialog.alert("btop", "Terminal app is not available");
      return;
    }
    terminalApp.open({ autoCommand: "btop" });
  }

  onClose(winId) {}
}
