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
  StorageKeys,
  brand
} from "../framework.js";
import { toggleStartMenu, closeStartMenu } from "../desktopui/startMenu.js";
import { Achievements } from "../achievements.js";
import { applyMacSettings, disableMacSettings } from "../modes/macos/session.js";
import { applyChromeOsSettings, disableChromeOsSettings } from "../modes/chromeos/session.js";
import { applyTilingSettings, disableTilingSettings } from "../modes/tiling/session.js";
import { SystemUtilities } from "../system.js";

const OVERLAY_SELECTOR = ".intro-tour-overlay";
const DIM_SELECTOR = ".intro-tour-dim";
const SPOTLIGHT_SELECTOR = ".intro-tour-spotlight";
const CARD_SELECTOR = ".intro-tour-card";
const CARD_CENTERED_CLASS = "intro-tour-card-centered";
const CARD_ENTER_CLASS = "intro-tour-enter";
const CARD_COMPACT_CLASS = "intro-tour-card-compact";
const BUTTON_PRIMARY_SELECTOR = ".intro-tour-btn-primary";
const BUTTON_SECONDARY_SELECTOR = ".intro-tour-btn-secondary";
const TITLE_SELECTOR = ".intro-tour-title";
const BODY_SELECTOR = ".intro-tour-body";
const START_MENU_SELECTOR = "#start-menu";
const SEARCH_INPUT_SELECTOR = "#start-menu-search";
const GAME_WINDOW_KEY = "games-app";
const GAMES_WIN_SELECTOR = "#games-app-win";
const PALETTE_WIN_SELECTOR = "#command-palette-overlay";
const SETTINGS_WIN_SELECTOR = "#yukiOS-settings";
const BROWSER_WIN_SELECTOR = '[id^="scramjet-window-"]';

const POLL_INTERVAL = 300;
const WAIT_PRIME_DELAY = 700;
const START_MENU_OPEN_DELAY = 300;
const SPOTLIGHT_PAD = 8;
const CARD_GAP = 18;
const REVEAL_Z_INDEX = 2147483500;

function lastWindow(selector) {
  const wins = $$(selector);
  return wins.length ? wins[wins.length - 1] : null;
}

const STEPS = [
  {
    id: "welcome",
    icon: "fas fa-rocket",
    title: brand("This is YukiOS."),
    body: "A full desktop inside one browser tab. No installs, nothing for a school or work network to block, and everything saved right here in this browser. 60 seconds and you'll have seen what it does.",
    buttons: { primary: { label: "Start", action: "advance" } }
  },
  {
    id: "launch-app",
    icon: "fas fa-mouse-pointer",
    title: "Launch anything.",
    body: "The Start Menu searches 90+ apps. Type 'notepad' or 'terminal', then press Enter to open it.",
    target: () => $(SEARCH_INPUT_SELECTOR),
    openMenu: true,
    cardSide: "top",
    compact: true,
    waitForWindow: "any"
  },
  {
    id: "palette",
    icon: "fas fa-keyboard",
    title: "Press Ctrl+K.",
    body: "That opens the command palette, the fastest way to launch anything. Press Ctrl+K now.",
    target: () => $(PALETTE_WIN_SELECTOR) || null,
    cardSide: "bottom",
    waitForWindow: GAME_WINDOW_KEY
  },
  {
    id: "games",
    icon: "fas fa-gamepad",
    title: "2900+ games run right here.",
    body: "This is a game launcher with steam theme. Web games, DOS, Flash, 3DS, retro consoles (Pokemon games), all with no downloads.",
    target: () => $(GAMES_WIN_SELECTOR) || null,
    buttons: { primary: { label: "Got it", action: "advance" } }
  },
  {
    id: "modes",
    icon: "fas fa-layer-group",
    title: "One desktop, four faces.",
    body: "Flip the whole desktop to a Mac, a Chromebook, or a tiling window manager. Try one, then jump back to default mode.",
    modeButtons: [
      { label: brand("YukiOS"), icon: "fas fa-snowflake", mode: "reset" },
      { label: "Mac", icon: "fab fa-apple", mode: "mac" },
      { label: "Chrome OS", icon: "fab fa-chrome", mode: "chromeos" },
      { label: "Tiling", icon: "fas fa-th-large", mode: "tiling" }
    ],
    buttons: { primary: { label: "Got it", action: "advance" } }
  },
  {
    id: "settings",
    icon: "fas fa-palette",
    title: "Make it yours.",
    body: "Settings opens on Appearance, home to 25+ themes. Restyle the wallpaper, taskbar, dock, and sound from here.",
    target: () => $(SETTINGS_WIN_SELECTOR) || null,
    buttons: { primary: { label: "Open Settings", action: "settings" } }
  },
  {
    id: "browser",
    icon: "fas fa-globe",
    title: "A web browser, built in.",
    body: "Bookmarks, tabs, a proxy for blocked sites, even Tor, all inside this tab.",
    target: () => lastWindow(BROWSER_WIN_SELECTOR),
    buttons: { primary: { label: "Open the browser", action: "browser" } }
  },
  {
    id: "persistence",
    icon: "fas fa-circle-check",
    title: "It's all saved.",
    body: "Files, settings, and layouts all persist in this browser. Come back tomorrow and it's exactly where you left it.",
    target: () => $('.taskbar-item.pinned[data-title="Yuki Browser"]'),
    cardSide: "top",
    buttons: {
      secondary: { label: "Done", action: "finish" },
      primary: { label: "Open the Guide", action: "guide" }
    }
  }
];

