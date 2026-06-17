import { appMap } from "../games/gamesList.js";
import { APP_DESCRIPTIONS, descriptionMap } from "../games/gameDescriptions.js";
import { camelize } from "../utils/utils.js";
import { StorageKeys } from "../settings/settings.js";
import { ClippyAnimation, speak } from "../ai/clippy.js";
import { isImageFile } from "../utils/utils.js";
import { resolveIconUrl } from "../shared/assetResolver.js";
import { showDynamicContextMenu, refreshIcons } from "../shared/contextMenu.js";
import { CDN_CONFIG } from "../shared/cdnConfig.js";
import { getAppRegistry } from "../appRegistry.js";
import { os } from "../os/index.js";
import { SYSTEM_APPS } from "../AppRegistryConfig.js";
import { resolveAvatarUrl } from "../shared/avatarResolver.js";

function getStartMenuEl() {
  return document.getElementById("start-menu") || document.querySelector(".start-menu");
}

let descriptionTooltip = null;

function showDescriptionTooltip(text, x, y) {
  if (descriptionTooltip) {
    document.body.removeChild(descriptionTooltip);
  }

  descriptionTooltip = document.createElement("div");
  descriptionTooltip.className = "description-tooltip";
  descriptionTooltip.textContent = text;
  descriptionTooltip.style.left = `${x + 10}px`;
  descriptionTooltip.style.top = `${y + 10}px`;
  document.body.appendChild(descriptionTooltip);
}

function hideDescriptionTooltip() {
  if (descriptionTooltip) {
    document.body.removeChild(descriptionTooltip);
    descriptionTooltip = null;
  }
}

export function isStartMenuOpen() {
  const el = getStartMenuEl();
  return !!el && el.style.display === "flex";
}

export function closeStartMenu() {
  const el = getStartMenuEl();
  if (!el) return;
  if (el.style.display !== "flex") return;

  clearSelection();

  el.classList.add("closing");
  el.addEventListener(
    "animationend",
    () => {
      el.classList.remove("closing");
      el.style.display = "none";
    },
    { once: true }
  );
}

export function applyStartMenuSettings(el) {
  if (!el) return;
  const width = os.storage.get(StorageKeys.startMenuWidth) || "650";
  const height = os.storage.get(StorageKeys.startMenuHeight) || "500";
  el.style.width = `${width}px`;
  el.style.height = `${height}px`;

  const catsData = os.storage.get(StorageKeys.startMenuCats);
  let cats = {};
  if (catsData) {
    try {
      cats = catsData;
    } catch (e) {}
  }
  const catNames = [
    "favorites",
    "all",
    "development",
    "games",
    "graphics",
    "help",
    "internet",
    "media",
    "office",
    "system",
    "customize",
    "settingsApp"
  ];
  const el2 = el.querySelector('.start-cat[data-cat="places"]');
  if (el2) el2.style.display = "none";
  catNames.forEach((catName) => {
    const isEnabled = cats[catName] !== false;
    const catEl = el.querySelector(`.start-cat[data-cat="${catName}"]`);
    if (catEl) {
      catEl.style.display = isEnabled ? "flex" : "none";
    }
  });
}

export function openStartMenu({ focusSearch = false, openDefaultPage = true } = {}) {
  const el = getStartMenuEl();
  if (!el) return;

  applyStartMenuSettings(el);

  el.classList.remove("closing");
  el.style.display = "flex";
  focusMode = "categories";
  clearSelection();
  renderedCategories.clear();
  updateFavoritesUI();

  if (sharedAppLauncher) {
    ["system", "games"].forEach((cat) => {
      populateCategoryPage(cat, sharedAppLauncher);
      renderedCategories.add(cat);
    });
  }

  if (openDefaultPage) {
    const catsData = os.storage.get(StorageKeys.startMenuCats);
    let cats = {};
    if (catsData) {
      try {
        cats = catsData;
      } catch (e) {}
    }
    let defaultCat = "recent";
    if (cats["recent"] === false) {
      const catNames = [
        "recent",
        "all",
        "favorites",
        "development",
        "games",
        "graphics",
        "help",
        "internet",
        "media",
        "office",
        "system",
        "customize",
        "settingsApp"
      ];
      const firstEnabled = catNames.find((c) => cats[c] !== false);
      if (firstEnabled) defaultCat = firstEnabled;
    }
    el.querySelector(`.start-cat[data-cat="${defaultCat}"]`)?.click();
  }

  if (focusSearch) {
    document.getElementById("start-menu-search")?.focus?.();
  }
}

export function toggleStartMenu(opts) {
  if (isStartMenuOpen()) closeStartMenu();
  else openStartMenu(opts);
}

function getFavorites() {
  if (favoritesCache !== null) return favoritesCache;
  favoritesCache = os.storage.get(StorageKeys.favoritesKey) || [];
  return favoritesCache;
}

function saveFavorites(favorites) {
  favoritesCache = favorites;
  os.storage.set(StorageKeys.favoritesKey, favorites);
}

function favoriteApp(appName) {
  let favorites = getFavorites();
  if (!favorites.includes(appName)) {
    favorites.push(appName);
    saveFavorites(favorites);
    updateFavoritesUI();
    updateStarState(appName, true);
    speak("Nice pick, I like that one too!", ClippyAnimation.Show);
  }
}

function unfavoriteApp(appName) {
  let favorites = getFavorites();
  favorites = favorites.filter((name) => name !== appName);
  saveFavorites(favorites);
  updateFavoritesUI();
  updateStarState(appName, false);
}

