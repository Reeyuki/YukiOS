import "../styles/calendar.css";
import { KeybindManager } from "../keybindManager.js";
import { os, StorageKeys } from "../framework.js";
import {
  getDateKey,
  parseDateKey,
  getWeekNumber,
  getEventsForDate,
  loadEvents,
  saveEvents,
  generateEventId,
  EVENT_COLORS
} from "../shared/calendarUtils.js";
import { renderSelectMenu, getSelectMenuValue, setSelectMenuValue, bindSelectMenu } from "../shared/selectMenu.js";

let _calendarPopup = null;
let _currentCalendarMonth = new Date();
let _calendarEvents = [];
let _calendarTimeInterval = null;
let _trayPanel = null;
let _trayCloseHandler = null;

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
  _calendarEvents = loadEvents();

  if (_calendarPopup) {
    closeCalendarPopup();
    return;
  }

  const popup = document.createElement("div");
  popup.id = "calendar-popup";
  popup.className = "calendar-popup";

  const timeDisplay = document.createElement("div");
  timeDisplay.className = "calendar-time-display";

  const dateDisplay = document.createElement("div");
  dateDisplay.className = "calendar-date-display";

  const header = document.createElement("div");
  header.className = "calendar-header";

  const prevBtn = document.createElement("button");
  prevBtn.className = "calendar-nav-btn";
  prevBtn.textContent = "\u2039";
  prevBtn.title = "Previous month";
  prevBtn.onclick = () => {
    _currentCalendarMonth.setMonth(_currentCalendarMonth.getMonth() - 1);
    renderCalendar();
  };

  const monthYearContainer = document.createElement("div");
  monthYearContainer.className = "calendar-month-year-container";

  const monthYear = document.createElement("div");
  monthYear.className = "calendar-month-year";

  const todayBtn = document.createElement("button");
  todayBtn.className = "calendar-today-btn";
  todayBtn.textContent = "Today";
  todayBtn.onclick = () => {
    _currentCalendarMonth = new Date();
    renderCalendar();
  };

  monthYearContainer.appendChild(monthYear);
  monthYearContainer.appendChild(todayBtn);

  const nextBtn = document.createElement("button");
  nextBtn.className = "calendar-nav-btn";
  nextBtn.textContent = "\u203A";
  nextBtn.title = "Next month";
  nextBtn.onclick = () => {
    _currentCalendarMonth.setMonth(_currentCalendarMonth.getMonth() + 1);
    renderCalendar();
  };

  header.appendChild(prevBtn);
  header.appendChild(monthYearContainer);
  header.appendChild(nextBtn);

  const grid = document.createElement("div");
  grid.className = "calendar-grid";

  const agenda = document.createElement("div");
  agenda.className = "calendar-agenda";

  const alarmSection = document.createElement("div");
  alarmSection.className = "calendar-alarm-section";

  const appButtons = document.createElement("div");
  appButtons.className = "calendar-app-buttons";

  popup.appendChild(timeDisplay);
  popup.appendChild(dateDisplay);
  popup.appendChild(header);
  popup.appendChild(grid);
  popup.appendChild(agenda);
  popup.appendChild(alarmSection);
  popup.appendChild(appButtons);
  document.body.appendChild(popup);

  _calendarPopup = popup;

  positionCalendarPopup();

  updateCalendarTime();
  _calendarTimeInterval = setInterval(updateCalendarTime, 1000);

  renderCalendar();

  document.addEventListener("keydown", handleCalendarKeydown);

  setTimeout(() => {
    document.addEventListener("click", closeCalendarOnClickOutside);
  }, 0);
}

function closeCalendarPopup() {
  if (_calendarPopup) {
    _calendarPopup.remove();
    _calendarPopup = null;
  }
  if (_calendarTimeInterval) {
    clearInterval(_calendarTimeInterval);
    _calendarTimeInterval = null;
  }
  document.removeEventListener("keydown", handleCalendarKeydown);
  document.removeEventListener("click", closeCalendarOnClickOutside);
}

function positionCalendarPopup() {
  if (!_calendarPopup) return;

  const dateEl = document.getElementById("time-container") || document.getElementById("date");
  const rect = dateEl.getBoundingClientRect();
  const popupRect = _calendarPopup.getBoundingClientRect();

  let left = rect.left + rect.width / 2 - popupRect.width / 2;
  let bottom = window.innerHeight - rect.top + 8;

  if (left + popupRect.width > window.innerWidth - 10) {
    left = window.innerWidth - popupRect.width - 10;
  }
  if (left < 10) {
    left = 10;
  }

  _calendarPopup.style.bottom = `${bottom}px`;
  _calendarPopup.style.left = `${left}px`;
  _calendarPopup.style.top = "auto";
}

