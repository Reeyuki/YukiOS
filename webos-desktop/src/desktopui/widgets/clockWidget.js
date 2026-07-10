import { WidgetBase } from "../widgetManager.js";

export class ClockWidget extends WidgetBase {
  constructor(manager, id) {
    super(manager, id, "clock", "Clock", 240, 130);
    this._24h = false;
    this.showSeconds = false;
    this.interval = null;
  }

  onRender(contentEl) {
    contentEl.innerHTML = `
      <div class="widget-clock-time" id="w-clock-time-${this.id}"></div>
      <div class="widget-clock-date" id="w-clock-date-${this.id}"></div>
    `;
    this.tick();
    this.interval = setInterval(() => this.tick(), 1000);
  }

  tick() {
    const now = new Date();
    let hours = now.getHours();
    let minutes = now.getMinutes().toString().padStart(2, "0");
    let seconds = now.getSeconds().toString().padStart(2, "0");
    let ampm = "";
    if (!this._24h) {
      ampm = hours >= 12 ? " PM" : " AM";
      hours = hours % 12 || 12;
    }
    const timeStr = `${hours.toString().padStart(2, "0")}:${minutes}${this.showSeconds ? ":" + seconds : ""}${ampm}`;
    const timeEl = document.getElementById(`w-clock-time-${this.id}`);
    if (timeEl) timeEl.textContent = timeStr;

    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December"
    ];
    const dateStr = `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
    const dateEl = document.getElementById(`w-clock-date-${this.id}`);
    if (dateEl) dateEl.textContent = dateStr;
  }

  getConfigFields() {
    return [
      {
        key: "_24h",
        label: "24-hour format",
        type: "select",
        value: this._24h,
        default: false,
        options: [
          { value: "true", label: "24-hour" },
          { value: "false", label: "12-hour" }
        ]
      },
      {
        key: "showSeconds",
        label: "Show seconds",
        type: "select",
        value: this.showSeconds,
        default: false,
        options: [
          { value: "true", label: "Yes" },
          { value: "false", label: "No" }
        ]
      }
    ];
  }

  applyConfig(data) {
    this._24h = data._24h === "true";
    this.showSeconds = data.showSeconds === "true";
    this.tick();
    this.manager.saveState();
  }

  getData() {
    return { _24h: this._24h, showSeconds: this.showSeconds };
  }

  setData(data) {
    if (data) {
      this._24h = !!data._24h;
      this.showSeconds = !!data.showSeconds;
    }
  }

  destroy() {
    if (this.interval) clearInterval(this.interval);
    super.destroy();
  }
}
