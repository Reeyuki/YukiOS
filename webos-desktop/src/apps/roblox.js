import "../styles/roblox.css";
import { BaseApp, PersistenceTypes, StorageKeys, os } from "../framework.js";
import { $, $$ } from "../shared/domUtils.js";
import { resolveIconUrl } from "../shared/assetResolver.js";

const CDN = "https://cdn.jsdelivr.net/gh/reeyuki/yukios-games@main/html/roblox";

const COVER_MAP = {
  clclimbforbrainrots: "static/icons/roblox/swingbrainrots.webp",
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
  clstealbrainrot: "static/icons/roblox/sab.webp",
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

const SETTINGS_KEY = "roblox_settings";

export class RobloxApp extends BaseApp {
  constructor(services) {
    super(services);
    this._searchQuery = "";
    this._currentPage = "home";
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
                <div class="roblox-nav">
                  <button class="roblox-nav-btn active" data-page="home">Home</button>
                  <button class="roblox-nav-btn" data-page="stats">Stats</button>
                </div>
                <div class="roblox-search" id="roblox-search">
                  <i class="fas fa-search"></i>
                  <input type="text" class="roblox-search-input" placeholder="Search" />
                </div>
                <div class="roblox-profile">
                  <span class="roblox-username">${username}</span>
                  <img class="roblox-avatar" src="${avatar}" alt="" />
                  <span class="roblox-robux"><span class="roblox-robux-icon">R$</span><span class="roblox-robux-amount" id="roblox-robux-amount">${Math.floor(Math.random() * 90000 + 10000)}</span></span>
                  <button class="roblox-nav-settings" id="roblox-nav-settings" title="Settings"><i class="fas fa-cog"></i></button>
                </div>
              </div>
              <div class="roblox-content">
                <div class="roblox-page" id="roblox-page-home">
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
                <div class="roblox-page" id="roblox-page-stats" style="display:none">
                  <div class="roblox-page-header">
                    <h2>Game Stats</h2>
                  </div>
                  <div class="roblox-stats-body" id="roblox-stats-body"></div>
                </div>
                <div class="roblox-page" id="roblox-page-settings" style="display:none">
                  <div class="roblox-page-header">
                    <h2>Settings</h2>
                  </div>
                  <div class="roblox-settings-body" id="roblox-settings-body"></div>
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
    this._statsBody = element.querySelector("#roblox-stats-body");
    this._settingsBody = element.querySelector("#roblox-settings-body");
    this._navBtns = element.querySelectorAll(".roblox-nav-btn");
    this._navSettings = element.querySelector("#roblox-nav-settings");
    this._pages = {
      home: element.querySelector("#roblox-page-home"),
      stats: element.querySelector("#roblox-page-stats"),
      settings: element.querySelector("#roblox-page-settings")
    };
    this._games = this._buildGames();
    this._history = this._loadHistory();
    this._playedIds = this._derivePlayedIds();
    this._settings = this._loadSettings();

    this._searchInput.addEventListener("input", () => {
      this._searchQuery = this._searchInput.value.toLowerCase();
      this._renderHome();
    });

    this._navBtns.forEach((btn) => {
      btn.addEventListener("click", () => this._switchPage(btn.dataset.page));
    });
    this._navSettings.addEventListener("click", () => this._switchPage("settings"));

    this._renderHome();
    this._initContinueScroll();
  }

  _loadSettings() {
    try {
      return os.storage.get(SETTINGS_KEY) || { showRatings: true, showContinue: true, cardSize: "normal" };
    } catch {
      return { showRatings: true, showContinue: true, cardSize: "normal" };
    }
  }

  _saveSettings() {
    os.storage.set(SETTINGS_KEY, this._settings);
  }

  _switchPage(page) {
    this._currentPage = page;
    this._navBtns.forEach((btn) => btn.classList.toggle("active", btn.dataset.page === page));
    Object.entries(this._pages).forEach(([key, el]) => {
      el.style.display = key === page ? "" : "none";
    });
    if (page === "stats") this._renderStats();
    if (page === "settings") this._renderSettings();
  }

  _buildGames() {
    return GAMES.map((game, i) => ({
      ...game,
      rating: FAKE_RATINGS[i],
      cover: COVER_MAP[game.id] ? resolveIconUrl(COVER_MAP[game.id]) : `${CDN}/covers/${game.id}.svg`,
      url: `${CDN}/${game.id}.html`
    }));
  }

  _loadHistory() {
    try {
      let data = os.storage.get(StorageKeys.robloxPlayed);
      if (!data) return [];
      if (typeof data[0] === "string") {
        data = data.map((id) => ({ id, date: new Date().toISOString().slice(0, 10) }));
        os.storage.set(StorageKeys.robloxPlayed, data);
      }
      return data;
    } catch {
      return [];
    }
  }

  _saveHistory(id) {
    const entry = { id, date: new Date().toISOString().slice(0, 10) };
    this._history.push(entry);
    os.storage.set(StorageKeys.robloxPlayed, this._history.slice(-500));
    this._playedIds = this._derivePlayedIds();
  }

  _derivePlayedIds() {
    const seen = new Set();
    return this._history
      .filter((e) => {
        if (seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      })
      .map((e) => e.id);
  }

  _renderHome() {
    const filtered = this._searchQuery
      ? this._games.filter((g) => g.name.toLowerCase().includes(this._searchQuery))
      : this._games;

    if (this._settings.showContinue) {
      this._renderContinue(filtered);
    } else {
      this._continueSection.style.display = "none";
    }
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
    this._recommendedGrid.innerHTML = allGames.map((game) => this._cardHtml(game, this._settings.showRatings)).join("");
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

    this._continueScroll.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this._continueScroll.scrollLeft += e.deltaY;
      },
      { passive: false }
    );
  }

  async _launchGame(id, url) {
    this._saveHistory(id);
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

  _renderStats() {
    const counts = {};
    const dates = {};
    for (const { id, date } of this._history) {
      counts[id] = (counts[id] || 0) + 1;
      if (!dates[id]) dates[id] = [];
      if (!dates[id].includes(date)) dates[id].push(date);
    }

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const totalPlays = this._history.length;

    this._statsBody.innerHTML =
      sorted.length === 0
        ? `<div class="roblox-stats-empty">No games played yet. Launch a game to see your stats!</div>`
        : `
        <div class="roblox-stats-summary">${totalPlays} total play${totalPlays === 1 ? "" : "s"} across ${sorted.length} game${sorted.length === 1 ? "" : "s"}</div>
        ${sorted
          .map(([id, count]) => {
            const game = this._games.find((g) => g.id === id);
            if (!game) return "";
            const gameDates = (dates[id] || []).slice(-5).reverse();
            return `
            <div class="roblox-stats-row">
              <img class="roblox-stats-cover" src="${game.cover}" alt="" loading="lazy" onerror="this.style.display='none'" />
              <div class="roblox-stats-info">
                <span class="roblox-stats-name">${game.name}</span>
                <span class="roblox-stats-count">${count} play${count === 1 ? "" : "s"}</span>
                <span class="roblox-stats-dates">${gameDates.join(" \u00b7 ")}</span>
              </div>
              <span class="roblox-stats-bar-wrap"><span class="roblox-stats-bar" style="width:${(count / Math.max(...Object.values(counts))) * 100}%"></span></span>
            </div>
          `;
          })
          .join("")}
      `;
  }

  _renderSettings() {
    const s = this._settings;
    this._settingsBody.innerHTML = `
      <div class="roblox-settings-group">
        <h3>Display</h3>
        <label class="roblox-settings-row">
          <span>Show ratings on cards</span>
          <input type="checkbox" class="roblox-toggle" data-key="showRatings" ${s.showRatings ? "checked" : ""} />
        </label>
        <label class="roblox-settings-row">
          <span>Show continue section</span>
          <input type="checkbox" class="roblox-toggle" data-key="showContinue" ${s.showContinue ? "checked" : ""} />
        </label>
      </div>
      <div class="roblox-settings-group">
        <h3>Data</h3>
        <div class="roblox-settings-row">
          <span>Reset play history</span>
          <button class="roblox-settings-btn" id="roblox-reset-history">Reset</button>
        </div>
      </div>
    `;

    this._settingsBody.querySelectorAll(".roblox-toggle").forEach((cb) => {
      cb.addEventListener("change", () => {
        this._settings[cb.dataset.key] = cb.checked;
        this._saveSettings();
        this._renderHome();
      });
    });

    this._settingsBody.querySelector("#roblox-reset-history").addEventListener("click", async () => {
      const confirmed = await os.dialog.confirm("Reset History", "Are you sure you want to clear all play history?");
      if (confirmed) {
        this._history = [];
        this._playedIds = [];
        os.storage.set(StorageKeys.robloxPlayed, []);
        this._renderHome();
        this._renderStats();
      }
    });
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
