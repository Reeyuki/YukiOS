import { videos } from "./wallpaperList.js";
import { detectUserLocation } from "./weather.js";
import { getWeatherIcon } from "./shared/weatherCodes.js";
import { getBrowser } from "./shared/platformUtils.js";
import { StorageKeys } from "./settings.js";

const loginBtn = document.getElementById("login-btn");
const login = document.getElementById("login");
let settings;
let _skipUsernameUpdate = false;

loginBtn.addEventListener("click", () => {
  login.classList.add("fade-out");
  login.classList.remove("active");
  login.addEventListener("transitionend", () => login.remove(), { once: true });
  if (!_skipUsernameUpdate) {
    settings.updateUsername();
  }
  _skipUsernameUpdate = false;
});

let pageLoadTime;
let isLoginned = false;

function startLoginClock() {
  pageLoadTime = Date.now();
  isLoginned = true;
}

function getGreeting(username) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning " : hour < 18 ? "Good afternoon " : "Good evening ";
  return greeting + (username || "");
}

function showLogin() {
  const savedUsername = localStorage.getItem("yukiOS_username");
  if (savedUsername) {
    const usernameInput = document.getElementById("username");
    if (usernameInput) usernameInput.value = savedUsername;
  }
  document.getElementById("loginGreeting").textContent = getGreeting(savedUsername);
  login.classList.add("active");
  login.classList.remove("is-hidden");
  startLoginClock();
}

let _weatherIntervalId = null;
let _weatherWidget = null;

let _currentWallpaperBlobUrl = null;

function _revokeWallpaperBlob() {
  if (_currentWallpaperBlobUrl) {
    URL.revokeObjectURL(_currentWallpaperBlobUrl);
    _currentWallpaperBlobUrl = null;
  }
}

function _isBase64Video(str) {
  return typeof str === "string" && str.startsWith("data:video/");
}

function _isBase64Image(str) {
  return typeof str === "string" && str.startsWith("data:image/");
}

function _base64ToBlobUrl(dataUrl) {
  const [header, b64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)[1];
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime });
  return URL.createObjectURL(blob);
}

const WP_BLOB_DB_NAME = "wallpaper-blobs-db";
const WP_BLOB_DB_VERSION = 1;
const WP_BLOB_STORE = "wallpapers";
const WP_BLOB_KEY = "current";

let _wpBlobDB = null;

function _openWpBlobDB() {
  if (_wpBlobDB) return Promise.resolve(_wpBlobDB);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(WP_BLOB_DB_NAME, WP_BLOB_DB_VERSION);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(WP_BLOB_STORE);
    };
    req.onsuccess = (e) => {
      _wpBlobDB = e.target.result;
      resolve(_wpBlobDB);
    };
    req.onerror = (e) => reject(e);
  });
}

async function _storeWallpaperBlob(blob) {
  const db = await _openWpBlobDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WP_BLOB_STORE, "readwrite");
    tx.objectStore(WP_BLOB_STORE).put(blob, WP_BLOB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e);
  });
}

async function _loadWallpaperBlob() {
  const db = await _openWpBlobDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WP_BLOB_STORE, "readonly");
    const req = tx.objectStore(WP_BLOB_STORE).get(WP_BLOB_KEY);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = (e) => reject(e);
  });
}

async function _clearWallpaperBlob() {
  const db = await _openWpBlobDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WP_BLOB_STORE, "readwrite");
    tx.objectStore(WP_BLOB_STORE).delete(WP_BLOB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e);
  });
}
let _calendarPopup = null;
let _currentCalendarMonth = new Date();
let _calendarEvents = JSON.parse(localStorage.getItem("yukiOS_calendar_events") || "{}");
let _calendarTimeInterval = null;

