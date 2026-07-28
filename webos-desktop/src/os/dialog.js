import { showAlert, showPrompt, showConfirm } from "../shared/dialogs.js";

export class DialogAPI {
  constructor() {
    this.explorerApp = null;
  }

  setExplorerApp(app) {
    this.explorerApp = app;
  }

  async alert(title, message) {
    await showAlert(title, message);
  }

  async confirm(title, message) {
    return await showConfirm(title, message);
  }

  async prompt(title, message, defaultValue) {
    return await showPrompt(title, message, defaultValue ?? "");
  }

  async fileOpen(options) {
    if (!this.explorerApp) return null;
    return new Promise((resolve) => {
      this.explorerApp.open(options?.initialPath ?? ["Home"], (path, name) => {
        resolve(`${path.join("/")}/${name}`);
      });
    });
  }

  async fileSave(options) {
    if (!this.explorerApp) return null;
    return new Promise((resolve) => {
      this.explorerApp.openSaveDialog(options?.defaultFileName ?? "untitled", (path, filename) => {
        const fullPath = path.join("/");
        resolve(`${fullPath}/${filename}`);
      });
    });
  }

  async openDirectory(options) {
    if (!this.explorerApp) return null;
    return new Promise((resolve) => {
      this.explorerApp.openDirectoryDialog((path) => {
        if (!path || path.length === 0) {
          resolve(null);
          return;
        }
        resolve(path.join("/"));
      });
    });
  }
}
