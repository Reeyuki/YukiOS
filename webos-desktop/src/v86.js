import { Achievements } from "./achievements.js";
import { desktop } from "./desktop.js";

const IMAGES_DIR = ["VMs"];

export class V86App {
  constructor(fileSystemManager, windowManager, explorerApp) {
    this._fs = fileSystemManager;
    this._windowManager = windowManager;
    this._explorerApp = explorerApp;
    this._v86LoadPromise = null;
  }

  open() {
    if (document.getElementById("v86-win")) {
      this._windowManager.bringToFront(document.getElementById("v86-win"));
      return;
    }
    this._loadV86Script();
    const win = this._windowManager.createWindow("v86-win", "V86", "600px", "560px");
    win.innerHTML = `
      <div class="window-header">
        <span>V86 Virtual Machine</span>
        ${this._windowManager.getWindowControls()}
      </div>
      <div class="window-content" style="width:100%;height:100%;background:#1a1a2e;color:#eee;font-family:monospace;overflow-y:auto;overflow-x:hidden;">
        <div class="v86-header" style="display:flex;align-items:center;gap:16px;padding:24px 20px 16px;">
          <i class="fa-solid fa-microchip" style="font-size:38px;color:#7b5ea7;"></i>
          <div>
            <div style="font-size:20px;font-weight:bold;color:#fff;">V86 Emulator</div>
            <div style="font-size:13px;color:#888;">Run x86 operating systems in your browser</div>
          </div>
        </div>
        <div style="padding:16px 16px 8px;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;">My Images</div>
        <div
          id="v86-upload-zone"
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
          <div style="font-size:13px;color:#bbb;">Drop a <strong style="color:#fff;">.iso</strong>, <strong style="color:#fff;">.img</strong>, or <strong style="color:#fff;">.bin</strong> file here</div>
          <div style="font-size:11px;color:#666;margin-top:4px;">or click to browse</div>
          <input type="file" id="v86-file-input" accept=".iso,.img,.bin,.state,.gz" style="display:none;">
        </div>
        <div id="v86-user-images" style="padding:0 16px 16px;display:flex;flex-wrap:wrap;gap:12px;"></div>
        <div style="padding:0 16px 8px;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;">Featured Systems</div>
        <div class="v86-system-grid" id="v86-system-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;padding:0 16px 20px;">
          ${this._generateSystemCards()}
        </div>
      </div>`;

    desktop.appendChild(win);
    this._windowManager.makeDraggable(win);
    this._windowManager.makeResizable(win);
    this._windowManager.setupWindowControls(win);
    this._windowManager.addToTaskbar(win.id, "V86", "/static/icons/v86.webp");

    this._setupSystemCardListeners(win);
    this._setupUploadZone(win);
    this._loadUserImages(win);
  }

  _generateSystemCards() {
    const systems = [
      { id: "freedos", name: "FreeDOS", icon: "fa-solid fa-terminal" },
      { id: "openbsd", name: "OpenBSD", icon: "fa-solid fa-fish" }
    ];

    return systems
      .map(
        (sys) => `
      <div class="v86-system-card" data-system="${sys.id}" style="
        background:#252540;border-radius:10px;padding:18px 12px;
        display:flex;flex-direction:column;align-items:center;gap:10px;
        cursor:pointer;transition:transform .15s,box-shadow .15s;
      ">
        <i class="${sys.icon}" style="font-size:28px;color:#c77dff;"></i>
        <div style="font-size:13px;color:#fff;text-align:center;">${sys.name}</div>
      </div>
    `
      )
      .join("");
  }

  _setupSystemCardListeners(win) {
    const cards = win.querySelectorAll(".v86-system-card");
    cards.forEach((card) => {
      card.addEventListener("click", () => {
        const systemId = card.dataset.system;
        const systemName = card.querySelector("div").textContent;
        this.launchSystem(systemId, systemName);
      });
      card.addEventListener("mouseenter", () => {
        card.style.transform = "translateY(-2px)";
        card.style.boxShadow = "0 4px 12px rgba(199,125,255,0.2)";
      });
      card.addEventListener("mouseleave", () => {
        card.style.transform = "";
        card.style.boxShadow = "";
      });
    });
  }