function buildIconEl(iconVal) {
  const isImage =
    isImageFile(iconVal) ||
    iconVal.startsWith("http") ||
    iconVal.startsWith("data:") ||
    iconVal.startsWith("blob:") ||
    iconVal.startsWith("/");
  if (isImage) {
    const iconEl = document.createElement("img");
    let iconSrc = iconVal;
    if (iconVal.startsWith("static/") || iconVal.startsWith("/static/")) {
      const cleanPath = iconVal.startsWith("/") ? iconVal.substring(1) : iconVal;
      iconSrc = `${CDN_CONFIG.repos.main.base}/${cleanPath}`;
    } else {
      iconSrc = resolveIconUrl(iconVal);
    }
    iconEl.src = iconSrc;
    iconEl.alt = "";
    return iconEl;
  }
  const iconEl = document.createElement("i");
  iconEl.className = iconVal.startsWith("fa") ? iconVal : `fa ${iconVal}`;
  return iconEl;
}

function createStarButton(appName) {
  const btn = document.createElement("span");
  btn.textContent = "★";
  btn.className = "star";
  btn.style.color = getFavorites().includes(appName) ? "gold" : "#ccc";

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (getFavorites().includes(appName)) {
      unfavoriteApp(appName);
    } else {
      favoriteApp(appName);
    }
  });

  btn.dataset.app = appName;
  return btn;
}

function updateStarState(appName, isFavorite) {
  document.querySelectorAll(`.start-menu-item[data-app="${appName}"] span`).forEach((star) => {
    if (star.textContent === "★") {
      star.style.color = isFavorite ? "gold" : "#ccc";
    }
  });
  const item = document.querySelector(`.start-menu-item[data-app="${appName}"]`);
  if (item) {
    item.style.background = isFavorite ? "rgba(255, 215, 0, 0.1)" : "transparent";
  }
}
let sharedAppLauncher;
let selectedItem = null;
let selectedCategory = null;
let keyboardHandlerInstalled = false;
let focusMode = "apps";
let favoritesCache = null;
const renderedCategories = new Set();
let searchDebounceTimer = null;

const RECENTLY_USED_MAX = 8;

function getRecentlyUsed() {
  return os.storage.get(StorageKeys.recentlyUsedApps) || [];
}

function trackRecentlyUsed(appId) {
  let recent = getRecentlyUsed();
  recent = recent.filter((id) => id !== appId);
  recent.unshift(appId);
  if (recent.length > RECENTLY_USED_MAX) recent = recent.slice(0, RECENTLY_USED_MAX);
  os.storage.set(StorageKeys.recentlyUsedApps, recent);
}

function updateRecentlyUsedUI() {
  const page = document.querySelector('.start-page[data-page="recent"]');
  if (!page) return;
  page.innerHTML = "";

  const appRegistry = getAppRegistry();
  const allApps = { ...appMap, ...os.app.getAllApps() };
  const recent = getRecentlyUsed();

  if (recent.length === 0) {
    const empty = document.createElement("div");
    empty.className = "search-no-results";
    empty.textContent = "No recently used apps yet";
    page.appendChild(empty);
    return;
  }

  recent.forEach((appId) => {
    const appData = allApps[appId];
    if (!appData) return;
    if (appRegistry.isAppUninstalled(appId) || appRegistry.isAppDisabled(appId)) return;
    page.appendChild(createAppItem(appId, appData));
  });
}

function clearItemSelection() {
  if (selectedItem) {
    selectedItem.classList.remove("selected");
    selectedItem = null;
  }
}

function clearCategorySelection() {
  if (selectedCategory) {
    selectedCategory.classList.remove("keyboard-selected");
    selectedCategory = null;
  }
}

function clearSelection() {
  clearItemSelection();
  clearCategorySelection();
}

function selectFirstItemInPage(page) {
  clearItemSelection();
  const firstItem = page.querySelector(".start-menu-item:not(.letter-category-header)");
  if (firstItem) {
    selectedItem = firstItem;
    selectedItem.classList.add("selected");
  }
}

function focusSearch() {
  clearSelection();
  focusMode = "search";
  document.getElementById("start-menu-search")?.focus();
}

function navigateSelection(direction) {
  const activePage = document.querySelector(".start-page.active");
  if (!activePage) return;

  const items = Array.from(activePage.querySelectorAll(".start-menu-item:not(.letter-category-header)"));
  if (items.length === 0) return;

  const currentIndex = items.indexOf(selectedItem);

  if (direction === "up" && currentIndex <= 0) {
    focusSearch();
    return;
  }

  let newIndex;
  if (direction === "down") {
    newIndex = currentIndex === -1 ? 0 : Math.min(currentIndex + 1, items.length - 1);
  } else {
    newIndex = currentIndex === -1 ? items.length - 1 : Math.max(currentIndex - 1, 0);
  }

  clearItemSelection();
  selectedItem = items[newIndex];
  selectedItem.classList.add("selected");
  selectedItem.scrollIntoView({ block: "nearest" });
}

function activateCategoryPage(cat) {
  document.querySelectorAll(".start-cat").forEach((c) => c.classList.remove("active"));
  document.querySelectorAll(".start-page").forEach((p) => p.classList.remove("active"));
  cat.classList.add("active");
  const page = document.querySelector(`.start-page[data-page="${cat.dataset.cat}"]`);
  if (!page) return;
  page.classList.add("active");
  if (cat.dataset.cat === "favorites") {
    updateFavoritesUI();
  } else if (cat.dataset.cat === "recent") {
    updateRecentlyUsedUI();
  } else if (
    ["all", "development", "games", "graphics", "help", "internet", "media", "office", "system"].includes(
      cat.dataset.cat
    )
  ) {
    if (!renderedCategories.has(cat.dataset.cat)) {
      populateCategoryPage(cat.dataset.cat, sharedAppLauncher);
      renderedCategories.add(cat.dataset.cat);
    }
  }
  selectFirstItemInPage(page);
}

