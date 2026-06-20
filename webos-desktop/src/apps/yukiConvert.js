import { openFileConverter } from "../utils/fileConverter.js";

import { BaseApp, PersistenceTypes, os } from "../framework.js";
export class YukiConvertApp extends BaseApp {
  constructor(services) {
    super(services);
    this.openWindows = new Set();
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
          ui: `<div class="window-content yuki-convert-landing">

        <div id="yuki-convert-main-view" class="yuki-convert-landing-view">
          <div class="yuki-convert-icon-box">
            <i class="fas fa-exchange-alt"></i>
          </div>
          <h2 class="yuki-convert-landing-title">Yuki Convert</h2>
          <p class="yuki-convert-landing-desc">
            Easily batch convert images, audio, video, structured data, and documents directly in your browser without any server uploads.
          </p>
          
          <div class="yuki-convert-btn-row">
            <button id="yuki-convert-btn-local" class="yuki-convert-btn-primary">
              <i class="fas fa-laptop"></i> From Device
            </button>
            <button id="yuki-convert-btn-yuki" class="yuki-convert-btn-secondary">
              <i class="fas fa-folder-open"></i> Browse Yuki OS
            </button>
          </div>
        </div>

        <div id="yuki-convert-loading-view" class="yuki-convert-loading-view">
          <i class="fas fa-spinner fa-spin"></i>
          <div class="yuki-convert-loading-text">Importing files to virtual filesystem...</div>
        </div>

        <input type="file" id="yuki-convert-file-input" class="yuki-convert-file-input" multiple>
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
          selectedFiles: [],
          services: null
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
          os.app.launch("explorerApp");
          os.notify.send(
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

          try {
            const exists = await os.fs.exists(path);
            if (!exists) {
              await os.fs.mkdir(path);
            } else {
              const isFile = await os.fs.isFile(path);
              if (isFile) {
                await os.fs.delete(path);
                await os.fs.mkdir(path);
              }
            }
          } catch (e) {
            await os.fs.mkdir(path);
          }

          for (const file of files) {
            await os.fs.writeBinaryFile(path, file.name, file);
            fileNames.push(file.name);
          }

          if (win) {
            const closeBtn = win.querySelector(".close-btn");
            if (closeBtn) closeBtn.click();
          }

          for (const fileName of fileNames) {
            openFileConverter(fileName, path, state.services);
          }
        }
      },
      onMount: "initYukiConvert"
    };
  }

  initYukiConvert(payload, event, element, state) {
    state.services = this._services;
    this.mainView = document.getElementById("yuki-convert-main-view");
    this.loadingView = document.getElementById("yuki-convert-loading-view");
    this.fileInput = document.getElementById("yuki-convert-file-input");
    this.btnLocal = document.getElementById("yuki-convert-btn-local");
    this.btnYuki = document.getElementById("yuki-convert-btn-yuki");
  }
}
