import "../styles/roblox.css";
import { BaseApp, StorageKeys, os } from "../framework.js";
import { $, $$ } from "../framework.js";
import { resolveIconUrl, resolveGhUrl } from "../shared/assetResolver.js";

const CDN = resolveGhUrl("https://cdn.jsdelivr.net/gh/reeyuki/yukios-games@main/html/roblox");
const CDN_ROBLOX = resolveGhUrl("https://cdn.jsdelivr.net/gh/reeyuki/yukios-games@main/roblox");

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

const SUBDIR_GAMES = ["99_nights_in_the_forest", "grow_a_garden"];

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
  { name: "Swing for Brainrots", id: "clswingforbrainrots" },
  { name: "99 Nights in the Forest", id: "99_nights_in_the_forest" },
  { name: "Grow a Garden", id: "grow_a_garden" }
];

const FAKE_RATINGS = [4.2, 3.8, 4.5, 3.5, 4.8, 4.0, 3.2, 4.7, 3.9, 4.3, 3.6, 4.1, 4.4, 3.7, 4.6];

const SETTINGS_KEY = "roblox_settings";

export class RobloxApp extends BaseApp {
  constructor(services) {
    super(services);
    this.searchQuery = "";
    this.currentPage = "home";
  }

  async open() {
    if (await this.isSingletonOpen("roblox-win")) return;

    const username = os.storage.get(StorageKeys.username) || "Guest";
    const avatar = resolveIconUrl(os.storage.get(StorageKeys.profilePicture) || "static/icons/guest.webp");

    const win = os.window.create("roblox-win", "Roblox", "1000px", "650px", {
      icon: resolveIconUrl("static/icons/roblox.webp"),
      appId: "roblox"
    });
    win.innerHTML = `
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
          `;
    this.initRoblox(null, null, win, null);
  }

  initRoblox(payload, vt, element, state) {
    this.element = element;
    this.searchInput = element.querySelector(".roblox-search-input");
    this.continueTrack = element.querySelector("#roblox-continue-track");
    this.recommendedGrid = element.querySelector("#roblox-recommended-grid");
    this.continueScroll = element.querySelector("#roblox-continue-scroll");
    this.continueSection = element.querySelector(".roblox-section");
    this.statsBody = element.querySelector("#roblox-stats-body");
    this.settingsBody = element.querySelector("#roblox-settings-body");
    this.navBtns = element.querySelectorAll(".roblox-nav-btn");
    this.navSettings = element.querySelector("#roblox-nav-settings");
    this.pages = {
      home: element.querySelector("#roblox-page-home"),
      stats: element.querySelector("#roblox-page-stats"),
      settings: element.querySelector("#roblox-page-settings")
    };
    this.games = this.buildGames();
    this.history = this.loadHistory();
    this.playedIds = this.derivePlayedIds();
    this.settings = this.loadSettings();

    this.searchInput.addEventListener("input", () => {
      this.searchQuery = this.searchInput.value.toLowerCase();
      this.renderHome();
    });

    this.navBtns.forEach((btn) => {
      btn.addEventListener("click", () => this.switchPage(btn.dataset.page));
    });
    this.navSettings.addEventListener("click", () => this.switchPage("settings"));

    this.renderHome();
    this.initContinueScroll();
  }

  loadSettings() {
    try {
      return os.storage.get(SETTINGS_KEY) || { showRatings: true, showContinue: true, cardSize: "normal" };
    } catch {
      return { showRatings: true, showContinue: true, cardSize: "normal" };
    }
  }

  saveSettings() {
    os.storage.set(SETTINGS_KEY, this.settings);
  }

  switchPage(page) {
    this.currentPage = page;
    this.navBtns.forEach((btn) => btn.classList.toggle("active", btn.dataset.page === page));
    Object.entries(this.pages).forEach(([key, el]) => {
      el.style.display = key === page ? "" : "none";
    });
    if (page === "stats") this.renderStats();
    if (page === "settings") this.renderSettings();
  }

  buildGames() {
    return GAMES.map((game, i) => ({
      ...game,
      rating: FAKE_RATINGS[i],
      cover: COVER_MAP[game.id] ? resolveIconUrl(COVER_MAP[game.id]) : `${CDN}/covers/${game.id}.svg`,
      url: SUBDIR_GAMES.includes(game.id) ? `${CDN_ROBLOX}/${game.id}/index.html` : `${CDN}/${game.id}.html`
    }));
  }

