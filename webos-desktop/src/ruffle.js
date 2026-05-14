import { Achievements } from "./achievements.js";
import { bus, BusEvents } from "./core/EventBus.js";
import { BaseApp } from "./core/BaseApp.js";
import { WindowHelper } from "./utils/WindowHelper.js";
import { CDN_BASES } from "./shared/assetResolver.js";
import { CDN_CONFIG } from "./shared/cdnConfig.js";

const FLASH_DIR = ["Flash"];
const DESKTOP_DIR = ["Desktop"];

export class RuffleApp extends BaseApp {
  constructor(services) {
    super(services);
    this.windowHelper = new WindowHelper(this.wm);
    this._ruffleLoadPromise = null;
  }

  open() {
    if (this._isSingletonOpen("ruffle-win")) return;

    this._loadRuffleScript();

    const content = `
      <div class="window-content" style="width:100%;height:100%;background:#1a1a2e;color:#eee;font-family:monospace;overflow-y:auto;overflow-x:hidden;">
        <div style="display:flex;align-items:center;gap:16px;padding:24px 20px 16px;">
          <i class="fa-solid fa-film" style="font-size:38px;color:#ff6b9d;"></i>
          <div>
            <div style="font-size:20px;font-weight:bold;color:#fff;">Ruffle</div>
            <div style="font-size:13px;color:#888;">Flash emulator powered by Ruffle</div>
          </div>
        </div>
        <div
          id="ruffle-upload-zone"
          style="
            border:2px dashed #ff6b9d;
            border-radius:8px;
            margin:16px;
            padding:24px;
            text-align:center;
            cursor:pointer;
            transition:border-color .2s,background .2s;
            background:transparent;
          ">
          <i class="fa-solid fa-film" style="font-size:32px;color:#ff6b9d;margin-bottom:12px;display:block;"></i>
          <div style="font-size:14px;color:#bbb;margin-bottom:8px;">Drop a SWF file or click to browse</div>
          <div style="font-size:11px;color:#666;">Supported format: .swf</div>
          <input type="file" id="ruffle-file-input" accept=".swf" multiple style="display:none;">
        </div>
        <div style="padding:16px 16px 8px;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;">My Flash Files</div>
        <div id="ruffle-user-files" style="padding:0 16px 16px;display:flex;flex-wrap:wrap;gap:12px;"></div>
      </div>`;

    const win = this.windowHelper.createAndMountWindow("ruffle-win", "Ruffle", content, "800px", "600px", {
      icon: "static/icons/ruffle.webp"
    });

    this._setupUploadZone(win);
    this._loadUserFiles(win);
  }

