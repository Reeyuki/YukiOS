import "../styles/aquarium.css";
import { BaseApp, os, StorageKeys, MODES } from "../framework.js";
import { FISH_DATA, getFishById, getAllFish } from "./aquarium/fishCatalog.js";
import { drawSeaFish } from "./aquarium/fishRender.js";
import { SYSTEM_APPS } from "../AppRegistryConfig.js";

function randomBetween(a, b) {
  return a + Math.random() * (b - a);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export class AquariumApp extends BaseApp {
  singletonWindowIds = ["aquarium"];

  constructor(services) {
    super(services);
    this.win = null;
    this.canvas = null;
    this.ctx = null;
    this.rafId = null;
    this.fishes = [];
    this.bubbles = [];
    this.pellets = [];
    this.seaweeds = [];
    this.particles = [];
    this.width = 900;
    this.height = 500;
    this.dpr = 1;
    this.paused = false;
    this.feedCooldown = false;
    this.lastTime = 0;
    this.resizeObserver = null;
    this.boundResize = null;
    this.resizeRaf = null;
    this.gravelPebbles = [];
    this.needsResize = false;
    this.resizeWidth = 0;
    this.resizeHeight = 0;
    this.audioCtx = null;
    this.masterGain = null;
    this.bgmNodes = null;
    this.bgmTimer = null;
    this.soundEnabled = true;
    this.persistTimer = null;
    this.catalogOpen = false;
  }

  open() {
    if (this.win && document.getElementById("aquarium")) {
      os.window.focus(this.win);
      return;
    }
    const win = os.window.create("aquarium", "Aquarium", "960px", "640px", {
      icon: "fas fa-fish",
      appId: "aquarium"
    });
    win.classList.add("transparent", "aquarium-window");
    this.win = win;
    win.style.display = "flex";
    win.style.flexDirection = "column";
    win.innerHTML = this.buildHTML();
    this.canvas = win.querySelector("#aquarium-canvas");
    this.ctx = this.canvas.getContext("2d");
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.soundEnabled = os.storage.get(StorageKeys.aquariumSoundEnabled) !== "false";
    this.loadState();
    this.setupCanvas();
    this.buildGravel();
    if (this.fishes.length === 0) this.createInitialFishes(8);
    this.createSeaweeds();
    this.createBubbles(14);
    this.updateCount();
    this.bindEvents(win);
    this.registerTray();
    this.ensureAudio();
    this.startBgm();
    this.lastTime = performance.now();
    this.loop();
    this.trackResize();
    win.addEventListener("remove", () => this.cleanup());
  }

  onClose() {
    this.cleanup();
  }

  cleanup() {
    this.saveState();
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    if (this.resizeRaf) cancelAnimationFrame(this.resizeRaf);
    this.resizeRaf = null;
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = null;
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    window.removeEventListener("resize", this.boundResize);
    this.stopBgm();
    if (this.audioCtx) {
      try { this.audioCtx.close(); } catch {}
      this.audioCtx = null;
      this.masterGain = null;
    }
    try { os.tray.unregister("aquarium"); } catch {}
    this.win = null;
    this.canvas = null;
    this.ctx = null;
    this.fishes = [];
    this.bubbles = [];
    this.pellets = [];
    this.seaweeds = [];
    this.particles = [];
  }

  buildHTML() {
    return `
      <div class="aquarium-root">
        <div class="aquarium-toolbar">
          <div class="aquarium-toolbar-left">
            <button class="aquarium-btn primary" data-action="feed"><i class="fas fa-cookie-bite"></i> Feed</button>
            <button class="aquarium-btn" data-action="addFish"><i class="fas fa-plus"></i> Add Fish</button>
            <button class="aquarium-btn" data-action="catalog"><i class="fas fa-table-cells"></i> Catalog</button>
            <button class="aquarium-btn ${this.soundEnabled ? "" : "active"}" data-action="sound"><i class="fas ${this.soundEnabled ? "fa-volume-high" : "fa-volume-xmark"}"></i> ${this.soundEnabled ? "Sound" : "Muted"}</button>
            <button class="aquarium-btn" data-action="pause"><i class="fas fa-pause"></i> Pause</button>
            <button class="aquarium-btn danger" data-action="destroyAll"><i class="fas fa-skull"></i> Destroy All</button>
          </div>
          <div class="aquarium-toolbar-center">
            <span class="aquarium-count"><i class="fas fa-fish"></i> <span id="aquarium-fish-count">0</span> fish</span>
            <span class="aquarium-hint">Click water to feed</span>
          </div>
        </div>
        <div class="aquarium-stage">
          <canvas id="aquarium-canvas"></canvas>
          <div class="aquarium-glass"></div>
          <div class="aquarium-surface"></div>
          <div class="aquarium-vignette"></div>
          <button class="aquarium-bubble-fab" data-action="bubbles" title="Bubbles"><i class="fas fa-water"></i></button>
          <div id="aquarium-catalog" class="aquarium-catalog hidden">
            <div class="aquarium-catalog-header">
              <div class="aquarium-catalog-title"><i class="fas fa-fish"></i> Aquarium Catalog <span id="catalog-count"></span></div>
              <button class="aquarium-catalog-close" data-action="catalogClose"><i class="fas fa-xmark"></i></button>
            </div>
            <div id="aquarium-catalog-grid" class="aquarium-catalog-grid"></div>
          </div>
        </div>
        <div class="aquarium-status">
          <span id="aquarium-status-text"></span>
        </div>
      </div>
    `;
  }

  registerTray() {
    try {
      const appConfig = SYSTEM_APPS.aquariumApp;
      const trayOpts = appConfig?.trayOptions;
      if (trayOpts && !os.modes.isActive(MODES.MAC)) {
        os.tray.register("aquarium", "fas fa-fish", "Aquarium", {
          showInTray: true,
          priority: 40,
          ...trayOpts,
          onClick: () => {
            if (trayOpts.onClick) {
              trayOpts.onClick();
            } else {
              const w = document.getElementById("aquarium");
              if (w && w.style.display === "none") os.tray.restoreFromTray("aquarium");
              else if (w) os.window.focus(w);
              else this.open();
            }
          },
          onQuit: () => {
            if (trayOpts.onQuit) {
              trayOpts.onQuit();
            } else {
              try { os.tray.unregister("aquarium"); } catch {}
              if (this.win) os.window.close(this.win);
            }
          }
        });
      }
    } catch {}
  }

  ensureAudio() {
    if (this.audioCtx) {
      if (this.audioCtx.state === "suspended") this.audioCtx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.audioCtx = new AC();
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.value = this.soundEnabled ? 0.28 : 0;
      this.masterGain.connect(this.audioCtx.destination);
      if (this.audioCtx.state === "suspended") {
        const resume = () => {
          this.audioCtx.resume().catch(() => {});
          window.removeEventListener("click", resume);
          window.removeEventListener("keydown", resume);
        };
        window.addEventListener("click", resume, { once: true });
        window.addEventListener("keydown", resume, { once: true });
      }
    } catch {}
  }

  playTone(freq, duration, type, gain, slideTo) {
    if (!this.soundEnabled || !this.audioCtx || !this.masterGain) return;
    try {
      if (this.audioCtx.state === "suspended") this.audioCtx.resume();
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const g = this.audioCtx.createGain();
      const filt = this.audioCtx.createBiquadFilter();
      filt.type = "lowpass";
      filt.frequency.value = 4200;
      osc.type = type || "sine";
      osc.frequency.value = freq;
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration * 0.9);
      g.gain.value = 0;
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(gain, now + 0.012);
      g.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.connect(filt).connect(g).connect(this.masterGain);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    } catch {}
  }

  playBubble() {
    this.playTone(randomBetween(780, 1100), 0.14, "sine", 0.18, randomBetween(380, 520));
    setTimeout(() => this.playTone(randomBetween(900, 1200), 0.08, "sine", 0.08, randomBetween(600, 800)), 60);
  }

  playSplash() {
    if (!this.soundEnabled || !this.audioCtx) return;
    try {
      if (this.audioCtx.state === "suspended") this.audioCtx.resume();
      const now = this.audioCtx.currentTime;
      const bufferSize = Math.floor(this.audioCtx.sampleRate * 0.09);
      const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2) * 0.6;
      const src = this.audioCtx.createBufferSource();
      src.buffer = buffer;
      const filt = this.audioCtx.createBiquadFilter();
      filt.type = "bandpass";
      filt.frequency.value = 1800;
      filt.Q.value = 0.7;
      const g = this.audioCtx.createGain();
      g.gain.value = 0.22;
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      src.connect(filt).connect(g).connect(this.masterGain);
      src.start(now);
    } catch {}
  }

  playFeed() {
    this.playTone(880, 0.12, "triangle", 0.16, 1320);
  }

  playAddFish() {
    this.playTone(523, 0.14, "sine", 0.18, 659);
    setTimeout(() => this.playTone(659, 0.14, "sine", 0.16, 784), 110);
    setTimeout(() => this.playTone(784, 0.18, "sine", 0.14), 220);
  }

  playDestroy() {
    this.playTone(520, 0.18, "sawtooth", 0.14, 180);
    setTimeout(() => this.playTone(360, 0.22, "triangle", 0.13, 90), 120);
    if (!this.audioCtx) return;
    try {
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const g = this.audioCtx.createGain();
      osc.type = "square";
      osc.frequency.value = 120;
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.4);
      g.gain.value = 0.18;
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.connect(g).connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.46);
    } catch {}
  }

  playShuffle() {
    this.playTone(440, 0.12, "sine", 0.12, 660);
    setTimeout(() => this.playTone(550, 0.12, "sine", 0.12, 330), 90);
  }

  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    os.storage.set(StorageKeys.aquariumSoundEnabled, String(this.soundEnabled));
    if (this.masterGain) this.masterGain.gain.linearRampToValueAtTime(this.soundEnabled ? 0.28 : 0, this.audioCtx.currentTime + 0.12);
    const btn = this.win?.querySelector('[data-action="sound"]');
    if (btn) {
      btn.classList.toggle("active", !this.soundEnabled);
      btn.innerHTML = `<i class="fas ${this.soundEnabled ? "fa-volume-high" : "fa-volume-xmark"}"></i> ${this.soundEnabled ? "Sound" : "Muted"}`;
    }
    this.setStatus(this.soundEnabled ? "Sound on" : "Muted");
    if (this.soundEnabled) { this.ensureAudio(); this.startBgm(); this.playFeed(); } else this.stopBgm();
    this.scheduleSave();
  }

  startBgm() {
    if (!this.soundEnabled || !this.audioCtx || this.bgmNodes) return;
    try {
      if (this.audioCtx.state === "suspended") this.audioCtx.resume();
      const now = this.audioCtx.currentTime;
      const padGain = this.audioCtx.createGain();
      padGain.gain.value = 0;
      padGain.gain.linearRampToValueAtTime(0.045, now + 2.2);
      padGain.connect(this.masterGain);
      const filt = this.audioCtx.createBiquadFilter();
      filt.type = "lowpass";
      filt.frequency.value = 1100;
      filt.Q.value = 0.6;
      filt.connect(padGain);
      const o1 = this.audioCtx.createOscillator();
      const o2 = this.audioCtx.createOscillator();
      o1.type = "sine";
      o2.type = "triangle";
      o1.frequency.value = 110;
      o2.frequency.value = 165;
      const o1Gain = this.audioCtx.createGain();
      const o2Gain = this.audioCtx.createGain();
      o1Gain.gain.value = 0.5;
      o2Gain.gain.value = 0.28;
      o1.connect(o1Gain).connect(filt);
      o2.connect(o2Gain).connect(filt);
      o1.start(now);
      o2.start(now);
      const lfo = this.audioCtx.createOscillator();
      const lfoGain = this.audioCtx.createGain();
      lfo.frequency.value = 0.07;
      lfoGain.gain.value = 18;
      lfo.connect(lfoGain);
      lfoGain.connect(filt.frequency);
      lfo.start(now);
      const seqGain = this.audioCtx.createGain();
      seqGain.gain.value = 0.09;
      seqGain.connect(this.masterGain);
      this.bgmNodes = { padGain, filt, o1, o2, o1Gain, o2Gain, lfo, lfoGain, seqGain };
      const notes = [196, 246, 293, 329, 293, 246, 196, 220];
      let idx = 0;
      const tick = () => {
        if (!this.bgmNodes || !this.soundEnabled || !this.audioCtx) return;
        const n = notes[idx % notes.length];
        idx++;
        const t = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const g = this.audioCtx.createGain();
        const f = this.audioCtx.createBiquadFilter();
        f.type = "bandpass";
        f.frequency.value = n * 2;
        f.Q.value = 1.2;
        osc.type = "sine";
        osc.frequency.value = n;
        g.gain.value = 0;
        g.gain.linearRampToValueAtTime(0.11, t + 0.04);
        g.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
        osc.connect(f).connect(g).connect(this.bgmNodes.seqGain);
        osc.start(t);
        osc.stop(t + 1.2);
      };
      tick();
      this.bgmTimer = setInterval(tick, 820);
    } catch {}
  }

  stopBgm() {
    if (this.bgmTimer) { clearInterval(this.bgmTimer); this.bgmTimer = null; }
    if (!this.bgmNodes) return;
    try {
      const now = this.audioCtx ? this.audioCtx.currentTime : 0;
      this.bgmNodes.padGain.gain.linearRampToValueAtTime(0, now + 0.6);
      setTimeout(() => {
        try {
          this.bgmNodes.o1.stop();
          this.bgmNodes.o2.stop();
          this.bgmNodes.lfo.stop();
        } catch {}
        this.bgmNodes = null;
      }, 700);
    } catch { this.bgmNodes = null; }
  }

  loadState() {
    try {
      const raw = os.storage.get(StorageKeys.aquariumState);
      if (!raw) return;
      const data = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!data || !Array.isArray(data.fishes)) return;
      this.fishes = data.fishes.slice(0, 100).map((f) => {
        const fd = getFishById(f.id) || getFishById(f.t) || pick(FISH_DATA);
        const sizePx = f.s ? f.s : Math.round(36 * fd.size + randomBetween(-6, 8));
        return {
          fd,
          id: fd.id,
          x: f.x ?? randomBetween(60, this.width - 60),
          y: f.y ?? randomBetween(70, this.height - 70),
          vx: f.vx ?? (Math.random() > 0.5 ? 1 : -1) * randomBetween(0.5, 1.6),
          vy: f.vy ?? randomBetween(-0.4, 0.4),
          size: sizePx,
          phase: f.p ?? Math.random() * Math.PI * 2,
          wiggleSpeed: randomBetween(0.08, 0.16),
          wobble: randomBetween(0.6, 1.1),
          hungry: true,
          chase: null,
          flip: f.vx >= 0 ? 1 : -1
        };
      });
    } catch {}
  }

  saveState() {
    try {
      const data = {
        v: 2,
        fishes: this.fishes.map((f) => ({ id: f.fd.id, x: Math.round(f.x), y: Math.round(f.y), vx: Number(f.vx.toFixed(2)), vy: Number(f.vy.toFixed(2)), s: Math.round(f.size), p: Number(f.phase.toFixed(2)) }))
      };
      os.storage.set(StorageKeys.aquariumState, JSON.stringify(data));
    } catch {}
  }

  scheduleSave() {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => this.saveState(), 400);
  }

  setupCanvas() {
    if (!this.canvas || !this.win) return;
    const stage = this.win.querySelector(".aquarium-stage");
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const newW = Math.max(300, Math.round(rect.width));
    const newH = Math.max(200, Math.round(rect.height));
    if (newW === this.width && newH === this.height && this.canvas.width === newW * this.dpr) return;
    const oldW = this.width;
    this.width = newW;
    this.height = newH;
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = this.width + "px";
    this.canvas.style.height = this.height + "px";
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const scaleX = oldW ? this.width / oldW : 1;
    for (const s of this.seaweeds) {
      s.x = Math.max(12, Math.min(this.width - 12, s.x * scaleX));
      s.baseY = this.height;
    }
    for (const b of this.bubbles) {
      b.x = Math.max(10, Math.min(this.width - 10, b.x * scaleX));
    }
    for (const f of this.fishes) {
      f.x = Math.max(f.size * 0.6, Math.min(this.width - f.size * 0.6, f.x * scaleX));
      f.y = Math.max(40, Math.min(this.height - 30, f.y));
    }
    this.buildGravel();
    if (this.ctx && !this.paused) {
      this.draw(0);
    }
  }

  scheduleResize() {
    if (this.resizeRaf) return;
    this.resizeRaf = requestAnimationFrame(() => {
      this.resizeRaf = null;
      this.setupCanvas();
      if (this.win) this.win.classList.remove("resizing");
    });
    if (this.win) this.win.classList.add("resizing");
  }

  trackResize() {
    this.boundResize = () => this.scheduleResize();
    window.addEventListener("resize", this.boundResize);
    const stage = this.win.querySelector(".aquarium-stage");
    if (stage && window.ResizeObserver) {
      this.resizeObserver = new ResizeObserver(() => this.scheduleResize());
      this.resizeObserver.observe(stage);
    }
  }

  buildGravel() {
    this.gravelPebbles = [];
    const gh = 28;
    for (let i = 0; i < 70; i++) {
      this.gravelPebbles.push({
        xRatio: ((i * 137.5) % 1000) / 1000,
        yOff: Math.random() * gh * 0.9 + 2,
        r: randomBetween(1, 2.2),
        c: `rgba(${180 + Math.floor(Math.random() * 40)},${160 + Math.floor(Math.random() * 40)},${120 + Math.floor(Math.random() * 30)},0.7)`
      });
    }
  }

  createInitialFishes(count) {
    this.fishes = [];
    for (let i = 0; i < count; i++) {
      this.fishes.push(this.makeFish());
    }
    this.updateCount();
  }

  makeFish(overrides = {}) {
    let fd = overrides.fd || null;
    if (overrides.fishId) fd = getFishById(overrides.fishId) || fd;
    if (!fd) fd = pick(FISH_DATA);
    const base = 36 * fd.size;
    const size = overrides.size ?? Math.round(base + randomBetween(-6, 10));
    const dir = Math.random() > 0.5 ? 1 : -1;
    return {
      fd,
      id: fd.id,
      x: overrides.x ?? randomBetween(size, this.width - size),
      y: overrides.y ?? randomBetween(70, this.height - 70),
      vx: dir * randomBetween(0.5, 1.6),
      vy: randomBetween(-0.4, 0.4),
      size,
      phase: Math.random() * Math.PI * 2,
      wiggleSpeed: randomBetween(0.08, 0.16),
      wobble: randomBetween(0.6, 1.1),
      hungry: Math.random() > 0.3,
      chase: null,
      flip: dir > 0 ? 1 : -1
    };
  }

  createSeaweeds() {
    this.seaweeds = [];
    const count = 7;
    for (let i = 0; i < count; i++) {
      this.seaweeds.push({
        x: (this.width / (count + 1)) * (i + 1) + randomBetween(-30, 30),
        baseY: this.height,
        height: randomBetween(90, 180),
        sway: randomBetween(0.5, 1.2),
        phase: Math.random() * Math.PI * 2,
        segments: 4 + Math.floor(Math.random() * 3),
        width: randomBetween(10, 18),
        color: i % 2 === 0 ? "rgba(52,211,153,0.85)" : "rgba(16,185,129,0.9)"
      });
    }
  }

  createBubbles(count) {
    this.bubbles = [];
    for (let i = 0; i < count; i++) {
      this.bubbles.push(this.makeBubble(true));
    }
  }

  makeBubble(randomY = false) {
    return {
      x: randomBetween(20, this.width - 20),
      y: randomY ? randomBetween(0, this.height) : this.height + randomBetween(10, 40),
      r: randomBetween(2, 6),
      speed: randomBetween(0.4, 1.3),
      sway: randomBetween(0.6, 1.6),
      phase: Math.random() * Math.PI * 2,
      opacity: randomBetween(0.25, 0.55)
    };
  }

  bindEvents(win) {
    win.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.dataset.action;
        if (action === "feed") this.feed();
        if (action === "addFish") this.addFish();
        if (action === "destroyAll") this.destroyAllFishes();
        if (action === "catalog") this.toggleCatalog();
        if (action === "catalogClose") this.closeCatalog();
        if (action === "pause") this.togglePause(btn);
        if (action === "bubbles") this.burstBubbles();
        if (action === "sound") this.toggleSound();
      });
    });
    win.querySelector("#aquarium-catalog")?.addEventListener("click", (e) => {
      if (e.target.id === "aquarium-catalog") this.closeCatalog();
    });

    this.canvas.addEventListener("click", (e) => {
      if (this.catalogOpen) return;
      this.ensureAudio();
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.dropPellet(x, y);
      this.spawnSplash(x, y);
      this.playSplash();
    });

    this.canvas.addEventListener("mousemove", (e) => {
      if (e.buttons !== 1 || this.catalogOpen) return;
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (Math.random() < 0.2) this.dropPellet(x, y);
    });
  }

  openCatalog() {
    this.catalogOpen = true;
    const cat = this.win.querySelector("#aquarium-catalog");
    if (cat) cat.classList.remove("hidden");
    this.renderCatalogGrid();
    this.setStatus("Catalog open");
  }

  closeCatalog() {
    this.catalogOpen = false;
    const cat = this.win.querySelector("#aquarium-catalog");
    if (cat) cat.classList.add("hidden");
  }

  toggleCatalog() {
    if (this.catalogOpen) this.closeCatalog();
    else this.openCatalog();
  }

  renderCatalogGrid() {
    const grid = this.win.querySelector("#aquarium-catalog-grid");
    const countEl = this.win.querySelector("#catalog-count");
    if (!grid) return;
    const list = getAllFish();
    if (countEl) countEl.textContent = `(${list.length})`;
    grid.innerHTML = list.map((fd) => `
      <button class="aquarium-catalog-item" data-fish-id="${fd.id}" title="${fd.name}">
        <canvas width="120" height="80" data-preview="${fd.id}"></canvas>
        <span class="aquarium-catalog-name">${fd.name}</span>
      </button>
    `).join("");
    grid.querySelectorAll("[data-fish-id]").forEach((btn) => {
      btn.addEventListener("click", () => this.spawnFishById(btn.dataset.fishId));
    });
    requestAnimationFrame(() => this.renderCatalogPreviews());
  }

  renderCatalogPreviews() {
    const grid = this.win.querySelector("#aquarium-catalog-grid");
    if (!grid) return;
    grid.querySelectorAll("canvas[data-preview]").forEach((c) => {
      const fd = getFishById(c.dataset.preview);
      if (!fd) return;
      const ctx = c.getContext("2d");
      const dpr = window.devicePixelRatio || 1;
      c.width = 120 * dpr;
      c.height = 80 * dpr;
      c.style.width = "120px";
      c.style.height = "80px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, 120, 80);
      const bg = ctx.createLinearGradient(0, 0, 0, 80);
      bg.addColorStop(0, "rgba(56,189,248,0.22)");
      bg.addColorStop(1, "rgba(8,47,73,0.28)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 120, 80);
      ctx.save();
      ctx.translate(60, 44);
      const isWhale = fd.body === "whale";
      const isManta = fd.body === "mantaray";
      const isLarge = isWhale || isManta || fd.size >= 2.0;
      const previewSize = isLarge ? 44 : isWhale ? 38 : 62;
      const autoScale = (() => {
        if (fd.body === "seastar") return 52;
        if (fd.body === "crab") return 42;
        if (fd.body === "turtle") return 48;
        if (fd.body === "jellyfish" || fd.body === "jelly") return 54;
        if (fd.body === "octopus" || fd.body === "octopus_ear") return 48;
        if (fd.body === "eel") return 68;
        if (fd.body === "isopod") return 58;
        if (fd.body === "squid") return 50;
        return previewSize;
      })();
      const previewFish = { fd, size: autoScale, phase: Math.random() * Math.PI * 2 };
      try { drawSeaFish(ctx, previewFish, 0, false, 0); } catch {}
      ctx.restore();
    });
  }

  spawnFishById(fishId) {
    if (this.fishes.length >= 100) {
      this.setStatus("Aquarium is full");
      return;
    }
    this.ensureAudio();
    const fd = getFishById(fishId);
    if (!fd) return;
    const fish = this.makeFish({ fishId: fd.id, x: this.width + 40, y: randomBetween(80, this.height - 80) });
    fish.vx = -Math.abs(fish.vx);
    fish.flip = -1;
    this.fishes.push(fish);
    this.updateCount();
    this.spawnSplash(fish.x - 20, fish.y);
    this.playAddFish();
    this.setStatus(`Spawned ${fd.name}`);
    this.scheduleSave();
    this.closeCatalog();
  }

  feed() {
    if (this.feedCooldown) return;
    this.ensureAudio();
    this.feedCooldown = true;
    for (let i = 0; i < 5; i++) {
      setTimeout(() => this.dropPellet(randomBetween(60, this.width - 60), randomBetween(30, 80)), i * 80);
    }
    this.playFeed();
    this.setStatus("Feeding time!");
    setTimeout(() => (this.feedCooldown = false), 800);
  }

  dropPellet(x, y) {
    this.pellets.push({
      x,
      y,
      vy: 0,
      r: randomBetween(2.5, 4),
      eaten: false,
      life: 1
    });
    if (this.pellets.length > 24) this.pellets.shift();
  }

  spawnSplash(x, y) {
    for (let i = 0; i < 6; i++) {
      this.particles.push({
        x,
        y,
        vx: randomBetween(-1.5, 1.5),
        vy: randomBetween(-1.2, -0.2),
        life: 1,
        decay: randomBetween(0.04, 0.08),
        r: randomBetween(1, 2.5)
      });
    }
  }

  addFish() {
    if (this.fishes.length >= 100) {
      this.setStatus("Aquarium is full");
      return;
    }
    this.ensureAudio();
    const fish = this.makeFish({ x: this.width + 40, y: randomBetween(80, this.height - 80) });
    fish.vx = -Math.abs(fish.vx);
    fish.flip = -1;
    this.fishes.push(fish);
    this.updateCount();
    this.spawnSplash(fish.x - 20, fish.y);
    this.playAddFish();
    this.setStatus(`New ${fish.fd.name} added`);
    this.scheduleSave();
  }

  async destroyAllFishes() {
    if (this.fishes.length === 0) {
      this.setStatus("No fishes to destroy");
      return;
    }
    const ok = await os.dialog.confirm("Destroy All Fishes", `Remove all ${this.fishes.length} fishes? This cannot be undone.`);
    if (!ok) return;
    this.ensureAudio();
    for (const f of this.fishes) {
      for (let i = 0; i < 8; i++) this.particles.push({ x: f.x, y: f.y, vx: randomBetween(-2.8, 2.8), vy: randomBetween(-2.8, 1.2), life: 1, decay: randomBetween(0.03, 0.06), r: randomBetween(1.5, 3) });
    }
    this.fishes = [];
    this.pellets = [];
    this.particles = this.particles.slice(-32);
    this.updateCount();
    this.playDestroy();
    this.setStatus("All fishes gone");
    this.scheduleSave();
  }

  shuffleFishes() {
    this.ensureAudio();
    this.fishes.forEach((f) => {
      f.vx = (Math.random() > 0.5 ? 1 : -1) * randomBetween(0.7, 1.6);
      f.vy = randomBetween(-0.5, 0.5);
      f.flip = f.vx > 0 ? 1 : -1;
      f.hungry = true;
    });
    this.playShuffle();
    this.setStatus("Fishes are exploring");
    this.scheduleSave();
  }

  burstBubbles() {
    this.ensureAudio();
    for (let i = 0; i < 10; i++) this.bubbles.push(this.makeBubble(false));
    this.playBubble();
    this.setStatus("Bubbles!");
  }

  togglePause(btn) {
    this.paused = !this.paused;
    btn.innerHTML = `<i class="fas ${this.paused ? "fa-play" : "fa-pause"}"></i> ${this.paused ? "Resume" : "Pause"}`;
    btn.classList.toggle("active", this.paused);
    this.setStatus(this.paused ? "Paused" : "Resumed");
    if (!this.paused) {
      this.lastTime = performance.now();
      this.loop();
      if (this.soundEnabled) this.ensureAudio();
    }
  }

  setStatus(text) {
    const el = this.win?.querySelector("#aquarium-status-text");
    if (!el) return;
    el.textContent = text;
    el.classList.remove("flash");
    void el.offsetWidth;
    el.classList.add("flash");
  }

  updateCount() {
    const el = this.win?.querySelector("#aquarium-fish-count");
    if (el) el.textContent = String(this.fishes.length);
  }

  loop = () => {
    if (this.paused || !this.ctx) return;
    this.rafId = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min(32, now - this.lastTime) / 16.66;
    this.lastTime = now;
    this.update(dt);
    this.draw(dt);
  };

  update(dt) {
    for (const fish of this.fishes) {
      fish.phase += fish.wiggleSpeed * dt;

      let target = null;
      let closestDist = Infinity;
      for (const p of this.pellets) {
        if (p.eaten) continue;
        const d = Math.hypot(p.x - fish.x, p.y - fish.y);
        if (d < closestDist && d < 220) {
          closestDist = d;
          target = p;
        }
      }
      if (target) {
        fish.chase = target;
        const dx = target.x - fish.x;
        const dy = target.y - fish.y;
        const dist = Math.hypot(dx, dy) || 1;
        const speed = 2.2;
        fish.vx += (dx / dist) * 0.18 * dt;
        fish.vy += (dy / dist) * 0.18 * dt;
        fish.vx = Math.max(-speed, Math.min(speed, fish.vx));
        fish.vy = Math.max(-1.2, Math.min(1.2, fish.vy));
        if (dist < fish.size * 0.35) {
          target.eaten = true;
          this.spawnSplash(target.x, target.y);
          this.playBubble();
          fish.hungry = false;
          setTimeout(() => (fish.hungry = true), 3000);
        }
      } else {
        fish.chase = null;
        fish.vy += Math.sin(fish.phase * 0.7) * 0.015 * dt;
        fish.vx += randomBetween(-0.02, 0.02) * dt;
        if (Math.random() < 0.004) fish.vx *= -1;
        fish.vx = Math.max(-1.7, Math.min(1.7, fish.vx));
        fish.vy = Math.max(-0.9, Math.min(0.9, fish.vy));
      }

      fish.x += fish.vx * dt;
      fish.y += fish.vy * dt + Math.sin(fish.phase) * 0.3 * dt;

      const margin = fish.size * 0.6;
      if (fish.x < margin) {
        fish.x = margin;
        fish.vx = Math.abs(fish.vx);
      }
      if (fish.x > this.width - margin) {
        fish.x = this.width - margin;
        fish.vx = -Math.abs(fish.vx);
      }
      if (fish.y < 40) {
        fish.y = 40;
        fish.vy = Math.abs(fish.vy) * 0.6;
      }
      if (fish.y > this.height - 30) {
        fish.y = this.height - 30;
        fish.vy = -Math.abs(fish.vy) * 0.6;
      }

      const targetFlip = fish.vx > 0.1 ? 1 : fish.vx < -0.1 ? -1 : fish.flip;
      fish.flip += (targetFlip - fish.flip) * 0.12 * dt;
    }

    for (let i = this.fishes.length - 1; i >= 0; i--) {
      for (let j = i + 1; j < this.fishes.length; j++) {
        const a = this.fishes[i];
        const b = this.fishes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        const min = (a.size + b.size) * 0.35;
        if (d < min && d > 0.1) {
          const push = (min - d) * 0.04;
          const nx = dx / d;
          const ny = dy / d;
          a.x -= nx * push * 6;
          a.y -= ny * push * 6;
          b.x += nx * push * 6;
          b.y += ny * push * 6;
          a.vx -= nx * 0.08;
          b.vx += nx * 0.08;
        }
      }
    }

    for (const p of this.pellets) {
      if (p.eaten) {
        p.life -= 0.12 * dt;
        continue;
      }
      p.vy += 0.07 * dt;
      p.vy = Math.min(p.vy, 1.6);
      p.y += p.vy * dt;
      p.x += Math.sin(p.y * 0.05) * 0.2 * dt;
      if (p.y > this.height - 18) {
        p.y = this.height - 18;
        p.vy *= -0.15;
        if (Math.abs(p.vy) < 0.1) p.vy = 0;
      }
    }
    this.pellets = this.pellets.filter((p) => p.life > 0 && p.y < this.height + 10);
    if (this.pellets.length > 0 && this.pellets.every((p) => p.eaten)) {
      setTimeout(() => {
        this.pellets = this.pellets.filter((p) => !p.eaten);
      }, 200);
    }

    for (const b of this.bubbles) {
      b.y -= b.speed * dt;
      b.x += Math.sin(b.y * 0.02 + b.phase) * 0.4 * dt;
      b.phase += 0.03 * dt;
      if (b.y < -10) {
        b.y = this.height + randomBetween(10, 30);
        b.x = randomBetween(20, this.width - 20);
      }
    }

    for (const pt of this.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += 0.06 * dt;
      pt.life -= pt.decay * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    for (const s of this.seaweeds) {
      s.phase += 0.02 * s.sway * dt;
    }
  }

  draw(dt) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    ctx.clearRect(0, 0, w, h);

    this.drawWater(ctx, w, h);
    this.drawGravel(ctx, w, h);
    this.drawSeaweeds(ctx);
    this.drawPellets(ctx);
    this.drawBubbles(ctx);
    this.drawFishes(dt);
    this.drawParticles(ctx);
    this.drawLightRays(ctx, w, h);
  }

  drawWater(ctx, w, h) {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "rgba(56,189,248,0.32)");
    grad.addColorStop(0.22, "rgba(14,165,233,0.28)");
    grad.addColorStop(0.55, "rgba(3,105,161,0.22)");
    grad.addColorStop(1, "rgba(8,47,73,0.32)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.globalAlpha = 0.07;
    for (let i = 0; i < 3; i++) {
      const y = (h * 0.18) + i * 22 + Math.sin(performance.now() * 0.0003 + i) * 6;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x < w; x += 18) {
        ctx.lineTo(x, y + Math.sin(x * 0.015 + i * 1.2 + performance.now() * 0.001) * 4);
      }
      ctx.lineTo(w, y + 8);
      ctx.lineTo(0, y + 8);
      ctx.closePath();
      ctx.fillStyle = "#ffffff";
      ctx.fill();
    }
    ctx.restore();
  }

  drawGravel(ctx, w, h) {
    ctx.save();
    const gh = 28;
    ctx.fillStyle = "rgba(120,90,40,0.28)";
    ctx.beginPath();
    ctx.moveTo(0, h - gh);
    for (let x = 0; x <= w; x += 14) {
      ctx.lineTo(x, h - gh + Math.sin(x * 0.08) * 3 + Math.cos(x * 0.03) * 2);
    }
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();

    ctx.globalAlpha = 0.35;
    for (const peb of this.gravelPebbles) {
      const x = peb.xRatio * w;
      const y = h - peb.yOff;
      ctx.beginPath();
      ctx.arc(x, y, peb.r, 0, Math.PI * 2);
      ctx.fillStyle = peb.c;
      ctx.fill();
    }
    ctx.restore();
  }

  drawSeaweeds(ctx) {
    for (const s of this.seaweeds) {
      ctx.save();
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalAlpha = 0.92;
      ctx.beginPath();
      ctx.moveTo(s.x, s.baseY);
      const sway = Math.sin(s.phase) * 18 * s.sway;
      const midX = s.x + sway * 0.5;
      const tipX = s.x + sway;
      const midY = s.baseY - s.height * 0.5;
      const tipY = s.baseY - s.height;
      ctx.quadraticCurveTo(midX, midY, tipX, tipY);
      ctx.stroke();

      ctx.globalAlpha = 0.35;
      ctx.lineWidth = s.width * 0.45;
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.moveTo(s.x + 2, s.baseY - 8);
      ctx.quadraticCurveTo(midX + 2, midY, tipX + 1, tipY + 10);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawPellets(ctx) {
    for (const p of this.pellets) {
      if (p.eaten && p.life < 0.3) continue;
      ctx.save();
      ctx.globalAlpha = p.eaten ? p.life : 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.eaten ? "rgba(255,255,255,0.6)" : "#f59e0b";
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.18)";
      ctx.lineWidth = 1;
      ctx.stroke();
      if (!p.eaten) {
        ctx.beginPath();
        ctx.arc(p.x - 1, p.y - 1, 1, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.fill();
      }
      ctx.restore();
    }
  }

  drawBubbles(ctx) {
    for (const b of this.bubbles) {
      ctx.save();
      ctx.globalAlpha = b.opacity;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.fill();
      ctx.restore();
    }
  }

  drawFishes(dt) {
    const sorted = [...this.fishes].sort((a, b) => a.y - b.y);
    const tSec = performance.now() / 1000;
    for (const fish of sorted) {
      const wag = Math.sin(fish.phase * 1.2) * 0.32 * fish.wobble;
      const flip = fish.flip;
      const scaleX = flip >= 0 ? 1 : -1;
      this.ctx.save();
      this.ctx.translate(fish.x, fish.y);
      const angle = Math.atan2(fish.vy, fish.vx) * 0.18;
      this.ctx.rotate(angle);
      this.ctx.scale(scaleX, 1);
      try {
        drawSeaFish(this.ctx, fish, wag, false, tSec);
      } catch {}
      this.ctx.restore();
    }
  }

  drawParticles(ctx) {
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = p.life * 0.7;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  drawLightRays(ctx, w, h) {
    ctx.save();
    ctx.globalAlpha = 0.045;
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 5; i++) {
      const x = (w / 6) * (i + 0.7) + Math.sin(performance.now() * 0.0002 + i) * 10;
      ctx.beginPath();
      ctx.moveTo(x - 28, 0);
      ctx.lineTo(x + 28, 0);
      ctx.lineTo(x + 8, h);
      ctx.lineTo(x - 48, h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillRect(0, 0, w, 2);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(0, 2, w, 14);
    ctx.restore();
  }
}
