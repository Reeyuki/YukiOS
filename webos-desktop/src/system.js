import { defaultStorage } from "./fs.js";

const WALLPAPER_KEY = "desktopOS_selectedWallpaper";

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

  static setRandomWallpaper() {
    const pictures = defaultStorage?.home?.reeyuki?.Pictures.Wallpapers;
    if (!pictures || typeof pictures !== "object") return;

    const wallpapers = Object.values(pictures)
      .filter((item) => item && (item.kind === "image" || item.kind === "video") && typeof item.content === "string")
      .map((item) => item.content);

    if (wallpapers.length) this.setWallpaper(wallpapers[Math.floor(Math.random() * wallpapers.length)]);
  }

  static setWallpaper(wallpaperURL) {
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
      inset: "0",
      width: "100vw",
      height: "100vh",
      objectFit: "cover",
      zIndex: "-1",
      pointerEvents: "none",
      userSelect: "none"
    });

    el.addEventListener("contextmenu", (e) => e.preventDefault());
    document.body.appendChild(el);
    localStorage.setItem(WALLPAPER_KEY, wallpaperURL);
  }

  static loadWallpaper() {
    const saved = localStorage.getItem(WALLPAPER_KEY);
    saved ? this.setWallpaper(saved) : this.setRandomWallpaper();
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
