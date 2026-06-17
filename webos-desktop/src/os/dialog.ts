/**
 * Dialog API
 * Wraps shared dialog utilities and Explorer file dialogs into a clean OS-level API
 */

import { showAlert, showPrompt, showConfirm } from "../shared/dialogs.js";

export interface FileDialogOptions {
  defaultFileName?: string;
  initialPath?: string;
}

export class DialogAPI {
  private explorerApp: any = null;

  setExplorerApp(app: any): void {
    this.explorerApp = app;
  }

  async alert(title: string, message: string): Promise<void> {
    await showAlert(title, message);
  }

  async confirm(title: string, message: string): Promise<boolean> {
    return await showConfirm(title, message);
  }

  async prompt(title: string, message: string, defaultValue?: string): Promise<string | null> {
    return await showPrompt(title, message, defaultValue ?? "");
  }

  async fileOpen(options?: FileDialogOptions): Promise<string | null> {
    if (!this.explorerApp) return null;
    return new Promise((resolve) => {
      this.explorerApp.open(options?.initialPath ?? ["Home"], (selectedPath: string) => {
        resolve(selectedPath);
      });
    });
  }

  async fileSave(options?: FileDialogOptions): Promise<string | null> {
    if (!this.explorerApp) return null;
    return new Promise((resolve) => {
      this.explorerApp.openSaveDialog(options?.defaultFileName ?? "untitled", (path: string[], filename: string) => {
        const fullPath = path.join("/");
        resolve(`${fullPath}/${filename}`);
      });
    });
  }

  async openDirectory(options?: FileDialogOptions): Promise<string | null> {
    if (!this.explorerApp) return null;
    return new Promise((resolve) => {
      this.explorerApp.openDirectoryDialog((path: string[]) => {
        if (!path || path.length === 0) {
          resolve(null);
          return;
        }
        resolve(path.join("/"));
      });
    });
  }
}
