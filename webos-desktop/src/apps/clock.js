import "../styles/clock.css";
import { BaseApp, os, StorageKeys } from "../framework.js";

import { renderSelectMenu, getSelectMenuValue, bindSelectMenu } from "../shared/selectMenu.js";

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function formatTime(ms, showMs = false) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const millis = ms % 1000;
  const h = String(hours).padStart(2, "0");
  const m = String(minutes).padStart(2, "0");
  const s = String(seconds).padStart(2, "0");
  if (showMs) {
    const msStr = String(millis).padStart(3, "0").slice(0, 2);
    return `${h}:${m}:${s}.${msStr}`;
  }
  return `${h}:${m}:${s}`;
}

const WORKER_CODE = `
let offscreen, ctx;
let timeOffset = 0;
let use24h = true;
let analogActive = false;
let width = 300, height = 300, dpr = 1;
let tickTimer = null;

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function fmtTime(d) {
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2,'0');
  const s = String(d.getSeconds()).padStart(2,'0');
  if (!use24h) {
    const ampm = h >= 12 ? ' PM' : ' AM';
    h = h % 12 || 12;
    return String(h).padStart(2,'0') + ':' + m + ':' + s + ampm;
  }
  return String(h).padStart(2,'0') + ':' + m + ':' + s;
}

function fmtDate(d) {
  return DAYS[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
}

let lastSec = -1;

function drawAnalog(d) {
  const size = width * dpr;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 20 * dpr;

  ctx.clearRect(0, 0, size, size);

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = '#1a1a22';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 2 * dpr;
  ctx.stroke();

  for (let i = 0; i < 12; i++) {
    const a = (i * 30 - 90) * Math.PI / 180;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r * 0.85, cy + Math.sin(a) * r * 0.85);
    ctx.lineTo(cx + Math.cos(a) * r * 0.93, cy + Math.sin(a) * r * 0.93);
    ctx.strokeStyle = '#eee';
    ctx.lineWidth = (i % 3 === 0 ? 3 : 1.5) * dpr;
    ctx.stroke();
  }

  for (let i = 0; i < 60; i++) {
    if (i % 5 === 0) continue;
    const a = (i * 6 - 90) * Math.PI / 180;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r * 0.92, cy + Math.sin(a) * r * 0.92);
    ctx.lineTo(cx + Math.cos(a) * r * 0.95, cy + Math.sin(a) * r * 0.95);
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1 * dpr;
    ctx.stroke();
  }

  const hours = d.getHours() % 12;
  const minutes = d.getMinutes();
  const seconds = d.getSeconds();
  const ms = d.getMilliseconds();

  const secA = ((seconds + ms / 1000) * 6 - 90) * Math.PI / 180;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(secA) * r * 0.85, cy + Math.sin(secA) * r * 0.85);
  ctx.strokeStyle = '#7c5cfc';
  ctx.lineWidth = 2 * dpr;
  ctx.stroke();

  const minA = ((minutes + seconds / 60) * 6 - 90) * Math.PI / 180;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(minA) * r * 0.7, cy + Math.sin(minA) * r * 0.7);
  ctx.strokeStyle = '#eee';
  ctx.lineWidth = 4 * dpr;
  ctx.stroke();

  const hourA = ((hours + minutes / 60) * 30 - 90) * Math.PI / 180;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(hourA) * r * 0.5, cy + Math.sin(hourA) * r * 0.5);
  ctx.strokeStyle = '#eee';
  ctx.lineWidth = 6 * dpr;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, 4 * dpr, 0, Math.PI * 2);
  ctx.fillStyle = '#eee';
  ctx.fill();

  const bitmap = offscreen.transferToImageBitmap();
  self.postMessage({ type: 'frame', bitmap, width: width * dpr, height: height * dpr }, [bitmap]);
}

function tick() {
  const now = Date.now() + timeOffset;
  const d = new Date(now);
  const sec = d.getSeconds();

  if (sec !== lastSec) {
    lastSec = sec;
    self.postMessage({
      type: 'time',
      timeStr: fmtTime(d),
      dateStr: fmtDate(d),
      hours: d.getHours(),
      minutes: d.getMinutes(),
      seconds: sec
    });
  }

  if (analogActive && ctx && offscreen) {
    drawAnalog(d);
  }

  tickTimer = setTimeout(tick, 50);
}

self.onmessage = function(e) {
  const msg = e.data;
  switch (msg.type) {
    case 'init':
      timeOffset = msg.timeOffset || 0;
      use24h = msg.use24h !== false;
      dpr = msg.dpr || 1;
      width = msg.width || 300;
      height = msg.height || 300;
      offscreen = new OffscreenCanvas(width * dpr, height * dpr);
      ctx = offscreen.getContext('2d');
      lastSec = -1;
      if (tickTimer) clearTimeout(tickTimer);
      tick();
      break;
    case 'settings':
      if (msg.use24h !== undefined) use24h = msg.use24h;
      if (msg.timeOffset !== undefined) timeOffset = msg.timeOffset;
      if (msg.dpr !== undefined) {
        dpr = msg.dpr;
        if (offscreen) {
          offscreen.width = width * dpr;
          offscreen.height = height * dpr;
          ctx = offscreen.getContext('2d');
        }
      }
      break;
    case 'analogActive':
      analogActive = msg.active;
      break;
    case 'resize':
      width = msg.width || 300;
      height = msg.height || 300;
      if (offscreen) {
        offscreen.width = width * dpr;
        offscreen.height = height * dpr;
        ctx = offscreen.getContext('2d');
      }
      break;
  }
};
`;

