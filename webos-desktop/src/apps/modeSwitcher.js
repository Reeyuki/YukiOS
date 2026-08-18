import "../styles/introTour.css";
import {
  os,
  BusEvents,
  BaseApp,
  $,
  $$,
  setStyle,
  setHTML,
  setText,
  toggleClass,
  createElement,
  StorageKeys
} from "../framework.js";
import { applyMacSettings, disableMacSettings } from "../modes/macos/session.js";
import { applyChromeOsSettings, disableChromeOsSettings } from "../modes/chromeos/session.js";
import { applyTilingSettings, disableTilingSettings } from "../modes/tiling/session.js";
import { applySteamDeckSettings, disableSteamDeckSettings } from "../modes/steamdeck/session.js";
import { SystemUtilities } from "../system.js";

const OVERLAY_SELECTOR = ".intro-tour-overlay";
const DIM_SELECTOR = ".intro-tour-dim";
const CARD_SELECTOR = ".intro-tour-card";
const CARD_ENTER_CLASS = "intro-tour-enter";

let switcher = null;

const MODES = [
  { label: "YukiOS", icon: "fas fa-snowflake", mode: "reset", description: "Default desktop experience" },
  { label: "MacOS", icon: "fab fa-apple", mode: "mac", description: "Mac-style desktop with dock" },
  { label: "SteamDeck", icon: "fas fa-gamepad", mode: "steamdeck", description: "Steam Deck gaming interface" },
  { label: "ChromeOS", icon: "fab fa-chrome", mode: "chromeos", description: "Chromebook-style desktop" },
  { label: "Tiling", icon: "fas fa-th-large", mode: "tiling", description: "Tiling window manager" }
];

function runSwitcher() {
  if (switcher) return;
  if ($(OVERLAY_SELECTOR)) return;
  const dim = createElement("div", { className: "intro-tour-dim" });
  const overlay = createElement("div", { className: "intro-tour-overlay" });
  overlay.appendChild(createElement("div", { className: "intro-tour-spotlight", style: "display:none" }));
  overlay.appendChild(createElement("div", { className: "intro-tour-card" }));
  document.body.appendChild(dim);
  document.body.appendChild(overlay);
  switcher = {
    overlay,
    dim,
    card: $(CARD_SELECTOR, overlay),
    currentMode: null,
    previewWallpaper: null
  };
  window.addEventListener("resize", positionCard);
  renderCard();
}

function renderCard() {
  if (!switcher) return;
  setHTML(
    switcher.card,
    `<div class="intro-tour-icon"><i class="fas fa-layer-group"></i></div>
     <h2 class="intro-tour-title">Switch Desktop Mode</h2>
     <p class="intro-tour-body">Select a mode to preview. Click again to apply permanently.</p>
     <div class="intro-tour-modes">
       ${MODES.map(
         (mode) =>
           `<button type="button" class="intro-tour-mode-btn" data-mode="${mode.mode}">
              <i class="${mode.icon}"></i><span>${mode.label}</span>
            </button>`
       ).join("")}
     </div>
     <div class="intro-tour-actions">
       <button type="button" class="intro-tour-btn intro-tour-btn-secondary">Cancel</button>
     </div>`
  );
  $$(".intro-tour-mode-btn", switcher.card).forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.mode;
      handleModeClick(mode);
    });
  });
  const cancelBtn = $(".intro-tour-btn-secondary", switcher.card);
  cancelBtn.addEventListener("click", cleanup);
  toggleClass(switcher.card, CARD_ENTER_CLASS, false);
  void switcher.card.offsetHeight;
  toggleClass(switcher.card, CARD_ENTER_CLASS, true);
  positionCard();
}

function handleModeClick(mode) {
  if (!switcher) return;
  if (switcher.currentMode === mode) {
    applyModePermanently(mode);
    return;
  }
  disablePreviewModes();
  if (mode === "reset") {
    switcher.currentMode = null;
    restorePreviewWallpaper();
    return;
  }
  if (!switcher.previewWallpaper) {
    switcher.previewWallpaper = {
      key: os.storage.get(StorageKeys.wallpaperKey),
      type: os.storage.get(StorageKeys.wallpaperType)
    };
  }
  enterPreviewMode(mode);
  switcher.currentMode = mode;
}

function enterPreviewMode(mode) {
  if (mode === "mac") {
    applyMacSettings();
  } else if (mode === "chromeos") {
    applyChromeOsSettings();
  } else if (mode === "tiling") {
    applyTilingSettings();
  } else if (mode === "steamdeck") {
    applySteamDeckSettings();
  }
}

function disablePreviewModes() {
  disableMacSettings();
  disableTilingSettings();
  disableChromeOsSettings();
  disableSteamDeckSettings();
}

function restorePreviewWallpaper() {
  if (!switcher?.previewWallpaper) return;
  const saved = switcher.previewWallpaper;
  switcher.previewWallpaper = null;
  if (saved.key) {
    SystemUtilities.setWallpaper(saved.key).catch(() => {});
    os.storage.set(StorageKeys.wallpaperType, saved.type || "image");
  }
}

function applyModePermanently(mode) {
  if (mode === "reset") {
    disablePreviewModes();
    restorePreviewWallpaper();
  } else {
    enterPreviewMode(mode);
  }
  switcher.currentMode = mode;
  cleanup();
}

function positionCard() {
  if (!switcher) return;
  const card = switcher.card;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cardWidth = card.offsetWidth;
  const cardHeight = card.offsetHeight;
  const cardLeft = Math.max(16, Math.min((vw - cardWidth) / 2, vw - cardWidth - 16));
  const cardTop = Math.max(16, Math.min((vh - cardHeight) / 2, vh - cardHeight - 16));
  setStyle(card, { left: cardLeft + "px", top: cardTop + "px" });
}

function cleanup() {
  if (!switcher) return;
  window.removeEventListener("resize", positionCard);
  if (switcher.currentMode && switcher.currentMode !== "reset") {
    disablePreviewModes();
    restorePreviewWallpaper();
  }
  switcher.overlay.remove();
  switcher.dim.remove();
  switcher = null;
}

export class ModeSwitcherApp extends BaseApp {
  constructor(services) {
    super(services);
  }

  open() {
    runSwitcher();
  }

  onClose(winId) {
    cleanup();
  }
}
