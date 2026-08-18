import { BaseApp, os, ServiceKeys } from "../framework.js";

export class LavatApp extends BaseApp {
  constructor(services) {
    super(services);
  }

  open(opts) {
    const terminalApp = os.app.getInstance(ServiceKeys.TERMINAL);
    if (!terminalApp) {
      os.dialog.alert("Lavat", "Terminal app is not available");
      return;
    }
    terminalApp.open({ autoCommand: "lavat" });
  }

  onClose(winId) {}
}
