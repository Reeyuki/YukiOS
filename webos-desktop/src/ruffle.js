import { Achievements } from "./achievements.js";
import { bus, BusEvents } from "./core/EventBus.js";
import { BaseApp } from "./core/BaseApp.js";
import { WindowHelper } from "./utils/WindowHelper.js";
import { CDN_BASES } from "./shared/assetResolver.js";
import { CDN_CONFIG, getLibraryUrl } from "./shared/cdnConfig.js";
import { PersistenceTypes } from "./runtime/AppSchema.js";

const FLASH_DIR = ["Flash"];
const DESKTOP_DIR = ["Desktop"];

export class RuffleApp extends BaseApp {
  constructor(services) {
    super(services);
    this.windowHelper = new WindowHelper(this.wm);
    this._ruffleLoadPromise = null;
    this._declarativeApp = null;
  }

  getDeclarativeSchema(opts) {
    return {
      id: "ruffle-win",
      name: "Ruffle",
      icon: "static/icons/ruffle.webp",
      windows: [
        {
          id: "ruffle-win",
          title: "Ruffle",
          size: ["800px", "600px"],
          icon: "static/icons/ruffle.webp",
          ui: `
      <link rel="stylesheet" href="styles/ruffle.css">
      <div class="ruf-container">
        <div class="ruf-header">
          <i class="fa-solid fa-film ruf-icon-main"></i>
          <div>
            <div class="ruf-title">Ruffle</div>
            <div class="ruf-subtitle">Flash emulator powered by Ruffle</div>
          </div>
        </div>
        
        <div id="ruffle-upload-zone" class="ruf-upload-zone">
          <i class="fa-solid fa-file-arrow-up ruf-upload-icon"></i>
          <div class="ruf-upload-text">Drop a SWF file or click to browse</div>
          <div class="ruf-upload-subtext">Supported format: .swf</div>
          <input type="file" id="ruffle-file-input" accept=".swf" multiple style="display:none;">
        </div>
        
        <div class="ruf-section-title">My Flash Files</div>
        <div id="ruffle-user-files" class="ruf-file-grid"></div>
      </div>`,
          events: {
            "#ruffle-upload-zone": {
              click: {
                type: "custom:uploadZoneClick",
                stopPropagation: true
              },
              dragover: {
                type: "custom:uploadZoneDragover",
                stopPropagation: false
              },
              dragleave: {
                type: "custom:uploadZoneDragleave",
                stopPropagation: false
              },
              drop: {
                type: "custom:uploadZoneDrop",
                stopPropagation: false
              }
            },
            "#ruffle-file-input": {
              change: {
                type: "custom:fileInputChange",
                stopPropagation: false
              }
            }
          }
        }
      ],
      state: {
        initial: {
          userFiles: []
        },
        persistence: PersistenceTypes.NONE
      },
      actions: {
        uploadZoneClick: (payload, event, element, state) => {
          const input = document.getElementById("ruffle-file-input");
          if (input) input.click();
        },
        uploadZoneDragover: (payload, event, element, state) => {
          event.preventDefault();
          element.style.borderColor = "var(--brand-hover)";
          element.style.background = "var(--glass-hover)";
        },
        uploadZoneDragleave: (payload, event, element, state) => {
          element.style.borderColor = "";
          element.style.background = "";
        },
        uploadZoneDrop: async (payload, event, element, state) => {
          event.preventDefault();
          element.style.borderColor = "";
          element.style.background = "";
          const files = Array.from(event.dataTransfer.files).filter((f) => f.name.toLowerCase().endsWith(".swf"));
          if (files.length > 0) await this._handleUploadedFiles(files, element);
        },
        fileInputChange: async (payload, event, element, state) => {
          const files = Array.from(element.files);
          if (files.length > 0) await this._handleUploadedFiles(files, document.getElementById("ruffle-upload-zone"));
          element.value = "";
        },
        loadUserFiles: async (payload, event, element, state) => {
          await this.loadUserFiles();
        }
      },
      onMount: "loadUserFiles"
    };
  }