function createWorker() {
  const blob = new Blob([WORKER_CODE], { type: "application/javascript" });
  return new Worker(URL.createObjectURL(blob));
}

export class ClockApp extends BaseApp {
  constructor(services) {
    super(services);
    this.win = null;
    this.activeTab = "digital";
    this.settings = this.loadSettings();
    this.alarms = this.loadAlarms();
    this.worker = null;
    this.timeOffset = 0;
    this.currentTimeStr = "--:--:--";
    this.currentDateStr = "---";
    this.analogActive = false;
    this.timerInterval = null;
    this.stopwatchInterval = null;
    this.timerRemaining = 0;
    this.timerRunning = false;
    this.stopwatchTime = 0;
    this.stopwatchRunning = false;
    this.stopwatchLaps = [];
    this.stopwatchStartTime = 0;
    this.timerStartTime = 0;
    this.timerInitial = 0;
    this.scheduledAlarms = new Map();
    this.checkAlarmInterval = null;
  }

  loadSettings() {
    const defaults = {
      use24h: true,
      snoozeDuration: 5,
      alarmSound: "classic"
    };
    const saved = os.storage.get(StorageKeys.clockSettings);
    return saved ? { ...defaults, ...saved } : defaults;
  }

  saveSettings() {
    os.storage.set(StorageKeys.clockSettings, this.settings);
  }

  loadAlarms() {
    const saved = os.storage.get(StorageKeys.clockAlarms);
    return saved || [];
  }

  saveAlarms() {
    os.storage.set(StorageKeys.clockAlarms, this.alarms);
    this.rescheduleAlarms();
  }

  rescheduleAlarms() {
    for (const timeoutId of this.scheduledAlarms.values()) {
      clearTimeout(timeoutId);
    }
    this.scheduledAlarms.clear();
    if (!this.win) return;
    for (const alarm of this.alarms) {
      if (!alarm.enabled) continue;
      this.scheduleAlarm(alarm);
    }
  }

  scheduleAlarm(alarm) {
    const now = new Date(Date.now() + this.timeOffset);
    const [h, m] = alarm.time.split(":").map(Number);
    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    const diff = target - now;
    const timeoutId = setTimeout(() => this.fireAlarm(alarm), diff);
    this.scheduledAlarms.set(alarm.id, timeoutId);
  }

