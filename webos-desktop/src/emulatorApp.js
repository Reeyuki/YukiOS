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

export class EmulatorApp {
  constructor(fileSystemManager, windowManager) {
    this.fs = fileSystemManager;
    this.wm = windowManager;
    this._openRoms = new Set();
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
          #${winId} .emu-shell { display:flex;flex-direction:column;height:100%;overflow:hidden; }
          #${winId} .emu-tabs { display:flex;border-bottom:1px solid #1a1a28;flex-shrink:0; }
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
          #${winId} .emu-change-btn {
            background:none;border:none;color:#50506a;font-family:'Segoe UI',sans-serif;
            font-size:11px;cursor:pointer;text-decoration:underline;
          }
          #${winId} .emu-library-panel { display:flex;flex-direction:column;flex:1;overflow:hidden; }
          #${winId} .emu-library-search-wrap { padding:12px 16px 8px;flex-shrink:0; }
          #${winId} .emu-library-search {
            width:100%;padding:7px 12px;background:#111118;border:1px solid #2a2a3a;border-radius:8px;
            color:#c8c8d8;font-family:'Segoe UI',sans-serif;font-size:12px;outline:none;box-sizing:border-box;
          }
          #${winId} .emu-library-list { flex:1;overflow-y:auto;padding:4px 12px 12px; }
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
          #${winId} .emu-rom-item-meta { color:#50506a;font-family:'Segoe UI',sans-serif;font-size:11px; }
          #${winId} .emu-rom-item-play {
            width:30px;height:30px;border-radius:6px;background:#1a1c3a;border:1px solid #2a2c50;
            color:#8090ff;font-size:12px;display:flex;align-items:center;justify-content:center;
            cursor:pointer;flex-shrink:0;
          }
          #${winId} .emu-savestat { font-family:'Segoe UI',sans-serif;font-size:11px;color:#50506a;min-height:16px; }
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
              <div class="emu-drop-sub">GBA · NDS · NES · SNES · N64 · PSX · PSP · ZIP</div>
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

    const remoteBase = "https://yukiosroms.netlify.app/";
    const remoteRoms = [
      { name: "pokemon-emerald.gba" },
      { name: "pokemon-heartgold.nds" },
      { name: "pokemon-platinum.nds" },
      { name: "pokemon-red.gba" }
    ].map((r) => ({ ...r, isRemote: true, url: remoteBase + r.name }));

    let localRoms = [];
    let localNames = new Set();

    try {
      const folder = await this.fs.getFolder(desktopPath);
      localRoms = Object.entries(folder)
        .filter(([name]) => ROM_EXTENSIONS.has(name.split(".").pop().toLowerCase()))
        .map(([name, entry]) => ({ name, entry, isRemote: false, isCached: true }));
      localNames = new Set(localRoms.map((r) => r.name.toLowerCase()));
    } catch {
      list.innerHTML = `<div class="emu-library-empty">Could not read Desktop</div>`;
      return;
    }

    const mergedRemoteRoms = remoteRoms.map((r) => {
      const cached = localNames.has(r.name.toLowerCase());
      return {
        ...r,
        isRemote: !cached,
        isCached: cached
      };
    });

    const uniqueLocalOnly = localRoms.filter(
      (local) => !remoteRoms.some((remote) => remote.name.toLowerCase() === local.name.toLowerCase())
    );

    const roms = [...mergedRemoteRoms, ...uniqueLocalOnly];

    const render = (filter = "") => {
      const filtered = filter ? roms.filter((r) => r.name.toLowerCase().includes(filter.toLowerCase())) : roms;
      list.innerHTML = "";

      if (!filtered.length) {
        list.innerHTML = `<div class="emu-library-empty">No ROMs found</div>`;
        return;
      }

      filtered.forEach((r) => {
        const ext = r.name.split(".").pop().toLowerCase();
        const core = detectCore(r.name);
        const sourceLabel = r.isRemote ? "Cloud" : "Local";

        const item = document.createElement("div");
        item.className = "emu-rom-item";
        item.innerHTML = `
          <div class="emu-rom-item-icon">
            <img src="/static/icons/emulator.webp">
          </div>
          <div class="emu-rom-item-info">
            <div class="emu-rom-item-name">${r.name.replace(/\.[^.]+$/, "")}</div>
            <div class="emu-rom-item-meta">${coreLabel(core)} · .${ext} · ${sourceLabel}</div>
          </div>
          <div class="emu-rom-item-play">
            <i class="fa-solid fa-play"></i>
          </div>
        `;

        const launch = async () => {
          if (r.isRemote) {
            await this._launchRomFromUrl(r.url, r.name, core);
            this._loadLibrary(win, winId);
          } else {
            await this._launchRomFromFs(r.name, core);
          }
        };

        item.addEventListener("click", launch);
        list.appendChild(item);
      });
    };

    render();
    search.oninput = () => render(search.value);
  }

  async _launchRomFromFs(fileName, core) {
    const dataUrl = await this.fs.getFileContent(desktopPath, fileName);
    if (!dataUrl) {
      alert("Failed to load local ROM");
      return;
    }

    const res = await fetch(dataUrl);
    const blob = await res.blob();
    this._launchRom(new File([blob], fileName), core);
  }

  _launchRom(file, core) {
    const gameTitle = file.name.replace(/\.[^.]+$/, "");
    file.arrayBuffer().then((buffer) => {
      this._launchWithBuffer(buffer, file.name, gameTitle, core);
    });
  }

  async _launchRomFromUrl(url, fileName, core) {
    if (this._openRoms.has(fileName)) return;
    this._openRoms.add(fileName);

    try {
      const existing = await this.fs.getFileContent(desktopPath, fileName);
      if (existing) {
        const localRes = await fetch(existing);
        const localBlob = await localRes.blob();
        this._launchRom(new File([localBlob], fileName), core);
        this._openRoms.delete(fileName);
        return;
      }

      const res = await fetch(url);
      if (!res.ok) throw new Error();

      const blob = await res.blob();
      const dataUrl = await this._blobToDataUrl(blob);

      await this._saveDataUrlToDesktop(fileName, dataUrl);
      this._launchRom(new File([blob], fileName), core);
      this._openRoms.delete(fileName);
    } catch {
      alert("Failed to load ROM");
      this._openRoms.delete(fileName);
    }
  }

  _launchWithBuffer(arrayBuffer, fileName, gameTitle, core) {
    const winId = `emu-game-${Date.now()}`;
    const biosConfig = {
      core,
      gameName: gameTitle,
      biosUrl: core === "gba" ? `${window.location.origin}/static/bios/gba_bios.bin` : null,
      bios7Url: core === "nds" ? `${window.location.origin}/static/bios/bios7.bin` : null,
      bios9Url: core === "nds" ? `${window.location.origin}/static/bios/bios9.bin` : null,
      firmwareUrl: core === "nds" ? `${window.location.origin}/static/bios/firmware.bin` : null,
      threads: core === "psp"
    };

    const shellHtml = this._buildShellHtml(biosConfig);
    const shellUrl = URL.createObjectURL(new Blob([shellHtml], { type: "text/html" }));
    const win = this.wm.createWindow(winId, gameTitle, "800px", "640px");

    win.innerHTML = `
      <div class="window-header"><span>${gameTitle}</span>${this.wm.getWindowControls()}</div>
      <div class="window-content" style="padding:0;height:calc(100% - 32px);background:#000;">
        <iframe src="${shellUrl}" style="width:100%;height:100%;border:none;" allow="autoplay; fullscreen"></iframe>
      </div>
    `;

    desktop.appendChild(win);
    this.wm.setupWindowControls(win);
    this.wm.makeDraggable(win);
    this.wm.bringToFront(win);

    const iframe = win.querySelector("iframe");
    const onMessage = (e) => {
      if (e.data?.type === "emu-ready" && e.source === iframe.contentWindow) {
        iframe.contentWindow.postMessage({ type: "rom-data", buffer: arrayBuffer, fileName }, "*", [arrayBuffer]);
      }
    };
    window.addEventListener("message", onMessage);

    win.querySelector(".close-btn")?.addEventListener(
      "click",
      () => {
        window.removeEventListener("message", onMessage);
        URL.revokeObjectURL(shellUrl);
        this._openRoms.delete(fileName);
      },
      { once: true }
    );
  }

  _buildShellHtml({ core, gameName, biosUrl, bios7Url, bios9Url, firmwareUrl, threads }) {
    const assignments = [
      `window.EJS_player = '#game';`,
      `window.EJS_core = ${JSON.stringify(core)};`,
      `window.EJS_gameName = ${JSON.stringify(gameName)};`,
      `window.EJS_color = '#0064ff';`,
      `window.EJS_pathtodata = '${window.location.origin}/static/games/cdn.emulatorjs.org/stable/data';`,
      biosUrl ? `window.EJS_biosUrl = ${JSON.stringify(biosUrl)};` : "",
      bios7Url ? `window.EJS_bios7Url = ${JSON.stringify(bios7Url)};` : "",
      bios9Url ? `window.EJS_bios9Url = ${JSON.stringify(bios9Url)};` : "",
      firmwareUrl ? `window.EJS_firmwareUrl = ${JSON.stringify(firmwareUrl)};` : "",
      threads ? `window.EJS_threads = true;` : ""
    ]
      .filter(Boolean)
      .join("\n");

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body,#game{width:100%;height:100%;margin:0;background:#000;overflow:hidden;}</style></head>
    <body><div id="game"></div><script>
      ${assignments}
      window.addEventListener('message', e => {
        if (e.data?.type === 'rom-data') {
          const blob = new Blob([new Uint8Array(e.data.buffer)]);
          window.EJS_gameUrl = URL.createObjectURL(blob);
          window.EJS_fileName = e.data.fileName;
          const s = document.createElement('script');
          s.src = '${window.location.origin}/static/games/cdn.emulatorjs.org/stable/data/loader.js';
          document.body.appendChild(s);
        }
      });
      window.parent.postMessage({ type: 'emu-ready' }, '*');
    </script></body></html>`;
  }

  _setupLauncher(win, winId) {
    const dropZone = win.querySelector(`#${winId}-dropzone`);
    const fileInput = win.querySelector(".emu-file-input");
    const preview = win.querySelector(`#${winId}-preview`);
    const romName = win.querySelector(`#${winId}-romname`);
    const coreSelect = win.querySelector(`#${winId}-core`);
    const launchBtn = win.querySelector(`#${winId}-launch`);
    const saveStatus = win.querySelector(`#${winId}-savestatus`);

    let selectedFile = null;

    const showPreview = async (file) => {
      selectedFile = file;
      romName.textContent = file.name.replace(/\.[^.]+$/, "");
      coreSelect.value = detectCore(file.name);
      dropZone.style.display = "none";
      preview.classList.add("visible");

      saveStatus.textContent = "Saving to Desktop...";
      await this._saveToDesktop(file);
      saveStatus.textContent = "✓ Saved to Desktop";
    };

    dropZone.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => fileInput.files[0] && showPreview(fileInput.files[0]));
    launchBtn.addEventListener("click", () => selectedFile && this._launchRom(selectedFile, coreSelect.value));
    win.querySelector(`#${winId}-change`).addEventListener("click", () => {
      dropZone.style.display = "";
      preview.classList.remove("visible");
    });
  }

  async _saveToDesktop(file) {
    try {
      const buffer = await file.arrayBuffer();
      const base64 = "data:application/octet-stream;base64," + btoa(String.fromCharCode(...new Uint8Array(buffer)));
      await this.fs.createFile(desktopPath, file.name, base64, FileKind.OTHER, null, "/static/icons/emulator.webp");
    } catch (e) {}
  }

  async _saveDataUrlToDesktop(fileName, dataUrl) {
    try {
      await this.fs.createFile(desktopPath, fileName, dataUrl, FileKind.OTHER, null, "/static/icons/emulator.webp");
    } catch (e) {}
  }

  _blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}
