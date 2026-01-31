import { defaultStorage } from "./fs.js";

const WALLPAPER_KEY = "desktopOS_selectedWallpaper";

export class SystemUtilities {
  static startClock() {
    const clock = document.getElementById("clock");
    const date = document.getElementById("date");
    if (!clock | !date) return;
    const updateClock = () => {
      const now = new Date();
      clock.textContent = now.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      });
      date.textContent = now.toLocaleDateString();
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

    if (!wallpapers.length) return;

    const randomWallpaper = wallpapers[Math.floor(Math.random() * wallpapers.length)];
    this.setWallpaper(randomWallpaper);
  }

  static setWallpaper(wallpaperURL) {
    if (!wallpaperURL) return;

    const isVideo = wallpaperURL.toLowerCase().endsWith(".mp4");

    let existing = document.getElementById("wallpaper-img") || document.getElementById("wallpaper-video");
    if (existing) existing.remove();

    let el;

    if (isVideo) {
      el = document.createElement("video");
      el.id = "wallpaper-video";
      el.src = wallpaperURL;
      el.autoplay = true;
      el.loop = true;
      el.muted = true;
      el.playsInline = true;
    } else {
      el = document.createElement("img");
      el.id = "wallpaper-img";
      el.src = wallpaperURL;
    }

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
    if (saved) {
      this.setWallpaper(saved);
    } else {
      this.setRandomWallpaper();
    }
  }
}
