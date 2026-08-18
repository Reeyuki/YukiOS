import { createElement } from "../../framework.js";
import { resolveYukiAsset } from "../../shared/assetResolver.js";
import { SteamSettings } from "../../games/steamSettings.js";
import { KeybindManager } from "../../keybindManager.js";

const BOOT_VIDEO_ID = "steamdeck-boot-video";
let deckBootPlayed = false;

export function isDeckBootVideoVisible() {
  return !!document.getElementById(BOOT_VIDEO_ID);
}

function getBootVideoUrl() {
  const hostname = window.location?.hostname || "";
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
  return isLocal ? "http://localhost:4001/static/videos/deckboot.mp4" : resolveYukiAsset("static/videos/deckboot.mp4");
}

export function playDeckBootVideo() {
  if (deckBootPlayed) return;
  deckBootPlayed = true;
  const settings = SteamSettings.load();
  if (settings.deckBootAnimation === false) return;

  const overlay = createElement("div", {
    id: BOOT_VIDEO_ID,
    className: "deck-boot-video-overlay"
  });

  const video = createElement("video", {
    attributes: {
      autoplay: "",
      playsinline: "",
      src: getBootVideoUrl()
    }
  });

  overlay.appendChild(video);

  const disclaimer = createElement("div", {
    className: "deck-boot-disclaimer",
    text: "YukiOS is an independent fan recreation and is not affiliated with, endorsed by, or connected to Steam or Valve."
  });
  overlay.appendChild(disclaimer);

  const skipHint = createElement("div", {
    className: "deck-boot-skip-hint",
    text: "Esc \u00B7 Enter \u00B7 Space to skip"
  });
  overlay.appendChild(skipHint);

  document.body.appendChild(overlay);

  let skipHandler = null;

  const removeOverlay = () => {
    document.removeEventListener("keydown", skipHandler);
    overlay.classList.add("deck-boot-video-fadeout");
    setTimeout(() => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 800);
  };

  const startPlayback = () => {
    try {
      video.play().catch(() => {
        setTimeout(removeOverlay, 12000);
      });
    } catch {
      setTimeout(removeOverlay, 12000);
    }
  };

  video.addEventListener("ended", removeOverlay, { once: true });
  if (video.readyState >= 2) {
    startPlayback();
  } else {
    video.addEventListener("loadeddata", startPlayback, { once: true });
    video.addEventListener("error", removeOverlay, { once: true });
    setTimeout(removeOverlay, 12000);
  }

  const isSkipKey = (e) => e.key === "Escape" || e.key === "Enter" || e.key === " " || e.key === "Spacebar";

  skipHandler = (e) => {
    if (!isSkipKey(e) && !KeybindManager.matches(e, "boot.skip")) return;
    e.preventDefault();
    e.stopPropagation();
    removeOverlay();
  };
  document.addEventListener("keydown", skipHandler);
}