let tour = null;

export function isIntroTourKeepingStartMenuOpen() {
  return !!tour && !!tour.currentStep?.openMenu;
}

export function startIntroTour() {
  if (tour) return;
  if ($(OVERLAY_SELECTOR)) return;
  const dim = createElement("div", { className: "intro-tour-dim" });
  const overlay = createElement("div", { className: "intro-tour-overlay" });
  overlay.appendChild(createElement("div", { className: "intro-tour-spotlight" }));
  overlay.appendChild(createElement("div", { className: "intro-tour-card" }));
  document.body.appendChild(dim);
  document.body.appendChild(overlay);
  tour = {
    overlay,
    dim,
    spotlight: $(SPOTLIGHT_SELECTOR, overlay),
    card: $(CARD_SELECTOR, overlay),
    stepIndex: -1,
    currentStep: null,
    tourCompleted: false,
    tick: null,
    primeTimer: null,
    menuOpenTimer: null,
    waitPrimed: false,
    palettePhraseShown: false,
    raisedEl: null,
    raisedZ: null,
    actions: null
  };
  os.events.on(BusEvents.WINDOW_CREATED, onWindowCreated);
  window.addEventListener("resize", positionElements);
  window.addEventListener("scroll", positionElements, true);
  tour.tick = window.setInterval(checkCurrentStep, POLL_INTERVAL);
  showStep(0);
}

function onWindowCreated(payload) {
  if (!tour) return;
  const step = tour.currentStep;
  if (!step?.waitForWindow) return;
  const winId = payload?.winId || "";
  const matcher = step.waitForWindow;
  const matched = typeof matcher === "function" ? matcher(winId) : matcher === "any" ? true : winId.includes(matcher);
  if (matched) advance();
}

function checkCurrentStep() {
  if (!tour) return;
  const step = tour.currentStep;
  if (step?.waitFor && tour.waitPrimed && step.waitFor()) {
    advance();
    return;
  }
  if (step?.id === "palette" && !tour.palettePhraseShown && $(PALETTE_WIN_SELECTOR)) {
    tour.palettePhraseShown = true;
    setText($(BODY_SELECTOR, tour.card), "Now type 'steam' and press Enter.");
  }
  positionElements();
}