function updateCalendarTime() {
  if (!_calendarPopup) return;
  const timeDisplay = _calendarPopup.querySelector(".calendar-time-display");
  const dateDisplay = _calendarPopup.querySelector(".calendar-date-display");
  if (timeDisplay) {
    const now = new Date();
    timeDisplay.textContent = now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  }
  if (dateDisplay) {
    const now = new Date();
    dateDisplay.textContent = now.toLocaleDateString([], {
      weekday: "long",
      month: "long",
      day: "numeric"
    });
  }
}

function handleCalendarKeydown(e) {
  if (!_calendarPopup) return;

  if (KeybindManager.matches(e, "calendar.close")) {
    closeCalendarPopup();
  } else if (KeybindManager.matches(e, "calendar.prevMonth")) {
    _currentCalendarMonth.setMonth(_currentCalendarMonth.getMonth() - 1);
    renderCalendar();
  } else if (KeybindManager.matches(e, "calendar.nextMonth")) {
    _currentCalendarMonth.setMonth(_currentCalendarMonth.getMonth() + 1);
    renderCalendar();
  } else if (e.key === "ArrowUp") {
    _currentCalendarMonth.setFullYear(_currentCalendarMonth.getFullYear() - 1);
    renderCalendar();
  } else if (e.key === "ArrowDown") {
    _currentCalendarMonth.setFullYear(_currentCalendarMonth.getFullYear() + 1);
    renderCalendar();
  }
}

function closeCalendarOnClickOutside(e) {
  if (e.target.closest(".calendar-modal-overlay, .calendar-modal, .select-menu, .select-menu__dropdown")) return;
  if (
    _calendarPopup &&
    !_calendarPopup.contains(e.target) &&
    e.target.id !== "date" &&
    e.target.id !== "clock" &&
    !e.target.closest("#time-container")
  ) {
    closeCalendarPopup();
  }
}

function closeTrayPanel() {
  if (_trayPanel) {
    _trayPanel.remove();
    _trayPanel = null;
  }
  if (_trayCloseHandler) {
    document.removeEventListener("keydown", _trayCloseHandler);
    _trayCloseHandler = null;
  }
  document.removeEventListener("click", _onTrayOutsideClick);
}

function positionTrayPanel(panel, offsetX = 0) {
  if (!_calendarPopup) return;
  const calRect = _calendarPopup.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();
  const padding = 8;

  let left = calRect.right + padding + offsetX;
  let top = calRect.top;

  if (left + panelRect.width > window.innerWidth - padding) {
    left = Math.max(padding, calRect.left - panelRect.width - padding);
  }
  if (top + panelRect.height > window.innerHeight - padding) {
    top = window.innerHeight - panelRect.height - padding;
  }
  if (top < padding) top = padding;

  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
}

const PLAN_ICONS = ["fa-bolt", "fa-gamepad", "fa-star", "fa-music", "fa-code", "fa-camera", "fa-book", "fa-heart"];

function showDayEventsModal(dateKey) {
  closeTrayPanel();

  const eventsForDay = getEventsForDate(_calendarEvents, dateKey);
  const { year, month, day } = parseDateKey(dateKey);
  const displayDate = new Date(year, month, day).toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });

  let eventsListHtml = "";
  if (eventsForDay.length > 0) {
    eventsListHtml = eventsForDay
      .map(
        (ev, idx) => `
      <div class="calendar-modal-event-item" data-event-id="${ev.id}">
        <i class="fas ${ev.icon || PLAN_ICONS[idx % PLAN_ICONS.length]} cal-modal-event-icon"></i>
        <span class="cal-modal-event-title">${ev.title}</span>
        ${ev.time ? `<span class="cal-modal-event-time">${ev.time.slice(0, 5)}</span>` : ""}
        <div class="cal-modal-event-actions">
          <button class="cal-modal-event-btn" data-action="editEvent" data-id="${ev.id}" title="Edit"><i class="fas fa-pen"></i></button>
          <button class="cal-modal-event-btn" data-action="deleteEvent" data-id="${ev.id}" title="Delete"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    `
      )
      .join("");
  } else {
    eventsListHtml = '<div class="calendar-modal-noevents">No missions today.</div>';
  }

  const modal = document.createElement("div");
  modal.className = "calendar-modal calendar-modal-events";
  modal.innerHTML = `
    <div class="calendar-modal-title"><i class="fas fa-bolt" style="color:var(--brand);margin-right:6px"></i> Plans — ${displayDate}</div>
    <div class="calendar-modal-events-list">${eventsListHtml}</div>
    <div class="calendar-modal-actions">
      <button class="calendar-modal-btn save" id="cal-popup-add-event"><i class="fas fa-plus"></i> New Plan</button>
      <button class="calendar-modal-btn cancel" id="cal-popup-close">Close</button>
    </div>
  `;

  document.body.appendChild(modal);
  _trayPanel = modal;
  positionTrayPanel(modal);

  modal.querySelector("#cal-popup-add-event").onclick = () => {
    closeTrayPanel();
    showEventFormModal(dateKey, null);
  };

  modal.querySelector("#cal-popup-close").onclick = closeTrayPanel;

  modal.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    if (action === "editEvent") {
      const ev = _calendarEvents.find((e) => e.id === id);
      if (ev) {
        closeTrayPanel();
        showEventFormModal(dateKey, ev);
      }
    } else if (action === "deleteEvent") {
      _calendarEvents = _calendarEvents.filter((e) => e.id !== id);
      saveEvents(_calendarEvents);
      closeTrayPanel();
      showDayEventsModal(dateKey);
      renderCalendar();
    }
  });

  _trayCloseHandler = (e) => {
    if (e.key === "Escape") closeTrayPanel();
  };
  document.addEventListener("keydown", _trayCloseHandler);
  setTimeout(() => {
    document.addEventListener("click", _onTrayOutsideClick);
  }, 0);
}

