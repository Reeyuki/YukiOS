import "../styles/colorPicker.css";
import { $, $$, setStyle } from "../shared/domUtils.js";
import { BaseApp, os, StorageKeys } from "../framework.js";
import { KeybindManager } from "../keybindManager.js";

export class ColorPickerApp extends BaseApp {
  constructor(services) {
    super(services);
    this.openWindows = new Set();
    this.colors = [];
    this.win = null;
    this.registerGlobalShortcut();
  }

  registerGlobalShortcut() {
    document.addEventListener("keydown", (e) => {
      if (KeybindManager.matches(e, "global.colorPicker")) {
        e.preventDefault();
        if (!this.openWindows.has("color-picker")) this.open();
        this.pick();
      }
    });
  }

  open() {
    const winId = "color-picker";
    if (this.openWindows.has(winId)) return;

    const win = os.window.create(winId, "Color Picker", "360px", "480px", {
      icon: "fas fa-eye-dropper"
    });

    win.classList.add("cp-window");
    win.innerHTML = this.buildUI();
    this.win = win;
    this.openWindows.add(winId);

    this.setupEvents(win);
    this.loadHistory();

    win.addEventListener("remove", () => {
      this.openWindows.delete(winId);
      this.win = null;
    });
  }

  buildUI() {
    const supportsEyeDropper = "EyeDropper" in window;
    return `
      <div class="window-content cp-root">
        <div class="cp-header">
          <strong>Color Picker</strong><br>
          Press <kbd>Alt</kbd> + <kbd>H</kbd> or click the button below.<br>
          ${
            supportsEyeDropper
              ? "A browser magnifier lets you pick any pixel on screen."
              : "A screenshot-based magnifier will appear. Click to pick a color."
          }
        </div>

        <div class="cp-preview-area">
          <div class="cp-swatch" id="cp-swatch"></div>
          <div class="cp-color-info">
            <div class="cp-hex-label">Hex</div>
            <div class="cp-hex-value" id="cp-hex">-</div>
            <div class="cp-rgb-value" id="cp-rgb">-</div>
          </div>
        </div>

        <button class="cp-btn-activate" id="cp-activate">
          <i class="fas fa-eye-dropper"></i>
          <span>Pick Color from Screen</span>
        </button>

        <div class="cp-history-section" id="cp-history-section" style="display:none">
          <div class="cp-history-label">Recent Colors</div>
          <div class="cp-history" id="cp-history"></div>
        </div>
      </div>
    `;
  }

  setupEvents(win) {
    win.querySelector("#cp-activate").addEventListener("click", () => this.pick());
  }

  loadHistory() {
    const saved = os.storage.get(StorageKeys.colorPickerHistory);
    if (saved) {
      try {
        this.colors = JSON.parse(saved);
      } catch {
        this.colors = [];
      }
    }
    this.renderHistory();
  }

  saveHistory() {
    this.colors = this.colors.slice(0, 20);
    os.storage.set(StorageKeys.colorPickerHistory, JSON.stringify(this.colors));
  }

  renderHistory() {
    const section = $("#cp-history-section");
    const container = $("#cp-history");
    if (!container || !section) return;

    if (this.colors.length === 0) {
      setStyle(section, { display: "none" });
      return;
    }

    setStyle(section, { display: "flex" });
    container.innerHTML = this.colors
      .map(
        (c) => `
        <div class="cp-history-item" data-color="${c}">
          <span class="cp-history-swatch" style="background:${c}"></span>
          ${c}
        </div>
      `
      )
      .join("");

    $$(".cp-history-item", container).forEach((el) => {
      el.addEventListener("click", () => {
        const color = el.dataset.color;
        navigator.clipboard.writeText(color).catch(() => {});
        os.notify.send("Color Picker", `Copied ${color} to clipboard`);
      });
    });
  }

  addColor(hex) {
    this.colors = this.colors.filter((c) => c !== hex);
    this.colors.unshift(hex);
    this.saveHistory();
    this.renderHistory();
  }

  updatePreview(hex) {
    const swatch = $("#cp-swatch");
    const hexEl = $("#cp-hex");
    const rgbEl = $("#cp-rgb");
    if (!swatch || !hexEl || !rgbEl) return;

    setStyle(swatch, { background: hex });
    hexEl.textContent = hex.toUpperCase();
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    rgbEl.textContent = `rgb(${r}, ${g}, ${b})`;
  }

  async pick() {
    if ("EyeDropper" in window) {
      await this.pickWithEyeDropper();
    } else {
      await this.pickWithFallback();
    }
  }

  async pickWithEyeDropper() {
    try {
      const eyeDropper = new EyeDropper();
      const result = await eyeDropper.open();
      const hex = result.sRGBHex;

      navigator.clipboard.writeText(hex).catch(() => {});
      this.addColor(hex);
      this.updatePreview(hex);
      os.notify.send("Color Picker", `Copied ${hex} to clipboard`);
    } catch {
      /* user cancelled (ESC) */
    }
  }

