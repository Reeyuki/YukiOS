import { desktop } from "./desktop.js";
import { FileKind } from "./fs.js";
import { detectCore, coreLabel } from "./shared/coreMap.js";
import { Achievements } from "./achievements.js";
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
  "zip",
  "chd",
  "zip",
  "7z",
  "m3u",
  "ccd",
  "sub",
  "mdf",
  "mds"
]);

const ARCADE_EXTENSIONS = new Set(["zip", "7z"]);

const CUE_BIN_PLATFORMS = {
  psx: {
    hints: ["scus", "sces", "slus", "slps", "sles", "scps", "slpm", "sleh", "papx", "espm"],
    label: "PlayStation"
  },
  segacd: {
    hints: ["sega cd", "mega cd", "genesis", "megacd"],
    label: "Sega CD"
  },
  saturn: {
    hints: ["saturn"],
    label: "Sega Saturn"
  }
};

function guessBinImgCore(fileName, cueContent = null) {
  const lower = fileName.toLowerCase();

  if (cueContent) {
    const cueL = cueContent.toLowerCase();
    for (const [core, data] of Object.entries(CUE_BIN_PLATFORMS)) {
      if (data.hints.some((h) => cueL.includes(h))) return core;
    }
    const binRef = cueContent.match(/FILE\s+"?([^"]+)"?\s+BINARY/i);
    if (binRef) {
      const binName = binRef[1].toLowerCase();
      for (const [core, data] of Object.entries(CUE_BIN_PLATFORMS)) {
        if (data.hints.some((h) => binName.includes(h))) return core;
      }
    }
  }

  if (
    CUE_BIN_PLATFORMS.psx.hints.some((h) => lower.includes(h)) ||
    lower.match(/\(usa\)|\(europe\)|\(japan\)/) ||
    lower.endsWith(".cue")
  ) {
    return "psx";
  }

  if (lower.includes("saturn")) return "saturn";
  if (lower.includes("sega cd") || lower.includes("mega cd") || lower.includes("megacd")) return "segacd";

  return "psx";
}

function detectCoreEnhanced(fileName, cueContent = null) {
  const ext = fileName.split(".").pop().toLowerCase();
  const lower = fileName.toLowerCase();

  if (ext === "cue" || ext === "bin" || ext === "img") {
    return guessBinImgCore(fileName, cueContent);
  }

  if (ext === "ccd" || ext === "sub" || ext === "mdf" || ext === "mds") {
    return guessBinImgCore(fileName, cueContent);
  }

  if (ext === "chd") {
    if (lower.includes("saturn")) return "saturn";
    if (lower.includes("sega cd") || lower.includes("mega cd")) return "segacd";
    return "psx";
  }

  if (ext === "m3u") return "psx";

  if (ext === "zip" || ext === "7z") {
    if (lower.includes("gba") || lower.includes("advance")) return "gba";
    if (lower.includes("nds") || lower.includes("nintendo ds")) return "nds";
    return "arcade";
  }

  return detectCore(fileName);
}

const EXTENDED_CORES = {
  gba: "Game Boy Advance",
  gb: "Game Boy",
  gbc: "Game Boy Color",
  nds: "Nintendo DS",
  nes: "NES",
  snes: "SNES",
  n64: "Nintendo 64",
  psx: "PlayStation",
  psp: "PSP",
  segacd: "Sega CD",
  sega32x: "Sega 32X",
  saturn: "Sega Saturn (Yabause)",
  arcade: "Arcade (MAME/FBNeo)",
  mame2003: "MAME 2003",
  fbalpha2012: "FB Alpha 2012",
  segams: "Sega Master System",
  gamegear: "Game Gear",
  genesis: "Sega Genesis",
  atari2600: "Atari 2600",
  atari7800: "Atari 7800",
  lynx: "Atari Lynx",
  ngp: "Neo Geo Pocket",
  vb: "Virtual Boy",
  pcengine: "PC Engine / TurboGrafx",
  ws: "WonderSwan"
};

function extendedCoreLabel(core) {
  return EXTENDED_CORES[core] || coreLabel(core) || core.toUpperCase();
}

export class EmulatorApp {
  constructor(fileSystemManager, windowManager) {
    this.fs = fileSystemManager;
    this.wm = windowManager;
    this._openRoms = new Set();
    this._multiFiles = [];
  }

