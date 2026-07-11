import { appMap } from "../games/gamesList.js";
import { APP_DESCRIPTIONS, descriptionMap } from "../games/gameDescriptions.js";
import { camelize } from "../utils/utils.js";
import { ClippyAnimation, speak } from "../ai/clippy.js";
import { isImageFile, resolveFileIcon, openFileWith } from "../fileDisplay.js";
import { resolveIconUrl } from "../shared/assetResolver.js";
import { showDynamicContextMenu, refreshIcons } from "../shared/contextMenu.js";
import { CDN_CONFIG } from "../shared/cdnConfig.js";
import { getAppRegistry } from "../appRegistry.js";
import { SYSTEM_APPS } from "../AppRegistryConfig.js";
import { resolveAvatarUrl } from "../shared/avatarResolver.js";
import { SETTINGS_CATEGORIES, launchSettingsPane } from "../settings/settingsNav.js";

import {
  $,
  $$,
  createElement,
  setHTML,
  setText,
  addClass,
  removeClass,
  toggleClass,
  setStyle
} from "../shared/domUtils.js";
import { BusEvents } from "../core/EventBus.js";
import { StorageKeys, os } from "../framework.js";
import { KeybindManager } from "../keybindManager.js";
function getStartMenuEl() {
  return $("#start-menu") || $(".start-menu");
}

let descriptionTooltip = null;

function showDescriptionTooltip(text, x, y) {
  if (descriptionTooltip) {
    document.body.removeChild(descriptionTooltip);
  }

  descriptionTooltip = createElement("div", { className: "description-tooltip", text });
  setStyle(descriptionTooltip, { left: `${x + 10}px`, top: `${y + 10}px` });
  document.body.appendChild(descriptionTooltip);
}

function hideDescriptionTooltip() {
  if (descriptionTooltip) {
    document.body.removeChild(descriptionTooltip);
    descriptionTooltip = null;
  }
}

function isStartMenuOpen() {
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
    } catch (e) {
      console.error("[StartMenu]", e);
    }
  }
  const staticCatNames = [
    "favorites",
    "recent",
    "all",
    "internet",
    "media",
    "office",
    "graphics",
    "games",
    "development",
    "system",
    "help"
  ];
  const el2 = el.querySelector('.start-cat[data-cat="places"]');
  if (el2) el2.style.display = "none";
  staticCatNames.forEach((catName) => {
    const isEnabled = cats[catName] !== false;
    const catEl = el.querySelector(`.start-cat[data-cat="${catName}"]`);
    if (catEl) {
      catEl.style.display = isEnabled ? "flex" : "none";
    }
  });
}

function openStartMenu({ focusSearch = false, openDefaultPage = true } = {}) {
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
      } catch (e) {
        console.error("[StartMenu]", e);
      }
    }
    let defaultCat = "recent";
    if (cats["recent"] === false) {
      const catNames = [
        "recent",
        "all",
        "favorites",
        "internet",
        "media",
        "office",
        "graphics",
        "games",
        "development",
        "system",
        "help",
        "customize",
        "settingsApp"
      ];
      const firstEnabled = catNames.find((c) => cats[c] !== false);
      if (firstEnabled) defaultCat = firstEnabled;
    }
    el.querySelector(`.start-cat[data-cat="${defaultCat}"]`)?.click();
  }

  if (focusSearch) {
    $("#start-menu-search")?.focus?.();
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
    const iconEl = createElement("img");
    let iconSrc = iconVal;
    if (iconVal.startsWith("static/") || iconVal.startsWith("/static/")) {
      const cleanPath = iconVal.startsWith("/") ? iconVal.substring(1) : iconVal;
      iconSrc = `${CDN_CONFIG.repos.main.base}/${cleanPath}`;
    } else {
      iconSrc = resolveIconUrl(iconVal);
    }
    iconEl.src = iconSrc;
    iconEl.alt = "";
    iconEl.loading = "lazy";
    return iconEl;
  }
  const iconEl = createElement("i");
  iconEl.className = iconVal.startsWith("fa") ? iconVal : `fa ${iconVal}`;
  return iconEl;
}

