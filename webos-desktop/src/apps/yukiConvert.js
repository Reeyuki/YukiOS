import { openFileConverter } from "../utils/fileConverter.js";

import { BaseApp, os } from "../framework.js";
export class YukiConvertApp extends BaseApp {
  constructor(services) {
    super(services);
    this.openWindows = new Set();
  }

  open() {
    const win = os.window.create("yuki-convert", "Yuki Convert", "540px", "420px", { icon: "fas fa-exchange-alt" });
    win.innerHTML = `<div class="window-content yuki-convert-landing">

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
              <i class="fas fa-folder-open"></i> Browse YukiOS
            </button>
          </div>
        </div>

        <div id="yuki-convert-loading-view" class="yuki-convert-loading-view">
          <i class="fas fa-spinner fa-spin"></i>
          <div class="yuki-convert-loading-text">Importing files to virtual filesystem...</div>
        </div>

        <input type="file" id="yuki-convert-file-input" class="yuki-convert-file-input" multiple>
      </div>`;

    const mainView = win.querySelector("#yuki-convert-main-view");
    const loadingView = win.querySelector("#yuki-convert-loading-view");
    const fileInput = win.querySelector("#yuki-convert-file-input");
    const btnLocal = win.querySelector("#yuki-convert-btn-local");
    const btnYuki = win.querySelector("#yuki-convert-btn-yuki");

    btnLocal.addEventListener("click", (e) => {
      e.stopPropagation();
      fileInput.click();
    });

    btnYuki.addEventListener("click", (e) => {
      e.stopPropagation();
      const closeBtn = win.querySelector(".close-btn");
      if (closeBtn) closeBtn.click();
      os.app.launch("explorerApp");
      os.notify.send(
        "Yuki Convert",
        "Select one or more files, right-click, and choose 'Convert / Transform...'",
        "info",
        5000,
        "fas fa-exchange-alt"
      );
    });

    fileInput.addEventListener("change", async (e) => {
      const files = Array.from(fileInput.files);
      if (files.length === 0) return;

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

      const closeBtn = win.querySelector(".close-btn");
      if (closeBtn) closeBtn.click();

      for (const fileName of fileNames) {
        openFileConverter(fileName, path, this.os);
      }
    });
  }
}
