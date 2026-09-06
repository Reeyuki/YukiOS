import { Achievements } from "../achievements.js";
import { CDN_BASES } from "../shared/assetResolver.js";
import { CDN_CONFIG } from "../shared/cdnConfig.js";
import { BusEvents, BaseApp, os, $, createElement } from "../framework.js";
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
import { buildPlayerConfig, loadRuffleConfig, saveRuffleConfig } from "../ruffle/ruffleSettings.js";
import { renderSelectMenu, getSelectMenuValue, setSelectMenuValue, bindSelectMenu } from "../shared/selectMenu.js";
const FLASH_DIR = ["Flash"];
const DESKTOP_DIR = ["Desktop"];

export class RuffleApp extends BaseApp {
  singletonWindowIds = ["ruffle-win"];

  constructor(services) {
    super(services);
    this.ruffleLoadPromise = null;
  }

  async open(opts) {
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
          <button id="ruffle-open-settings" class="settings-btn" title="Ruffle Settings" style="margin-left:auto;"><i class="fas fa-cog"></i></button>
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

    win.querySelector("#ruffle-open-settings")?.addEventListener("click", () => this.openRuffleSettingsPanel(win));

    this.loadUserFiles();
    if (window.FontAwesome && window.FontAwesome.dom && window.FontAwesome.dom.i2svg) {
      const container = win.querySelector(".ruf-container");
      if (container) {
        window.FontAwesome.dom.i2svg({ node: container });
      }
    }
  }

