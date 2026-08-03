import { Achievements } from "../achievements.js";
import { CDN_BASES } from "../shared/assetResolver.js";
import { CDN_CONFIG } from "../shared/cdnConfig.js";
import { BusEvents, BaseApp, os } from "../framework.js";
import { getLibraryUrl } from "../shared/cdnConfig.js";
import {
  normalizePath,
  fileNameToDisplayName,
  buildLoadingStateHTML,
  buildErrorHTML,
  setLog,
  renderEmulatorFileList,
  handleEmulatorUpload
} from "../shared/emulatorBase.js";
const FLASH_DIR = ["Flash"];
const DESKTOP_DIR = ["Desktop"];

export class RuffleApp extends BaseApp {
  constructor(services) {
    super(services);
    this.ruffleLoadPromise = null;
  }

  open(opts) {
    const win = os.window.create("ruffle-win", "Ruffle", "800px", "600px", {
      icon: "static/icons/ruffle.webp"
    });
    win.innerHTML = `
      <div class="emu-shell ruf-container">
        <div class="emu-header ruf-header">
          <i class="fa-solid fa-film emu-header-icon ruf-icon-main"></i>
          <div class="emu-header-text">
            <div class="emu-title ruf-title">Ruffle</div>
            <div class="emu-subtitle ruf-subtitle">Flash emulator powered by Ruffle</div>
          </div>
        </div>
        
        <div id="ruffle-upload-zone" class="emu-upload-zone ruf-upload-zone">
          <i class="fa-solid fa-file-arrow-up emu-upload-icon ruf-upload-icon"></i>
          <div class="emu-upload-text ruf-upload-text">Drop a SWF file or click to browse</div>
          <div class="emu-upload-subtext ruf-upload-subtext">Supported format: .swf</div>
          <input type="file" id="ruffle-file-input" class="emu-file-input" accept=".swf" multiple>
        </div>
        
        <div class="emu-section-title ruf-section-title">My Flash Files</div>
        <div id="ruffle-user-files" class="emu-grid ruf-file-grid"></div>
      </div>`;

    const uploadZone = win.querySelector("#ruffle-upload-zone");
    const fileInput = win.querySelector("#ruffle-file-input");

    uploadZone?.addEventListener("click", () => fileInput?.click());
    uploadZone?.addEventListener("dragover", (e) => {
      e.preventDefault();
      uploadZone.classList.add("emu-upload-zone--dragover");
    });
    uploadZone?.addEventListener("dragleave", () => {
      uploadZone.classList.remove("emu-upload-zone--dragover");
    });
    uploadZone?.addEventListener("drop", async (e) => {
      e.preventDefault();
      uploadZone.classList.remove("emu-upload-zone--dragover");
      const files = Array.from(e.dataTransfer.files).filter((f) => f.name.toLowerCase().endsWith(".swf"));
      if (files.length > 0) await this.handleUploadedFiles(files, uploadZone);
    });

    fileInput?.addEventListener("change", async () => {
      const files = Array.from(fileInput.files);
      if (files.length > 0) await this.handleUploadedFiles(files, uploadZone);
      fileInput.value = "";
    });

    this.loadUserFiles();
    if (window.FontAwesome && window.FontAwesome.dom && window.FontAwesome.dom.i2svg) {
      const container = win.querySelector(".ruf-container");
      if (container) {
        window.FontAwesome.dom.i2svg({ node: container });
      }
    }
  }

  async loadUserFiles() {
    renderEmulatorFileList({
      container: document.getElementById("ruffle-user-files"),
      dir: FLASH_DIR,
      filter: (f) => f.toLowerCase().endsWith(".swf"),
      emptyHTML: `<div class="emu-empty ruf-empty">No Flash files uploaded yet.</div>`,
      cardHTML: (f) => `
            <div class="emu-card ruf-file-card emu-card--removable" data-user-file="${f}">
              <i class="fa-solid fa-film emu-card-icon ruf-file-icon"></i>
              <div class="emu-card-body ruf-file-info">
                <div class="emu-card-title ruf-file-name">${fileNameToDisplayName(f)}</div>
                <div class="emu-card-meta ruf-file-type">SWF • Flash</div>
              </div>
              <button class="emu-delete-btn ruf-delete-btn" data-file="${f}" title="Delete">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
          `,
      cardSelector: ".ruf-file-card",
      deleteBtnSelector: ".ruf-delete-btn",
      deleteAction: (name) => os.fs.deleteBinaryFile(FLASH_DIR, name),
      onCardClick: (fileName) => this.launchSWF(fileName, FLASH_DIR),
      onReload: () => this.loadUserFiles()
    });
  }

  async handleUploadedFiles(files, zone) {
    handleEmulatorUpload({
      zone,
      files,
      dir: FLASH_DIR,
      kind: "other",
      icon: CDN_BASES.MAIN + "/static/icons/ruffle.webp",
      extraDirs: [{ dir: DESKTOP_DIR }],
      emitChanged: true,
      spinnerHTML: `<i class="fa-solid fa-spinner fa-spin emu-state-icon ruf-state-icon"></i><div class="emu-state-text ruf-state-text">Saving ${files.length} file(s)...</div>`,
      successHTML: `<i class="fa-solid fa-circle-check emu-state-icon ruf-state-icon"></i><div class="emu-state-text ruf-state-text">Saved ${files.length} file(s)!</div>`,
      errorHTML: (msg) =>
        `<i class="fa-solid fa-triangle-exclamation emu-state-icon ruf-state-icon emu-state--error"></i><div class="emu-state-text ruf-state-text emu-state--error">${msg}</div>`,
      onSaved: () => os.notify.send(`Saved ${files.length} file(s) to Flash.`),
      onReload: () => this.loadUserFiles()
    });
  }

