import { WidgetBase } from "../widgetManager.js";
import { FISH_DATA, getFishById, getAllFish } from "../../apps/aquarium/fishCatalog.js";
import { drawSeaFish } from "../../apps/aquarium/fishRender.js";

function randomBetween(a, b) { return a + Math.random() * (b - a); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export class AquariumWidget extends WidgetBase {
  constructor(manager, id) {
    super(manager, id, "aquarium", "Aquarium", 340, 220);
    this.fishes = [];
    this.seaweeds = [];
    this.bubbles = [];
    this.particles = [];
    this.gravelPebbles = [];
    this.width = 320;
    this.height = 180;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.rafId = null;
    this.lastTime = 0;
    this.canvas = null;
    this.ctx = null;
    this.resizeObserver = null;
    this.widgetFishCount = 5;
  }

  onRender(contentEl) {
    contentEl.style.padding = "0";
    contentEl.style.overflow = "hidden";
    contentEl.style.background = "transparent";
    contentEl.style.display = "flex";
    contentEl.style.flexDirection = "column";
    contentEl.style.height = "100%";
    contentEl.innerHTML = `
      <div class="widget-aquarium-stage" style="position:relative;flex:1;min-height:0;overflow:hidden;cursor:pointer;background:transparent;">
        <canvas class="widget-aquarium-canvas" style="display:block;width:100%;height:100%;"></canvas>
        <div class="widget-aquarium-glass" style="position:absolute;inset:0;pointer-events:none;background:linear-gradient(105deg, rgba(125,211,252,0.12) 0%, transparent 24%, transparent 80%, rgba(56,189,248,0.08) 100%);border-left:1px solid rgba(125,211,252,0.12);"></div>
      </div>
      <div class="widget-aquarium-bar" style="display:flex;align-items:center;justify-content:space-between;padding:5px 8px;background:rgba(12,72,130,0.28);border-top:1px solid rgba(125,211,252,0.18);backdrop-filter:blur(10px);font-size:11px;color:#bae6fd;">
        <span class="widget-aquarium-count"><i class="fas fa-fish"></i> <span>${this.fishes.length}</span> fish</span>
        <button class="widget-aquarium-add" style="appearance:none;border:1px solid rgba(125,211,252,0.28);background:rgba(14,95,160,0.32);color:#e0f2fe;padding:3px 8px;border-radius:10px;font-size:11px;cursor:pointer;">Add</button>
      </div>
    `;

    this.canvas = contentEl.querySelector(".widget-aquarium-canvas");
    this.ctx = this.canvas.getContext("2d");
    this.buildGravel();
    this.createSeaweeds();
    this.createBubbles(8);
    if (this.fishes.length === 0) {
      for (let i = 0; i < this.widgetFishCount; i++) this.fishes.push(this.makeFish());
    }
    this.updateCount();
    this.setupCanvas();
    this.bindWidgetEvents(contentEl);
    this.trackResize(contentEl);
    this.lastTime = performance.now();
    this.loop();
  }

  bindWidgetEvents(contentEl) {
    const addBtn = contentEl.querySelector(".widget-aquarium-add");
    const stage = contentEl.querySelector(".widget-aquarium-stage");
    if (addBtn) addBtn.addEventListener("click", (e) => { e.stopPropagation(); this.addFish(); });
    if (stage) stage.addEventListener("click", (e) => {
      if (e.target.closest(".widget-aquarium-add")) return;
      this.addFish();
    });
  }

  setupCanvas() {
    if (!this.canvas) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.width = Math.max(120, Math.round(rect.width));
    this.height = Math.max(80, Math.round(rect.height));
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = this.width + "px";
    this.canvas.style.height = this.height + "px";
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.buildGravel();
  }

  trackResize(contentEl) {
    const stage = contentEl.querySelector(".widget-aquarium-stage");
    if (!stage || !window.ResizeObserver) return;
    this.resizeObserver = new ResizeObserver(() => {
      this.setupCanvas();
    });
    this.resizeObserver.observe(stage);
    this.resizeObserver.observe(contentEl);
  }

  buildGravel() {
    this.gravelPebbles = [];
    for (let i = 0; i < 30; i++) {
      this.gravelPebbles.push({
        xRatio: ((i * 137.5) % 1000) / 1000,
        yOff: Math.random() * 18 + 2,
        r: randomBetween(1, 2),
        c: `rgba(${180 + Math.floor(Math.random() * 40)},${160 + Math.floor(Math.random() * 40)},${120 + Math.floor(Math.random() * 30)},0.6)`
      });
    }
  }

  makeFish(overrides = {}) {
    let fd = overrides.fd || null;
    if (overrides.fishId) fd = getFishById(overrides.fishId) || fd;
    if (!fd) fd = pick(FISH_DATA);
    const base = 28 * fd.size;
    const size = overrides.size ?? Math.round(base + randomBetween(-4, 6));
    const dir = Math.random() > 0.5 ? 1 : -1;
    return {
      fd, id: fd.id,
      x: overrides.x ?? randomBetween(size, Math.max(size + 10, this.width - size)),
      y: overrides.y ?? randomBetween(20, Math.max(20, this.height - 20)),
      vx: dir * randomBetween(0.6, 1.4),
      vy: randomBetween(-0.3, 0.3),
      size,
      phase: Math.random() * Math.PI * 2,
      wiggleSpeed: randomBetween(0.08, 0.16),
      wobble: randomBetween(0.6, 1.1),
      flip: dir > 0 ? 1 : -1
    };
  }

  createSeaweeds() {
    this.seaweeds = [];
    const count = 4;
    for (let i = 0; i < count; i++) {
      this.seaweeds.push({
        x: (this.width / (count + 1)) * (i + 1) + randomBetween(-10, 10),
        baseY: this.height,
        height: randomBetween(28, 56),
        sway: randomBetween(0.5, 1.0),
        phase: Math.random() * Math.PI * 2,
        width: randomBetween(6, 10)
      });
    }
  }

  createBubbles(count) {
    this.bubbles = [];
    for (let i = 0; i < count; i++) this.bubbles.push(this.makeBubble(true));
  }

  makeBubble(randomY = false) {
    return {
      x: randomBetween(10, this.width - 10),
      y: randomY ? randomBetween(0, this.height) : this.height + randomBetween(6, 16),
      r: randomBetween(1.5, 3.5),
      speed: randomBetween(0.3, 0.9),
      sway: randomBetween(0.6, 1.2),
      phase: Math.random() * Math.PI * 2,
      opacity: randomBetween(0.2, 0.45)
    };
  }

  addFish() {
    if (this.fishes.length >= 12) this.fishes.shift();
    const fish = this.makeFish({ x: this.width + 20, y: randomBetween(20, this.height - 20) });
    fish.vx = -Math.abs(fish.vx);
    fish.flip = -1;
    this.fishes.push(fish);
    this.updateCount();
    this.manager.saveState();
  }

  burstBubbles() {
    for (let i = 0; i < 6; i++) this.bubbles.push(this.makeBubble(false));
  }

  updateCount() {
    if (!this.element) return;
    const el = this.element.querySelector(".widget-aquarium-count span");
    if (el) el.textContent = String(this.fishes.length);
  }

  loop = () => {
    if (!this.ctx || !this.canvas) return;
    this.rafId = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min(32, now - this.lastTime) / 16.66;
    this.lastTime = now;
    this.update(dt);
    this.draw();
  };

  update(dt) {
    for (const f of this.fishes) {
      f.phase += f.wiggleSpeed * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt + Math.sin(f.phase) * 0.18 * dt;
      const m = f.size * 0.5;
      if (f.x < m) { f.x = m; f.vx = Math.abs(f.vx); }
      if (f.x > this.width - m) { f.x = this.width - m; f.vx = -Math.abs(f.vx); }
      if (f.y < 12) { f.y = 12; f.vy = Math.abs(f.vy) * 0.5; }
      if (f.y > this.height - 12) { f.y = this.height - 12; f.vy = -Math.abs(f.vy) * 0.5; }
      const targetFlip = f.vx > 0.1 ? 1 : f.vx < -0.1 ? -1 : f.flip;
      f.flip += (targetFlip - f.flip) * 0.12 * dt;
      f.vy += (Math.random() - 0.5) * 0.01 * dt;
      f.vy = Math.max(-0.7, Math.min(0.7, f.vy));
    }
    for (const b of this.bubbles) {
      b.y -= b.speed * dt;
      b.x += Math.sin(b.y * 0.02 + b.phase) * 0.3 * dt;
      b.phase += 0.03 * dt;
      if (b.y < -6) { b.y = this.height + randomBetween(6, 12); b.x = randomBetween(10, this.width - 10); }
    }
    for (const s of this.seaweeds) s.phase += 0.02 * s.sway * dt;
  }

  draw() {
    const ctx = this.ctx, w = this.width, h = this.height;
    ctx.clearRect(0, 0, w, h);
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "rgba(56,189,248,0.28)");
    grad.addColorStop(1, "rgba(8,47,73,0.30)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.globalAlpha = 0.06;
    for (let i = 0; i < 2; i++) {
      const y = h * 0.22 + i * 18 + Math.sin(performance.now() * 0.0003 + i) * 4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x < w; x += 16) ctx.lineTo(x, y + Math.sin(x * 0.02 + i) * 3);
      ctx.lineTo(w, y + 6);
      ctx.lineTo(0, y + 6);
      ctx.closePath();
      ctx.fillStyle = "#fff";
      ctx.fill();
    }
    ctx.restore();
    const gh = 18;
    ctx.fillStyle = "rgba(120,90,40,0.26)";
    ctx.beginPath();
    ctx.moveTo(0, h - gh);
    for (let x = 0; x <= w; x += 12) ctx.lineTo(x, h - gh + Math.sin(x * 0.08) * 2);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.32;
    for (const peb of this.gravelPebbles) {
      const x = peb.xRatio * w, y = h - peb.yOff;
      ctx.beginPath(); ctx.arc(x, y, peb.r, 0, Math.PI * 2); ctx.fillStyle = peb.c; ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const s of this.seaweeds) {
      ctx.save();
      ctx.strokeStyle = "rgba(52,211,153,0.8)";
      ctx.lineWidth = s.width;
      ctx.lineCap = "round";
      ctx.globalAlpha = 0.88;
      ctx.beginPath();
      ctx.moveTo(s.x, s.baseY);
      const sway = Math.sin(s.phase) * 10 * s.sway;
      ctx.quadraticCurveTo(s.x + sway * 0.5, s.baseY - s.height * 0.5, s.x + sway, s.baseY - s.height);
      ctx.stroke();
      ctx.restore();
    }
    for (const b of this.bubbles) {
      ctx.save();
      ctx.globalAlpha = b.opacity;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fillStyle = "rgba(255,255,255,0.88)"; ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
    }
    const sorted = [...this.fishes].sort((a, b) => a.y - b.y);
    const tSec = performance.now() / 1000;
    for (const fish of sorted) {
      const wag = Math.sin(fish.phase * 1.2) * 0.32 * fish.wobble;
      const scaleX = fish.flip >= 0 ? 1 : -1;
      ctx.save();
      ctx.translate(fish.x, fish.y);
      ctx.rotate(Math.atan2(fish.vy, fish.vx) * 0.12);
      ctx.scale(scaleX, 1);
      try { drawSeaFish(ctx, fish, wag, false, tSec); } catch {}
      ctx.restore();
    }
  }

  getData() {
    return {
      fishes: this.fishes.map((f) => ({ id: f.fd.id, x: Math.round(f.x), y: Math.round(f.y), vx: Number(f.vx.toFixed(2)), size: Math.round(f.size) }))
    };
  }

  setData(data) {
    if (!data || !Array.isArray(data.fishes) || data.fishes.length === 0) return;
    this.fishes = data.fishes.slice(0, 12).map((f) => {
      const fd = getFishById(f.id) || pick(FISH_DATA);
      return {
        fd, id: fd.id,
        x: f.x ?? randomBetween(30, this.width - 30),
        y: f.y ?? randomBetween(20, this.height - 20),
        vx: f.vx ?? (Math.random() > 0.5 ? 1 : -1) * randomBetween(0.6, 1.2),
        vy: randomBetween(-0.3, 0.3),
        size: f.size ?? Math.round(28 * fd.size),
        phase: Math.random() * Math.PI * 2,
        wiggleSpeed: randomBetween(0.08, 0.16),
        wobble: randomBetween(0.6, 1.1),
        flip: f.vx >= 0 ? 1 : -1
      };
    });
  }

  destroy() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    if (this.resizeObserver) { this.resizeObserver.disconnect(); this.resizeObserver = null; }
    super.destroy();
  }
}