function navigateCategories(direction) {
  const categories = Array.from(document.querySelectorAll(".start-cat:not(.docked)")).filter(
    (cat) => cat.style.display !== "none" && cat.offsetParent !== null
  );
  if (categories.length === 0) return;

  const currentIndex = categories.indexOf(selectedCategory);

  if (direction === "up" && currentIndex <= 0) {
    focusSearch();
    return;
  }

  let newIndex;
  if (direction === "down") {
    newIndex = currentIndex === -1 ? 0 : Math.min(currentIndex + 1, categories.length - 1);
  } else {
    newIndex = currentIndex === -1 ? categories.length - 1 : Math.max(currentIndex - 1, 0);
  }

  clearCategorySelection();
  clearItemSelection();
  selectedCategory = categories[newIndex];
  selectedCategory.classList.add("keyboard-selected");
  selectedCategory.scrollIntoView({ block: "nearest" });

  const catName = selectedCategory.dataset.cat;
  if (catName !== "settingsApp" && catName !== "customize") {
    activateCategoryPage(selectedCategory);
  }
}

function switchFocusMode(mode) {
  if (focusMode === mode) return;
  focusMode = mode;

  if (mode === "categories") {
    clearItemSelection();
    const activeCat = document.querySelector(".start-cat.active");
    if (activeCat) {
      clearCategorySelection();
      selectedCategory = activeCat;
      selectedCategory.classList.add("keyboard-selected");
    } else {
      clearCategorySelection();
      navigateCategories("down");
    }
  } else {
    clearCategorySelection();
    const activePage = document.querySelector(".start-page.active");
    if (activePage) {
      selectFirstItemInPage(activePage);
    }
  }
}

function launchSelectedItem() {
  if (selectedItem) {
    selectedItem.click();
  }
}

export function updateFavoritesUI() {
  if (!sharedAppLauncher) {
    console.error("No app launcher");
    return;
  }

  const favoritesPage = document.querySelector('.start-page[data-page="favorites"]');
  favoritesPage.innerHTML = "";
  const favorites = getFavorites();

  if (favorites.length === 0) {
    return;
  }

  const appRegistry = getAppRegistry();
  const allApps = { ...appMap, ...os.app.getAllApps() };

  favorites.forEach((appName) => {
    const appData = allApps[appName];
    if (!appData) return;
    if (appRegistry.isAppUninstalled(appName) || appRegistry.isAppDisabled(appName)) return;
    const item = createAppItem(appName, appData);
    item.style.background = "rgba(255, 215, 0, 0.1)";
    favoritesPage.appendChild(item);
  });
}

export function setupStartMenu(appLauncher, sessionManager, selectionManager) {
  sharedAppLauncher = appLauncher;
  const menuEl = document.getElementById("start-menu") || document.querySelector(".start-menu");
  if (menuEl) {
    applyStartMenuSettings(menuEl);
  }
  document.querySelector(".start-menu")?.addEventListener("contextmenu", (e) => e.preventDefault());

  document.getElementById("start-lock-btn")?.addEventListener("click", () => {
    closeStartMenu();
    sessionManager?.lockSession();
  });

  document.getElementById("start-signout-btn")?.addEventListener("click", () => {
    closeStartMenu();
    sessionManager?.lockToLoginScreen();
  });

  document.getElementById("start-sleep-btn")?.addEventListener("click", () => {
    closeStartMenu();
    sessionManager?.sleep?.();
  });

  document.getElementById("start-restart-btn")?.addEventListener("click", () => {
    closeStartMenu();
    sessionManager?.restart?.();
  });

  document.getElementById("start-shutdown-btn")?.addEventListener("click", () => {
    closeStartMenu();
    sessionManager?.shutdown?.();
  });

  document.querySelectorAll(".start-cat").forEach((cat) => {
    if (cat.classList.contains("docked") || !cat.dataset.cat) {
      return;
    }

    cat.onclick = () => {
      if (cat.dataset.cat === "settingsApp") {
        os.app.launch("settingsApp");
        return;
      }
      if (cat.dataset.cat === "customize") {
        os.app.launch("accountManagerApp");
        speak("Let's make your profile look great!", ClippyAnimation.GetArtsy);
        return;
      }
      activateCategoryPage(cat);
      if (cat.dataset.cat === "favorites") {
        speak("These are your favorites! Great taste.", ClippyAnimation.Show);
      }
      if (focusMode === "apps") {
        const page = document.querySelector(`.start-page[data-page="${cat.dataset.cat}"]`);
        if (page) selectFirstItemInPage(page);
      }
    };
  });

  const searchInput = document.getElementById("start-menu-search");

  searchInput.addEventListener("focus", () => {
    focusMode = "search";
    clearSelection();
    speak("Looking for an app? I know where everything is.", ClippyAnimation.Searching);
  });

  if (!keyboardHandlerInstalled) {
    document.addEventListener("keydown", (e) => {
      if (!isStartMenuOpen()) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (focusMode === "search") {
          document.getElementById("start-menu-search")?.blur();
          focusMode = "categories";
          navigateCategories("down");
        } else if (focusMode === "categories") {
          navigateCategories("down");
        } else {
          navigateSelection("down");
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (focusMode === "search") {
          document.getElementById("start-menu-search")?.blur();
          focusMode = "apps";
          navigateSelection("up");
        } else if (focusMode === "categories") {
          navigateCategories("up");
        } else {
          navigateSelection("up");
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (focusMode === "search") {
          document.getElementById("start-menu-search")?.blur();
        }
        switchFocusMode("categories");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (focusMode === "search") {
          document.getElementById("start-menu-search")?.blur();
        }
        switchFocusMode("apps");
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (focusMode === "categories" && selectedCategory) {
          selectedCategory.dispatchEvent(new Event("click"));
        } else {
          launchSelectedItem();
        }
      }
    });
    keyboardHandlerInstalled = true;
  }

  searchInput.addEventListener("input", (e) => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      const q = e.target.value.toLowerCase().trim();
      const searchResultsPage = document.querySelector('.start-page[data-page="search-results"]');

      if (!searchResultsPage) {
        const resultsPage = document.createElement("div");
        resultsPage.className = "start-page";
        resultsPage.dataset.page = "search-results";
        resultsPage.innerHTML = '<div class="search-results-container"></div>';
        document.querySelector(".start-content").appendChild(resultsPage);
      }

      if (q === "") {
        document.querySelectorAll(".start-page").forEach((page) => {
          if (page.dataset.page === "search-results") {
            page.classList.remove("active");
            page.style.display = "none";
          } else {
            page.style.display = "";
            document.querySelectorAll(".start-menu-item").forEach((item) => {
              item.style.display = "";
            });
          }
        });

        const activeCat = document.querySelector(".start-cat.active");
        if (activeCat) {
          const page = document.querySelector(`.start-page[data-page="${activeCat.dataset.cat}"]`);
          if (page) page.classList.add("active");
        }
        return;
      }

      document.querySelectorAll(".start-page").forEach((page) => {
        page.classList.remove("active");
        page.style.display = "none";
      });

      const resultsPage = document.querySelector('.start-page[data-page="search-results"]');
      resultsPage.style.display = "flex";
      resultsPage.classList.add("active");
      const resultsContainer = resultsPage.querySelector(".search-results-container");
      resultsContainer.innerHTML = "";

      const appRegistry = getAppRegistry();
      const allApps = { ...appMap, ...os.app.getAllApps() };
      const results = { menu: [], games: [], system: [] };
      const seenAppIds = new Set();

      Object.entries(allApps).forEach(([appId, appData]) => {
        if (seenAppIds.has(appId)) return;
        if (appRegistry.isAppUninstalled(appId) || appRegistry.isAppDisabled(appId)) return;
        const title = (appData.title || appId).toLowerCase();
        const description = (APP_DESCRIPTIONS[appId] || descriptionMap[appId] || "").toLowerCase();
        if (!title.includes(q) && !description.includes(q)) return;
        seenAppIds.add(appId);
        const item = createAppItem(appId, appData);
        item.onclick = () => {
          os.app.launch(appId);
          closeStartMenu();
        };
        const category = appData.type === "system" ? "system" : "menu";
        results[category].push({ element: item, title: appData.title || appId });
      });

      const categoryOrder = ["menu", "games", "system"];
      const categoryLabels = { menu: "Menu", games: "Games", system: "System" };

      const fragment = document.createDocumentFragment();
      let hasResults = false;
      categoryOrder.forEach((cat) => {
        if (results[cat].length > 0) {
          hasResults = true;
          const categoryHeader = document.createElement("div");
          categoryHeader.className = "search-category-header";
          categoryHeader.textContent = categoryLabels[cat];
          fragment.appendChild(categoryHeader);

          const categoryResults = document.createElement("div");
          categoryResults.className = "search-category-results";
          results[cat].forEach((result) => {
            result.element.style.display = "";
            categoryResults.appendChild(result.element);
          });
          fragment.appendChild(categoryResults);
        }
      });

      if (!hasResults) {
        const noResults = document.createElement("div");
        noResults.className = "search-no-results";
        noResults.textContent = "No results found";
        fragment.appendChild(noResults);
      }
      resultsContainer.appendChild(fragment);
    }, 120);
  });

  setupStartUserHover();

  if (selectionManager) {
    setupDesktopStartMenuToggles(selectionManager);
  }
}

