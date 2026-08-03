import "../styles/emulator.css";
import { CDN_CONFIG } from "../shared/cdnConfig.js";

import { audioMixer } from "../audioMixer.js";
import { BaseApp, os, brand } from "../framework.js";
import { resolveIconUrl } from "../shared/assetResolver.js";
import {
  normalizePath,
  fileNameToDisplayName,
  buildLoadingStateHTML,
  buildErrorHTML,
  setLog,
  renderEmulatorFileList,
  handleEmulatorUpload
} from "../shared/emulatorBase.js";
const EMULATOR_ICON = "static/icons/emulator.webp";
const ROMS_DIR = ["ROMs"];
const DESKTOP_DIR = ["Desktop"];

export const version = "4.3.0-beta";

export const cores = {
  atari5200: ["a5200"],
  vb: ["beetle_vb"],
  nds: ["melonds", "desmume", "desmume2015"],
  arcade: ["fbneo", "fbalpha2012_cps1", "fbalpha2012_cps2", "same_cdi"],
  nes: ["fceumm", "nestopia"],
  gb: ["gambatte"],
  coleco: ["gearcoleco"],
  segaMS: ["smsplus", "genesis_plus_gx", "genesis_plus_gx_wide", "picodrive"],
  segaMD: ["genesis_plus_gx", "genesis_plus_gx_wide", "picodrive"],
  segaGG: ["genesis_plus_gx", "genesis_plus_gx_wide"],
  segaCD: ["genesis_plus_gx", "genesis_plus_gx_wide", "picodrive"],
  sega32x: ["picodrive"],
  sega: ["genesis_plus_gx", "genesis_plus_gx_wide", "picodrive"],
  lynx: ["handy"],
  mame: ["mame2003_plus", "mame2003"],
  ngp: ["mednafen_ngp"],
  pce: ["mednafen_pce"],
  pcfx: ["mednafen_pcfx"],
  psx: ["pcsx_rearmed", "mednafen_psx_hw"],
  ws: ["mednafen_wswan"],
  gba: ["mgba"],
  n64: ["mupen64plusnext", "parallel_n64"],
  "3do": ["opera"],
  atari7800: ["prosystem"],
  snes: ["snes9x", "bsnes"],
  atari2600: ["stella2014"],
  jaguar: ["virtualjaguar"],
  segaSaturn: ["yabause"],
  amiga: ["puae"],
  c64: ["vice_x64sc"],
  c128: ["vice_x128"],
  pet: ["vice_xpet"],
  plus4: ["vice_xplus4"],
  vic20: ["vice_xvic"],
  intv: ["freeintv"]
};

const supportedExtensions = {
  nes: [".nes", ".fds", ".unf"],
  snes: [".smc", ".sfc", ".fig", ".swc"],
  gb: [".gb", ".gbc"],
  gba: [".gba"],
  nds: [".nds"],
  n64: [".n64", ".z64", ".v64"],
  psx: [".bin", ".cue", ".img", ".iso", ".pbp"],
  segaMD: [".md", ".smd", ".gen", ".bin"],
  segaMS: [".sms"],
  segaGG: [".gg"],
  segaCD: [".bin", ".cue", ".iso"],
  sega32x: [".32x", ".bin"],
  segaSaturn: [".bin", ".cue", ".iso"],
  pce: [".pce"],
  pcfx: [".cue", ".ccd", ".toc"],
  atari2600: [".a26", ".bin"],
  atari5200: [".a52", ".bin"],
  atari7800: [".a78"],
  lynx: [".lnx"],
  ngp: [".ngp", ".ngc"],
  ws: [".ws", ".wsc"],
  vb: [".vb"],
  "3do": [".iso", ".cue"],
  jaguar: [".j64", ".jag"],
  coleco: [".col"],
  intv: [".int", ".bin"],
  arcade: [".zip"],
  mame: [".zip"],
  amiga: [".adf", ".dms", ".ipf"],
  c64: [".d64", ".t64", ".prg"],
  c128: [".d64", ".t64", ".prg"],
  pet: [".prg", ".tap"],
  plus4: [".prg", ".tap"],
  vic20: [".prg", ".tap"]
};