function createStarButton(appName) {
  const btn = createElement("span");
  btn.textContent = "★";
  btn.className = "star";
  btn.style.color = getFavorites().includes(appName) ? "var(--brand)" : "#ccc";

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
  $$(`.start-menu-item[data-app="${appName}"] span`).forEach((star) => {
    if (star.textContent === "★") {
      star.style.color = isFavorite ? "var(--brand)" : "#ccc";
    }
  });
  const item = $(`.start-menu-item[data-app="${appName}"]`);
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
  const val = os.storage.get(StorageKeys.recentlyUsedApps);
  return Array.isArray(val) ? val : [];
}

export function trackRecentlyUsed(appId) {
  let recent = getRecentlyUsed();
  recent = recent.filter((id) => id !== appId);
  recent.unshift(appId);
  if (recent.length > RECENTLY_USED_MAX) recent = recent.slice(0, RECENTLY_USED_MAX);
  os.storage.set(StorageKeys.recentlyUsedApps, recent);
}

function createRecentAppItem(appId, appData) {
  const item = createElement("div");
  item.className = "recent-item";
  item.dataset.app = appId;
  item.appendChild(buildIconEl(appData.icon || "fas fa-star"));
  const content = createElement("div");
  content.className = "app-content";
  const title = createElement("span");
  title.className = "app-title";
  title.textContent = appData.title || appId;
  content.appendChild(title);
  const desc = createElement("span");
  desc.className = "app-description";
  desc.textContent = APP_DESCRIPTIONS[appId] || descriptionMap[appId] || "";
  content.appendChild(desc);
  item.appendChild(content);
  item.addEventListener("click", () => {
    trackRecentlyUsed(appId);
    os.app.launch(appId);
    closeStartMenu();
  });
  return item;
}

function createRecentFileItem(name, path, kind) {
  const item = createElement("div");
  item.className = "recent-item";
  item.dataset.fileName = name;
  item.dataset.filePath = path;

  const rawIcon = resolveFileIcon(name);
  let iconSrc = rawIcon;
  if (rawIcon === "@content" || rawIcon === "rom") {
    iconSrc = "static/icons/file.webp";
  }
  const iconEl = buildIconEl(iconSrc);

  const content = createElement("div");
  content.className = "app-content";
  const title = createElement("span");
  title.className = "app-title";
  title.textContent = name;
  const desc = createElement("span");
  desc.className = "app-description";
  desc.textContent = path;

  content.appendChild(title);
  content.appendChild(desc);
  item.appendChild(iconEl);
  item.appendChild(content);

  item.addEventListener("click", () => {
    if (!sharedAppLauncher) return;
    closeStartMenu();
    const dir = path.split("/").filter(Boolean);
    openFileWith({
      name,
      path: dir,
      fs: sharedAppLauncher.fs,
      notepadApp: sharedAppLauncher.notepadApp,
      browserApp: sharedAppLauncher.browserApp,
      windowManager: sharedAppLauncher.wm,
      officeApp: sharedAppLauncher.officeApp,
      markdownApp: sharedAppLauncher.markdownApp,
      jsDosApp: sharedAppLauncher.jsDosApp,
      appLauncher: sharedAppLauncher
    });
  });

  return item;
}