  openRuffleSettingsPanel(anchorWin) {
    const cfg = loadRuffleConfig();
    const existing = document.getElementById("ruffle-settings-panel");
    if (existing) existing.remove();
    const panel = createElement("div", { id: "ruffle-settings-panel" });
    panel.style.cssText =
      "position:absolute;top:56px;right:12px;z-index:5;width:min(360px,calc(100% - 24px));max-height:min(70vh,calc(100% - 68px));overflow:auto;background:var(--glass);border:1px solid var(--glass-border);border-radius:12px;box-shadow:var(--shadow-depth);backdrop-filter:blur(32px);-webkit-backdrop-filter:blur(32px);display:flex;flex-direction:column;box-sizing:border-box;scrollbar-width:thin;";
    panel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;flex-shrink:0;position:sticky;top:0;background:var(--glass);border-bottom:1px solid var(--glass-border);border-radius:12px 12px 0 0;z-index:1;backdrop-filter:blur(32px);-webkit-backdrop-filter:blur(32px);">
        <strong style="font-size:14px;color:var(--text-primary);">Ruffle Settings</strong>
        <button id="ruffle-settings-close" class="settings-btn" style="padding:4px 8px;flex-shrink:0;"><i class="fas fa-xmark"></i></button>
      </div>
      <div style="padding:12px;display:flex;flex-direction:column;gap:12px;box-sizing:border-box;">
      <div class="settings-row" style="flex-direction:column;align-items:stretch;gap:8px;">
        <span class="settings-label-title" style="font-size:13px;">Letterbox</span>
        ${renderSelectMenu(
          "rufflePanelLetterbox",
          [
            { value: "off", label: "Off" },
            { value: "on", label: "On" },
            { value: "fullscreen", label: "Fullscreen" }
          ],
          cfg.letterbox
        )}
      </div>
      <div class="settings-row" style="flex-direction:column;align-items:stretch;gap:8px;">
        <span class="settings-label-title" style="font-size:13px;">Scale</span>
        ${renderSelectMenu(
          "rufflePanelScale",
          [
            { value: "showAll", label: "Show All" },
            { value: "noBorder", label: "No Border" },
            { value: "exactFit", label: "Exact Fit" },
            { value: "noScale", label: "No Scale" }
          ],
          cfg.scale
        )}
      </div>
      <div class="settings-row">
        <span class="settings-label-title" style="flex:1;min-width:0;">Background</span>
        <input type="color" id="rufflePanelBg" value="${cfg.backgroundColor}" style="width:44px;height:28px;padding:0;border:1px solid var(--glass-border);border-radius:6px;background:transparent;flex-shrink:0;">
      </div>
      <div class="settings-row">
        <span class="settings-label-title" style="flex:1;min-width:0;">Splash Screen</span>
        <label class="settings-toggle" style="flex-shrink:0;"><input type="checkbox" id="rufflePanelSplash" ${cfg.splashScreen ? "checked" : ""}><span class="settings-track"><span class="settings-thumb"></span></span></label>
      </div>
      <div class="settings-row">
        <span class="settings-label-title" style="flex:1;min-width:0;">Allow Script Access</span>
        <label class="settings-toggle" style="flex-shrink:0;"><input type="checkbox" id="rufflePanelScript" ${cfg.allowScriptAccess ? "checked" : ""}><span class="settings-track"><span class="settings-thumb"></span></span></label>
      </div>
      <div class="settings-row" style="flex-direction:column;align-items:stretch;gap:8px;">
        <span class="settings-label-title" style="font-size:13px;">Autoplay</span>
        ${renderSelectMenu(
          "rufflePanelAutoplay",
          [
            { value: "on", label: "On" },
            { value: "off", label: "Off" },
            { value: "auto", label: "Auto" }
          ],
          cfg.autoplay
        )}
      </div>
      <div class="settings-row" style="flex-direction:column;align-items:stretch;gap:8px;">
        <span class="settings-label-title" style="font-size:13px;">Context Menu</span>
        ${renderSelectMenu(
          "rufflePanelContextMenu",
          [
            { value: "on", label: "On" },
            { value: "off", label: "Off" },
            { value: "rightClickOnly", label: "Right-click only" }
          ],
          cfg.contextMenu
        )}
      </div>
      <div style="display:flex;gap:8px;justify-content:space-between;flex-shrink:0;">
        <button id="rufflePanelOpenSettings" class="settings-btn" style="flex:1;min-width:0;"><i class="fas fa-cog"></i> Open Settings</button>
        <button id="rufflePanelReset" class="settings-btn" style="flex:1;min-width:0;"><i class="fas fa-rotate-left"></i> Reset</button>
      </div>
      </div>
    `;
    const container = anchorWin.querySelector(".ruf-container") || anchorWin;
    container.style.position = "relative";
    container.appendChild(panel);
    bindSelectMenu(panel);
    const save = (patch) => {
      saveRuffleConfig(patch);
      os.events.emit(BusEvents.SETTINGS_CHANGED, { key: "yukiOS_ruffle_config", value: patch });
    };
    panel.querySelector("#ruffle-settings-close")?.addEventListener("click", () => panel.remove());
    panel.querySelector("#rufflePanelOpenSettings")?.addEventListener("click", () => {
      panel.remove();
      os.app.launch("settingsApp", { section: "pane-ruffle" });
    });
    panel
      .querySelector("#rufflePanelLetterbox")
      ?.addEventListener("change", () => save({ letterbox: getSelectMenuValue("rufflePanelLetterbox", panel) }));
    panel
      .querySelector("#rufflePanelScale")
      ?.addEventListener("change", () => save({ scale: getSelectMenuValue("rufflePanelScale", panel) }));
    panel
      .querySelector("#rufflePanelAutoplay")
      ?.addEventListener("change", () => save({ autoplay: getSelectMenuValue("rufflePanelAutoplay", panel) }));
    panel
      .querySelector("#rufflePanelContextMenu")
      ?.addEventListener("change", () => save({ contextMenu: getSelectMenuValue("rufflePanelContextMenu", panel) }));
    panel.querySelector("#rufflePanelBg")?.addEventListener("input", (e) => save({ backgroundColor: e.target.value }));
    panel
      .querySelector("#rufflePanelSplash")
      ?.addEventListener("change", (e) => save({ splashScreen: e.target.checked }));
    panel
      .querySelector("#rufflePanelScript")
      ?.addEventListener("change", (e) => save({ allowScriptAccess: e.target.checked }));
    panel.querySelector("#rufflePanelReset")?.addEventListener("click", async () => {
      if (!(await os.dialog.confirm("Reset Ruffle Settings", "Restore defaults?"))) return;
      os.storage.remove("yukiOS_ruffle_config");
      os.events.emit(BusEvents.SETTINGS_CHANGED, { key: "yukiOS_ruffle_config", value: null });
      panel.remove();
      this.openRuffleSettingsPanel(anchorWin);
    });
    const dismiss = (e) => {
      if (
        !panel.contains(e.target) &&
        e.target.id !== "ruffle-open-settings" &&
        !e.target.closest("#ruffle-open-settings")
      ) {
        panel.remove();
        document.removeEventListener("click", dismiss, true);
      }
    };
    setTimeout(() => document.addEventListener("click", dismiss, true), 0);
  }

  async loadUserFiles() {
    renderEmulatorFileList({
      container: $("#ruffle-user-files"),
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
      spinnerHTML: `<div class="yuki-loading-indicator"><i class="fa-solid fa-spinner fa-spin emu-state-icon ruf-state-icon" style="animation-duration:1.4s;opacity:0.7"></i><div class="emu-state-text ruf-state-text">Saving ${files.length} file(s)...</div></div>`,
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
        wrapperClass: "yuki-loading-indicator emu-state ruf-loading emu-load-wrap",
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

      const ruffleConfig = buildPlayerConfig();
      const ruffleConfigJson = JSON.stringify(ruffleConfig).replace(/</g, "\\u003c");
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
    html, body { width: 100%; height: 100%; background: ${ruffleConfig.backgroundColor || "#000"}; overflow: hidden; }
    ruffle-player { width: 100%; height: 100%; display: block; }
  </style>
</head>
<body>
  <script src="${ruffleScriptUrl}"><\/script>
  <script>
    window.addEventListener("load", function () {
      var __ruffleCfg = ${ruffleConfigJson};
      var ruffle = window.RufflePlayer.newest();
      var player = ruffle.createPlayer();
      player.config = __ruffleCfg;
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

        const script = createElement("script");
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
