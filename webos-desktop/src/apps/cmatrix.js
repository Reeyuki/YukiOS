import { BaseApp, os, ServiceKeys } from "../framework.js";

export class CmatrixApp extends BaseApp {
  constructor(services) {
    super(services);
  }

  open(opts) {
    const terminalApp = os.app.getInstance(ServiceKeys.TERMINAL);
    if (!terminalApp) {
      os.dialog.alert("Cmatrix", "Terminal app is not available");
      return;
    }
    terminalApp.open({ autoCommand: "cmatrix" });
  }

  onClose(winId) {}
}
