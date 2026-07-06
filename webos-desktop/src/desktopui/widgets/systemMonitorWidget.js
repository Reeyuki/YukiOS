import { WidgetBase } from "../widgetManager.js";
import { os } from "../../framework.js";
import { StorageKeys } from "../../StorageKeys.js";
import { getAppRegistry } from "../../appRegistry.js";

const ACHIEVEMENT_TOTAL = 25;

export class SystemMonitorWidget extends WidgetBase {
  constructor(manager, id) {
    super(manager, id, "systemmonitor", "System Monitor", 240, 220);
    this._interval = null;
  }

  onRender(contentEl) {
    contentEl.innerHTML = `
      <div class="widget-sysmon-row">
        <span class="widget-sysmon-label">Storage:</span>
        <span class="widget-sysmon-value" id="w-sys-storage-${this.id}">--</span>
      </div>
      <div class="widget-sysmon-row">
        <span class="widget-sysmon-label">Uptime:</span>
        <span class="widget-sysmon-value" id="w-sys-uptime-${this.id}">--</span>
      </div>
      <div class="widget-sysmon-row">
        <span class="widget-sysmon-label">Achievements:</span>
        <span class="widget-sysmon-value" id="w-sys-achievements-${this.id}">--</span>
      </div>
      <div class="widget-sysmon-row">
        <span class="widget-sysmon-label">Memory:</span>
        <span class="widget-sysmon-value" id="w-sys-memory-${this.id}">--</span>
      </div>
      <div class="widget-sysmon-row">
        <span class="widget-sysmon-label">CPU Cores:</span>
        <span class="widget-sysmon-value" id="w-sys-cpu-${this.id}">--</span>
      </div>
      <div class="widget-sysmon-row">
        <span class="widget-sysmon-label">Apps:</span>
        <span class="widget-sysmon-value" id="w-sys-apps-${this.id}">--</span>
      </div>
    `;
    this._update();
    this._interval = setInterval(() => this._update(), 5000);
  }

  async _update() {
    const ce = this._contentEl;

    const storageEl = ce.querySelector(`#w-sys-storage-${this.id}`);
    const uptimeEl = ce.querySelector(`#w-sys-uptime-${this.id}`);
    const achievementsEl = ce.querySelector(`#w-sys-achievements-${this.id}`);
    const memoryEl = ce.querySelector(`#w-sys-memory-${this.id}`);
    const cpuEl = ce.querySelector(`#w-sys-cpu-${this.id}`);
    const appsEl = ce.querySelector(`#w-sys-apps-${this.id}`);

    if (storageEl) {
      try {
        if (navigator.storage && navigator.storage.estimate) {
          const estimate = await navigator.storage.estimate();
          const usedMB = (estimate.usage / 1024 / 1024).toFixed(1);
          const quotaMB = (estimate.quota / 1024 / 1024).toFixed(0);
          const percent = ((estimate.usage / estimate.quota) * 100).toFixed(1);
          storageEl.textContent = `${usedMB}MB / ${quotaMB}MB (${percent}%)`;
        } else {
          storageEl.textContent = "N/A";
        }
      } catch {
        storageEl.textContent = "Error";
      }
    }

    if (uptimeEl) {
      const launchTime = os.storage.get(StorageKeys.lastLaunchTime) || Date.now();
      const uptime = Date.now() - launchTime;
      const hours = Math.floor(uptime / 3600000);
      const minutes = Math.floor((uptime % 3600000) / 60000);
      uptimeEl.textContent = `${hours}h ${minutes}m`;
    }

    if (achievementsEl) {
      const saved = os.storage.get(StorageKeys.achievementKeys);
      const unlocked = Array.isArray(saved) ? saved.length : 0;
      const pct = Math.round((unlocked / ACHIEVEMENT_TOTAL) * 100);
      achievementsEl.textContent = `${unlocked}/${ACHIEVEMENT_TOTAL} (${pct}%)`;
    }

    if (memoryEl) {
      try {
        const mem = performance.memory;
        if (mem && mem.usedJSHeapSize !== undefined) {
          const usedMB = (mem.usedJSHeapSize / 1024 / 1024).toFixed(0);
          const totalMB = (mem.jsHeapSizeLimit / 1024 / 1024).toFixed(0);
          memoryEl.textContent = `${usedMB}MB / ${totalMB}MB`;
        } else {
          memoryEl.textContent = "N/A";
        }
      } catch {
        memoryEl.textContent = "Error";
      }
    }

    if (cpuEl) {
      cpuEl.textContent = `${navigator.hardwareConcurrency || "?"} cores`;
    }

    if (appsEl) {
      try {
        const appMap = os.app.getAllApps();
        const registry = getAppRegistry();
        const allApps = registry.getAllApps(appMap);
        const installed = allApps.filter((a) => !a.uninstalled);
        const enabled = installed.filter((a) => !a.disabled);
        appsEl.textContent = `${enabled.length} / ${installed.length}`;
      } catch {
        appsEl.textContent = "--";
      }
    }
  }

  destroy() {
    if (this._interval) clearInterval(this._interval);
    super.destroy();
  }
}
