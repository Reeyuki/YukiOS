import { appMap } from "./games.js";
import { camelize } from "./utils.js";

const FAVORITES_KEY = "kdeFavorites";

function getFavorites() {
  return JSON.parse(localStorage.getItem(FAVORITES_KEY)) || [];
}

function saveFavorites(favorites) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
}

function favoriteApp(appName) {
  let favorites = getFavorites();
  if (!favorites.includes(appName)) {
    favorites.push(appName);
    saveFavorites(favorites);
    updateFavoritesUI();
    updateStarState(appName, true);
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

export function updateFavoritesUI(appLauncher) {
  if (!appLauncher) {
    console.error("No app launcher");
    return;
  }
  const favoritesPage = document.querySelector('.start-page[data-page="favorites"]');
  favoritesPage.innerHTML = "";
  const favorites = getFavorites();

  if (favorites.length === 0) {
    const noFav = document.createElement("div");
    noFav.textContent = "No favorite apps";
    noFav.style.padding = "10px";
    noFav.style.color = "#888";
    favoritesPage.appendChild(noFav);
    return;
  }

  favorites.forEach((appName) => {
    const appItem = document.querySelector(`.start-item[data-app="${appName}"]`);
    if (!appItem) return;

    const clone = appItem.cloneNode(true);
    clone.style.position = "relative";
    clone.style.background = "rgba(255, 215, 0, 0.1)";

    clone.onclick = () => appLauncher.launch(appName);

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

export function setupStartMenu() {
  document.querySelectorAll(".start-cat").forEach((cat) => {
    cat.onclick = () => {
      document.querySelectorAll(".start-cat").forEach((c) => c.classList.remove("active"));
      document.querySelectorAll(".start-page").forEach((p) => p.classList.remove("active"));
      cat.classList.add("active");
      document.querySelector(`.start-page[data-page="${cat.dataset.cat}"]`).classList.add("active");
    };
  });

  document.getElementById("start-search").addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll(".start-item").forEach((item) => {
      item.style.display = item.textContent.toLowerCase().includes(q) ? "" : "none";
    });
  });

  setupStars();
}
export function tryGetIcon(id) {
  id = camelize(id);

  if (id === "explorer") {
    return "/static/icons/file.webp";
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
    const imgSrc = div?.querySelector("img")?.src || null;
    return imgSrc;
  } catch (e) {
    console.error("Error occurred while getting icon:", e);
    return null;
  }
}

export function initializeAppGrid() {
  const items = document.querySelectorAll(".app-grid div");
  items.forEach((item) => {
    const dataApp = item.dataset.app;
    if (dataApp) {
      item.addEventListener("click", () => window.appLauncher.launch(dataApp));
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

    const isImagePath = typeof iconValue === "string" && /\.(png|jpg|jpeg|gif|webp|svg|ico)$/i.test(iconValue);

    if (isImagePath) {
      icon = document.createElement("img");
      icon.classList.add("start-item-icon");
      icon.src = iconValue;
      icon.alt = "";
    } else if (typeof iconValue === "string" && iconValue.trim().length > 0) {
      icon = document.createElement("i");
      icon.classList.add("start-item-icon");
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
    } else if (appData.type === "game" || appData.type === "swf") {
      pageMap.games?.appendChild(item);
    } else {
      pageMap.apps?.appendChild(item);
    }
  });
}
