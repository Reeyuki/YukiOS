import { audioMixer } from "../audioMixer.js";

export const FFT_SIZE = 2048;
export const FREQ_BIN_COUNT = FFT_SIZE / 2;

export class RhythmsVisualizer {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext("2d") : null;
    this.displayMode = options.displayMode || "lines";
    this.tileCount = options.tileCount ?? 36;
    this.sensitivity = options.sensitivity ?? 1.0;
    this.roundness = options.roundness ?? 10;
    this.filled = options.filled ?? true;
    this.effectMode = options.effectMode || "none";
    this.hue = options.hue ?? 265;
    this.color = options.color || "var(--brand)";
    this.attackFactor = options.attackFactor ?? 0.6;
    this.decayFactor = options.decayFactor ?? 0.06;
    this.smoothedData = new Array(this.tileCount).fill(0);
    this.freqDataArray = new Uint8Array(FREQ_BIN_COUNT);
    this.animationId = null;
    this.resizeObserver = null;
    this.binMap = null;
    if (options.autoResize !== false) {
      this.bindResize();
    }
  }

  bindResize() {
    if (!this.canvas || !this.canvas.parentElement) return;
    this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());
    this.resizeObserver.observe(this.canvas.parentElement);
    if (this.canvas.parentElement !== this.canvas) {
      this.resizeObserver.observe(this.canvas);
    }
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

  start() {
    this.smoothedData = new Array(this.tileCount).fill(0);
    requestAnimationFrame(() => {
      this.resizeCanvas();
      this.loop();
    });
  }

  loop = () => {
    this.draw();
    this.animationId = requestAnimationFrame(this.loop);
  };

  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }

  setDisplayMode(mode) {
    this.displayMode = mode;
    this.smoothedData = new Array(this.tileCount).fill(0);
  }

  setTileCount(count) {
    this.tileCount = count;
    this.binMap = null;
    this.smoothedData = new Array(this.tileCount).fill(0);
  }

  setSensitivity(value) {
    this.sensitivity = value;
  }

  setRoundness(value) {
    this.roundness = value;
  }

  setFilled(value) {
    this.filled = value;
  }

  setEffectMode(mode) {
    this.effectMode = mode;
  }

  setColor(hex) {
    this.color = hex;
    this.hue = this.hexToHue(hex);
  }

  setHue(hue) {
    this.hue = hue;
  }

  updateOptions(options = {}) {
    if (options.displayMode !== undefined) this.displayMode = options.displayMode;
    if (options.tileCount !== undefined) this.setTileCount(options.tileCount);
    if (options.sensitivity !== undefined) this.sensitivity = options.sensitivity;
    if (options.roundness !== undefined) this.roundness = options.roundness;
    if (options.filled !== undefined) this.filled = options.filled;
    if (options.effectMode !== undefined) this.effectMode = options.effectMode;
    if (options.color !== undefined) this.setColor(options.color);
    else if (options.hue !== undefined) this.hue = options.hue;
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
    if (this.filled) {
      this.ctx.strokeStyle = `hsla(${this.hue}, 80%, 65%, 0.9)`;
      this.ctx.lineWidth = 3;
      this.ctx.lineCap = lineCap;
      this.ctx.lineJoin = lineJoin;
      this.ctx.stroke();
    } else {
      this.ctx.strokeStyle = `hsla(${this.hue}, 80%, 65%, 0.9)`;
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

  hexToHue(hex) {
    if (!hex || hex.startsWith("var(")) return this.hue;
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
