import { StorageKeys } from "./settings.js";

let _calendarPopup = null;
let _currentCalendarMonth = new Date();
let _calendarEvents;
setTimeout(() => {
  _calendarEvents = JSON.parse(localStorage.getItem(StorageKeys.calendarEvents) || "{}");
}, 0);
let _calendarTimeInterval = null;

function saveCalendarEvents() {
  localStorage.setItem(StorageKeys.calendarEvents, JSON.stringify(_calendarEvents));
}

function getEventKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

export function createCalendarPopup() {
  if (_calendarPopup) {
    closeCalendarPopup();
    return;
  }

  const popup = document.createElement("div");
  popup.id = "calendar-popup";
  popup.className = "calendar-popup";

  const timeDisplay = document.createElement("div");
  timeDisplay.className = "calendar-time-display";

  const header = document.createElement("div");
  header.className = "calendar-header";

  const prevBtn = document.createElement("button");
  prevBtn.className = "calendar-nav-btn";
  prevBtn.textContent = "‹";
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
  nextBtn.textContent = "›";
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

  popup.appendChild(timeDisplay);
  popup.appendChild(header);
  popup.appendChild(grid);
  popup.appendChild(agenda);
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

  const dateEl = document.getElementById("date");
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
  if (timeDisplay) {
    const now = new Date();
    timeDisplay.textContent = now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  }
}

function handleCalendarKeydown(e) {
  if (!_calendarPopup) return;

  if (e.key === "Escape") {
    closeCalendarPopup();
  } else if (e.key === "ArrowLeft") {
    _currentCalendarMonth.setMonth(_currentCalendarMonth.getMonth() - 1);
    renderCalendar();
  } else if (e.key === "ArrowRight") {
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
  if (e.target.closest(".calendar-modal-overlay")) return;
  if (_calendarPopup && !_calendarPopup.contains(e.target) && e.target.id !== "date") {
    closeCalendarPopup();
  }
}
function showEventModal(dateKey, existingEvent = "") {
  const overlay = document.createElement("div");
  overlay.className = "calendar-modal-overlay";

  const modal = document.createElement("div");
  modal.className = "calendar-modal";

  const title = document.createElement("div");
  title.className = "calendar-modal-title";
  title.textContent = `Event for ${dateKey}`;

  const input = document.createElement("textarea");
  input.className = "calendar-modal-input";
  input.placeholder = "Enter event details...";
  input.value = existingEvent;

  const buttons = document.createElement("div");
  buttons.className = "calendar-modal-buttons";

  const saveBtn = document.createElement("button");
  saveBtn.className = "calendar-modal-btn save";
  saveBtn.textContent = "Save";
  saveBtn.onclick = () => {
    const value = input.value.trim();
    if (value) {
      _calendarEvents[dateKey] = value;
    } else {
      delete _calendarEvents[dateKey];
    }
    saveCalendarEvents();
    overlay.remove();
    renderCalendar();
  };

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "calendar-modal-btn delete";
  deleteBtn.textContent = "Delete";
  deleteBtn.onclick = () => {
    delete _calendarEvents[dateKey];
    saveCalendarEvents();
    overlay.remove();
    renderCalendar();
  };

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "calendar-modal-btn cancel";
  cancelBtn.textContent = "Cancel";
  cancelBtn.onclick = () => overlay.remove();

  buttons.appendChild(saveBtn);
  if (existingEvent) buttons.appendChild(deleteBtn);
  buttons.appendChild(cancelBtn);

  modal.appendChild(title);
  modal.appendChild(input);
  modal.appendChild(buttons);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  input.focus();

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

function renderCalendar() {
  if (!_calendarPopup) return;

  const monthYear = _calendarPopup.querySelector(".calendar-month-year");
  const grid = _calendarPopup.querySelector(".calendar-grid");
  const agenda = _calendarPopup.querySelector(".calendar-agenda");

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
        dayCell.textContent = day;

        const dateKey = getEventKey(year, month, day);
        const hasEvent = _calendarEvents[dateKey];

        if (hasEvent) {
          dayCell.classList.add("has-event");
          dayCell.title = hasEvent;
        }

        if (isCurrentMonth && day === currentDay) {
          dayCell.classList.add("today");
        }

        if (col === 0 || col === 6) {
          dayCell.classList.add("weekend");
        }

        dayCell.onclick = () => {
          showEventModal(dateKey, _calendarEvents[dateKey] || "");
        };

        dayCounter++;
      } else {
        dayCell.classList.add("empty");
      }

      grid.appendChild(dayCell);
    }
  }

  renderAgenda(agenda);

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
  title.textContent = "📅 Upcoming Events";
  agendaEl.appendChild(title);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcomingEvents = Object.entries(_calendarEvents)
    .filter(([key]) => new Date(key) >= today)
    .sort(([a], [b]) => new Date(a) - new Date(b))
    .slice(0, 5);

  if (upcomingEvents.length === 0) {
    const noEvents = document.createElement("div");
    noEvents.className = "calendar-no-events";
    noEvents.textContent = "No upcoming events";
    agendaEl.appendChild(noEvents);
    return;
  }

  upcomingEvents.forEach(([dateKey, event]) => {
    const eventEl = document.createElement("div");
    eventEl.className = "calendar-agenda-item";

    const dateEl = document.createElement("span");
    dateEl.className = "calendar-agenda-date";
    const eventDate = new Date(dateKey);
    const isToday = eventDate.toDateString() === new Date().toDateString();
    dateEl.textContent = isToday ? "Today" : eventDate.toLocaleDateString([], { month: "short", day: "numeric" });

    const textEl = document.createElement("span");
    textEl.className = "calendar-agenda-text";
    textEl.textContent = event.length > 30 ? event.substring(0, 30) + "…" : event;

    eventEl.appendChild(dateEl);
    eventEl.appendChild(textEl);
    eventEl.onclick = () => showEventModal(dateKey, event);
    agendaEl.appendChild(eventEl);
  });
}
export function setCurrentCalendarMonth() {
  _currentCalendarMonth = new Date();
}
