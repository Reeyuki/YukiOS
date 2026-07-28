import { Achievements } from "../achievements.js";
import { CDN_BASES } from "../shared/assetResolver.js";

import { BusEvents, BaseApp, os, $, $$, setStyle } from "../framework.js";
import { resolveIconUrl } from "../shared/assetResolver.js";
const IMAGES_DIR = ["VMs"];

export class V86App extends BaseApp {
  constructor(os) {
    super(os);
    this.explorerApp = os.app.getInstance("explorerApp");
    this.v86LoadPromise = null;
  }

  open(opts) {
    const systems = [
      { id: "freedos", name: "FreeDOS", icon: "fa-solid fa-terminal" },
      { id: "openbsd", name: "OpenBSD", icon: "fa-solid fa-fish" }
    ];

    const win = os.window.create("v86-win", "V86", "800px", "600px", {
      icon: resolveIconUrl("static/icons/v86.webp")
    });
    win.innerHTML = `<div class="window-content v86-shell emu-shell">
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
    </div>`;

    const uploadZone = $("#v86-upload-zone", win);
    const fileInput = $("#v86-file-input", win);

    uploadZone?.addEventListener("click", () => fileInput?.click());
    uploadZone?.addEventListener("dragover", (e) => {
      e.preventDefault();
      uploadZone.classList.add("v86-upload-zone-dragover");
    });
    uploadZone?.addEventListener("dragleave", () => {
      uploadZone.classList.remove("v86-upload-zone-dragover");
    });
    uploadZone?.addEventListener("drop", async (e) => {
      e.preventDefault();
      uploadZone.classList.remove("v86-upload-zone-dragover");
      const file = e.dataTransfer.files[0];
      if (file) await this.handleUploadedFile(file, uploadZone);
    });

    fileInput?.addEventListener("change", async () => {
      const file = fileInput.files[0];
      if (file) await this.handleUploadedFile(file, uploadZone);
      fileInput.value = "";
    });

    $$(".v86-system-card", win).forEach((card) => {
      card.addEventListener("click", () => {
        const systemId = card.dataset.system;
        const systemName = $("div", card).textContent;
        this.launchSystem(systemId, systemName);
      });
      card.addEventListener("mouseenter", () => card.classList.add("emu-card--hover"));
      card.addEventListener("mouseleave", () => card.classList.remove("emu-card--hover"));
    });

    this.initV86(null, null, win, null);
  }

  async initV86(payload, event, element, state) {
    this.loadV86Script();
    await this.loadUserImages(element);
  }