let toggleHideGamesFn = () => {};
let toggleHideSystemAppsFn = () => {};

export function getToggleHideGames() {
  return toggleHideGamesFn;
}

export function getToggleHideSystemApps() {
  return toggleHideSystemAppsFn;
}

function setupDesktopStartMenuToggles(selectionManager) {
  const hideGamesKey = StorageKeys.hideGames;
  const hideGamesBtn = document.getElementById("hide-games-btn");

  const applyHideGames = (hidden) => {
    document.querySelectorAll("#desktop .icon").forEach((icon) => {
      if (sharedAppLauncher.appMap[icon.dataset.app] && sharedAppLauncher.appMap[icon.dataset.app].type !== "system") {
        icon.style.display = hidden ? "none" : "";
        if (hidden && selectionManager) selectionManager.remove(icon);
      }
    });
    if (hideGamesBtn) hideGamesBtn.textContent = hidden ? "🎮 Show Games" : "🎮 Hide Games";
    if (typeof layoutIconsCall === "function") layoutIconsCall();
  };

  const storedHidden = os.storage.get(hideGamesKey) === "true";
  applyHideGames(storedHidden);

  toggleHideGamesFn = () => {
    const currentlyHidden = os.storage.get(hideGamesKey) === "true";
    const next = !currentlyHidden;
    os.storage.set(hideGamesKey, String(next));
    applyHideGames(next);
  };

  const hideSystemKey = StorageKeys.hideSystem;
  const hideSystemBtn = document.getElementById("hide-system-btn");

  const applyHideSystemApps = (hidden) => {
    document.querySelectorAll("#desktop .icon").forEach((icon) => {
      if (sharedAppLauncher.appMap[icon.dataset.app] && sharedAppLauncher.appMap[icon.dataset.app].type === "system") {
        icon.style.display = hidden ? "none" : "";
        if (hidden && selectionManager) selectionManager.remove(icon);
      }
    });
    if (hideSystemBtn) hideSystemBtn.textContent = hidden ? "⚙️ Show System Apps" : "⚙️ Hide System Apps";
    if (typeof layoutIconsCall === "function") layoutIconsCall();
  };

  const storedSystemHidden = os.storage.get(hideSystemKey) === "true";
  applyHideSystemApps(storedSystemHidden);

  toggleHideSystemAppsFn = () => {
    const currentlyHidden = os.storage.get(hideSystemKey) === "true";
    const next = !currentlyHidden;
    os.storage.set(hideSystemKey, String(next));
    applyHideSystemApps(next);
  };
}