function _onTrayOutsideClick(e) {
  if (!_trayPanel) return;
  if (e.target.closest(".calendar-modal, .calendar-popup, .select-menu, .select-menu__dropdown")) return;
  closeTrayPanel();
}

function showEventFormModal(dateKey, event) {
  closeTrayPanel();

  const existing = !!event;
  const title = existing ? "Edit Plan" : "New Plan";

  const recurringOpts = [
    { value: "", label: "No repeat" },
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
    { value: "yearly", label: "Yearly" }
  ];

  const reminderOpts = [
    { value: "0", label: "None" },
    { value: "5", label: "5 minutes before" },
    { value: "10", label: "10 minutes before" },
    { value: "15", label: "15 minutes before" },
    { value: "30", label: "30 minutes before" },
    { value: "60", label: "1 hour before" }
  ];

  const modal = document.createElement("div");
  modal.className = "calendar-modal";
  modal.innerHTML = `
    <div class="calendar-modal-title">${title}</div>
    <div class="calendar-modal-body">
      <div class="calendar-modal-field">
        <label>Title</label>
        <input type="text" class="calendar-modal-input" id="cev-title" placeholder="Plan title" value="${existing ? event.title : ""}">
      </div>
      <div class="calendar-modal-field">
        <label>Date</label>
        <input type="date" class="calendar-modal-input" id="cev-date" value="${existing ? event.date : dateKey}">
      </div>
      <div class="calendar-modal-field">
        <label>Time (optional)</label>
        <input type="time" class="calendar-modal-input" id="cev-time" value="${existing && event.time ? event.time : ""}">
      </div>
      <div class="calendar-modal-field">
        <label>Repeat</label>
        ${renderSelectMenu("cev-recurring", recurringOpts, existing ? event.recurring : "")}
      </div>
      <div class="calendar-modal-field">
        <label>Reminder</label>
        ${renderSelectMenu("cev-reminder", reminderOpts, existing ? String(event.reminder) : "0")}
      </div>
      <div class="calendar-modal-field">
        <label>Notes</label>
        <textarea class="calendar-modal-input calendar-modal-textarea" id="cev-notes" placeholder="Optional notes...">${existing && event.notes ? event.notes : ""}</textarea>
      </div>
    </div>
    <div class="calendar-modal-actions">
      <button class="calendar-modal-btn cancel" id="cev-cancel">Cancel</button>
      ${existing ? `<button class="calendar-modal-btn delete" id="cev-delete">Delete</button>` : ""}
      <button class="calendar-modal-btn save" id="cev-save">Save</button>
    </div>
  `;

  document.body.appendChild(modal);
  _trayPanel = modal;
  positionTrayPanel(modal, 20);
  bindSelectMenu(modal);

  modal.querySelector("#cev-cancel").onclick = () => {
    closeTrayPanel();
    showDayEventsModal(dateKey);
  };

  if (existing) {
    modal.querySelector("#cev-delete").onclick = () => {
      _calendarEvents = _calendarEvents.filter((e) => e.id !== event.id);
      saveEvents(_calendarEvents);
      closeTrayPanel();
      showDayEventsModal(dateKey);
      renderCalendar();
    };
  }

  modal.querySelector("#cev-save").onclick = () => {
    const titleVal = modal.querySelector("#cev-title").value.trim();
    const dateVal = modal.querySelector("#cev-date").value;
    const timeVal = modal.querySelector("#cev-time").value;
    const colorVal = EVENT_COLORS[0];
    const recurringVal = getSelectMenuValue("cev-recurring", modal) || "";
    const reminderVal = parseInt(getSelectMenuValue("cev-reminder", modal) || "0");
    const notesVal = modal.querySelector("#cev-notes").value.trim();
    if (!titleVal || !dateVal) return;

    if (existing) {
      const ev = _calendarEvents.find((e) => e.id === event.id);
      if (ev) {
        ev.title = titleVal;
        ev.date = dateVal;
        ev.time = timeVal;
        ev.color = colorVal;
        ev.recurring = recurringVal;
        ev.reminder = reminderVal;
        ev.notes = notesVal;
      }
    } else {
      _calendarEvents.push({
        id: generateEventId(),
        title: titleVal,
        date: dateVal,
        time: timeVal,
        color: colorVal,
        recurring: recurringVal,
        reminder: reminderVal,
        notes: notesVal
      });
    }
    saveEvents(_calendarEvents);
    closeTrayPanel();
    renderCalendar();
  };

  _trayCloseHandler = (e) => {
    if (e.key === "Escape") closeTrayPanel();
  };
  document.addEventListener("keydown", _trayCloseHandler);
  setTimeout(() => {
    document.addEventListener("click", _onTrayOutsideClick);
  }, 0);
}