  fireAlarm(alarm) {
    this.scheduledAlarms.delete(alarm.id);
    this.showAlarmDialog(alarm);
    if (alarm.recurring && alarm.recurring.length > 0) {
      this.scheduleAlarm(alarm);
    }
  }

  showAlarmDialog(alarm) {
    const overlay = document.createElement("div");
    overlay.className = "clock-alarm-overlay";
    overlay.innerHTML = `
      <div class="clock-alarm-dialog">
        <div class="clock-alarm-dialog-icon">🔔</div>
        <div class="clock-alarm-dialog-time">${alarm.time}</div>
        <div class="clock-alarm-dialog-label">${alarm.label || "Alarm"}</div>
        <div class="clock-alarm-dialog-buttons">
          <button class="clock-alarm-dialog-btn snooze">Snooze (${this.settings.snoozeDuration}m)</button>
          <button class="clock-alarm-dialog-btn dismiss">Dismiss</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const snoozeBtn = overlay.querySelector(".snooze");
    const dismissBtn = overlay.querySelector(".dismiss");
    snoozeBtn.onclick = () => {
      overlay.remove();
      const snoozeMs = this.settings.snoozeDuration * 60 * 1000;
      const timeoutId = setTimeout(() => this.fireAlarm(alarm), snoozeMs);
      this.scheduledAlarms.set(alarm.id + "snooze", timeoutId);
    };
    dismissBtn.onclick = () => {
      overlay.remove();
      if (alarm.recurring && alarm.recurring.length > 0) {
        this.scheduleAlarm(alarm);
      }
    };
    this.notify("Alarm", `${alarm.label || "Alarm"}: ${alarm.time}`, "info", 10000);
  }

  async open() {
    if (await this.isSingletonOpen("clock-app-window")) return;
    const win = os.window.create("clock-app-window", "Clock", "720px", "560px", {
      icon: "fas fa-clock",
      appId: "clock"
    });
    win.innerHTML = this.render();
    this.win = win;
    this.bindEvents();
    bindSelectMenu(win);

    this.worker = createWorker();
    this.worker.onmessage = (e) => this.handleWorkerMessage(e.data);

    const dpr = window.devicePixelRatio || 1;
    this.worker.postMessage({
      type: "init",
      timeOffset: 0,
      use24h: this.settings.use24h,
      dpr,
      width: 300,
      height: 300
    });
    this.timeOffset = 0;

    this.rescheduleAlarms();
    this.startAlarmChecker();
  }

  onClose() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.stopwatchInterval) clearInterval(this.stopwatchInterval);
    if (this.checkAlarmInterval) clearInterval(this.checkAlarmInterval);
    for (const id of this.scheduledAlarms.values()) clearTimeout(id);
    this.scheduledAlarms.clear();
    this.win = null;
  }

  handleWorkerMessage(data) {
    if (data.type === "time") {
      this.currentTimeStr = data.timeStr;
      this.currentDateStr = data.dateStr;
      const timeEl = this.win?.querySelector("#clock-digital-time");
      const dateEl = this.win?.querySelector("#clock-digital-date");
      if (timeEl && this.activeTab === "digital") {
        timeEl.textContent = data.timeStr;
        if (dateEl) dateEl.textContent = data.dateStr;
      }
    } else if (data.type === "frame") {
      const canvas = this.win?.querySelector("#clock-analog-canvas");
      if (canvas && this.activeTab === "analog") {
        canvas.width = data.width;
        canvas.height = data.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(data.bitmap, 0, 0);
        data.bitmap.close();
      }
    }
  }

  render() {
    return `
      <div class="clock-app">
        <div class="clock-tabs">
          <button class="clock-tab ${this.activeTab === "digital" ? "active" : ""}" data-tab="digital"><i class="fas fa-clock"></i> Digital</button>
          <button class="clock-tab ${this.activeTab === "analog" ? "active" : ""}" data-tab="analog"><i class="fas fa-circle"></i> Analog</button>
          <button class="clock-tab ${this.activeTab === "alarms" ? "active" : ""}" data-tab="alarms"><i class="fas fa-bell"></i> Alarms</button>

          <button class="clock-tab ${this.activeTab === "stopwatch" ? "active" : ""}" data-tab="stopwatch"><i class="fas fa-stopwatch"></i> Stopwatch</button>
          <button class="clock-tab ${this.activeTab === "timer" ? "active" : ""}" data-tab="timer"><i class="fas fa-hourglass-half"></i> Timer</button>
          <button class="clock-tab ${this.activeTab === "settings" ? "active" : ""}" data-tab="settings"><i class="fas fa-cog"></i></button>
        </div>
        <div class="clock-content">
          ${this.renderTabContent()}
        </div>
      </div>
    `;
  }

  renderTabContent() {
    switch (this.activeTab) {
      case "digital":
        return this.renderDigital();
      case "analog":
        return this.renderAnalog();
      case "alarms":
        return this.renderAlarms();
      case "stopwatch":
        return this.renderStopwatch();
      case "timer":
        return this.renderTimer();
      case "settings":
        return this.renderSettings();
      default:
        return "";
    }
  }

  renderDigital() {
    return `
      <div class="clock-digital">
        <div class="clock-digital-time" id="clock-digital-time">${this.currentTimeStr}</div>
        <div class="clock-digital-date" id="clock-digital-date">${this.currentDateStr}</div>
        <div class="clock-digital-seconds" id="clock-digital-seconds"></div>
      </div>
    `;
  }

  renderAnalog() {
    return `
      <div class="clock-analog">
        <canvas id="clock-analog-canvas" width="300" height="300" style="max-width:100%;width:min(300px,100%);height:auto;aspect-ratio:1"></canvas>
      </div>
    `;
  }

  renderAlarms() {
    let listHtml = "";
    if (this.alarms.length === 0) {
      listHtml = '<div class="clock-alarms-empty">No alarms set</div>';
    } else {
      listHtml = this.alarms
        .map(
          (a, i) => `
        <div class="clock-alarm-item ${a.enabled ? "" : "disabled"}" data-index="${i}">
          <div class="clock-alarm-item-left">
            <div class="clock-alarm-item-time">${a.time}</div>
            <div class="clock-alarm-item-label">${a.label || "Alarm"}</div>
            ${a.recurring && a.recurring.length > 0 ? `<div class="clock-alarm-item-recurring">${a.recurring.join(", ")}</div>` : ""}
          </div>
          <div class="clock-alarm-item-right">
            <label class="clock-alarm-toggle">
              <input type="checkbox" ${a.enabled ? "checked" : ""} data-action="toggleAlarm" data-index="${i}">
              <span class="clock-alarm-toggle-slider"></span>
            </label>
            <button class="clock-alarm-edit-btn" data-action="editAlarm" data-index="${i}"><i class="fas fa-pen"></i></button>
            <button class="clock-alarm-delete-btn" data-action="deleteAlarm" data-index="${i}"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      `
        )
        .join("");
    }
    return `
      <div class="clock-alarms">
        <div class="clock-alarms-list">${listHtml}</div>
        <button class="clock-alarm-add-btn" data-action="addAlarm"><i class="fas fa-plus"></i> Add Alarm</button>
      </div>
    `;
  }

  renderStopwatch() {
    return `
      <div class="clock-stopwatch">
        <div class="clock-stopwatch-display" id="clock-stopwatch-display">00:00:00.00</div>
        <div class="clock-stopwatch-controls">
          <button class="clock-sw-btn" id="clock-sw-start" data-action="swStart">Start</button>
          <button class="clock-sw-btn" id="clock-sw-lap" data-action="swLap" disabled>Lap</button>
          <button class="clock-sw-btn" id="clock-sw-reset" data-action="swReset" disabled>Reset</button>
        </div>
        <div class="clock-stopwatch-laps" id="clock-stopwatch-laps"></div>
      </div>
    `;
  }

  renderTimer() {
    return `
      <div class="clock-timer">
        <div class="clock-timer-display" id="clock-timer-display">00:00</div>
        <div class="clock-timer-inputs">
          <label>H: <input type="number" class="clock-timer-input" id="timer-h" value="0" min="0" max="99"></label>
          <label>M: <input type="number" class="clock-timer-input" id="timer-m" value="0" min="0" max="59"></label>
          <label>S: <input type="number" class="clock-timer-input" id="timer-s" value="0" min="0" max="59"></label>
        </div>
        <div class="clock-timer-controls">
          <button class="clock-timer-btn" id="clock-timer-start" data-action="timerStart">Start</button>
          <button class="clock-timer-btn" id="clock-timer-pause" data-action="timerPause" disabled>Pause</button>
          <button class="clock-timer-btn" id="clock-timer-reset" data-action="timerReset" disabled>Reset</button>
        </div>
      </div>
    `;
  }

  renderSettings() {
    const snoozeOpts = [
      { value: "1", label: "1 minute" },
      { value: "5", label: "5 minutes" },
      { value: "10", label: "10 minutes" },
      { value: "15", label: "15 minutes" },
      { value: "30", label: "30 minutes" }
    ];
    const soundOpts = [
      { value: "classic", label: "Classic" },
      { value: "digital", label: "Digital" },
      { value: "gentle", label: "Gentle" }
    ];
    return `
      <div class="clock-settings">
        <div class="clock-settings-group">
          <label class="clock-settings-label">Time Format</label>
          <div class="clock-settings-toggle">
            <button class="clock-settings-toggle-btn ${!this.settings.use24h ? "active" : ""}" data-setting="use24h" data-value="false">12h</button>
            <button class="clock-settings-toggle-btn ${this.settings.use24h ? "active" : ""}" data-setting="use24h" data-value="true">24h</button>
          </div>
        </div>
        <div class="clock-settings-group">
          <label class="clock-settings-label">Snooze Duration</label>
          ${renderSelectMenu("clock-snooze-select", snoozeOpts, String(this.settings.snoozeDuration))}
        </div>
        <div class="clock-settings-group">
          <label class="clock-settings-label">Alarm Sound</label>
          ${renderSelectMenu("clock-sound-select", soundOpts, this.settings.alarmSound)}
        </div>
      </div>
    `;
  }

  bindEvents() {
    const win = this.win;
    if (!win) return;

    win.addEventListener("click", (e) => {
      const tabBtn = e.target.closest(".clock-tab");
      if (tabBtn) {
        const prevTab = this.activeTab;
        this.activeTab = tabBtn.dataset.tab;
        this.refreshContent();

        if (this.activeTab === "analog" && prevTab !== "analog") {
          this.analogActive = true;
          if (this.worker) {
            this.worker.postMessage({ type: "analogActive", active: true });
          }
        }
        if (prevTab === "analog" && this.activeTab !== "analog") {
          this.analogActive = false;
          if (this.worker) {
            this.worker.postMessage({ type: "analogActive", active: false });
          }
        }
        return;
      }

      const actionBtn = e.target.closest("[data-action]");
      if (!actionBtn) return;
      const action = actionBtn.dataset.action;

      switch (action) {
        case "addAlarm":
          this.showAlarmModal();
          break;
        case "editAlarm":
          this.showAlarmModal(parseInt(actionBtn.dataset.index));
          break;
        case "deleteAlarm":
          this.deleteAlarm(parseInt(actionBtn.dataset.index));
          break;
        case "toggleAlarm":
          this.toggleAlarm(parseInt(actionBtn.dataset.index));
          break;
        case "swStart":
          this.stopwatchStart();
          break;
        case "swLap":
          this.stopwatchLap();
          break;
        case "swReset":
          this.stopwatchReset();
          break;
        case "timerStart":
          this.timerStart();
          break;
        case "timerPause":
          this.timerPause();
          break;
        case "timerReset":
          this.timerReset();
          break;
      }
    });

    win.addEventListener("click", (e) => {
      const settingBtn = e.target.closest(".clock-settings-toggle-btn[data-setting]");
      if (settingBtn) {
        const key = settingBtn.dataset.setting;
        const value = settingBtn.dataset.value === "true";
        this.settings[key] = value;
        this.saveSettings();
        const parent = settingBtn.closest(".clock-settings-toggle");
        if (parent) {
          parent.querySelectorAll(".clock-settings-toggle-btn").forEach((b) => b.classList.remove("active"));
          settingBtn.classList.add("active");
        }
        if (key === "use24h" && this.worker) {
          this.worker.postMessage({ type: "settings", use24h: value });
        }
        return;
      }
    });

    win.addEventListener("change", (e) => {
      const toggle = e.target.closest(".clock-alarm-toggle input");
      if (toggle && toggle.dataset.action === "toggleAlarm") {
        this.toggleAlarm(parseInt(toggle.dataset.index));
        return;
      }

      const selectEl = e.target.closest(".select-menu");
      if (selectEl) {
        const key = selectEl.id === "clock-snooze-select" ? "snoozeDuration" : "alarmSound";
        const raw = getSelectMenuValue(selectEl.id, this.win);
        const value = key === "snoozeDuration" ? parseInt(raw) : raw;
        this.settings[key] = value;
        this.saveSettings();
        return;
      }
    });

    win.addEventListener("input", (e) => {
      const timerInput = e.target.closest(".clock-timer-input");
      if (timerInput) {
        this.updateTimerDisplay();
      }
    });
  }

  refreshContent() {
    if (!this.win) return;
    const content = this.win.querySelector(".clock-content");
    if (content) {
      content.innerHTML = this.renderTabContent();
      if (this.activeTab === "digital") {
        const timeEl = this.win.querySelector("#clock-digital-time");
        const dateEl = this.win.querySelector("#clock-digital-date");
        if (timeEl) timeEl.textContent = this.currentTimeStr;
        if (dateEl) dateEl.textContent = this.currentDateStr;
      }
      if (this.activeTab === "stopwatch") this.updateStopwatchDisplay();
      if (this.activeTab === "timer") this.updateTimerDisplay();
    }
    const tabs = this.win.querySelectorAll(".clock-tab");
    tabs.forEach((t) => t.classList.toggle("active", t.dataset.tab === this.activeTab));
  }

  showAlarmModal(index) {
    const existing = index !== undefined && index !== null ? this.alarms[index] : null;
    const time = existing ? existing.time : "07:00";
    const label = existing ? existing.label || "" : "";
    const recurring = existing ? existing.recurring || [] : [];
    const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    const overlay = document.createElement("div");
    overlay.className = "clock-modal-overlay";
    overlay.innerHTML = `
      <div class="clock-modal">
        <div class="clock-modal-title">${existing ? "Edit Alarm" : "New Alarm"}</div>
        <div class="clock-modal-body">
          <div class="clock-modal-field">
            <label>Time</label>
            <input type="time" class="clock-modal-input" id="alarm-time" value="${time}">
          </div>
          <div class="clock-modal-field">
            <label>Label</label>
            <input type="text" class="clock-modal-input" id="alarm-label" placeholder="Wake up" value="${label}">
          </div>
          <div class="clock-modal-field">
            <label>Repeat</label>
            <div class="clock-modal-days">
              ${daysOfWeek.map((d, i) => `<button class="clock-day-btn ${recurring.includes(d) ? "active" : ""}" data-day="${d}">${d}</button>`).join("")}
            </div>
          </div>
        </div>
        <div class="clock-modal-actions">
          <button class="clock-modal-btn secondary" id="alarm-cancel">Cancel</button>
          <button class="clock-modal-btn primary" id="alarm-save">Save</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelectorAll(".clock-day-btn").forEach((btn) => {
      btn.addEventListener("click", () => btn.classList.toggle("active"));
    });

    overlay.querySelector("#alarm-cancel").onclick = () => overlay.remove();
    overlay.querySelector("#alarm-save").onclick = () => {
      const newTime = overlay.querySelector("#alarm-time").value;
      const newLabel = overlay.querySelector("#alarm-label").value.trim();
      const newRecurring = [...overlay.querySelectorAll(".clock-day-btn.active")].map((b) => b.dataset.day);
      if (!newTime) return;
      if (existing) {
        this.alarms[index] = { ...this.alarms[index], time: newTime, label: newLabel, recurring: newRecurring };
      } else {
        this.alarms.push({
          id: generateId(),
          time: newTime,
          label: newLabel,
          enabled: true,
          recurring: newRecurring,
          sound: this.settings.alarmSound
        });
      }
      this.saveAlarms();
      overlay.remove();
      this.refreshContent();
    };
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }

