import { Achievements } from "../achievements.js";
import { zipSync } from "fflate";

import { setStyle, BusEvents, BaseApp, os } from "../framework.js";
import {
  normalizePath,
  fileNameToDisplayName,
  buildLoadingStateHTML,
  buildErrorHTML,
  setLog,
  renderEmulatorFileList,
  handleEmulatorUpload
} from "../shared/emulatorBase.js";
const GAMES_DIR = ["Games"];

export class JsDosApp extends BaseApp {
  constructor(os) {
    super(os);
    this.explorerApp = os.app.getInstance("explorerApp");
  }

  async open() {
    if (await this.isSingletonOpen("jsdos-win")) return;

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
          ${this.generateGameCards()}
        </div>
      </div>`;

    this.setupGameCardListeners(win);
    this.setupUploadZone(win);
    this.loadUserGames(win);
  }

  generateGameCards() {
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

  setupGameCardListeners(win) {
    const cards = win.querySelectorAll(".jsdos-game-card");
    cards.forEach((card) => {
      card.addEventListener("click", () => {
        const gameFile = card.dataset.game;
        const gameName = card.querySelector(".jsdos-game-title").textContent;
        this.launchGame(gameFile, gameName);
      });
    });
  }

  setupUploadZone(win) {
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
      if (file) this.handleUploadedFile(file, win);
    });

    input.addEventListener("change", () => {
      const file = input.files[0];
      if (file) this.handleUploadedFile(file, win);
      input.value = "";
    });
  }

  async handleUploadedFile(file, win) {
    handleEmulatorUpload({
      zone: win.querySelector("#jsdos-upload-zone"),
      files: [file],
      dir: GAMES_DIR,
      kind: "other",
      icon: "/static/icons/jsdos.webp",
      emitChanged: false,
      spinnerHTML: `<i class="fa-solid fa-spinner fa-spin jsdos-loading-icon"></i><div class="jsdos-loading-text">Saving <strong>${file.name}</strong>…</div>`,
      successHTML: `<i class="fa-solid fa-circle-check jsdos-success-icon"></i><div class="jsdos-success-text">Saved!</div>`,
      errorHTML: (msg) =>
        `<i class="fa-solid fa-triangle-exclamation jsdos-error-icon"></i><div class="jsdos-error-text">${msg}</div>`,
      onSaved: () => os.notify.send("JsDos", `Saved ${file.name} to Games.`),
      onReload: () => this.loadUserGames(win)
    });
  }

  async loadUserGames(win) {
    const container = win.querySelector("#jsdos-user-games");
    if (!container) return;

    renderEmulatorFileList({
      container,
      dir: GAMES_DIR,
      filter: (f) => f.endsWith(".jsdos") || f.endsWith(".exe") || f.endsWith(".com"),
      emptyHTML: `<div class="jsdos-empty-text">No uploaded games yet.</div>`,
      cardHTML: (f) => `
        <div class="jsdos-game-card jsdos-user-card emu-card emu-card--removable" data-user-file="${f}">
          <i class="fa-solid fa-floppy-disk jsdos-game-icon emu-card-icon"></i>
          <div class="jsdos-game-title emu-card-title">${fileNameToDisplayName(f)}</div>
          <button class="jsdos-delete-btn" data-file="${f}" title="Delete"><i class="fa-solid fa-xmark"></i></button>
        </div>
      `,
      cardSelector: ".jsdos-user-card",
      deleteBtnSelector: ".jsdos-delete-btn",
      deleteAction: (name) => os.fs.deleteBinaryFile(GAMES_DIR, name),
      onCardClick: (fileName) => this.launchExe(fileName, GAMES_DIR),
      onReload: () => this.loadUserGames(win)
    });
  }

  async launchGame(fileName, displayName) {
    const winId = `jsdos-${Date.now()}`;
    const win = os.window.create(winId, displayName, "800px", "600px", {
      icon: "static/icons/jsdos.webp"
    });
    os.events.emit(BusEvents.ACHIEVEMENT_TRIGGER, { achievementId: Achievements.RetroPlayer });

    win.innerHTML = `
    <div class="window-content jsdos-game-window emu-window">
      ${buildLoadingStateHTML({
        winId,
        iconClass: "fa-solid fa-compact-disc jsdos-loading-spinner emu-state-icon",
        wrapperClass: "jsdos-loading emu-window-screen emu-load-wrap",
        textClass: "jsdos-game-loading-text emu-state-text",
        logClass: "jsdos-game-log emu-log",
        displayName
      })}
    </div>`;

    const inner = win.querySelector(`#${winId}-inner`);
    const log = win.querySelector(`#${winId}-log`);
    const showError = (msg) => {
      if (inner)
        inner.innerHTML = buildErrorHTML({
          msg,
          wrapperClass: "jsdos-error emu-error",
          iconClass: "fa-solid fa-triangle-exclamation jsdos-error-icon emu-state-icon",
          textClass: "jsdos-error-msg emu-state-text emu-state-text--error"
        });
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
      setLog(log, "Downloading game…");
      const gameUrl = `https://cdn.jsdelivr.net/gh/Reeyuki/yukios@main/static/apps/jsdos/${fileName}`;

      const response = await fetch(gameUrl);
      if (!response.ok) {
        showError(`Failed to download: ${response.statusText}`);
        return;
      }

      const arrayBuffer = await response.arrayBuffer();
      const bundleBlob = new Blob([arrayBuffer], { type: "application/zip" });
      bundleUrl = URL.createObjectURL(bundleBlob);

      os.notify.send("JsDos", `Saved ${fileName} to Games.`);
      setLog(log, "Launching…");

      const iframeHTML = this.buildIframeHTML(bundleUrl);
      const iframeBlobUrl = URL.createObjectURL(new Blob([iframeHTML], { type: "text/html" }));
      iframePageUrl = iframeBlobUrl;

      inner.innerHTML = "";
      inner.classList.remove("jsdos-loading", "emu-load-wrap");

      iframeEl = document.createElement("iframe");
      iframeEl.src = iframeBlobUrl;
      setStyle(iframeEl, { width: "100%", height: "100%", border: "none", display: "block" });
      iframeEl.setAttribute("allowfullscreen", "");
      inner.appendChild(iframeEl);
    } catch (e) {
      showError(`Error: ${e.message}`);
    }
  }