export function getCurrentUser() {
  const userHistory = os.storage.get(StorageKeys.userHistory) || [];
  const currentUserId = os.storage.get(StorageKeys.userId);

  if (userHistory.length > 0 && currentUserId) {
    const currentUser = userHistory.find((u) => u.userId === currentUserId);
    if (currentUser) {
      return {
        name: currentUser.name,
        avatar: currentUser.avatar
      };
    }
  }

  const fallbackName = os.storage.get(StorageKeys.username) || "Guest";
  const fallbackAvatar = os.storage.get(StorageKeys.profilePicture) || "static/icons/guest.webp";

  return {
    name: fallbackName,
    avatar: fallbackAvatar
  };
}

export async function updateStartUserDisplay() {
  const startUser = document.querySelector(".start-user");
  if (!startUser) return;

  const user = getCurrentUser();

  const nameSpan = startUser.querySelector("span");
  const avatarImg = startUser.querySelector("img");

  if (nameSpan) nameSpan.textContent = user.name;
  if (avatarImg) avatarImg.src = await resolveAvatarUrl(user.avatar, "static/icons/guest.webp");
}

export function setupStartUserHover() {
  const startUser = document.querySelector(".start-user");
  if (!startUser) return;

  let tooltip = null;

  startUser.addEventListener("mouseenter", () => {
    const user = getCurrentUser();

    tooltip = document.createElement("div");
    tooltip.className = "user-tooltip";
    tooltip.textContent = user.name;
    document.body.appendChild(tooltip);

    const rect = startUser.getBoundingClientRect();
    tooltip.style.left = `${rect.right + 10}px`;
    tooltip.style.top = `${rect.top + rect.height / 2}px`;
  });

  startUser.addEventListener("mouseleave", () => {
    if (tooltip) {
      tooltip.remove();
      tooltip = null;
    }
  });

  updateStartUserDisplay();

  os.events.on("profile:updated", () => {
    updateStartUserDisplay();
  });

  os.events.on("session:initialized", () => {
    updateStartUserDisplay();
  });
}

export function tryGetIcon(id) {
  id = camelize(id);

  if (id === "explorer") {
    return resolveIconUrl("static/icons/file.webp");
  }
  if (id === "appCreatorApp") {
    return "fa fa-cubes";
  }
  if (id === "kiwiIRC") {
    return resolveIconUrl("static/icons/kiwiirc.webp");
  }
  if (id === "youtube") {
    return "fab fa-youtube";
  }
  try {
    if (os.app.getAllApps()) {
      if (os.app.getAllApps()[id] && os.app.getAllApps()[id].icon) {
        return os.app.getAllApps()[id].icon;
      }
      const camel = camelize(id);
      if (os.app.getAllApps()[camel] && os.app.getAllApps()[camel].icon) {
        return os.app.getAllApps()[camel].icon;
      }
      const found = Object.entries(os.app.getAllApps()).find(
        ([key]) =>
          key === id ||
          key.startsWith(id) ||
          id.startsWith(key) ||
          key === camel ||
          key.startsWith(camel) ||
          camel.startsWith(key)
      );
      if (found && found[1].icon) {
        return found[1].icon;
      }
    }

    if (appMap[id] && appMap[id].icon) {
      return appMap[id].icon;
    }

    const foundEntry = Object.entries(appMap).find(([key]) => key === id || key.startsWith(id) || id.startsWith(key));

    if (foundEntry && foundEntry[1].icon) {
      return foundEntry[1].icon;
    }

    const div = document.querySelector(`#desktop div[data-app="${id}"]`);
    const imgSrc = div?.querySelector("img")?.src || div?.querySelector("svg");
    return imgSrc;
  } catch (e) {
    console.error("Error occurred while getting icon:", e);
    return null;
  }
}

function getGridItems() {
  const saved = os.storage.get(StorageKeys.startMenuGridItems);
  if (saved) {
    try {
      return saved;
    } catch (e) {
      console.error(e);
    }
  }
  return [
    { app: "browserApp", title: "Yuki Browser", icon: "fas fa-globe" },
    { app: "explorerApp", title: "Files", icon: "fas fa-folder" },
    { app: "settingsApp", title: "Settings", icon: "fas fa-cog" },
    { app: "aiAssistant", title: "Yuki AI Assistant", icon: "fas fa-robot" },
    { app: "notepadApp", title: "Notepad", icon: "fas fa-edit" },
    { app: "calculatorApp", title: "Calculator", icon: "fas fa-calculator" },
    { app: "shortcutsApp", title: "Shortcuts", icon: "fas fa-keyboard" },
    { app: "yukiConvert", title: "Yuki Convert", icon: "fas fa-exchange-alt" },
    { app: "cameraApp", title: "Camera", icon: "fas fa-camera" },
    { app: "officeApp", title: "Office", icon: "fas fa-file-word" },
    { app: "installedApps", title: "Installed Apps", icon: "fas fa-th-list" },
    { app: "clipboardManager", title: "Clipboard Manager", icon: "fas fa-paste" },
    { app: "weatherApp", title: "Weather", icon: "fas fa-cloud" },
    { app: "yukiOsGuide", title: "Yuki OS Guide", icon: "fas fa-book-open" },
    { app: "steamApp", title: "Steam", icon: "fab fa-steam" },
    { app: "paint", title: "Paint", icon: "fas fa-paint-brush" },
    { app: "newsApp", title: "What's New", icon: "fas fa-newspaper" },
    { app: "shittify", title: "Evil Spotify", icon: "fas fa-music" },
    { app: "appCreatorApp", title: "AppCreator", icon: "fas fa-cubes" },
    { app: "systemAppsApp", title: "System Apps", icon: "fas fa-screwdriver-wrench" },
    { app: "taskManagerApp", title: "Task Manager", icon: "fas fa-list-check" },
    { app: "terminal", title: "Terminal", icon: "fas fa-terminal" },
    { app: "aboutApp", title: "About YukiOS", icon: "fas fa-info-circle" },
    { app: "achievementsApp", title: "Achievements", icon: "fas fa-trophy" }
  ];
}

