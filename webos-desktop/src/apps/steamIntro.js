import { os, StorageKeys, $ } from "../framework.js";
import { startGuidedTour, isAnyTourActive } from "./introTour.js";

const FRIENDS_BTN_SELECTOR = ".steam-friends-btn";
const STEAM_WIN_SELECTOR = "#games-app-win";
const GAME_CONTAINER_SELECTOR = "#games-app-container";
const STORE_PAGE_SELECTOR = ".steam-store-page";
const LIBRARY_SIDEBAR_SELECTOR = ".steam-library-sidebar";
const QUESTS_PAGE_SELECTOR = ".steam-quests-page";
const SHOP_PAGE_SELECTOR = ".steam-shop-page";
const COMMUNITY_PAGE_SELECTOR = ".steam-community-page";
const USER_PAGE_SELECTOR = ".steam-user-page";
const SETTINGS_PAGE_SELECTOR = ".steam-settings-page";
const TOP_BAR_SELECTOR = ".steam-top-right";

function navigateContainer(page) {
  const container = $(GAME_CONTAINER_SELECTOR);
  if (!container) return;
  setTimeout(() => {
    container.dispatchEvent(new CustomEvent("steam-navigate", { detail: { page } }));
  }, 80);
}

const STEAM_STEPS = [
  {
    id: "steam-welcome",
    icon: "fab fa-steam",
    title: "Steam, your full game hub.",
    body: "Store, library, quests, a profile store, and a live community. One window, every way to play.",
    buttons: { primary: { label: "Next", action: "advance" } }
  },
  {
    id: "steam-store",
    icon: "fas fa-store",
    title: "Browse the catalog.",
    body: "Featured ports and the full WebPorts grid. Pick any game and jump straight into playing.",
    target: () => $(STORE_PAGE_SELECTOR, document) || null,
    onEnter: () => navigateContainer("store"),
    cardSide: "top",
    buttons: { primary: { label: "Next", action: "advance" } }
  },
  {
    id: "steam-top-bar",
    icon: "fas fa-circle-up",
    title: "Your coins, streak, and shortcuts.",
    body: "Track coins and your daily streak, check notifications, and jump to quests, store, or account from up here.",
    target: () => $(TOP_BAR_SELECTOR),
    cardSide: "bottom",
    buttons: { primary: { label: "Next", action: "advance" } }
  },
  {
    id: "steam-library",
    icon: "fas fa-layer-group",
    title: "Your library, sorted.",
    body: "Every port you own sits in the sidebar. Search, hide titles, and launch from the overview.",
    target: () => $(LIBRARY_SIDEBAR_SELECTOR, document) || null,
    onEnter: () => navigateContainer("library"),
    cardSide: "right",
    buttons: { primary: { label: "Next", action: "advance" } }
  },
  {
    id: "steam-quests",
    icon: "fas fa-clipboard-list",
    title: "Daily quests.",
    body: "Check in each day for quests that pay coins. Claim rewards and keep the streak alive.",
    target: () => $(QUESTS_PAGE_SELECTOR, document) || null,
    onEnter: () => navigateContainer("quests"),
    cardSide: "top",
    buttons: { primary: { label: "Next", action: "advance" } }
  },
  {
    id: "steam-shop",
    icon: "fas fa-bag-shopping",
    title: "The profile store.",
    body: "Spend coins on profile borders, titles, and reaction flair that travels with you across Steam.",
    target: () => $(SHOP_PAGE_SELECTOR, document) || null,
    onEnter: () => navigateContainer("shop"),
    cardSide: "top",
    buttons: { primary: { label: "Next", action: "advance" } }
  },
  {
    id: "steam-community-page",
    icon: "fas fa-users",
    title: "Browse the community.",
    body: "Walk the weekly leaderboard, find any player by name, and send friend requests straight from their profile.",
    target: () => $(COMMUNITY_PAGE_SELECTOR, document) || null,
    onEnter: () => navigateContainer("community"),
    cardSide: "top",
    buttons: { primary: { label: "Next", action: "advance" } }
  },
  {
    id: "steam-profile",
    icon: "fas fa-id-badge",
    title: "Your profile is live.",
    body: "Playtime, badges, levels, quests and a profile store all live on your page. Others see it in the community.",
    target: () => $(USER_PAGE_SELECTOR, document) || null,
    onEnter: () => navigateContainer("user"),
    cardSide: "top",
    buttons: { primary: { label: "Next", action: "advance" } }
  },
  {
    id: "steam-friends",
    icon: "fas fa-user-group",
    title: "Friends and chat.",
    body: "The Friends button opens your list, requests, and who is online right now.",
    target: () => $(FRIENDS_BTN_SELECTOR),
    cardSide: "top",
    buttons: { primary: { label: "Next", action: "advance" } }
  },
  {
    id: "steam-settings",
    icon: "fas fa-sliders-h",
    title: "You stay in control.",
    body: "Startup options, sound, and one switch for all social features sit in Settings. Switch everything off anytime.",
    target: () => $(SETTINGS_PAGE_SELECTOR, document) || null,
    onEnter: () => navigateContainer("settings"),
    cardSide: "top",
    buttons: { primary: { label: "Done", action: "finish" } }
  }
];

function runSteamTour(seenKey) {
  startGuidedTour(STEAM_STEPS, {
    seenKey,
    grantAchievement: false
  });
}

export function startSteamTour() {
  runSteamTour(null);
}

export async function offerSteamTour() {
  if (os.storage.get(StorageKeys.steamIntroSeen)) return;
  if (isAnyTourActive()) return;
  const accept = await os.dialog.confirm(
    "Tour Steam",
    "Steam packs a store, library, daily quests, a profile store, and a live community. Want a quick tour?"
  );
  if (isAnyTourActive()) return;
  if (accept) {
    const win = $(STEAM_WIN_SELECTOR);
    if (!win || !$(GAME_CONTAINER_SELECTOR) || !$(FRIENDS_BTN_SELECTOR)) {
      setTimeout(() => runSteamTour(StorageKeys.steamIntroSeen), 250);
      return;
    }
    runSteamTour(StorageKeys.steamIntroSeen);
  } else {
    os.storage.set(StorageKeys.steamIntroSeen, "true");
  }
}