import { BaseApp } from "./core/BaseApp.js";
import { openFileConverter } from "./utils/fileConverter.js";
export class YukiConvertApp extends BaseApp {
  constructor(services) {
    super(services);
    this.openWindows = new Set();
  }

  open(options = {}) {
    const winId = `yuki-convert-${Date.now()}`;
    const win = this.wm.createWindow(winId, "Yuki Convert", 540, 420);

    win.innerHTML = `
      <div class="window-header">
        <div class="window-title">
          <i class="fas fa-exchange-alt window-title-icon" style="color: white; font-size: 14px; margin-right: 8px;"></i>
          Yuki Convert
        </div>
        <div class="window-controls">
          <button class="minimize-btn"><i class="fas fa-minus"></i></button>
          <button class="maximize-btn"><i class="far fa-square"></i></button>
          <button class="close-btn"><i class="fas fa-times"></i></button>
        </div>
      </div>
      <div class="window-content" style="background: rgba(18, 18, 24, 0.85); backdrop-filter: blur(12px); color: #fff; padding: 30px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; height: 100%; box-sizing: border-box;">
        
        <div id="${winId}-main-view" style="display: flex; flex-direction: column; align-items: center; width: 100%;">
          <div style="background: var(--brand); width: 64px; height: 64px; border-radius: 16px; display: flex; align-items: center; justify-content: center; margin-bottom: 24px; box-shadow: 0 8px 24px var(--brand-glow);">
            <i class="fas fa-exchange-alt" style="font-size: 32px; color: white;"></i>
          </div>
          <h2 style="margin: 0 0 12px 0; font-weight: 600; font-size: 22px;">Welcome to Yuki Convert</h2>
          <p style="color: rgba(255, 255, 255, 0.6); font-size: 14px; margin-bottom: 36px; max-width: 85%; line-height: 1.5;">
            Easily batch convert images, structured data, and documents directly in your browser without any server uploads.
          </p>
          
          <div style="display: flex; gap: 16px; width: 100%; justify-content: center;">
            <button id="${winId}-btn-local" style="background: var(--brand); border: none; border-radius: 8px; color: white; padding: 12px 24px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; gap: 8px; flex: 1; max-width: 200px; justify-content: center;">
              <i class="fas fa-laptop"></i> From Device
            </button>
            <button id="${winId}-btn-yuki" style="background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 8px; color: white; padding: 12px 24px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; gap: 8px; flex: 1; max-width: 200px; justify-content: center;">
              <i class="fas fa-folder-open"></i> Browse Yuki OS
            </button>
          </div>
        </div>

        <div id="${winId}-loading-view" style="display: none; flex-direction: column; align-items: center; width: 100%;">
          <i class="fas fa-spinner fa-spin" style="font-size: 32px; color: var(--brand); margin-bottom: 16px;"></i>
          <div style="font-size: 14px; color: rgba(255, 255, 255, 0.8);">Importing files to virtual filesystem...</div>
        </div>

        <input type="file" id="${winId}-file-input" style="display: none;" multiple>
      </div>
    `;

    document.body.appendChild(win);
    this.wm.mountWindow(win, winId, "Yuki Convert", "fas fa-exchange-alt");
    this.openWindows.add(winId);

    const btnLocal = win.querySelector(`#${winId}-btn-local`);
    const btnYuki = win.querySelector(`#${winId}-btn-yuki`);
    const fileInput = win.querySelector(`#${winId}-file-input`);
    const mainView = win.querySelector(`#${winId}-main-view`);
    const loadingView = win.querySelector(`#${winId}-loading-view`);

    btnLocal.onmouseover = () => {
      btnLocal.style.transform = "translateY(-1px)";
    };
    btnLocal.onmouseout = () => {
      btnLocal.style.transform = "none";
    };

    btnYuki.onmouseover = () => {
      btnYuki.style.background = "rgba(255, 255, 255, 0.1)";
    };
    btnYuki.onmouseout = () => {
      btnYuki.style.background = "rgba(255, 255, 255, 0.06)";
    };

    btnLocal.onclick = () => fileInput.click();

    fileInput.onchange = async (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;

      mainView.style.display = "none";
      loadingView.style.display = "flex";

      const path = ["Downloads"];
      const fileNames = [];

      for (const file of files) {
        await this.fs.writeBinaryFile(path, file.name, file);
        fileNames.push(file.name);
      }

      win.querySelector(".close-btn").click();
      openFileConverter(fileNames, path, this._services);
    };

    btnYuki.onclick = () => {
      win.querySelector(".close-btn").click();
      window.appLauncher.launch("explorer");
      this.notify(
        "Yuki Convert",
        "Select one or more files, right-click, and choose 'Convert / Transform...'",
        "info",
        5000
      );
    };
  }

  onClose(winId) {
    this.openWindows.delete(winId);
  }
}