function saveGridItems(items) {
  os.storage.set(StorageKeys.startMenuGridItems, items);
}
function showStartItemEditor(appLauncher, currentItem) {
  return new Promise((resolve) => {
    const t0 = performance.now();

    const overlay = document.createElement("div");
    overlay.className = "explorer-confirmation-overlay start-editor-overlay";
    overlay.style.zIndex = "20002";

    const apps = Object.entries(os.app.getAllApps())
      .map(([id, data]) => ({
        id,
        title: data.title || id,
        icon: data.icon || ""
      }))
      .sort((a, b) => a.title.localeCompare(b.title));

    const selectOptions = apps
      .map(
        (app) =>
          `<option value="${app.id}" ${
            currentItem && currentItem.app === app.id ? "selected" : ""
          }>${app.title} (${app.id})</option>`
      )
      .join("");

    const isCdnOrUrl = (str) =>
      typeof str === "string" && (str.startsWith("http") || str.includes("/") || str.includes("."));

    const getCleanIcon = (appId, explicitIcon) => {
      if (explicitIcon && !isCdnOrUrl(explicitIcon)) return explicitIcon;
      const app = apps.find((a) => a.id === appId);
      if (app && app.icon && !isCdnOrUrl(app.icon)) return app.icon;
      return "fas fa-star";
    };

    const dialogTitle = currentItem ? "Edit Start Menu Item" : "Add Start Menu Item";

    const titleVal = currentItem ? currentItem.title : apps[0]?.title || "";

    const iconVal = getCleanIcon(currentItem ? currentItem.app : apps[0]?.id, currentItem?.icon);

    let uploadedIconDataUrl = null;

    if (currentItem && currentItem.icon && isCdnOrUrl(currentItem.icon)) {
      uploadedIconDataUrl = currentItem.icon;
    }

    overlay.innerHTML = `
      <div class="start-editor-dialog">
        <div class="_fd-dialog-title">${dialogTitle}</div>

        <!-- App select -->
        <div class="start-editor-field">
          <label class="start-editor-label">Select Application</label>

          <select id="editor-app-select" class="start-editor-hidden-select">
            ${selectOptions}
          </select>

          <div id="custom-app-select" class="start-editor-select-box">
            <span id="custom-app-select-label">Select Application...</span>
            <span class="start-editor-select-arrow">▼</span>
          </div>

          <div id="custom-app-dropdown-list" class="start-editor-dropdown">
            <div class="start-editor-dropdown-search">
              <input
                id="custom-app-search"
                type="text"
                placeholder="Search application..."
                class="start-editor-search-input"
              />
            </div>
            <div id="custom-app-options-container"></div>
          </div>
        </div>

        <!-- Title -->
        <div class="start-editor-field">
          <label class="start-editor-label">Display Title</label>
          <input id="editor-title-input"
                 class="_fd-dialog-input start-editor-input"
                 type="text"
                 value="${titleVal}" />
        </div>

        <!-- Icon -->
        <div class="start-editor-field">
          <label class="start-editor-label">FontAwesome Icon Class</label>
          <input id="editor-icon-input"
                 class="_fd-dialog-input start-editor-input"
                 type="text"
                 value="${iconVal}" />
          <div id="editor-icon-error" class="start-editor-error">
            Must start with 'fa' (e.g. 'fas fa-star')
          </div>
        </div>

        <!-- Upload -->
        <div class="start-editor-field">
          <label class="start-editor-label">
            Or Upload Custom Image Icon
          </label>

          <div class="start-editor-upload-row">
            <input id="editor-icon-file" type="file" accept="image/*" hidden />

            <button id="editor-upload-btn" class="_fd-btn start-editor-btn">
              Choose Image...
            </button>

            <div id="editor-image-preview" class="start-editor-preview">
              <span id="editor-preview-placeholder">None</span>
            </div>

            <button id="editor-clear-upload-btn"
                    class="_fd-btn start-editor-clear-btn">
              Clear
            </button>
          </div>
        </div>

        <!-- Actions -->
        <div class="_fd-dialog-actions">
          <button class="_fd-btn _fd-btn-cancel">Cancel</button>
          <button class="_fd-btn _fd-btn-confirm start-editor-save-btn">
            Save
          </button>
        </div>
      </div>
    `;

    const selectEl = overlay.querySelector("#editor-app-select");
    const customSelect = overlay.querySelector("#custom-app-select");
    const customSelectLabel = overlay.querySelector("#custom-app-select-label");
    const dropdownList = overlay.querySelector("#custom-app-dropdown-list");
    const searchInput = overlay.querySelector("#custom-app-search");
    const optionsContainer = overlay.querySelector("#custom-app-options-container");
    const titleInput = overlay.querySelector("#editor-title-input");
    const iconInput = overlay.querySelector("#editor-icon-input");
    const confirmBtn = overlay.querySelector("._fd-btn-confirm");
    const cancelBtn = overlay.querySelector("._fd-btn-cancel");
    const uploadBtn = overlay.querySelector("#editor-upload-btn");
    const fileInput = overlay.querySelector("#editor-icon-file");
    const imagePreview = overlay.querySelector("#editor-image-preview");
    const clearBtn = overlay.querySelector("#editor-clear-upload-btn");

    const optionItems = apps.map((app) => {
      const opt = document.createElement("div");
      opt.className = "start-editor-option";

      opt.innerHTML = `
        <div class="start-editor-option-title">
          ${app.title}
          <span class="start-editor-option-id">(${app.id})</span>
        </div>
      `;

      opt.addEventListener("click", (e) => {
        e.stopPropagation();
        selectEl.value = app.id;
        dropdownList.style.display = "none";
        selectEl.dispatchEvent(new Event("change"));
      });

      optionsContainer.appendChild(opt);

      return {
        element: opt,
        id: app.id,
        title: app.title.toLowerCase(),
        idLower: app.id.toLowerCase()
      };
    });

    document.body.appendChild(overlay);

    const close = () => {
      overlay.remove();
      resolve(null);
    };

    confirmBtn.onclick = () => {
      const app = selectEl.value;
      const title = titleInput.value.trim();
      const icon = uploadedIconDataUrl || iconInput.value.trim();

      if (!app || !title) return;
      if (!uploadedIconDataUrl && !icon.startsWith("fa")) return;

      overlay.remove();
      resolve({ app, title, icon });
    };

    cancelBtn.onclick = close;

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });

    overlay.onkeydown = (ev) => {
      if (ev.key === "Escape") close();
      if (ev.key === "Enter") confirmBtn.click();
    };
  });
}

