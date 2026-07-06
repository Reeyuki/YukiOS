import { WidgetBase } from "../widgetManager.js";

export class TimerWidget extends WidgetBase {
  constructor(manager, id) {
    super(manager, id, "timer", "Timer", 220, 160);
    this._mode = "timer";
    this._time = 300;
    this._remaining = 300;
    this._elapsed = 0;
    this._running = false;
    this._interval = null;
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
      this._toggleTimer(contentEl);
    });

    contentEl.querySelector(`#w-timer-reset-${this.id}`).addEventListener("click", () => {
      this._reset(contentEl);
    });

    contentEl.querySelector(`#w-timer-mode-${this.id}`).addEventListener("click", () => {
      this._toggleMode(contentEl);
    });

    contentEl.querySelector(`#w-timer-inc-${this.id}`).addEventListener("click", () => {
      if (!this._running) {
        this._time = Math.min(this._time + 60, 5940);
        this._remaining = this._time;
        this._updateDisplay(contentEl);
      }
    });

    contentEl.querySelector(`#w-timer-dec-${this.id}`).addEventListener("click", () => {
      if (!this._running && this._time >= 60) {
        this._time = Math.max(this._time - 60, 60);
        this._remaining = this._time;
        this._updateDisplay(contentEl);
      }
    });

    this._updateDisplay(contentEl);
  }

  getConfigFields() {
    return [
      {
        key: "defaultMinutes",
        label: "Default minutes",
        type: "number",
        value: Math.floor(this._time / 60),
        default: 5
      }
    ];
  }

  applyConfig(data) {
    const mins = parseInt(data.defaultMinutes) || 5;
    this._time = mins * 60;
    this._remaining = this._time;
    if (this._contentEl) this._updateDisplay(this._contentEl);
    this.manager.saveState();
  }

  _toggleTimer(ce) {
    this._running = !this._running;
    const btn = ce.querySelector(`#w-timer-start-${this.id}`);
    if (btn) btn.textContent = this._running ? "Pause" : "Start";

    if (this._running) {
      this._interval = setInterval(() => this._tick(ce), 1000);
    } else {
      clearInterval(this._interval);
    }
  }

  _tick(ce) {
    if (this._mode === "timer") {
      this._remaining--;
      if (this._remaining <= 0) {
        this._running = false;
        clearInterval(this._interval);
        this._remaining = 0;
        const btn = ce.querySelector(`#w-timer-start-${this.id}`);
        if (btn) btn.textContent = "Start";
      }
    } else {
      this._elapsed++;
    }
    this._updateDisplay(ce);
  }

  _reset(ce) {
    this._running = false;
    clearInterval(this._interval);
    this._remaining = this._time;
    this._elapsed = 0;
    const btn = ce.querySelector(`#w-timer-start-${this.id}`);
    if (btn) btn.textContent = "Start";
    this._updateDisplay(ce);
  }

  _toggleMode(ce) {
    this._mode = this._mode === "timer" ? "stopwatch" : "timer";
    this._reset(ce);
  }

  _updateDisplay(ce) {
    if (!ce) ce = this._contentEl;
    const displayEl = ce.querySelector(`#w-timer-display-${this.id}`);
    if (!displayEl) return;

    const seconds = this._mode === "timer" ? this._remaining : this._elapsed;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    displayEl.textContent = `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;

    const minDisplay = ce.querySelector(`#w-timer-min-display-${this.id}`);
    if (minDisplay && this._mode === "timer") {
      minDisplay.textContent = Math.floor(this._time / 60);
    }
  }

  getData() {
    return { time: this._time, mode: this._mode };
  }

  setData(data) {
    if (data) {
      this._time = data.time || 300;
      this._mode = data.mode || "timer";
      this._remaining = this._time;
    }
  }

  destroy() {
    if (this._interval) clearInterval(this._interval);
    super.destroy();
  }
}