function showStep(index) {
  if (!tour) return;
  restoreRaised();
  if (tour.modesPreviewed) {
    exitAllPreviewModes();
    tour.modesPreviewed = false;
  }
  const step = STEPS[index];
  tour.stepIndex = index;
  tour.currentStep = step;
  if (index >= STEPS.length - 1) tour.tourCompleted = true;
  tour.waitPrimed = !step.waitFor;
  window.clearTimeout(tour.primeTimer);
  if (step.waitFor) {
    tour.primeTimer = window.setTimeout(() => {
      tour.waitPrimed = true;
    }, WAIT_PRIME_DELAY);
  }
  const buttons = step.buttons || {};
  const secondary = buttons.secondary || { label: "Skip tour", action: "finish" };
  const primary = buttons.primary || { label: "Next", action: "advance" };
  const modeButtons = step.modeButtons || [];
  tour.actions = { secondary: secondary.action, primary: primary.action };
  setHTML(
    tour.card,
    `<div class="intro-tour-counter">Step ${index + 1} of ${STEPS.length}</div>
     <div class="intro-tour-icon"><i class="${step.icon}"></i></div>
     <h2 class="intro-tour-title"></h2>
     <p class="intro-tour-body"></p>
     <div class="intro-tour-modes">
       ${modeButtons
         .map(
           (mode) =>
             `<button type="button" class="intro-tour-mode-btn" data-mode="${mode.mode}">
                <i class="${mode.icon}"></i><span></span>
              </button>`
         )
         .join("")}
     </div>
     <div class="intro-tour-actions">
       <button type="button" class="intro-tour-btn intro-tour-btn-secondary"></button>
       <button type="button" class="intro-tour-btn intro-tour-btn-primary"></button>
     </div>`
  );
  setText($(TITLE_SELECTOR, tour.card), step.title);
  setText($(BODY_SELECTOR, tour.card), step.body);
  setText($(BUTTON_SECONDARY_SELECTOR, tour.card), secondary.label);
  setText($(BUTTON_PRIMARY_SELECTOR, tour.card), primary.label);
  $(BUTTON_SECONDARY_SELECTOR, tour.card).addEventListener("click", () => runAction(tour.actions.secondary));
  $(BUTTON_PRIMARY_SELECTOR, tour.card).addEventListener("click", () => runAction(tour.actions.primary));
  modeButtons.forEach((mode) => {
    const label = mode.label;
    const button = $(`[data-mode="${mode.mode}"]`, tour.card);
    if (!button) return;
    setText($("span", button), label);
    button.addEventListener("click", () => applyMode(mode.mode));
  });
  toggleClass(tour.card, CARD_ENTER_CLASS, false);
  void tour.card.offsetHeight;
  toggleClass(tour.card, CARD_ENTER_CLASS, true);
  toggleClass(tour.card, CARD_COMPACT_CLASS, !!step.compact);
  if (step.openMenu) scheduleStartMenuOpen();
  else closeStartMenu();
  positionElements();
}

function runAction(action) {
  if (!tour) return;
  if (action === "advance") {
    advance();
  } else if (action === "guide") {
    os.app.launch("yukiOsGuideApp").catch(() => {});
    finish();
  } else if (action === "settings") {
    os.app.launch("settingsApp", { section: "pane-appearance" }).catch(() => {});
    swapPrimaryToDone();
  } else if (action === "browser") {
    os.app.launch("browserApp").catch(() => {});
    swapPrimaryToDone();
  } else {
    finish();
  }
}

function swapPrimaryToDone() {
  if (!tour) return;
  tour.actions.primary = "advance";
  setText($(BUTTON_PRIMARY_SELECTOR, tour.card), "Got it");
}

function applyMode(mode) {
  if (!tour) return;
  disablePreviewModes();
  if (mode === "reset") {
    tour.modesPreviewed = false;
    restorePreviewWallpaper();
    return;
  }
  if (!tour.previewWallpaper) {
    tour.previewWallpaper = {
      key: os.storage.get(StorageKeys.wallpaperKey),
      type: os.storage.get(StorageKeys.wallpaperType)
    };
  }
  enterPreviewMode(mode);
  tour.modesPreviewed = true;
  swapPrimaryToDone();
}

function enterPreviewMode(mode) {
  if (mode === "mac") {
    applyMacSettings();
  } else if (mode === "chromeos") {
    applyChromeOsSettings();
  } else if (mode === "tiling") {
    applyTilingSettings();
  }
}

function disablePreviewModes() {
  disableMacSettings();
  disableTilingSettings();
  disableChromeOsSettings();
}

function restorePreviewWallpaper() {
  if (!tour?.previewWallpaper) return;
  const saved = tour.previewWallpaper;
  tour.previewWallpaper = null;
  if (saved.key) {
    SystemUtilities.setWallpaper(saved.key).catch(() => {});
    os.storage.set(StorageKeys.wallpaperType, saved.type || "image");
  }
}

function exitAllPreviewModes() {
  disablePreviewModes();
  restorePreviewWallpaper();
}

function advance() {
  if (!tour) return;
  if (tour.stepIndex >= STEPS.length - 1) {
    finish();
    return;
  }
  showStep(tour.stepIndex + 1);
}

function finish() {
  if (tour?.tourCompleted) {
    os.app.triggerAchievement(Achievements.IntroTourComplete);
  }
  cleanup();
}

function skip() {
  cleanup();
}

