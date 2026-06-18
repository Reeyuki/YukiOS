import { Achievements } from "../achievements.js";
import { WindowHelper } from "../utils/WindowHelper.js";
import { CDN_BASES } from "../shared/assetResolver.js";
import { resolveIconUrl } from "../shared/assetResolver.js";

import { BaseApp, PersistenceTypes, os } from "../framework.js";
const IMAGES_DIR = ["VMs"];

export class V86App extends BaseApp {
  constructor(services) {
    super(services);
    this.windowHelper = new WindowHelper(services);
    this._explorerApp = services.explorerApp;
    this._v86LoadPromise = null;
  }

  getDeclarativeSchema(opts) {
    const systems = [
      { id: "freedos", name: "FreeDOS", icon: "fa-solid fa-terminal" },
      { id: "openbsd", name: "OpenBSD", icon: "fa-solid fa-fish" }
    ];

    return {
      id: "v86-win",
      name: "V86",
      icon: resolveIconUrl("static/icons/v86.webp"),
      windows: [
        {
          id: "v86-win",
          title: "V86",
          size: ["800px", "600px"],
          icon: resolveIconUrl("static/icons/v86.webp"),
          ui: `<div class="window-content v86-shell emu-shell">
        <div class="v86-header emu-header">
          <i class="fa-solid fa-microchip v86-header-icon emu-header-icon"></i>
          <div class="v86-header-text emu-header-text">
            <div class="v86-title emu-title">V86 Emulator</div>
            <div class="v86-subtitle emu-subtitle">Run x86 operating systems in your browser</div>
          </div>
        </div>
        <div 
          id="v86-upload-zone"
          class="v86-upload-zone emu-upload-zone"
        >
          <i class="fa-solid fa-upload v86-upload-icon emu-upload-icon"></i>
          <div class="v86-upload-text emu-upload-text">Drop a <strong>.iso</strong>, <strong>.img</strong>, or <strong>.bin</strong> file here</div>
          <div class="v86-upload-subtext emu-upload-subtext">or click to browse</div>
          <input type="file" id="v86-file-input" class="emu-file-input" accept=".iso,.img,.bin,.state,.gz">
        </div>
        <div class="v86-section-title emu-section-title">My Images</div>
        <div id="v86-user-images" class="emu-grid"></div>
        <div class="v86-section-title emu-section-title">Featured Systems</div>
        <div class="v86-system-grid emu-grid" id="v86-system-grid">
          ${systems
            .map(
              (sys) => `
      <div class="v86-system-card emu-card" data-system="${sys.id}">
        <i class="${sys.icon} v86-system-icon emu-card-icon"></i>
        <div class="v86-system-name emu-card-title">${sys.name}</div>
      </div>
    `
            )
            .join("")}
        </div>
      </div>`,
          events: {
            "#v86-upload-zone": {
              click: {
                type: "custom:uploadClick",
                stopPropagation: true
              },
              dragover: {
                type: "custom:dragOver",
                stopPropagation: false
              },
              dragleave: {
                type: "custom:dragLeave",
                stopPropagation: false
              },
              drop: {
                type: "custom:dropFile",
                stopPropagation: false
              }
            },
            "#v86-file-input": {
              change: {
                type: "custom:fileChange",
                stopPropagation: false
              }
            },
            ".v86-system-card": {
              click: {
                type: "custom:launchSystem",
                stopPropagation: true
              }
            }
          }
        }
      ],
      state: {
        initial: {
          userImages: []
        },
        persistence: PersistenceTypes.MEMORY
      },
      actions: {
        uploadClick: (payload, event, element, state) => {
          const input = document.getElementById("v86-file-input");
          if (input) input.click();
        },
        dragOver: (payload, event, element, state) => {
          event.preventDefault();
          element.classList.add("v86-upload-zone-dragover");
        },
        dragLeave: (payload, event, element, state) => {
          element.classList.remove("v86-upload-zone-dragover");
        },
        dropFile: async (payload, event, element, state) => {
          event.preventDefault();
          element.classList.remove("v86-upload-zone-dragover");
          const file = event.dataTransfer.files[0];
          if (file) await this._handleUploadedFile(file, element);
        },
        fileChange: async (payload, event, element, state) => {
          const file = element.files[0];
          if (file) await this._handleUploadedFile(file, document.getElementById("v86-upload-zone"));
          element.value = "";
        },
        launchSystem: (payload, event, element, state) => {
          const systemId = element.dataset.system;
          const systemName = element.querySelector("div").textContent;
          this.launchSystem(systemId, systemName);
        }
      }
    };
  }

