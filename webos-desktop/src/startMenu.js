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
  btn.style.cursor = "pointer";
  btn.style.position = "absolute";
  btn.style.right = "10px";
  btn.style.top = "50%";
  btn.style.transform = "translateY(-50%)";
  btn.style.fontSize = "16px";
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

function updateFavoritesUI() {
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
    if (appItem) {
      const clone = appItem.cloneNode(true);
      clone.style.position = "relative";
      clone.appendChild(createStarButton(appName));
      clone.style.background = "rgba(255, 215, 0, 0.1)";
      favoritesPage.appendChild(clone);
    }
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

  updateFavoritesUI();
  setupStars();
}