  buildIframeHTML(bundleUrl) {
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
        window.ci = ci;
      }
    }
  });
  window.addEventListener("message", function(e) {
    if (e.data === "mute" && window.ci) { try { window.ci.mute(); } catch {} }
  });
<\/script>
</body>
</html>`;
  }

  async buildBundle(name, arrayBuffer) {
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
    os.events.emit(BusEvents.ACHIEVEMENT_TRIGGER, { achievementId: Achievements.RetroPlayer });
    win.innerHTML = `
    <div class="window-content jsdos-game-window">
      ${buildLoadingStateHTML({
        winId,
        iconClass: "fa-solid fa-compact-disc jsdos-loading-spinner",
        wrapperClass: "jsdos-loading",
        textClass: "jsdos-game-loading-text",
        logClass: "jsdos-game-log",
        displayName: name
      })}
    </div>`;

    const inner = win.querySelector(`#${winId}-inner`);
    const log = win.querySelector(`#${winId}-log`);
    const showError = (msg) => {
      if (inner)
        inner.innerHTML = buildErrorHTML({
          msg,
          wrapperClass: "jsdos-error jsdos-error-inline",
          iconClass: "fa-solid fa-triangle-exclamation jsdos-error-icon",
          textClass: "jsdos-error-msg"
        });
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
      setLog(log, "Reading file…");
      const normalizedPath = normalizePath(path);

      const blob = await os.fs.readBinaryFile(normalizedPath, name);

      if (!blob || blob.size === 0) {
        console.error("jsdos: Failed to read file - blob is empty or null", { blob, name, normalizedPath });
        showError("Failed to read file.");
        return;
      }

      const isBundle = name.toLowerCase().endsWith(".jsdos");

      setLog(log, isBundle ? "Preparing bundle…" : "Building js-dos bundle…");
      const arrayBuffer = await blob.arrayBuffer();

      const bundleBlob = isBundle
        ? new Blob([arrayBuffer], { type: "application/zip" })
        : await this.buildBundle(name, arrayBuffer);

      bundleUrl = URL.createObjectURL(bundleBlob);

      setLog(log, "Launching…");

      const iframeHTML = this.buildIframeHTML(bundleUrl);
      const iframeBlobUrl = URL.createObjectURL(new Blob([iframeHTML], { type: "text/html" }));
      iframePageUrl = iframeBlobUrl;

      inner.innerHTML = "";
      setStyle(inner, { width: "100%", height: "100%" });
      inner.classList.remove("jsdos-loading");

      iframeEl = document.createElement("iframe");
      iframeEl.src = iframeBlobUrl;
      setStyle(iframeEl, { width: "100%", height: "100%", border: "none", display: "block" });
      iframeEl.setAttribute("allowfullscreen", "");
      inner.appendChild(iframeEl);
    } catch (e) {
      showError(`Error: ${e.message}`);
    }
  }
}
