import "../styles/rhythms.css";
import { audioMixer } from "../audioMixer.js";

import { BaseApp, os } from "../framework.js";
const FFT_SIZE = 2048;
const FREQ_BIN_COUNT = FFT_SIZE / 2;

export class RhythmsApp extends BaseApp {
  constructor(services) {
    super(services);
    this.canvas = null;
    this.ctx = null;
    this.animationId = null;
    this.displayMode = "lines";
    this.tileCount = 36;
    this.smoothedData = [];
    this.attackFactor = 0.6;
    this.decayFactor = 0.06;
    this.sensitivity = 1.0;
    this.freqDataArray = new Uint8Array(FREQ_BIN_COUNT);
    this.roundness = 10;
    this.filled = true;
    this.mirrorEnabled = false;
    this.effectMode = "none";
    this.settingsOpen = false;
    this.hue = 265;
    this.color = "var(--brand)";
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
                    <input type="color" id="rhythms-color" class="rhythms-color-picker" value="var(--brand)" />
                  </div>
                </div>
              </div>
              <canvas id="rhythms-canvas" class="rhythms-canvas"></canvas>
            </div>
          `;
    this.initRhythms(null, null, win, null);
  }

  initRhythms(payload, vt, element, state) {
    this.canvas = element.querySelector("#rhythms-canvas");
    this.ctx = this.canvas.getContext("2d");

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
      if (btn.dataset.mode === this.displayMode) btn.classList.add("active");
      btn.addEventListener("click", () => {
        modeButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.displayMode = btn.dataset.mode;
        this.smoothedData = new Array(this.tileCount).fill(0);
      });
    });

    effectButtons.forEach((btn) => {
      if (btn.dataset.effect === this.effectMode) btn.classList.add("active");
      btn.addEventListener("click", () => {
        effectButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.effectMode = btn.dataset.effect;
      });
    });

    tilesSlider.value = this.tileCount;
    tilesValue.textContent = this.tileCount;
    tilesSlider.addEventListener("input", (e) => {
      this.tileCount = parseInt(e.target.value);
      tilesValue.textContent = this.tileCount;
      this.binMap = null;
      this.smoothedData = new Array(this.tileCount).fill(0);
    });

    sensitivitySlider.value = this.sensitivity;
    sensitivityValue.textContent = this.sensitivity;
    sensitivitySlider.addEventListener("input", (e) => {
      this.sensitivity = parseFloat(e.target.value);
      sensitivityValue.textContent = this.sensitivity;
    });

    roundnessSlider.value = this.roundness;
    roundnessValue.textContent = this.roundness;
    roundnessSlider.addEventListener("input", (e) => {
      this.roundness = parseInt(e.target.value);
      roundnessValue.textContent = this.roundness;
    });

    filledToggle.classList.toggle("active", this.filled);
    filledToggle.textContent = this.filled ? "Filled" : "Outlined";
    filledToggle.addEventListener("click", () => {
      this.filled = !this.filled;
      filledToggle.classList.toggle("active", this.filled);
      filledToggle.textContent = this.filled ? "Filled" : "Outlined";
    });

    colorPicker.value = this.color;
    colorPicker.addEventListener("input", (e) => {
      this.color = e.target.value;
      this.hue = this.hexToHue(this.color);
    });

    this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());
    this.resizeObserver.observe(this.canvas.parentElement);

    this.smoothedData = new Array(this.tileCount).fill(0);

    requestAnimationFrame(() => {
      this.resizeCanvas();
      this.startAnimation();
    });
  }

  resizeCanvas() {
    if (!this.canvas) return;
    const w = this.canvas.offsetWidth;
    const h = this.canvas.offsetHeight;
    if (w > 0 && h > 0) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  startAnimation() {
    const animate = () => {
      this.draw();
      this.animationId = requestAnimationFrame(animate);
    };
    animate();
  }

  buildBinMap() {
    const nyquist = FREQ_BIN_COUNT;
    const minHz = 20;
    const maxHz = 20000;
    const sampleRate = audioMixer().audioCtx ? audioMixer().audioCtx.sampleRate : 44100;
    const hzPerBin = sampleRate / 2 / nyquist;

    const map = [];
    for (let i = 0; i < this.tileCount; i++) {
      const t = i / this.tileCount;
      const hz = minHz * Math.pow(maxHz / minHz, t);
      const bin = Math.min(nyquist - 1, Math.round(hz / hzPerBin));
      map.push(bin);
    }
    return map;
  }

  draw() {
    if (!this.canvas || !this.ctx) return;

    const width = this.canvas.width;
    const height = this.canvas.height;

    if (width === 0 || height === 0) {
      this.resizeCanvas();
      return;
    }

    this.ctx.clearRect(0, 0, width, height);

    const hasData = audioMixer().getGlobalFrequencyData(this.freqDataArray);

    if (!hasData) {
      this.drawIdle(width, height);
      return;
    }

    if (!this.binMap || this.binMap.length !== this.tileCount) {
      this.binMap = this.buildBinMap();
    }

    for (let i = 0; i < this.tileCount; i++) {
      const bin = this.binMap[i];
      const nextBin = this.binMap[i + 1] !== undefined ? this.binMap[i + 1] : bin + 1;
      let max = 0;
      for (let b = bin; b < Math.min(nextBin, FREQ_BIN_COUNT); b++) {
        if (this.freqDataArray[b] > max) max = this.freqDataArray[b];
      }
      const target = Math.min(255, max * (this.sensitivity * 0.5));
      const current = this.smoothedData[i] || 0;

      if (target > current) {
        this.smoothedData[i] = current + (target - current) * this.attackFactor;
      } else {
        this.smoothedData[i] = current + (target - current) * this.decayFactor;
      }
    }

    switch (this.displayMode) {
      case "lines":
        this.drawLines(width, height);
        break;
      case "mirror":
        this.drawMirror(width, height);
        break;
      case "circle":
        this.drawCircle(width, height);
        break;
      case "wave":
        this.drawWave(width, height);
        break;
      default:
        this.drawLines(width, height);
    }

    this.drawEffect(width, height);
  }

  barLayout(width) {
    const minGap = this.tileCount > 80 ? 1 : this.tileCount > 40 ? 2 : 3;
    const barWidth = Math.max(1, (width - minGap * (this.tileCount - 1)) / this.tileCount);
    const gap = this.tileCount > 1 ? (width - barWidth * this.tileCount) / (this.tileCount - 1) : 0;
    return { barWidth, gap };
  }

  drawLines(width, height) {
    const { barWidth, gap } = this.barLayout(width);
    const radius = Math.min(this.roundness, barWidth / 2);

    for (let i = 0; i < this.tileCount; i++) {
      const value = this.smoothedData[i];
      const barHeight = Math.max(1, (value / 255) * height);
      const x = i * (barWidth + gap);
      const y = height - barHeight;
      const bw = Math.max(1, Math.floor(barWidth));

      const hue = this.hue + (i / this.tileCount) * 30;

      if (this.filled) {
        const gradient = this.ctx.createLinearGradient(0, y, 0, height);
        gradient.addColorStop(0, `hsla(${hue}, 80%, 70%, 1)`);
        gradient.addColorStop(1, `hsla(${hue}, 70%, 45%, 0.7)`);
        this.ctx.fillStyle = gradient;

        if (radius > 0) {
          this.ctx.beginPath();
          this.ctx.roundRect(Math.round(x), y, bw, barHeight, radius);
          this.ctx.fill();
        } else {
          this.ctx.fillRect(Math.round(x), y, bw, barHeight);
        }
      } else {
        this.ctx.strokeStyle = `hsla(${hue}, 80%, 65%, 0.9)`;
        this.ctx.lineWidth = 2;

        if (radius > 0) {
          this.ctx.beginPath();
          this.ctx.roundRect(Math.round(x), y, bw, barHeight, radius);
          this.ctx.stroke();
        } else {
          this.ctx.strokeRect(Math.round(x), y, bw, barHeight);
        }
      }
    }
  }

  drawMirror(width, height) {
    const { barWidth, gap } = this.barLayout(width);
    const centerY = height / 2;
    const radius = Math.min(this.roundness, barWidth / 2);

    for (let i = 0; i < this.tileCount; i++) {
      const value = this.smoothedData[i];
      const barHeight = Math.max(1, (value / 255) * (height / 2));
      const x = i * (barWidth + gap);
      const bw = Math.max(1, Math.floor(barWidth));

      const hue = this.hue + (i / this.tileCount) * 30;

      if (this.filled) {
        const gradTop = this.ctx.createLinearGradient(0, centerY - barHeight, 0, centerY);
        gradTop.addColorStop(0, `hsla(${hue}, 80%, 70%, 1)`);
        gradTop.addColorStop(1, `hsla(${hue}, 70%, 50%, 0.5)`);
        this.ctx.fillStyle = gradTop;

        if (radius > 0) {
          this.ctx.beginPath();
          this.ctx.roundRect(Math.round(x), centerY - barHeight, bw, barHeight, radius);
          this.ctx.fill();
        } else {
          this.ctx.fillRect(Math.round(x), centerY - barHeight, bw, barHeight);
        }

        const gradBot = this.ctx.createLinearGradient(0, centerY, 0, centerY + barHeight);
        gradBot.addColorStop(0, `hsla(${hue}, 70%, 50%, 0.5)`);
        gradBot.addColorStop(1, `hsla(${hue}, 80%, 70%, 1)`);
        this.ctx.fillStyle = gradBot;

        if (radius > 0) {
          this.ctx.beginPath();
          this.ctx.roundRect(Math.round(x), centerY, bw, barHeight, radius);
          this.ctx.fill();
        } else {
          this.ctx.fillRect(Math.round(x), centerY, bw, barHeight);
        }
      } else {
        this.ctx.strokeStyle = `hsla(${hue}, 80%, 65%, 0.9)`;
        this.ctx.lineWidth = 2;

        if (radius > 0) {
          this.ctx.beginPath();
          this.ctx.roundRect(Math.round(x), centerY - barHeight, bw, barHeight, radius);
          this.ctx.stroke();
          this.ctx.beginPath();
          this.ctx.roundRect(Math.round(x), centerY, bw, barHeight, radius);
          this.ctx.stroke();
        } else {
          this.ctx.strokeRect(Math.round(x), centerY - barHeight, bw, barHeight);
          this.ctx.strokeRect(Math.round(x), centerY, bw, barHeight);
        }
      }
    }
  }

  drawWave(width, height) {
    const stepX = width / (this.tileCount - 1);
    const lineCap = this.roundness > 0 ? "round" : "butt";
    const lineJoin = this.roundness > 0 ? "round" : "miter";

    this.ctx.beginPath();
    this.ctx.moveTo(0, height / 2);

    for (let i = 0; i < this.tileCount; i++) {
      const value = this.smoothedData[i];
      const amplitude = (value / 255) * (height / 2) * 0.8;
      const x = i * stepX;
      const y = height / 2 - amplitude;

      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }

    const hue = this.hue;

    if (this.filled) {
      this.ctx.strokeStyle = `hsla(${hue}, 80%, 65%, 0.9)`;
      this.ctx.lineWidth = 3;
      this.ctx.lineCap = lineCap;
      this.ctx.lineJoin = lineJoin;
      this.ctx.stroke();
    } else {
      this.ctx.strokeStyle = `hsla(${hue}, 80%, 65%, 0.9)`;
      this.ctx.lineWidth = 2;
      this.ctx.lineCap = lineCap;
      this.ctx.lineJoin = lineJoin;
      this.ctx.stroke();
    }

    this.ctx.beginPath();
    this.ctx.moveTo(0, height / 2);

    for (let i = 0; i < this.tileCount; i++) {
      const value = this.smoothedData[i];
      const amplitude = (value / 255) * (height / 2) * 0.8;
      const x = i * stepX;
      const y = height / 2 + amplitude;

      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }

    this.ctx.strokeStyle = `hsla(${this.hue + 20}, 80%, 65%, 0.7)`;
    this.ctx.lineWidth = this.filled ? 2 : 1;
    this.ctx.lineCap = lineCap;
    this.ctx.lineJoin = lineJoin;
    this.ctx.stroke();
  }

  drawCircle(width, height) {
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.3;
    const lineWidth = (width / this.tileCount) * 0.8;

    for (let i = 0; i < this.tileCount; i++) {
      const value = this.smoothedData[i];
      const barHeight = (value / 255) * radius;
      const angle = (i / this.tileCount) * Math.PI * 2 - Math.PI / 2;

      const x1 = centerX + Math.cos(angle) * radius;
      const y1 = centerY + Math.sin(angle) * radius;
      const x2 = centerX + Math.cos(angle) * (radius + barHeight);
      const y2 = centerY + Math.sin(angle) * (radius + barHeight);

      const hue = this.hue + (i / this.tileCount) * 30;

      if (this.filled) {
        this.ctx.strokeStyle = `hsla(${hue}, 70%, 60%, 0.8)`;
        this.ctx.lineWidth = lineWidth;
        this.ctx.lineCap = this.roundness > 0 ? "round" : "butt";

        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();
      } else {
        this.ctx.strokeStyle = `hsla(${hue}, 80%, 65%, 0.9)`;
        this.ctx.lineWidth = Math.max(2, lineWidth * 0.5);
        this.ctx.lineCap = this.roundness > 0 ? "round" : "butt";

        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();
      }
    }
  }

  drawEffect(width, height) {
    if (this.effectMode === "none") return;

    switch (this.effectMode) {
      case "wave":
        this.drawWaveEffect(width, height);
        break;
      case "levels":
        this.drawLevelsEffect(width, height);
        break;
      case "particles":
        this.drawParticlesEffect(width, height);
        break;
    }
  }

  drawWaveEffect(width, height) {
    this.ctx.save();
    this.ctx.globalAlpha = 0.3;
    this.ctx.beginPath();
    this.ctx.moveTo(0, height / 2);

    const stepX = width / (this.tileCount - 1);

    for (let i = 0; i < this.tileCount; i++) {
      const value = this.smoothedData[i];
      const amplitude = (value / 255) * (height / 2) * 0.3;
      const x = i * stepX;
      const y = height / 2 - amplitude;

      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }

    this.ctx.strokeStyle = `hsla(${this.hue}, 80%, 65%, 0.5)`;
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
    this.ctx.restore();
  }

  drawLevelsEffect(width, height) {
    this.ctx.save();
    this.ctx.globalAlpha = 0.2;

    const levels = 5;
    for (let i = 1; i <= levels; i++) {
      const y = (height / levels) * i;
      this.ctx.strokeStyle = `hsla(${this.hue}, 80%, 65%, 0.3)`;
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(width, y);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  drawParticlesEffect(width, height) {
    this.ctx.save();
    this.ctx.globalAlpha = 0.4;

    for (let i = 0; i < this.tileCount; i++) {
      const value = this.smoothedData[i];
      if (value < 50) continue;

      const hue = this.hue + (i / this.tileCount) * 30;
      const { barWidth, gap } = this.barLayout(width);
      const x = i * (barWidth + gap) + barWidth / 2;
      const y = height - (value / 255) * height * 0.8;

      this.ctx.fillStyle = `hsla(${hue}, 80%, 70%, 0.8)`;
      this.ctx.beginPath();
      this.ctx.arc(x, y, 2, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.restore();
  }

  drawBarEffect(width, height) {
    this.ctx.save();
    this.ctx.globalAlpha = 0.25;

    const { barWidth, gap } = this.barLayout(width);

    for (let i = 0; i < this.tileCount; i++) {
      const value = this.smoothedData[i];
      const barHeight = (value / 255) * height;
      const x = i * (barWidth + gap);
      const y = height - barHeight;

      const hue = this.hue + (i / this.tileCount) * 30;
      this.ctx.fillStyle = `hsla(${hue}, 80%, 60%, 0.5)`;
      this.ctx.fillRect(Math.round(x), y, Math.max(1, Math.floor(barWidth)), barHeight);
    }

    this.ctx.restore();
  }

  drawIdle(width, height) {
    const n = this.tileCount;
    const { barWidth, gap } = this.barLayout(width);
    const now = Date.now() / 1000;

    for (let i = 0; i < n; i++) {
      const t = i / n;
      const wave = (Math.sin(now * 1.2 + t * Math.PI * 3) + 1) / 2;
      const barHeight = Math.max(2, wave * height * 0.06 + 2);
      const x = i * (barWidth + gap);
      const y = height - barHeight;
      const hue = this.hue + t * 30;
      this.ctx.fillStyle = `hsla(${hue}, 50%, 50%, 0.3)`;
      this.ctx.fillRect(Math.round(x), y, Math.max(1, Math.floor(barWidth)), barHeight);
    }

    this.ctx.fillStyle = "rgba(255,255,255,0.35)";
    this.ctx.font = "13px system-ui";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.fillText("Play audio to visualize", width / 2, height / 2);
  }

  onClose(winId) {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  hexToHue(hex) {
    let r = parseInt(hex.slice(1, 3), 16) / 255;
    let g = parseInt(hex.slice(3, 5), 16) / 255;
    let b = parseInt(hex.slice(5, 7), 16) / 255;

    let max = Math.max(r, g, b);
    let min = Math.min(r, g, b);
    let h = 0;

    if (max === min) {
      h = 0;
    } else if (max === r) {
      h = ((g - b) / (max - min)) % 6;
    } else if (max === g) {
      h = (b - r) / (max - min) + 2;
    } else {
      h = (r - g) / (max - min) + 4;
    }

    h = Math.round(h * 60);
    if (h < 0) h += 360;

    return h;
  }
}
