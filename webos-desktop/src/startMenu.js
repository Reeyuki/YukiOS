import { appMap } from "./gamesList.js";

import { camelize } from "./utils.js";
import { StorageKeys } from "./settings.js";
import { speak } from "./clippy.js";
import { isImageFile } from "./utils.js";
import { resolveIconUrl } from "./shared/assetResolver.js";

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

export function openStartMenu({ focusSearch = false, openDefaultPage = true } = {}) {
  const el = getStartMenuEl();
  if (!el) return;

  el.classList.remove("closing");
  el.style.display = "flex";
  updateFavoritesUI();

  if (openDefaultPage) {
    document.querySelector('.start-cat[data-cat="menu"]')?.click();
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
  return JSON.parse(localStorage.getItem(StorageKeys.favoritesKey)) || [];
}

function saveFavorites(favorites) {
  localStorage.setItem(StorageKeys.favoritesKey, JSON.stringify(favorites));
}

function favoriteApp(appName) {
  let favorites = getFavorites();
  if (!favorites.includes(appName)) {
    favorites.push(appName);
    saveFavorites(favorites);
    updateFavoritesUI();
    updateStarState(appName, true);
    speak("Nice pick, I like that one too!", "Congratulate");
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

    clone.onclick = () => sharedAppLauncher.launch(appName);

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

export function setupStartMenu(appLauncher) {
  sharedAppLauncher = appLauncher;
  document.querySelector(".start-menu")?.addEventListener("contextmenu", (e) => e.preventDefault());

  document.querySelectorAll(".start-cat").forEach((cat) => {
    if (cat.classList.contains("docked") || !cat.dataset.cat) {
      return;
    }

    cat.onclick = () => {
      if (cat.dataset.cat === "settingsApp") {
        appLauncher.launch("settingsApp");
        return;
      }
      if (cat.dataset.cat === "customize") {
        appLauncher.launch("profileCustomizer");
        return;
      }
      document.querySelectorAll(".start-cat").forEach((c) => c.classList.remove("active"));
      document.querySelectorAll(".start-page").forEach((p) => p.classList.remove("active"));
      cat.classList.add("active");

      const page = document.querySelector(`.start-page[data-page="${cat.dataset.cat}"]`);
      if (page) page.classList.add("active");

      if (cat.dataset.cat === "favorites") {
        speak("These are your favorites! Great taste.", "Pleased");
      }
      if (cat.dataset.cat === "customize") {
        speak("Let's make your profile look great!", "Congratulate");
      }
    };
  });

  const searchInput = document.getElementById("start-menu-search");

  searchInput.addEventListener("focus", () => {
    speak("Looking for an app? I know where everything is.", "Searching");
  });

  searchInput.addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll(".start-item").forEach((item) => {
      item.style.display = item.textContent.toLowerCase().includes(q) ? "" : "none";
    });
  });

  setupStars();
  setupStartUserHover();
}

export function setupStartUserHover() {
  const startUser = document.querySelector(".start-user");
  if (!startUser) return;

  let tooltip = null;

  startUser.addEventListener("mouseenter", () => {
    const currentName = localStorage.getItem("yukiOS_username") || "Reeyuki";

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
    return "https://cdn.jsdelivr.net/gh/Reeyuki/yukios@857d9aa378415b8f2ea3c7f4c2c4fd671af35511/static/icons/file.webp";
  }
  if (id === "appCreatorApp") {
    return "fa fa-cubes";
  }
  if (id === "kiwiIRC") {
    return "https://cdn.jsdelivr.net/gh/Reeyuki/yukios@857d9aa378415b8f2ea3c7f4c2c4fd671af35511/static/icons/kiwiirc.webp";
  }
  if (id === "youtube") {
    return "fab fa-youtube";
  }
  try {
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

export function initializeAppGrid(appLauncher) {
  const items = document.querySelectorAll(".app-grid div");
  items.forEach((item) => {
    const dataApp = item.dataset.app;
    if (dataApp) {
      item.addEventListener("click", () => appLauncher.launch(dataApp));
    }
  });
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

  Object.entries(appLauncher.appMap).forEach(([appName, appData]) => {
    const item = document.createElement("div");
    item.classList.add("start-item");
    item.dataset.app = appName;

    const iconValue = tryGetIcon(appName);

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

    item.addEventListener("click", () => appLauncher.launch(appName));

    if (appData.type === "system") {
      pageMap.system?.appendChild(item);
    } else {
      pageMap.games?.appendChild(item);
    }
  });
}
