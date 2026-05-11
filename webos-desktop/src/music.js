import { desktop } from "./desktop.js";

function safeJsonParse(value, fallback) {
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function isProbablySpotifyId(input) {
  const s = String(input || "").trim();
  return /^[a-zA-Z0-9]{16,40}$/.test(s);
}

function parseSpotifyInput(input) {
  const raw = String(input || "").trim();
  if (!raw) return { kind: null, id: null, rawUrl: null };

  if (raw.startsWith("spotify:")) {
    const parts = raw.split(":").filter(Boolean);
    if (parts.length >= 3) {
      const kind = parts[1];
      const id = parts[2];
      if (kind && id) return { kind, id, rawUrl: raw };
    }
  }

  if (!raw.includes("://") && isProbablySpotifyId(raw)) {
    return { kind: "track", id: raw, rawUrl: null };
  }

  let url;
  try {
    url = new URL(raw);
  } catch {
    return { kind: null, id: null, rawUrl: null };
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host !== "open.spotify.com") return { kind: null, id: null, rawUrl: url.href };

  const parts = (url.pathname || "/").split("/").filter(Boolean);

  if (parts[0] === "embed" && parts.length >= 3) {
    return { kind: parts[1], id: parts[2], rawUrl: url.href };
  }

  if (parts.length >= 2) {
    return { kind: parts[0], id: parts[1], rawUrl: url.href };
  }

  return { kind: null, id: null, rawUrl: url.href };
}

function buildSpotifyEmbedUrl({ kind, id, theme, view }) {
  if (!kind || !id) return null;
  const allowed = new Set(["track", "playlist", "album", "artist", "episode", "show"]);
  if (!allowed.has(kind)) return null;

  const u = new URL(`https://open.spotify.com/embed/${kind}/${id}`);
  u.searchParams.set("utm_source", "yukios");
  if (theme === "light") u.searchParams.set("theme", "0");
  else u.searchParams.set("theme", "1");
  if (view === "compact") u.searchParams.set("view", "coverart");
  return u.href;
}

function buildSpotifyOpenUrl({ kind, id }) {
  if (!kind || !id) return null;
  return `https://open.spotify.com/${kind}/${id}`;
}

function buildSpotifyUri({ kind, id }) {
  if (!kind || !id) return null;
  return `spotify:${kind}:${id}`;
}

async function fetchSpotifyOembed(openUrl) {
  try {
    const u = new URL("https://open.spotify.com/oembed");
    u.searchParams.set("url", openUrl);
    const res = await fetch(u.href);
    if (!res.ok) throw new Error("oembed");
    return await res.json();
  } catch {
    return null;
  }
}

export class MusicPlayerApp {
  constructor() {
    this.wm = null;
    this.browserApp = null;
    this.winId = "music-win";
    this._els = null;
    this._prefs = this._loadPrefs();
    this._recent = this._loadRecent();
    this._favorites = this._loadFavorites();
  }

  setBrowserApp(browserApp) {
    this.browserApp = browserApp || null;
  }

  _loadPrefs() {
    const prefs = safeJsonParse(localStorage.getItem("spotify_utils_prefs"), {});
    return {
      theme: prefs.theme === "light" ? "light" : "dark",
      view: prefs.view === "compact" ? "compact" : "default",
      size: prefs.size === "large" ? "large" : prefs.size === "small" ? "small" : "medium",
      openInBrowserApp: prefs.openInBrowserApp === true
    };
  }

  _savePrefs() {
    localStorage.setItem("spotify_utils_prefs", JSON.stringify(this._prefs));
  }

  _loadRecent() {
    const items = safeJsonParse(localStorage.getItem("spotify_utils_recent"), []);
    return Array.isArray(items) ? items.slice(-30) : [];
  }

  _saveRecent() {
    localStorage.setItem("spotify_utils_recent", JSON.stringify(this._recent.slice(-30)));
  }

  _loadFavorites() {
    const items = safeJsonParse(localStorage.getItem("spotify_utils_favorites"), []);
    return Array.isArray(items) ? items.slice(-100) : [];
  }

  _saveFavorites() {
    localStorage.setItem("spotify_utils_favorites", JSON.stringify(this._favorites.slice(-100)));
  }

  _pushRecent(item) {
    const key = `${item.kind}:${item.id}`;
    this._recent = this._recent.filter((x) => x.key !== key);
    this._recent.push({ ...item, key, time: Date.now() });
    this._saveRecent();
    this._renderLists();
  }

  open(windowManager) {
    this.wm = windowManager;
    if (document.getElementById("music-win")) {
      windowManager.bringToFront(document.getElementById("music-win"));
      return;
    }

    const win = windowManager.createWindow("music-win", "Spotify", "980px", "640px");
    win.innerHTML = `
      <div class="window-header">
        <span>Spotify</span>
        ${windowManager.getWindowControls()}
      </div>
      <div class="window-content sp-utils">
        <div class="toolbar">
          <div class="row">
            <input id="sp-input" type="text" spellcheck="false" autocomplete="off"
              placeholder="Paste an open.spotify.com link, spotify: URI, or an id (defaults to track)"/>
            <button id="sp-load">Load</button>
            <button id="sp-paste" title="Paste from clipboard">Paste</button>
            <button id="sp-clear" title="Clear embed">Clear</button>
          </div>
          <div class="row meta" style="justify-content:space-between;margin-top:10px">
            <div class="row">
              <label class="toggle" title="Content type override">
                <span>Type</span>
                <select id="sp-kind">
                  <option value="auto" selected>Auto</option>
                  <option value="track">Track</option>
                  <option value="playlist">Playlist</option>
                  <option value="album">Album</option>
                  <option value="artist">Artist</option>
                  <option value="episode">Episode</option>
                  <option value="show">Show</option>
                </select>
              </label>
              <label class="toggle" title="Embed theme">
                <span>Theme</span>
                <select id="sp-theme">
                  <option value="dark"${this._prefs.theme === "dark" ? " selected" : ""}>Dark</option>
                  <option value="light"${this._prefs.theme === "light" ? " selected" : ""}>Light</option>
                </select>
              </label>
              <label class="toggle" title="Compact view is smaller (when supported)">
                <span>View</span>
                <select id="sp-view">
                  <option value="default"${this._prefs.view === "default" ? " selected" : ""}>Default</option>
                  <option value="compact"${this._prefs.view === "compact" ? " selected" : ""}>Compact</option>
                </select>
              </label>
              <label class="toggle" title="Embed size">
                <span>Size</span>
                <select id="sp-size">
                  <option value="small"${this._prefs.size === "small" ? " selected" : ""}>Small</option>
                  <option value="medium"${this._prefs.size === "medium" ? " selected" : ""}>Medium</option>
                  <option value="large"${this._prefs.size === "large" ? " selected" : ""}>Large</option>
                </select>
              </label>
              <label class="toggle" title="Open links inside Yuki Browser instead of a new tab">
                <input id="sp-open-in-browser" type="checkbox" ${this._prefs.openInBrowserApp ? "checked" : ""}/>
                <span>Internal Browser</span>
              </label>
            </div>
            <div class="row">
              <span id="sp-status" class="meta"></span>
            </div>
          </div>

          <div class="row" style="margin-top:10px">
            <div class="sp-preview" id="sp-preview" style="display:none">
              <img id="sp-preview-img" alt="" />
              <div class="sp-preview-txt">
                <div class="sp-preview-title" id="sp-preview-title"></div>
                <div class="sp-preview-sub meta" id="sp-preview-sub"></div>
              </div>
            </div>
          </div>
        </div>

        <div class="split">
          <div class="panel embed">
            <div class="panel-h">
              <span>Embed</span>
              <div class="row">
                <button class="mini" id="sp-pin" title="Pin/unpin current item">Pin</button>
                <button class="mini" id="sp-copy-embed" title="Copy embed URL">Copy Embed URL</button>
                <button class="mini" id="sp-open" title="Open on open.spotify.com">Open in Spotify</button>
                <button class="mini" id="sp-open-uri" title="Try to open in desktop app">Open App</button>
              </div>
            </div>
            <div class="panel-b" style="padding:0">
              <iframe id="sp-iframe" title="Spotify embed" allow="encrypted-media; fullscreen; clipboard-write"></iframe>
            </div>
          </div>
          <div class="panel">
            <div class="panel-h">
              <div class="row" style="gap:8px">
                <button class="mini sp-tab-btn" id="sp-tab-recent" data-tab="recent">Recent</button>
                <button class="mini sp-tab-btn" id="sp-tab-fav" data-tab="fav">Pinned</button>
              </div>
              <div class="row">
                <button class="mini" id="sp-export" title="Copy export JSON to clipboard">Export</button>
                <button class="mini" id="sp-import" title="Import JSON from clipboard/paste">Import</button>
                <button class="mini" id="sp-clear-list">Clear</button>
              </div>
            </div>
            <div class="panel-b" id="sp-list"></div>
          </div>
        </div>

        <div class="meta">
          Tips: Supports <code>track</code>, <code>playlist</code>, <code>album</code>, <code>artist</code>, <code>episode</code>, <code>show</code>. Some embeds may require third-party cookies depending on your browser settings.
        </div>
      </div>
    `;
    desktop.appendChild(win);
    windowManager.makeDraggable(win);
    windowManager.makeResizable(win);
    windowManager.setupWindowControls(win);
    windowManager.addToTaskbar(win.id, "Spotify", "static/icons/music.webp");

    this._els = {
      win,
      input: win.querySelector("#sp-input"),
      loadBtn: win.querySelector("#sp-load"),
      pasteBtn: win.querySelector("#sp-paste"),
      clearBtn: win.querySelector("#sp-clear"),
      kind: win.querySelector("#sp-kind"),
      theme: win.querySelector("#sp-theme"),
      view: win.querySelector("#sp-view"),
      size: win.querySelector("#sp-size"),
      openInBrowser: win.querySelector("#sp-open-in-browser"),
      status: win.querySelector("#sp-status"),
      preview: win.querySelector("#sp-preview"),
      previewImg: win.querySelector("#sp-preview-img"),
      previewTitle: win.querySelector("#sp-preview-title"),
      previewSub: win.querySelector("#sp-preview-sub"),
      iframe: win.querySelector("#sp-iframe"),
      pinBtn: win.querySelector("#sp-pin"),
      copyEmbedBtn: win.querySelector("#sp-copy-embed"),
      openBtn: win.querySelector("#sp-open"),
      openUriBtn: win.querySelector("#sp-open-uri"),
      tabRecent: win.querySelector("#sp-tab-recent"),
      tabFav: win.querySelector("#sp-tab-fav"),
      list: win.querySelector("#sp-list"),
      exportBtn: win.querySelector("#sp-export"),
      importBtn: win.querySelector("#sp-import"),
      clearListBtn: win.querySelector("#sp-clear-list")
    };

    this._activeTab = "recent";
    this._applyEmbedSize();
    this._bindEvents();
    this._renderLists();
  }

  _setStatus(text, { warn = false } = {}) {
    if (!this._els?.status) return;
    this._els.status.textContent = text || "";
    this._els.status.classList.toggle("warn", !!warn);
  }

  _readPrefsFromUI() {
    this._prefs = {
      theme: this._els.theme.value === "light" ? "light" : "dark",
      view: this._els.view.value === "compact" ? "compact" : "default",
      size: this._els.size.value === "small" ? "small" : this._els.size.value === "large" ? "large" : "medium",
      openInBrowserApp: !!this._els.openInBrowser.checked
    };
    this._savePrefs();
  }

  _currentParsedFromIframe() {
    const kind = this._els?.iframe?.dataset?.kind || null;
    const id = this._els?.iframe?.dataset?.id || null;
    if (!kind || !id) return null;
    return { kind, id };
  }

  _clearEmbed() {
    if (this._els?.iframe) this._els.iframe.removeAttribute("src");
    this._setStatus("");
    if (this._els?.preview) this._els.preview.style.display = "none";
  }

  async _loadFromInput() {
    this._readPrefsFromUI();
    const parsed = parseSpotifyInput(this._els.input.value);
    if (!parsed.kind || !parsed.id) {
      this._setStatus("Invalid Spotify link/URI/id.", { warn: true });
      return;
    }

    const forcedKind = this._els.kind.value !== "auto" ? this._els.kind.value : null;
    const normalized = { kind: forcedKind || parsed.kind, id: parsed.id };

    const embedUrl = buildSpotifyEmbedUrl({ ...normalized, theme: this._prefs.theme, view: this._prefs.view });
    if (!embedUrl) {
      this._setStatus("Unsupported Spotify type.", { warn: true });
      return;
    }

    this._els.iframe.src = embedUrl;
    this._els.iframe.dataset.kind = normalized.kind;
    this._els.iframe.dataset.id = normalized.id;

    this._applyEmbedSize(normalized.kind);

    this._setStatus(`${normalized.kind}: ${normalized.id}`);
    this._pushRecent({ kind: normalized.kind, id: normalized.id });
    await this._updateOembedPreview(normalized);
    this._syncPinButton();
  }

  async _pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        this._els.input.value = text;
        this._loadFromInput();
      }
    } catch {
      this._setStatus("Clipboard access blocked by browser.", { warn: true });
    }
  }

  async _copyEmbedUrl() {
    const parsed = this._currentParsedFromIframe();
    if (!parsed) {
      this._setStatus("Nothing to copy.", { warn: true });
      return;
    }
    const embedUrl = buildSpotifyEmbedUrl({ ...parsed, theme: this._prefs.theme, view: this._prefs.view });
    if (!embedUrl) return;
    try {
      await navigator.clipboard.writeText(embedUrl);
      this._setStatus("Embed URL copied.");
    } catch {
      this._setStatus("Failed to copy (clipboard blocked).", { warn: true });
    }
  }

  _openInSpotify() {
    const parsed = this._currentParsedFromIframe();
    if (!parsed) return;
    const url = buildSpotifyOpenUrl(parsed);
    if (!url) return;
    if (this._prefs.openInBrowserApp && this.browserApp?.open) {
      this.browserApp.open("Yuki Browser", url);
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  _openSpotifyUri() {
    const parsed = this._currentParsedFromIframe();
    if (!parsed) return;
    const uri = buildSpotifyUri(parsed);
    if (!uri) return;
    window.location.href = uri;
  }

  _applyEmbedSize(kind = null) {
    if (!this._els?.iframe) return;
    const size = this._prefs.size || "medium";
    const k = kind || this._els.iframe.dataset.kind || "track";
    const isSmallType = k === "track" || k === "episode";
    const heights = {
      small: isSmallType ? 152 : 280,
      medium: isSmallType ? 232 : 352,
      large: isSmallType ? 320 : 520
    };
    this._els.iframe.style.height = `${heights[size] || heights.medium}px`;
  }

  _setActiveTab(tab) {
    this._activeTab = tab === "fav" ? "fav" : "recent";
    this._els.tabRecent.classList.toggle("sp-tab-active", this._activeTab === "recent");
    this._els.tabFav.classList.toggle("sp-tab-active", this._activeTab === "fav");
    this._renderLists();
  }

  _isPinned(parsed) {
    if (!parsed?.kind || !parsed?.id) return false;
    const key = `${parsed.kind}:${parsed.id}`;
    return this._favorites.some((x) => x.key === key);
  }

  _syncPinButton() {
    const parsed = this._currentParsedFromIframe();
    if (!parsed) return;
    const pinned = this._isPinned(parsed);
    this._els.pinBtn.textContent = pinned ? "Pinned" : "Pin";
    this._els.pinBtn.classList.toggle("sp-pin-active", pinned);
  }

  _togglePin() {
    const parsed = this._currentParsedFromIframe();
    if (!parsed) return;
    const key = `${parsed.kind}:${parsed.id}`;
    const existing = this._favorites.find((x) => x.key === key);
    if (existing) this._favorites = this._favorites.filter((x) => x.key !== key);
    else this._favorites.push({ ...parsed, key, time: Date.now() });
    this._saveFavorites();
    this._syncPinButton();
    this._renderLists();
  }

  async _updateOembedPreview(parsed) {
    const openUrl = buildSpotifyOpenUrl(parsed);
    if (!openUrl) {
      this._els.preview.style.display = "none";
      return;
    }
    const data = await fetchSpotifyOembed(openUrl);
    if (!data) {
      this._els.preview.style.display = "none";
      return;
    }
    const title = data?.title || "";
    const author = data?.author_name ? `by ${data.author_name}` : "";
    const thumb = data?.thumbnail_url || "";
    if (!title && !thumb) {
      this._els.preview.style.display = "none";
      return;
    }
    this._els.previewTitle.textContent = title;
    this._els.previewSub.textContent = author;
    if (thumb) this._els.previewImg.src = thumb;
    this._els.preview.style.display = "";
  }

  async _exportAll() {
    const payload = { v: 1, prefs: this._prefs, recent: this._recent, favorites: this._favorites };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload));
      this._setStatus("Export JSON copied.");
    } catch {
      this._setStatus("Failed to copy export.", { warn: true });
    }
  }

  _importAll() {
    const text = prompt("Paste Spotify Utilities JSON export:");
    if (!text) return;
    const data = safeJsonParse(text, null);
    if (!data || typeof data !== "object") {
      this._setStatus("Invalid JSON.", { warn: true });
      return;
    }
    if (data.prefs) {
      this._prefs = { ...this._prefs, ...data.prefs };
      this._savePrefs();
    }
    if (Array.isArray(data.recent)) {
      this._recent = data.recent.slice(-30);
      this._saveRecent();
    }
    if (Array.isArray(data.favorites)) {
      this._favorites = data.favorites.slice(-100);
      this._saveFavorites();
    }
    this._els.theme.value = this._prefs.theme;
    this._els.view.value = this._prefs.view;
    this._els.size.value = this._prefs.size;
    this._els.openInBrowser.checked = !!this._prefs.openInBrowserApp;
    this._applyEmbedSize();
    this._renderLists();
    this._setStatus("Imported.");
  }

  _renderLists() {
    if (!this._els?.list) return;
    const root = this._els.list;
    root.innerHTML = "";

    const src = this._activeTab === "fav" ? this._favorites : this._recent;
    const items = [...src].slice(-30).reverse();
    if (items.length === 0) {
      const empty = document.createElement("div");
      empty.className = "meta";
      empty.textContent = this._activeTab === "fav" ? "No pinned items yet." : "No recent items yet.";
      root.appendChild(empty);
      return;
    }

    items.forEach((item) => {
      const el = document.createElement("div");
      el.className = "recent-item";
      el.innerHTML = `
        <div style="min-width:0">
          <div class="recent-title">${item.kind}</div>
          <div class="recent-sub">${item.id}</div>
        </div>
        <div class="recent-actions">
          <button class="mini" data-act="del" title="Remove">✕</button>
        </div>
      `;

      el.addEventListener("click", (e) => {
        const act = e?.target?.dataset?.act;
        if (act === "del") {
          e.stopPropagation();
          if (this._activeTab === "fav") {
            this._favorites = this._favorites.filter((x) => x.key !== item.key);
            this._saveFavorites();
          } else {
            this._recent = this._recent.filter((x) => x.key !== item.key);
            this._saveRecent();
          }
          this._renderLists();
          return;
        }

        this._els.input.value = buildSpotifyOpenUrl({ kind: item.kind, id: item.id }) || "";
        this._loadFromInput();
      });

      root.appendChild(el);
    });
  }

  _bindEvents() {
    this._els.loadBtn.addEventListener("click", () => this._loadFromInput());
    this._els.pasteBtn.addEventListener("click", () => this._pasteFromClipboard());
    this._els.clearBtn.addEventListener("click", () => this._clearEmbed());
    this._els.copyEmbedBtn.addEventListener("click", () => this._copyEmbedUrl());
    this._els.openBtn.addEventListener("click", () => this._openInSpotify());
    this._els.openUriBtn.addEventListener("click", () => this._openSpotifyUri());
    this._els.pinBtn.addEventListener("click", () => this._togglePin());

    this._els.tabRecent.addEventListener("click", () => this._setActiveTab("recent"));
    this._els.tabFav.addEventListener("click", () => this._setActiveTab("fav"));
    this._setActiveTab("recent");

    this._els.exportBtn.addEventListener("click", () => this._exportAll());
    this._els.importBtn.addEventListener("click", () => this._importAll());
    this._els.clearListBtn.addEventListener("click", () => {
      if (this._activeTab === "fav") {
        this._favorites = [];
        this._saveFavorites();
      } else {
        this._recent = [];
        this._saveRecent();
      }
      this._renderLists();
    });

    const persist = () => this._readPrefsFromUI();
    this._els.theme.addEventListener("change", () => {
      persist();
      if (this._els.iframe?.src) this._loadFromInput();
    });
    this._els.view.addEventListener("change", () => {
      persist();
      if (this._els.iframe?.src) this._loadFromInput();
    });
    this._els.size.addEventListener("change", () => {
      persist();
      this._applyEmbedSize();
    });
    this._els.openInBrowser.addEventListener("change", persist);
    this._els.kind.addEventListener("change", () => {
      if (this._els.iframe?.src) this._loadFromInput();
    });

    this._els.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this._loadFromInput();
    });
  }
}
