import "../styles/tilingBar.css";
import { StorageKeys, os } from "../framework.js";
import { parseBool } from "../shared/boolUtils.js";
import { TilingRofi } from "./TilingRofi.js";
import { TilingKeybindOverlay } from "./TilingKeybindOverlay.js";
import { trayManager } from "../tray/tray.js";
import { BusEvents } from "../core/EventBus.js";
import { audioMixer } from "../audioMixer.js";
import { turboManager } from "../shared/turboManager.js";
import { subscribeTimeTick } from "../services/timeWorker.js";

const CLOCK_INTERVAL = 10000;
const VOLUME_POLL = 500;
const NOW_PLAYING_POLL = 1000;
const SYS_MONITOR_POLL = 3000;
const TURBO_MODES = ["turbo", "balanced", "high"];

export class TilingBar {
  constructor(tilingManager) {
    this.tilingManager = tilingManager;
    this.el = null;
    this.rofi = new TilingRofi(this);
    this.keybindOverlay = new TilingKeybindOverlay(this);
    this.clockInterval = null;
    this.clockEl = null;
    this.nowPlayingEl = null;
    this.systemEl = null;
    this.pillsContainer = null;
    this.trayContainer = null;
    this.rofiTrigger = null;

    this.batteryData = { level: 100, charging: true };
    this.batteryApi = null;
    this.volumePollId = null;
    this.nowPlayingId = null;
    this.sysMonId = null;
    this.calendarPopup = null;
    this.calendarVisible = false;
    this.timeTickUnsub = null;
    this.calendarState = { year: 0, month: 0 };

    this.clock24h = parseBool(os.storage.get(StorageKeys.tilingClock24h));
    this.sysMode = "both";
  }

  init() {
    this.rofi.init();
    this.createDOM();
    this.applySettings();
    this.listenEvents();
    this.initBattery();
    this.initNetwork();
  }

