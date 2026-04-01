import { Achievements } from "./achievements.js";
import { desktop } from "./desktop.js";
import JSZip from "jszip";

const GAMES_DIR = ["Games"];

export class JsDosApp {
  constructor(fileSystemManager, windowManager, explorerApp) {
    this._fs = fileSystemManager;
    this._windowManager = windowManager;
    this._explorerApp = explorerApp;
  }

  open() {
    if (document.getElementById("jsdos-win")) {
      this._windowManager.bringToFront(document.getElementById("jsdos-win"));
      return;
    }
    const win = this._windowManager.createWindow("jsdos-win", "JsDos", "600px", "560px");
    win.innerHTML = `
      <div class="window-header">
        <span>JsDos Game Launcher</span>
        ${this._windowManager.getWindowControls()}
      </div>
      <div class="window-content" style="width:100%;height:100%;background:#1a1a2e;color:#eee;font-family:monospace;overflow-y:auto;overflow-x:hidden;">
        <div class="jsdos-header">
          <i class="fa-solid fa-gamepad jsdos-header-icon"></i>
          <div class="jsdos-header-text">
            <div class="jsdos-header-title">JsDos Game Library</div>
            <div class="jsdos-header-subtitle">Select a game to launch</div>
          </div>
        </div>
        <div style="padding:16px 16px 8px;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;">My Games</div>
        <div
          id="jsdos-upload-zone"
          style="
            margin:0 16px 12px;
            border:2px dashed #444;
            border-radius:8px;
            padding:18px;
            text-align:center;
            cursor:pointer;
            transition:border-color .2s,background .2s;
            background:transparent;
          "
        >
          <i class="fa-solid fa-upload" style="font-size:20px;color:#7b5ea7;margin-bottom:8px;display:block;"></i>
          <div style="font-size:13px;color:#bbb;">Drop a <strong style="color:#fff;">.jsdos</strong> or <strong style="color:#fff;">.exe</strong> file here</div>
          <div style="font-size:11px;color:#666;margin-top:4px;">or click to browse</div>
          <input type="file" id="jsdos-file-input" accept=".jsdos,.exe,.com,.bat" style="display:none;">
        </div>
        <div id="jsdos-user-games" style="padding:0 16px 16px;display:flex;flex-wrap:wrap;gap:12px;"></div>
        <div style="padding:0 16px 8px;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;">Featured Games</div>
        <div class="jsdos-game-grid" id="jsdos-game-grid">
          ${this._generateGameCards()}
        </div>
      </div>`;

    desktop.appendChild(win);
    this._windowManager.makeDraggable(win);
    this._windowManager.makeResizable(win);
    this._windowManager.setupWindowControls(win);
    this._windowManager.addToTaskbar(win.id, "JsDos", "/static/icons/jsdos.webp");

    this._setupGameCardListeners(win);
    this._setupUploadZone(win);
    this._loadUserGames(win);
  }

  _generateGameCards() {
    const games = [
      { file: "dn3d.jsdos", name: "Duke Nukem 3D", icon: "fa-solid fa-crosshairs" },
      { file: "doom.jsdos", name: "DOOM", icon: "fa-solid fa-skull" },
      { file: "wolfenstein.jsdos", name: "Wolfenstein", icon: "fa-solid fa-skull" },
      { file: "jazz.jsdos", name: "Jazz Jackrabbit", icon: "fa-solid fa-drum" },
      { file: "raptor.jsdos", name: "Raptor", icon: "fa-solid fa-jet-fighter" },
      { file: "skyroads.jsdos", name: "SkyRoads", icon: "fa-solid fa-rocket" }
    ];

    return games
      .map(
        (game) => `
      <div class="jsdos-game-card" data-game="${game.file}">
        <i class="${game.icon} jsdos-game-icon"></i>
        <div class="jsdos-game-title">${game.name}</div>
      </div>
    `
      )
      .join("");
  }

  _setupGameCardListeners(win) {
    const cards = win.querySelectorAll(".jsdos-game-card");
    cards.forEach((card) => {
      card.addEventListener("click", () => {
        const gameFile = card.dataset.game;
        const gameName = card.querySelector(".jsdos-game-title").textContent;
        this.launchGame(gameFile, gameName);
      });
    });
  }