  _setupUploadZone(win) {
    const zone = win.querySelector("#v86-upload-zone");
    const input = win.querySelector("#v86-file-input");

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
    const zone = win.querySelector("#v86-upload-zone");
    const originalHTML = zone.innerHTML;

    zone.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="font-size:20px;color:#c77dff;margin-bottom:8px;display:block;"></i><div style="font-size:13px;color:#bbb;">Saving <strong style="color:#fff;">${file.name}</strong>…</div>`;

    try {
      const blob = new Blob([await file.arrayBuffer()], { type: file.type || "application/octet-stream" });
      await this._fs.writeBinaryFile(IMAGES_DIR, file.name, blob, "other", "/static/icons/v86.webp");
      this._windowManager.sendNotify(`Saved ${file.name} at VMs/ directory.`);
      zone.innerHTML = `<i class="fa-solid fa-circle-check" style="font-size:20px;color:#4caf50;margin-bottom:8px;display:block;"></i><div style="font-size:13px;color:#bbb;">Saved!</div>`;
      await this._loadUserImages(win);
      setTimeout(() => {
        zone.innerHTML = originalHTML;
        win.querySelector("#v86-file-input").addEventListener("change", (e) => {
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

  async _loadUserImages(win) {
    const container = win.querySelector("#v86-user-images");
    if (!container) return;

    try {
      await this._fs.fsReady;
      const dir = this._fs.resolveDir(IMAGES_DIR);
      await this._fs.p("mkdir", dir, { recursive: true }).catch(() => {});
      const files = await this._fs.pRead("readdir", dir).catch(() => []);
      const imageFiles = files.filter(
        (f) =>
          !f.startsWith(".") &&
          (f.endsWith(".iso") || f.endsWith(".img") || f.endsWith(".bin") || f.endsWith(".state") || f.endsWith(".gz"))
      );

      if (imageFiles.length === 0) {
        container.innerHTML = `<div style="font-size:12px;color:#555;padding:4px 0;">No uploaded images yet.</div>`;
        return;
      }

      container.innerHTML = imageFiles
        .map((f) => {
          const displayName = f
            .replace(/\.[^.]+$/, "")
            .replace(/[-_]/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase());
          return `
        <div class="v86-image-card" data-user-file="${f}" style="
          background:#252540;border-radius:10px;padding:14px 16px;
          display:flex;align-items:center;gap:12px;cursor:pointer;
          transition:transform .15s,box-shadow .15s;position:relative;min-width:180px;
        ">
          <i class="fa-solid fa-compact-disc" style="font-size:22px;color:#c77dff;"></i>
          <div style="font-size:13px;color:#fff;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${displayName}</div>
          <button class="v86-delete-btn" data-file="${f}" title="Delete" style="
            background:none;border:none;color:#666;cursor:pointer;font-size:13px;padding:2px 4px;line-height:1;
          "><i class="fa-solid fa-xmark"></i></button>
        </div>
      `;
        })
        .join("");

      container.querySelectorAll(".v86-image-card").forEach((card) => {
        card.addEventListener("click", (e) => {
          if (e.target.closest(".v86-delete-btn")) return;
          const fileName = card.dataset.userFile;
          this.launchImage(fileName, IMAGES_DIR);
        });
        card.addEventListener("mouseenter", () => {
          card.style.transform = "translateY(-2px)";
          card.style.boxShadow = "0 4px 12px rgba(199,125,255,0.2)";
        });
        card.addEventListener("mouseleave", () => {
          card.style.transform = "";
          card.style.boxShadow = "";
        });
      });

      container.querySelectorAll(".v86-delete-btn").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const fileName = btn.dataset.file;
          await this._fs.deleteBinaryFile(IMAGES_DIR, fileName);
          await this._loadUserImages(win);
        });
      });
    } catch {}
  }

  async launchSystem(systemId, displayName) {
    const V86_PATH = "/static/apps/v86/images";
    const systemConfigs = {
      freedos: {
        fda: { url: `${V86_PATH}/freedos722.img`, size: 737280 },
        memory_size: 32 * 1024 * 1024
      },
      openbsd: {
        cdrom: { url: `${V86_PATH}/openbsd_state-v2.bin.zst` },
        memory_size: 192 * 1024 * 1024
      }
    };

    const config = systemConfigs[systemId];
    if (!config) {
      this._windowManager.sendNotify(`System ${systemId} not available.`);
      return;
    }

    this._launchV86(displayName, config);
  }

  async launchImage(fileName, path) {
    const normalizedPath = Array.isArray(path)
      ? path
      : typeof path === "string"
        ? path.split("/").filter(Boolean)
        : Object.values(path ?? {}).filter((v) => typeof v === "string");

    try {
      const blob = await this._fs.readBinaryFile(normalizedPath, fileName);
      if (!blob || blob.size === 0) {
        this._windowManager.sendNotify("Failed to read image file.");
        return;
      }

      const arrayBuffer = await blob.arrayBuffer();
      const ext = fileName.toLowerCase().split(".").pop();

      let config = {};
      if (ext === "iso") {
        config.cdrom = { buffer: arrayBuffer };
      } else if (ext === "img" || ext === "bin") {
        if (arrayBuffer.byteLength <= 1474560) {
          config.fda = { buffer: arrayBuffer };
        } else {
          config.hda = { buffer: arrayBuffer };
        }
      } else if (ext === "state" || ext === "gz") {
        config.initial_state = { buffer: arrayBuffer };
      }

      const displayName = fileName
        .replace(/\.[^.]+$/, "")
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

      this._launchV86(displayName, config);
    } catch (e) {
      this._windowManager.sendNotify(`Error loading image: ${e.message}`);
    }
  }

  async _launchV86(displayName, config) {
    const wm = this._windowManager;
    const winId = `v86-${Date.now()}`;
    const win = wm.createWindow(winId, displayName, "800px", "600px");

    if (window.achievements) {
      window.achievements.trigger(Achievements.RetroPlayer);
    }

    win.innerHTML = `
    <div class="window-header">
      <span>${displayName}</span>
      ${wm.getWindowControls()}
    </div>
    <div class="window-content" style="width:100%;height:calc(100% - 30px);background:#000;position:relative;overflow:hidden;">
      <div id="${winId}-inner" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;">
        <i class="fa-solid fa-microchip fa-spin" style="font-size:32px;color:#c77dff;"></i>
        <div style="font-size:15px;color:#c77dff;">Starting <strong style="color:#fff;">${displayName}</strong>…</div>
        <div id="${winId}-log" style="font-size:11px;color:#888;max-width:400px;text-align:center;"></div>
      </div>
      <div id="${winId}-screen" style="width:100%;height:100%;display:none;overflow:hidden;"></div>
    </div>`;

    desktop.appendChild(win);
    wm.makeDraggable(win);
    wm.makeResizable(win);
    wm.addToTaskbar(winId, displayName, "/static/icons/v86.webp");

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

    let emulator = null;

    const cleanup = () => {
      if (emulator) {
        try {
          emulator.stop();
          emulator.destroy();
        } catch {}
        emulator = null;
      }
    };

    wm.setupWindowControls(win);

    win.querySelector(".close-btn").addEventListener("click", () => {
      cleanup();
      wm.removeFromTaskbar(winId);
      win.remove();
    });

    win.querySelector(".minimize-btn").addEventListener("click", () => {
      wm.minimizeWindow(win);
    });

    try {
      await this._loadV86Script();

      if (typeof V86 === "undefined") {
        showError("V86 failed to initialize");
        return;
      }

      setLog("Initializing emulator…");

      const screenContainer = document.createElement("div");
      screenContainer.style.cssText = "width:100%;height:100%;";
      screenDiv.appendChild(screenContainer);

      const baseConfig = {
        wasm_path: "/static/apps/v86/build/v86.wasm",
        memory_size: 32 * 1024 * 1024,
        vga_memory_size: 2 * 1024 * 1024,
        screen_container: screenContainer,
        bios: { url: "/static/apps/v86/bios/seabios.bin" },
        vga_bios: { url: "/static/apps/v86/bios/vgabios.bin" },
        autostart: true,
        ...config
      };

      emulator = new V86(baseConfig);

      emulator.add_listener("emulator-ready", () => {
        inner.style.display = "none";
        screenDiv.style.display = "block";
      });

      emulator.add_listener("emulator-started", () => {
        inner.style.display = "none";
        screenDiv.style.display = "block";
      });

      emulator.add_listener("download-progress", (e) => {
        if (e.loaded && e.total) {
          const pct = Math.round((e.loaded / e.total) * 100);
          setLog(`Downloading… ${pct}%`);
        }
      });

      emulator.add_listener("download-error", (e) => {
        showError(`Download failed: ${e.file_name || "unknown file"}`);
      });
    } catch (e) {
      showError(`Failed to start: ${e.message}`);
    }

    const resizeObserver = new ResizeObserver(() => {
      if (emulator && screenDiv.style.display !== "none") {
        const canvas = screenDiv.querySelector("canvas");
        if (canvas) {
          canvas.style.width = "100%";
          canvas.style.height = "100%";
        }
      }
    });
    resizeObserver.observe(win);
  }

  _loadV86Script() {
    if (this._v86LoadPromise) {
      return this._v86LoadPromise;
    }

    if (typeof V86 !== "undefined") {
      return Promise.resolve();
    }

    this._v86LoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://copy.sh/v86/build/libv86.js";
      script.onload = () => {
        const checkReady = (attempts = 0) => {
          if (typeof V86 !== "undefined") {
            resolve();
          } else if (attempts < 50) {
            setTimeout(() => checkReady(attempts + 1), 100);
          } else {
            reject(new Error("V86 not available after script load"));
          }
        };
        checkReady();
      };
      script.onerror = () => reject(new Error("Failed to load V86 library"));
      document.head.appendChild(script);
    });

    return this._v86LoadPromise;
  }

  async launchFromFile(file) {
    const arrayBuffer = await file.arrayBuffer();
    const fileName = file.name;
    const ext = fileName.toLowerCase().split(".").pop();

    let config = {};
    if (ext === "iso") {
      config.cdrom = { buffer: arrayBuffer };
    } else if (ext === "img" || ext === "bin") {
      if (arrayBuffer.byteLength <= 1474560) {
        config.fda = { buffer: arrayBuffer };
      } else {
        config.hda = { buffer: arrayBuffer };
      }
    } else if (ext === "state" || ext === "gz") {
      config.initial_state = { buffer: arrayBuffer };
    }

    const displayName = fileName
      .replace(/\.[^.]+$/, "")
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

    this._launchV86(displayName, config);
  }
}
