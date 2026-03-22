import { videos } from "./wallpapers.js";
import { detectUserLocation } from "./weather.js";
import { getWeatherIcon } from "./shared/weatherCodes.js";
import { getBrowser } from "./shared/platformUtils.js";
import { StorageKeys } from "./settings.js";

const loginBtn = document.getElementById("login-btn");
const login = document.getElementById("login");
let settings;

loginBtn.addEventListener("click", () => {
  login.classList.add("fade-out");
  login.classList.remove("active");
  login.addEventListener("transitionend", () => login.remove(), { once: true });
  settings.updateUsername();
});

let pageLoadTime;
let isLoginned = false;

function startLoginClock() {
  pageLoadTime = Date.now();
  isLoginned = true;
}

function getGreeting(username) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning " : hour < 18 ? "Good afternoon " : "Good night ";
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

export class SystemUtilities {
  static setSettings(_settings) {
    settings = _settings;
  }

  static startClock() {
    const clock = document.getElementById("clock");
    const date = document.getElementById("date");
    const uptime = document.getElementById("uptime");
    if (!clock || !date) return;
    const updateClock = () => {
      const now = new Date();
      clock.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      date.textContent = now.toLocaleDateString();
      if (uptime && isLoginned) {
        uptime.textContent = `${Math.floor((Date.now() - pageLoadTime) / 60000)}m`;
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
          `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,weather_code&timezone=auto`
        );
        const weatherData = await weatherRes.json();
        const temp = Math.round(weatherData.current.temperature_2m);
        const icon = getWeatherIcon(weatherData.current.weather_code);
        _weatherWidget.textContent = `${icon} ${temp}°C`;
        _weatherWidget.title = `${loc.city}, ${loc.country} — click to open weather`;
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
    this.applyWallpaper(wallpaper);
  }

  static setWallpaper(wallpaperURL) {
    if (!wallpaperURL) return;
    localStorage.setItem(StorageKeys.wallpaperKey, wallpaperURL);
    localStorage.setItem(StorageKeys.manualWallpaper, "true");
    localStorage.setItem(StorageKeys.cycleWallpaper, "false");
    const toggle = document.getElementById("settingsCycleWallpaper");
    if (toggle) toggle.checked = false;
    if (settings) {
      settings._settings.cycleWallpaper = false;
      if (window._settings) window._settings.cycleWallpaper = false;
    }
    this.applyWallpaper(wallpaperURL);
  }

  static applyWallpaper(wallpaperURL) {
    if (!wallpaperURL) return;
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

  static loadWallpaper() {
    const shouldCycle = localStorage.getItem(StorageKeys.cycleWallpaper) !== "false";
    const isManual = localStorage.getItem(StorageKeys.manualWallpaper) === "true";
    const saved = localStorage.getItem(StorageKeys.wallpaperKey);
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
  document.getElementById("login-btn").click();
}

document.querySelector(".boot-option").addEventListener("click", startBootSequence);
document.body.addEventListener("keydown", (e) => {
  if (e.key === "Enter") startBootSequence();
});

const browser = document.getElementById("browserInfo");
browser.textContent = getBrowser();