  deleteAlarm(index) {
    this.alarms.splice(index, 1);
    this.saveAlarms();
    this.refreshContent();
  }

  toggleAlarm(index) {
    if (this.alarms[index]) {
      this.alarms[index].enabled = !this.alarms[index].enabled;
      this.saveAlarms();
      this.refreshContent();
    }
  }

  startAlarmChecker() {
    if (this.checkAlarmInterval) clearInterval(this.checkAlarmInterval);
    this.checkAlarmInterval = setInterval(() => this.rescheduleAlarms(), 60000);
  }

  stopwatchStart() {
    if (this.stopwatchRunning) {
      this.stopwatchRunning = false;
      if (this.stopwatchInterval) clearInterval(this.stopwatchInterval);
      const swStart = this.win?.querySelector("#clock-sw-start");
      if (swStart) swStart.textContent = "Resume";
      return;
    }
    this.stopwatchRunning = true;
    this.stopwatchStartTime = Date.now() - this.stopwatchTime;
    const swStart = this.win?.querySelector("#clock-sw-start");
    const swLap = this.win?.querySelector("#clock-sw-lap");
    const swReset = this.win?.querySelector("#clock-sw-reset");
    if (swStart) swStart.textContent = "Stop";
    if (swLap) swLap.disabled = false;
    if (swReset) swReset.disabled = false;
    if (this.stopwatchInterval) clearInterval(this.stopwatchInterval);
    this.stopwatchInterval = setInterval(() => {
      this.stopwatchTime = Date.now() - this.stopwatchStartTime;
      this.updateStopwatchDisplay();
    }, 20);
  }