function updateRecentlyUsedUI() {
  const page = document.querySelector('.start-page[data-page="recent"]');
  if (!page) return;
  const wasActive = page.classList.contains("active");
  page.className = "start-page recent-page";
  if (wasActive) page.classList.add("active");
  page.innerHTML = "";

  const header = createElement("div");
  header.className = "recent-page-header";
  header.innerHTML = "<span>Recent</span>";

  const clearBtn = createElement("button");
  clearBtn.className = "recent-clear-btn";
  clearBtn.textContent = "Clear";
  clearBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    os.storage.set(StorageKeys.recentFiles, []);
    os.storage.set(StorageKeys.recentlyUsedApps, []);
    updateRecentlyUsedUI();
  });
  header.appendChild(clearBtn);
  page.appendChild(header);

  const recentFiles = os.storage.get(StorageKeys.recentFiles) || [];

  if (recentFiles.length > 0) {
    const filesHeader = createElement("div");
    filesHeader.className = "recent-section-header";
    filesHeader.textContent = "Recent Files";
    page.appendChild(filesHeader);
    recentFiles.forEach((f) => {
      page.appendChild(createRecentFileItem(f.name, f.path, f.kind));
    });
  }

  const appRegistry = getAppRegistry();
  const allApps = { ...appMap, ...os.app.getAllApps() };
  const recentApps = getRecentlyUsed();
  const validApps = recentApps.filter((appId) => {
    const appData = allApps[appId];
    if (!appData) return false;
    if (appRegistry.isAppUninstalled(appId) || appRegistry.isAppDisabled(appId)) return false;
    return true;
  });

  if (validApps.length > 0) {
    const appsHeader = createElement("div");
    appsHeader.className = "recent-section-header";
    appsHeader.textContent = "Recent Apps";
    page.appendChild(appsHeader);
    validApps.forEach((appId) => {
      page.appendChild(createRecentAppItem(appId, allApps[appId]));
    });
  }

  if (recentFiles.length === 0 && validApps.length === 0) {
    const empty = createElement("div");
    empty.className = "recent-empty";
    empty.textContent = "No recently used items";
    page.appendChild(empty);
  }
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
  const firstItem = $(".start-menu-item:not(.letter-category-header)", page);
  if (firstItem) {
    selectedItem = firstItem;
    selectedItem.classList.add("selected");
  }
}

function focusSearch() {
  clearSelection();
  focusMode = "search";
  $("#start-menu-search")?.focus();
}