export class EmulatorApp extends BaseApp {
  constructor(os) {
    super(os);
    this.explorerApp = os.app.getInstance("explorerApp");
  }

  open(opts) {
    const allExtensions = new Set();
    Object.values(supportedExtensions).forEach((exts) => {
      exts.forEach((ext) => allExtensions.add(ext));
    });
    const extList = Array.from(allExtensions).sort().join(", ");

    const win = os.window.create("emulator-win", brand("Yuki Emulator"), "800px", "600px", {
      icon: EMULATOR_ICON
    });
    win.innerHTML = `
      <div class="emu-shell ruf-container">
        <div class="emu-header ruf-header">
          <img src="${resolveIconUrl(EMULATOR_ICON)}" class="emu-header-icon ruf-icon-main">
          <div class="emu-header-text">
            <div class="emu-title ruf-title">Emulator JS</div>
            <div class="emu-subtitle ruf-subtitle">Play classic games in your browser</div>
          </div>
        </div>
        
        <div id="emulator-upload-zone" class="emu-upload-zone ruf-upload-zone">
          <i class="fa-solid fa-file-arrow-up emu-upload-icon ruf-upload-icon"></i>
          <div class="emu-upload-text ruf-upload-text">Drop a ROM or click to browse</div>
          <div class="emu-upload-subtext ruf-upload-subtext">Supports multiple files and .zip archives</div>
          <div class="emu-upload-formats">
            <strong>Supported formats:</strong><br>
            ${extList}
          </div>
          <input type="file" id="emulator-file-input" class="emu-file-input" accept="${Array.from(allExtensions).join(",")}, .zip" multiple>
        </div>
        
        <div class="emu-section-title ruf-section-title">My ROMs</div>
        <div id="emulator-user-roms" class="emu-grid ruf-file-grid"></div>
      </div>`;

    const uploadZone = win.querySelector("#emulator-upload-zone");
    const fileInput = win.querySelector("#emulator-file-input");

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
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) await this.handleUploadedFiles(files, uploadZone);
    });

    fileInput?.addEventListener("change", async () => {
      const files = Array.from(fileInput.files);
      if (files.length > 0) await this.handleUploadedFiles(files, uploadZone);
      fileInput.value = "";
    });

    this.loadUserRoms();
    if (window.FontAwesome && window.FontAwesome.dom && window.FontAwesome.dom.i2svg) {
      const container = win.querySelector(".emu-shell");
      if (container) {
        window.FontAwesome.dom.i2svg({ node: container });
      }
    }
  }

  async loadUserRoms() {
    const allExts = new Set();
    Object.values(supportedExtensions).forEach((exts) => {
      exts.forEach((ext) => allExts.add(ext));
    });
    allExts.add(".zip");

    renderEmulatorFileList({
      container: document.getElementById("emulator-user-roms"),
      dir: ROMS_DIR,
      filter: (f) => Array.from(allExts).some((ext) => f.toLowerCase().endsWith(ext)),
      emptyHTML: `<div class="emu-empty ruf-empty">No ROMs uploaded yet.</div>`,
      cardHTML: (f) => {
        const ext = f.toLowerCase().split(".").pop();
        const system = this.detectSystem(ext);
        const icon = system ? "fa-gamepad" : "fa-file-zipper";

        return `
            <div class="emu-card ruf-file-card emu-card--removable" data-user-file="${f}">
              <i class="fa-solid ${icon} emu-card-icon ruf-file-icon"></i>
              <div class="emu-card-body ruf-file-info">
                <div class="emu-card-title ruf-file-name">${fileNameToDisplayName(f)}</div>
                <div class="emu-card-meta ruf-file-type">${ext.toUpperCase()}${system ? ` • ${system}` : ""}</div>
              </div>
              <button class="emu-delete-btn ruf-delete-btn" data-file="${f}" title="Delete">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
          `;
      },
      cardSelector: ".ruf-file-card",
      deleteBtnSelector: ".ruf-delete-btn",
      deleteAction: (name) => os.fs.delete(ROMS_DIR, name),
      onCardClick: (fileName) => this.launchROM(fileName, ROMS_DIR),
      onReload: () => this.loadUserRoms()
    });
  }

  async handleUploadedFiles(files, zone) {
    handleEmulatorUpload({
      zone,
      files,
      dir: ROMS_DIR,
      kind: "other",
      icon: resolveIconUrl(EMULATOR_ICON),
      extraDirs: [{ dir: DESKTOP_DIR, kind: "rom" }],
      emitChanged: true,
      spinnerHTML: `<i class="fa-solid fa-spinner fa-spin emu-state-icon ruf-state-icon"></i><div class="emu-state-text ruf-state-text">Saving ${files.length} file(s)…</div>`,
      successHTML: `<i class="fa-solid fa-circle-check emu-state-icon ruf-state-icon"></i><div class="emu-state-text ruf-state-text">Saved ${files.length} file(s)!</div>`,
      errorHTML: (msg) =>
        `<i class="fa-solid fa-triangle-exclamation emu-state-icon ruf-state-icon emu-state--error"></i><div class="emu-state-text ruf-state-text emu-state--error">${msg}</div>`,
      onSaved: () => os.notify.send("", `Saved ${files.length} file(s) to ROMs.`),
      onReload: () => this.loadUserRoms()
    });
  }

  detectSystem(ext) {
    for (const [system, exts] of Object.entries(supportedExtensions)) {
      if (exts.some((e) => e === `.${ext}`)) {
        const systemNames = {
          nes: "NES",
          snes: "SNES",
          gb: "Game Boy",
          gba: "GBA",
          nds: "NDS",
          n64: "N64",
          psx: "PS1",
          segaMD: "Genesis",
          segaMS: "Master System",
          segaGG: "Game Gear",
          segaCD: "Sega CD",
          sega32x: "32X",
          segaSaturn: "Saturn",
          pce: "PC Engine",
          atari2600: "Atari 2600",
          atari5200: "Atari 5200",
          atari7800: "Atari 7800"
        };
        return systemNames[system] || system.toUpperCase();
      }
    }
    return null;
  }

  async launchROM(fileName, path) {
    const normalizedPath = normalizePath(path);

    try {
      const blob = await os.fs.read([...normalizedPath, fileName]);
      if (!blob || blob.size === 0) {
        audioMixer().playCriticalWarning();
        os.notify.send("", "Couldn't read that ROM file.");
        return;
      }

      const arrayBuffer = await blob.arrayBuffer();
      const ext = fileName.toLowerCase().split(".").pop();

      if (ext === "zip") {
        await this.handleZipFile(arrayBuffer, fileName);
        return;
      }

      const displayName = fileNameToDisplayName(fileName);

      this.launchEmulator(displayName, fileName, arrayBuffer);
    } catch (e) {
      audioMixer().playCriticalWarning();
      os.notify.send("", `ROM wouldn't load: ${e.message}`);
    }
  }

  async handleZipFile(arrayBuffer, fileName) {
    os.notify.send("", "Can't read zips directly. Extract the ROM first, then upload it.");
  }

  async launchEmulator(displayName, fileName, romData, forcedCore = null) {
    const winId = `emulator-${Date.now()}`;
    const win = os.window.create(winId, displayName, "800px", "600px", {
      icon: EMULATOR_ICON
    });

    win.innerHTML = `
    <div class="window-content emu-window ruf-window">
      ${buildLoadingStateHTML({
        winId,
        iconClass: "fa-solid fa-gamepad fa-spin ruf-state-icon emu-state-icon",
        wrapperClass: "emu-state ruf-loading emu-load-wrap",
        textClass: "emu-state-text ruf-state-text",
        logClass: "emu-state-text--muted ruf-log",
        displayName
      })}
      <div id="${winId}-screen" class="emu-window-screen"></div>
    </div>`;

    const inner = win.querySelector(`#${winId}-inner`);
    const screenDiv = win.querySelector(`#${winId}-screen`);
    const log = win.querySelector(`#${winId}-log`);

    const showError = (msg) => {
      if (inner)
        inner.innerHTML = buildErrorHTML({
          msg,
          wrapperClass: "emu-state emu-state--error ruf-error",
          iconClass: "fa-solid fa-triangle-exclamation ruf-state-icon emu-state-icon emu-state--error",
          textClass: "emu-state-text ruf-state-text emu-state--error"
        });
    };

    try {
      setLog(log, "Detecting system…");

      const extension = "." + fileName.toLowerCase().split(".").pop();

      let emulatorSystem, emulatorCore;

      if (forcedCore) {
        emulatorSystem = forcedCore;
        emulatorCore = cores[forcedCore]?.[0] ?? forcedCore;
      } else {
        let detectedSystem = null;

        for (const [system, extensions] of Object.entries(supportedExtensions)) {
          if (extensions.includes(extension)) {
            detectedSystem = system;
            break;
          }
        }

        if (!detectedSystem) {
          throw new Error(`Unsupported ROM type: ${extension}`);
        }

        const emulatorSystemMap = {
          nes: "nes",
          snes: "snes",
          gb: "gb",
          gba: "gba",
          nds: "nds",
          n64: "n64",
          psx: "psx",
          segaMD: "segaMD",
          segaMS: "segaMS",
          segaGG: "segaGG",
          atari2600: "atari2600",
          atari7800: "atari7800",
          vb: "vb"
        };

        const emulatorCoreMap = {
          nes: "fceumm",
          snes: "snes9x",
          gb: "gambatte",
          gba: "mgba",
          nds: "melonds",
          n64: "mupen64plusnext",
          psx: "pcsx_rearmed",
          segaMD: "genesis_plus_gx",
          segaMS: "genesis_plus_gx",
          segaGG: "genesis_plus_gx",
          atari2600: "stella2014",
          atari7800: "prosystem",
          vb: "beetle_vb"
        };

        emulatorSystem = emulatorSystemMap[detectedSystem];
        emulatorCore = emulatorCoreMap[detectedSystem];

        if (!emulatorSystem || !emulatorCore) {
          throw new Error(`No emulator configured for ${detectedSystem}`);
        }
      }

      setLog(log, `Starting ${emulatorSystem} core…`);

      const romBlob = new Blob([romData]);
      const romUrl = URL.createObjectURL(romBlob);

      inner.style.display = "none";
      screenDiv.style.display = "block";

      const iframeDoc = `<!DOCTYPE html>
<html><head><style>*{margin:0;padding:0;box-sizing:border-box;}html,body{width:100%;height:100%;background:#000;overflow:hidden;}</style></head>
<body>
<div id="game" style="width:100%;height:100%;"></div>
<script>
window.EJS_player = "#game";
window.EJS_core = ${JSON.stringify(emulatorCore)};
window.EJS_gameUrl = ${JSON.stringify(romUrl)};
window.EJS_pathtodata = ${JSON.stringify(CDN_CONFIG.libraries.emulatorjs.data)};
window.EJS_startOnLoaded = true;
window.EJS_color = "var(--brand)";
<\/script>
<script src=${JSON.stringify(CDN_CONFIG.libraries.emulatorjs.loader)}><\/script>
</body></html>`;

      const iframe = document.createElement("iframe");
      iframe.style.cssText = "width:100%;height:100%;border:none;display:block;";
      iframe.setAttribute("allow", "autoplay; fullscreen");
      iframe.srcdoc = iframeDoc;
      screenDiv.appendChild(iframe);
    } catch (e) {
      showError(`Failed to start: ${e.message}`);
    }
  }

  async launchFromUrl(url, core) {
    const fileName = url.split("/").pop().split("?")[0] || "game";
    const displayName = fileNameToDisplayName(fileName);

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arrayBuffer = await res.arrayBuffer();
      this.launchEmulator(displayName, fileName, arrayBuffer, core);
    } catch (e) {
      os.notify.send("ROM Load Failed", `ROM didn't load: ${e.message}`, "error", 5000);
    }
  }

  async launchFromFile(file) {
    const arrayBuffer = await file.arrayBuffer();
    const fileName = file.name;

    const displayName = fileNameToDisplayName(fileName);

    this.launchEmulator(displayName, fileName, arrayBuffer);
  }
}
