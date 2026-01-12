import { defaultStorage } from "./fs.js";

const WALLPAPER_KEY = "desktopOS_selectedWallpaper";

export class SystemUtilities {
  static startClock() {
    const updateClock = () => {
      const now = new Date();
      document.getElementById("clock").textContent = now.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      });
      document.getElementById("date").textContent = now.toLocaleDateString();
    };
    setInterval(updateClock, 1000);
    updateClock();
  }

  static setRandomWallpaper() {
    const pictures = defaultStorage.home.reeyuki.Pictures;
    const wallpapers = Object.values(pictures)
      .filter((item) => item.kind === "image")
      .map((item) => item.content);

    if (!wallpapers.length) return;

    const randomWallpaper = wallpapers[Math.floor(Math.random() * wallpapers.length)];
    this.setWallpaper(randomWallpaper);
  }

  static setWallpaper(wallpaperURL) {
    let img = document.getElementById("wallpaper-img");

    if (!img) {
      img = document.createElement("img");
      img.id = "wallpaper-img";
      Object.assign(img.style, {
        position: "fixed",
        inset: "0",
        width: "100vw",
        height: "100vh",
        objectFit: "cover",
        zIndex: "-1",
        pointerEvents: "none",
        userSelect: "none"
      });
      img.addEventListener("contextmenu", (e) => e.preventDefault());
      document.body.appendChild(img);
    }

    img.src = wallpaperURL;

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
