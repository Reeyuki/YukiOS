import "../styles/themeHub.css";
import {
  BaseApp,
  os,
  StorageKeys,
  BusEvents,
  $,
  $$,
  bindEvent,
  toggleClass,
  setText,
  setHTML,
  createElement,
  setStyle
} from "../framework.js";
import {
  buildThemeContract,
  contractToThemeData,
  themeScoreLabel,
  themeToContract,
  THEME_CONFIG_FONTS,
  THEME_EFFECT_OPTIONS
} from "../shared/themeContract.js";
import { applyThemeEffects, clearThemeEffects, collectCurrentEffects } from "../shared/themeEffects.js";
import {
  listThemes,
  getTheme,
  publishTheme,
  voteTheme,
  trackInstall,
  reportTheme,
  unpublishTheme
} from "../shared/themeHubApi.js";
import {
  getCustomThemes,
  addCustomTheme,
  getThemeByValue,
  getThemeColors,
  getFeaturedThemes
} from "../shared/themeEngine.js";
import { applyTheme, applyThemeConfig } from "../settings/settingsApply.js";
import { buildWindowHeader } from "../shared/windowHeader.js";
import { renderRangeSlider, getRangeSliderValue } from "../shared/rangeSlider.js";

function formatRelativeDate(iso) {
  if (!iso) return "";
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return "";
  const diff = Date.now() - time;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return min + "m ago";
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr + "h ago";
  const day = Math.floor(hr / 24);
  if (day < 30) return day + "d ago";
  return new Date(time).toLocaleDateString();
}

function formatCount(n) {
  const num = Number(n) || 0;
  if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, "") + "m";
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(num);
}

