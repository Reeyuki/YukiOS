import "../styles/calendar.css";
import { createElement } from "../framework.js";
import { KeybindManager } from "../keybindManager.js";
import { os, StorageKeys } from "../framework.js";
import { getWeekNumber } from "../shared/calendarUtils.js";
import { subscribeTimeTick } from "../services/timeWorker.js";
import { isTaskbarTop } from "../utils/utils.js";
import { $ } from "../shared/domUtils.js";

let calendarPopup = null;
let currentCalendarMonth = new Date();
let unsubTimeTick = null;
let lastWorkerData = null;

function drawClock(canvas, date) {
  if (!canvas || !date) return;
  const size = canvas.width;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 6;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, size, size);

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = "transparent";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  for (let i = 0; i < 12; i++) {
    const a = ((i * 30 - 90) * Math.PI) / 180;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r * 0.82, cy + Math.sin(a) * r * 0.82);
    ctx.lineTo(cx + Math.cos(a) * r * 0.93, cy + Math.sin(a) * r * 0.93);
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = i % 3 === 0 ? 2 : 1;
    ctx.stroke();
  }

  const hours = date.getHours() % 12;
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  const ms = date.getMilliseconds();

  const secA = (((seconds + ms / 1000) * 6 - 90) * Math.PI) / 180;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(secA) * r * 0.82, cy + Math.sin(secA) * r * 0.82);
  ctx.strokeStyle = "var(--brand)";
  ctx.lineWidth = 1;
  ctx.stroke();

  const minA = (((minutes + seconds / 60) * 6 - 90) * Math.PI) / 180;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(minA) * r * 0.65, cy + Math.sin(minA) * r * 0.65);
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 2;
  ctx.stroke();

  const hourA = (((hours + minutes / 60) * 30 - 90) * Math.PI) / 180;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(hourA) * r * 0.45, cy + Math.sin(hourA) * r * 0.45);
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fill();
}

function getNextAlarm() {
  try {
    const alarms = os.storage.get(StorageKeys.clockAlarms);
    if (!alarms || alarms.length === 0) return null;
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    let next = null;
    let nextDiff = Infinity;
    for (const alarm of alarms) {
      if (!alarm.enabled) continue;
      const [h, m] = alarm.time.split(":").map(Number);
      const alarmMin = h * 60 + m;
      let diff = alarmMin - nowMin;
      if (diff <= 0) diff += 1440;
      if (diff < nextDiff) {
        nextDiff = diff;
        next = alarm;
      }
    }
    return next;
  } catch {
    return null;
  }
}

export function createCalendarPopup() {
  if (calendarPopup) {
    closeCalendarPopup();
    return;
  }

  const popup = createElement("div");
  popup.id = "calendar-popup";
  popup.className = "calendar-popup";

  const clockStyle = os.storage.get(StorageKeys.calendarClockStyle) || "analog";

  let clockEl;
  let digitalTextEl;
  if (clockStyle === "digital") {
    clockEl = createElement("div");
    clockEl.className = "calendar-time-display";
  } else {
    clockEl = createElement("canvas");
    clockEl.id = "calendar-analog-canvas";
    clockEl.className = "calendar-analog-canvas";
    clockEl.width = 120;
    clockEl.height = 120;
    digitalTextEl = createElement("div");
    digitalTextEl.className = "calendar-digital-text";
  }

  const header = createElement("div");
  header.className = "calendar-header";

  const prevBtn = createElement("button");
  prevBtn.className = "calendar-nav-btn";
  prevBtn.textContent = "\u2039";
  prevBtn.title = "Previous month";
  prevBtn.onclick = () => {
    currentCalendarMonth.setMonth(currentCalendarMonth.getMonth() - 1);
    renderCalendar();
  };

  const monthYearContainer = createElement("div");
  monthYearContainer.className = "calendar-month-year-container";

  const monthYear = createElement("div");
  monthYear.className = "calendar-month-year";

  const todayBtn = createElement("button");
  todayBtn.className = "calendar-today-btn";
  todayBtn.textContent = "Today";
  todayBtn.onclick = () => {
    currentCalendarMonth = new Date();
    renderCalendar();
  };

  monthYearContainer.appendChild(monthYear);
  monthYearContainer.appendChild(todayBtn);

  const nextBtn = createElement("button");
  nextBtn.className = "calendar-nav-btn";
  nextBtn.textContent = "\u203A";
  nextBtn.title = "Next month";
  nextBtn.onclick = () => {
    currentCalendarMonth.setMonth(currentCalendarMonth.getMonth() + 1);
    renderCalendar();
  };

  header.appendChild(prevBtn);
  header.appendChild(monthYearContainer);
  header.appendChild(nextBtn);

  const grid = createElement("div");
  grid.className = "calendar-grid";

  const alarmSection = createElement("div");
  alarmSection.className = "calendar-alarm-section";

  const leftCol = createElement("div");
  leftCol.className = "calendar-left-col";
  leftCol.appendChild(header);
  leftCol.appendChild(grid);
  leftCol.appendChild(alarmSection);

  const rightCol = createElement("div");
  rightCol.className = "calendar-right-col";
  rightCol.appendChild(clockEl);
  if (digitalTextEl) rightCol.appendChild(digitalTextEl);

  const body = createElement("div");
  body.className = "calendar-body";
  body.appendChild(leftCol);
  body.appendChild(rightCol);

  const footer = createElement("div");
  footer.className = "calendar-footer";
  const settingsLink = createElement("span");
  settingsLink.className = "calendar-settings-link";
  settingsLink.textContent = "Clock settings";
  settingsLink.onclick = () => {
    closeCalendarPopup();
    os.app.launch("clockApp");
  };
  footer.appendChild(settingsLink);

  popup.appendChild(body);
  popup.appendChild(footer);
  document.body.appendChild(popup);

  calendarPopup = popup;

  positionCalendarPopup();

  if (lastWorkerData) updateCalendarTime(lastWorkerData);
  unsubTimeTick = subscribeTimeTick((data) => {
    lastWorkerData = data;
    updateCalendarTime(data);
  });

  renderCalendar();

  document.addEventListener("keydown", handleCalendarKeydown);

  setTimeout(() => {
    document.addEventListener("click", closeCalendarOnClickOutside);
  }, 0);
}

