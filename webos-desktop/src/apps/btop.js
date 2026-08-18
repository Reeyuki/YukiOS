import { BaseApp, os, ServiceKeys } from "../framework.js";

export class BtopApp extends BaseApp {
  constructor(services) {
    super(services);
  }

  open(opts) {
    const terminalApp = os.app.getInstance(ServiceKeys.TERMINAL);
    if (!terminalApp) {
      os.dialog.alert("btop", "Terminal app is not available");
      return;
    }
    terminalApp.open({ autoCommand: "btop" });
  }

  onClose(winId) {}
}
