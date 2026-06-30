import "../styles/roblox.css";
import { BaseApp, PersistenceTypes, StorageKeys, os } from "../framework.js";
import { $, $$ } from "../shared/domUtils.js";
import { resolveIconUrl } from "../shared/assetResolver.js";

const CDN = "https://cdn.jsdelivr.net/gh/reeyuki/yukios-games@main/html/roblox";

const COVER_MAP = {
  cljailbreakobbbobob: "static/icons/roblox/jailbreakobby.webp",
  cllumberobby: "static/icons/roblox/lumbertycoon.webp",
  "clobby-99-will-lose": "static/icons/roblox/99willllose.webp",
  clobbybike: "static/icons/roblox/obbybike.webp",
  clobbycart: "static/icons/roblox/obby-cart.webp",
  clobbyonlyup: "static/icons/roblox/obbyonlyup.webp",
  clobbyrainbowtower: "static/icons/roblox/rainbowtower.webp",
  clobbyswing: "static/icons/roblox/obbyswing.webp",
  clobbyyardsale: "static/icons/roblox/yardsale.webp",
  clsabduel: "static/icons/roblox/sabduel.webp",
  clswingforbrainrots: "static/icons/roblox/swingbrainrots.webp"
};

const GAMES = [
  { name: "Climb for Brainrots", id: "clclimbforbrainrots" },
  { name: "Jailbreak Obby", id: "cljailbreakobbbobob" },
  { name: "Lumber Obby", id: "cllumberobby" },
  { name: "99 Will Lose", id: "clobby-99-will-lose" },
  { name: "Obby Bike", id: "clobbybike" },
  { name: "Obby Cart", id: "clobbycart" },
  { name: "Obby Only Up", id: "clobbyonlyup" },
  { name: "Rainbow Tower", id: "clobbyrainbowtower" },
  { name: "Obby Swing", id: "clobbyswing" },
  { name: "Yard Sale", id: "clobbyyardsale" },
  { name: "Sab Duel", id: "clsabduel" },
  { name: "Steal Brainrot", id: "clstealbrainrot" },
  { name: "Swing for Brainrots", id: "clswingforbrainrots" }
];

const FAKE_RATINGS = [4.2, 3.8, 4.5, 3.5, 4.8, 4.0, 3.2, 4.7, 3.9, 4.3, 3.6, 4.1, 4.4, 3.7, 4.6];

export class RobloxApp extends BaseApp {
  constructor(services) {
    super(services);
    this._searchQuery = "";
  }

  getDeclarativeSchema(opts) {
    const username = os.storage.get(StorageKeys.username) || "Guest";
    const avatar = resolveIconUrl(os.storage.get(StorageKeys.profilePicture) || "static/icons/guest.webp");

    return {
      id: "roblox-win",
      name: "Roblox",
      icon: "static/icons/roblox.webp",
      singleton: true,
      windows: [
        {
          id: "roblox-win",
          title: "Roblox",
          size: ["1000px", "650px"],
          icon: resolveIconUrl("static/icons/roblox.webp"),
          minSize: ["600px", "400px"],
          ui: `
            <div class="roblox-app">
              <div class="roblox-header">
                <img class="roblox-header-icon" src="${resolveIconUrl("static/icons/roblox.webp")}" alt="" />
                <div class="roblox-search">
                  <i class="fas fa-search"></i>
                  <input type="text" class="roblox-search-input" placeholder="Search" />
                </div>
                <div class="roblox-profile">
                  <span class="roblox-username">${username}</span>
                  <img class="roblox-avatar" src="${avatar}" alt="" />
                </div>
              </div>
              <div class="roblox-content">
                <div class="roblox-section">
                  <div class="roblox-section-header">
                    <h2 class="roblox-section-title">Continue</h2>
                  </div>
                  <div class="roblox-horizontal-scroll" id="roblox-continue-scroll">
                    <div class="roblox-scroll-track" id="roblox-continue-track"></div>
                  </div>
                </div>
                <div class="roblox-section">
                  <div class="roblox-section-header">
                    <h2 class="roblox-section-title">Recommended for you</h2>
                  </div>
                  <div class="roblox-games-grid" id="roblox-recommended-grid"></div>
                </div>
              </div>
            </div>
          `
        }
      ],
      state: {
        initial: {},
        persistence: PersistenceTypes.MEMORY
      },
      onMount: "initRoblox"
    };
  }

