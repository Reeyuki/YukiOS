import "../styles/widgets.css";
import { makeDraggable } from "../shared/dragUtils.js";
import { BusEvents, os, StorageKeys } from "../framework.js";
import { Achievements } from "../achievements.js";

const WIDGET_Z_BASE = 100;

export class WidgetBase {
  constructor(manager, id, type, title, defaultW, defaultH) {
    this.manager = manager;
    this.id = id;
    this.type = type;
    this.title = title;
    this.defaultW = defaultW;
    this.defaultH = defaultH;
    this.x = 40;
    this.y = 40;
    this.w = defaultW;
    this.h = defaultH;
    this.zIndex = WIDGET_Z_BASE;
    this.zCounter = WIDGET_Z_BASE;
    this.element = null;
    this.dragCleanup = null;
    this.resizeCleanup = null;
    this.contentEl = null;
    this.headerEl = null;
  }

  buildElement() {
    const el = document.createElement("div");
    el.className = "desktop-widget";
    el.dataset.widgetId = this.id;
    el.style.left = `${this.x}px`;
    el.style.top = `${this.y}px`;
    el.style.width = `${this.w}px`;
    el.style.height = `${this.h}px`;
    el.style.zIndex = this.zIndex;
    el.style.position = "absolute";

    const header = document.createElement("div");
    header.className = "widget-header";
    this.headerEl = header;

    const titleSpan = document.createElement("span");
    titleSpan.className = "widget-title";
    titleSpan.textContent = this.title;
    header.appendChild(titleSpan);

    const actions = document.createElement("div");
    actions.className = "widget-actions";

    const cfgBtn = document.createElement("button");
    cfgBtn.className = "widget-btn widget-btn-cfg";
    cfgBtn.innerHTML = '<i class="fas fa-cog"></i>';
    cfgBtn.title = "Configure";
    cfgBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.onConfigure();
    });
    actions.appendChild(cfgBtn);

    const closeBtn = document.createElement("button");
    closeBtn.className = "widget-btn widget-btn-close";
    closeBtn.innerHTML = '<i class="fas fa-times"></i>';
    closeBtn.title = "Close";
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.onClose();
    });
    actions.appendChild(closeBtn);

    header.appendChild(actions);
    el.appendChild(header);

    const content = document.createElement("div");
    content.className = "widget-content";
    this.contentEl = content;
    el.appendChild(content);

    const resizeHandle = document.createElement("div");
    resizeHandle.className = "widget-resize-handle";
    el.appendChild(resizeHandle);

    el.addEventListener("mousedown", () => this.bringToFront());

    this.element = el;
    this.setupDrag(header);
    this.setupResize(resizeHandle);
    this.onRender(content);
    return el;
  }

  setupDrag(handle) {
    this.dragCleanup = makeDraggable(
      this.element,
      {
        start: () => {
          this.element.classList.add("widget-dragging");
        },
        move: (e, dx, dy) => {
          const left = parseFloat(this.element.style.left) || 0;
          const top = parseFloat(this.element.style.top) || 0;
          this.element.style.left = `${left + dx}px`;
          this.element.style.top = `${top + dy}px`;
        },
        end: () => {
          this.element.classList.remove("widget-dragging");
          this.x = parseFloat(this.element.style.left) || 0;
          this.y = parseFloat(this.element.style.top) || 0;
          this.manager.saveState();
        }
      },
      { ignoreFrom: ".widget-btn, .widget-resize-handle, textarea, input" }
    );
  }

  setupResize(handle) {
    let startX, startY, startW, startH;
    const onDown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      startX = e.clientX;
      startY = e.clientY;
      startW = this.element.offsetWidth;
      startH = this.element.offsetHeight;
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    };
    const onMove = (e) => {
      const dw = e.clientX - startX;
      const dh = e.clientY - startY;
      const newW = Math.max(120, startW + dw);
      const newH = Math.max(60, startH + dh);
      this.element.style.width = `${newW}px`;
      this.element.style.height = `${newH}px`;
      this.w = newW;
      this.h = newH;
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      this.manager.saveState();
    };
    handle.addEventListener("mousedown", onDown);
    this.resizeCleanup = () => {
      handle.removeEventListener("mousedown", onDown);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }

  bringToFront() {
    this.zCounter = this.manager.nextZ();
    this.element.style.zIndex = this.zCounter;
  }

  onRender(contentEl) {}

  getConfigFields() {
    return [];
  }

  applyConfig(data) {}

  onConfigure() {
    const fields = this.getConfigFields();
    if (fields.length === 0) {
      os.notify.send(`${this.title}`, "No configuration options available");
      return;
    }
    const winId = `widget-config-${this.id}`;
    const existing = document.getElementById(winId);
    if (existing) {
      existing.remove();
      return;
    }
    const win = os.window.create(winId, `${this.title} Settings`, "320px", "auto", {
      icon: "fa fa-cog"
    });
    let html = `<div style="padding:16px;display:flex;flex-direction:column;gap:12px;">`;
    const values = {};
    fields.forEach((f) => {
      const val = f.value !== undefined ? f.value : f.default;
      values[f.key] = val;
      html += `<label style="font-size:12px;color:var(--text-secondary);margin-bottom:2px;">${f.label}</label>`;
      if (f.type === "text" || f.type === "number") {
        html += `<input class="widget-cfg-input" data-key="${f.key}" type="${f.type}" value="${val}" style="padding:6px 8px;background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.08);border-radius:4px;color:inherit;font-size:13px;outline:none;">`;
      } else if (f.type === "select") {
        html += `<select class="widget-cfg-select" data-key="${f.key}" style="padding:6px 8px;background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.08);border-radius:4px;color:inherit;font-size:13px;outline:none;">`;
        f.options.forEach((o) => {
          html += `<option value="${o.value}" ${o.value === val ? "selected" : ""}>${o.label}</option>`;
        });
        html += `</select>`;
      }
    });
    html += `
      <div style="display:flex;gap:8px;margin-top:8px;">
        <button class="widget-cfg-save" style="flex:1;padding:8px;background:var(--brand);border:none;border-radius:4px;color:#fff;cursor:pointer;font-size:13px;">Save</button>
        <button class="widget-cfg-close" style="flex:1;padding:8px;background:rgba(255,255,255,0.1);border:none;border-radius:4px;color:inherit;cursor:pointer;font-size:13px;">Cancel</button>
      </div>
    </div>`;
    win.innerHTML = `<div class="window-content" style="height:auto;">${html}</div>`;
    document.getElementById("desktop").appendChild(win);

    win.querySelector(".widget-cfg-save").addEventListener("click", () => {
      const data = {};
      win.querySelectorAll("[data-key]").forEach((el) => {
        data[el.dataset.key] = el.type === "checkbox" ? el.checked : el.value;
      });
      this.applyConfig(data);
      win.remove();
    });
    win.querySelector(".widget-cfg-close").addEventListener("click", () => win.remove());
  }

  onClose() {
    this.manager.removeWidget(this.id);
  }

  saveState() {
    return {
      id: this.id,
      type: this.type,
      title: this.title,
      x: parseFloat(this.element.style.left) || 0,
      y: parseFloat(this.element.style.top) || 0,
      w: this.element.offsetWidth,
      h: this.element.offsetHeight,
      data: this.getData ? this.getData() : {}
    };
  }

  loadState(state) {
    this.x = state.x || 40;
    this.y = state.y || 40;
    this.w = state.w || this.defaultW;
    this.h = state.h || this.defaultH;
    if (this.element) {
      this.element.style.left = `${this.x}px`;
      this.element.style.top = `${this.y}px`;
      this.element.style.width = `${this.w}px`;
      this.element.style.height = `${this.h}px`;
    }
    if (state.data && this.setData) this.setData(state.data);
  }

  destroy() {
    if (this.dragCleanup) this.dragCleanup();
    if (this.resizeCleanup) this.resizeCleanup();
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}