function navigateSelection(direction) {
  const activePage = $(".start-page.active");
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
  $$(".start-cat").forEach((c) => c.classList.remove("active"));
  $$(".start-page").forEach((p) => p.classList.remove("active"));
  cat.classList.add("active");
  const page = $(`.start-page[data-page="${cat.dataset.cat}"]`);
  if (!page) return;
  page.classList.add("active");
  if (cat.dataset.cat === "favorites") {
    updateFavoritesUI();
  } else if (cat.dataset.cat === "recent") {
    updateRecentlyUsedUI();
  } else if (
    ["all", "internet", "media", "office", "graphics", "games", "development", "system", "help"].includes(
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
  const categories = Array.from($(".start-cat:not(.docked)")).filter(
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
    const activeCat = $(".start-cat.active");
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
    const activePage = $(".start-page.active");
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
  const menuEl = $("#start-menu") || $(".start-menu");
  if (menuEl) {
    applyStartMenuSettings(menuEl);
  }
  $(".start-menu")?.addEventListener("contextmenu", (e) => e.preventDefault());

  $("#start-lock-btn")?.addEventListener("click", () => {
    closeStartMenu();
    sessionManager?.lockSession();
  });

  $("#start-signout-btn")?.addEventListener("click", () => {
    closeStartMenu();
    sessionManager?.lockToLoginScreen();
  });

  $("#start-sleep-btn")?.addEventListener("click", () => {
    closeStartMenu();
    sessionManager?.sleep?.();
  });

  $("#start-restart-btn")?.addEventListener("click", () => {
    closeStartMenu();
    sessionManager?.restart?.();
  });

  $("#start-shutdown-btn")?.addEventListener("click", () => {
    closeStartMenu();
    sessionManager?.shutdown?.();
  });

  $$(".start-cat").forEach((cat) => {
    if (cat.classList.contains("docked") || !cat.dataset.cat) {
      return;
    }

    cat.onclick = () => {
      const catName = cat.dataset.cat;
      if (catName === "settingsApp") {
        os.app.launch("settingsApp");
        return;
      }
      if (catName === "customize") {
        os.app.launch("settingsApp", { section: "pane-accounts" });
        speak("Let's make your profile look great!", ClippyAnimation.GetArtsy);
        return;
      }
      activateCategoryPage(cat);
      if (catName === "favorites") {
        speak("These are your favorites! Great taste.", ClippyAnimation.Show);
      }
      if (focusMode === "apps") {
        const page = $(`.start-page[data-page="${catName}"]`);
        if (page) selectFirstItemInPage(page);
      }
    };
  });

  const searchInput = $("#start-menu-search");

  searchInput.addEventListener("focus", () => {
    focusMode = "search";
    clearSelection();
    speak("Looking for an app? I know where everything is.", ClippyAnimation.Searching);
  });

  if (!keyboardHandlerInstalled) {
    document.addEventListener("keydown", (e) => {
      if (!isStartMenuOpen()) return;

      if (KeybindManager.matches(e, "startMenu.arrowDown")) {
        e.preventDefault();
        if (focusMode === "search") {
          $("#start-menu-search")?.blur();
          focusMode = "categories";
          navigateCategories("down");
        } else if (focusMode === "categories") {
          navigateCategories("down");
        } else {
          navigateSelection("down");
        }
      } else if (KeybindManager.matches(e, "startMenu.arrowUp")) {
        e.preventDefault();
        if (focusMode === "search") {
          $("#start-menu-search")?.blur();
          focusMode = "apps";
          navigateSelection("up");
        } else if (focusMode === "categories") {
          navigateCategories("up");
        } else {
          navigateSelection("up");
        }
      } else if (KeybindManager.matches(e, "startMenu.arrowLeft")) {
        e.preventDefault();
        if (focusMode === "search") {
          $("#start-menu-search")?.blur();
        }
        switchFocusMode("categories");
      } else if (KeybindManager.matches(e, "startMenu.arrowRight")) {
        e.preventDefault();
        if (focusMode === "search") {
          $("#start-menu-search")?.blur();
        }
        switchFocusMode("apps");
      } else if (KeybindManager.matches(e, "startMenu.enter")) {
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
  function fuzzyMatch(query, target) {
    const q = query.toLowerCase().trim();
    const t = target.toLowerCase().trim();

    if (!q) return true;
    if (t.includes(q)) return true;

    const qWords = q.split(/\s+/);
    const tWords = t.split(/\s+/);

    for (let i = 0; i < qWords.length; i++) {
      const qw = qWords[i];

      let matched = false;

      for (let j = 0; j < tWords.length; j++) {
        const tw = tWords[j];

        if (tw === qw || tw.startsWith(qw)) {
          matched = true;
          break;
        }

        if (isCloseMatch(qw, tw)) {
          matched = true;
          break;
        }
      }

      if (!matched) return false;
    }

    return true;
  }

  function isCloseMatch(a, b) {
    if (a.length < 3) return false;

    const dist = levenshtein(a, b);

    return dist <= 1 || (a.length <= 5 && dist <= 2);
  }

  function levenshtein(a, b) {
    const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));

    for (let i = 0; i <= a.length; i++) dp[i][0] = i;
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;

    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;

        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      }
    }

    return dp[a.length][b.length];
  }
  searchInput.addEventListener("input", (e) => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      const q = e.target.value.toLowerCase().trim();
      const searchResultsPage = document.querySelector('.start-page[data-page="search-results"]');

      if (!searchResultsPage) {
        const resultsPage = createElement("div");
        resultsPage.className = "start-page";
        resultsPage.dataset.page = "search-results";
        resultsPage.innerHTML = '<div class="search-results-container"></div>';
        $(".start-content").appendChild(resultsPage);
      }

      if (q === "") {
        $(".start-menu")?.classList.remove("search-mode");
        $$(".start-page").forEach((page) => {
          if (page.dataset.page === "search-results") {
            page.classList.remove("active");
            page.style.display = "none";
          } else {
            page.style.display = "";
            $$(".start-menu-item").forEach((item) => {
              item.style.display = "";
            });
          }
        });

        const activeCat = $(".start-cat.active");
        if (activeCat) {
          const page = $(`.start-page[data-page="${activeCat.dataset.cat}"]`);
          if (page) page.classList.add("active");
        }
        return;
      }

      $(".start-menu")?.classList.add("search-mode");
      $$(".start-page").forEach((page) => {
        page.classList.remove("active");
        page.style.display = "none";
      });

      const resultsPage = document.querySelector('.start-page[data-page="search-results"]');
      resultsPage.style.display = "flex";
      resultsPage.classList.add("active");
      const resultsContainer = $(".search-results-container", resultsPage);
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
        if (!fuzzyMatch(q, title) && !fuzzyMatch(q, description)) return;
        seenAppIds.add(appId);
        const item = createAppItem(appId, appData);
        const category = appData.type === "system" ? "system" : "menu";
        results[category].push({ element: item, title: appData.title || appId });
      });

      SETTINGS_CATEGORIES.forEach((cat) => {
        const title = `Settings: ${cat.title}`;
        if (fuzzyMatch(q, title.toLowerCase())) {
          const appId = `settings-${cat.id}`;
          if (!seenAppIds.has(appId)) {
            seenAppIds.add(appId);
            const appData = { title, icon: cat.icon, type: "system", category: "system" };
            results.system.push({ element: createAppItem(appId, appData), title });
          }
        }
      });

      const recentFiles = os.storage.get(StorageKeys.recentFiles) || [];
      const fileResults = recentFiles.filter((f) => {
        return fuzzyMatch(q, f.name) || fuzzyMatch(q, f.path);
      });

      const categoryOrder = ["menu", "games", "files", "system"];
      const categoryLabels = { menu: "Menu", games: "Games", files: "Files", system: "System" };

      const fragment = document.createDocumentFragment();
      let hasResults = false;
      categoryOrder.forEach((cat) => {
        if (cat === "files") {
          if (fileResults.length > 0) {
            hasResults = true;
            const categoryHeader = createElement("div");
            categoryHeader.className = "search-category-header";
            categoryHeader.textContent = categoryLabels.files;
            fragment.appendChild(categoryHeader);

            const categoryResults = createElement("div");
            categoryResults.className = "search-category-results";
            fileResults.forEach((f) => {
              categoryResults.appendChild(createRecentFileItem(f.name, f.path, f.kind));
            });
            fragment.appendChild(categoryResults);
          }
          return;
        }
        if (results[cat].length > 0) {
          hasResults = true;
          const categoryHeader = createElement("div");
          categoryHeader.className = "search-category-header";
          categoryHeader.textContent = categoryLabels[cat];
          fragment.appendChild(categoryHeader);

          const categoryResults = createElement("div");
          categoryResults.className = "search-category-results";
          results[cat].forEach((result) => {
            result.element.style.display = "";
            categoryResults.appendChild(result.element);
          });
          fragment.appendChild(categoryResults);
        }
      });

      if (!hasResults) {
        const noResults = createElement("div");
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
  const hideGamesBtn = $("#hide-games-btn");

  const applyHideGames = (hidden) => {
    $$("#desktop .icon").forEach((icon) => {
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
  const hideSystemBtn = $("#hide-system-btn");

  const applyHideSystemApps = (hidden) => {
    $$("#desktop .icon").forEach((icon) => {
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
  const startUser = $(".start-user");
  if (!startUser) return;

  const user = getCurrentUser();

  const nameSpan = $("span", startUser);
  const avatarImg = $("img", startUser);

  if (nameSpan) nameSpan.textContent = user.name;
  if (avatarImg) avatarImg.src = await resolveAvatarUrl(user.avatar, "static/icons/guest.webp");
}

function setupStartUserHover() {
  const startUser = $(".start-user");
  if (!startUser) return;

  let tooltip = null;

  startUser.addEventListener("mouseenter", () => {
    const user = getCurrentUser();

    tooltip = createElement("div");
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

  os.events.on(BusEvents.PROFILE_UPDATED, () => {
    updateStartUserDisplay();
  });

  os.events.on(BusEvents.SESSION_INITIALIZED, () => {
    updateStartUserDisplay();
  });
}

export function tryGetIcon(id) {
  id = camelize(id);

  if (id === "explorerApp") {
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

    const div = $(`#desktop div[data-app="${id}"]`);
    const imgEl = div && $("img", div);
    const svgEl = div && $("svg", div);
    const imgSrc = imgEl?.src || svgEl;
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
    { app: "aiAssistantApp", title: "Yuki AI Assistant", icon: "fas fa-robot" },
    { app: "notepadApp", title: "Notepad", icon: "fas fa-edit" },
    { app: "calculatorApp", title: "Calculator", icon: "fas fa-calculator" },
    { app: "shortcutsApp", title: "Shortcuts", icon: "fas fa-keyboard" },
    { app: "yukiConvertApp", title: "Yuki Convert", icon: "fas fa-exchange-alt" },
    { app: "cameraApp", title: "Camera", icon: "fas fa-camera" },
    { app: "officeApp", title: "Office", icon: "fas fa-file-word" },
    { app: "installedAppsApp", title: "Installed Apps", icon: "fas fa-th-list" },
    { app: "clipboardManagerApp", title: "Clipboard Manager", icon: "fas fa-paste" },
    { app: "weatherApp", title: "Weather", icon: "fas fa-cloud" },
    { app: "yukiOsGuideApp", title: "YukiOS Guide", icon: "fas fa-book-open" },
    { app: "steamApp", title: "Steam", icon: "fab fa-steam" },
    { app: "paint", title: "Paint", icon: "fas fa-paint-brush" },
    { app: "newsApp", title: "What's New", icon: "fas fa-newspaper" },
    { app: "shittifyApp", title: "Evil Spotify", icon: "fas fa-music" },
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

    const overlay = createElement("div");
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
        <div class="fd-dialog-title">${dialogTitle}</div>

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
                 class="fd-dialog-input start-editor-input"
                 type="text"
                 value="${titleVal}" />
        </div>

        <!-- Icon -->
        <div class="start-editor-field">
          <label class="start-editor-label">FontAwesome Icon Class</label>
          <input id="editor-icon-input"
                 class="fd-dialog-input start-editor-input"
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

            <button id="editor-upload-btn" class="fd-btn start-editor-btn">
              Choose Image...
            </button>

            <div id="editor-image-preview" class="start-editor-preview">
              <span id="editor-preview-placeholder">None</span>
            </div>

            <button id="editor-clear-upload-btn"
                    class="fd-btn start-editor-clear-btn">
              Clear
            </button>
          </div>
        </div>

        <!-- Actions -->
        <div class="fd-dialog-actions">
          <button class="fd-btn fd-btn-cancel">Cancel</button>
          <button class="fd-btn fd-btn-confirm start-editor-save-btn">
            Save
          </button>
        </div>
      </div>
    `;

    const selectEl = $("#editor-app-select", overlay);
    const customSelect = $("#custom-app-select", overlay);
    const customSelectLabel = $("#custom-app-select-label", overlay);
    const dropdownList = $("#custom-app-dropdown-list", overlay);
    const searchInput = $("#custom-app-search", overlay);
    const optionsContainer = $("#custom-app-options-container", overlay);
    const titleInput = $("#editor-title-input", overlay);
    const iconInput = $("#editor-icon-input", overlay);
    const confirmBtn = $(".fd-btn-confirm", overlay);
    const cancelBtn = $(".fd-btn-cancel", overlay);
    const uploadBtn = $("#editor-upload-btn", overlay);
    const fileInput = $("#editor-icon-file", overlay);
    const imagePreview = $("#editor-image-preview", overlay);
    const clearBtn = $("#editor-clear-upload-btn", overlay);

    const optionItems = apps.map((app) => {
      const opt = createElement("div");
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
      if (KeybindManager.matches(ev, "session.cancel")) close();
      if (KeybindManager.matches(ev, "startMenu.enter")) confirmBtn.click();
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
  const grid = $(".app-grid");
  if (!grid) return;
  grid.innerHTML = "";

  const items = getGridItems();
  const appRegistry = getAppRegistry();
  const fragment = document.createDocumentFragment();
  items.forEach((itemData, index) => {
    if (appRegistry.isAppUninstalled(itemData.app) || appRegistry.isAppDisabled(itemData.app)) return;
    const item = createElement("div");
    item.className = "start-menu-item";
    item.dataset.app = itemData.app;
    item.dataset.index = index;

    const iconVal = itemData.icon || "fas fa-star";
    item.appendChild(buildIconEl(iconVal));

    const contentEl = createElement("div");
    contentEl.className = "app-content";
    item.appendChild(contentEl);

    const titleEl = createElement("span");
    titleEl.className = "app-title";
    titleEl.textContent = itemData.title;
    contentEl.appendChild(titleEl);

    const descEl = createElement("span");
    descEl.className = "app-description";
    const description = APP_DESCRIPTIONS[itemData.app] || descriptionMap[itemData.app] || "";
    descEl.textContent = description;
    descEl.dataset.fullDescription = description;
    contentEl.appendChild(descEl);

    if (itemData.app === "newsApp") {
      const badge = createElement("span");
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

    item.addEventListener("click", () => {
      trackRecentlyUsed(itemData.app);
      os.app.launch(itemData.app);
      closeStartMenu();
    });

    item.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      showStartMenuContext(e, itemData, index, appLauncher);
    });

    fragment.appendChild(item);
  });

  grid.appendChild(fragment);

  if (items.length === 0) {
    const placeholder = createElement("div");
    placeholder.className = "start-menu-item";
    placeholder.style.opacity = "0";
    placeholder.style.transition = "opacity 0.2s";
    placeholder.style.cursor = "pointer";

    const iconEl = createElement("i");
    iconEl.className = "fas fa-plus";
    placeholder.appendChild(iconEl);

    const spanEl = createElement("span");
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
  const page = $(`.start-page[data-page="${category}"]`);
  if (!page) return;

  const grid = $(".app-grid", page);
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
      const appCategory = appData.category || SYSTEM_APPS[appId]?.category || "system";
      shouldInclude = appData.type === "system" && appCategory === "system";
    } else {
      const appCategory = appData.category || SYSTEM_APPS[appId]?.category || "system";
      shouldInclude = appCategory === category;
    }

    if (shouldInclude) {
      apps.push({ appId, appData });
    }
  });

  if (category === "all" || category === "system") {
    SETTINGS_CATEGORIES.forEach((cat) => {
      const appId = `settings-${cat.id}`;
      const appData = { title: `Settings: ${cat.title}`, icon: cat.icon, type: "system", category: "system" };
      apps.push({ appId, appData });
    });
  }

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
        const letterHeader = createElement("div");
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
  const item = createElement("div");
  item.className = "start-menu-item";
  item.dataset.app = appId;
  item.style.position = "relative";

  item.appendChild(buildIconEl(appData.icon || "fas fa-star"));

  const contentEl = createElement("div");
  contentEl.className = "app-content";
  item.appendChild(contentEl);

  const titleEl = createElement("span");
  titleEl.className = "app-title";
  titleEl.textContent = appData.title || appId;
  contentEl.appendChild(titleEl);

  const descEl = createElement("span");
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
    if (appId.startsWith("settings-")) {
      const paneId = appId.replace("settings-", "");
      launchSettingsPane(paneId);
    } else {
      trackRecentlyUsed(appId);
      os.app.launch(appId);
    }
    closeStartMenu();
  });

  return item;
}
