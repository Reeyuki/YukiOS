import { resolveGhUrl } from "../../shared/assetResolver.js";
import { audioMixer } from "../../audioMixer.js";
import { os, StorageKeys } from "../../framework.js";

const AUDIO_FILES = {
  slide: "slide.opus",
  launchGame: "launchgame.opus",
  intoGameDetail: "intogamedetail.opus",
  hideSidebarModal: "hidesidebarmodal.opus",
  railChange: "rail_change.opus",
  switchNav: "switch_nav.opus",
  navigation: "navigation.opus",
  toggleChange: "toggle_change.opus",
  sliderTick: "slider_tick.opus",
  sliderMax: "slider_max.opus"
};

export class SteamDeckAudio {
  constructor() {}

  playSlide() {
    this.play(AUDIO_FILES.slide);
  }

  playLaunchGame() {
    this.play(AUDIO_FILES.launchGame);
  }

  playIntoGameDetail() {
    this.play(AUDIO_FILES.intoGameDetail);
  }

  playHideSidebarModal() {
    this.play(AUDIO_FILES.hideSidebarModal);
  }

  playRailChange() {
    this.play(AUDIO_FILES.railChange);
  }

  playSwitchNav() {
    this.play(AUDIO_FILES.switchNav);
  }

  playNavigation() {
    this.play(AUDIO_FILES.navigation);
  }

  playToggleChange() {
    this.play(AUDIO_FILES.toggleChange);
  }

  playSliderTick() {
    this.play(AUDIO_FILES.sliderTick);
  }

  playSliderMax() {
    this.play(AUDIO_FILES.sliderMax);
  }

  play(file) {
    this.playAudio(file);
  }

  playAudio(file) {
    if (os.storage.get(StorageKeys.steamDeckAudioEnabled) === "false") return;
    const url = resolveGhUrl(
      `https://cdn.jsdelivr.net/gh/Reeyuki/yukios@main/static/audio/deck/${file}`
    );
    const audio = new Audio(url);
    audio.preload = "auto";
    audio.volume = audioMixer().masterVolume * audioMixer().systemVolume;
    const playPromise = audio.play();
    if (playPromise) {
      playPromise.catch((error) => {
        console.warn(`Failed to play Steam Deck audio: ${file}`, error);
      });
    }
    audio.addEventListener("ended", () => audio.remove(), { once: true });
  }
}

export const steamDeckAudio = new SteamDeckAudio();