import "../styles/rhythms.css";
import { BaseApp, os } from "../framework.js";
import { RhythmsVisualizer } from "../shared/rhythmsVisualizer.js";

export class RhythmsApp extends BaseApp {
  constructor(services) {
    super(services);
    this.visualizer = null;
    this.settingsOpen = false;
  }

  open() {
    const win = os.window.create("rhythms-window", "Rhythms", "800px", "600px", {
      icon: "fas fa-wave-square",
      appId: "rhythms",
      transparent: true
    });
    win.innerHTML = `
            <div class="rhythms-container">
              <button class="rhythms-settings-toggle" id="rhythms-settings-toggle">
                <i class="fas fa-cog"></i>
              </button>
              <div class="rhythms-settings-panel" id="rhythms-settings-panel">
                <div class="rhythms-controls">
                  <div class="rhythms-control-group">
                    <label class="rhythms-label">Display Mode</label>
                    <div class="rhythms-button-group" id="rhythms-mode-group">
                      <button class="rhythms-mode-btn active" data-mode="lines">Lines</button>
                      <button class="rhythms-mode-btn" data-mode="mirror">Mirror</button>
                      <button class="rhythms-mode-btn" data-mode="circle">Circle</button>
                      <button class="rhythms-mode-btn" data-mode="wave">Wave</button>
                    </div>
                  </div>
                  <div class="rhythms-control-group">
                    <label class="rhythms-label">Number of Bars</label>
                    <input type="range" id="rhythms-tiles" class="rhythms-slider" min="1" max="256" step="1" value="36" />
                    <span class="rhythms-slider-value" id="rhythms-tiles-value">36</span>
                  </div>
                  <div class="rhythms-control-group">
                    <label class="rhythms-label">Sensitivity</label>
                    <input type="range" id="rhythms-sensitivity" class="rhythms-slider" min="0.1" max="5.0" step="0.1" value="1.0" />
                    <span class="rhythms-slider-value" id="rhythms-sensitivity-value">1.0</span>
                  </div>
                  <div class="rhythms-control-group">
                    <label class="rhythms-label">Effect Mode</label>
                    <div class="rhythms-button-group" id="rhythms-effect-group">
                      <button class="rhythms-effect-btn active" data-effect="none">None</button>
                      <button class="rhythms-effect-btn" data-effect="wave">Wave</button>
                      <button class="rhythms-effect-btn" data-effect="levels">Levels</button>
                      <button class="rhythms-effect-btn" data-effect="particles">Particles</button>
                    </div>
                  </div>
                  <div class="rhythms-control-group">
                    <label class="rhythms-label">Roundness</label>
                    <input type="range" id="rhythms-roundness" class="rhythms-slider" min="0" max="50" step="1" value="10" />
                    <span class="rhythms-slider-value" id="rhythms-roundness-value">0</span>
                  </div>
                  <div class="rhythms-control-group">
                    <label class="rhythms-label">Filling</label>
                    <button class="rhythms-toggle-btn active" id="rhythms-filled-toggle">Filled</button>
                  </div>
                  <div class="rhythms-control-group">
                    <label class="rhythms-label">Color</label>
                    <input type="color" id="rhythms-color" class="rhythms-color-picker" value="#7c5cfc" />
                  </div>
                </div>
              </div>
              <canvas id="rhythms-canvas" class="rhythms-canvas"></canvas>
            </div>
          `;
    this.initRhythms(null, null, win, null);
    win.addEventListener("remove", () => this.onClose(win.id));
  }

  initRhythms(payload, vt, element, state) {
    const canvas = element.querySelector("#rhythms-canvas");
    this.visualizer = new RhythmsVisualizer(canvas);
    const settingsToggle = element.querySelector("#rhythms-settings-toggle");
    const settingsPanel = element.querySelector("#rhythms-settings-panel");
    const modeButtons = element.querySelectorAll(".rhythms-mode-btn");
    const effectButtons = element.querySelectorAll(".rhythms-effect-btn");
    const tilesSlider = element.querySelector("#rhythms-tiles");
    const tilesValue = element.querySelector("#rhythms-tiles-value");
    const sensitivitySlider = element.querySelector("#rhythms-sensitivity");
    const sensitivityValue = element.querySelector("#rhythms-sensitivity-value");
    const roundnessSlider = element.querySelector("#rhythms-roundness");
    const roundnessValue = element.querySelector("#rhythms-roundness-value");
    const filledToggle = element.querySelector("#rhythms-filled-toggle");
    const colorPicker = element.querySelector("#rhythms-color");

    settingsToggle.addEventListener("click", () => {
      this.settingsOpen = !this.settingsOpen;
      settingsPanel.classList.toggle("open", this.settingsOpen);
    });

    modeButtons.forEach((btn) => {
      if (btn.dataset.mode === this.visualizer.displayMode) btn.classList.add("active");
      else btn.classList.remove("active");
      btn.addEventListener("click", () => {
        modeButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.visualizer.setDisplayMode(btn.dataset.mode);
      });
    });

    effectButtons.forEach((btn) => {
      if (btn.dataset.effect === this.visualizer.effectMode) btn.classList.add("active");
      else btn.classList.remove("active");
      btn.addEventListener("click", () => {
        effectButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.visualizer.setEffectMode(btn.dataset.effect);
      });
    });

    tilesSlider.value = this.visualizer.tileCount;
    tilesValue.textContent = this.visualizer.tileCount;
    tilesSlider.addEventListener("input", (e) => {
      const count = parseInt(e.target.value);
      this.visualizer.setTileCount(count);
      tilesValue.textContent = count;
    });

    sensitivitySlider.value = this.visualizer.sensitivity;
    sensitivityValue.textContent = this.visualizer.sensitivity;
    sensitivitySlider.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      this.visualizer.setSensitivity(val);
      sensitivityValue.textContent = val;
    });

    roundnessSlider.value = this.visualizer.roundness;
    roundnessValue.textContent = this.visualizer.roundness;
    roundnessSlider.addEventListener("input", (e) => {
      const val = parseInt(e.target.value);
      this.visualizer.setRoundness(val);
      roundnessValue.textContent = val;
    });

    filledToggle.classList.toggle("active", this.visualizer.filled);
    filledToggle.textContent = this.visualizer.filled ? "Filled" : "Outlined";
    filledToggle.addEventListener("click", () => {
      const next = !this.visualizer.filled;
      this.visualizer.setFilled(next);
      filledToggle.classList.toggle("active", next);
      filledToggle.textContent = next ? "Filled" : "Outlined";
    });

    colorPicker.value = this.visualizer.color.startsWith("var(") ? "#7c5cfc" : this.visualizer.color;
    colorPicker.addEventListener("input", (e) => {
      this.visualizer.setColor(e.target.value);
    });

    this.visualizer.start();
  }

  onClose(winId) {
    if (this.visualizer) {
      this.visualizer.stop();
      this.visualizer = null;
    }
  }
}
