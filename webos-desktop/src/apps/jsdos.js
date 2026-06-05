import { Achievements } from "../achievements.js";
import { zipSync } from "fflate";
import { BaseApp } from "../core/BaseApp.js";
import { os } from "../os/index.js";

const GAMES_DIR = ["Games"];

export class JsDosApp extends BaseApp {
  constructor(services) {
    super(services);
    this._explorerApp = services.explorerApp;
  }

  async open() {
    if (await this._isSingletonOpen("jsdos-win")) return;

    const win = os.window.create("jsdos-win", "JsDos", "600px", "560px", {
      icon: "static/icons/jsdos.webp"
    });
    win.innerHTML = `
      <div class="window-content jsdos-container emu-shell">
        <div class="jsdos-header emu-header">
          <i class="fa-solid fa-gamepad jsdos-header-icon emu-header-icon"></i>
          <div class="jsdos-header-text">
            <div class="jsdos-header-title emu-title">JsDos Game Library</div>
            <div class="jsdos-header-subtitle emu-subtitle">Select a game to launch</div>
          </div>
        </div>
        <div class="jsdos-section-title emu-section-title">My Games</div>
        <div
          id="jsdos-upload-zone"
          class="jsdos-upload-zone emu-upload-zone emu-upload-zone--compact"
        >
          <i class="fa-solid fa-upload jsdos-upload-icon emu-upload-icon"></i>
          <div class="jsdos-upload-text emu-upload-text">Drop a <strong>.jsdos</strong> or <strong>.exe</strong> file here</div>
          <div class="jsdos-upload-subtext emu-upload-subtext">or click to browse</div>
          <input type="file" id="jsdos-file-input" class="emu-file-input" accept=".jsdos,.exe,.com,.bat">
        </div>
        <div id="jsdos-user-games" class="emu-grid"></div>
        <div class="jsdos-section-title emu-section-title">Featured Games</div>
        <div class="jsdos-game-grid emu-grid" id="jsdos-game-grid">
          ${this._generateGameCards()}
        </div>
      </div>`;

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
      <div class="jsdos-game-card emu-card" data-game="${game.file}">
        <i class="${game.icon} jsdos-game-icon emu-card-icon"></i>
        <div class="jsdos-game-title emu-card-title">${game.name}</div>
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
      zone.classList.add("jsdos-upload-zone-dragover");
    });

    zone.addEventListener("dragleave", () => {
      zone.classList.remove("jsdos-upload-zone-dragover");
    });

    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.classList.remove("jsdos-upload-zone-dragover");
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

    zone.innerHTML = `<i class="fa-solid fa-spinner fa-spin jsdos-loading-icon"></i><div class="jsdos-loading-text">Saving <strong>${file.name}</strong>…</div>`;

    try {
      const blob = new Blob([await file.arrayBuffer()], { type: file.type || "application/octet-stream" });
      await os.fs.writeBinaryFile(GAMES_DIR, file.name, blob, "other", "/static/icons/jsdos.webp");
      os.notify.send("JsDos", `Saved ${file.name} at Games/ directory.`);
      zone.innerHTML = `<i class="fa-solid fa-circle-check jsdos-success-icon"></i><div class="jsdos-success-text">Saved!</div>`;
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
      zone.innerHTML = `<i class="fa-solid fa-triangle-exclamation jsdos-error-icon"></i><div class="jsdos-error-text">${err.message}</div>`;
      setTimeout(() => {
        zone.innerHTML = originalHTML;
      }, 2500);
    }
  }

  async _loadUserGames(win) {
    const container = win.querySelector("#jsdos-user-games");
    if (!container) return;

    try {
      await os.fs.mkdir(GAMES_DIR).catch(() => {});
      const entries = await os.fs.readdir(GAMES_DIR).catch(() => ({}));
      const files = Object.keys(entries).filter((k) => entries[k]?.type === "file");
      const gameFiles = files.filter(
        (f) => !f.startsWith(".") && (f.endsWith(".jsdos") || f.endsWith(".exe") || f.endsWith(".com"))
      );

      if (gameFiles.length === 0) {
        container.innerHTML = `<div class="jsdos-empty-text">No uploaded games yet.</div>`;
        return;
      }

      container.innerHTML = gameFiles
        .map((f) => {
          const displayName = f
            .replace(/\.[^.]+$/, "")
            .replace(/[-_]/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase());
          return `
        <div class="jsdos-game-card jsdos-user-card emu-card emu-card--removable" data-user-file="${f}">
          <i class="fa-solid fa-floppy-disk jsdos-game-icon emu-card-icon"></i>
          <div class="jsdos-game-title emu-card-title">${displayName}</div>
          <button class="jsdos-delete-btn" data-file="${f}" title="Delete"><i class="fa-solid fa-xmark"></i></button>
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
          await os.fs.deleteBinaryFile(GAMES_DIR, fileName);
          await this._loadUserGames(win);
        });
      });
    } catch {}
  }

  async launchGame(fileName, displayName) {
    const winId = `jsdos-${Date.now()}`;
    const win = os.window.create(winId, displayName, "800px", "600px", {
      icon: "static/icons/jsdos.webp"
    });
    os.events.emit("achievement:trigger", { achievementId: Achievements.RetroPlayer });

    win.innerHTML = `
    <div class="window-content jsdos-game-window emu-window">
      <div id="${winId}-inner" class="jsdos-loading emu-window-screen emu-load-wrap">
        <i class="fa-solid fa-compact-disc jsdos-loading-spinner emu-state-icon"></i>
        <div class="jsdos-game-loading-text emu-state-text emu-state-text--accent">Loading <strong>${displayName}</strong>…</div>
        <div id="${winId}-log" class="jsdos-game-log emu-log"></div>
      </div>
    </div>`;

    const inner = win.querySelector(`#${winId}-inner`);
    const log = win.querySelector(`#${winId}-log`);
    const setLog = (msg) => {
      if (log) log.textContent = msg;
    };
    const showError = (msg) => {
      if (inner)
        inner.innerHTML = `
      <div class="jsdos-error emu-error">
        <i class="fa-solid fa-triangle-exclamation jsdos-error-icon emu-state-icon"></i>
        <div class="jsdos-error-msg emu-state-text emu-state-text--error">${msg}</div>
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

    this.onClose(winId, cleanup);

    try {
      setLog("Downloading game…");
      const gameUrl = `https://cdn.jsdelivr.net/gh/Reeyuki/yukios@main/static/apps/jsdos/${fileName}`;

      const response = await fetch(gameUrl);
      if (!response.ok) {
        showError(`Failed to download: ${response.statusText}`);
        return;
      }

      const arrayBuffer = await response.arrayBuffer();
      const bundleBlob = new Blob([arrayBuffer], { type: "application/zip" });
      bundleUrl = URL.createObjectURL(bundleBlob);

      os.notify.send("JsDos", `Saved ${fileName} jsdos game at Games/ directory.`);
      setLog("Launching…");

      const iframeHTML = this._buildIframeHTML(bundleUrl);
      const iframeBlobUrl = URL.createObjectURL(new Blob([iframeHTML], { type: "text/html" }));
      iframePageUrl = iframeBlobUrl;

      inner.innerHTML = "";
      inner.classList.remove("jsdos-loading", "emu-load-wrap");

      iframeEl = document.createElement("iframe");
      iframeEl.src = iframeBlobUrl;
      iframeEl.className = "emu-iframe";
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
    const zipEntries = {
      ".jsdos": {
        "dosbox.conf": new TextEncoder().encode(conf)
      },
      [name]: new Uint8Array(arrayBuffer)
    };
    const zipped = zipSync(zipEntries);
    return new Blob([zipped.buffer], { type: "application/zip" });
  }

  async launchExe(name, path) {
    const winId = `jsdos-${Date.now()}`;
    const win = os.window.create(winId, name, "800px", "600px", {
      icon: "static/icons/jsdos.webp"
    });
    os.events.emit("achievement:trigger", { achievementId: Achievements.RetroPlayer });
    win.innerHTML = `
    <div class="window-content jsdos-game-window">
      <div id="${winId}-inner" style="width:100%;height:100%;" class="jsdos-loading">
        <i class="fa-solid fa-compact-disc jsdos-loading-spinner"></i>
        <div class="jsdos-game-loading-text">Loading <strong>${name}</strong>…</div>
        <div id="${winId}-log" class="jsdos-game-log"></div>
      </div>
    </div>`;

    const inner = win.querySelector(`#${winId}-inner`);
    const log = win.querySelector(`#${winId}-log`);
    const setLog = (msg) => {
      if (log) log.textContent = msg;
    };
    const showError = (msg) => {
      if (inner)
        inner.innerHTML = `
      <div class="jsdos-error jsdos-error-inline">
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

    this.onClose(winId, cleanup);

    try {
      setLog("Reading file…");
      const normalizedPath = Array.isArray(path)
        ? path
        : typeof path === "string"
          ? path.split("/").filter(Boolean)
          : Object.values(path ?? {}).filter((v) => typeof v === "string");

      console.log("jsdos launchExe:", { name, path, normalizedPath });
      const blob = await os.fs.readBinaryFile(normalizedPath, name);
      console.log("jsdos blob:", { blob, size: blob?.size, type: blob?.type });

      if (!blob || blob.size === 0) {
        console.error("jsdos: Failed to read file - blob is empty or null", { blob, name, normalizedPath });
        showError("Failed to read file.");
        return;
      }

      const isBundle = name.toLowerCase().endsWith(".jsdos");

      setLog(isBundle ? "Preparing bundle…" : "Building js-dos bundle…");
      const arrayBuffer = await blob.arrayBuffer();
      console.log("jsdos arrayBuffer:", { size: arrayBuffer.byteLength, isBundle });

      const bundleBlob = isBundle
        ? new Blob([arrayBuffer], { type: "application/zip" })
        : await this._buildBundle(name, arrayBuffer);

      console.log("jsdos bundleBlob:", { size: bundleBlob.size, type: bundleBlob.type });
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
