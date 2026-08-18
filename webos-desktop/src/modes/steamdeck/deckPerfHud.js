import { os, StorageKeys, createElement, setHTML, setText, $$ } from "../../framework.js";

class DeckPerfHud {
  constructor() {
    this.enabled = false;
    this.root = null;
    this.hudEl = null;
    this.fpsEl = null;
    this.memEl = null;
    this.battEl = null;
    this.rafId = null;
    this.frames = 0;
    this.lastStamp = 0;
    this.lastWrite = 0;
    this.battery = null;
    this.battLevel = 0;
    this.battCharging = false;
  }

  init(root) {
    this.root = root;
    this.enabled = os.storage.get(StorageKeys.deckPerfHud) === "true";
    if (this.enabled) this.show();
  }

  setEnabled(on) {
    this.enabled = !!on;
    os.storage.set(StorageKeys.deckPerfHud, String(this.enabled));
    if (this.enabled) this.show();
    else this.hide();
  }

  isEnabled() {
    return this.enabled;
  }

  show() {
    if (!this.root || this.hudEl) return;
    const hud = createElement("div", { className: "deck-perf-hud" });
    hud.dataset.perfHud = "1";
    setHTML(
      hud,
      '<div class="deck-perf-hud-row"><span class="deck-perf-hud-label">FPS</span><span class="deck-perf-hud-value" data-hud-fps></span></div>' +
        '<div class="deck-perf-hud-row"><span class="deck-perf-hud-label">MEM</span><span class="deck-perf-hud-value" data-hud-mem></span></div>' +
        '<div class="deck-perf-hud-row"><span class="deck-perf-hud-label">BATT</span><span class="deck-perf-hud-value" data-hud-batt></span></div>'
    );
    this.root.appendChild(hud);
    this.hudEl = hud;
    this.fpsEl = $$("[data-hud-fps]", hud)[0] || null;
    this.memEl = $$("[data-hud-mem]", hud)[0] || null;
    this.battEl = $$("[data-hud-batt]", hud)[0] || null;
    this.frames = 0;
    this.lastStamp = performance.now();
    this.lastWrite = 0;
    this.initBattery();
    this.rafId = requestAnimationFrame(() => this.tick());
  }

  hide() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.hudEl && this.hudEl.parentNode) this.hudEl.parentNode.removeChild(this.hudEl);
    this.hudEl = null;
    this.fpsEl = null;
    this.memEl = null;
    this.battEl = null;
    this.detachBattery();
  }

  destroy() {
    this.hide();
    this.root = null;
    this.enabled = false;
  }

  tick() {
    if (!this.hudEl || !this.hudEl.isConnected) {
      this.rafId = null;
      return;
    }
    this.frames++;
    const now = performance.now();
    const elapsed = now - this.lastStamp;
    if (elapsed >= 500) {
      const fps = Math.round((this.frames * 1000) / elapsed);
      const frameMs = fps > 0 ? (1000 / fps).toFixed(1) : "0.0";
      this.writeFps(fps, frameMs);
      this.writeMem();
      this.writeBatt();
      this.frames = 0;
      this.lastStamp = now;
      this.lastWrite = now;
    }
    this.rafId = requestAnimationFrame(() => this.tick());
  }

  writeFps(fps, frameMs) {
    if (this.fpsEl) setText(this.fpsEl, `${fps} · ${frameMs}ms`);
  }

  writeMem() {
    if (!this.memEl) return;
    const memory = performance.memory;
    if (!memory || typeof memory.usedJSHeapSize !== "number") {
      setText(this.memEl, "-- MB");
      return;
    }
    const mb = Math.round(memory.usedJSHeapSize / (1024 * 1024));
    setText(this.memEl, `${mb} MB`);
  }

  writeBatt() {
    if (!this.battEl) return;
    const suffix = this.battCharging ? " ⚡" : "";
    setText(this.battEl, `${this.battLevel}%${suffix}`);
  }

  initBattery() {
    if (!("getBattery" in navigator)) return;
    try {
      navigator.getBattery().then((battery) => {
        if (!battery || battery === this.battery) return;
        this.battery = battery;
        this.battLevel = Math.round(battery.level * 100);
        this.battCharging = battery.charging;
        this.writeBatt();
        battery.addEventListener("levelchange", this.handleBatteryChange);
        battery.addEventListener("chargingchange", this.handleBatteryChange);
      });
    } catch {}
  }

  handleBatteryChange = () => {
    if (!this.battery) return;
    this.battLevel = Math.round(this.battery.level * 100);
    this.battCharging = this.battery.charging;
    this.writeBatt();
  };

  detachBattery() {
    if (this.battery) {
      this.battery.removeEventListener("levelchange", this.handleBatteryChange);
      this.battery.removeEventListener("chargingchange", this.handleBatteryChange);
      this.battery = null;
    }
  }
}

export const deckPerfHud = new DeckPerfHud();