  async handleUploadedFile(file, zone) {
    const originalHTML = zone.innerHTML;

    zone.innerHTML = `<i class="fa-solid fa-spinner fa-spin v86-loading-icon emu-state-icon"></i><div class="v86-loading-text emu-state-text">Saving <strong>${file.name}</strong>…</div>`;

    try {
      const blob = new Blob([await file.arrayBuffer()], { type: file.type || "application/octet-stream" });
      await os.fs.writeBinaryFile(IMAGES_DIR, file.name, blob, "other", resolveIconUrl("static/icons/v86.webp"));
      os.notify.send("V86", `Saved ${file.name} to VMs.`);
      zone.innerHTML = `<i class="fa-solid fa-circle-check v86-success-icon emu-state-icon"></i><div class="v86-success-text emu-state-text">Saved!</div>`;
      await this.loadUserImages($("#v86-win"));
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

  async loadUserImages(win) {
    const container = $("#v86-user-images", win);
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

      $$(".v86-image-card", container).forEach((card) => {
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

      $$(".v86-delete-btn", container).forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const fileName = btn.dataset.file;
          await os.fs.deleteBinaryFile(IMAGES_DIR, fileName);
          await this.loadUserImages(win);
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
        cdrom: { url: `${V86_PATH}/openbsdstate-v2.bin.zst` },
        memory_size: 192 * 1024 * 1024
      }
    };

    const config = systemConfigs[systemId];
    if (!config) {
      os.notify.send("V86", `System ${systemId} isn't available.`);
      return;
    }

    this.launchV86(displayName, config);
  }

  async launchImage(fileName, path) {
    const normalizedPath = Array.isArray(path)
      ? path
      : typeof path === "string"
        ? path.split("/").filter(Boolean)
        : Object.values(path ?? {}).filter((v) => typeof v === "string");

    try {
      const blob = await os.fs.readBinaryFile(normalizedPath, fileName);
      if (!blob || blob.size === 0) {
        os.notify.send("V86", "Couldn't read that image file.");
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
        config.initialstate = { buffer: arrayBuffer };
      }

      const displayName = fileName
        .replace(/\.[^.]+$/, "")
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

      this.launchV86(displayName, config);
    } catch (e) {
      os.notify.send("V86", `Image wouldn't load: ${e.message}`);
    }
  }

  async launchV86(displayName, config) {
    const winId = `v86-${Date.now()}`;
    const win = os.window.create(winId, displayName, "800px", "600px", {
      icon: "static/icons/v86.webp"
    });

    os.events.emit(BusEvents.ACHIEVEMENT_TRIGGER, { achievementId: Achievements.RetroPlayer });

    win.innerHTML = `
    <div class="window-content v86-window emu-window">
      <div id="${winId}-inner" class="v86-loading emu-state emu-load-wrap">
        <i class="fa-solid fa-microchip fa-spin v86-state-icon emu-state-icon"></i>
        <div class="v86-state-text emu-state-text emu-state-text--accent">Starting <strong>${displayName}</strong>…</div>
        <div id="${winId}-log" class="v86-log emu-state-text--muted"></div>
      </div>
      <div id="${winId}-screen" class="v86-screen emu-window-screen"></div>
    </div>`;

    const inner = $(`#${winId}-inner`, win);
    const screenDiv = $(`#${winId}-screen`, win);
    const log = $(`#${winId}-log`, win);

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
      await this.loadV86Script();

      if (typeof V86 === "undefined") {
        showError("V86 failed to initialize");
        return;
      }

      setLog("Booting up…");

      const screenContainer = document.createElement("div");
      setStyle(screenContainer, { width: "100%", height: "100%" });
      screenDiv.appendChild(screenContainer);

      const baseConfig = {
        wasm_path: CDN_BASES.MAIN + "/static/apps/v86/build/v86.wasm",
        memory_size: 32 * 1024 * 1024,
        vga_memory_size: 2 * 1024 * 1024,
        screencontainer: screenContainer,
        bios: { url: CDN_BASES.MAIN + "/static/apps/v86/bios/seabios.bin" },
        vga_bios: { url: CDN_BASES.MAIN + "/static/apps/v86/bios/vgabios.bin" },
        autostart: true,
        ...config
      };

      emulator = new V86(baseConfig);

      emulator.add_listener("emulator-ready", () => {
        setStyle(inner, { display: "none" });
        setStyle(screenDiv, { display: "block" });
      });

      emulator.add_listener("emulator-started", () => {
        setStyle(inner, { display: "none" });
        setStyle(screenDiv, { display: "block" });
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
        const canvas = $("canvas", screenDiv);
        if (canvas) {
          setStyle(canvas, { width: "100%", height: "100%" });
        }
      }
    });
    resizeObserver.observe(win);
  }

  loadV86Script() {
    if (this.v86LoadPromise) {
      return this.v86LoadPromise;
    }

    if (typeof V86 !== "undefined") {
      return Promise.resolve();
    }

    this.v86LoadPromise = new Promise((resolve, reject) => {
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

    return this.v86LoadPromise;
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
      config.initialstate = { buffer: arrayBuffer };
    }

    const displayName = fileName
      .replace(/\.[^.]+$/, "")
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

    this.launchV86(displayName, config);
  }
}
