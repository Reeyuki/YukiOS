import { BaseApp } from "./core/BaseApp.js";
import { openFileConverter } from "./utils/fileConverter.js";
import { PersistenceTypes } from "./runtime/AppSchema.js";

export class YukiConvertApp extends BaseApp {
  constructor(services) {
    super(services);
    this.openWindows = new Set();
    this._declarativeApp = null;
  }

  getDeclarativeSchema(opts) {
    return {
      id: "yuki-convert",
      name: "Yuki Convert",
      icon: "fas fa-exchange-alt",
      windows: [
        {
          id: "yuki-convert",
          title: "Yuki Convert",
          size: ["540px", "420px"],
          icon: "fas fa-exchange-alt",
          ui: `<div class="window-content" style="background: rgba(18, 18, 24, 0.85); backdrop-filter: blur(12px); color: #fff; padding: 30px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; height: 100%; box-sizing: border-box;">
        
        <div id="yuki-convert-main-view" style="display: flex; flex-direction: column; align-items: center; width: 100%;">
          <div style="background: var(--brand); width: 64px; height: 64px; border-radius: 16px; display: flex; align-items: center; justify-content: center; margin-bottom: 24px; box-shadow: 0 8px 24px var(--brand-glow);">
            <i class="fas fa-exchange-alt" style="font-size: 32px; color: white;"></i>
          </div>
          <h2 style="margin: 0 0 12px 0; font-weight: 600; font-size: 22px;">Welcome to Yuki Convert</h2>
          <p style="color: rgba(255, 255, 255, 0.6); font-size: 14px; margin-bottom: 36px; max-width: 85%; line-height: 1.5;">
            Easily batch convert images, audio, video, structured data, and documents directly in your browser without any server uploads.
          </p>
          
          <div style="display: flex; gap: 16px; width: 100%; justify-content: center;">
            <button id="yuki-convert-btn-local" style="background: var(--brand); border: none; border-radius: 8px; color: white; padding: 12px 24px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; gap: 8px; flex: 1; max-width: 200px; justify-content: center;">
              <i class="fas fa-laptop"></i> From Device
            </button>
            <button id="yuki-convert-btn-yuki" style="background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 8px; color: white; padding: 12px 24px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; gap: 8px; flex: 1; max-width: 200px; justify-content: center;">
              <i class="fas fa-folder-open"></i> Browse Yuki OS
            </button>
          </div>
        </div>

        <div id="yuki-convert-loading-view" style="display: none; flex-direction: column; align-items: center; width: 100%;">
          <i class="fas fa-spinner fa-spin" style="font-size: 32px; color: var(--brand); margin-bottom: 16px;"></i>
          <div style="font-size: 14px; color: rgba(255, 255, 255, 0.8);">Importing files to virtual filesystem...</div>
        </div>

        <input type="file" id="yuki-convert-file-input" style="display: none;" multiple>
      </div>`,
          events: {
            "#yuki-convert-btn-local": {
              click: {
                type: "custom:selectLocalFiles",
                stopPropagation: true
              }
            },
            "#yuki-convert-btn-yuki": {
              click: {
                type: "custom:browseYukiOS",
                stopPropagation: true
              }
            },
            "#yuki-convert-file-input": {
              change: {
                type: "custom:handleFileInput",
                stopPropagation: false
              }
            }
          }
        }
      ],
      state: {
        initial: {
          selectedFiles: []
        },
        persistence: PersistenceTypes.NONE
      },
      actions: {
        selectLocalFiles(payload, event, element, state) {
          const fileInput = document.getElementById("yuki-convert-file-input");
          if (fileInput) fileInput.click();
        },
        browseYukiOS(payload, event, element, state) {
          const win = document.querySelector("#yuki-convert");
          if (win) {
            const closeBtn = win.querySelector(".close-btn");
            if (closeBtn) closeBtn.click();
          }
          this._services.appLauncher.launch("explorer");
          this.notify(
            "Yuki Convert",
            "Select one or more files, right-click, and choose 'Convert / Transform...'",
            "info",
            5000,
            "fas fa-exchange-alt"
          );
        },
        async handleFileInput(payload, event, element, state) {
          const files = Array.from(element.files);
          if (files.length === 0) return;

          const mainView = document.getElementById("yuki-convert-main-view");
          const loadingView = document.getElementById("yuki-convert-loading-view");
          const win = document.querySelector("#yuki-convert");

          if (mainView) mainView.style.display = "none";
          if (loadingView) loadingView.style.display = "flex";

          const path = ["Downloads"];
          const fileNames = [];

          for (const file of files) {
            await this.fs.writeBinaryFile(path, file.name, file);
            fileNames.push(file.name);
          }

          if (win) {
            const closeBtn = win.querySelector(".close-btn");
            if (closeBtn) closeBtn.click();
          }

          for (const fileName of fileNames) {
            openFileConverter(fileName, path, this._services);
          }
        }
      },
      onMount: "initYukiConvert"
    };
  }

  initYukiConvert(payload, event, element, state) {
    this.mainView = document.getElementById("yuki-convert-main-view");
    this.loadingView = document.getElementById("yuki-convert-loading-view");
    this.fileInput = document.getElementById("yuki-convert-file-input");
    this.btnLocal = document.getElementById("yuki-convert-btn-local");
    this.btnYuki = document.getElementById("yuki-convert-btn-yuki");
  }

  open() {
    if (this._isSingletonOpen("yuki-convert")) return;
  }

  onClose(winId) {
    this.openWindows.delete(winId);
  }
}
