import { desktop } from "./desktop.js";
import { FileKind } from "./fs.js";
import { CORE_EXTENSIONS, detectCore, coreLabel } from "./shared/coreMap.js";

const desktopPath = ["Desktop"];

const ROM_EXTENSIONS = new Set([
  "gba",
  "gb",
  "gbc",
  "nds",
  "nes",
  "smc",
  "sfc",
  "n64",
  "z64",
  "v64",
  "bin",
  "cue",
  "iso",
  "cso",
  "pbp",
  "img",
  "md",
  "gen",
  "smd",
  "gg",
  "sms",
  "zip"
]);

const buildShellHtml = ({ core, romUrl, gameName, biosUrl, bios7Url, bios9Url, firmwareUrl, threads }) => {
  const assignments = [
    `window.EJS_player = '#game';`,
    `window.EJS_core = ${JSON.stringify(core)};`,
    `window.EJS_gameName = ${JSON.stringify(gameName)};`,
    `window.EJS_color = '#0064ff';`,
    `window.EJS_pathtodata = '${window.location.origin}/static/games/cdn.emulatorjs.org/stable/data';`,
    `window.EJS_gameUrl = ${JSON.stringify(romUrl)};`,
    biosUrl ? `window.EJS_biosUrl = ${JSON.stringify(biosUrl)};` : "",
    bios7Url ? `window.EJS_bios7Url = ${JSON.stringify(bios7Url)};` : "",
    bios9Url ? `window.EJS_bios9Url = ${JSON.stringify(bios9Url)};` : "",
    firmwareUrl ? `window.EJS_firmwareUrl = ${JSON.stringify(firmwareUrl)};` : "",
    threads ? `window.EJS_threads = true;` : ""
  ]
    .filter(Boolean)
    .join("\n");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; background: #000; overflow: hidden; }
  #game { width: 100%; height: 100%; }
</style>
</head>
<body>
<div id="game"></div>
<script>
${assignments}
</script>
<script src="${window.location.origin}/static/games/cdn.emulatorjs.org/stable/data/loader.js"></script>
</body>
</html>`;
};

export class EmulatorApp {
  constructor(fileSystemManager, windowManager) {
    this.fs = fileSystemManager;
    this.wm = windowManager;
  }

  open() {
    const winId = "emulator-launcher";
    const existing = document.getElementById(winId);
    if (existing) {
      this.wm.bringToFront(existing);
      return;
    }

    const win = this.wm.createWindow(winId, "Emulator", "600px", "520px");
    Object.assign(win.style, { left: "200px", top: "100px" });

    win.innerHTML = `
      <div class="window-header">
        <span>Emulator</span>
        ${this.wm.getWindowControls()}

      </div>
      <div class="window-content" style="display:flex;flex-direction:column;height:calc(100% - 32px);background:#0d0d10;overflow:hidden;">
        <style>
          #${winId} .emu-shell {
            display:flex;flex-direction:column;height:100%;overflow:hidden;
          }
          #${winId} .emu-tabs {
            display:flex;border-bottom:1px solid #1a1a28;flex-shrink:0;
          }
          #${winId} .emu-tab {
            padding:9px 18px;font-family:'Segoe UI',sans-serif;font-size:12px;font-weight:600;
            color:#50506a;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;
            letter-spacing:.05em;text-transform:uppercase;transition:color .15s,border-color .15s;
            background:none;border-top:none;border-left:none;border-right:none;outline:none;
          }
          #${winId} .emu-tab.active { color:#8090ff;border-bottom-color:#8090ff; }
          #${winId} .emu-tab:hover:not(.active) { color:#a0a0c0; }

          #${winId} .emu-panel { display:none;flex:1;overflow:hidden;flex-direction:column; }
          #${winId} .emu-panel.active { display:flex; }

          #${winId} .emu-drop-zone {
            flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;
            gap:14px;margin:20px;border:2px dashed #2a2a3a;border-radius:12px;
            background:#111118;transition:border-color .2s,background .2s;cursor:pointer;user-select:none;
          }
          #${winId} .emu-drop-zone.drag-over { border-color:#5b7fff;background:#13142a; }
          #${winId} .emu-drop-icon { font-size:48px;opacity:.5;pointer-events:none; }
          #${winId} .emu-drop-title { color:#c8c8d8;font-family:'Segoe UI',sans-serif;font-size:15px;font-weight:600;pointer-events:none; }
          #${winId} .emu-drop-sub { color:#50506a;font-family:'Segoe UI',sans-serif;font-size:12px;pointer-events:none; }
          #${winId} .emu-browse-btn {
            padding:7px 20px;background:#1e2040;border:1px solid #2e3060;border-radius:6px;
            color:#8090ff;font-family:'Segoe UI',sans-serif;font-size:12px;cursor:pointer;
            transition:background .15s,border-color .15s;
          }
          #${winId} .emu-browse-btn:hover { background:#252850;border-color:#5b7fff; }
          #${winId} .emu-file-input { display:none; }

          #${winId} .emu-preview { display:none;flex-direction:column;align-items:center;justify-content:center;gap:12px;flex:1;margin:20px; }
          #${winId} .emu-preview.visible { display:flex; }
          #${winId} .emu-rom-name {
            color:#e0e0f0;font-family:'Segoe UI',sans-serif;font-size:16px;font-weight:700;
            text-align:center;max-width:420px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
          }
          #${winId} .emu-core-selector { display:flex;flex-direction:column;align-items:center;gap:6px; }
          #${winId} .emu-core-label { color:#50506a;font-family:'Segoe UI',sans-serif;font-size:11px; }
          #${winId} .emu-core-select {
            padding:5px 10px;background:#111118;border:1px solid #2a2a3a;border-radius:6px;
            color:#c8c8d8;font-family:'Segoe UI',sans-serif;font-size:12px;cursor:pointer;outline:none;
          }
          #${winId} .emu-launch-btn {
            padding:10px 36px;background:linear-gradient(135deg,#3a4fff,#2233cc);border:none;border-radius:8px;
            color:#fff;font-family:'Segoe UI',sans-serif;font-size:14px;font-weight:700;cursor:pointer;
            letter-spacing:.04em;box-shadow:0 4px 20px rgba(58,79,255,.35);transition:opacity .15s,transform .1s;
          }
          #${winId} .emu-launch-btn:hover { opacity:.9;transform:translateY(-1px); }
          #${winId} .emu-launch-btn:active { transform:translateY(0); }
          #${winId} .emu-change-btn {
            background:none;border:none;color:#50506a;font-family:'Segoe UI',sans-serif;
            font-size:11px;cursor:pointer;text-decoration:underline;
          }
          #${winId} .emu-change-btn:hover { color:#8090ff; }

          #${winId} .emu-library-panel {
            display:flex;flex-direction:column;flex:1;overflow:hidden;
          }
          #${winId} .emu-library-search-wrap {
            padding:12px 16px 8px;flex-shrink:0;
          }
          #${winId} .emu-library-search {
            width:100%;padding:7px 12px;background:#111118;border:1px solid #2a2a3a;border-radius:8px;
            color:#c8c8d8;font-family:'Segoe UI',sans-serif;font-size:12px;outline:none;box-sizing:border-box;
            transition:border-color .15s;
          }
          #${winId} .emu-library-search:focus { border-color:#5b7fff; }
          #${winId} .emu-library-search::placeholder { color:#383850; }

          #${winId} .emu-library-list {
            flex:1;overflow-y:auto;padding:4px 12px 12px;
            scrollbar-width:thin;scrollbar-color:#2a2a3a transparent;
          }
          #${winId} .emu-library-empty {
            display:flex;flex-direction:column;align-items:center;justify-content:center;
            height:100%;gap:10px;color:#383850;font-family:'Segoe UI',sans-serif;font-size:13px;
          }
          #${winId} .emu-library-empty-icon { font-size:36px;opacity:.3; }
          #${winId} .emu-library-loading {
            display:flex;align-items:center;justify-content:center;height:100%;
            color:#383850;font-family:'Segoe UI',sans-serif;font-size:12px;
          }

          #${winId} .emu-rom-item {
            display:flex;align-items:center;gap:12px;padding:9px 10px;border-radius:8px;
            cursor:pointer;transition:background .12s;border:1px solid transparent;
          }
          #${winId} .emu-rom-item:hover { background:#111118;border-color:#1e1e2e; }
          #${winId} .emu-rom-item-icon {
            width:36px;height:36px;border-radius:6px;background:#161622;
            display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;
          }
          #${winId} .emu-rom-item-info { flex:1;min-width:0; }
          #${winId} .emu-rom-item-name {
            color:#d0d0e8;font-family:'Segoe UI',sans-serif;font-size:13px;font-weight:600;
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
          }
          #${winId} .emu-rom-item-meta {
            color:#50506a;font-family:'Segoe UI',sans-serif;font-size:11px;margin-top:2px;
          }
          #${winId} .emu-rom-item-play {
            width:30px;height:30px;border-radius:6px;background:#1a1c3a;border:1px solid #2a2c50;
            color:#8090ff;font-size:12px;display:flex;align-items:center;justify-content:center;
            cursor:pointer;transition:background .12s,border-color .12s;flex-shrink:0;
          }
          #${winId} .emu-rom-item-play:hover { background:#252850;border-color:#5b7fff;color:#fff; }

          #${winId} .emu-savestat {
            font-family:'Segoe UI',sans-serif;font-size:11px;color:#50506a;min-height:16px;
          }
        </style>

        <div class="emu-shell">
          <div class="emu-tabs">
            <button class="emu-tab active" data-tab="upload">Upload ROM</button>
            <button class="emu-tab" data-tab="library">Library</button>
          </div>

          <div class="emu-panel active" data-panel="upload">
            <div class="emu-drop-zone" id="${winId}-dropzone">
              <div class="emu-drop-icon">🎮</div>
              <div class="emu-drop-title">Drop a ROM here</div>
              <div class="emu-drop-sub">GBA · NDS · NES · SNES · N64 · PSX · PSP · Sega</div>
              <button class="emu-browse-btn">Browse file…</button>
              <input class="emu-file-input" type="file" accept=".gba,.gb,.gbc,.nds,.nes,.smc,.sfc,.n64,.z64,.v64,.bin,.cue,.iso,.cso,.pbp,.img,.md,.gen,.smd,.gg,.sms,.zip" />
            </div>
            <div class="emu-preview" id="${winId}-preview">
              <div class="emu-rom-name" id="${winId}-romname">—</div>
              <div class="emu-core-selector">
                <span class="emu-core-label">CORE</span>
                <select class="emu-core-select" id="${winId}-core">
                  ${Object.keys(CORE_EXTENSIONS)
                    .map((c) => `<option value="${c}">${coreLabel(c)}</option>`)
                    .join("")}
                </select>
              </div>
              <div class="emu-savestat" id="${winId}-savestatus"></div>
              <button class="emu-launch-btn" id="${winId}-launch">▶ Launch</button>
              <button class="emu-change-btn" id="${winId}-change">Choose different file</button>
            </div>
          </div>

          <div class="emu-panel" data-panel="library">
            <div class="emu-library-panel">
              <div class="emu-library-search-wrap">
                <input class="emu-library-search" id="${winId}-search" placeholder="Search saved ROMs…" type="text" />
              </div>
              <div class="emu-library-list" id="${winId}-liblist">
                <div class="emu-library-loading">Scanning Desktop…</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    desktop.appendChild(win);
    this.wm.makeDraggable(win);
    this.wm.makeResizable(win);
    this.wm.setupWindowControls(win);
    this.wm.addToTaskbar(win.id, "Emulator", "/static/icons/emulator.webp", "#6677dd");
    this._setupLauncher(win, winId);
    this._setupTabs(win, winId);
    this._loadLibrary(win, winId);
  }

  _setupTabs(win, winId) {
    const tabs = win.querySelectorAll(".emu-tab");
    const panels = win.querySelectorAll(".emu-panel");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        tabs.forEach((t) => t.classList.remove("active"));
        panels.forEach((p) => p.classList.remove("active"));
        tab.classList.add("active");
        win.querySelector(`[data-panel="${tab.dataset.tab}"]`).classList.add("active");
        if (tab.dataset.tab === "library") this._loadLibrary(win, winId);
      });
    });
  }

  async _loadLibrary(win, winId) {
    const list = win.querySelector(`#${winId}-liblist`);
    const search = win.querySelector(`#${winId}-search`);
    list.innerHTML = `<div class="emu-library-loading">Scanning Desktop…</div>`;

    let roms = [];
    try {
      const folder = await this.fs.getFolder(desktopPath);
      roms = Object.entries(folder)
        .filter(([name]) => {
          const ext = name.split(".").pop().toLowerCase();
          return ROM_EXTENSIONS.has(ext);
        })
        .map(([name, entry]) => ({ name, entry }));
    } catch {
      list.innerHTML = `<div class="emu-library-empty"><div class="emu-library-empty-icon">⚠️</div>Could not read Desktop folder</div>`;
      return;
    }

    const render = (filter = "") => {
      const filtered = filter ? roms.filter((r) => r.name.toLowerCase().includes(filter.toLowerCase())) : roms;

      if (filtered.length === 0) {
        list.innerHTML =
          roms.length === 0
            ? `<div class="emu-library-empty"><div class="emu-library-empty-icon">🎮</div>No ROMs found on Desktop<br><span style="font-size:11px">Upload a ROM to save it here</span></div>`
            : `<div class="emu-library-empty"><div class="emu-library-empty-icon">🔍</div>No matches for "${filter}"</div>`;
        return;
      }

      list.innerHTML = "";
      filtered.forEach(({ name }) => {
        const ext = name.split(".").pop().toLowerCase();
        const core = detectCore(name);
        const title = name.replace(/\.[^.]+$/, "");
        const iconMap = {
          gba: "🟥",
          gb: "⬜",
          gbc: "🟩",
          nds: "📺",
          nes: "🎮",
          smc: "🔵",
          sfc: "🔵",
          n64: "🟡",
          psx: "🔘",
          psp: "🟠"
        };
        const icon = iconMap[ext] || iconMap[core] || "🕹️";

        const item = document.createElement("div");
        item.className = "emu-rom-item";
        item.innerHTML = `
          <div class="emu-rom-item-icon">${icon}</div>
          <div class="emu-rom-item-info">
            <div class="emu-rom-item-name" title="${name}">${title}</div>
            <div class="emu-rom-item-meta">${coreLabel(core)} · .${ext}</div>
          </div>
          <div class="emu-rom-item-play" title="Launch">▶</div>
        `;

        const launch = async () => {
          try {
            const dataUrl = await this.fs.getFileContent(desktopPath, name);
            if (!dataUrl) throw new Error("empty");
            const res = await fetch(dataUrl);
            const blob = await res.blob();
            const file = new File([blob], name, { type: "application/octet-stream" });
            this._launchRom(file, core);
          } catch (err) {
            console.error("Library launch error", err);
            alert(`Could not load "${name}" from Desktop.`);
          }
        };

        item.querySelector(".emu-rom-item-play").addEventListener("click", (e) => {
          e.stopPropagation();
          launch();
        });
        item.addEventListener("dblclick", launch);
        item.addEventListener("click", () => {
          list.querySelectorAll(".emu-rom-item").forEach((el) => (el.style.background = ""));
          item.style.background = "#111118";
        });

        list.appendChild(item);
      });
    };

    render();
    search.addEventListener("input", () => render(search.value));
  }

  _setupLauncher(win, winId) {
    const dropZone = win.querySelector(`#${winId}-dropzone`);
    const fileInput = win.querySelector(".emu-file-input");
    const preview = win.querySelector(`#${winId}-preview`);
    const romName = win.querySelector(`#${winId}-romname`);
    const coreSelect = win.querySelector(`#${winId}-core`);
    const launchBtn = win.querySelector(`#${winId}-launch`);
    const changeBtn = win.querySelector(`#${winId}-change`);
    const browseBtn = win.querySelector(".emu-browse-btn");
    const saveStatus = win.querySelector(`#${winId}-savestatus`);

    let selectedFile = null;

    const showPreview = async (file) => {
      selectedFile = file;
      romName.textContent = file.name.replace(/\.[^.]+$/, "");
      coreSelect.value = detectCore(file.name);
      dropZone.style.display = "none";
      preview.classList.add("visible");

      const alreadySaved = await this._isInDesktop(file.name);
      if (alreadySaved) {
        saveStatus.textContent = "✓ Already in Desktop folder";
        saveStatus.style.color = "#4a9";
      } else {
        saveStatus.textContent = "Saving to Desktop…";
        saveStatus.style.color = "#50506a";
        try {
          await this._saveToDesktop(file);
          saveStatus.textContent = "✓ Saved to Desktop folder";
          saveStatus.style.color = "#4a9";
        } catch (err) {
          if (err?.code === "EEXIST") {
            saveStatus.textContent = "✓ Already in Desktop folder";
            saveStatus.style.color = "#4a9";
          } else {
            saveStatus.textContent = "⚠ Could not save to Desktop folder";
            saveStatus.style.color = "#a54";
          }
        }
      }
    };

    const showDropzone = () => {
      selectedFile = null;
      dropZone.style.display = "";
      preview.classList.remove("visible");
      fileInput.value = "";
      saveStatus.textContent = "";
    };

    browseBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      fileInput.click();
    });
    dropZone.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
      if (fileInput.files[0]) showPreview(fileInput.files[0]);
    });

    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropZone.classList.add("drag-over");
    });
    dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropZone.classList.remove("drag-over");
      if (e.dataTransfer.files[0]) showPreview(e.dataTransfer.files[0]);
    });

    changeBtn.addEventListener("click", showDropzone);
    launchBtn.addEventListener("click", () => {
      if (selectedFile) this._launchRom(selectedFile, coreSelect.value);
    });
  }

  async _isInDesktop(fileName) {
    try {
      const folder = await this.fs.getFolder(desktopPath);
      return Object.prototype.hasOwnProperty.call(folder, fileName);
    } catch {
      return false;
    }
  }

  async _saveToDesktop(file) {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = "data:application/octet-stream;base64," + btoa(binary);
    await this.fs.createFile(desktopPath, file.name, base64, FileKind.OTHER, null, "/static/icons/emulator.webp");
  }

  _launchRom(file, core) {
    const romUrl = URL.createObjectURL(file);
    const gameTitle = file.name.replace(/\.[^.]+$/, "");
    const winId = `emu-game-${Date.now()}`;

    const biosConfig = {
      core,
      romUrl,
      gameName: gameTitle,
      biosUrl: core === "gba" ? `${window.location.origin}/static/bios/gba_bios.bin` : null,
      bios7Url: core === "nds" ? `${window.location.origin}/static/bios/bios7.bin` : null,
      bios9Url: core === "nds" ? `${window.location.origin}/static/bios/bios9.bin` : null,
      firmwareUrl: core === "nds" ? `${window.location.origin}/static/bios/firmware.bin` : null,
      threads: core === "psp"
    };

    const shellHtml = buildShellHtml(biosConfig);
    const shellBlob = new Blob([shellHtml], { type: "text/html" });
    const shellUrl = URL.createObjectURL(shellBlob);

    const win = this.wm.createWindow(winId, gameTitle, "800px", "640px");
    Object.assign(win.style, { left: "80px", top: "40px" });

    win.innerHTML = `
      <div class="window-header">
        <span>${gameTitle}</span>
        ${this.wm.getWindowControls()}

      </div>
      <div class="window-content" style="padding:0;overflow:hidden;height:calc(100% - 32px);background:#000;">
        <iframe src="${shellUrl}" style="width:100%;height:100%;border:none;display:block;" allow="autoplay; fullscreen"></iframe>
      </div>
    `;

    desktop.appendChild(win);
    this.wm.makeDraggable(win);
    this.wm.makeResizable(win);
    this.wm.setupWindowControls(win);
    this.wm.addToTaskbar(win.id, gameTitle, "/static/icons/emulator.webp", "#6677dd");
    this.wm.bringToFront(win);

    win.querySelector(".close-btn").addEventListener(
      "click",
      () => {
        const iframe = win.querySelector("iframe");
        if (iframe) {
          iframe.src = "about:blank";
          iframe.remove();
        }
        URL.revokeObjectURL(shellUrl);
        URL.revokeObjectURL(romUrl);
      },
      { once: true }
    );
  }
}