  open() {
    const winId = "emulator-launcher";
    const existing = document.getElementById(winId);
    if (existing) {
      this.wm.bringToFront(existing);
      return;
    }

    const win = this.wm.createWindow(winId, "Emulator JS", "600px", "520px");
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
          #${winId} .emu-multi-badge {
            display:none;background:#1a2040;border:1px solid #2a3060;border-radius:6px;
            padding:5px 12px;color:#8090ff;font-family:'Segoe UI',sans-serif;font-size:11px;
            text-align:center;max-width:360px;
          }
          #${winId} .emu-multi-badge.visible { display:block; }
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
          #${winId} .emu-library-filter-wrap {
            display:flex;gap:6px;padding:0 16px 8px;flex-wrap:wrap;flex-shrink:0;
          }
          #${winId} .emu-filter-btn {
            padding:3px 10px;border-radius:20px;border:1px solid #2a2a3a;background:#111118;
            color:#50506a;font-family:'Segoe UI',sans-serif;font-size:11px;cursor:pointer;
            transition:color .12s,border-color .12s,background .12s;outline:none;
          }
          #${winId} .emu-filter-btn.active { color:#8090ff;border-color:#3a4fff;background:#13152a; }
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
          #${winId} .emu-platform-tag {
            display:inline-block;padding:1px 6px;border-radius:4px;font-size:10px;
            font-family:'Segoe UI',sans-serif;font-weight:700;letter-spacing:.04em;margin-right:4px;
          }
          #${winId} .tag-arcade { background:#2a1a00;color:#ffaa44; }
          #${winId} .tag-saturn { background:#1a002a;color:#cc88ff; }
          #${winId} .tag-psx { background:#00102a;color:#44aaff; }
          #${winId} .tag-segacd { background:#002a00;color:#44ff88; }
        </style>

        <div class="emu-shell">
          <div class="emu-tabs">
            <button class="emu-tab active" data-tab="upload">Upload ROM</button>
            <button class="emu-tab" data-tab="library">Library</button>
          </div>

          <div class="emu-panel active" data-panel="upload">
            <div class="emu-drop-zone" id="${winId}-dropzone">
              <div class="emu-drop-icon">🎮</div>
              <div class="emu-drop-title">Drop ROM(s) here</div>
              <div class="emu-drop-sub">GBA · NDS · NES · SNES · N64 · PSX · PSP · Saturn · Arcade · ZIP · CUE+BIN</div>
              <button class="emu-browse-btn">Browse file(s)…</button>
              <input class="emu-file-input" type="file" multiple accept=".gba,.gb,.gbc,.nds,.nes,.smc,.sfc,.n64,.z64,.v64,.bin,.cue,.iso,.cso,.pbp,.img,.md,.gen,.smd,.gg,.sms,.zip,.7z,.chd,.m3u,.ccd,.sub,.mdf,.mds" />
            </div>
            <div class="emu-preview" id="${winId}-preview">
              <div class="emu-rom-name" id="${winId}-romname">—</div>
              <div class="emu-multi-badge" id="${winId}-multibadge"></div>
              <div class="emu-core-selector">
                <span class="emu-core-label">CORE</span>
                <select class="emu-core-select" id="${winId}-core">
                  ${Object.keys(EXTENDED_CORES)
                    .map((c) => `<option value="${c}">${extendedCoreLabel(c)}</option>`)
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
              <div class="emu-library-filter-wrap" id="${winId}-filters"></div>
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
    this.wm.addToTaskbar(win.id, "Emulator JS", "/static/icons/emulator.webp", "#6677dd");
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
    const filtersWrap = win.querySelector(`#${winId}-filters`);
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
      return { ...r, isRemote: !cached, isCached: cached };
    });

    const uniqueLocalOnly = localRoms.filter(
      (local) => !remoteRoms.some((remote) => remote.name.toLowerCase() === local.name.toLowerCase())
    );

    const roms = [...mergedRemoteRoms, ...uniqueLocalOnly].map((r) => ({
      ...r,
      core: detectCoreEnhanced(r.name)
    }));

    const allCores = [...new Set(roms.map((r) => r.core))].sort();
    let activeFilter = null;

    filtersWrap.innerHTML = "";
    const allBtn = document.createElement("button");
    allBtn.className = "emu-filter-btn active";
    allBtn.textContent = "All";
    allBtn.addEventListener("click", () => {
      activeFilter = null;
      filtersWrap.querySelectorAll(".emu-filter-btn").forEach((b) => b.classList.remove("active"));
      allBtn.classList.add("active");
      render(search.value);
    });
    filtersWrap.appendChild(allBtn);

    allCores.forEach((core) => {
      const btn = document.createElement("button");
      btn.className = "emu-filter-btn";
      btn.textContent = extendedCoreLabel(core);
      btn.addEventListener("click", () => {
        activeFilter = core;
        filtersWrap.querySelectorAll(".emu-filter-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        render(search.value);
      });
      filtersWrap.appendChild(btn);
    });

    const platformTagHtml = (core) => {
      const special = { arcade: "tag-arcade", saturn: "tag-saturn", psx: "tag-psx", segacd: "tag-segacd" };
      if (special[core]) {
        return `<span class="emu-platform-tag ${special[core]}">${extendedCoreLabel(core)}</span>`;
      }
      return "";
    };

    const render = (filter = "") => {
      let filtered = roms;
      if (activeFilter) filtered = filtered.filter((r) => r.core === activeFilter);
      if (filter) filtered = filtered.filter((r) => r.name.toLowerCase().includes(filter.toLowerCase()));

      list.innerHTML = "";

      if (!filtered.length) {
        list.innerHTML = `<div class="emu-library-empty">No ROMs found</div>`;
        return;
      }

      filtered.forEach((r) => {
        const ext = r.name.split(".").pop().toLowerCase();
        const sourceLabel = r.isRemote ? "Cloud" : "Local";

        const item = document.createElement("div");
        item.className = "emu-rom-item";
        item.innerHTML = `
          <div class="emu-rom-item-icon">
            <img src="/static/icons/emulator.webp">
          </div>
          <div class="emu-rom-item-info">
            <div class="emu-rom-item-name">${r.name.replace(/\.[^.]+$/, "")}</div>
            <div class="emu-rom-item-meta">${platformTagHtml(r.core)}.${ext} · ${sourceLabel}</div>
          </div>
          <div class="emu-rom-item-play">
            <i class="fa-solid fa-play"></i>
          </div>
        `;

        const launch = async () => {
          if (r.isRemote) {
            await this._launchRomFromUrl(r.url, r.name, r.core);
            this._loadLibrary(win, winId);
          } else {
            await this._launchRomFromFs(r.name, r.core);
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

  _launchRomMulti(files, core) {
    const primary =
      files.find((f) => {
        const ext = f.name.split(".").pop().toLowerCase();
        return ext === "cue" || ext === "m3u" || ext === "iso" || ext === "cso";
      }) || files[0];

    const gameTitle = primary.name.replace(/\.[^.]+$/, "");

    const readers = files.map((f) => f.arrayBuffer().then((buf) => ({ name: f.name, buffer: buf })));
    Promise.all(readers).then((fileData) => {
      const primary =
        fileData.find((f) => {
          const ext = f.name.split(".").pop().toLowerCase();
          return ext === "cue" || ext === "m3u" || ext === "iso";
        }) || fileData[0];
      this._launchWithBufferMulti(fileData, primary.name, gameTitle, core);
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
    this._launchWithBufferMulti([{ name: fileName, buffer: arrayBuffer }], fileName, gameTitle, core);
  }

  _launchWithBufferMulti(fileData, primaryFileName, gameTitle, core) {
    window.achievements?.trigger?.(Achievements.EmulatorFan);
    const winId = `emu-game-${Date.now()}`;
    const biosConfig = this._buildBiosConfig(core, gameTitle);
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
    this.wm.addToTaskbar(win.id, gameTitle, "/static/icons/emulator.webp", "#6677dd");

    const iframe = win.querySelector("iframe");
    const transferBuffers = fileData.map((f) => f.buffer);

    const onMessage = (e) => {
      if (e.data?.type === "emu-ready" && e.source === iframe.contentWindow) {
        iframe.contentWindow.postMessage(
          {
            type: "rom-data-multi",
            files: fileData.map((f) => ({ name: f.name, buffer: f.buffer })),
            primaryFileName
          },
          "*",
          transferBuffers
        );
      }
    };
    window.addEventListener("message", onMessage);

    win.querySelector(".close-btn")?.addEventListener(
      "click",
      () => {
        window.removeEventListener("message", onMessage);
        URL.revokeObjectURL(shellUrl);
        this._openRoms.delete(primaryFileName);
      },
      { once: true }
    );
  }

  _buildBiosConfig(core, gameName) {
    const origin = window.location.origin;
    return {
      core,
      gameName,
      biosUrl: core === "gba" ? `${origin}/static/bios/gba_bios.bin` : null,
      bios7Url: core === "nds" ? `${origin}/static/bios/bios7.bin` : null,
      bios9Url: core === "nds" ? `${origin}/static/bios/bios9.bin` : null,
      firmwareUrl: core === "nds" ? `${origin}/static/bios/firmware.bin` : null,
      biosUrlSaturn: core === "saturn" ? `${origin}/static/bios/saturn_bios.bin` : null,
      threads: core === "psp" || core === "saturn"
    };
  }

  _buildShellHtml({ core, gameName, biosUrl, bios7Url, bios9Url, firmwareUrl, biosUrlSaturn, threads }) {
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
      biosUrlSaturn ? `window.EJS_biosUrl = ${JSON.stringify(biosUrlSaturn)};` : "",
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
        if (e.data?.type === 'rom-data-multi') {
          const files = e.data.files;
          const primary = files.find(f => {
            const ext = f.name.split('.').pop().toLowerCase();
            return ext === 'cue' || ext === 'm3u' || ext === 'iso' || ext === 'cso';
          }) || files[0];
          const blob = new Blob([new Uint8Array(primary.buffer)]);
          window.EJS_gameUrl = URL.createObjectURL(blob);
          window.EJS_fileName = primary.name;
          files.forEach(f => {
            if (f !== primary) {
              const b = new Blob([new Uint8Array(f.buffer)]);
              const url = URL.createObjectURL(b);
              window._emuExtraFiles = window._emuExtraFiles || {};
              window._emuExtraFiles[f.name] = url;
            }
          });
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
    const multiBadge = win.querySelector(`#${winId}-multibadge`);
    const coreSelect = win.querySelector(`#${winId}-core`);
    const launchBtn = win.querySelector(`#${winId}-launch`);
    const saveStatus = win.querySelector(`#${winId}-savestatus`);

    let selectedFiles = [];

    const showPreview = async (files) => {
      selectedFiles = Array.from(files);

      const cueFile = selectedFiles.find((f) => f.name.toLowerCase().endsWith(".cue"));
      let cueContent = null;
      if (cueFile) {
        cueContent = await cueFile.text().catch(() => null);
      }

      const primary =
        selectedFiles.find((f) => {
          const ext = f.name.split(".").pop().toLowerCase();
          return ext === "cue" || ext === "m3u" || ext === "iso";
        }) || selectedFiles[0];

      romName.textContent = primary.name.replace(/\.[^.]+$/, "");

      const detectedCore = detectCoreEnhanced(primary.name, cueContent);
      coreSelect.value = detectedCore;

      if (selectedFiles.length > 1) {
        const extras = selectedFiles
          .filter((f) => f !== primary)
          .map((f) => f.name)
          .join(", ");
        multiBadge.textContent = `Multi-file: also loading ${extras}`;
        multiBadge.classList.add("visible");
      } else {
        multiBadge.classList.remove("visible");
      }

      dropZone.style.display = "none";
      preview.classList.add("visible");

      saveStatus.textContent = "Saving to Desktop...";
      await Promise.all(selectedFiles.map((f) => this._saveToDesktop(f)));
      saveStatus.textContent = `✓ Saved ${selectedFiles.length} file(s) to Desktop`;
    };

    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropZone.classList.add("drag-over");
    });
    dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropZone.classList.remove("drag-over");
      const files = e.dataTransfer?.files;
      if (files?.length) showPreview(files);
    });

    dropZone.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => fileInput.files.length && showPreview(fileInput.files));

    launchBtn.addEventListener("click", () => {
      if (!selectedFiles.length) return;
      const core = coreSelect.value;
      if (selectedFiles.length > 1) {
        this._launchRomMulti(selectedFiles, core);
      } else {
        this._launchRom(selectedFiles[0], core);
      }
    });

    win.querySelector(`#${winId}-change`).addEventListener("click", () => {
      selectedFiles = [];
      dropZone.style.display = "";
      preview.classList.remove("visible");
      multiBadge.classList.remove("visible");
    });
  }

  async _saveToDesktop(file) {
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = "data:application/octet-stream;base64," + btoa(binary);
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