  async pickWithFallback() {
    if (this.picking) return;
    this.picking = true;

    const btn = $("#cp-activate");
    if (btn) {
      btn.innerHTML = '<i class="fas fa-spinner fa-pulse"></i><span>Capturing screen…</span>';
    }

    this.createOverlay();

    if (btn) {
      btn.innerHTML = '<i class="fas fa-eye-dropper"></i><span>Click on the screen to pick a color</span>';
    }

    this.picking = false;
  }

  createOverlay() {
    const overlay = document.createElement("div");
    overlay.className = "cp-overlay";
    overlay.id = "cp-overlay";

    document.body.appendChild(overlay);
    this.overlay = overlay;

    this.loadHtml2canvasPro()
      .then(() => {
        if (!document.body.contains(overlay)) return;
        this.captureAndMagnify(overlay);
      })
      .catch((err) => {
        console.error("[ColorPicker] fallback failed:", err);
        os.notify.send("Color Picker", "Color picking not available in this browser. Try Chrome or Edge.", {
          type: "error"
        });
        this.removeOverlay();
      });
  }

  async loadHtml2canvasPro() {
    if (window.html2canvas) return;
    if (__SINGLE_FILE__) {
      const mod = await import("html2canvas-pro");
      window.html2canvas = mod.default || mod;
      return;
    }
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/html2canvas-pro@1.5.8/dist/html2canvas-pro.min.js";
    document.head.appendChild(s);
    await new Promise((resolve, reject) => {
      s.onload = resolve;
      s.onerror = () => reject(new Error("CDN script failed to load"));
    });
  }

  async captureAndMagnify(overlay) {
    try {
      const target = $("#desktop") || document.body;
      const canvas = await window.html2canvas(target, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#1a1a2e",
        scale: 1,
        logging: false,
        width: window.innerWidth,
        height: window.innerHeight,
        x: window.scrollX,
        y: window.scrollY
      });

      if (!document.body.contains(overlay)) return;

      const magnifier = document.createElement("div");
      magnifier.className = "cp-magnifier";
      const magCanvas = document.createElement("canvas");
      magCanvas.width = 160;
      magCanvas.height = 160;
      magnifier.appendChild(magCanvas);

      const info = document.createElement("div");
      info.className = "cp-magnifier-info";

      document.body.appendChild(magnifier);
      document.body.appendChild(info);

      const srcCtx = canvas.getContext("2d");
      const magCtx = magCanvas.getContext("2d");
      const srcW = canvas.width;
      const srcH = canvas.height;

      const update = (clientX, clientY) => {
        const half = 8;
        const cx = Math.max(half, Math.min(srcW - half, clientX));
        const cy = Math.max(half, Math.min(srcH - half, clientY));

        magCtx.imageSmoothingEnabled = false;
        magCtx.clearRect(0, 0, 160, 160);
        magCtx.drawImage(canvas, cx - half, cy - half, 16, 16, 0, 0, 160, 160);
        magCtx.strokeStyle = "rgba(255,255,255,0.3)";
        magCtx.lineWidth = 1;
        magCtx.strokeRect(72, 72, 16, 16);

        const pd = srcCtx.getImageData(Math.round(cx), Math.round(cy), 1, 1).data;
        const hex = "#" + [pd[0], pd[1], pd[2]].map((x) => Math.round(x).toString(16).padStart(2, "0")).join("");

        const ml = clientX - 80;
        magnifier.style.left = `${ml}px`;
        magnifier.style.top = `${Math.max(0, clientY - 184)}px`;

        info.innerHTML = `<span class="cp-info-swatch" style="background:${hex}"></span>${hex.toUpperCase()}`;
        info.style.left = `${Math.min(clientX + 20, window.innerWidth - 160)}px`;
        info.style.top = `${Math.max(0, clientY - 40)}px`;

        this.currentHex = hex;
      };

      const onMove = (e) => update(e.clientX, e.clientY);
      const onClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const hex = this.currentHex || "#000000";
        navigator.clipboard.writeText(hex).catch(() => {});
        this.addColor(hex);
        this.updatePreview(hex);
        os.notify.send("Color Picker", `Copied ${hex} to clipboard`);
        this.removeOverlay();
      };

      overlay.addEventListener("mousemove", onMove);
      overlay.addEventListener("click", onClick);

      this.magnifier = magnifier;
      this.info = info;
      this.cleanupOverlay = () => {
        overlay.removeEventListener("mousemove", onMove);
        overlay.removeEventListener("click", onClick);
      };
    } catch (err) {
      console.error("[ColorPicker] capture failed:", err);
      os.notify.send("Color Picker", "Screen capture not supported in this browser", { type: "error" });
      this.removeOverlay();
    }
  }

  removeOverlay() {
    if (this.cleanupOverlay) this.cleanupOverlay();
    this.cleanupOverlay = null;
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    if (this.magnifier) {
      this.magnifier.remove();
      this.magnifier = null;
    }
    if (this.info) {
      this.info.remove();
      this.info = null;
    }
    this.currentHex = null;

    const btn = $("#cp-activate");
    if (btn) {
      btn.innerHTML = '<i class="fas fa-eye-dropper"></i><span>Pick Color from Screen</span>';
    }
  }

  onClose(winId) {
    this.openWindows.delete(winId);
    this.win = null;
    this.removeOverlay();
  }
}
