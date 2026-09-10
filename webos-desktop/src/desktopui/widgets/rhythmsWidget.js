import { WidgetBase } from "../widgetManager.js";
import { RhythmsVisualizer } from "../../shared/rhythmsVisualizer.js";
import { os } from "../../framework.js";

export class RhythmsWidget extends WidgetBase {
  constructor(manager, id) {
    super(manager, id, "rhythms", "Rhythms", 340, 180);
    this.visualizer = null;
    this.displayMode = "lines";
    this.tileCount = 36;
    this.sensitivity = 1.0;
    this.effectMode = "none";
    this.roundness = 10;
    this.filled = true;
    this.hue = 265;
    this.color = "#7c5cfc";
  }

  onRender(contentEl) {
    contentEl.style.padding = "0";
    contentEl.style.overflow = "hidden";
    contentEl.style.display = "flex";
    contentEl.style.flexDirection = "column";
    contentEl.innerHTML = `
      <div class="widget-rhythms-stage" style="flex:1;min-height:0;display:flex;position:relative;">
        <canvas class="widget-rhythms-canvas" style="flex:1;width:100%;height:100%;display:block;"></canvas>
        <button class="widget-rhythms-open" title="Open Rhythms" style="position:absolute;top:6px;right:6px;width:26px;height:26px;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.12);border-radius:6px;color:#fff;cursor:pointer;backdrop-filter:blur(8px);font-size:11px;">
          <i class="fas fa-external-link-alt"></i>
        </button>
      </div>
    `;
    const canvas = contentEl.querySelector(".widget-rhythms-canvas");
    this.visualizer = new RhythmsVisualizer(canvas, {
      displayMode: this.displayMode,
      tileCount: this.tileCount,
      sensitivity: this.sensitivity,
      effectMode: this.effectMode,
      roundness: this.roundness,
      filled: this.filled,
      hue: this.hue,
      color: this.color
    });
    this.visualizer.start();
    const openBtn = contentEl.querySelector(".widget-rhythms-open");
    if (openBtn) {
      openBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        os.app.launch("rhythms");
      });
    }
  }

  getConfigFields() {
    return [
      {
        key: "displayMode",
        label: "Display Mode",
        type: "select",
        value: this.displayMode,
        default: "lines",
        options: [
          { value: "lines", label: "Lines" },
          { value: "mirror", label: "Mirror" },
          { value: "circle", label: "Circle" },
          { value: "wave", label: "Wave" }
        ]
      },
      {
        key: "effectMode",
        label: "Effect",
        type: "select",
        value: this.effectMode,
        default: "none",
        options: [
          { value: "none", label: "None" },
          { value: "wave", label: "Wave" },
          { value: "levels", label: "Levels" },
          { value: "particles", label: "Particles" }
        ]
      },
      {
        key: "tileCount",
        label: "Bars (1-64)",
        type: "number",
        value: String(this.tileCount),
        default: "36"
      },
      {
        key: "sensitivity",
        label: "Sensitivity (0.1-5.0)",
        type: "number",
        value: String(this.sensitivity),
        default: "1.0"
      }
    ];
  }

  applyConfig(data) {
    if (data.displayMode) this.displayMode = data.displayMode;
    if (data.effectMode) this.effectMode = data.effectMode;
    if (data.tileCount !== undefined) {
      const parsed = parseInt(data.tileCount);
      if (Number.isFinite(parsed)) this.tileCount = Math.max(1, Math.min(64, parsed));
    }
    if (data.sensitivity !== undefined) {
      const parsed = parseFloat(data.sensitivity);
      if (Number.isFinite(parsed)) this.sensitivity = Math.max(0.1, Math.min(5, parsed));
    }
    if (this.visualizer) {
      this.visualizer.setDisplayMode(this.displayMode);
      this.visualizer.setEffectMode(this.effectMode);
      this.visualizer.setTileCount(this.tileCount);
      this.visualizer.setSensitivity(this.sensitivity);
    }
    this.manager.saveState();
  }

  getData() {
    return {
      displayMode: this.displayMode,
      tileCount: this.tileCount,
      sensitivity: this.sensitivity,
      effectMode: this.effectMode,
      roundness: this.roundness,
      filled: this.filled,
      hue: this.hue,
      color: this.color
    };
  }

  setData(data) {
    if (!data) return;
    if (data.displayMode) this.displayMode = data.displayMode;
    if (Number.isFinite(data.tileCount)) this.tileCount = data.tileCount;
    if (Number.isFinite(data.sensitivity)) this.sensitivity = data.sensitivity;
    if (data.effectMode) this.effectMode = data.effectMode;
    if (Number.isFinite(data.roundness)) this.roundness = data.roundness;
    if (typeof data.filled === "boolean") this.filled = data.filled;
    if (Number.isFinite(data.hue)) this.hue = data.hue;
    if (data.color) this.color = data.color;
    if (this.visualizer) {
      this.visualizer.updateOptions({
        displayMode: this.displayMode,
        tileCount: this.tileCount,
        sensitivity: this.sensitivity,
        effectMode: this.effectMode,
        roundness: this.roundness,
        filled: this.filled,
        hue: this.hue,
        color: this.color
      });
    }
  }

  destroy() {
    if (this.visualizer) {
      this.visualizer.stop();
      this.visualizer = null;
    }
    super.destroy();
  }
}