function renderCalendar() {
  if (!_calendarPopup) return;

  const monthYear = _calendarPopup.querySelector(".calendar-month-year");
  const grid = _calendarPopup.querySelector(".calendar-grid");
  const agenda = _calendarPopup.querySelector(".calendar-agenda");
  const alarmSection = _calendarPopup.querySelector(".calendar-alarm-section");
  const appButtons = _calendarPopup.querySelector(".calendar-app-buttons");

  const year = _currentCalendarMonth.getFullYear();
  const month = _currentCalendarMonth.getMonth();

  monthYear.textContent = new Date(year, month).toLocaleDateString([], {
    month: "long",
    year: "numeric"
  });

  grid.innerHTML = "";

  const weekHeader = document.createElement("div");
  weekHeader.className = "calendar-week-header";
  weekHeader.textContent = "W";
  weekHeader.title = "Week number";
  grid.appendChild(weekHeader);

  const dayHeaders = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  dayHeaders.forEach((day) => {
    const dayHeader = document.createElement("div");
    dayHeader.className = "calendar-day-header";
    dayHeader.textContent = day;
    grid.appendChild(dayHeader);
  });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const today = new Date();
  const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;
  const currentDay = today.getDate();

  const totalCells = firstDay + daysInMonth;
  const rows = Math.ceil(totalCells / 7);

  let dayCounter = 1;

  for (let row = 0; row < rows; row++) {
    const weekNum = document.createElement("div");
    weekNum.className = "calendar-week-number";
    weekNum.textContent = getWeekNumber(new Date(year, month, Math.max(1, dayCounter)));
    grid.appendChild(weekNum);

    for (let col = 0; col < 7; col++) {
      const cellIndex = row * 7 + col;
      const dayCell = document.createElement("div");
      dayCell.className = "calendar-day";

      if (cellIndex >= firstDay && dayCounter <= daysInMonth) {
        const day = dayCounter;
        const dateKey = getDateKey(year, month, day);
        const dayEvents = getEventsForDate(_calendarEvents, dateKey);

        dayCell.textContent = day;

        if (dayEvents.length > 0) {
          dayCell.classList.add("has-event");
          const dotsContainer = document.createElement("div");
          dotsContainer.className = "calendar-day-dots";
          dayEvents.slice(0, 4).forEach((ev) => {
            const dot = document.createElement("span");
            dot.className = "calendar-day-dot";
            dot.style.background = ev.color || EVENT_COLORS[0];
            dotsContainer.appendChild(dot);
          });
          if (dayEvents.length > 4) {
            const more = document.createElement("span");
            more.className = "calendar-day-more-dots";
            more.textContent = `+${dayEvents.length - 4}`;
            dotsContainer.appendChild(more);
          }
          dayCell.appendChild(dotsContainer);
        }

        if (isCurrentMonth && day === currentDay) {
          dayCell.classList.add("today");
        }

        if (col === 0 || col === 6) {
          dayCell.classList.add("weekend");
        }

        dayCell.onclick = () => {
          showDayEventsModal(dateKey);
        };

        dayCounter++;
      } else {
        dayCell.classList.add("empty");
      }

      grid.appendChild(dayCell);
    }
  }

  renderAgenda(agenda);
  renderAlarmSection(alarmSection);
  renderAppButtons(appButtons);

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

function renderAgenda(agendaEl) {
  agendaEl.innerHTML = "";

  const title = document.createElement("div");
  title.className = "calendar-agenda-title";
  title.innerHTML = '<i class="fas fa-bolt" style="color:var(--brand);margin-right:4px"></i> Agenda';
  agendaEl.appendChild(title);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayKey = getDateKey(today.getFullYear(), today.getMonth(), today.getDate());
  const todayEvents = getEventsForDate(_calendarEvents, todayKey);

  const upcomingEvents = _calendarEvents
    .filter((ev) => new Date(ev.date) >= today || ev.recurring)
    .sort((a, b) => {
      const da = new Date(a.date);
      const db = new Date(b.date);
      if (da - db !== 0) return da - db;
      return (a.time || "00:00").localeCompare(b.time || "00:00");
    })
    .slice(0, 5);

  if (todayEvents.length > 0) {
    const todaySummary = document.createElement("div");
    todaySummary.className = "calendar-today-summary";
    todaySummary.textContent = `${todayEvents.length} plan${todayEvents.length > 1 ? "s" : ""} today`;
    agendaEl.insertBefore(todaySummary, agendaEl.firstChild.nextSibling);
  }

  if (upcomingEvents.length === 0) {
    const noEvents = document.createElement("div");
    noEvents.className = "calendar-no-events";
    noEvents.textContent = "Nothing coming up.";
    agendaEl.appendChild(noEvents);
    return;
  }

  upcomingEvents.forEach((ev) => {
    const eventEl = document.createElement("div");
    eventEl.className = "calendar-agenda-item";

    const iconEl = document.createElement("i");
    iconEl.className = `fas ${ev.icon || "fa-bolt"} calendar-agenda-icon`;
    iconEl.style.color = ev.color || EVENT_COLORS[0];
    eventEl.appendChild(iconEl);

    const dateEl = document.createElement("span");
    dateEl.className = "calendar-agenda-date";
    const eventDate = new Date(ev.date);
    const isToday = eventDate.toDateString() === new Date().toDateString();
    dateEl.textContent = isToday ? "Today" : eventDate.toLocaleDateString([], { month: "short", day: "numeric" });
    eventEl.appendChild(dateEl);

    const textEl = document.createElement("span");
    textEl.className = "calendar-agenda-text";
    let displayText = ev.title;
    if (ev.time) displayText = `${ev.time.slice(0, 5)} ${displayText}`;
    textEl.textContent = displayText.length > 35 ? displayText.substring(0, 35) + "..." : displayText;
    eventEl.appendChild(textEl);

    if (ev.notes) {
      const notesEl = document.createElement("span");
      notesEl.className = "calendar-agenda-notes";
      notesEl.textContent = ev.notes.length > 20 ? ev.notes.substring(0, 20) + "..." : ev.notes;
      eventEl.appendChild(notesEl);
    }

    eventEl.onclick = () =>
      showEventFormModal(getDateKey(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate()), ev);
    agendaEl.appendChild(eventEl);
  });
}

function renderAlarmSection(alarmSection) {
  alarmSection.innerHTML = "";

  const nextAlarm = getNextAlarm();
  if (nextAlarm) {
    const alarmEl = document.createElement("div");
    alarmEl.className = "calendar-alarm-item";
    alarmEl.innerHTML = `
      <i class="fas fa-bell calendar-alarm-icon"></i>
      <span class="calendar-alarm-label">Next Alarm</span>
      <span class="calendar-alarm-time">${nextAlarm.time}</span>
    `;
    if (nextAlarm.label) {
      const labelEl = document.createElement("span");
      labelEl.className = "calendar-alarm-name";
      labelEl.textContent = nextAlarm.label;
      alarmEl.appendChild(labelEl);
    }
    alarmSection.appendChild(alarmEl);
  }
}

function renderAppButtons(container) {
  container.innerHTML = `
    <button class="calendar-open-btn" id="calendar-open-clock">
      <i class="fas fa-clock"></i> Open Clock
    </button>
  `;

  container.querySelector("#calendar-open-clock").onclick = () => {
    closeCalendarPopup();
    os.app.launch("clockApp");
  };
}

export function setCurrentCalendarMonth() {
  _currentCalendarMonth = new Date();
}
