import { appMap } from "../games/gamesList.js";
import { camelize } from "../utils/utils.js";
import { StorageKeys } from "../settings/settings.js";
import { ClippyAnimation, speak } from "../ai/clippy.js";
import { isImageFile } from "../utils/utils.js";
import { resolveIconUrl } from "../shared/assetResolver.js";
import { showDynamicContextMenu, refreshIcons } from "../shared/contextMenu.js";
import { CDN_CONFIG } from "../shared/cdnConfig.js";
import { getAppRegistry } from "../appRegistry.js";
import { os } from "../os/index.js";

function getStartMenuEl() {
  return document.getElementById("start-menu") || document.querySelector(".start-menu");
}

export function isStartMenuOpen() {
  const el = getStartMenuEl();
  return !!el && el.style.display === "flex";
}

export function closeStartMenu() {
  const el = getStartMenuEl();
  if (!el) return;
  if (el.style.display !== "flex") return;

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
  const catNames = ["menu", "games", "system", "favorites", "customize", "settingsApp"];
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
  updateFavoritesUI();

  if (sharedAppLauncher) {
    populateStartMenu(sharedAppLauncher);
  }

  if (openDefaultPage) {
    const catsData = os.storage.get(StorageKeys.startMenuCats);
    let cats = {};
    if (catsData) {
      try {
        cats = catsData;
      } catch (e) {}
    }
    let defaultCat = "menu";
    if (cats["menu"] === false) {
      const catNames = ["menu", "games", "system", "favorites", "customize", "settingsApp"];
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
  return os.storage.get(StorageKeys.favoritesKey) || [];
}

function saveFavorites(favorites) {
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
  document.querySelectorAll(`.start-item[data-app="${appName}"] span`).forEach((star) => {
    if (star.textContent === "★") {
      star.style.color = isFavorite ? "gold" : "#ccc";
    }
  });
  const item = document.querySelector(`.start-item[data-app="${appName}"]`);
  if (item) {
    item.style.background = isFavorite ? "rgba(255, 215, 0, 0.1)" : "transparent";
  }
}
let sharedAppLauncher;
export function updateFavoritesUI() {
  if (!sharedAppLauncher) {
    console.error("No app launcher");
    return;
  }

  const favoritesPage = document.querySelector('.start-page[data-page="favorites"]');
  favoritesPage.innerHTML = "";
  const favorites = getFavorites();

  if (favorites.length === 0) {
    const noFav = document.createElement("div");
    noFav.textContent = "No favorite apps";
    favoritesPage.appendChild(noFav);
    return;
  }

  favorites.forEach((appName) => {
    const appItem = document.querySelector(`.start-item[data-app="${appName}"]`);
    if (!appItem) return;

    const clone = appItem.cloneNode(true);
    clone.style.position = "relative";
    clone.style.background = "rgba(255, 215, 0, 0.1)";

    clone.onclick = () => os.app.launch(appName);

    const oldStar = clone.querySelector(".star");
    if (oldStar) oldStar.remove();

    clone.appendChild(createStarButton(appName));

    favoritesPage.appendChild(clone);
  });
}

function setupStars() {
  document.querySelectorAll(".start-page:not([data-page='favorites']) .start-item").forEach((item) => {
    const appName = item.dataset.app;
    item.style.position = "relative";
    const star = createStarButton(appName);
    star.style.opacity = "0";
    star.style.transition = "opacity 0.2s";
    item.appendChild(star);

    item.addEventListener("mouseenter", () => (star.style.opacity = "1"));
    item.addEventListener("mouseleave", () => (star.style.opacity = "0"));

    if (getFavorites().includes(appName)) {
      item.style.background = "rgba(255, 215, 0, 0.1)";
    }
  });
}

export function setupStartMenu(appLauncher, sessionManager, explorerApp, notepadApp, selectionManager) {
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
        os.app.launch("profileCustomizer");
        return;
      }
      document.querySelectorAll(".start-cat").forEach((c) => c.classList.remove("active"));
      document.querySelectorAll(".start-page").forEach((p) => p.classList.remove("active"));
      cat.classList.add("active");

      const page = document.querySelector(`.start-page[data-page="${cat.dataset.cat}"]`);
      if (page) page.classList.add("active");

      if (cat.dataset.cat === "favorites") {
        speak("These are your favorites! Great taste.", ClippyAnimation.Show);
      }
      if (cat.dataset.cat === "customize") {
        speak("Let's make your profile look great!", ClippyAnimation.GetArtsy);
      }
    };
  });

  const searchInput = document.getElementById("start-menu-search");

  searchInput.addEventListener("focus", () => {
    speak("Looking for an app? I know where everything is.", ClippyAnimation.Searching);
  });

  searchInput.addEventListener("input", (e) => {
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
          document.querySelectorAll(".start-item, .start-menu-item").forEach((item) => {
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
    const results = {
      menu: [],
      games: [],
      system: []
    };
    const seenAppIds = new Set();

    document.querySelectorAll(".start-menu-item").forEach((item) => {
      const appId = item.dataset.app;
      if (appId && seenAppIds.has(appId)) return;
      const matchesSearch = item.textContent.toLowerCase().includes(q);
      if (matchesSearch) {
        if (appId) seenAppIds.add(appId);
        results.menu.push({
          element: item.cloneNode(true),
          title: item.textContent.trim()
        });
      }
    });

    document.querySelectorAll(".start-item").forEach((item) => {
      const appId = item.dataset.app;
      if (appId && seenAppIds.has(appId)) return;
      const isUninstalled = appRegistry.isAppUninstalled(appId);
      const isDisabled = appRegistry.isAppDisabled(appId);
      const isAvailable = !isUninstalled && !isDisabled;
      const matchesSearch = item.textContent.toLowerCase().includes(q);

      if (matchesSearch && isAvailable) {
        if (appId) seenAppIds.add(appId);
        const category = item.parentElement?.dataset?.page === "system" ? "system" : "games";
        results[category].push({
          element: item.cloneNode(true),
          title: item.textContent.trim()
        });
      }
    });

    const categoryOrder = ["menu", "games", "system"];
    const categoryLabels = {
      menu: "Menu",
      games: "Games",
      system: "System"
    };

    let hasResults = false;
    categoryOrder.forEach((cat) => {
      if (results[cat].length > 0) {
        hasResults = true;
        const categoryHeader = document.createElement("div");
        categoryHeader.className = "search-category-header";
        categoryHeader.textContent = categoryLabels[cat];
        resultsContainer.appendChild(categoryHeader);

        const categoryResults = document.createElement("div");
        categoryResults.className = "search-category-results";

        results[cat].forEach((result) => {
          const clonedItem = result.element;
          clonedItem.style.display = "";
          clonedItem.onclick = () => {
            const appId = clonedItem.dataset.app;
            if (appId) {
              os.app.launch(appId);
            } else {
              clonedItem.dispatchEvent(new Event("click"));
            }
            closeStartMenu();
          };
          categoryResults.appendChild(clonedItem);
        });

        resultsContainer.appendChild(categoryResults);
      }
    });

    if (!hasResults) {
      const noResults = document.createElement("div");
      noResults.className = "search-no-results";
      noResults.textContent = "No results found";
      resultsContainer.appendChild(noResults);
    }
  });

  setupStars();
  setupStartUserHover();

  if (explorerApp && notepadApp) {
    setupDesktopStartMenuActions(explorerApp, notepadApp);
  }

  if (selectionManager) {
    setupDesktopStartMenuToggles(selectionManager);
  }
}

function setupDesktopStartMenuActions(explorerApp, notepadApp) {
  const menuActions = {
    home: () => {
      explorerApp.open([]);
    },
    documents: () => {
      explorerApp.open(["Documents"]);
    },
    pictures: () => {
      explorerApp.open(["Pictures"]);
    },
    notes: () => notepadApp.open()
  };
  const menuEl = getStartMenuEl();
  if (!menuEl) return;
  menuEl.querySelectorAll(".start-item").forEach((item) => {
    item.onclick = (e) => {
      e.stopPropagation();
      const app = item.dataset.path;
      if (menuActions[app]) menuActions[app]();
      closeStartMenu();
    };
  });
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

export function setupStartUserHover() {
  const startUser = document.querySelector(".start-user");
  if (!startUser) return;

  let tooltip = null;

  startUser.addEventListener("mouseenter", () => {
    const currentName = os.storage.get(StorageKeys.username) || "Reeyuki";

    tooltip = document.createElement("div");
    tooltip.className = "user-tooltip";
    tooltip.textContent = currentName;
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
    { app: "explorer", title: "Files", icon: "fas fa-folder" },
    { app: "settingsApp", title: "Settings", icon: "fas fa-cog" },
    { app: "aiAssistant", title: "Yuki AI Assistant", icon: "fas fa-robot" },
    { app: "notepad", title: "Notepad", icon: "fas fa-edit" },
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
    { app: "shittify", title: "Music", icon: "fas fa-music" },
    { app: "appCreatorApp", title: "AppCreator", icon: "fas fa-cubes" },
    { app: "systemApps", title: "System Apps", icon: "fas fa-screwdriver-wrench" },
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
  items.forEach((itemData, index) => {
    if (appRegistry.isAppUninstalled(itemData.app) || appRegistry.isAppDisabled(itemData.app)) return;
    const item = document.createElement("div");
    item.className = "start-menu-item";
    item.dataset.app = itemData.app;
    item.dataset.index = index;

    const iconVal = itemData.icon || "fas fa-star";
    let iconEl;
    const isImage =
      isImageFile(iconVal) ||
      iconVal.startsWith("http") ||
      iconVal.startsWith("data:") ||
      iconVal.startsWith("blob:") ||
      iconVal.startsWith("/");
    if (isImage) {
      iconEl = document.createElement("img");
      let iconSrc = iconVal;
      if (iconVal.startsWith("static/") || iconVal.startsWith("/static/")) {
        const cleanPath = iconVal.startsWith("/") ? iconVal.substring(1) : iconVal;
        iconSrc = `${CDN_CONFIG.repos.main.base}/${cleanPath}`;
      } else {
        iconSrc = resolveIconUrl(iconVal);
      }
      iconEl.src = iconSrc;
      iconEl.className = "start-item-icon";
      if (iconVal.startsWith("data:")) {
        iconEl.style.width = "80px";
        iconEl.style.height = "80px";
      } else {
        iconEl.style.width = "16px";
        iconEl.style.height = "16px";
      }
      iconEl.style.objectFit = "contain";
      iconEl.alt = "";
    } else {
      iconEl = document.createElement("i");
      iconEl.className = iconVal.startsWith("fa") ? iconVal : `fa ${iconVal}`;
    }
    item.appendChild(iconEl);

    const spanEl = document.createElement("span");
    spanEl.textContent = itemData.title;
    item.appendChild(spanEl);

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

    grid.appendChild(item);
  });

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

export function populateStartMenu(appLauncher) {
  const pageMap = {
    system: document.querySelector('.start-page[data-page="system"]'),
    apps: document.querySelector('.start-page[data-page="apps"]'),
    games: document.querySelector('.start-page[data-page="games"]'),
    favorites: document.querySelector('.start-page[data-page="favorites"]')
  };

  ["system", "apps", "games"].forEach((cat) => {
    if (pageMap[cat]) pageMap[cat].innerHTML = "";
  });

  const appRegistry = getAppRegistry();
  Object.entries(appLauncher.appMap).forEach(([appName, appData]) => {
    if (appRegistry.isAppUninstalled(appName) || appRegistry.isAppDisabled(appName)) return;

    const item = document.createElement("div");
    item.classList.add("start-item");
    item.dataset.app = appName;

    const iconValue = appData.icon || tryGetIcon(appName);

    let icon = null;

    const isImagePath = isImageFile(iconValue);
    if (isImagePath) {
      icon = document.createElement("img");
      icon.classList.add("start-item-icon");
      icon.src = resolveIconUrl(iconValue);
      icon.loading = "lazy";
      icon.alt = "";
    } else if (typeof iconValue === "string" && iconValue.trim().length > 0) {
      icon = document.createElement("i");
      icon.classList.add("start-item-icon");
      icon.loading = "lazy";
      icon.className += iconValue.startsWith("fa") ? ` ${iconValue}` : ` fa ${iconValue}`;
    }

    if (icon) {
      item.appendChild(icon);
    }

    const labelEl = document.createElement("span");
    labelEl.textContent = appData.title;

    item.appendChild(labelEl);

    item.addEventListener("click", () => os.app.launch(appName));

    if (appData.type === "system") {
      pageMap.system?.appendChild(item);
    } else {
      pageMap.games?.appendChild(item);
    }
  });
}
