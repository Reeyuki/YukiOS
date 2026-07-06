import { Achievements } from "../achievements.js";
import { BusEvents } from "../core/EventBus.js";
import { CDN_BASES } from "../shared/assetResolver.js";
import { CDN_CONFIG, getLibraryUrl } from "../shared/cdnConfig.js";

import { BaseApp, PersistenceTypes, os } from "../framework.js";
const FLASH_DIR = ["Flash"];
const DESKTOP_DIR = ["Desktop"];

export class RuffleApp extends BaseApp {
  constructor(services) {
    super(services);
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
          element.classList.add("emu-upload-zone--dragover");
        },
        uploadZoneDragleave: (payload, event, element, state) => {
          element.classList.remove("emu-upload-zone--dragover");
        },
        uploadZoneDrop: async (payload, event, element, state) => {
          event.preventDefault();
          element.classList.remove("emu-upload-zone--dragover");
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
        },
        refreshIcons: (payload, event, element, state) => {
          if (window.FontAwesome && window.FontAwesome.dom && window.FontAwesome.dom.i2svg) {
            const container = document.querySelector(".ruf-container");
            if (container) {
              window.FontAwesome.dom.i2svg({ node: container });
            }
          }
        }
      },
      onMount: ["loadUserFiles", "refreshIcons"]
    };
  }

  async loadUserFiles() {
    const container = document.getElementById("ruffle-user-files");
    if (!container) return;

    try {
      await os.fs.mkdir(FLASH_DIR);
      const entries = await os.fs.readdir(FLASH_DIR).catch(() => ({}));
      const files = Object.keys(entries).filter((k) => entries[k]?.type === "file");

      const swfFiles = files.filter((f) => !f.startsWith(".") && f.toLowerCase().endsWith(".swf"));

      if (swfFiles.length === 0) {
        container.innerHTML = `<div class="emu-empty ruf-empty">No Flash files uploaded yet.</div>`;
        return;
      }

      container.innerHTML = swfFiles
        .map((f) => {
          const displayName = f
            .replace(/\.[^.]+$/, "")
            .replace(/[-_]/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase());

          return `
            <div class="emu-card ruf-file-card emu-card--removable" data-user-file="${f}">
              <i class="fa-solid fa-film emu-card-icon ruf-file-icon"></i>
              <div class="emu-card-body ruf-file-info">
                <div class="emu-card-title ruf-file-name">${displayName}</div>
                <div class="emu-card-meta ruf-file-type">SWF • Flash</div>
              </div>
              <button class="emu-delete-btn ruf-delete-btn" data-file="${f}" title="Delete">
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
          await os.fs.deleteBinaryFile(FLASH_DIR, fileName);
          this.loadUserFiles();
        });
      });
    } catch {}
  }

  async _handleUploadedFiles(files, zone) {
    const originalHTML = zone.innerHTML;
    zone.innerHTML = `<i class="fa-solid fa-spinner fa-spin emu-state-icon ruf-state-icon"></i><div class="emu-state-text ruf-state-text">Saving ${files.length} file(s)...</div>`;

    try {
      for (const file of files) {
        const blob = new Blob([await file.arrayBuffer()], { type: "application/x-shockwave-flash" });
        await os.fs.writeBinaryFile(FLASH_DIR, file.name, blob, "other", CDN_BASES.MAIN + "/static/icons/ruffle.webp");
        await os.fs.writeBinaryFile(
          DESKTOP_DIR,
          file.name,
          blob,
          "other",
          CDN_BASES.MAIN + "/static/icons/ruffle.webp"
        );
        os.events.emit(BusEvents.FILE_CHANGED, { path: file.name });
      }

      os.notify.send(`Saved ${files.length} file(s) to Flash.`);
      zone.innerHTML = `<i class="fa-solid fa-circle-check emu-state-icon ruf-state-icon"></i><div class="emu-state-text ruf-state-text">Saved ${files.length} file(s)!</div>`;

      setTimeout(() => {
        zone.innerHTML = originalHTML;
        this.loadUserFiles();
      }, 1500);
    } catch (err) {
      zone.innerHTML = `<i class="fa-solid fa-triangle-exclamation emu-state-icon ruf-state-icon emu-state--error"></i><div class="emu-state-text ruf-state-text emu-state--error">${err.message}</div>`;
      setTimeout(() => {
        zone.innerHTML = originalHTML;
      }, 2500);
    }
  }

  async open() {
    if (await this._isSingletonOpen("ruffle-win")) return;

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
      const blob = await os.fs.read([...normalizedPath, fileName]);
      if (!blob || blob.size === 0) {
        os.notify.send("Couldn't read that SWF file.");
        return;
      }

      const arrayBuffer = await blob.arrayBuffer();
      const displayName = fileName
        .replace(/\.[^.]+$/, "")
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

      this._launchRuffle(displayName, fileName, arrayBuffer);
    } catch (e) {
      os.notify.send(`SWF wouldn't load: ${e.message}`);
    }
  }

  async _launchRuffle(displayName, fileName, swfData) {
    const winId = `ruffle-${Date.now()}`;
    const win = os.window.create(winId, displayName, "800px", "600px", {
      icon: "static/icons/ruffle.webp"
    });

    os.events.emit(BusEvents.ACHIEVEMENT_TRIGGER, { achievementId: Achievements.RetroPlayer });

    win.innerHTML = `
    <div class="window-content emu-window ruf-window">
      <div id="${winId}-inner" class="emu-state ruf-loading emu-load-wrap">
        <i class="fa-solid fa-film fa-spin emu-state-icon ruf-state-icon"></i>
        <div class="emu-state-text ruf-state-text emu-state-text--accent">Starting <strong>${displayName}</strong>...</div>
        <div id="${winId}-log" class="emu-state-text--muted ruf-log"></div>
      </div>
      <iframe
        id="${winId}-frame"
        class="emu-iframe"
        sandbox="allow-scripts allow-same-origin"
      ></iframe>
    </div>`;

    const inner = win.querySelector(`#${winId}-inner`);
    const frame = win.querySelector(`#${winId}-frame`);
    const log = win.querySelector(`#${winId}-log`);

    const setLog = (msg) => {
      if (log) log.textContent = msg;
    };

    const showError = (msg) => {
      if (inner)
        inner.innerHTML = `
        <div class="emu-state emu-state--error ruf-error">
          <i class="fa-solid fa-triangle-exclamation emu-state-icon ruf-state-icon emu-state--error"></i>
          <div class="emu-state-text ruf-state-text emu-state--error">${msg}</div>
        </div>`;
      inner.style.display = "flex";
      frame.style.display = "none";
    };

    try {
      setLog("Starting Ruffle...");
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

  _loadRuffleScript() {
    if (this._ruffleLoadPromise) return this._ruffleLoadPromise;

    this._ruffleLoadPromise = (async () => {
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

    return this._ruffleLoadPromise;
  }

  async launchFromFile(file) {
    if (!file.name.toLowerCase().endsWith(".swf")) {
      os.notify.send("Ruffle only works with .swf files.", "", { icon: "static/icons/ruffle.webp" });
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