export class WidgetManager {
  constructor() {
    this.container = null;
    this.widgets = new Map();
    this.zCounter = WIDGET_Z_BASE + 50;
    this.widgetClasses = new Map();
  }

  registerWidgetType(type, widgetClass) {
    this.widgetClasses.set(type, widgetClass);
  }

  init() {
    let container = document.getElementById("desktop-widgets");
    if (!container) {
      container = document.createElement("div");
      container.id = "desktop-widgets";
      const desktop = document.getElementById("desktop");
      if (desktop) desktop.appendChild(container);
    }
    this.container = container;
    this.loadAll();
  }

  nextZ() {
    this.zCounter++;
    return this.zCounter;
  }

  addWidget(type, title) {
    const Klass = this.widgetClasses.get(type);
    if (!Klass) {
      console.warn(`Unknown widget type: ${type}`);
      return null;
    }
    const id = `widget_${type}_${Date.now()}`;
    const instance = new Klass(this, id);
    const el = instance.buildElement();
    this.container.appendChild(el);
    os.events.emit(BusEvents.ACHIEVEMENT_TRIGGER, { achievementId: Achievements.WidgetAdded });
    this.widgets.set(id, instance);
    this.saveState();
    return instance;
  }

  removeWidget(id) {
    const w = this.widgets.get(id);
    if (!w) return;
    w.destroy();
    this.widgets.delete(id);
    this.saveState();
  }

  getWidget(id) {
    return this.widgets.get(id);
  }

  getAllWidgets() {
    return Array.from(this.widgets.values());
  }

  saveState() {
    const states = [];
    this.widgets.forEach((w) => states.push(w.saveState()));
    os.storage.set(StorageKeys.widgetsState, states);
  }

  loadAll() {
    const saved = os.storage.get(StorageKeys.widgetsState);
    if (!saved || !Array.isArray(saved)) return;
    saved.forEach((state) => {
      const Klass = this.widgetClasses.get(state.type);
      if (!Klass) return;
      const instance = new Klass(this, state.id || `widget_${state.type}_${Date.now()}`);
      instance.loadState(state);
      const el = instance.buildElement();
      this.container.appendChild(el);
      this.widgets.set(instance.id, instance);
    });
  }
}