function cleanup() {
  if (!tour) return;
  window.clearInterval(tour.tick);
  window.clearTimeout(tour.primeTimer);
  window.clearTimeout(tour.menuOpenTimer);
  window.removeEventListener("resize", positionElements);
  window.removeEventListener("scroll", positionElements, true);
  os.events.off(BusEvents.WINDOW_CREATED, onWindowCreated);
  if (tour.modesPreviewed) {
    exitAllPreviewModes();
    tour.modesPreviewed = false;
  }
  restoreRaised();
  tour.overlay.remove();
  tour.dim.remove();
  tour = null;
}

function scheduleStartMenuOpen() {
  window.clearTimeout(tour.menuOpenTimer);
  tour.menuOpenTimer = window.setTimeout(openStartMenuWithSearch, START_MENU_OPEN_DELAY);
}

function openStartMenuWithSearch() {
  const menu = $(START_MENU_SELECTOR);
  if (menu && menu.style.display === "flex") {
    $(SEARCH_INPUT_SELECTOR)?.focus?.();
    return;
  }
  toggleStartMenu({ focusSearch: true }).catch(() => {});
}

function positionElements() {
  if (!tour) return;
  const card = tour.card;
  const dim = tour.dim;
  const spotlight = tour.spotlight;
  const step = tour.currentStep;
  const targetEl = step?.target ? step.target() : null;
  const rect = targetEl ? targetEl.getBoundingClientRect() : null;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const usable =
    !!rect && rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.left < vw && rect.bottom > 0 && rect.top < vh;
  if (!usable) {
    restoreRaised();
    setStyle(spotlight, { display: "none" });
    setStyle(dim, { clipPath: "inset(0 0 0 0)" });
    setStyle(card, { left: "50%", top: "50%" });
    toggleClass(card, CARD_CENTERED_CLASS, true);
    return;
  }
  const revealWindow = targetEl.closest(".window");
  if (revealWindow) raiseElement(revealWindow);
  else restoreRaised();
  const left = rect.left - SPOTLIGHT_PAD;
  const top = rect.top - SPOTLIGHT_PAD;
  const width = rect.width + SPOTLIGHT_PAD * 2;
  const height = rect.height + SPOTLIGHT_PAD * 2;
  setStyle(spotlight, {
    display: "block",
    left: left + "px",
    top: top + "px",
    width: width + "px",
    height: height + "px"
  });
  setStyle(dim, {
    clipPath: `inset(${top}px ${vw - rect.right - SPOTLIGHT_PAD}px ${vh - rect.bottom - SPOTLIGHT_PAD}px ${left}px)`
  });
  toggleClass(card, CARD_CENTERED_CLASS, false);
  const gap = CARD_GAP;
  const cardWidth = card.offsetWidth;
  const cardHeight = card.offsetHeight;
  if (step?.cardSide === "right") {
    const cardLeft = Math.min(Math.max(rect.right + gap, 16), vw - cardWidth - 16);
    const cardTop = Math.round(
      Math.min(Math.max(rect.top + rect.height / 2 - cardHeight / 2, 16), vh - cardHeight - 16)
    );
    setStyle(card, { left: cardLeft + "px", top: cardTop + "px" });
    return;
  }
  let cardLeft = Math.round(Math.min(Math.max(rect.left, 16), vw - cardWidth - 16));
  let cardTop;
  const canPlaceTop = rect.top - gap - cardHeight >= 0;
  const canPlaceBottom = rect.bottom + gap + cardHeight <= vh;
  if (step?.cardSide === "top") {
    cardTop = canPlaceTop ? rect.top - gap - cardHeight : rect.bottom + gap;
  } else if (canPlaceBottom) {
    cardTop = rect.bottom + gap;
  } else if (canPlaceTop) {
    cardTop = rect.top - gap - cardHeight;
  } else {
    cardTop = Math.round(vh - cardHeight - 24);
  }
  setStyle(card, { left: cardLeft + "px", top: cardTop + "px" });
}

function raiseElement(el) {
  if (!tour || !el || el === tour.raisedEl) return;
  restoreRaised();
  tour.raisedEl = el;
  tour.raisedZ = el.style.zIndex || "";
  el.style.zIndex = String(REVEAL_Z_INDEX);
}

function restoreRaised() {
  if (!tour || !tour.raisedEl) return;
  tour.raisedEl.style.zIndex = tour.raisedZ || "";
  tour.raisedEl = null;
  tour.raisedZ = null;
}

export class IntroTourApp extends BaseApp {
  constructor(services) {
    super(services);
  }

  open() {
    startIntroTour();
  }

  onClose(winId) {
    cleanup();
  }
}
