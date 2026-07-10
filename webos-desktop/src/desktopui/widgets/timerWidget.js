import { WidgetBase } from "../widgetManager.js";

export class TimerWidget extends WidgetBase {
  constructor(manager, id) {
    super(manager, id, "timer", "Timer", 220, 160);
    this.mode = "timer";
    this.time = 300;
    this.remaining = 300;
    this.elapsed = 0;
    this.running = false;
    this.interval = null;
  }

  onRender(contentEl) {
    contentEl.innerHTML = `
      <div class="widget-timer-display" id="w-timer-display-${this.id}">05:00</div>
      <div class="widget-timer-controls">
        <button class="widget-timer-btn" id="w-timer-start-${this.id}">Start</button>
        <button class="widget-timer-btn" id="w-timer-reset-${this.id}">Reset</button>
        <button class="widget-timer-btn" id="w-timer-mode-${this.id}">Mode</button>
      </div>
      <div class="widget-timer-stepper">
        <button class="widget-timer-step-btn" id="w-timer-dec-${this.id}">-</button>
        <span class="widget-timer-step-value" id="w-timer-min-display-${this.id}">5</span>
        <span class="widget-timer-step-label">min</span>
        <button class="widget-timer-step-btn" id="w-timer-inc-${this.id}">+</button>
      </div>
    `;

    contentEl.querySelector(`#w-timer-start-${this.id}`).addEventListener("click", () => {
      this.toggleTimer(contentEl);
    });

    contentEl.querySelector(`#w-timer-reset-${this.id}`).addEventListener("click", () => {
      this.reset(contentEl);
    });

    contentEl.querySelector(`#w-timer-mode-${this.id}`).addEventListener("click", () => {
      this.toggleMode(contentEl);
    });

    contentEl.querySelector(`#w-timer-inc-${this.id}`).addEventListener("click", () => {
      if (!this.running) {
        this.time = Math.min(this.time + 60, 5940);
        this.remaining = this.time;
        this.updateDisplay(contentEl);
      }
    });

    contentEl.querySelector(`#w-timer-dec-${this.id}`).addEventListener("click", () => {
      if (!this.running && this.time >= 60) {
        this.time = Math.max(this.time - 60, 60);
        this.remaining = this.time;
        this.updateDisplay(contentEl);
      }
    });

    this.updateDisplay(contentEl);
  }

  getConfigFields() {
    return [
      {
        key: "defaultMinutes",
        label: "Default minutes",
        type: "number",
        value: Math.floor(this.time / 60),
        default: 5
      }
    ];
  }

  applyConfig(data) {
    const mins = parseInt(data.defaultMinutes) || 5;
    this.time = mins * 60;
    this.remaining = this.time;
    if (this.contentEl) this.updateDisplay(this.contentEl);
    this.manager.saveState();
  }

  toggleTimer(ce) {
    this.running = !this.running;
    const btn = ce.querySelector(`#w-timer-start-${this.id}`);
    if (btn) btn.textContent = this.running ? "Pause" : "Start";

    if (this.running) {
      this.interval = setInterval(() => this.tick(ce), 1000);
    } else {
      clearInterval(this.interval);
    }
  }

  tick(ce) {
    if (this.mode === "timer") {
      this.remaining--;
      if (this.remaining <= 0) {
        this.running = false;
        clearInterval(this.interval);
        this.remaining = 0;
        const btn = ce.querySelector(`#w-timer-start-${this.id}`);
        if (btn) btn.textContent = "Start";
      }
    } else {
      this.elapsed++;
    }
    this.updateDisplay(ce);
  }

  reset(ce) {
    this.running = false;
    clearInterval(this.interval);
    this.remaining = this.time;
    this.elapsed = 0;
    const btn = ce.querySelector(`#w-timer-start-${this.id}`);
    if (btn) btn.textContent = "Start";
    this.updateDisplay(ce);
  }

  toggleMode(ce) {
    this.mode = this.mode === "timer" ? "stopwatch" : "timer";
    this.reset(ce);
  }

  updateDisplay(ce) {
    if (!ce) ce = this.contentEl;
    const displayEl = ce.querySelector(`#w-timer-display-${this.id}`);
    if (!displayEl) return;

    const seconds = this.mode === "timer" ? this.remaining : this.elapsed;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    displayEl.textContent = `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;

    const minDisplay = ce.querySelector(`#w-timer-min-display-${this.id}`);
    if (minDisplay && this.mode === "timer") {
      minDisplay.textContent = Math.floor(this.time / 60);
    }
  }

  getData() {
    return { time: this.time, mode: this.mode };
  }

  setData(data) {
    if (data) {
      this.time = data.time || 300;
      this.mode = data.mode || "timer";
      this.remaining = this.time;
    }
  }

  destroy() {
    if (this.interval) clearInterval(this.interval);
    super.destroy();
  }
}