  createDOM() {
    this.el = document.createElement("div");
    this.el.id = "tiling-bar";
    this.el.innerHTML = `
      <div class="tiling-bar-section tiling-bar-left">
        <button class="tiling-rofi-trigger" id="tiling-rofi-trigger" title="Search (Alt+D, Tab to switch modes)">
          <i class="fas fa-search"></i>
        </button>
        <div class="tiling-ws-pills" id="tiling-ws-pills"></div>
        <button class="tiling-keybind-hint" id="tiling-keybind-hint" title="Tiling keyboard shortcuts">
          <i class="fas fa-question"></i>
        </button>
      </div>
      <div class="tiling-bar-section tiling-bar-right">
        <div class="tiling-tray-dedicated" id="tiling-tray-audio" data-module="audio"></div>
        <div class="tiling-tray-dedicated" id="tiling-tray-network" data-module="network"></div>
        <div class="tiling-tray-dedicated" id="tiling-tray-power" data-module="power"></div>
        <div class="tiling-tray-dedicated" id="tiling-tray-system" data-module="system"></div>
        <div class="tiling-now-playing" id="tiling-now-playing"></div>
        <div class="tiling-bar-clock" id="tiling-bar-clock"></div>
        <div class="tiling-tray-items" id="tiling-tray-items"></div>
      </div>
    `;

    this.rofiTrigger = this.el.querySelector("#tiling-rofi-trigger");
    this.hintBtn = this.el.querySelector("#tiling-keybind-hint");
    this.pillsContainer = this.el.querySelector("#tiling-ws-pills");
    this.trayContainer = this.el.querySelector("#tiling-tray-items");
    this.clockEl = this.el.querySelector("#tiling-bar-clock");
    this.nowPlayingEl = this.el.querySelector("#tiling-now-playing");
    this.systemEl = this.el.querySelector("#tiling-tray-system");
    const audioEl = this.el.querySelector("#tiling-tray-audio");
    const powerEl = this.el.querySelector("#tiling-tray-power");
    const networkEl = this.el.querySelector("#tiling-tray-network");

    this.updateClock();
    this.renderPills();
    this.updateBattery();
    this.updateVolume();
    this.updateNetwork();

    if (this.trayContainer) {
      trayManager.addSecondaryContainer(this.trayContainer);
    }
    trayManager.render();
    this.stripDuplicatesFromTray();

    this.rofiTrigger.addEventListener("click", () => this.rofi.toggle());

    if (this.hintBtn) {
      if (parseBool(os.storage.get(StorageKeys.tilingKeybindHintHidden))) {
        this.hintBtn.style.display = "none";
      } else {
        this.hintBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.keybindOverlay.toggle();
        });
      }
    }

    if (this.clockEl) {
      this.clockEl.style.cursor = "pointer";
      this.clockEl.addEventListener("click", (e) => {
        e.stopPropagation();
        this.toggleCalendar();
      });
      this.clockEl.addEventListener(
        "wheel",
        (e) => {
          e.preventDefault();
          this.clock24h = !this.clock24h;
          os.storage.set(StorageKeys.tilingClock24h, this.clock24h ? "true" : "false");
          this.updateClock();
        },
        { passive: false }
      );
    }

    if (powerEl) {
      powerEl.addEventListener("click", (e) => {
        e.stopPropagation();
        trayManager.handleTrayClick("display-performance-window");
      });
      powerEl.addEventListener(
        "wheel",
        (e) => {
          e.preventDefault();
          const cur = turboManager.getMode();
          const idx = TURBO_MODES.indexOf(cur);
          const next = TURBO_MODES[(idx + 1) % TURBO_MODES.length];
          turboManager.setMode(next);
        },
        { passive: false }
      );
    }

    if (audioEl) {
      audioEl.addEventListener("click", (e) => {
        e.stopPropagation();
        audioMixer().toggle();
      });
      audioEl.addEventListener(
        "wheel",
        (e) => {
          e.preventDefault();
          const mx = audioMixer();
          const delta = e.deltaY > 0 ? -0.05 : 0.05;
          mx.setMaster(Math.max(0, Math.min(1, mx.masterVolume + delta)));
        },
        { passive: false }
      );
    }

    if (networkEl) {
      networkEl.addEventListener("click", (e) => {
        e.stopPropagation();
        trayManager.handleTrayClick("network-tray-window");
      });
    }

    if (this.systemEl) {
      this.systemEl.style.cursor = "pointer";
      this.systemEl.addEventListener("click", (e) => {
        e.stopPropagation();
        const modes = ["both", "cpu", "ram"];
        const idx = modes.indexOf(this.sysMode);
        this.sysMode = modes[(idx + 1) % modes.length];
        this.updateSystemMonitor();
      });
    }

    document.body.appendChild(this.el);
  }

  applySettings() {
    const position = os.storage.get(StorageKeys.tilingBarPosition) || "top";
    const height = Number(os.storage.get(StorageKeys.tilingBarHeight)) || 38;
    this.el.classList.toggle("position-bottom", position === "bottom");
    this.el.style.setProperty("--tiling-bar-height", `${height}px`);

    const showClock = parseBool(os.storage.get(StorageKeys.tilingBarShowClock), true);
    const showWorkspace = parseBool(os.storage.get(StorageKeys.tilingBarShowWorkspace), true);
    const showTray = parseBool(os.storage.get(StorageKeys.tilingBarShowTray), true);

    this.clockEl.style.display = showClock ? "flex" : "none";
    this.pillsContainer.style.display = showWorkspace ? "flex" : "none";
    this.trayContainer.style.display = showTray ? "flex" : "none";
  }

  listenEvents() {
    os.events.on(BusEvents.TILING_MODE_CHANGED, ({ enabled }) => {
      enabled ? this.show() : this.hide();
    });
    os.events.on(BusEvents.WORKSPACE_SWITCHED, () => this.renderPills());
    os.events.on(BusEvents.WORKSPACE_ADDED, () => this.renderPills());
    os.events.on(BusEvents.WORKSPACE_REMOVED, () => this.renderPills());
    os.events.on(BusEvents.SETTINGS_CHANGED, () => {
      this.applySettings();
      trayManager.render();
      this.stripDuplicatesFromTray();
    });
    os.events.on(BusEvents.SETTINGS_CHANGED, ({ key }) => {
      if (key === "turboMode") this.updateBattery();
    });
  }

  show() {
    const barEnabled = os.storage.get(StorageKeys.tilingBarEnabled);
    if (barEnabled === "false") {
      this.el.style.display = "none";
      return;
    }
    this.el.style.display = "flex";
    this.applySettings();
    this.renderPills();
    this.startClock();
    this.startVolumePoll();
    this.startNowPlayingPoll();
    this.startSystemMonitor();
    trayManager.render();
    this.stripDuplicatesFromTray();
  }

  stripDuplicatesFromTray() {
    const dedicated = ["audio-mixer", "network-tray-window", "display-performance-window"];
    if (!this.trayContainer) return;
    const btns = this.trayContainer.querySelectorAll("[data-win-id]");
    btns.forEach((btn) => {
      if (dedicated.includes(btn.dataset.winId)) {
        btn.remove();
      }
    });
    if (this.trayContainer.children.length === 0) {
      this.trayContainer.style.display = "none";
    }
  }

  hideKeybindHint() {
    if (this.hintBtn) {
      this.hintBtn.style.display = "none";
    }
  }

  hide() {
    this.el.style.display = "none";
    this.stopClock();
    this.stopVolumePoll();
    this.stopNowPlayingPoll();
    this.stopSystemMonitor();
    this.closeCalendar();
    if (this.rofi.isOpen) this.rofi.close();
    if (this.keybindOverlay.isOpen) this.keybindOverlay.close();
    trayManager.render();
  }

  startClock() {
    this.updateClock();
    this.stopClock();
    this.clockInterval = setInterval(() => this.updateClock(), CLOCK_INTERVAL);
  }

  stopClock() {
    if (this.clockInterval) {
      clearInterval(this.clockInterval);
      this.clockInterval = null;
    }
  }

  updateClock() {
    if (!this.clockEl) return;
    const now = new Date();
    const opts = this.clock24h
      ? { hour: "2-digit", minute: "2-digit", hour12: false }
      : { hour: "numeric", minute: "2-digit" };
    this.clockEl.innerHTML = `
      <span class="tiling-clock-time">${now.toLocaleTimeString([], opts)}</span>
      <span class="tiling-clock-date">${now.toLocaleDateString([], { month: "short", day: "numeric" })}</span>
    `;
    this.clockEl.title = now.toLocaleString([], {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  }

  toggleCalendar() {
    this.calendarVisible ? this.closeCalendar() : this.openCalendar();
  }

  openCalendar() {
    const now = new Date();
    this.calendarState = { year: now.getFullYear(), month: now.getMonth() };

    if (this.calendarPopup) {
      this.calendarPopup.style.display = "flex";
      this.calendarVisible = true;
      this.renderCalendarMonth();
      return;
    }

    this.calendarPopup = document.createElement("div");
    this.calendarPopup.className = "tiling-calendar-popup";
    const pos = os.storage.get(StorageKeys.tilingBarPosition) || "top";
    if (pos === "bottom") this.calendarPopup.classList.add("position-bottom");

    this.renderCalendarMonth();
    document.body.appendChild(this.calendarPopup);
    this.calendarVisible = true;

    setTimeout(() => {
      const close = (e) => {
        if (!this.calendarPopup.contains(e.target) && e.target !== this.clockEl && !this.clockEl.contains(e.target)) {
          this.closeCalendar();
          document.removeEventListener("click", close);
        }
      };
      document.addEventListener("click", close);
    }, 0);

    if (this.timeTickUnsub) this.timeTickUnsub();
    this.timeTickUnsub = subscribeTimeTick((data) => {
      const el = this.calendarPopup?.querySelector(".tiling-cal-time");
      if (el) el.textContent = data.timeStr;
    });
  }

  closeCalendar() {
    if (this.calendarPopup) this.calendarPopup.style.display = "none";
    this.calendarVisible = false;
    if (this.timeTickUnsub) {
      this.timeTickUnsub();
      this.timeTickUnsub = null;
    }
  }

  renderCalendarMonth() {
    if (!this.calendarPopup) return;
    const { year, month } = this.calendarState;
    const today = new Date();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDow = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    const monthNames = [
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

    let html = "";
    for (let i = 0; i < startDow; i++) html += `<div class="tiling-cal-day empty"></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
      html += `<div class="tiling-cal-day${isToday ? " today" : ""}">${d}</div>`;
    }

    this.calendarPopup.innerHTML = `
      <div class="tiling-cal-header">
        <button class="tiling-cal-nav" data-action="prev"><i class="fas fa-chevron-left"></i></button>
        <span class="tiling-cal-title">${monthNames[month]} ${year}</span>
        <button class="tiling-cal-nav" data-action="next"><i class="fas fa-chevron-right"></i></button>
      </div>
      <div class="tiling-cal-weekdays">
        <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
      </div>
      <div class="tiling-cal-days">${html}</div>
      <div class="tiling-cal-footer">
        <button class="tiling-cal-today">Today</button>
        <span class="tiling-cal-time"></span>
      </div>
    `;

    this.calendarPopup.querySelector("[data-action=prev]").addEventListener("click", () => {
      this.calendarState.month--;
      if (this.calendarState.month < 0) {
        this.calendarState.month = 11;
        this.calendarState.year--;
      }
      this.renderCalendarMonth();
    });
    this.calendarPopup.querySelector("[data-action=next]").addEventListener("click", () => {
      this.calendarState.month++;
      if (this.calendarState.month > 11) {
        this.calendarState.month = 0;
        this.calendarState.year++;
      }
      this.renderCalendarMonth();
    });
    this.calendarPopup.querySelector(".tiling-cal-today").addEventListener("click", () => {
      this.calendarState.year = today.getFullYear();
      this.calendarState.month = today.getMonth();
      this.renderCalendarMonth();
    });
  }

  async initBattery() {
    if (!("getBattery" in navigator)) return;
    try {
      const b = await navigator.getBattery();
      this.batteryApi = b;
      this.batteryData = { level: Math.round(b.level * 100), charging: b.charging };
      this.updateBattery();
      b.addEventListener("levelchange", () => {
        this.batteryData.level = Math.round(b.level * 100);
        this.updateBattery();
      });
      b.addEventListener("chargingchange", () => {
        this.batteryData.charging = b.charging;
        this.updateBattery();
      });
    } catch {
      // Battery API unavailable
    }
  }

  updateBattery() {
    const el = this.el?.querySelector("#tiling-tray-power");
    if (!el) return;
    const { level, charging } = this.batteryData;

    let icon = "fa-battery-full";
    if (level > 90) icon = "fa-battery-full";
    else if (level > 65) icon = "fa-battery-three-quarters";
    else if (level > 35) icon = "fa-battery-half";
    else if (level > 10) icon = "fa-battery-quarter";
    else icon = "fa-battery-empty";

    el.innerHTML = `<i class="fas fa-bolt charging-icon" style="font-size:10px;display:${charging ? "inline" : "none"}"></i>
      <i class="fas ${icon}" style="font-size:12px"></i>
      <span style="margin-left:3px;font-size:11px;font-weight:500">${level}%</span>`;

    el.className = "tiling-tray-dedicated power";
    if (charging) el.classList.add("charging");
    if (level <= 15) el.classList.add("critical");
    else if (level <= 30) el.classList.add("warning");

    const status = charging ? "Charging" : level <= 15 ? "Low Battery" : level <= 30 ? "Warning" : "On Battery";
    el.title = `Battery: ${level}% (${status})`;
  }

  startVolumePoll() {
    this.stopVolumePoll();
    this.updateVolume();
    this.volumePollId = setInterval(() => this.updateVolume(), VOLUME_POLL);
  }

  stopVolumePoll() {
    if (this.volumePollId) {
      clearInterval(this.volumePollId);
      this.volumePollId = null;
    }
  }

  updateVolume() {
    const el = this.el?.querySelector("#tiling-tray-audio");
    if (!el) return;
    const mx = audioMixer();
    const vol = mx.muted ? 0 : Math.round(mx.masterVolume * 100);

    let icon;
    if (mx.muted || vol === 0) icon = "fa-volume-xmark";
    else if (vol < 33) icon = "fa-volume-off";
    else if (vol < 66) icon = "fa-volume-low";
    else icon = "fa-volume-high";

    el.innerHTML = `<i class="fas ${icon}" style="font-size:12px"></i>
      <span style="margin-left:3px;font-size:11px;font-weight:500">${mx.muted ? "M" : vol + "%"}</span>`;

    el.className = "tiling-tray-dedicated audio";
    if (mx.muted || vol === 0) el.classList.add("muted", "off");
    else if (vol < 33) el.classList.add("low");
    else el.classList.add("high");

    el.title = mx.muted ? "Volume: Muted" : `Volume: ${vol}%`;
  }

  initNetwork() {
    this.updateNetwork();
    window.addEventListener("online", () => this.updateNetwork());
    window.addEventListener("offline", () => this.updateNetwork());
  }

  updateNetwork() {
    const el = this.el?.querySelector("#tiling-tray-network");
    if (!el) return;
    const online = navigator.onLine;
    el.innerHTML = `<i class="fas ${online ? "fa-wifi" : "fa-wifi-slash"}" style="font-size:12px"></i>`;
    el.className = "tiling-tray-dedicated network";
    if (!online) el.classList.add("disconnected");
    el.title = online ? "Network: Online" : "Network: Offline";
  }

  startNowPlayingPoll() {
    this.stopNowPlayingPoll();
    this.updateNowPlaying();
    this.nowPlayingId = setInterval(() => this.updateNowPlaying(), NOW_PLAYING_POLL);
  }

  stopNowPlayingPoll() {
    if (this.nowPlayingId) {
      clearInterval(this.nowPlayingId);
      this.nowPlayingId = null;
    }
  }

  updateNowPlaying() {
    if (!this.nowPlayingEl) return;
    const mx = audioMixer();
    let track = null;
    mx.channels.forEach((ch) => {
      if (ch.nowPlaying && ch.nowPlaying.playbackState === "playing") {
        track = ch.nowPlaying;
      }
    });

    if (track && track.track) {
      const label = track.artist ? `${track.track} – ${track.artist}` : track.track;
      this.nowPlayingEl.textContent = `♫ ${label}`;
      this.nowPlayingEl.className = "tiling-now-playing active";
      this.nowPlayingEl.title = label;
    } else {
      this.nowPlayingEl.className = "tiling-now-playing";
      this.nowPlayingEl.textContent = "";
    }
  }

  startSystemMonitor() {
    this.stopSystemMonitor();
    this.updateSystemMonitor();
    this.sysMonId = setInterval(() => this.updateSystemMonitor(), SYS_MONITOR_POLL);
  }

  stopSystemMonitor() {
    if (this.sysMonId) {
      clearInterval(this.sysMonId);
      this.sysMonId = null;
    }
  }

  updateSystemMonitor() {
    if (!this.systemEl) return;
    let mem;
    try {
      mem = performance.memory;
    } catch {
      mem = null;
    }
    const cores = navigator.hardwareConcurrency;

    this.systemEl.style.display = "flex";
    const mode = this.sysMode;
    let html = `<i class="fas fa-microchip" style="font-size:11px"></i>`;
    const titleParts = [];
    const showCpu = mode === "both" || mode === "cpu";
    const showRam = mode === "both" || mode === "ram";

    if (showCpu && cores) {
      html += `<span style="font-size:11px;font-weight:500;margin-left:3px">${cores}</span>`;
      titleParts.push(`${cores} cores`);
    }
    if (showRam && mem) {
      const used = (mem.usedJSHeapSize / 1024 / 1024 / 1024).toFixed(1);
      const total = (mem.jsHeapSizeLimit / 1024 / 1024 / 1024).toFixed(1);
      html += `<i class="fas fa-memory" style="font-size:11px;margin-left:5px"></i><span style="font-size:11px;font-weight:500;margin-left:3px">${used}G</span>`;
      titleParts.push(`RAM: ${used}G / ${total}G`);
    }
    this.systemEl.innerHTML = html;
    this.systemEl.title =
      (titleParts.length ? titleParts.join(" | ") + " · " : "System · ") + "Click to toggle CPU/RAM";
  }

  renderPills() {
    if (!this.pillsContainer) return;
    const wm = this.tilingManager.wm;
    const wsManager = wm.workspaceManager;
    if (!wsManager) return;

    const workspaces = wsManager.workspaces || [];
    const activeId = wsManager.activeId;

    this.pillsContainer.innerHTML = "";
    workspaces.forEach((ws, idx) => {
      const pill = document.createElement("button");
      pill.className = "tiling-ws-pill" + (ws.id === activeId ? " active" : "");
      pill.textContent = String(idx + 1);
      pill.title = ws.name || `Workspace ${idx + 1}`;
      pill.addEventListener("click", () => wsManager.switchTo(ws.id));
      this.pillsContainer.appendChild(pill);
    });
  }

  getHeight() {
    if (os.storage.get(StorageKeys.tilingBarEnabled) === "false") return 0;
    if ((os.storage.get(StorageKeys.tilingBarPosition) || "top") !== "top") return 0;
    if (this.el && this.el.style.display !== "none") {
      return Number(os.storage.get(StorageKeys.tilingBarHeight)) || 38;
    }
    return 0;
  }

  getBottomHeight() {
    if (os.storage.get(StorageKeys.tilingBarEnabled) === "false") return 0;
    if ((os.storage.get(StorageKeys.tilingBarPosition) || "bottom") !== "bottom") return 0;
    if (this.el && this.el.style.display !== "none") {
      return Number(os.storage.get(StorageKeys.tilingBarHeight)) || 38;
    }
    return 0;
  }

  destroy() {
    this.stopClock();
    this.stopVolumePoll();
    this.stopNowPlayingPoll();
    this.stopSystemMonitor();
    this.closeCalendar();
    this.keybindOverlay.destroy();
    if (this.el && this.el.parentNode) {
      this.el.parentNode.removeChild(this.el);
    }
  }
}
