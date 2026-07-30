import "../styles/magnifier.css";
import { $, setStyle, createElement } from "../shared/domUtils.js";
import { BaseApp, os } from "../framework.js";
import { KeybindManager } from "../keybindManager.js";

export class MagnifierApp extends BaseApp {
  constructor(services) {
    super(services);
    this.panel = null;
    this.zoom = 2;
    this.desktop = null;
    this.cursorX = 0;
    this.cursorY = 0;
    this.savedTransform = "";
    this.savedOrigin = "";
    this.registerGlobalShortcut();
  }

  registerGlobalShortcut() {
    const handler = (e) => {
      if (e.target.closest("input, textarea, [contenteditable]")) return;
      if (KeybindManager.matches(e, "global.magnifier")) {
        e.preventDefault();
        if (this.panel) this.close();
        else this.open();
      }
    };
    document.addEventListener("keydown", handler);
    this._shortcutHandler = handler;
  }

  open() {
    if (this.panel) return;

    this.panel = createElement("div");
    this.panel.className = "magnifier-panel";
    this.panel.innerHTML = this.buildUI();
    document.body.appendChild(this.panel);
    this.makeDraggable(this.panel);

    const close = createElement("button");
    close.className = "magnifier-close";
    close.innerHTML = '<i class="fas fa-times"></i>';
    close.addEventListener("click", () => this.close());
    this.panel.querySelector(".magnifier-panel-header").appendChild(close);

    this.setupEvents();
    this.startMagnifier();
  }

  buildUI() {
    return `
      <div class="magnifier-panel-header">
        <span class="magnifier-panel-title">
          <i class="fas fa-search-plus"></i> Magnifier
        </span>
      </div>
      <div class="magnifier-body">
        <div class="magnifier-zoom-row">
          <button class="magnifier-btn" id="magnifier-zoom-out">
            <i class="fas fa-minus"></i>
          </button>
          <span class="magnifier-pct" id="magnifier-zoom-level">200%</span>
          <button class="magnifier-btn" id="magnifier-zoom-in">
            <i class="fas fa-plus"></i>
          </button>
        </div>
        <div class="magnifier-hint">Ctrl+M to close</div>
      </div>
    `;
  }

  makeDraggable(el) {
    const header = el.querySelector(".magnifier-panel-header");
    let dragging = false;
    let startX, startY, origX, origY, origRight;

    const onDown = (e) => {
      if (e.target.closest("button")) return;
      dragging = true;
      const rect = el.getBoundingClientRect();
      origX = rect.left;
      origY = rect.top;
      origRight = el.style.right;
      startX = e.clientX;
      startY = e.clientY;
      el.style.right = "auto";
    };

    const onMove = (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      setStyle(el, { left: origX + dx + "px", top: origY + dy + "px" });
    };

    const onUp = () => {
      dragging = false;
    };

    header.addEventListener("mousedown", onDown);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  setupEvents() {
    if (!this.panel) return;
    this.panel.querySelector("#magnifier-zoom-in").addEventListener("click", () => {
      if (this.zoom === 1) {
        this.setZoom(2);
        return;
      }
      const levels = [2, 4, 8, 16];
      const idx = levels.indexOf(this.zoom);
      if (idx < levels.length - 1) this.setZoom(levels[idx + 1]);
    });
    this.panel.querySelector("#magnifier-zoom-out").addEventListener("click", () => {
      if (this.zoom === 1) return;
      const levels = [2, 4, 8, 16];
      const idx = levels.indexOf(this.zoom);
      if (idx === 0) {
        this.setZoom(1);
        return;
      }
      if (idx > 0) this.setZoom(levels[idx - 1]);
    });
  }

  close() {
    this.stopMagnifier();
    if (this.panel) {
      this.panel.remove();
      this.panel = null;
    }
  }

  setZoom(level) {
    this.zoom = level;
    const label = $("#magnifier-zoom-level");
    if (label) label.textContent = level * 100 + "%";
    this.applyTransform();
  }

  startMagnifier() {
    this.desktop = document.getElementById("desktop");
    if (!this.desktop) return;

    this.savedTransform = this.desktop.style.transform;
    this.savedOrigin = this.desktop.style.transformOrigin;

    this.applyTransform();
    this.setupMouseTracking();
  }

  stopMagnifier() {
    if (this.desktop) {
      this.desktop.style.transform = this.savedTransform;
      this.desktop.style.transformOrigin = this.savedOrigin;
    }

    this.savedTransform = "";
    this.savedOrigin = "";

    if (this._moveHandler) {
      document.removeEventListener("mousemove", this._moveHandler);
      this._moveHandler = null;
    }

    this.desktop = null;
  }

  applyTransform() {
    if (!this.desktop) return;
    this.desktop.style.transformOrigin = this.cursorX + "px " + this.cursorY + "px";
    this.desktop.style.transform = "scale(" + this.zoom + ")";
  }

  setupMouseTracking() {
    const handler = (e) => {
      this.cursorX = e.clientX;
      this.cursorY = e.clientY;
      this.applyTransform();
    };

    document.addEventListener("mousemove", handler, { passive: true });
    this._moveHandler = handler;
  }

  onClose(winId) {
    if (this._shortcutHandler) {
      document.removeEventListener("keydown", this._shortcutHandler);
      this._shortcutHandler = null;
    }
    this.close();
  }
}
