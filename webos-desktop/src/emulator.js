import { Achievements } from "./achievements.js";
import { bus, BusEvents } from "./core/EventBus.js";
import { BaseApp } from "./core/BaseApp.js";
import { WindowHelper } from "./utils/WindowHelper.js";
import { CDN_BASES } from "./shared/assetResolver.js";
import { CDN_CONFIG } from "./shared/cdnConfig.js";

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
  n64: ["mupen64plus_next", "parallel_n64"],
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
  constructor(services) {
    super(services);
    this.windowHelper = new WindowHelper(this.wm);
    this._explorerApp = services.explorerApp;
  }

  open() {
    if (this._isSingletonOpen("emulator-win")) return;

    const allExtensions = new Set();
    Object.values(supportedExtensions).forEach((exts) => {
      exts.forEach((ext) => allExtensions.add(ext));
    });
    const extList = Array.from(allExtensions).sort().join(", ");

    const content = `
      <div class="window-content" style="width:100%;height:100%;background:#1a1a2e;color:#eee;font-family:monospace;overflow-y:auto;overflow-x:hidden;">
        <div class="emulator-header" style="display:flex;align-items:center;gap:16px;padding:24px 20px 16px;">
          <i class="fa-solid fa-gamepad" style="font-size:38px;color:#ff6b9d;"></i>
          <div>
            <div style="font-size:20px;font-weight:bold;color:#fff;">Emulator JS</div>
            <div style="font-size:13px;color:#888;">Play classic games in your browser</div>
          </div>
        </div>
        <div 
          id="emulator-upload-zone"
          class="emulator-upload-zone"
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
          <i class="fa-solid fa-gamepad" style="font-size:32px;color:#ff6b9d;margin-bottom:12px;display:block;"></i>
          <div style="font-size:14px;color:#bbb;margin-bottom:8px;">Drop a ROM or click to browse</div>
          <div style="font-size:11px;color:#666;margin-bottom:12px;">Supports multiple files and .zip archives</div>
          <div style="font-size:10px;color:#555;line-height:1.6;max-width:600px;margin:0 auto;">
            <strong style="color:#888;">Supported formats:</strong><br>
            ${extList}
          </div>
          <input type="file" id="emulator-file-input" accept="${Array.from(allExtensions).join(",")}, .zip" multiple style="display:none;">
        </div>
        <div style="padding:16px 16px 8px;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;">My ROMs</div>
        <div id="emulator-user-roms" style="padding:0 16px 16px;display:flex;flex-wrap:wrap;gap:12px;"></div>
      </div>`;

    const win = this.windowHelper.createAndMountWindow("emulator-win", "Yuki Emulator", content, "800px", "600px", {
      icon: "static/icons/emulator.webp"
    });

    this._setupUploadZone(win);
    this._loadUserRoms(win);
  }

  _setupUploadZone(win) {
    const zone = win.querySelector("#emulator-upload-zone");
    const input = win.querySelector("#emulator-file-input");

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
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) this._handleUploadedFiles(files, win);
    });

    input.addEventListener("change", () => {
      const files = Array.from(input.files);
      if (files.length > 0) this._handleUploadedFiles(files, win);
      input.value = "";
    });
  }

  async _handleUploadedFiles(files, win) {
    const zone = win.querySelector("#emulator-upload-zone");
    const originalHTML = zone.innerHTML;

    zone.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="font-size:24px;color:#ff6b9d;margin-bottom:12px;display:block;"></i><div style="font-size:13px;color:#bbb;">Saving ${files.length} file(s)…</div>`;

    try {
      for (const file of files) {
        const blob = new Blob([await file.arrayBuffer()], { type: file.type || "application/octet-stream" });
        await this.fs.writeBinaryFile(
          ROMS_DIR,
          file.name,
          blob,
          "other",
          CDN_BASES.MAIN + "/static/icons/emulator.webp"
        );
        await this.fs.writeBinaryFile(
          DESKTOP_DIR,
          file.name,
          blob,
          "rom",
          CDN_BASES.MAIN + "/static/icons/emulator.webp"
        );
        bus.emit(BusEvents.FILE_CHANGED, { path: file.name, kind: "created" });
      }

      this.wm.sendNotify(`Saved ${files.length} file(s) to ROMs/ directory.`);
      zone.innerHTML = `<i class="fa-solid fa-circle-check" style="font-size:24px;color:#4caf50;margin-bottom:12px;display:block;"></i><div style="font-size:13px;color:#bbb;">Saved ${files.length} file(s)!</div>`;
      await this._loadUserRoms(win);

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

  async _loadUserRoms(win) {
    const container = win.querySelector("#emulator-user-roms");
    if (!container) return;

    try {
      await this.fs.fsReady;
      const dir = this.fs.resolveUserPath(ROMS_DIR);
      await this.fs.p("mkdir", dir, { recursive: true }).catch(() => {});
      const files = await this.fs.pRead("readdir", dir).catch(() => []);

      const allExts = new Set();
      Object.values(supportedExtensions).forEach((exts) => {
        exts.forEach((ext) => allExts.add(ext));
      });
      allExts.add(".zip");

      const romFiles = files.filter(
        (f) => !f.startsWith(".") && Array.from(allExts).some((ext) => f.toLowerCase().endsWith(ext))
      );

      if (romFiles.length === 0) {
        container.innerHTML = `<div style="font-size:12px;color:#555;padding:4px 0;">No ROMs uploaded yet.</div>`;
        return;
      }

      container.innerHTML = romFiles
        .map((f) => {
          const displayName = f
            .replace(/\.[^.]+$/, "")
            .replace(/[-_]/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase());

          const ext = f.toLowerCase().split(".").pop();
          const system = this._detectSystem(ext);
          const icon = system ? "fa-gamepad" : "fa-file-zipper";

          return `
        <div class="emulator-rom-card" data-user-file="${f}" style="
          background:#252540;border-radius:10px;padding:14px 16px;
          display:flex;align-items:center;gap:12px;cursor:pointer;
          transition:transform .15s,box-shadow .15s;position:relative;min-width:200px;
        ">
          <i class="fa-solid ${icon}" style="font-size:22px;color:#ff6b9d;"></i>
          <div style="flex:1;overflow:hidden;">
            <div style="font-size:13px;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${displayName}</div>
            <div style="font-size:10px;color:#666;margin-top:2px;">${ext.toUpperCase()}${system ? ` • ${system}` : ""}</div>
          </div>
          <button class="emulator-delete-btn" data-file="${f}" title="Delete" style="
            background:none;border:none;color:#666;cursor:pointer;font-size:13px;padding:2px 4px;line-height:1;
          "><i class="fa-solid fa-xmark"></i></button>
        </div>
      `;
        })
        .join("");

      container.querySelectorAll(".emulator-rom-card").forEach((card) => {
        card.addEventListener("click", (e) => {
          if (e.target.closest(".emulator-delete-btn")) return;
          const fileName = card.dataset.userFile;
          this.launchROM(fileName, ROMS_DIR);
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

      container.querySelectorAll(".emulator-delete-btn").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const fileName = btn.dataset.file;
          await this.fs.deleteBinaryFile(ROMS_DIR, fileName);
          await this._loadUserRoms(win);
        });
      });
    } catch {}
  }

  _detectSystem(ext) {
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
    const normalizedPath = Array.isArray(path)
      ? path
      : typeof path === "string"
        ? path.split("/").filter(Boolean)
        : Object.values(path ?? {}).filter((v) => typeof v === "string");

    try {
      const blob = await this.fs.readBinaryFile(normalizedPath, fileName);
      if (!blob || blob.size === 0) {
        this.wm.sendNotify("Failed to read ROM file.");
        return;
      }

      const arrayBuffer = await blob.arrayBuffer();
      const ext = fileName.toLowerCase().split(".").pop();

      if (ext === "zip") {
        await this._handleZipFile(arrayBuffer, fileName);
        return;
      }

      const displayName = fileName
        .replace(/\.[^.]+$/, "")
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

      this._launchEmulator(displayName, fileName, arrayBuffer);
    } catch (e) {
      this.wm.sendNotify(`Error loading ROM: ${e.message}`);
    }
  }

  async _handleZipFile(arrayBuffer, fileName) {
    this.wm.sendNotify("ZIP file support requires additional library. Please extract and upload individual ROMs.");
  }

  async _launchEmulator(displayName, fileName, romData, forcedCore = null) {
    const wm = this.wm;
    const winId = `emulator-${Date.now()}`;
    const win = wm.createWindow(winId, displayName, "800px", "600px");

    bus.emit(BusEvents.ACHIEVEMENT_TRIGGER, { key: Achievements.RetroPlayer });

    win.innerHTML = `
    <div class="window-header">
      <span>${displayName}</span>
      ${wm.getWindowControls()}
    </div>
    <div class="window-content" style="width:100%;height:calc(100% - 30px);background:#000;position:relative;overflow:hidden;">
      <div id="${winId}-inner" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;">
        <i class="fa-solid fa-gamepad fa-spin" style="font-size:32px;color:#ff6b9d;"></i>
        <div style="font-size:15px;color:#ff6b9d;">Loading <strong style="color:#fff;">${displayName}</strong>…</div>
        <div id="${winId}-log" style="font-size:11px;color:#888;max-width:400px;text-align:center;"></div>
      </div>
      <div id="${winId}-screen" style="width:100%;height:100%;display:none;"></div>
    </div>`;

    this.windowHelper.mountWindow(win, winId, displayName, "static/icons/emulator.webp");

    const inner = win.querySelector(`#${winId}-inner`);
    const screenDiv = win.querySelector(`#${winId}-screen`);
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
    };

    wm.setupWindowControls(win);

    try {
      setLog("Detecting system…");

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
          n64: "mupen64plus_next",
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

      setLog(`Loading ${emulatorSystem} core…`);

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
window.EJS_color = "#ff6b9d";
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
    const displayName = fileName
      .replace(/\.[^.]+$/, "")
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arrayBuffer = await res.arrayBuffer();
      this._launchEmulator(displayName, fileName, arrayBuffer, core);
    } catch (e) {
      this.wm.sendNotify(`Failed to load ROM: ${e.message}`);
    }
  }

  async launchFromFile(file) {
    const arrayBuffer = await file.arrayBuffer();
    const fileName = file.name;

    const displayName = fileName
      .replace(/\.[^.]+$/, "")
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

    this._launchEmulator(displayName, fileName, arrayBuffer);
  }
}