  async launchSWF(fileName, path) {
    const normalizedPath = normalizePath(path);

    try {
      const blob = await os.fs.read([...normalizedPath, fileName]);
      if (!blob || blob.size === 0) {
        os.notify.send("Couldn't read that SWF file.");
        return;
      }

      const arrayBuffer = await blob.arrayBuffer();
      const displayName = fileNameToDisplayName(fileName);

      this.launchRuffle(displayName, fileName, arrayBuffer);
    } catch (e) {
      os.notify.send(`SWF wouldn't load: ${e.message}`);
    }
  }

  async launchRuffle(displayName, fileName, swfData) {
    const winId = `ruffle-${Date.now()}`;
    const win = os.window.create(winId, displayName, "800px", "600px", {
      icon: "static/icons/ruffle.webp"
    });

    os.events.emit(BusEvents.ACHIEVEMENT_TRIGGER, { achievementId: Achievements.Flashback });
    win.innerHTML = `
    <div class="window-content emu-window ruf-window">
      ${buildLoadingStateHTML({
        winId,
        iconClass: "fa-solid fa-film fa-spin ruf-state-icon emu-state-icon",
        wrapperClass: "emu-state ruf-loading emu-load-wrap",
        textClass: "emu-state-text ruf-state-text",
        logClass: "emu-state-text--muted ruf-log",
        displayName
      })}
      <iframe
        id="${winId}-frame"
        class="emu-iframe"
        sandbox="allow-scripts allow-same-origin"
      ></iframe>
    </div>`;

    const inner = win.querySelector(`#${winId}-inner`);
    const frame = win.querySelector(`#${winId}-frame`);
    const log = win.querySelector(`#${winId}-log`);

    const showError = (msg) => {
      if (inner)
        inner.innerHTML = buildErrorHTML({
          msg,
          wrapperClass: "emu-state emu-state--error ruf-error",
          iconClass: "fa-solid fa-triangle-exclamation ruf-state-icon emu-state-icon emu-state--error",
          textClass: "emu-state-text ruf-state-text emu-state--error"
        });
      inner.style.display = "flex";
      frame.style.display = "none";
    };

    try {
      setLog(log, "Starting Ruffle...");
      await this.loadRuffleScript();

      setLog(log, "Starting Flash player...");

      const ruffleScriptUrl =
        getLibraryUrl("ruffle") ||
        `${CDN_CONFIG.repos.npm.base}/@ruffle-rs/ruffle@${CDN_CONFIG.libraries.ruffle.version}/ruffle.min.js`;

      const swfBlob = new Blob([swfData], { type: "application/x-shockwave-flash" });
      const swfUrl = URL.createObjectURL(swfBlob);

      const iframeDoc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; background: #000; overflow: hidden; }
    ruffle-player { width: 100%; height: 100%; display: block; }
  </style>
</head>
<body>
  <script src="${ruffleScriptUrl}"><\/script>
  <script>
    window.addEventListener("load", function () {
      var ruffle = window.RufflePlayer.newest();
      var player = ruffle.createPlayer();
      player.style.width = "100%";
      player.style.height = "100%";
      document.body.appendChild(player);
      player.load("${swfUrl}");
    });
  <\/script>
</body>
</html>`;

      const iframeBlob = new Blob([iframeDoc], { type: "text/html" });
      const iframeUrl = URL.createObjectURL(iframeBlob);

      frame.onload = () => {
        URL.revokeObjectURL(iframeUrl);
      };

      inner.style.display = "none";
      frame.style.display = "block";
      frame.src = iframeUrl;

      const observer = new MutationObserver(() => {
        if (!document.contains(win)) {
          URL.revokeObjectURL(swfUrl);
          observer.disconnect();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    } catch (e) {
      showError(`Failed to start: ${e.message}`);
    }
  }

  loadRuffleScript() {
    if (this.ruffleLoadPromise) return this.ruffleLoadPromise;

    this.ruffleLoadPromise = (async () => {
      if (__SINGLE_FILE__) {
        await import("@ruffle-rs/ruffle");
        return;
      }

      return new Promise((resolve, reject) => {
        if (window.RufflePlayer) {
          resolve();
          return;
        }

        const script = document.createElement("script");
        script.src =
          getLibraryUrl("ruffle") ||
          `${CDN_CONFIG.repos.npm.base}/@ruffle-rs/ruffle@${CDN_CONFIG.libraries.ruffle.version}/ruffle.min.js`;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Failed to load Ruffle"));
        document.head.appendChild(script);
      });
    })();

    return this.ruffleLoadPromise;
  }

  async launchFromFile(file) {
    if (!file.name.toLowerCase().endsWith(".swf")) {
      os.notify.send("Ruffle only works with .swf files.", "", { icon: "static/icons/ruffle.webp" });
      return;
    }
    const arrayBuffer = await file.arrayBuffer();
    const displayName = fileNameToDisplayName(file.name);

    this.launchRuffle(displayName, file.name, arrayBuffer);
  }
}