  initRoblox(payload, vt, element, state) {
    this._element = element;
    this._searchInput = element.querySelector(".roblox-search-input");
    this._continueTrack = element.querySelector("#roblox-continue-track");
    this._recommendedGrid = element.querySelector("#roblox-recommended-grid");
    this._continueScroll = element.querySelector("#roblox-continue-scroll");
    this._continueSection = element.querySelector(".roblox-section");
    this._games = this._buildGames();
    this._playedIds = this._loadPlayed();

    this._searchInput.addEventListener("input", () => {
      this._searchQuery = this._searchInput.value.toLowerCase();
      this._renderAll();
    });

    this._renderAll();
    this._initContinueScroll();
  }

  _buildGames() {
    return GAMES.map((game, i) => ({
      ...game,
      rating: FAKE_RATINGS[i],
      cover: COVER_MAP[game.id] ? resolveIconUrl(COVER_MAP[game.id]) : `${CDN}/covers/${game.id}.svg`,
      url: `${CDN}/${game.id}.html`
    }));
  }

  _loadPlayed() {
    try {
      return os.storage.get(StorageKeys.robloxPlayed) || [];
    } catch {
      return [];
    }
  }

  _savePlayed(id) {
    const list = this._loadPlayed();
    if (!list.includes(id)) {
      list.unshift(id);
      os.storage.set(StorageKeys.robloxPlayed, list.slice(0, 20));
    }
    this._playedIds = list;
  }

  _renderAll() {
    const filtered = this._searchQuery
      ? this._games.filter((g) => g.name.toLowerCase().includes(this._searchQuery))
      : this._games;

    this._renderContinue(filtered);
    this._renderRecommended(filtered);
  }

  _renderContinue(allGames) {
    const continueGames = this._searchQuery
      ? allGames.filter((g) => this._playedIds.includes(g.id))
      : this._playedIds.map((id) => this._games.find((g) => g.id === id)).filter(Boolean);

    if (continueGames.length === 0) {
      this._continueSection.style.display = "none";
      return;
    }
    this._continueSection.style.display = "";

    this._continueTrack.innerHTML = continueGames.map((game) => this._cardHtml(game)).join("");

    this._bindCards(this._continueTrack);
  }

  _renderRecommended(allGames) {
    this._recommendedGrid.innerHTML = allGames.map((game) => this._cardHtml(game, true)).join("");

    this._bindCards(this._recommendedGrid);
  }

  _cardHtml(game, showRating = false) {
    return `
      <div class="roblox-game-card" data-id="${game.id}" data-url="${game.url}">
        <div class="roblox-game-thumb">
          <img class="roblox-game-cover" src="${game.cover}" alt="" loading="lazy" onerror="this.style.display='none'" />
          <div class="roblox-game-overlay">
            <div class="roblox-play-btn">
              <i class="fas fa-play"></i>
            </div>
          </div>
        </div>
        <div class="roblox-game-info">
          <span class="roblox-game-name">${game.name}</span>
          ${
            showRating
              ? `
            <div class="roblox-game-meta">
              <span class="roblox-rating">
                <i class="fas fa-star"></i> ${game.rating}
              </span>
              <span class="roblox-like"><i class="fas fa-thumbs-up"></i></span>
            </div>
          `
              : ""
          }
        </div>
      </div>
    `;
  }

  _bindCards(container) {
    $$(".roblox-game-card", container).forEach((card) => {
      card.addEventListener("click", () => {
        this._launchGame(card.dataset.id, card.dataset.url);
      });
    });
  }

  _initContinueScroll() {
    if (!this._continueScroll) return;

    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;

    this._continueScroll.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      isDown = true;
      startX = e.pageX - this._continueScroll.offsetLeft;
      scrollLeft = this._continueScroll.scrollLeft;
    });

    this._continueScroll.addEventListener("mouseleave", () => {
      isDown = false;
    });
    this._continueScroll.addEventListener("mouseup", () => {
      isDown = false;
    });

    this._continueScroll.addEventListener("mousemove", (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - this._continueScroll.offsetLeft;
      const walk = (x - startX) * 1.5;
      this._continueScroll.scrollLeft = scrollLeft - walk;
    });
  }

  async _launchGame(id, url) {
    this._savePlayed(id);
    const game = this._games.find((g) => g.id === id);
    const name = game ? game.name : id;
    const appLauncher = this._services.appLauncher;
    if (appLauncher && appLauncher.openIframeApp) {
      await appLauncher.openIframeApp({
        appId: `roblox-${id}`,
        type: "game",
        source: url,
        originalName: name
      });
    }
  }

  onClose(winId) {
    this._element = null;
    this._searchInput = null;
    this._continueTrack = null;
    this._recommendedGrid = null;
    this._continueScroll = null;
    this._continueSection = null;
  }
}