  async loadUserFiles() {
    const container = document.getElementById("ruffle-user-files");
    if (!container) return;

    try {
      await this.fs.fsReady;
      await this.fs.ensureFolder(FLASH_DIR);
      const entries = await this.fs.getFolder(FLASH_DIR).catch(() => ({}));
      const files = Object.keys(entries).filter((k) => entries[k]?.type === "file");

      const swfFiles = files.filter((f) => !f.startsWith(".") && f.toLowerCase().endsWith(".swf"));

      if (swfFiles.length === 0) {
        container.innerHTML = `<div style="font-size:12px;color:var(--text-secondary, #555);padding:4px 0;">No Flash files uploaded yet.</div>`;
        return;
      }

      container.innerHTML = swfFiles
        .map((f) => {
          const displayName = f
            .replace(/\.[^.]+$/, "")
            .replace(/[-_]/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase());

          return `
            <div class="ruf-file-card" data-user-file="${f}">
              <i class="fa-solid fa-film ruf-file-icon"></i>
              <div class="ruf-file-info">
                <div class="ruf-file-name">${displayName}</div>
                <div class="ruf-file-type">SWF • Flash</div>
              </div>
              <button class="ruf-delete-btn" data-file="${f}" title="Delete">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
          `;
        })
        .join("");

      container.querySelectorAll(".ruf-file-card").forEach((card) => {
        card.addEventListener("click", (e) => {
          if (e.target.closest(".ruf-delete-btn")) return;
          const fileName = card.dataset.userFile;
          this.launchSWF(fileName, FLASH_DIR);
        });
      });

      container.querySelectorAll(".ruf-delete-btn").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const fileName = btn.dataset.file;
          await this.fs.deleteBinaryFile(FLASH_DIR, fileName);
          this.loadUserFiles();
        });
      });
    } catch {}
  }

  async _handleUploadedFiles(files, zone) {
    const originalHTML = zone.innerHTML;
    zone.innerHTML = `<i class="fa-solid fa-spinner fa-spin ruf-upload-icon"></i><div class="ruf-upload-text">Saving ${files.length} file(s)...</div>`;

    try {
      for (const file of files) {
        const blob = new Blob([await file.arrayBuffer()], { type: "application/x-shockwave-flash" });
        await this.fs.writeBinaryFile(
          FLASH_DIR,
          file.name,
          blob,
          "other",
          CDN_BASES.MAIN + "/static/icons/ruffle.webp"
        );
        await this.fs.writeBinaryFile(
          DESKTOP_DIR,
          file.name,
          blob,
          "other",
          CDN_BASES.MAIN + "/static/icons/ruffle.webp"
        );
        bus.emit(BusEvents.FILE_CHANGED, { path: file.name, kind: "created" });
      }

      this.wm.sendNotify(`Saved ${files.length} file(s) to Flash/ directory.`);
      zone.innerHTML = `<i class="fa-solid fa-circle-check" style="font-size:32px;color:var(--brand, #4caf50);margin-bottom:12px;display:block;"></i><div class="ruf-upload-text">Saved ${files.length} file(s)!</div>`;

      setTimeout(() => {
        zone.innerHTML = originalHTML;
        this.loadUserFiles();
      }, 1500);
    } catch (err) {
      zone.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="font-size:32px;color:var(--error, #ff6b6b);margin-bottom:12px;display:block;"></i><div class="ruf-upload-text" style="color:var(--error, #ff6b6b);">${err.message}</div>`;
      setTimeout(() => {
        zone.innerHTML = originalHTML;
      }, 2500);
    }
  }

  open() {
    if (this._isSingletonOpen("ruffle-win")) return;

    this._loadRuffleScript();
    return super.open();
  }

  async launchSWF(fileName, path) {
    const normalizedPath = Array.isArray(path)
      ? path
      : typeof path === "string"
        ? path.split("/").filter(Boolean)
        : Object.values(path ?? {}).filter((v) => typeof v === "string");

    try {
      const blob = await this.fs.readBinaryFile(normalizedPath, fileName);
      if (!blob || blob.size === 0) {
        this.wm.sendNotify("Failed to read SWF file.");
        return;
      }

      const arrayBuffer = await blob.arrayBuffer();
      const displayName = fileName
        .replace(/\.[^.]+$/, "")
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

      this._launchRuffle(displayName, fileName, arrayBuffer);
    } catch (e) {
      this.wm.sendNotify(`Error loading SWF: ${e.message}`);
    }
  }

  async _launchRuffle(displayName, fileName, swfData) {
    const wm = this.wm;
    const winId = `ruffle-${Date.now()}`;
    const win = wm.createWindow(winId, displayName, "800px", "600px");

    bus.emit(BusEvents.ACHIEVEMENT_TRIGGER, { key: Achievements.RetroPlayer });

    win.innerHTML = `
    <div class="window-header">
      <span>${displayName}</span>
      ${wm.getWindowControls()}
    </div>
    <div class="window-content" style="width:100%;height:calc(100% - 30px);background:#141424;position:relative;overflow:hidden;">
      <div id="${winId}-inner" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;">
        <i class="fa-solid fa-film fa-spin" style="font-size:32px;color:var(--brand, #ff6b9d);"></i>
        <div style="font-size:15px;color:var(--brand, #ff6b9d);">Loading <strong style="color:var(--text-primary, #fff);">${displayName}</strong>...</div>
        <div id="${winId}-log" style="font-size:11px;color:var(--text-secondary, #888);max-width:400px;text-align:center;"></div>
      </div>
      <iframe
        id="${winId}-frame"
        style="width:100%;height:100%;border:none;display:none;position:absolute;top:0;left:0;"
        sandbox="allow-scripts allow-same-origin"
      ></iframe>
    </div>`;

    this.windowHelper.mountWindow(win, winId, displayName, "static/icons/ruffle.webp");

    const inner = win.querySelector(`#${winId}-inner`);
    const frame = win.querySelector(`#${winId}-frame`);
    const log = win.querySelector(`#${winId}-log`);

    const setLog = (msg) => {
      if (log) log.textContent = msg;
    };

    const showError = (msg) => {
      if (inner)
        inner.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;">
          <i class="fa-solid fa-triangle-exclamation" style="font-size:32px;color:var(--error, #ff6b6b);"></i>
          <div style="color:var(--error, #ff6b6b);font-size:14px;font-family:monospace;max-width:80%;text-align:center;">${msg}</div>
        </div>`;
      inner.style.display = "flex";
      frame.style.display = "none";
    };

    wm.setupWindowControls(win);

    try {
      setLog("Loading Ruffle...");
      await this._loadRuffleScript();

      setLog("Starting Flash player...");

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
    html, body { width: 100%; height: 100%; background: #141424; overflow: hidden; }
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

  _loadRuffleScript() {
    if (this._ruffleLoadPromise) return this._ruffleLoadPromise;

    this._ruffleLoadPromise = new Promise((resolve, reject) => {
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

    return this._ruffleLoadPromise;
  }

  async launchFromFile(file) {
    if (!file.name.toLowerCase().endsWith(".swf")) {
      this.wm.sendNotify("Ruffle only supports .swf files.");
      return;
    }
    const arrayBuffer = await file.arrayBuffer();
    const displayName = file.name
      .replace(/\.[^.]+$/, "")
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

    this._launchRuffle(displayName, file.name, arrayBuffer);
  }
}