  stopwatchLap() {
    if (!this.stopwatchRunning) return;
    const prevLapTotal = this.stopwatchLaps.reduce((sum, l) => sum + l, 0);
    this.stopwatchLaps.push(this.stopwatchTime - prevLapTotal);
    this.updateStopwatchLaps();
  }

  stopwatchReset() {
    this.stopwatchRunning = false;
    this.stopwatchTime = 0;
    this.stopwatchLaps = [];
    if (this.stopwatchInterval) clearInterval(this.stopwatchInterval);
    this.updateStopwatchDisplay();
    const swStart = this.win?.querySelector("#clock-sw-start");
    const swLap = this.win?.querySelector("#clock-sw-lap");
    const swReset = this.win?.querySelector("#clock-sw-reset");
    if (swStart) swStart.textContent = "Start";
    if (swLap) swLap.disabled = true;
    if (swReset) swReset.disabled = true;
    const lapsEl = this.win?.querySelector("#clock-stopwatch-laps");
    if (lapsEl) lapsEl.innerHTML = "";
  }

  updateStopwatchDisplay() {
    const el = this.win?.querySelector("#clock-stopwatch-display");
    if (el) el.textContent = formatTime(this.stopwatchTime, true);
  }

  updateStopwatchLaps() {
    const lapsEl = this.win?.querySelector("#clock-stopwatch-laps");
    if (!lapsEl) return;
    let html = "";
    let total = 0;
    this.stopwatchLaps.forEach((lap, i) => {
      total += lap;
      html += `<div class="clock-sw-lap"><span>Lap ${i + 1}</span><span>${formatTime(total, true)}</span><span>+${formatTime(lap, true)}</span></div>`;
    });
    lapsEl.innerHTML = html;
  }