  _setupUploadZone(win) {
    const zone = win.querySelector("#ruffle-upload-zone");
    const input = win.querySelector("#ruffle-file-input");

    zone.addEventListener("click", () => input.click());

    zone.addEventListener("dragover", (e) => {
      e.preventDefault();
      zone.style.borderColor = "#ff6b9d";
      zone.style.background = "rgba(255,107,157,0.07)";
    });

    zone.addEventListener("dragleave", () => {
      zone.style.borderColor = "#ff6b9d";
      zone.style.background = "transparent";
    });

    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.style.borderColor = "#ff6b9d";
      zone.style.background = "transparent";
      const files = Array.from(e.dataTransfer.files).filter((f) => f.name.toLowerCase().endsWith(".swf"));
      if (files.length > 0) this._handleUploadedFiles(files, win);
    });

    input.addEventListener("change", () => {
      const files = Array.from(input.files);
      if (files.length > 0) this._handleUploadedFiles(files, win);
      input.value = "";
    });
  }

  async _handleUploadedFiles(files, win) {
    const zone = win.querySelector("#ruffle-upload-zone");
    const originalHTML = zone.innerHTML;

    zone.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="font-size:24px;color:#ff6b9d;margin-bottom:12px;display:block;"></i><div style="font-size:13px;color:#bbb;">Saving ${files.length} file(s)...</div>`;

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
      zone.innerHTML = `<i class="fa-solid fa-circle-check" style="font-size:24px;color:#4caf50;margin-bottom:12px;display:block;"></i><div style="font-size:13px;color:#bbb;">Saved ${files.length} file(s)!</div>`;
      await this._loadUserFiles(win);

      setTimeout(() => {
        zone.innerHTML = originalHTML;
        this._setupUploadZone(win);
      }, 1500);
    } catch (err) {
      zone.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="font-size:24px;color:#ff6b6b;margin-bottom:12px;display:block;"></i><div style="font-size:13px;color:#ff6b6b;">${err.message}</div>`;
      setTimeout(() => {
        zone.innerHTML = originalHTML;
        this._setupUploadZone(win);
      }, 2500);
    }
  }

  async _loadUserFiles(win) {
    const container = win.querySelector("#ruffle-user-files");
    if (!container) return;

    try {
      await this.fs.fsReady;
      await this.fs.ensureFolder(FLASH_DIR);
      const entries = await this.fs.getFolder(FLASH_DIR).catch(() => ({}));
      const files = Object.keys(entries).filter((k) => entries[k]?.type === "file");

      const swfFiles = files.filter((f) => !f.startsWith(".") && f.toLowerCase().endsWith(".swf"));

      if (swfFiles.length === 0) {
        container.innerHTML = `<div style="font-size:12px;color:#555;padding:4px 0;">No Flash files uploaded yet.</div>`;
        return;
      }

      container.innerHTML = swfFiles
        .map((f) => {
          const displayName = f
            .replace(/\.[^.]+$/, "")
            .replace(/[-_]/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase());

          return `
          <div class="ruffle-file-card" data-user-file="${f}" style="
            background:#252540;border-radius:10px;padding:14px 16px;
            display:flex;align-items:center;gap:12px;cursor:pointer;
            transition:transform .15s,box-shadow .15s;position:relative;min-width:200px;
          ">
            <i class="fa-solid fa-film" style="font-size:22px;color:#ff6b9d;"></i>
            <div style="flex:1;overflow:hidden;">
              <div style="font-size:13px;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${displayName}</div>
              <div style="font-size:10px;color:#666;margin-top:2px;">SWF • Flash</div>
            </div>
            <button class="ruffle-delete-btn" data-file="${f}" title="Delete" style="
              background:none;border:none;color:#666;cursor:pointer;font-size:13px;padding:2px 4px;line-height:1;
            "><i class="fa-solid fa-xmark"></i></button>
          </div>
        `;
        })
        .join("");

      container.querySelectorAll(".ruffle-file-card").forEach((card) => {
        card.addEventListener("click", (e) => {
          if (e.target.closest(".ruffle-delete-btn")) return;
          const fileName = card.dataset.userFile;
          this.launchSWF(fileName, FLASH_DIR);
        });
        card.addEventListener("mouseenter", () => {
          card.style.transform = "translateY(-2px)";
          card.style.boxShadow = "0 4px 12px rgba(255,107,157,0.2)";
        });
        card.addEventListener("mouseleave", () => {
          card.style.transform = "";
          card.style.boxShadow = "";
        });
      });

      container.querySelectorAll(".ruffle-delete-btn").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const fileName = btn.dataset.file;
          await this.fs.deleteBinaryFile(FLASH_DIR, fileName);
          await this._loadUserFiles(win);
        });
      });
    } catch {}
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
    <div class="window-content" style="width:100%;height:calc(100% - 30px);background:#000;position:relative;overflow:hidden;">
      <div id="${winId}-inner" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;">
        <i class="fa-solid fa-film fa-spin" style="font-size:32px;color:#ff6b9d;"></i>
        <div style="font-size:15px;color:#ff6b9d;">Loading <strong style="color:#fff;">${displayName}</strong>...</div>
        <div id="${winId}-log" style="font-size:11px;color:#888;max-width:400px;text-align:center;"></div>
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
          <i class="fa-solid fa-triangle-exclamation" style="font-size:32px;color:#ff6b6b;"></i>
          <div style="color:#ff6b6b;font-size:14px;font-family:monospace;max-width:80%;text-align:center;">${msg}</div>
        </div>`;
      inner.style.display = "flex";
      frame.style.display = "none";
    };

    wm.setupWindowControls(win);

    try {
      setLog("Loading Ruffle...");
      await this._loadRuffleScript();

      setLog("Starting Flash player...");

      // Resolve the Ruffle script URL the same way _loadRuffleScript does
      const ruffleScriptUrl = CDN_CONFIG.libraries.ruffle.path
        ? `${CDN_CONFIG.repos.npm.base}/${CDN_CONFIG.libraries.ruffle.path}`
        : `${CDN_CONFIG.repos.npm.base}/@ruffle-rs/ruffle@${CDN_CONFIG.libraries.ruffle.version}/ruffle.min.js`;

      // Convert SWF binary to a blob URL so the iframe document can load it
      const swfBlob = new Blob([swfData], { type: "application/x-shockwave-flash" });
      const swfUrl = URL.createObjectURL(swfBlob);

      // Build a self-contained HTML document that boots Ruffle inside the iframe
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
        // Revoke the iframe blob URL after it has loaded; keep swfUrl alive for the player
        URL.revokeObjectURL(iframeUrl);
      };

      inner.style.display = "none";
      frame.style.display = "block";
      frame.src = iframeUrl;

      // Clean up swfUrl when the window element is removed from the DOM
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
      script.src = CDN_CONFIG.libraries.ruffle.path
        ? `${CDN_CONFIG.repos.npm.base}/${CDN_CONFIG.libraries.ruffle.path}`
        : `${CDN_CONFIG.repos.npm.base}/@ruffle-rs/ruffle@${CDN_CONFIG.libraries.ruffle.version}/ruffle.min.js`;
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