  loadHistory() {
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

  saveHistory(id) {
    const entry = { id, date: new Date().toISOString().slice(0, 10) };
    this.history.push(entry);
    os.storage.set(StorageKeys.robloxPlayed, this.history.slice(-500));
    this.playedIds = this.derivePlayedIds();
  }

  derivePlayedIds() {
    const seen = new Set();
    return this.history
      .filter((e) => {
        if (seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      })
      .map((e) => e.id);
  }

  renderHome() {
    const filtered = this.searchQuery
      ? this.games.filter((g) => g.name.toLowerCase().includes(this.searchQuery))
      : this.games;

    if (this.settings.showContinue) {
      this.renderContinue(filtered);
    } else {
      this.continueSection.style.display = "none";
    }
    this.renderRecommended(filtered);
  }

  renderContinue(allGames) {
    const continueGames = this.searchQuery
      ? allGames.filter((g) => this.playedIds.includes(g.id))
      : this.playedIds.map((id) => this.games.find((g) => g.id === id)).filter(Boolean);

    if (continueGames.length === 0) {
      this.continueSection.style.display = "none";
      return;
    }
    this.continueSection.style.display = "";

    this.continueTrack.innerHTML = continueGames.map((game) => this.cardHtml(game)).join("");
    this.bindCards(this.continueTrack);
  }

  renderRecommended(allGames) {
    this.recommendedGrid.innerHTML = allGames.map((game) => this.cardHtml(game, this.settings.showRatings)).join("");
    this.bindCards(this.recommendedGrid);
  }

  cardHtml(game, showRating = false) {
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

  bindCards(container) {
    $$(".roblox-game-card", container).forEach((card) => {
      card.addEventListener("click", () => {
        this.launchGame(card.dataset.id, card.dataset.url);
      });
    });
  }

  initContinueScroll() {
    if (!this.continueScroll) return;

    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;

    this.continueScroll.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      isDown = true;
      startX = e.pageX - this.continueScroll.offsetLeft;
      scrollLeft = this.continueScroll.scrollLeft;
    });

    this.continueScroll.addEventListener("mouseleave", () => {
      isDown = false;
    });
    this.continueScroll.addEventListener("mouseup", () => {
      isDown = false;
    });

    this.continueScroll.addEventListener("mousemove", (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - this.continueScroll.offsetLeft;
      const walk = (x - startX) * 1.5;
      this.continueScroll.scrollLeft = scrollLeft - walk;
    });

    this.continueScroll.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.continueScroll.scrollLeft += e.deltaY;
      },
      { passive: false }
    );
  }

  async launchGame(id, url) {
    this.saveHistory(id);
    const game = this.games.find((g) => g.id === id);
    const name = game ? game.name : id;
    if (this.os.app.openIframeApp) {
      await this.os.app.openIframeApp({
        appId: `roblox-${id}`,
        type: "game",
        source: url,
        originalName: name
      });
    }
  }

  renderStats() {
    const counts = {};
    const dates = {};
    for (const { id, date } of this.history) {
      counts[id] = (counts[id] || 0) + 1;
      if (!dates[id]) dates[id] = [];
      if (!dates[id].includes(date)) dates[id].push(date);
    }

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const totalPlays = this.history.length;

    this.statsBody.innerHTML =
      sorted.length === 0
        ? `<div class="roblox-stats-empty">No games played yet. Launch a game to see your stats!</div>`
        : `
        <div class="roblox-stats-summary">${totalPlays} total play${totalPlays === 1 ? "" : "s"} across ${sorted.length} game${sorted.length === 1 ? "" : "s"}</div>
        ${sorted
          .map(([id, count]) => {
            const game = this.games.find((g) => g.id === id);
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

  renderSettings() {
    const s = this.settings;
    this.settingsBody.innerHTML = `
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

    this.settingsBody.querySelectorAll(".roblox-toggle").forEach((cb) => {
      cb.addEventListener("change", () => {
        this.settings[cb.dataset.key] = cb.checked;
        this.saveSettings();
        this.renderHome();
      });
    });

    this.settingsBody.querySelector("#roblox-reset-history").addEventListener("click", async () => {
      const confirmed = await os.dialog.confirm("Reset History", "Are you sure you want to clear all play history?");
      if (confirmed) {
        this.history = [];
        this.playedIds = [];
        os.storage.set(StorageKeys.robloxPlayed, []);
        this.renderHome();
        this.renderStats();
      }
    });
  }

  onClose(winId) {
    this.element = null;
    this.searchInput = null;
    this.continueTrack = null;
    this.recommendedGrid = null;
    this.continueScroll = null;
    this.continueSection = null;
  }
}