function saveCalendarEvents() {
  localStorage.setItem("yukiOS_calendar_events", JSON.stringify(_calendarEvents));
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

function createCalendarPopup() {
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
    const weekDate = new Date(year, month, dayCounter - firstDay + row * 7);
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

export class SystemUtilities {
  static setSettings(_settings) {
    settings = _settings;
  }

  static startClock() {
    const clock = document.getElementById("clock");
    const date = document.getElementById("date");
    const uptime = document.getElementById("uptime");
    if (!clock || !date) return;

    date.style.cursor = "pointer";
    date.addEventListener("click", (e) => {
      e.stopPropagation();
      _currentCalendarMonth = new Date();
      createCalendarPopup();
    });

    const updateClock = () => {
      const now = new Date();
      clock.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      date.textContent = now.toLocaleDateString();
      if (uptime && isLoginned) {
        uptime.textContent = `${Math.floor((Date.now() - pageLoadTime) / 60000)} min`;
      }
    };
    setInterval(updateClock, 1000);
    updateClock();
  }

  static async startTaskbarWeather(appLauncher) {
    if (localStorage.getItem("yukiOS_weather") === "false") return;

    const tray = document.getElementById("system-tray");
    if (!tray) return;

    if (!_weatherWidget) {
      const widget = document.createElement("div");
      widget.id = "taskbar-weather";
      widget.style.cssText = `
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 1.1em;
        cursor: default;
        padding: 0 6px;
        opacity: 0.85;
        white-space: nowrap;
      `;
      widget.textContent = "…";
      widget.addEventListener("click", () => {
        appLauncher?.launch("weatherApp");
      });
      const clock = document.getElementById("clock");
      clock ? tray.insertBefore(widget, clock) : tray.prepend(widget);
      _weatherWidget = widget;
    }

    const fetchAndRender = async () => {
      try {
        const loc = await detectUserLocation();
        const weatherRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,weather_code`
        );
        const weatherData = await weatherRes.json();
        const temp = Math.round(weatherData.current.temperature_2m);
        const icon = getWeatherIcon(weatherData.current.weather_code);
        _weatherWidget.textContent = `${icon} ${temp}°C`;
        _weatherWidget.title = `${loc.city}, ${loc.country} — click to open`;
        _weatherWidget.style.cursor = "pointer";
      } catch {
        _weatherWidget.textContent = "";
        _weatherWidget.style.display = "none";
      }
    };

    fetchAndRender();
    _weatherIntervalId = setInterval(fetchAndRender, 10 * 60 * 1000);
  }

  static stopTaskbarWeather() {
    if (_weatherIntervalId !== null) {
      clearInterval(_weatherIntervalId);
      _weatherIntervalId = null;
    }
    if (_weatherWidget) {
      _weatherWidget.remove();
      _weatherWidget = null;
    }
  }

  static setSequentialWallpaper() {
    const isManual = localStorage.getItem(StorageKeys.manualWallpaper) === "true";
    if (isManual) return;

    const shouldCycle = localStorage.getItem(StorageKeys.cycleWallpaper) !== "false";
    const existing = localStorage.getItem(StorageKeys.wallpaperKey);
    if (!shouldCycle && existing) return;

    let index = parseInt(localStorage.getItem(StorageKeys.wallpaperIndexKey)) || 0;
    if (shouldCycle) {
      index = (index + 1) % videos.length;
      localStorage.setItem(StorageKeys.wallpaperIndexKey, String(index));
    }

    const wallpaper = videos[index];
    localStorage.setItem(StorageKeys.wallpaperKey, wallpaper);
    _clearWallpaperBlob().catch(() => {});
    this.applyWallpaper(wallpaper);
  }

  static async setWallpaper(wallpaperURL) {
    if (!wallpaperURL) return;

    localStorage.setItem(StorageKeys.manualWallpaper, "true");
    localStorage.setItem(StorageKeys.cycleWallpaper, "false");
    const toggle = document.getElementById("settingsCycleWallpaper");
    if (toggle) toggle.checked = false;
    if (settings) {
      settings._settings.cycleWallpaper = false;
      if (window._settings) window._settings.cycleWallpaper = false;
    }

    if (_isBase64Video(wallpaperURL)) {
      const [header, b64] = wallpaperURL.split(",");
      const mime = header.match(/:(.*?);/)[1];
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: mime });

      await _storeWallpaperBlob(blob);
      localStorage.setItem(StorageKeys.wallpaperKey, "__blob_video__");
      this._applyVideoBlob(blob);
    } else if (_isBase64Image(wallpaperURL)) {
      if (wallpaperURL.length > 524288) {
        const [header, b64] = wallpaperURL.split(",");
        const mime = header.match(/:(.*?);/)[1];
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: mime });
        await _storeWallpaperBlob(blob);
        localStorage.setItem(StorageKeys.wallpaperKey, "__blob_image__");
        this._applyImageBlob(blob);
      } else {
        await _clearWallpaperBlob().catch(() => {});
        localStorage.setItem(StorageKeys.wallpaperKey, wallpaperURL);
        this.applyWallpaper(wallpaperURL);
      }
    } else {
      await _clearWallpaperBlob().catch(() => {});
      localStorage.setItem(StorageKeys.wallpaperKey, wallpaperURL);
      this.applyWallpaper(wallpaperURL);
    }
  }

  static _applyVideoBlob(blob) {
    _revokeWallpaperBlob();
    _currentWallpaperBlobUrl = URL.createObjectURL(blob);

    document.getElementById("wallpaper-img")?.remove();
    document.getElementById("wallpaper-video")?.remove();

    const el = Object.assign(document.createElement("video"), {
      id: "wallpaper-video",
      src: _currentWallpaperBlobUrl,
      autoplay: true,
      loop: true,
      muted: true,
      playsInline: true
    });

    Object.assign(el.style, {
      position: "fixed",
      top: "50%",
      left: "50%",
      width: "100%",
      height: "100%",
      objectFit: "cover",
      transform: "translate(-50%, -50%)",
      zIndex: "-1",
      pointerEvents: "none",
      userSelect: "none"
    });
    el.addEventListener("contextmenu", (e) => e.preventDefault());
    document.body.appendChild(el);
  }

  static _applyImageBlob(blob) {
    _revokeWallpaperBlob();
    _currentWallpaperBlobUrl = URL.createObjectURL(blob);

    document.getElementById("wallpaper-img")?.remove();
    document.getElementById("wallpaper-video")?.remove();

    const el = Object.assign(document.createElement("img"), {
      id: "wallpaper-img",
      src: _currentWallpaperBlobUrl
    });

    Object.assign(el.style, {
      position: "fixed",
      top: "50%",
      left: "50%",
      width: "100%",
      height: "100%",
      objectFit: "cover",
      transform: "translate(-50%, -50%)",
      zIndex: "-1",
      pointerEvents: "none",
      userSelect: "none"
    });
    el.addEventListener("contextmenu", (e) => e.preventDefault());
    document.body.appendChild(el);
  }

  static applyWallpaper(wallpaperURL) {
    if (!wallpaperURL) return;

    if (_isBase64Video(wallpaperURL)) {
      _revokeWallpaperBlob();
      _currentWallpaperBlobUrl = _base64ToBlobUrl(wallpaperURL);

      document.getElementById("wallpaper-img")?.remove();
      document.getElementById("wallpaper-video")?.remove();

      const el = Object.assign(document.createElement("video"), {
        id: "wallpaper-video",
        src: _currentWallpaperBlobUrl,
        autoplay: true,
        loop: true,
        muted: true,
        playsInline: true
      });

      Object.assign(el.style, {
        position: "fixed",
        top: "50%",
        left: "50%",
        width: "100%",
        height: "100%",
        objectFit: "cover",
        transform: "translate(-50%, -50%)",
        zIndex: "-1",
        pointerEvents: "none",
        userSelect: "none"
      });
      el.addEventListener("contextmenu", (e) => e.preventDefault());
      document.body.appendChild(el);
      return;
    }

    if (_isBase64Image(wallpaperURL)) {
      _revokeWallpaperBlob();
      _currentWallpaperBlobUrl = _base64ToBlobUrl(wallpaperURL);

      document.getElementById("wallpaper-img")?.remove();
      document.getElementById("wallpaper-video")?.remove();

      const el = Object.assign(document.createElement("img"), {
        id: "wallpaper-img",
        src: _currentWallpaperBlobUrl
      });

      Object.assign(el.style, {
        position: "fixed",
        top: "50%",
        left: "50%",
        width: "100%",
        height: "100%",
        objectFit: "cover",
        transform: "translate(-50%, -50%)",
        zIndex: "-1",
        pointerEvents: "none",
        userSelect: "none"
      });
      el.addEventListener("contextmenu", (e) => e.preventDefault());
      document.body.appendChild(el);
      return;
    }

    _revokeWallpaperBlob();

    const isVideo = wallpaperURL.toLowerCase().endsWith(".mp4");

    document.getElementById("wallpaper-img")?.remove();
    document.getElementById("wallpaper-video")?.remove();

    const el = isVideo
      ? Object.assign(document.createElement("video"), {
          id: "wallpaper-video",
          src: wallpaperURL,
          autoplay: true,
          loop: true,
          muted: true,
          playsInline: true
        })
      : Object.assign(document.createElement("img"), {
          id: "wallpaper-img",
          src: wallpaperURL
        });

    Object.assign(el.style, {
      position: "fixed",
      top: "50%",
      left: "50%",
      width: "100%",
      height: "100%",
      objectFit: "cover",
      transform: "translate(-50%, -50%)",
      zIndex: "-1",
      pointerEvents: "none",
      userSelect: "none"
    });
    el.addEventListener("contextmenu", (e) => e.preventDefault());
    document.body.appendChild(el);
  }

  static async loadWallpaper() {
    const shouldCycle = localStorage.getItem(StorageKeys.cycleWallpaper) !== "false";
    const isManual = localStorage.getItem(StorageKeys.manualWallpaper) === "true";
    const saved = localStorage.getItem(StorageKeys.wallpaperKey);

    if (saved === "__blob_video__" || saved === "__blob_image__") {
      try {
        const blob = await _loadWallpaperBlob();
        if (blob) {
          if (saved === "__blob_video__") {
            this._applyVideoBlob(blob);
          } else {
            this._applyImageBlob(blob);
          }
          return;
        }
      } catch (e) {
        console.warn("Failed to load wallpaper blob, falling back", e);
      }
      this.setSequentialWallpaper();
      return;
    }

    if (isManual && saved) {
      this.applyWallpaper(saved);
    } else if (shouldCycle) {
      this.setSequentialWallpaper();
    } else if (saved) {
      this.applyWallpaper(saved);
    } else {
      this.setSequentialWallpaper();
    }
  }
}

let isStartedBooting = false;

function startBootSequence() {
  if (isStartedBooting) return;
  isStartedBooting = true;
  const messages = [
    "Starting boot sequence for YukiOS...",
    "Finished running startup functions.",
    "Starting graphical user interface...",
    "System ready! :D"
  ];
  const messagesContainer = document.getElementById("bootMessages");
  const loadingBar = document.getElementById("loadingBar");

  messages.forEach((msg, index) => {
    setTimeout(() => {
      const msgEl = document.createElement("div");
      msgEl.className = "boot-message";
      msgEl.textContent = `[OK] ${msg}`;
      messagesContainer.appendChild(msgEl);
      loadingBar.style.width = `${((index + 1) / messages.length) * 100}%`;
      if (index === messages.length - 1) {
        setTimeout(() => {
          document.getElementById("bootloader").classList.add("hidden");
          showLogin();
        }, 500);
      }
    }, index * 250);
  });
}

export function skipBootSequence() {
  if (isStartedBooting) return;
  isStartedBooting = true;
  document.getElementById("bootloader")?.classList.add("hidden");
  showLogin();
  _skipUsernameUpdate = true;
  document.getElementById("login-btn").click();
}

document.querySelector(".boot-option").addEventListener("click", startBootSequence);
document.body.addEventListener("keydown", (e) => {
  if (e.key === "Enter") startBootSequence();
});

const browser = document.getElementById("browserInfo");
browser.textContent = getBrowser();