export function closeCalendarPopup() {
  if (calendarPopup) {
    calendarPopup.remove();
    calendarPopup = null;
  }
  if (unsubTimeTick) {
    unsubTimeTick();
    unsubTimeTick = null;
  }
  document.removeEventListener("keydown", handleCalendarKeydown);
  document.removeEventListener("click", closeCalendarOnClickOutside);
}

function getShelfPos() {
  const shelf = $("#chromeos-shelf");
  if (shelf && getComputedStyle(shelf).display !== "none" && shelf.dataset.shelfPos) {
    return shelf.dataset.shelfPos;
  }
  return null;
}

function positionCalendarPopup() {
  if (!calendarPopup) return;

  requestAnimationFrame(() => {
    if (!calendarPopup) return;
    const dateCandidates = [$("#time-container"), $("#date"), $(".shelf-clock")];
    const dateEl =
      dateCandidates.find((el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      }) || dateCandidates[0];
    if (!dateEl) return;
    const rect = dateEl.getBoundingClientRect();
    const popupRect = calendarPopup.getBoundingClientRect();

    const margin = 10;
    const shelfPos = getShelfPos();
    if (shelfPos === "left") {
      calendarPopup.style.top = `${Math.max(margin, rect.top)}px`;
      calendarPopup.style.left = `${rect.right + 8}px`;
      calendarPopup.style.bottom = "auto";
      calendarPopup.style.right = "auto";
    } else if (shelfPos === "right") {
      calendarPopup.style.top = `${Math.max(margin, rect.top)}px`;
      calendarPopup.style.right = `${window.innerWidth - rect.left + 8}px`;
      calendarPopup.style.bottom = "auto";
      calendarPopup.style.left = "auto";
    } else if (shelfPos === "top") {
      calendarPopup.style.top = `${rect.bottom + 8}px`;
      calendarPopup.style.bottom = "auto";
      calendarPopup.style.right = `${window.innerWidth - rect.right}px`;
      calendarPopup.style.left = "auto";
    } else {
      const isMac = isTaskbarTop();
      if (isMac) {
        calendarPopup.style.top = `${rect.bottom + 8}px`;
        calendarPopup.style.bottom = "auto";
        calendarPopup.style.right = `${window.innerWidth - rect.right}px`;
        calendarPopup.style.left = "auto";
      } else {
        let bottom = window.innerHeight - rect.top + 8;
        if (bottom + popupRect.height > window.innerHeight - margin) {
          bottom = window.innerHeight - popupRect.height - margin;
        }
        if (bottom < margin) {
          bottom = margin;
        }
        calendarPopup.style.bottom = `${bottom}px`;
        calendarPopup.style.top = "auto";
        let left = rect.left + rect.width / 2 - popupRect.width / 2;
        if (left + popupRect.width > window.innerWidth - margin) {
          left = window.innerWidth - popupRect.width - margin;
        }
        if (left < margin) {
          left = margin;
        }
        calendarPopup.style.left = `${left}px`;
        calendarPopup.style.right = "auto";
      }
    }
  });
}

function updateCalendarTime(data) {
  if (!calendarPopup) return;
  const canvas = calendarPopup.querySelector("#calendar-analog-canvas");
  const timeDisplay = calendarPopup.querySelector(".calendar-time-display");
  const digitalText = calendarPopup.querySelector(".calendar-digital-text");
  const now = data ? new Date(data.timestamp) : new Date();
  if (canvas) {
    drawClock(canvas, now);
  }
  if (timeDisplay) {
    timeDisplay.textContent = now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  }
  if (digitalText) {
    digitalText.textContent = now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
  }
}