  _setupUploadZone(win) {
    const zone = win.querySelector("#jsdos-upload-zone");
    const input = win.querySelector("#jsdos-file-input");

    zone.addEventListener("click", () => input.click());

    zone.addEventListener("dragover", (e) => {
      e.preventDefault();
      zone.style.borderColor = "#c77dff";
      zone.style.background = "rgba(199,125,255,0.07)";
    });

    zone.addEventListener("dragleave", () => {
      zone.style.borderColor = "#444";
      zone.style.background = "transparent";
    });

    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.style.borderColor = "#444";
      zone.style.background = "transparent";
      const file = e.dataTransfer.files[0];
      if (file) this._handleUploadedFile(file, win);
    });

    input.addEventListener("change", () => {
      const file = input.files[0];
      if (file) this._handleUploadedFile(file, win);
      input.value = "";
    });
  }

  async _handleUploadedFile(file, win) {
    const zone = win.querySelector("#jsdos-upload-zone");
    const originalHTML = zone.innerHTML;

    zone.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="font-size:20px;color:#c77dff;margin-bottom:8px;display:block;"></i><div style="font-size:13px;color:#bbb;">Saving <strong style="color:#fff;">${file.name}</strong>…</div>`;

    try {
      const blob = new Blob([await file.arrayBuffer()], { type: file.type || "application/octet-stream" });
      await this._fs.writeBinaryFile(GAMES_DIR, file.name, blob, "other", "/static/icons/jsdos.webp");
      this._windowManager.sendNotify(`Saved ${file.name} at Games/ directory. `);
      zone.innerHTML = `<i class="fa-solid fa-circle-check" style="font-size:20px;color:#4caf50;margin-bottom:8px;display:block;"></i><div style="font-size:13px;color:#bbb;">Saved!</div>`;
      await this._loadUserGames(win);
      setTimeout(() => {
        zone.innerHTML = originalHTML;
        win.querySelector("#jsdos-file-input").addEventListener("change", (e) => {
          const f = e.target.files[0];
          if (f) this._handleUploadedFile(f, win);
          e.target.value = "";
        });
      }, 1500);
    } catch (err) {
      zone.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="font-size:20px;color:#ff6b6b;margin-bottom:8px;display:block;"></i><div style="font-size:13px;color:#ff6b6b;">${err.message}</div>`;
      setTimeout(() => {
        zone.innerHTML = originalHTML;
      }, 2500);
    }
  }

  async _loadUserGames(win) {
    const container = win.querySelector("#jsdos-user-games");
    if (!container) return;

    try {
      await this._fs.fsReady;
      const dir = this._fs.resolveDir(GAMES_DIR);
      await this._fs.p("mkdir", dir, { recursive: true }).catch(() => {});
      const files = await this._fs.pRead("readdir", dir).catch(() => []);
      const gameFiles = files.filter(
        (f) => !f.startsWith(".") && (f.endsWith(".jsdos") || f.endsWith(".exe") || f.endsWith(".com"))
      );

      if (gameFiles.length === 0) {
        container.innerHTML = `<div style="font-size:12px;color:#555;padding:4px 0;">No uploaded games yet.</div>`;
        return;
      }

      container.innerHTML = gameFiles
        .map((f) => {
          const displayName = f
            .replace(/\.[^.]+$/, "")
            .replace(/[-_]/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase());
          return `
        <div class="jsdos-game-card jsdos-user-card" data-user-file="${f}" style="position:relative;">
          <i class="fa-solid fa-floppy-disk jsdos-game-icon" style="color:#c77dff;"></i>
          <div class="jsdos-game-title">${displayName}</div>
          <button class="jsdos-delete-btn" data-file="${f}" title="Delete" style="
            position:absolute;top:6px;right:6px;background:none;border:none;
            color:#666;cursor:pointer;font-size:13px;padding:2px 4px;line-height:1;
          "><i class="fa-solid fa-xmark"></i></button>
        </div>
      `;
        })
        .join("");

      container.querySelectorAll(".jsdos-user-card").forEach((card) => {
        card.addEventListener("click", (e) => {
          if (e.target.closest(".jsdos-delete-btn")) return;
          const fileName = card.dataset.userFile;
          this.launchExe(fileName, GAMES_DIR);
        });
      });

      container.querySelectorAll(".jsdos-delete-btn").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const fileName = btn.dataset.file;
          await this._fs.deleteBinaryFile(GAMES_DIR, fileName);
          await this._loadUserGames(win);
        });
      });
    } catch {}
  }

  async launchGame(fileName, displayName) {
    const wm = this._windowManager;
    const winId = `jsdos-${Date.now()}`;
    const win = wm.createWindow(winId, displayName, "800px", "600px");
    window.achievements.trigger(Achievements.RetroPlayer);

    win.innerHTML = `
    <div class="window-header">
      <span>${displayName}</span>
      ${wm.getWindowControls()}
    </div>
    <div class="window-content" style="width:100%;height:calc(100% - 30px);background:#000;position:relative;">
      <div id="${winId}-inner" style="width:100%;height:100%;" class="jsdos-loading">
        <i class="fa-solid fa-compact-disc jsdos-loading-spinner"></i>
        <div style="font-size:15px;color:#c77dff;">Loading <strong style="color:#fff;">${displayName}</strong>…</div>
        <div id="${winId}-log" style="font-size:11px;color:#888;max-width:400px;text-align:center;"></div>
      </div>
    </div>`;

    desktop.appendChild(win);
    wm.makeDraggable(win);
    wm.makeResizable(win);
    wm.addToTaskbar(winId, displayName, "/static/icons/jsdos.webp");

    const inner = win.querySelector(`#${winId}-inner`);
    const log = win.querySelector(`#${winId}-log`);
    const setLog = (msg) => {
      if (log) log.textContent = msg;
    };
    const showError = (msg) => {
      if (inner)
        inner.innerHTML = `
      <div class="jsdos-error">
        <i class="fa-solid fa-triangle-exclamation jsdos-error-icon"></i>
        <div class="jsdos-error-msg">${msg}</div>
      </div>`;
    };

    let iframeEl = null;
    let bundleUrl = null;
    let iframePageUrl = null;

    const cleanup = () => {
      try {
        iframeEl?.contentWindow?.postMessage("mute", "*");
      } catch {}
      if (bundleUrl) URL.revokeObjectURL(bundleUrl);
      if (iframePageUrl) URL.revokeObjectURL(iframePageUrl);
    };

    win.querySelector(".close-btn").addEventListener("click", () => {
      cleanup();
      wm.removeFromTaskbar(winId);
      win.remove();
    });

    win.querySelector(".minimize-btn").addEventListener("click", () => {
      try {
        iframeEl?.contentWindow?.postMessage("mute", "*");
      } catch {}
      wm.minimizeWindow(win);
    });

    try {
      setLog("Downloading game…");
      const gameUrl = `/static/apps/jsdos/${fileName}`;

      const response = await fetch(gameUrl);
      if (!response.ok) {
        showError(`Failed to download: ${response.statusText}`);
        return;
      }

      const arrayBuffer = await response.arrayBuffer();
      const bundleBlob = new Blob([arrayBuffer], { type: "application/zip" });
      bundleUrl = URL.createObjectURL(bundleBlob);

      wm.sendNotify(`Saved ${fileName} jsdos game at Games/ directory. `);
      setLog("Launching…");

      const iframeHTML = this._buildIframeHTML(bundleUrl);
      const iframeBlobUrl = URL.createObjectURL(new Blob([iframeHTML], { type: "text/html" }));
      iframePageUrl = iframeBlobUrl;

      inner.innerHTML = "";
      inner.style.cssText = "width:100%;height:100%;";
      inner.classList.remove("jsdos-loading");

      iframeEl = document.createElement("iframe");
      iframeEl.src = iframeBlobUrl;
      iframeEl.style.cssText = "width:100%;height:100%;border:none;display:block;";
      iframeEl.setAttribute("allowfullscreen", "");
      inner.appendChild(iframeEl);
    } catch (e) {
      showError(`Error: ${e.message}`);
    }
  }

  _buildIframeHTML(bundleUrl) {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; background: #000; overflow: hidden; }
  #dos { width: 100%; height: 100%; }
</style>
<link rel="stylesheet" href="https://v8.js-dos.com/latest/js-dos.css">
</head>
<body>
<div id="dos"></div>
<script src="https://v8.js-dos.com/latest/js-dos.js"><\/script>
<script>
  Dos(document.getElementById("dos"), {
    url: ${JSON.stringify(bundleUrl)},
    onEvent: function(event, ci) {
      if (event === "ci-ready") {
        window._ci = ci;
      }
    }
  });
  window.addEventListener("message", function(e) {
    if (e.data === "mute" && window._ci) { try { window._ci.mute(); } catch {} }
  });
<\/script>
</body>
</html>`;
  }

  async _buildBundle(name, arrayBuffer) {
    const zip = new JSZip();
    const conf = [
      "[sdl]",
      "output=surface",
      "",
      "[dosbox]",
      "machine=svga_s3",
      "",
      "[cpu]",
      "core=auto",
      "cputype=auto",
      "cycles=max",
      "",
      "[autoexec]",
      `mount c /`,
      `c:`,
      `${name}`
    ].join("\n");
    zip.folder(".jsdos").file("dosbox.conf", conf);
    zip.file(name, arrayBuffer);
    return zip.generateAsync({ type: "blob" });
  }

  async launchExe(name, path) {
    const wm = this._windowManager;
    const winId = `jsdos-${Date.now()}`;
    const win = wm.createWindow(winId, name, "800px", "600px");
    window.achievements.trigger(Achievements.RetroPlayer);
    win.innerHTML = `
    <div class="window-header">
      <span>${name}</span>
      ${wm.getWindowControls()}
    </div>
    <div class="window-content" style="width:100%;height:calc(100% - 30px);background:#000;position:relative;">
      <div id="${winId}-inner" style="width:100%;height:100%;" class="jsdos-loading">
        <i class="fa-solid fa-compact-disc jsdos-loading-spinner"></i>
        <div style="font-size:15px;color:#c77dff;">Loading <strong style="color:#fff;">${name}</strong>…</div>
        <div id="${winId}-log" style="font-size:11px;color:#888;max-width:400px;text-align:center;"></div>
      </div>
    </div>`;
    desktop.appendChild(win);
    wm.makeDraggable(win);
    wm.makeResizable(win);
    wm.addToTaskbar(winId, name, "/static/icons/jsdos.webp");

    const inner = win.querySelector(`#${winId}-inner`);
    const log = win.querySelector(`#${winId}-log`);
    const setLog = (msg) => {
      if (log) log.textContent = msg;
    };
    const showError = (msg) => {
      if (inner)
        inner.innerHTML = `
      <div class="jsdos-error" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;">
        <i class="fa-solid fa-triangle-exclamation" style="font-size:32px;color:#ff6b6b;"></i>
        <div style="color:#ff6b6b;font-size:14px;font-family:monospace;">${msg}</div>
      </div>`;
    };

    let iframeEl = null;
    let bundleUrl = null;
    let iframePageUrl = null;

    const cleanup = () => {
      try {
        iframeEl?.contentWindow?.postMessage("mute", "*");
      } catch {}
      if (bundleUrl) URL.revokeObjectURL(bundleUrl);
      if (iframePageUrl) URL.revokeObjectURL(iframePageUrl);
    };

    win.querySelector(".close-btn").addEventListener("click", () => {
      cleanup();
      wm.removeFromTaskbar(winId);
      win.remove();
    });

    win.querySelector(".minimize-btn").addEventListener("click", () => {
      try {
        iframeEl?.contentWindow?.postMessage("mute", "*");
      } catch {}
      wm.minimizeWindow(win);
    });

    try {
      setLog("Reading file…");
      const normalizedPath = Array.isArray(path)
        ? path
        : typeof path === "string"
          ? path.split("/").filter(Boolean)
          : Object.values(path ?? {}).filter((v) => typeof v === "string");

      const blob = await this._fs.readBinaryFile(normalizedPath, name);
      if (!blob || blob.size === 0) {
        showError("Failed to read file.");
        return;
      }

      const isBundle = name.toLowerCase().endsWith(".jsdos");

      setLog(isBundle ? "Preparing bundle…" : "Building js-dos bundle…");
      const arrayBuffer = await blob.arrayBuffer();
      const bundleBlob = isBundle
        ? new Blob([arrayBuffer], { type: "application/zip" })
        : await this._buildBundle(name, arrayBuffer);

      bundleUrl = URL.createObjectURL(bundleBlob);

      setLog("Launching…");

      const iframeHTML = this._buildIframeHTML(bundleUrl);
      const iframeBlobUrl = URL.createObjectURL(new Blob([iframeHTML], { type: "text/html" }));
      iframePageUrl = iframeBlobUrl;

      inner.innerHTML = "";
      inner.style.cssText = "width:100%;height:100%;";
      inner.classList.remove("jsdos-loading");

      iframeEl = document.createElement("iframe");
      iframeEl.src = iframeBlobUrl;
      iframeEl.style.cssText = "width:100%;height:100%;border:none;display:block;";
      iframeEl.setAttribute("allowfullscreen", "");
      inner.appendChild(iframeEl);
    } catch (e) {
      showError(`Error: ${e.message}`);
    }
  }
}