function addGridItem(appLauncher) {
  showStartItemEditor(appLauncher).then((result) => {
    if (result) {
      const items = getGridItems();
      items.push(result);
      saveGridItems(items);
      initializeAppGrid(appLauncher);
    }
  });
}

function editGridItem(itemData, index, appLauncher) {
  showStartItemEditor(appLauncher, itemData).then((result) => {
    if (result) {
      const items = getGridItems();
      items[index] = result;
      saveGridItems(items);
      initializeAppGrid(appLauncher);
    }
  });
}

function removeGridItem(index, appLauncher) {
  const items = getGridItems();
  items.splice(index, 1);
  saveGridItems(items);
  initializeAppGrid(appLauncher);
}

function showStartMenuContext(e, itemData, index, appLauncher) {
  showDynamicContextMenu(e, (menu, item, hr) => {
    menu.appendChild(
      item(
        "Edit Item",
        () => {
          editGridItem(itemData, index, appLauncher);
        },
        "fas fa-edit"
      )
    );
    menu.appendChild(
      item(
        "Remove Item",
        () => {
          removeGridItem(index, appLauncher);
        },
        "fas fa-trash-alt"
      )
    );
    menu.appendChild(hr());
    menu.appendChild(
      item(
        "Add New Item",
        () => {
          addGridItem(appLauncher);
        },
        "fas fa-plus"
      )
    );
  });
}

function showStartGridContext(e, appLauncher) {
  showDynamicContextMenu(e, (menu, item, hr) => {
    menu.appendChild(
      item(
        "Add New Item",
        () => {
          addGridItem(appLauncher);
        },
        "fas fa-plus"
      )
    );
  });
}

export function initializeAppGrid(appLauncher) {
  const grid = document.querySelector(".app-grid");
  if (!grid) return;
  grid.innerHTML = "";

  const items = getGridItems();
  const appRegistry = getAppRegistry();
  const fragment = document.createDocumentFragment();
  items.forEach((itemData, index) => {
    if (appRegistry.isAppUninstalled(itemData.app) || appRegistry.isAppDisabled(itemData.app)) return;
    const item = document.createElement("div");
    item.className = "start-menu-item";
    item.dataset.app = itemData.app;
    item.dataset.index = index;

    const iconVal = itemData.icon || "fas fa-star";
    item.appendChild(buildIconEl(iconVal));

    const contentEl = document.createElement("div");
    contentEl.className = "app-content";
    item.appendChild(contentEl);

    const titleEl = document.createElement("span");
    titleEl.className = "app-title";
    titleEl.textContent = itemData.title;
    contentEl.appendChild(titleEl);

    const descEl = document.createElement("span");
    descEl.className = "app-description";
    const description = APP_DESCRIPTIONS[itemData.app] || descriptionMap[itemData.app] || "";
    descEl.textContent = description;
    descEl.dataset.fullDescription = description;
    contentEl.appendChild(descEl);

    if (itemData.app === "newsApp") {
      const badge = document.createElement("span");
      badge.className = "news-badge";
      badge.style.display = "none";
      item.appendChild(badge);
    }

    item.draggable = true;

    item.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", index);
      e.dataTransfer.effectAllowed = "move";
      item.style.opacity = "0.4";
    });

    item.addEventListener("dragend", () => {
      item.style.opacity = "";
      item.style.transform = "";
      item.style.outline = "";
    });

    item.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    });

    item.addEventListener("dragenter", (e) => {
      e.preventDefault();
      item.style.transform = "scale(1.03)";
      item.style.outline = "2px dashed var(--brand)";
    });

    item.addEventListener("dragleave", () => {
      item.style.transform = "";
      item.style.outline = "";
    });

    item.addEventListener("drop", (e) => {
      e.preventDefault();
      item.style.transform = "";
      item.style.outline = "";
      const fromIndexStr = e.dataTransfer.getData("text/plain");
      if (fromIndexStr === "") return;
      const fromIndex = parseInt(fromIndexStr, 10);
      const toIndex = index;
      if (fromIndex !== toIndex) {
        const gridItems = getGridItems();
        const [moved] = gridItems.splice(fromIndex, 1);
        gridItems.splice(toIndex, 0, moved);
        saveGridItems(gridItems);
        initializeAppGrid(appLauncher);
      }
    });

    item.addEventListener("click", () => os.app.launch(itemData.app));

    item.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      showStartMenuContext(e, itemData, index, appLauncher);
    });

    fragment.appendChild(item);
  });

  grid.appendChild(fragment);

  if (items.length === 0) {
    const placeholder = document.createElement("div");
    placeholder.className = "start-menu-item";
    placeholder.style.opacity = "0";
    placeholder.style.transition = "opacity 0.2s";
    placeholder.style.cursor = "pointer";

    const iconEl = document.createElement("i");
    iconEl.className = "fas fa-plus";
    placeholder.appendChild(iconEl);

    const spanEl = document.createElement("span");
    spanEl.textContent = "Add Item";
    placeholder.appendChild(spanEl);

    placeholder.addEventListener("click", () => addGridItem(appLauncher));

    grid.appendChild(placeholder);

    grid.onmouseenter = () => {
      placeholder.style.opacity = "1";
    };
    grid.onmouseleave = () => {
      placeholder.style.opacity = "0";
    };
  } else {
    grid.onmouseenter = null;
    grid.onmouseleave = null;
  }

  grid.addEventListener("contextmenu", (e) => {
    if (e.target === grid || items.length === 0) {
      e.preventDefault();
      e.stopPropagation();
      showStartGridContext(e, appLauncher);
    }
  });

  refreshIcons(grid);
}

