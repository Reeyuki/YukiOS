import { BaseApp, os } from "../framework.js";

export class CmatrixApp extends BaseApp {
  constructor(services) {
    super(services);
  }

  open(opts) {
    const terminalApp = os.app.getInstance("terminalApp");
    if (!terminalApp) {
      os.dialog.alert("Cmatrix", "Terminal app is not available");
      return;
    }
    terminalApp.open({ autoCommand: "cmatrix" });
  }

  onClose(winId) {}
}