  open() {
    this._loadV86Script();

    const winId = `v86-${Date.now()}`;

    const content = `
      <div class="window-content v86-shell emu-shell">
        <div class="v86-header emu-header">
          <i class="fa-solid fa-microchip v86-header-icon emu-header-icon"></i>
          <div class="v86-header-text emu-header-text">
            <div class="v86-title emu-title">V86 Emulator</div>
            <div class="v86-subtitle emu-subtitle">Run x86 operating systems in your browser</div>
          </div>
        </div>
        <div 
          id="v86-upload-zone"
          class="v86-upload-zone emu-upload-zone"
        >
          <i class="fa-solid fa-upload v86-upload-icon emu-upload-icon"></i>
          <div class="v86-upload-text emu-upload-text">Drop a <strong>.iso</strong>, <strong>.img</strong>, or <strong>.bin</strong> file here</div>
          <div class="v86-upload-subtext emu-upload-subtext">or click to browse</div>
          <input type="file" id="v86-file-input" class="emu-file-input" accept=".iso,.img,.bin,.state,.gz">
        </div>
        <div class="v86-section-title emu-section-title">My Images</div>
        <div id="v86-user-images" class="emu-grid"></div>
        <div class="v86-section-title emu-section-title">Featured Systems</div>
        <div class="v86-system-grid emu-grid" id="v86-system-grid">
          ${this._generateSystemCards()}
        </div>
      </div>`;

    const win = this.windowHelper.createAndMountWindow(winId, "V86", content, "800px", "600px", {
      icon: resolveIconUrl("static/icons/v86.webp")
    });

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
      <div class="v86-system-card emu-card" data-system="${sys.id}">
        <i class="${sys.icon} v86-system-icon emu-card-icon"></i>
        <div class="v86-system-name emu-card-title">${sys.name}</div>
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
        card.classList.add("emu-card--hover");
      });
      card.addEventListener("mouseleave", () => {
        card.classList.remove("emu-card--hover");
      });
    });
  }

  _setupUploadZone(win) {
    const zone = win.querySelector("#v86-upload-zone");
    const input = win.querySelector("#v86-file-input");

    zone.addEventListener("click", () => input.click());

    zone.addEventListener("dragover", (e) => {
      e.preventDefault();
      zone.classList.add("v86-upload-zone-dragover");
    });

    zone.addEventListener("dragleave", () => {
      zone.classList.remove("v86-upload-zone-dragover");
    });

    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.classList.remove("v86-upload-zone-dragover");
      const file = e.dataTransfer.files[0];
      if (file) this._handleUploadedFile(file, win);
    });

    input.addEventListener("change", () => {
      const file = input.files[0];
      if (file) this._handleUploadedFile(file, win);
      input.value = "";
    });
  }

  async _handleUploadedFile(file, zone) {
    const originalHTML = zone.innerHTML;

    zone.innerHTML = `<i class="fa-solid fa-spinner fa-spin v86-loading-icon emu-state-icon"></i><div class="v86-loading-text emu-state-text">Saving <strong>${file.name}</strong>…</div>`;

    try {
      const blob = new Blob([await file.arrayBuffer()], { type: file.type || "application/octet-stream" });
      await os.fs.writeBinaryFile(IMAGES_DIR, file.name, blob, "other", resolveIconUrl("static/icons/v86.webp"));
      os.notify.send("V86", `Saved ${file.name} at VMs/ directory.`);
      zone.innerHTML = `<i class="fa-solid fa-circle-check v86-success-icon emu-state-icon"></i><div class="v86-success-text emu-state-text">Saved!</div>`;
      await this._loadUserImages(document.querySelector("#v86-win"));
      setTimeout(() => {
        zone.innerHTML = originalHTML;
      }, 1500);
    } catch (err) {
      zone.innerHTML = `<i class="fa-solid fa-triangle-exclamation v86-error-icon emu-state-icon emu-state--error"></i><div class="v86-error-text emu-state-text emu-state--error">${err.message}</div>`;
      setTimeout(() => {
        zone.innerHTML = originalHTML;
      }, 2500);
    }
  }

  async _loadUserImages(win) {
    const container = win.querySelector("#v86-user-images");
    if (!container) return;

    try {
      await os.fs.mkdir(IMAGES_DIR).catch(() => {});
      const entries = await os.fs.readdir(IMAGES_DIR).catch(() => ({}));
      const files = Object.keys(entries).filter((k) => entries[k]?.type === "file");
      const imageFiles = files.filter(
        (f) =>
          !f.startsWith(".") &&
          (f.endsWith(".iso") || f.endsWith(".img") || f.endsWith(".bin") || f.endsWith(".state") || f.endsWith(".gz"))
      );

      if (imageFiles.length === 0) {
        container.innerHTML = `<div class="v86-empty-text emu-empty">No uploaded images yet.</div>`;
        return;
      }

      container.innerHTML = imageFiles
        .map((f) => {
          const displayName = f
            .replace(/\.[^.]+$/, "")
            .replace(/[-_]/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase());
          return `
        <div class="v86-image-card emu-card emu-card--removable" data-user-file="${f}">
          <i class="fa-solid fa-compact-disc v86-image-icon emu-card-icon"></i>
          <div class="v86-image-name emu-card-title">${displayName}</div>
          <button class="v86-delete-btn emu-delete-btn" data-file="${f}" title="Delete"><i class="fa-solid fa-xmark"></i></button>
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
          card.classList.add("emu-card--hover");
        });
        card.addEventListener("mouseleave", () => {
          card.classList.remove("emu-card--hover");
        });
      });

      container.querySelectorAll(".v86-delete-btn").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const fileName = btn.dataset.file;
          await os.fs.deleteBinaryFile(IMAGES_DIR, fileName);
          await this._loadUserImages(win);
        });
      });
    } catch {}
  }

  async launchSystem(systemId, displayName) {
    const V86_PATH = CDN_BASES.MAIN + "/static/apps/v86/images";
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
      os.notify.send("V86", `System ${systemId} not available.`);
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
      const blob = await os.fs.read([...normalizedPath, fileName]);
      if (!blob || blob.size === 0) {
        os.notify.send("V86", "Failed to read image file.");
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
      os.notify.send("V86", `Error loading image: ${e.message}`);
    }
  }

  async _launchV86(displayName, config) {
    const winId = `v86-${Date.now()}`;
    const win = os.window.create(winId, displayName, "800px", "600px", {
      icon: "static/icons/v86.webp"
    });

    if (true) {
      os.events.emit("achievement:trigger", { achievementId: Achievements.RetroPlayer });
    }

    win.innerHTML = `
    <div class="window-content v86-window emu-window">
      <div id="${winId}-inner" class="v86-loading emu-state emu-load-wrap">
        <i class="fa-solid fa-microchip fa-spin v86-state-icon emu-state-icon"></i>
        <div class="v86-state-text emu-state-text emu-state-text--accent">Starting <strong>${displayName}</strong>…</div>
        <div id="${winId}-log" class="v86-log emu-state-text--muted"></div>
      </div>
      <div id="${winId}-screen" class="v86-screen emu-window-screen"></div>
    </div>`;

    this.windowHelper.mountWindow(win, winId, displayName, resolveIconUrl("static/icons/v86.webp"));

    const inner = win.querySelector(`#${winId}-inner`);
    const screenDiv = win.querySelector(`#${winId}-screen`);
    const log = win.querySelector(`#${winId}-log`);

    const setLog = (msg) => {
      if (log) log.textContent = msg;
    };

    const showError = (msg) => {
      if (inner)
        inner.innerHTML = `
      <div class="v86-error emu-state emu-state--error">
        <i class="fa-solid fa-triangle-exclamation v86-error-icon emu-state-icon"></i>
        <div class="v86-error-msg emu-state-text emu-state--error">${msg}</div>
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

    this.onClose(winId, cleanup);

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
        wasm_path: CDN_BASES.MAIN + "/static/apps/v86/build/v86.wasm",
        memory_size: 32 * 1024 * 1024,
        vga_memory_size: 2 * 1024 * 1024,
        screen_container: screenContainer,
        bios: { url: CDN_BASES.MAIN + "/static/apps/v86/bios/seabios.bin" },
        vga_bios: { url: CDN_BASES.MAIN + "/static/apps/v86/bios/vgabios.bin" },
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
