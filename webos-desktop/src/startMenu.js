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
  document.querySelectorAll(`.kde-item[data-app="${appName}"] span`).forEach((star) => {
    if (star.textContent === "★") {
      star.style.color = isFavorite ? "gold" : "#ccc";
    }
  });
  const item = document.querySelector(`.kde-item[data-app="${appName}"]`);
  if (item) {
    item.style.background = isFavorite ? "rgba(255, 215, 0, 0.1)" : "transparent";
  }
}

export function updateFavoritesUI(appLauncher) {
  if (!appLauncher) {
    console.error("No app launcher");
    return;
  }
  const favoritesPage = document.querySelector('.kde-page[data-page="favorites"]');
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
    const appItem = document.querySelector(`.kde-item[data-app="${appName}"]`);
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
  document.querySelectorAll(".kde-page:not([data-page='favorites']) .kde-item").forEach((item) => {
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
  document.querySelectorAll(".kde-cat").forEach((cat) => {
    cat.onclick = () => {
      document.querySelectorAll(".kde-cat").forEach((c) => c.classList.remove("active"));
      document.querySelectorAll(".kde-page").forEach((p) => p.classList.remove("active"));
      cat.classList.add("active");
      document.querySelector(`.kde-page[data-page="${cat.dataset.cat}"]`).classList.add("active");
    };
  });

  document.getElementById("kde-search").addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll(".kde-item").forEach((item) => {
      item.style.display = item.textContent.toLowerCase().includes(q) ? "" : "none";
    });
  });

  setupStars();
}

export function tryGetIcon(id) {
  id = camelize(id);
  if (id === "explorer") return "/static/icons/file.png";
  if (id === "computer") return "/static/icons/pc.webp";
  try {
    const div = document.querySelector(`#desktop div[data-app="${id}"]`);
    return div?.querySelector("img")?.src || null;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export function populateStartMenu(appLauncher) {
  const pageMap = {
    system: document.querySelector('.kde-page[data-page="system"]'),
    apps: document.querySelector('.kde-page[data-page="apps"]'),
    games: document.querySelector('.kde-page[data-page="games"]'),
    favorites: document.querySelector('.kde-page[data-page="favorites"]')
  };

  ["system", "apps", "games"].forEach((cat) => {
    if (pageMap[cat]) pageMap[cat].innerHTML = "";
  });

  Object.entries(appLauncher.appMap).forEach(([appName, appData]) => {
    const item = document.createElement("div");
    item.classList.add("kde-item");
    item.dataset.app = appName;

    const iconSrc = tryGetIcon(appName);

    const icon = document.createElement("img");
    icon.classList.add("kde-item-icon");
    if (iconSrc) {
      icon.src = iconSrc;
      icon.alt = "";
    } else {
      icon.style.display = "none";
    }

    const label = appName.charAt(0).toUpperCase() + appName.slice(1);
    const labelEl = document.createElement("span");
    labelEl.textContent = label;

    item.appendChild(icon);
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