function humanizeEffectValue(v) {
  const spaced = String(v)
    .replace(/([A-Z])/g, " $1")
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

function escapeHtml(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const EDITABLE_COLOR_KEYS = [
  { key: "brand", label: "Brand" },
  { key: "bg-base", label: "Background Base", advanced: true },
  { key: "bg-elev-1", label: "Background Elevated 1", advanced: true },
  { key: "bg-elev-2", label: "Background Elevated 2", advanced: true },
  { key: "bg-primary", label: "Background Primary" },
  { key: "bg-secondary", label: "Background Secondary" },
  { key: "glass", label: "Glass" },
  { key: "glass-border", label: "Glass Border", advanced: true },
  { key: "text-primary", label: "Text Primary" },
  { key: "text-secondary", label: "Text Secondary" },
  { key: "text-muted", label: "Text Muted", advanced: true },
  { key: "window-bg", label: "Window Background", advanced: true }
];

const WINDOW_PREVIEW_FALLBACKS = {
  brand: "#6b5ce7",
  "bg-primary": "#141420",
  "bg-secondary": "#1a1a2e",
  "bg-elev-1": "#1c1c2b",
  "bg-elev-2": "#242438",
  "text-primary": "#ffffff",
  "text-secondary": "#a0a0b0",
  "text-muted": "#77778a",
  glass: "#ffffff",
  "glass-border": "#2c2c44",
  "window-bg": "#191927",
  "text-on-brand": "#ffffff"
};

function channelToHex(part) {
  const n = Math.max(0, Math.min(255, Math.round(Number(part))));
  return n.toString(16).padStart(2, "0");
}

function parseColorToHex(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed;
  if (/^#[0-9a-fA-F]{8}$/.test(trimmed)) return trimmed.slice(0, 7);
  const rgb = trimmed.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (rgb) return "#" + [rgb[1], rgb[2], rgb[3]].map(channelToHex).join("");
  return null;
}

function colorInputValue(value, fallback) {
  return parseColorToHex(value) || fallback;
}

function windowPreviewHTML(colors, title = "Sample Window") {
  const palette = colors || {};
  const vars = Object.entries(WINDOW_PREVIEW_FALLBACKS)
    .map(([key, fallback]) => `--tw-${key}: ${palette[key] || fallback};`)
    .join(" ");
  const pathVars = [
    `--brand: ${palette.brand || "#6b5ce7"}`,
    `--glass-border: ${palette["glass-border"] || "#2c2c44"}`,
    `--tx1: ${palette["text-primary"] || "#ffffff"}`,
    `--text-secondary: ${palette["text-secondary"] || "#a0a0b0"}`,
    `--surface-hover: ${palette["surface-hover"] || "#2a2a40"}`,
    `--error: ${palette.error || "#e5534b"}`,
    `--text-on-brand: ${palette["text-on-brand"] || "#ffffff"}`
  ].join(" ");
  return `
    <div class="theme-hub-winmock" style="${vars} ${pathVars}">
      ${buildWindowHeader(title)}
      <div class="theme-hub-winmock-body">
        <div class="theme-hub-winmock-card">
          <div class="theme-hub-winmock-heading">Sample Heading</div>
          <p class="theme-hub-winmock-text">This is sample text previewing how the window header and content will look with this theme.</p>
        </div>
        <div class="theme-hub-winmock-actions">
          <button class="theme-hub-winmock-primary">Primary Button</button>
          <button class="theme-hub-winmock-secondary">Secondary</button>
        </div>
      </div>
    </div>
  `;
}

export class ThemeHubApp extends BaseApp {
  singletonWindowIds = ["theme-hub"];

  constructor(services) {
    super(services);
    this.openWindows = new Set();
  }

  open(opts = {}) {
    const winId = "theme-hub";

    const windowWidth = Math.min(940, Math.floor(window.innerWidth * 0.94));
    const windowHeight = Math.min(560, Math.floor(window.innerHeight * 0.86));
    const win = os.window.create("theme-hub", "Theme Hub", `${windowWidth}px`, `${windowHeight}px`, {
      icon: "fas fa-share-nodes",
      appId: "themeHubApp"
    });

    win.innerHTML = `
      <div class="theme-hub-root">
        <aside class="theme-hub-sidebar">
          <div class="theme-hub-brand">
            <div class="theme-hub-brand-icon"><i class="fas fa-share-nodes"></i></div>
            <div class="theme-hub-brand-text">
              <div class="theme-hub-brand-title">Theme Hub</div>
              <div class="theme-hub-brand-sub">Custom themes</div>
            </div>
          </div>
          <nav class="theme-hub-nav">
            <div class="theme-hub-nav-label">Explore</div>
            <button class="theme-hub-nav-item active" data-tab="mine"><i class="fas fa-layer-group"></i> My Themes</button>
            <button class="theme-hub-nav-item" data-tab="browse"><i class="fas fa-compass"></i> Browse</button>
            <button class="theme-hub-nav-item theme-hub-nav-create"><i class="fas fa-plus"></i> Create Theme</button>
          </nav>
          <div class="theme-hub-sidebar-footer">
            <button class="theme-hub-create"><i class="fas fa-pen-ruler"></i> Create Theme</button>
          </div>
        </aside>

        <div class="theme-hub-main">
          <div class="theme-hub-mine">
            <div class="theme-hub-topbar">
              <div class="theme-hub-topbar-title">My Themes</div>
              <div class="theme-hub-toolbar">
                <input class="theme-hub-mine-search" placeholder="Search your themes..." />
              </div>
            </div>
            <div class="theme-hub-section-title"><i class="fas fa-pen-nib theme-hub-section-icon"></i> Your themes</div>
            <div class="theme-hub-local-list"></div>
            <div class="theme-hub-empty theme-hub-empty-cta">
              <span>No themes yet. Install one from Browse, or create one.</span>
              <button class="theme-hub-create theme-hub-create-inline"><i class="fas fa-pen-ruler"></i> Create Theme</button>
            </div>
            <div class="theme-hub-section-title"><i class="fas fa-globe theme-hub-section-icon"></i> Published by you</div>
            <div class="theme-hub-published-list"></div>
            <div class="theme-hub-empty theme-hub-mypublished-empty">Nothing published from this device yet.</div>
          </div>

          <div class="theme-hub-browse hidden">
            <div class="theme-hub-browse-scroll">
              <div class="theme-hub-topbar">
                <div class="theme-hub-topbar-title">Browse</div>
                <div class="theme-hub-toolbar">
                  <input class="theme-hub-search" placeholder="Search community themes..." />
                  <div class="theme-hub-select-wrap">
                    <select class="theme-hub-sort">
                      <option value="top" selected>Top Rated</option>
                      <option value="newest">Newest</option>
                      <option value="installs">Most Installed</option>
                    </select>
                  </div>
                  <button class="theme-hub-refresh"><i class="fas fa-rotate-right"></i></button>
                </div>
              </div>

              <div class="theme-hub-featured-section">
                <div class="theme-hub-section-title"><i class="fas fa-crown theme-hub-section-icon"></i> Featured</div>
                <div class="theme-hub-featured-grid"></div>
                <button class="theme-hub-featured-toggle"><i class="fas fa-chevron-down"></i> <span class="theme-hub-featured-toggle-label">Show all featured</span></button>
              </div>

              <div class="theme-hub-section-title theme-hub-community-title"><i class="fas fa-users theme-hub-section-icon"></i> Community</div>
              <div class="theme-hub-grid"></div>
              <div class="theme-hub-empty hidden">Couldn't reach the theme hub. Try again later.</div>
            </div>
            <div class="theme-hub-pagination">
              <span class="theme-hub-page-info"></span>
              <div class="theme-hub-pagination-actions">
                <button class="theme-hub-prev"><i class="fas fa-chevron-left"></i> Prev</button>
                <button class="theme-hub-next">Next <i class="fas fa-chevron-right"></i></button>
                <div class="theme-hub-perpage-wrap">
                  <label class="theme-hub-perpage-label">Per page</label>
                  <div class="theme-hub-select-wrap">
                    <select class="theme-hub-perpage">
                      <option value="12" selected>12</option>
                      <option value="24">24</option>
                      <option value="48">48</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="theme-hub-detail hidden"></div>
          <div class="theme-hub-share hidden"></div>
        </div>
      </div>
    `;

    this.win = win;
    this.state = {
      tab: "mine",
      page: 1,
      perPage: 12,
      sort: "top",
      search: "",
      themes: [],
      total: 0,
      pages: 1,
      loading: false,
      votes: {}
    };
    this.state.votes = os.storage.get(StorageKeys.themeHubVotes) || {};
    this.detailTheme = null;
    this.shareForm = { colors: {}, effects: {} };
    this.searchTimer = null;
    this.mineSearch = "";
    this.featuredThemes = getFeaturedThemes();
    this.featuredExpanded = false;

    this.bindEvents();
    this.loadThemes();
    this.renderLocalThemes();
    this.renderPublished();

    if (opts && opts.intent === "create") this.openCreateForm();
    else if (opts && opts.intent === "browse") this.switchTab("browse");

    win.addEventListener("remove", () => {
      this.openWindows.delete(winId);
    });
  }

  onClose(winId) {
    this.openWindows.delete(winId);
  }

  bindEvents() {
    const win = this.win;
    $$(".theme-hub-nav-item", win).forEach((tab) => {
      if (!tab.dataset.tab) return;
      bindEvent(tab, "click", () => this.switchTab(tab.dataset.tab));
    });
    bindEvent($(".theme-hub-nav-create", win), "click", () => this.openCreateForm());

    const search = $(".theme-hub-search", win);
    bindEvent(search, "input", (e) => {
      clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => {
        this.state.search = e.target.value.trim();
        this.state.page = 1;
        this.loadThemes();
      }, 300);
    });

    bindEvent($(".theme-hub-sort", win), "change", (e) => {
      this.state.sort = e.target.value;
      this.state.page = 1;
      this.loadThemes();
    });

    bindEvent($(".theme-hub-perpage", win), "change", (e) => {
      this.state.perPage = Number(e.target.value);
      this.state.page = 1;
      this.loadThemes();
    });

    bindEvent($(".theme-hub-refresh", win), "click", () => this.loadThemes());

    bindEvent($(".theme-hub-prev", win), "click", () => {
      if (this.state.page > 1) {
        this.state.page--;
        this.loadThemes();
      }
    });

    bindEvent($(".theme-hub-next", win), "click", () => {
      if (this.state.page < this.state.pages) {
        this.state.page++;
        this.loadThemes();
      }
    });

    bindEvent($(".theme-hub-create", win), "click", () => this.openCreateForm());
    bindEvent($(".theme-hub-create-inline", win), "click", () => this.openCreateForm());

    bindEvent($(".theme-hub-featured-toggle", win), "click", () => {
      this.featuredExpanded = !this.featuredExpanded;
      this.renderFeatured();
    });

    const mineSearch = $(".theme-hub-mine-search", win);
    bindEvent(mineSearch, "input", (e) => {
      this.mineSearch = e.target.value.trim().toLowerCase();
      this.renderLocalThemes();
      this.renderPublished();
    });
  }

  switchTab(tab) {
    this.state.tab = tab;
    $$(".theme-hub-nav-item", this.win).forEach((t) => {
      toggleClass(t, "active", t.dataset.tab === tab);
    });
    toggleClass($(".theme-hub-detail", this.win), "hidden", true);
    toggleClass($(".theme-hub-share", this.win), "hidden", true);
    toggleClass($(".theme-hub-browse", this.win), "hidden", tab !== "browse");
    toggleClass($(".theme-hub-mine", this.win), "hidden", tab !== "mine");
    if (tab === "browse") {
      this.renderFeatured();
    } else {
      this.renderLocalThemes();
      this.renderPublished();
    }
  }

  async loadThemes() {
    const grid = $(".theme-hub-browse .theme-hub-grid", this.win);
    const empty = $(".theme-hub-browse .theme-hub-empty", this.win);
    this.state.loading = true;
    const result = await listThemes({
      page: this.state.page,
      perPage: this.state.perPage,
      sort: this.state.sort,
      search: this.state.search
    });
    this.state.loading = false;

    if (!result) {
      this.state.themes = [];
      setText(empty, "Couldn't reach the theme hub. Try again later.");
      toggleClass(empty, "hidden", false);
      setHTML(grid, "");
      this.renderPagination();
      return;
    }

    const themes = Array.isArray(result.themes) ? result.themes : Array.isArray(result.data) ? result.data : [];
    this.state.themes = themes;
    this.state.total = result.total != null ? result.total : themes.length;
    this.state.pages = Math.max(1, Math.ceil(this.state.total / this.state.perPage));

    if (themes.length === 0) {
      setText(empty, "No themes found.");
      toggleClass(empty, "hidden", false);
    } else {
      toggleClass(empty, "hidden", true);
    }
    this.renderGrid();
    this.renderPagination();
  }

  renderGrid() {
    const grid = $(".theme-hub-browse .theme-hub-grid", this.win);
    setHTML(grid, this.state.themes.map((theme) => this.cardHTML(theme)).join(""));
    $$(".theme-hub-card", grid).forEach((el) => {
      const theme = this.state.themes.find((t) => String(t.id) === el.dataset.id);
      if (theme) this.bindCard(el, theme);
    });
  }

  cardHTML(theme) {
    const vote = this.state.votes[theme.id] || 0;
    return `
      <div class="theme-hub-card" data-id="${theme.id}">
        <div class="theme-hub-card-preview">${windowPreviewHTML(theme.colors)}</div>
        <div class="theme-hub-card-body">
          <div class="theme-hub-card-name">${escapeHtml(theme.name || "Untitled")}</div>
          <div class="theme-hub-card-author">by ${escapeHtml(theme.author || "Anonymous")}</div>
          <div class="theme-hub-card-stats">
            <span class="theme-hub-card-score">${themeScoreLabel(theme)}</span>
            <span class="theme-hub-card-installs"><i class="fas fa-download"></i> ${formatCount(theme.installs || 0)}</span>
          </div>
          <div class="theme-hub-card-actions">
            <button class="theme-hub-vote-up ${vote === 1 ? "voted" : ""}"><i class="fas fa-arrow-up"></i></button>
            <button class="theme-hub-vote-down ${vote === -1 ? "voted" : ""}"><i class="fas fa-arrow-down"></i></button>
            <button class="theme-hub-install"><i class="fas fa-download"></i> Install</button>
            <button class="theme-hub-remix"><i class="fas fa-pen"></i> Remix</button>
          </div>
        </div>
      </div>
    `;
  }

  bindCard(el, theme) {
    bindEvent(el, "click", (e) => {
      if (e.target.closest("button")) return;
      this.installTheme(theme);
    });
    bindEvent($(".theme-hub-vote-up", el), "click", (e) => {
      e.stopPropagation();
      this.handleVote(theme.id, 1);
    });
    bindEvent($(".theme-hub-vote-down", el), "click", (e) => {
      e.stopPropagation();
      this.handleVote(theme.id, -1);
    });
    bindEvent($(".theme-hub-install", el), "click", (e) => {
      e.stopPropagation();
      this.installTheme(theme);
    });
    bindEvent($(".theme-hub-remix", el), "click", (e) => {
      e.stopPropagation();
      this.remixTheme(theme);
    });
  }

  renderOneCard(theme) {
    const grid = $(".theme-hub-browse .theme-hub-grid", this.win);
    const existing = $(`.theme-hub-card[data-id="${theme.id}"]`, grid);
    if (!existing) return;
    const holder = createElement("div");
    setHTML(holder, this.cardHTML(theme));
    const node = holder.firstElementChild;
    existing.replaceWith(node);
    this.bindCard(node, theme);
  }

  updateCardVote(themeId) {
    const card = $(`.theme-hub-card[data-id="${themeId}"]`, this.win);
    if (!card) return;
    const vote = this.state.votes[themeId] || 0;
    toggleClass($(".theme-hub-vote-up", card), "voted", vote === 1);
    toggleClass($(".theme-hub-vote-down", card), "voted", vote === -1);
  }

  renderPagination() {
    const total = this.state.total || 0;
    const from = total === 0 ? 0 : (this.state.page - 1) * this.state.perPage + 1;
    const to = Math.min(this.state.page * this.state.perPage, total);
    setText($(".theme-hub-page-info", this.win), from + "\u2013" + to + " of " + total);
    const prev = $(".theme-hub-prev", this.win);
    const next = $(".theme-hub-next", this.win);
    prev.disabled = this.state.page <= 1;
    next.disabled = this.state.page >= this.state.pages;
    toggleClass(prev, "disabled", this.state.page <= 1);
    toggleClass(next, "disabled", this.state.page >= this.state.pages);
  }

  async handleVote(themeId, delta) {
    const current = this.state.votes[themeId] || 0;
    const next = current === delta ? 0 : delta;
    this.state.votes[themeId] = next;
    os.storage.set(StorageKeys.themeHubVotes, this.state.votes);
    this.updateCardVote(themeId);
    if (this.detailTheme && String(this.detailTheme.id) === String(themeId)) {
      this.renderDetailVotes();
    }
    const res = await voteTheme(themeId, next);
    if (res) {
      const updated = res.theme || res;
      if (updated && typeof updated.score !== "undefined") {
        const idx = this.state.themes.findIndex((t) => String(t.id) === String(themeId));
        if (idx >= 0) {
          this.state.themes[idx] = { ...this.state.themes[idx], ...updated };
          this.renderOneCard(this.state.themes[idx]);
        }
        if (this.detailTheme && String(this.detailTheme.id) === String(themeId)) {
          this.detailTheme = { ...this.detailTheme, ...updated };
          this.renderDetailStats();
        }
      }
    } else {
      os.notify.send("Theme Hub", "Couldn't submit your vote.");
    }
  }

  installTheme(theme) {
    const contract = buildThemeContract({
      name: theme.name,
      description: theme.description || "",
      author: theme.author || "",
      icon: theme.icon || "fas fa-palette",
      colors: theme.colors,
      effects: theme.effects || {},
      config: theme.config || {}
    });
    this.installContract(contract);
    trackInstall(theme.id);
  }

  installContract(contract) {
    const data = contractToThemeData(contract);
    try {
      addCustomTheme({
        value: data.value,
        label: data.label,
        icon: data.icon,
        colors: data.colors,
        description: contract.description || "",
        author: contract.author || "",
        effects: contract.effects || {},
        config: contract.config || {}
      });
    } catch (e) {}
    applyTheme(data.value, () => os.storage.get(StorageKeys.customColors));
    if (contract.effects && Object.keys(contract.effects).length > 0) {
      applyThemeEffects(contract.effects);
    } else {
      clearThemeEffects();
    }
    if (contract.config && Object.keys(contract.config).length > 0) {
      applyThemeConfig(contract.config);
    }
    os.storage.set(StorageKeys.theme, data.value);
    os.notify.send("Theme Hub", "Theme installed!");
    os.events.emit(BusEvents.SETTINGS_CHANGED, { key: "theme", value: data.value });
  }

  async openDetail(theme) {
    this.detailTheme = theme;
    const detail = $(".theme-hub-detail", this.win);
    setHTML(
      detail,
      `
      <button class="theme-hub-back"><i class="fas fa-arrow-left"></i> Back</button>
      <div class="theme-hub-detail-preview"></div>
      <div class="theme-hub-detail-name"></div>
      <div class="theme-hub-detail-author"></div>
      <div class="theme-hub-detail-desc hidden"></div>
      <div class="theme-hub-detail-stats">Loading...</div>
      <div class="theme-hub-effects"></div>
      <div class="theme-hub-card-actions">
        <button class="theme-hub-detail-voteup"><i class="fas fa-arrow-up"></i> Upvote</button>
        <button class="theme-hub-detail-votedown"><i class="fas fa-arrow-down"></i> Downvote</button>
        <button class="theme-hub-install"><i class="fas fa-download"></i> Install</button>
        <button class="theme-hub-remix"><i class="fas fa-pen"></i> Remix</button>
        <button class="theme-hub-report"><i class="fas fa-flag"></i> Report</button>
      </div>
    `
    );
    this.renderDetail(theme);
    toggleClass($(".theme-hub-browse", this.win), "hidden", true);
    toggleClass($(".theme-hub-mine", this.win), "hidden", true);
    toggleClass(detail, "hidden", false);

    bindEvent($(".theme-hub-back", detail), "click", () => this.closeDetail());
    bindEvent($(".theme-hub-detail-voteup", detail), "click", () => this.handleVote(theme.id, 1));
    bindEvent($(".theme-hub-detail-votedown", detail), "click", () => this.handleVote(theme.id, -1));
    bindEvent($(".theme-hub-install", detail), "click", () => this.installTheme(theme));
    bindEvent($(".theme-hub-remix", detail), "click", () => this.remixTheme(theme));
    bindEvent($(".theme-hub-report", detail), "click", async () => {
      const reason = await os.dialog.prompt("Report Theme", "Why are you reporting this theme?", "");
      if (typeof reason === "string" && reason.trim()) {
        const ok = await reportTheme(theme.id, reason.trim());
        if (ok) os.notify.send("Theme Hub", "Thanks, report sent for review.");
        else os.notify.send("Theme Hub", "Couldn't send report.");
      }
    });

    const full = await getTheme(theme.id);
    if (full) {
      const data = full.theme || full;
      if (data && typeof data.score !== "undefined") {
        this.detailTheme = { ...this.detailTheme, ...data };
        if (typeof full.myVote === "number") {
          this.state.votes[theme.id] = full.myVote;
        }
        this.renderDetail(this.detailTheme);
      }
    }
  }

  renderDetail(theme) {
    const detail = $(".theme-hub-detail", this.win);
    setHTML($(".theme-hub-detail-preview", detail), windowPreviewHTML(theme.colors));
    setText($(".theme-hub-detail-name", detail), theme.name || "Untitled");
    setText($(".theme-hub-detail-author", detail), "by " + (theme.author || "Anonymous"));
    const desc = $(".theme-hub-detail-desc", detail);
    toggleClass(desc, "hidden", !theme.description);
    setText(desc, theme.description || "");
    const effectsEl = $(".theme-hub-effects", detail);
    setHTML(effectsEl, "");
    this.detailEffectChips(theme).forEach((chipText) => {
      const chip = createElement("span", { className: "theme-hub-effect-chip", text: chipText });
      effectsEl.appendChild(chip);
    });
    this.renderDetailStats();
  }

  detailEffectChips(theme) {
    const effects = theme.effects || {};
    const chips = [];
    if (effects.windowAnimation) chips.push("Open: " + humanizeEffectValue(effects.windowAnimation));
    if (effects.closeAnimation) chips.push("Close: " + humanizeEffectValue(effects.closeAnimation));
    if (effects.minimizeAnimation) chips.push("Minimize: " + humanizeEffectValue(effects.minimizeAnimation));
    if (effects.restoreAnimation) chips.push("Restore: " + humanizeEffectValue(effects.restoreAnimation));
    if (effects.cursorOff) chips.push("Cursor effect off");
    if (effects.background) chips.push("Custom background");
    return chips;
  }

  renderDetailStats() {
    const detail = $(".theme-hub-detail", this.win);
    if (!this.detailTheme) return;
    const theme = this.detailTheme;
    const stats = $(".theme-hub-detail-stats", detail);
    const bits = [
      "Score " + themeScoreLabel(theme),
      `<i class="fas fa-arrow-up"></i> ${theme.upvotes || 0}`,
      `<i class="fas fa-arrow-down"></i> ${theme.downvotes || 0}`,
      `<i class="fas fa-download"></i> ${formatCount(theme.installs || 0)}`
    ];
    if (theme.created_at || theme.created) bits.push(formatRelativeDate(theme.created_at || theme.created));
    setHTML(stats, bits.map((b) => `<span>${b}</span>`).join(""));
    this.renderDetailVotes();
  }

  renderDetailVotes() {
    if (!this.detailTheme) return;
    const detail = $(".theme-hub-detail", this.win);
    const vote = this.state.votes[this.detailTheme.id] || 0;
    toggleClass($(".theme-hub-detail-voteup", detail), "voted", vote === 1);
    toggleClass($(".theme-hub-detail-votedown", detail), "voted", vote === -1);
  }

  closeDetail() {
    toggleClass($(".theme-hub-detail", this.win), "hidden", true);
    if (this.state.tab === "mine") {
      toggleClass($(".theme-hub-mine", this.win), "hidden", false);
    } else {
      toggleClass($(".theme-hub-browse", this.win), "hidden", false);
    }
  }

  hideOverlays() {
    toggleClass($(".theme-hub-share", this.win), "hidden", true);
    toggleClass($(".theme-hub-detail", this.win), "hidden", true);
    $$(".theme-hub-nav-item", this.win).forEach((t) => {
      toggleClass(t, "active", t.dataset.tab === this.state.tab);
    });
    if (this.state.tab === "mine") {
      toggleClass($(".theme-hub-mine", this.win), "hidden", false);
    } else {
      toggleClass($(".theme-hub-browse", this.win), "hidden", false);
    }
  }

  renderLocalThemes() {
    const stored = os.storage.get(StorageKeys.customThemes);
    const all = Array.isArray(stored) ? stored : getCustomThemes();
    const q = this.mineSearch;
    const themes = q ? all.filter((t) => (t.label || "").toLowerCase().includes(q)) : all;
    const list = $(".theme-hub-local-list", this.win);
    const empty = $(".theme-hub-mine .theme-hub-empty", this.win);
    toggleClass(empty, "hidden", themes.length !== 0);
    setHTML(
      list,
      themes
        .map(
          (theme) => `
        <div class="theme-hub-local-item" data-value="${escapeHtml(theme.value)}">
          <span class="theme-hub-local-name">${escapeHtml(theme.label)}</span>
          <div class="theme-hub-local-actions">
            <button class="theme-hub-local-publish">Publish</button>
            <button class="theme-hub-local-remix">Remix</button>
            <button class="theme-hub-local-export">Export</button>
            <button class="theme-hub-local-remove">Remove</button>
          </div>
        </div>
      `
        )
        .join("")
    );
    $$(".theme-hub-local-item", list).forEach((el) => {
      const theme = themes.find((t) => String(t.value) === el.dataset.value);
      if (!theme) return;
      bindEvent($(".theme-hub-local-publish", el), "click", () => this.publishLocalTheme(theme));
      bindEvent($(".theme-hub-local-remix", el), "click", () => this.remixTheme(theme));
      bindEvent($(".theme-hub-local-export", el), "click", () => this.exportLocalTheme(theme));
      bindEvent($(".theme-hub-local-remove", el), "click", () => this.removeLocalTheme(theme));
    });
  }

  exportLocalTheme(theme) {
    const contract = themeToContract(theme, collectCurrentEffects());
    const blob = new Blob([JSON.stringify(contract, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = createElement("a", { attributes: { href: url, download: theme.label + ".yukiotheme" } });
    link.click();
    URL.revokeObjectURL(url);
  }

  async removeLocalTheme(theme) {
    const ok = await os.dialog.confirm("Remove Theme", `Delete "${theme.label}" permanently?`);
    if (!ok) return;
    let themes = os.storage.get(StorageKeys.customThemes);
    if (!Array.isArray(themes)) themes = [];
    const remaining = themes.filter((t) => String(t.value) !== String(theme.value));
    os.storage.set(StorageKeys.customThemes, remaining);
    this.renderLocalThemes();
  }

  shareCurrentSetup() {
    const current = os.storage.get(StorageKeys.theme);
    const themeObj = getThemeByValue(current);
    const colors = getThemeColors(current) || {};
    this.openShareForm({ colors, effects: collectCurrentEffects(), name: themeObj ? themeObj.label : "" });
  }

  neutralPalette() {
    const {
      brand,
      "bg-primary": bgPrimary,
      "bg-secondary": bgSecondary,
      glass,
      "glass-border": glassBorder,
      "text-primary": textPrimary,
      "text-secondary": textSecondary,
      "window-bg": windowBg
    } = WINDOW_PREVIEW_FALLBACKS;
    return {
      brand,
      "bg-primary": bgPrimary,
      "bg-secondary": bgSecondary,
      glass,
      "glass-border": glassBorder,
      "text-primary": textPrimary,
      "text-secondary": textSecondary,
      "window-bg": windowBg
    };
  }

  openCreateForm() {
    this.openShareForm({ colors: this.neutralPalette(), effects: {}, name: "", mode: "create" });
  }

  remixTheme(theme) {
    this.openShareForm({
      colors: theme.colors || {},
      effects: theme.effects || {},
      config: theme.config || {},
      name: theme.name || theme.label || "",
      mode: "create"
    });
  }

  populateSelect(sel, options, current) {
    let html = `<option value="">Default</option>`;
    html += options.map((opt) => `<option value="${opt}">${humanizeEffectValue(opt)}</option>`).join("");
    setHTML(sel, html);
    sel.value = current || "";
  }

  openShareForm({ colors, effects, name, description = "", author = "", config = {}, mode = "create" }) {
    this.shareForm = {
      colors: colors || {},
      effects: effects || {},
      name: name || "",
      description,
      author,
      config,
      mode
    };
    const share = $(".theme-hub-share", this.win);
    const currentTransparency = config.windowTransparency != null ? config.windowTransparency : 90;
    const submitLabel = mode === "publish" ? "Publish" : "Create Theme";
    setHTML(
      share,
      `
      <div class="theme-hub-share-head">
        <button class="theme-hub-share-cancel"><i class="fas fa-arrow-left"></i> Back</button>
        <div class="theme-hub-share-title">${mode === "publish" ? "Publish Theme" : "Create Theme"}</div>
      </div>
      <div class="theme-hub-share-grid">
        <div class="theme-hub-share-preview-wrap">
          <div class="theme-hub-share-preview"></div>
        </div>
        <div class="theme-hub-share-form">
          <input class="theme-hub-share-name" placeholder="Theme name" value="${escapeHtml(name || "")}" />
          <textarea class="theme-hub-share-desc" placeholder="Short description (optional)">${escapeHtml(description)}</textarea>
          <input class="theme-hub-share-author" placeholder="Author name (optional)" value="${escapeHtml(author)}" />
          <div class="theme-hub-field-label">Colors</div>
          <div class="theme-hub-color-grid"></div>
          <button class="theme-hub-advanced-toggle" type="button"><i class="fas fa-chevron-down theme-hub-advanced-chevron"></i> <span>Advanced</span></button>
          <div class="theme-hub-advanced hidden">
            <div class="theme-hub-field-label">More Colors</div>
            <div class="theme-hub-color-grid"></div>
            <div class="theme-hub-share-effects">
              <div class="theme-hub-field">
                <label class="theme-hub-field-label">Open animation</label>
                <div class="theme-hub-select-wrap"><select class="theme-hub-share-open"></select></div>
              </div>
              <div class="theme-hub-field">
                <label class="theme-hub-field-label">Close animation</label>
                <div class="theme-hub-select-wrap"><select class="theme-hub-share-close"></select></div>
              </div>
              <div class="theme-hub-field">
                <label class="theme-hub-field-label">Minimize animation</label>
                <div class="theme-hub-select-wrap"><select class="theme-hub-share-minimize"></select></div>
              </div>
              <div class="theme-hub-field">
                <label class="theme-hub-field-label">Restore animation</label>
                <div class="theme-hub-select-wrap"><select class="theme-hub-share-restore"></select></div>
              </div>
            </div>
            <label class="theme-hub-share-cursor-label">
              <input type="checkbox" class="theme-hub-share-cursor" />
              <span>Disable cursor effect</span>
            </label>
            <input class="theme-hub-share-bg" placeholder="Background (e.g. #123 or a gradient, optional)" />
            <div class="theme-hub-field-label">OS Config</div>
            <div class="theme-hub-field">
              <label class="theme-hub-field-label">Font</label>
              <div class="theme-hub-select-wrap"><select class="theme-hub-share-font"></select></div>
            </div>
            <div class="theme-hub-field">
              <label class="theme-hub-field-label">UI density</label>
              <div class="theme-hub-density-row">
                <button type="button" class="theme-hub-share-density" data-density="compact">Compact</button>
                <button type="button" class="theme-hub-share-density" data-density="comfortable">Comfortable</button>
                <button type="button" class="theme-hub-share-density" data-density="spacious">Spacious</button>
              </div>
            </div>
            <div class="theme-hub-field">
              <label class="theme-hub-field-label">Window transparency</label>
              <div class="theme-hub-transparency-wrap">${renderRangeSlider("themeHubShareTransparency", 20, 100, 1, currentTransparency)}</div>
              <span class="theme-hub-share-transparency-value"></span>
            </div>
          </div>
          <div class="theme-hub-share-actions">
            <button class="theme-hub-publish"><i class="fas fa-check"></i> ${submitLabel}</button>
          </div>
          <div class="theme-hub-share-hint">Saved to My Themes. Publish it to the hub from there.</div>
        </div>
      </div>
    `
    );

    const effectsData = this.shareForm.effects;
    const colorGrid = $(".theme-hub-color-grid", share);
    setHTML(
      colorGrid,
      EDITABLE_COLOR_KEYS.filter((k) => !k.advanced)
        .map(
          ({ key, label }) => `
        <div class="theme-hub-color-item">
          <input type="color" class="theme-hub-color-input" data-color-key="${key}" value="${colorInputValue(this.shareForm.colors[key], WINDOW_PREVIEW_FALLBACKS[key])}" title="${label}" />
          <span class="theme-hub-color-label">${label}</span>
        </div>
      `
        )
        .join("")
    );
    const advancedColorGrid = $(".theme-hub-advanced .theme-hub-color-grid", share);
    setHTML(
      advancedColorGrid,
      EDITABLE_COLOR_KEYS.filter((k) => k.advanced)
        .map(
          ({ key, label }) => `
        <div class="theme-hub-color-item">
          <input type="color" class="theme-hub-color-input" data-color-key="${key}" value="${colorInputValue(this.shareForm.colors[key], WINDOW_PREVIEW_FALLBACKS[key])}" title="${label}" />
          <span class="theme-hub-color-label">${label}</span>
        </div>
      `
        )
        .join("")
    );
    this.populateSelect($(".theme-hub-share-open", share), THEME_EFFECT_OPTIONS.open, effectsData.windowAnimation);
    this.populateSelect($(".theme-hub-share-close", share), THEME_EFFECT_OPTIONS.close, effectsData.closeAnimation);
    this.populateSelect(
      $(".theme-hub-share-minimize", share),
      THEME_EFFECT_OPTIONS.minimize,
      effectsData.minimizeAnimation
    );
    this.populateSelect(
      $(".theme-hub-share-restore", share),
      THEME_EFFECT_OPTIONS.restore,
      effectsData.restoreAnimation
    );
    const cursor = $(".theme-hub-share-cursor", share);
    cursor.checked = !!effectsData.cursorOff;
    const bgInput = $(".theme-hub-share-bg", share);
    bgInput.value = effectsData.background || "";
    this.populateSelect($(".theme-hub-share-font", share), THEME_CONFIG_FONTS, config.fontFamily);
    const density = config.density || "comfortable";
    $$(".theme-hub-share-density", share).forEach((btn) => {
      toggleClass(btn, "active", btn.dataset.density === density);
    });
    const transparencyValue = $(".theme-hub-share-transparency-value", share);
    setText(transparencyValue, currentTransparency + "%");

    this.refreshSharePreview();

    bindEvent($(".theme-hub-share-cancel", share), "click", () => this.hideOverlays());
    bindEvent($(".theme-hub-publish", share), "click", () => {
      if (mode === "publish") this.publishFromForm();
      else this.createShare();
    });
    $$(".theme-hub-color-input", share).forEach((input) => {
      bindEvent(input, "input", () => {
        this.shareForm.colors[input.dataset.colorKey] = input.value;
        this.refreshSharePreview();
      });
    });
    bindEvent($(".theme-hub-share-name", share), "input", (e) => {
      this.shareForm.name = e.target.value;
      this.refreshSharePreview();
    });
    bindEvent(bgInput, "input", (e) => {
      this.shareForm.effects.background = e.target.value.trim() || null;
      this.refreshSharePreview();
    });
    bindEvent($(".theme-hub-share-open", share), "change", (e) => {
      if (e.target.value) this.shareForm.effects.windowAnimation = e.target.value;
      else delete this.shareForm.effects.windowAnimation;
    });
    bindEvent($(".theme-hub-share-close", share), "change", (e) => {
      if (e.target.value) this.shareForm.effects.closeAnimation = e.target.value;
      else delete this.shareForm.effects.closeAnimation;
    });
    bindEvent($(".theme-hub-share-minimize", share), "change", (e) => {
      if (e.target.value) this.shareForm.effects.minimizeAnimation = e.target.value;
      else delete this.shareForm.effects.minimizeAnimation;
    });
    bindEvent($(".theme-hub-share-restore", share), "change", (e) => {
      if (e.target.value) this.shareForm.effects.restoreAnimation = e.target.value;
      else delete this.shareForm.effects.restoreAnimation;
    });
    bindEvent(cursor, "change", (e) => {
      if (e.target.checked) this.shareForm.effects.cursorOff = true;
      else delete this.shareForm.effects.cursorOff;
    });
    bindEvent($(".theme-hub-share-font", share), "change", (e) => {
      if (e.target.value) this.shareForm.config.fontFamily = e.target.value;
      else delete this.shareForm.config.fontFamily;
    });
    $$(".theme-hub-share-density", share).forEach((btn) => {
      bindEvent(btn, "click", () => {
        this.shareForm.config.density = btn.dataset.density;
        $$(".theme-hub-share-density", share).forEach((b) => toggleClass(b, "active", b === btn));
      });
    });
    bindEvent($("#themeHubShareTransparency", share), "change", () => {
      const value = Number(getRangeSliderValue("themeHubShareTransparency", this.win));
      this.shareForm.config.windowTransparency = value;
      setText($(".theme-hub-share-transparency-value", share), value + "%");
    });
    bindEvent($(".theme-hub-advanced-toggle", share), "click", () => {
      const panel = $(".theme-hub-advanced", share);
      const open = panel.classList.contains("hidden");
      toggleClass(panel, "hidden", !open);
      toggleClass($(".theme-hub-advanced-chevron", share), "open", open);
    });

    toggleClass($(".theme-hub-detail", this.win), "hidden", true);
    toggleClass($(".theme-hub-browse", this.win), "hidden", true);
    toggleClass($(".theme-hub-mine", this.win), "hidden", true);
    toggleClass(share, "hidden", false);
  }

  refreshSharePreview() {
    const preview = $(".theme-hub-share-preview", this.win);
    if (!preview) return;
    setHTML(preview, windowPreviewHTML(this.shareForm.colors, this.shareForm.name || "Sample Window"));
    setStyle(preview, {
      background:
        this.shareForm.effects && this.shareForm.effects.background
          ? this.shareForm.effects.background
          : "var(--bg-primary)"
    });
  }

  async createShare() {
    const share = $(".theme-hub-share", this.win);
    const name = $(".theme-hub-share-name", share).value.trim();
    if (!name) {
      os.dialog.alert("Theme Hub", "Give your theme a name first.");
      return;
    }
    const colors = this.shareForm.colors || {};
    if (Object.keys(colors).length < 1) {
      os.dialog.alert("Theme Hub", "Add some colors first (use a theme or current setup).");
      return;
    }
    const description = $(".theme-hub-share-desc", share).value.trim();
    const author = $(".theme-hub-share-author", share).value.trim();
    const effects = {};
    const openVal = $(".theme-hub-share-open", share).value;
    const closeVal = $(".theme-hub-share-close", share).value;
    const minimizeVal = $(".theme-hub-share-minimize", share).value;
    const restoreVal = $(".theme-hub-share-restore", share).value;
    if (openVal) effects.windowAnimation = openVal;
    if (closeVal) effects.closeAnimation = closeVal;
    if (minimizeVal) effects.minimizeAnimation = minimizeVal;
    if (restoreVal) effects.restoreAnimation = restoreVal;
    if ($(".theme-hub-share-cursor", share).checked) effects.cursorOff = true;
    const bg = $(".theme-hub-share-bg", share).value.trim();
    if (bg) effects.background = bg;
    const config = this.shareForm.config || {};

    let contract;
    try {
      contract = buildThemeContract({
        name,
        description,
        author,
        icon: "fas fa-palette",
        colors,
        effects,
        config
      });
    } catch (e) {
      os.dialog.alert("Theme Hub", String(e.message || e));
      return;
    }
    const data = contractToThemeData(contract);
    try {
      addCustomTheme({
        value: data.value,
        label: data.label,
        icon: data.icon,
        colors: data.colors,
        description,
        author,
        effects,
        config
      });
    } catch (e) {}
    this.renderLocalThemes();

    setHTML(
      share,
      `
      <div class="theme-hub-published">
        <div class="theme-hub-share-title">Theme created!</div>
        <div class="theme-hub-published-note">Saved to My Themes. Publish it now or later.</div>
        <button class="theme-hub-publish theme-hub-done"><i class="fas fa-check"></i> Done</button>
        <button class="theme-hub-publish theme-hub-tohub"><i class="fas fa-upload"></i> Publish to Hub</button>
      </div>
    `
    );
    bindEvent($(".theme-hub-done", share), "click", () => this.hideOverlays());
    bindEvent($(".theme-hub-tohub", share), "click", () =>
      this.openPublishForm({
        value: data.value,
        label: name,
        icon: "fas fa-palette",
        colors,
        description,
        author,
        effects,
        config
      })
    );
  }

  publishLocalTheme(theme) {
    this.openPublishForm(theme);
  }

  openPublishForm(theme) {
    this.openShareForm({
      colors: theme.colors || {},
      effects: theme.effects || {},
      name: theme.label || theme.name || "",
      description: theme.description || "",
      author: theme.author || "",
      config: theme.config || {},
      mode: "publish"
    });
  }

  async publishFromForm() {
    const shareForm = this.shareForm;
    let contract;
    try {
      contract = buildThemeContract({
        name: shareForm.name,
        description: shareForm.description || "",
        author: shareForm.author || "",
        icon: "fas fa-palette",
        colors: shareForm.colors || {},
        effects: shareForm.effects || {},
        config: shareForm.config || {}
      });
    } catch (e) {
      os.dialog.alert("Theme Hub", String(e.message || e));
      return;
    }
    const data = contractToThemeData(contract);
    try {
      addCustomTheme({
        value: data.value,
        label: data.label,
        icon: data.icon,
        colors: data.colors,
        description: shareForm.description || "",
        author: shareForm.author || "",
        effects: shareForm.effects || {},
        config: shareForm.config || {}
      });
      this.renderLocalThemes();
    } catch (e) {}
    const res = await publishTheme(contract);
    if (!res) {
      os.dialog.alert("Theme Hub", "Couldn't publish. Check your connection.");
      return;
    }
    os.notify.send("Theme Hub", "Theme published to the hub!");
    this.trackPublished(res, contract);
    this.refreshBrowseAfterPublish(res);
    this.hideOverlays();
  }

  refreshBrowseAfterPublish(res) {
    const published = res && res.id ? res : res && res.theme;
    if (published && String(published.id).startsWith("theme_")) {
      this.state.page = 1;
      const exists = this.state.themes.some((t) => String(t.id) === String(published.id));
      if (!exists) {
        this.state.themes.unshift(published);
        this.state.total += 1;
        this.state.pages = Math.max(1, Math.ceil(this.state.total / this.state.perPage));
      }
      this.renderGrid();
      this.renderPagination();
    }
    this.loadThemes();
  }

  trackPublished(res, contract) {
    const id = res && (res.id || (res.theme && res.theme.id));
    if (!id) return;
    let prefs = os.storage.get(StorageKeys.themeHubPreferences);
    if (!prefs || typeof prefs !== "object" || Array.isArray(prefs)) prefs = {};
    prefs.published = Array.isArray(prefs.published) ? prefs.published : [];
    prefs.published.push({ id: String(id), name: contract.name });
    os.storage.set(StorageKeys.themeHubPreferences, prefs);
    this.renderPublished();
  }

  renderPublished() {
    const prefs = os.storage.get(StorageKeys.themeHubPreferences);
    const allItems = prefs && Array.isArray(prefs.published) ? prefs.published : [];
    const q = this.mineSearch;
    const items = q ? allItems.filter((item) => (item.name || "").toLowerCase().includes(q)) : allItems;
    const list = $(".theme-hub-published-list", this.win);
    const empty = $(".theme-hub-mypublished-empty", this.win);
    if (!list) return;
    toggleClass(empty, "hidden", items.length !== 0);
    setHTML(list, "");
    items.forEach((item) => {
      const row = createElement("div", { className: "theme-hub-local-item" });
      const nameEl = createElement("span", { className: "theme-hub-local-name", text: item.name });
      const action = createElement("button", { className: "theme-hub-local-export", text: "Unpublish" });
      row.appendChild(nameEl);
      row.appendChild(action);
      list.appendChild(row);
      bindEvent(action, "click", () => this.unpublishItem(item));
    });
  }

  renderFeatured() {
    const grid = $(".theme-hub-featured-grid", this.win);
    if (!grid) return;
    const shown = this.featuredExpanded ? this.featuredThemes : this.featuredThemes.slice(0, 6);
    setHTML(grid, shown.map((theme) => this.featuredCardHTML(theme)).join(""));
    $$(".theme-hub-featured-card", grid).forEach((el) => {
      const theme = this.featuredThemes.find((t) => String(t.value) === el.dataset.value);
      if (theme) this.bindFeaturedCard(el, theme);
    });
    const toggle = $(".theme-hub-featured-toggle", this.win);
    if (toggle) {
      setText(
        $(".theme-hub-featured-toggle-label", toggle),
        this.featuredExpanded ? "Show less" : `Show all featured (${this.featuredThemes.length})`
      );
      const icon = $(".theme-hub-featured-toggle i", toggle);
      if (icon) icon.className = this.featuredExpanded ? "fas fa-chevron-up" : "fas fa-chevron-down";
    }
  }

  featuredCardHTML(theme) {
    return `
      <div class="theme-hub-card theme-hub-featured-card" data-value="${theme.value}">
        <div class="theme-hub-card-preview">
          <div class="theme-hub-featured-swatch" style="background: ${theme.preview || "#2a2a3a"}"></div>
        </div>
        <div class="theme-hub-card-body">
          <div class="theme-hub-card-name">${escapeHtml(theme.label)}</div>
          <div class="theme-hub-card-author">by YukiOS</div>
        </div>
      </div>
    `;
  }

  bindFeaturedCard(el, theme) {
    bindEvent(el, "click", () => this.installFeatured(theme));
  }

  installFeatured(theme) {
    os.storage.set(StorageKeys.theme, theme.value);
    applyTheme(theme.value, () => os.storage.get(StorageKeys.customColors));
    clearThemeEffects();
    os.notify.send("Theme Hub", theme.label + " installed!");
    os.events.emit(BusEvents.SETTINGS_CHANGED, { key: "theme", value: theme.value });
  }

  async unpublishItem(item) {
    const ok = await os.dialog.confirm("Unpublish Theme", `Remove "${item.name}" from the hub?`);
    if (!ok) return;
    const res = await unpublishTheme(item.id);
    if (!res) {
      os.notify.send("Theme Hub", "Couldn't unpublish right now.");
      return;
    }
    const prefs = os.storage.get(StorageKeys.themeHubPreferences);
    if (prefs && Array.isArray(prefs.published)) {
      prefs.published = prefs.published.filter((p) => String(p.id) !== String(item.id));
      os.storage.set(StorageKeys.themeHubPreferences, prefs);
    }
    os.notify.send("Theme Hub", "Theme unpublished.");
    this.renderPublished();
  }
}
