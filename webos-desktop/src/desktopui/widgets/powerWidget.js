import { WidgetBase } from "../widgetManager.js";

export class PowerWidget extends WidgetBase {
  constructor(manager, id) {
    super(manager, id, "battery", "Battery", 200, 180);
    this.interval = null;
  }

  onRender(contentEl) {
    contentEl.innerHTML = `
      <div class="widget-battery-container">
        <div class="battery">
          <div class="battery-fill" id="battery-fill-${this.id}"></div>
          <div class="battery-percent" id="battery-percent-${this.id}">
            --%
          </div>
        </div>
      </div>
    `;

    this.update();
    this.interval = setInterval(() => this.update(), 5000);
  }

  async update() {
    const fill = document.getElementById(`battery-fill-${this.id}`);
    const percent = document.getElementById(`battery-percent-${this.id}`);

    if (!fill || !percent) return;

    if (!navigator.getBattery) {
      percent.textContent = "N/A";
      fill.style.width = "0%";
      return;
    }

    try {
      const battery = await navigator.getBattery();

      const level = Math.round(battery.level * 100);

      percent.textContent = `${level}%`;

      fill.style.width = `${level}%`;

      let color;

      if (level > 60) {
        color = "#22c55e"; // green
      } else if (level > 30) {
        color = "#facc15"; // yellow
      } else {
        color = "#ef4444"; // red
      }

      fill.style.background = color;
    } catch {
      percent.textContent = "N/A";
      fill.style.width = "0%";
    }
  }

  destroy() {
    if (this.interval) clearInterval(this.interval);
    super.destroy();
  }
}