function handleCalendarKeydown(e) {
  if (!calendarPopup) return;

  if (KeybindManager.matches(e, "calendar.close")) {
    closeCalendarPopup();
  } else if (KeybindManager.matches(e, "calendar.prevMonth")) {
    currentCalendarMonth.setMonth(currentCalendarMonth.getMonth() - 1);
    renderCalendar();
  } else if (KeybindManager.matches(e, "calendar.nextMonth")) {
    currentCalendarMonth.setMonth(currentCalendarMonth.getMonth() + 1);
    renderCalendar();
  } else if (KeybindManager.matches(e, "calendar.prevYear")) {
    currentCalendarMonth.setFullYear(currentCalendarMonth.getFullYear() - 1);
    renderCalendar();
  } else if (KeybindManager.matches(e, "calendar.nextYear")) {
    currentCalendarMonth.setFullYear(currentCalendarMonth.getFullYear() + 1);
    renderCalendar();
  }
}

function closeCalendarOnClickOutside(e) {
  if (
    calendarPopup &&
    !calendarPopup.contains(e.target) &&
    e.target.id !== "date" &&
    e.target.id !== "clock" &&
    !e.target.closest("#time-container") &&
    !e.target.closest(".shelf-clock")
  ) {
    closeCalendarPopup();
  }
}

function renderCalendar() {
  if (!calendarPopup) return;

  const monthYear = calendarPopup.querySelector(".calendar-month-year");
  const grid = calendarPopup.querySelector(".calendar-grid");
  const alarmSection = calendarPopup.querySelector(".calendar-alarm-section");

  const year = currentCalendarMonth.getFullYear();
  const month = currentCalendarMonth.getMonth();

  monthYear.textContent = new Date(year, month).toLocaleDateString([], {
    month: "long",
    year: "numeric"
  });

  grid.innerHTML = "";

  const weekHeader = createElement("div");
  weekHeader.className = "calendar-week-header";
  weekHeader.textContent = "W";
  weekHeader.title = "Week number";
  grid.appendChild(weekHeader);

  const dayHeaders = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  dayHeaders.forEach((day) => {
    const dayHeader = createElement("div");
    dayHeader.className = "calendar-day-header";
    dayHeader.textContent = day;
    grid.appendChild(dayHeader);
  });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const today = new Date();
  const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;
  const currentDay = today.getDate();

  const rows = 6;

  let dayCounter = 1;

  for (let row = 0; row < rows; row++) {
    const weekNum = createElement("div");
    weekNum.className = "calendar-week-number";
    weekNum.textContent = getWeekNumber(new Date(year, month, Math.max(1, dayCounter)));
    grid.appendChild(weekNum);

    for (let col = 0; col < 7; col++) {
      const cellIndex = row * 7 + col;
      const dayCell = createElement("div");
      dayCell.className = "calendar-day";

      if (cellIndex >= firstDay && dayCounter <= daysInMonth) {
        const day = dayCounter;

        dayCell.textContent = day;

        if (isCurrentMonth && day === currentDay) {
          dayCell.classList.add("today");
        }

        if (col === 0 || col === 6) {
          dayCell.classList.add("weekend");
        }

        dayCounter++;
      } else {
        dayCell.classList.add("empty");
      }

      grid.appendChild(dayCell);
    }
  }

  renderAlarmSection(alarmSection);

  const weekNums = grid.querySelectorAll(".calendar-week-number");
  weekNums.forEach((wn, i) => {
    if (i > 0) {
      const dayInWeek = Math.min(1 + (i - 1) * 7 - firstDay + 7, daysInMonth);
      if (dayInWeek > 0 && dayInWeek <= daysInMonth) {
        wn.textContent = getWeekNumber(new Date(year, month, dayInWeek));
      }
    }
  });
}

function renderAlarmSection(alarmSection) {
  alarmSection.innerHTML = "";

  const nextAlarm = getNextAlarm();
  if (nextAlarm) {
    const alarmEl = createElement("div");
    alarmEl.className = "calendar-alarm-item";
    alarmEl.innerHTML = `
      <i class="fas fa-bell calendar-alarm-icon"></i>
      <span class="calendar-alarm-label">Next Alarm</span>
      <span class="calendar-alarm-time">${nextAlarm.time}</span>
    `;
    if (nextAlarm.label) {
      const labelEl = createElement("span");
      labelEl.className = "calendar-alarm-name";
      labelEl.textContent = nextAlarm.label;
      alarmEl.appendChild(labelEl);
    }
    alarmSection.appendChild(alarmEl);
  }
}

export function setCurrentCalendarMonth() {
  currentCalendarMonth = new Date();
}
