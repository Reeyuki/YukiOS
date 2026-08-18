import { MODES } from "../../modeManager.js";
import { BusEvents } from "../../core/EventBus.js";
import { os } from "../../framework.js";
import { steamDeckManager } from "./SteamDeckManager.js";
import { playDeckBootVideo } from "./deckBootVideo.js";
import { SessionMode } from "../shared/sessionBase.js";

const steamDeckSession = new SessionMode(MODES.STEAMDECK);

let headerMouseMoveHandler = null;

export function applySteamDeckSettings() {
  steamDeckSession.enter();
  steamDeckManager.setup();
  playDeckBootVideo();
  
  headerMouseMoveHandler = (e) => {
    const threshold = 50;
    if (e.clientY < threshold) {
      document.querySelectorAll(".window.deck-launched .window-header").forEach((header) => {
        header.classList.add("deck-header-visible");
      });
    } else {
      document.querySelectorAll(".window.deck-launched .window-header").forEach((header) => {
        header.classList.remove("deck-header-visible");
      });
    }
  };
  document.addEventListener("mousemove", headerMouseMoveHandler);
}

export function disableSteamDeckSettings() {
  steamDeckManager.teardown();
  steamDeckSession.exit();
  if (headerMouseMoveHandler) {
    document.removeEventListener("mousemove", headerMouseMoveHandler);
    headerMouseMoveHandler = null;
  }
  document.querySelectorAll(".window-header").forEach((header) => {
    header.classList.remove("deck-header-visible");
  });
}