const LETTER_SEPARATOR = "—".repeat(20);

function populateCategoryPage(category, appLauncher) {
  const page = document.querySelector(`.start-page[data-page="${category}"]`);
  if (!page) return;

  const grid = page.querySelector(".app-grid");
  if (!grid) return;
  grid.innerHTML = "";

  const appRegistry = getAppRegistry();
  const allApps = { ...appMap, ...os.app.getAllApps() };

  const apps = [];
  Object.entries(allApps).forEach(([appId, appData]) => {
    if (appRegistry.isAppUninstalled(appId) || appRegistry.isAppDisabled(appId)) return;

    let shouldInclude = false;
    if (category === "all") {
      shouldInclude = true;
    } else if (category === "games") {
      shouldInclude = appData.type === "game";
    } else if (category === "system") {
      shouldInclude = appData.type === "system";
    } else {
      const appCategory = appData.category || SYSTEM_APPS[appId]?.category || "system";
      shouldInclude = appCategory === category;
    }

    if (shouldInclude) {
      apps.push({ appId, appData });
    }
  });

  const fragment = document.createDocumentFragment();

  if (category === "all") {
    apps.sort((a, b) => (a.appData.title || a.appId).localeCompare(b.appData.title || b.appId));

    const groupedApps = {};
    apps.forEach(({ appId, appData }) => {
      const title = appData.title || appId;
      const firstLetter = title.charAt(0).toUpperCase();
      if (!groupedApps[firstLetter]) {
        groupedApps[firstLetter] = [];
      }
      groupedApps[firstLetter].push({ appId, appData });
    });

    Object.keys(groupedApps)
      .sort()
      .forEach((letter) => {
        const letterHeader = document.createElement("div");
        letterHeader.className = "letter-category-header";
        letterHeader.innerHTML = `<span class="letter-title">${letter}</span><span class="letter-separator">${LETTER_SEPARATOR}</span>`;
        fragment.appendChild(letterHeader);

        groupedApps[letter].forEach(({ appId, appData }) => {
          fragment.appendChild(createAppItem(appId, appData));
        });
      });
  } else {
    apps.forEach(({ appId, appData }) => {
      fragment.appendChild(createAppItem(appId, appData));
    });
  }

  grid.appendChild(fragment);
}

function createAppItem(appId, appData) {
  const item = document.createElement("div");
  item.className = "start-menu-item";
  item.dataset.app = appId;
  item.style.position = "relative";

  item.appendChild(buildIconEl(appData.icon || "fas fa-star"));

  const contentEl = document.createElement("div");
  contentEl.className = "app-content";
  item.appendChild(contentEl);

  const titleEl = document.createElement("span");
  titleEl.className = "app-title";
  titleEl.textContent = appData.title || appId;
  contentEl.appendChild(titleEl);

  const descEl = document.createElement("span");
  descEl.className = "app-description";
  const description = APP_DESCRIPTIONS[appId] || descriptionMap[appId] || "";
  descEl.textContent = description;
  descEl.dataset.fullDescription = description;
  contentEl.appendChild(descEl);

  descEl.addEventListener("mouseenter", (e) => {
    if (description.length > 50) {
      const rect = descEl.getBoundingClientRect();
      showDescriptionTooltip(description, rect.left, rect.bottom);
    }
  });
  descEl.addEventListener("mouseleave", hideDescriptionTooltip);

  const star = createStarButton(appId);
  star.style.opacity = "0";
  star.style.transition = "opacity 0.2s";
  item.appendChild(star);

  item.addEventListener("mouseenter", () => (star.style.opacity = "1"));
  item.addEventListener("mouseleave", () => (star.style.opacity = "0"));

  if (getFavorites().includes(appId)) {
    item.style.background = "rgba(255, 215, 0, 0.1)";
  }

  item.addEventListener("click", () => {
    trackRecentlyUsed(appId);
    os.app.launch(appId);
    closeStartMenu();
  });

  return item;
}

export function populateStartMenu(appLauncher) {
  const pageMap = {
    system: document.querySelector('.start-page[data-page="system"]'),
    apps: document.querySelector('.start-page[data-page="apps"]'),
    games: document.querySelector('.start-page[data-page="games"]'),
    favorites: document.querySelector('.start-page[data-page="favorites"]')
  };

  ["system", "apps", "games"].forEach((cat) => {
    if (pageMap[cat]) {
      const grid = pageMap[cat].querySelector(".app-grid");
      if (grid) grid.innerHTML = "";
    }
  });

  const appRegistry = getAppRegistry();
  Object.entries(appLauncher.appMap).forEach(([appName, appData]) => {
    if (appRegistry.isAppUninstalled(appName) || appRegistry.isAppDisabled(appName)) return;

    const item = createAppItem(appName, appData);

    if (appData.type === "system") {
      const grid = pageMap.system?.querySelector(".app-grid");
      grid?.appendChild(item);
    } else {
      const grid = pageMap.games?.querySelector(".app-grid");
      grid?.appendChild(item);
    }
  });
}