  timerStart() {
    if (this.timerRunning) return;
    const h = parseInt(this.win?.querySelector("#timer-h")?.value || "0");
    const m = parseInt(this.win?.querySelector("#timer-m")?.value || "0");
    const s = parseInt(this.win?.querySelector("#timer-s")?.value || "0");
    const totalMs = (h * 3600 + m * 60 + s) * 1000;
    if (totalMs <= 0) return;
    this.timerInitial = totalMs;
    this.timerRemaining = totalMs;
    this.timerRunning = true;
    this.timerStartTime = Date.now();
    this.disableTimerInputs(true);
    const btn = this.win?.querySelector("#clock-timer-start");
    if (btn) btn.disabled = true;
    const pauseBtn = this.win?.querySelector("#clock-timer-pause");
    if (pauseBtn) pauseBtn.disabled = false;
    const resetBtn = this.win?.querySelector("#clock-timer-reset");
    if (resetBtn) resetBtn.disabled = false;
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      const elapsed = Date.now() - this.timerStartTime;
      this.timerRemaining = Math.max(0, this.timerInitial - elapsed);
      this.updateTimerDisplay();
      if (this.timerRemaining <= 0) {
        this.timerComplete();
      }
    }, 100);
  }

  timerPause() {
    if (!this.timerRunning) return;
    this.timerRunning = false;
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInitial = this.timerRemaining;
    const startBtn = this.win?.querySelector("#clock-timer-start");
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.textContent = "Resume";
    }
    const pauseBtn = this.win?.querySelector("#clock-timer-pause");
    if (pauseBtn) pauseBtn.disabled = true;
  }

  timerReset() {
    this.timerRunning = false;
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerRemaining = 0;
    this.timerInitial = 0;
    this.disableTimerInputs(false);
    const startBtn = this.win?.querySelector("#clock-timer-start");
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.textContent = "Start";
    }
    const pauseBtn = this.win?.querySelector("#clock-timer-pause");
    if (pauseBtn) pauseBtn.disabled = true;
    const resetBtn = this.win?.querySelector("#clock-timer-reset");
    if (resetBtn) resetBtn.disabled = true;
    this.updateTimerDisplay();
  }

  timerComplete() {
    this.timerRunning = false;
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.disableTimerInputs(false);
    const startBtn = this.win?.querySelector("#clock-timer-start");
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.textContent = "Start";
    }
    const pauseBtn = this.win?.querySelector("#clock-timer-pause");
    if (pauseBtn) pauseBtn.disabled = true;
    const resetBtn = this.win?.querySelector("#clock-timer-reset");
    if (resetBtn) resetBtn.disabled = true;
    this.notify("Timer", "Timer finished!", "info", 10000);
  }

  disableTimerInputs(disabled) {
    const inputs = this.win?.querySelectorAll(".clock-timer-input");
    if (inputs) inputs.forEach((inp) => (inp.disabled = disabled));
  }

  updateTimerDisplay() {
    const el = this.win?.querySelector("#clock-timer-display");
    if (!el) return;
    if (this.timerRemaining > 0) {
      el.textContent = formatTime(this.timerRemaining);
    } else {
      const h = parseInt(this.win?.querySelector("#timer-h")?.value || "0");
      const m = parseInt(this.win?.querySelector("#timer-m")?.value || "0");
      const s = parseInt(this.win?.querySelector("#timer-s")?.value || "0");
      el.textContent = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
  }
}
