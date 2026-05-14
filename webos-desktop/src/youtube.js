import { BaseApp } from "./core/BaseApp.js";
import { customPrompt, customConfirm } from "./shared/dialogs.js";
import { WindowHelper } from "./utils/WindowHelper.js";

function clampInt(n, min, max) {
  n = Number.parseInt(String(n), 10);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function safeJsonParse(value, fallback) {
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function parseTimeToSeconds(input) {
  if (!input) return 0;
  const s = String(input).trim();
  if (!s) return 0;

  if (/^\d+$/.test(s)) return clampInt(s, 0, 24 * 60 * 60);

  let total = 0;
  const re = /(\d+)\s*([hms])/gi;
  let m;
  while ((m = re.exec(s))) {
    const value = clampInt(m[1], 0, 24 * 60 * 60);
    const unit = (m[2] || "").toLowerCase();
    if (unit === "h") total += value * 3600;
    if (unit === "m") total += value * 60;
    if (unit === "s") total += value;
  }
  return clampInt(total, 0, 24 * 60 * 60);
}

function isProbablyVideoId(input) {
  const s = String(input || "").trim();
  return /^[a-zA-Z0-9_-]{10,20}$/.test(s);
}

function parseYouTubeInput(input) {
  const raw = String(input || "").trim();
  if (!raw) return { kind: null, videoId: null, playlistId: null, startSeconds: 0 };

  if (!raw.includes("://") && isProbablyVideoId(raw)) {
    return { kind: "video", videoId: raw, playlistId: null, startSeconds: 0, rawUrl: null };
  }

  let url;
  try {
    url = new URL(raw);
  } catch {
    return { kind: null, videoId: null, playlistId: null, startSeconds: 0, rawUrl: null };
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const path = url.pathname || "/";
  const qp = url.searchParams;

  const startSeconds = parseTimeToSeconds(qp.get("t") || qp.get("start"));

  const list = qp.get("list");
  if (list && /playlist/i.test(path)) {
    return { kind: "playlist", videoId: null, playlistId: list, startSeconds, rawUrl: url.href };
  }

  if (host === "youtu.be") {
    const videoId = path.split("/").filter(Boolean)[0] || null;
    return { kind: videoId ? "video" : null, videoId, playlistId: list, startSeconds, rawUrl: url.href };
  }

  const isYouTubeHost =
    host === "youtube.com" || host.endsWith(".youtube.com") || host === "music.youtube.com" || host === "m.youtube.com";

  if (!isYouTubeHost) {
    return { kind: null, videoId: null, playlistId: null, startSeconds, rawUrl: url.href };
  }

  if (path === "/watch") {
    const videoId = qp.get("v");
    if (videoId && list) {
      return { kind: "playlist", videoId, playlistId: list, startSeconds, rawUrl: url.href };
    }
    return { kind: videoId ? "video" : null, videoId, playlistId: list, startSeconds, rawUrl: url.href };
  }

  if (path === "/playlist" && list) {
    return { kind: "playlist", videoId: null, playlistId: list, startSeconds, rawUrl: url.href };
  }

  const parts = path.split("/").filter(Boolean);
  if (parts[0] === "shorts" || parts[0] === "embed") {
    const videoId = parts[1] || null;
    if (videoId && list) {
      return { kind: "playlist", videoId, playlistId: list, startSeconds, rawUrl: url.href };
    }
    return { kind: videoId ? "video" : null, videoId, playlistId: list, startSeconds, rawUrl: url.href };
  }

  return { kind: null, videoId: null, playlistId: list, startSeconds, rawUrl: url.href };
}

function buildEmbedUrl({
  kind,
  videoId,
  playlistId,
  startSeconds,
  endSeconds = 0,
  loop = false,
  autoplay,
  controls,
  mute,
  nocookie
}) {
  const base = nocookie ? "https://www.youtube-nocookie.com" : "https://www.youtube.com";
  const params = new URLSearchParams();
  if (autoplay) params.set("autoplay", "1");
  if (!controls) params.set("controls", "0");
  if (mute && autoplay) params.set("mute", "1");
  if (startSeconds > 0) params.set("start", String(startSeconds));
  if (endSeconds > 0) params.set("end", String(endSeconds));
  if (loop) params.set("loop", "1");
  params.set("rel", "0");

  if (kind === "playlist" && playlistId) {
    params.set("list", playlistId);
    return `${base}/embed/videoseries?${params.toString()}`;
  }
  if (kind === "video" && videoId) {
    if (loop) params.set("playlist", videoId);
    return `${base}/embed/${encodeURIComponent(videoId)}?${params.toString()}`;
  }
  return null;
}

function buildWatchUrl({ kind, videoId, playlistId, startSeconds }) {
  if (kind === "playlist" && playlistId) {
    const u = new URL("https://www.youtube.com/playlist");
    u.searchParams.set("list", playlistId);
    if (startSeconds > 0) u.searchParams.set("t", `${startSeconds}s`);
    return u.href;
  }
  if (kind === "video" && videoId) {
    const u = new URL("https://www.youtube.com/watch");
    u.searchParams.set("v", videoId);
    if (startSeconds > 0) u.searchParams.set("t", `${startSeconds}s`);
    if (playlistId) u.searchParams.set("list", playlistId);
    return u.href;
  }
  return null;
}

export class YouTubeApp extends BaseApp {
  constructor(services) {
    super(services);
    this.windowHelper = new WindowHelper(this.wm);
    this.browserApp = null;
    this.winId = "youtube-utils";
    this._els = null;
    this._prefs = this._loadPrefs();
    this._preset = this._loadPreset();
    this._recent = this._loadRecent();
    this._favorites = this._loadFavorites();
  }

  setBrowserApp(browserApp) {
    this.browserApp = browserApp || null;
  }

  _loadPrefs() {
    const prefs = safeJsonParse(localStorage.getItem("youtube_utils_prefs"), {});
    return {
      nocookie: prefs.nocookie !== false,
      autoplay: prefs.autoplay === true,
      controls: prefs.controls !== false,
      mute: prefs.mute === true,
      openInBrowserApp: prefs.openInBrowserApp === true
    };
  }

  _savePrefs() {
    localStorage.setItem("youtube_utils_prefs", JSON.stringify(this._prefs));
  }

  _loadPreset() {
    const preset = safeJsonParse(localStorage.getItem("youtube_utils_preset"), {});
    return {
      endSeconds: typeof preset.endSeconds === "number" ? preset.endSeconds : 0,
      loop: preset.loop === true
    };
  }

  _savePreset() {
    localStorage.setItem("youtube_utils_preset", JSON.stringify(this._preset));
  }

  _loadRecent() {
    const items = safeJsonParse(localStorage.getItem("youtube_utils_recent"), []);
    return Array.isArray(items) ? items.slice(-30) : [];
  }

  _saveRecent() {
    localStorage.setItem("youtube_utils_recent", JSON.stringify(this._recent.slice(-30)));
  }

  _loadFavorites() {
    const items = safeJsonParse(localStorage.getItem("youtube_utils_favorites"), []);
    return Array.isArray(items) ? items.slice(-100) : [];
  }

  _saveFavorites() {
    localStorage.setItem("youtube_utils_favorites", JSON.stringify(this._favorites.slice(-100)));
  }

  _pushRecent(item) {
    const key = `${item.kind}:${item.videoId || ""}:${item.playlistId || ""}:${item.startSeconds || 0}`;
    this._recent = this._recent.filter((x) => x.key !== key);
    this._recent.push({ ...item, key, time: Date.now() });
    this._saveRecent();
    this._renderLists();
  }

  open(title = "YouTube Utilities") {
    const existing = document.getElementById(this.winId);
    if (existing) {
      this.wm.bringToFront(existing);
      return;
    }

    const content = `
      <div class="window-content yt-utils">
        <div class="toolbar">
          <div class="row">
            <input id="yt-input-${this.winId}" type="text" spellcheck="false" autocomplete="off"
              placeholder="Paste a YouTube video/shorts/playlist URL (or a video id)"/>
            <button id="yt-load-${this.winId}">Load</button>
            <button id="yt-paste-${this.winId}" title="Paste from clipboard">Paste</button>
            <button id="yt-clear-${this.winId}" title="Clear embed">Clear</button>
          </div>
          <div class="row meta" style="justify-content:space-between;margin-top:10px">
            <div class="row">
              <label class="toggle" title="Use youtube-nocookie.com for embeds">
                <input id="yt-nocookie-${this.winId}" type="checkbox" ${this._prefs.nocookie ? "checked" : ""}/>
                <span>No-Cookie</span>
              </label>
              <label class="toggle" title="Autoplay when loaded (some browsers block unless muted)">
                <input id="yt-autoplay-${this.winId}" type="checkbox" ${this._prefs.autoplay ? "checked" : ""}/>
                <span>Autoplay</span>
              </label>
              <label class="toggle" title="Show player controls">
                <input id="yt-controls-${this.winId}" type="checkbox" ${this._prefs.controls ? "checked" : ""}/>
                <span>Controls</span>
              </label>
              <label class="toggle" title="Mute when autoplay is enabled">
                <input id="yt-mute-${this.winId}" type="checkbox" ${this._prefs.mute ? "checked" : ""}/>
                <span>Mute</span>
              </label>
              <label class="toggle" title="Open links inside Yuki Browser instead of a new tab">
                <input id="yt-open-in-browser-${this.winId}" type="checkbox" ${
                  this._prefs.openInBrowserApp ? "checked" : ""
                }/>
                <span>Internal Browser</span>
              </label>
            </div>
            <div class="row">
              <span id="yt-status-${this.winId}" class="meta"></span>
            </div>
          </div>

          <div class="row" style="margin-top:10px">
            <div class="yt-preview" id="yt-preview-${this.winId}" style="display:none">
              <img id="yt-preview-img-${this.winId}" alt="" />
              <div class="yt-preview-txt">
                <div class="yt-preview-title" id="yt-preview-title-${this.winId}"></div>
                <div class="yt-preview-sub meta" id="yt-preview-sub-${this.winId}"></div>
              </div>
            </div>
          </div>

          <div class="row meta" style="margin-top:10px;justify-content:space-between">
            <div class="row">
              <label class="toggle" title="Timestamp tool">
                <span>Time</span>
                <input id="yt-time-${this.winId}" type="text" placeholder="1:23 or 1m23s" style="width:140px" />
              </label>
              <button class="mini" id="yt-copy-time-${this.winId}" title="Copy watch link at time">Copy Link @ Time</button>
              <button class="mini" id="yt-jump-time-${this.winId}" title="Reload embed starting at time">Jump</button>
            </div>
            <div class="row">
              <label class="toggle" title="End time (seconds or 1m30s)">
                <span>End</span>
                <input id="yt-end-${this.winId}" type="text" placeholder="(optional)" style="width:140px" />
              </label>
              <label class="toggle" title="Loop playback">
                <input id="yt-loop-${this.winId}" type="checkbox" ${this._preset.loop ? "checked" : ""}/>
                <span>Loop</span>
              </label>
              <button class="mini" id="yt-save-preset-${this.winId}" title="Save loop/end as default">Save Preset</button>
              <button class="mini" id="yt-reset-preset-${this.winId}" title="Reset preset">Reset</button>
            </div>
          </div>
        </div>
        <div class="split">
          <div class="panel embed">
            <div class="panel-h">
              <span>Embed</span>
              <div class="row">
                <button class="mini" id="yt-pin-${this.winId}" title="Pin/unpin current item">Pin</button>
                <button class="mini" id="yt-copy-embed-${this.winId}" title="Copy embed URL">Copy Embed URL</button>
                <button class="mini" id="yt-open-yt-${this.winId}" title="Open watch page">Open</button>
              </div>
            </div>
            <div class="panel-b" style="padding:0">
              <iframe id="yt-iframe-${this.winId}" title="YouTube embed" allow="autoplay; encrypted-media; picture-in-picture; fullscreen"></iframe>
            </div>
          </div>
          <div class="panel">
            <div class="panel-h">
              <div class="row" style="gap:8px">
                <button class="mini yt-tab-btn" id="yt-tab-recent-${this.winId}" data-tab="recent">Recent</button>
                <button class="mini yt-tab-btn" id="yt-tab-fav-${this.winId}" data-tab="fav">Pinned</button>
              </div>
              <div class="row">
                <button class="mini" id="yt-export-${this.winId}" title="Copy export JSON to clipboard">Export</button>
                <button class="mini" id="yt-import-${this.winId}" title="Import JSON from clipboard/paste">Import</button>
                <button class="mini" id="yt-clear-list-${this.winId}">Clear</button>
              </div>
            </div>
            <div class="panel-b" id="yt-list-${this.winId}"></div>
          </div>
        </div>
        <div class="meta">
          Tips: Supports <code>watch</code>, <code>youtu.be</code>, <code>shorts</code>, <code>embed</code>, and playlists. Time params like <code>&t=1m30s</code> or <code>&start=90</code> are respected.
        </div>
      </div>
    `;

    const win = this.windowHelper.createAndMountWindow(this.winId, title, content, "980px", "640px", {
      icon: "fab fa-youtube",
      iconColor: "#ff2a2a"
    });

    this._els = {
      win,
      input: document.getElementById(`yt-input-${this.winId}`),
      loadBtn: document.getElementById(`yt-load-${this.winId}`),
      pasteBtn: document.getElementById(`yt-paste-${this.winId}`),
      clearBtn: document.getElementById(`yt-clear-${this.winId}`),
      nocookie: document.getElementById(`yt-nocookie-${this.winId}`),
      autoplay: document.getElementById(`yt-autoplay-${this.winId}`),
      controls: document.getElementById(`yt-controls-${this.winId}`),
      mute: document.getElementById(`yt-mute-${this.winId}`),
      openInBrowser: document.getElementById(`yt-open-in-browser-${this.winId}`),
      preview: document.getElementById(`yt-preview-${this.winId}`),
      previewImg: document.getElementById(`yt-preview-img-${this.winId}`),
      previewTitle: document.getElementById(`yt-preview-title-${this.winId}`),
      previewSub: document.getElementById(`yt-preview-sub-${this.winId}`),
      timeInput: document.getElementById(`yt-time-${this.winId}`),
      copyTimeBtn: document.getElementById(`yt-copy-time-${this.winId}`),
      jumpTimeBtn: document.getElementById(`yt-jump-time-${this.winId}`),
      endInput: document.getElementById(`yt-end-${this.winId}`),
      loop: document.getElementById(`yt-loop-${this.winId}`),
      savePreset: document.getElementById(`yt-save-preset-${this.winId}`),
      resetPreset: document.getElementById(`yt-reset-preset-${this.winId}`),
      iframe: document.getElementById(`yt-iframe-${this.winId}`),
      status: document.getElementById(`yt-status-${this.winId}`),
      pinBtn: document.getElementById(`yt-pin-${this.winId}`),
      copyEmbedBtn: document.getElementById(`yt-copy-embed-${this.winId}`),
      openYtBtn: document.getElementById(`yt-open-yt-${this.winId}`),
      tabRecent: document.getElementById(`yt-tab-recent-${this.winId}`),
      tabFav: document.getElementById(`yt-tab-fav-${this.winId}`),
      list: document.getElementById(`yt-list-${this.winId}`),
      exportBtn: document.getElementById(`yt-export-${this.winId}`),
      importBtn: document.getElementById(`yt-import-${this.winId}`),
      clearListBtn: document.getElementById(`yt-clear-list-${this.winId}`)
    };

    this._activeTab = "recent";
    this._els.endInput.value = this._preset.endSeconds ? String(this._preset.endSeconds) : "";
    this._bindEvents();
    this._renderLists();
  }

  _setStatus(text, { warn = false } = {}) {
    if (!this._els?.status) return;
    this._els.status.textContent = text || "";
    this._els.status.classList.toggle("warn", !!warn);
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

  _readPrefsFromUI() {
    this._prefs = {
      nocookie: !!this._els.nocookie.checked,
      autoplay: !!this._els.autoplay.checked,
      controls: !!this._els.controls.checked,
      mute: !!this._els.mute.checked,
      openInBrowserApp: !!this._els.openInBrowser.checked
    };
    this._savePrefs();
  }

  async _loadFromInput({ overrideStartSeconds = null } = {}) {
    this._readPrefsFromUI();
    const parsed = parseYouTubeInput(this._els.input.value);
    if (!parsed.kind || (!parsed.videoId && !parsed.playlistId)) {
      this._setStatus("Invalid YouTube URL or id.", { warn: true });
      return;
    }

    const endSeconds = parseTimeToSeconds(this._els.endInput.value || "") || 0;
    const loop = !!this._els.loop.checked;

    const embedUrl = buildEmbedUrl({
      ...parsed,
      startSeconds: overrideStartSeconds !== null ? overrideStartSeconds : parsed.startSeconds,
      endSeconds,
      loop,
      autoplay: this._prefs.autoplay,
      controls: this._prefs.controls,
      mute: this._prefs.mute,
      nocookie: this._prefs.nocookie
    });
    if (!embedUrl) {
      this._setStatus("Could not build embed URL.", { warn: true });
      return;
    }

    this._els.iframe.src = embedUrl;
    this._els.iframe.dataset.kind = parsed.kind;
    this._els.iframe.dataset.videoId = parsed.videoId || "";
    this._els.iframe.dataset.playlistId = parsed.playlistId || "";
    this._els.iframe.dataset.startSeconds = String(
      (overrideStartSeconds !== null ? overrideStartSeconds : parsed.startSeconds) || 0
    );
    this._els.iframe.dataset.endSeconds = String(endSeconds || 0);
    this._els.iframe.dataset.loop = loop ? "1" : "0";

    const label = parsed.kind === "playlist" ? `Playlist: ${parsed.playlistId}` : `Video: ${parsed.videoId}`;
    const startLabel = (overrideStartSeconds !== null ? overrideStartSeconds : parsed.startSeconds) || 0;
    this._setStatus(`${label}${startLabel ? ` @ ${startLabel}s` : ""}`);
    this._pushRecent({
      kind: parsed.kind,
      videoId: parsed.videoId || null,
      playlistId: parsed.playlistId || null,
      startSeconds: startLabel
    });

    await this._updateOembedPreview({ kind: parsed.kind, videoId: parsed.videoId, playlistId: parsed.playlistId });
    this._syncPinButton();
  }

  _clearEmbed() {
    if (this._els?.iframe) this._els.iframe.removeAttribute("src");
    this._setStatus("");
  }

  _currentParsedFromIframe() {
    if (!this._els?.iframe) return null;
    const kind = this._els.iframe.dataset.kind || null;
    const videoId = this._els.iframe.dataset.videoId || null;
    const playlistId = this._els.iframe.dataset.playlistId || null;
    const startSeconds = clampInt(this._els.iframe.dataset.startSeconds || 0, 0, 24 * 60 * 60);
    const endSeconds = clampInt(this._els.iframe.dataset.endSeconds || 0, 0, 24 * 60 * 60);
    const loop = this._els.iframe.dataset.loop === "1";
    if (!kind) return null;
    return { kind, videoId: videoId || null, playlistId: playlistId || null, startSeconds, endSeconds, loop };
  }

  async _copyEmbedUrl() {
    const parsed = this._currentParsedFromIframe();
    if (!parsed) {
      this._setStatus("Nothing to copy.", { warn: true });
      return;
    }
    const embedUrl = buildEmbedUrl({
      ...parsed,
      autoplay: this._prefs.autoplay,
      controls: this._prefs.controls,
      mute: this._prefs.mute,
      nocookie: this._prefs.nocookie
    });
    if (!embedUrl) return;
    try {
      await navigator.clipboard.writeText(embedUrl);
      this._setStatus("Embed URL copied.");
    } catch {
      this._setStatus("Failed to copy (clipboard blocked).", { warn: true });
    }
  }

  _openOnYouTube() {
    const parsed = this._currentParsedFromIframe();
    if (!parsed) return;
    const watchUrl = buildWatchUrl(parsed);
    if (!watchUrl) return;
    if (this._prefs.openInBrowserApp && this.browserApp?.open) {
      this.browserApp.open("Yuki Browser", watchUrl);
    } else {
      window.open(watchUrl, "_blank", "noopener,noreferrer");
    }
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
      const title = item.kind === "playlist" ? "Playlist" : "Video";
      const id = item.kind === "playlist" ? item.playlistId : item.videoId;
      const sub = `${id || ""}${item.startSeconds ? ` • ${item.startSeconds}s` : ""}`;

      el.innerHTML = `
        <div style="min-width:0">
          <div class="recent-title">${title}</div>
          <div class="recent-sub">${sub}</div>
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

        const watchUrl =
          item.kind === "playlist" && item.playlistId ? `https://www.youtube.com/playlist?list=${item.playlistId}` : "";
        this._els.input.value = watchUrl || `https://www.youtube.com/watch?v=${item.videoId || ""}`;
        if (item.startSeconds) {
          try {
            const u = new URL(this._els.input.value);
            u.searchParams.set("t", `${item.startSeconds}s`);
            if (item.playlistId) u.searchParams.set("list", item.playlistId);
            this._els.input.value = u.href;
          } catch {}
        }
        this._loadFromInput();
      });

      root.appendChild(el);
    });
  }

  _setActiveTab(tab) {
    this._activeTab = tab === "fav" ? "fav" : "recent";
    this._els.tabRecent.classList.toggle("yt-tab-active", this._activeTab === "recent");
    this._els.tabFav.classList.toggle("yt-tab-active", this._activeTab === "fav");
    this._renderLists();
  }

  _isPinned(parsed) {
    if (!parsed?.kind) return false;
    const key = `${parsed.kind}:${parsed.videoId || ""}:${parsed.playlistId || ""}:${parsed.startSeconds || 0}`;
    return this._favorites.some((x) => x.key === key);
  }

  _syncPinButton() {
    const parsed = this._currentParsedFromIframe();
    if (!parsed) return;
    const pinned = this._isPinned(parsed);
    this._els.pinBtn.textContent = pinned ? "Pinned" : "Pin";
    this._els.pinBtn.classList.toggle("yt-pin-active", pinned);
  }

  _togglePin() {
    const parsed = this._currentParsedFromIframe();
    if (!parsed) return;
    const key = `${parsed.kind}:${parsed.videoId || ""}:${parsed.playlistId || ""}:${parsed.startSeconds || 0}`;
    const existing = this._favorites.find((x) => x.key === key);
    if (existing) {
      this._favorites = this._favorites.filter((x) => x.key !== key);
    } else {
      this._favorites.push({ ...parsed, key, time: Date.now() });
    }
    this._saveFavorites();
    this._syncPinButton();
    this._renderLists();
  }

  async _updateOembedPreview({ kind, videoId, playlistId }) {
    const watchUrl = buildWatchUrl({ kind, videoId, playlistId, startSeconds: 0 });
    if (!watchUrl) {
      this._els.preview.style.display = "none";
      return;
    }
    try {
      const u = new URL("https://www.youtube.com/oembed");
      u.searchParams.set("url", watchUrl);
      u.searchParams.set("format", "json");
      const res = await fetch(u.href);
      if (!res.ok) throw new Error("oembed");
      const data = await res.json();
      const title = data?.title || "";
      const author = data?.author_name ? `by ${data.author_name}` : "";
      const thumb = data?.thumbnail_url || "";
      if (!title && !thumb) throw new Error("empty");

      this._els.previewTitle.textContent = title;
      this._els.previewSub.textContent = author;
      if (thumb) this._els.previewImg.src = thumb;
      this._els.preview.style.display = "";
    } catch {
      this._els.preview.style.display = "none";
    }
  }

  async _copyWatchUrlAtTime() {
    const parsed = this._currentParsedFromIframe();
    if (!parsed) {
      this._setStatus("Nothing loaded.", { warn: true });
      return;
    }
    const t = parseTimeToSeconds(this._els.timeInput.value || "");
    const watchUrl = buildWatchUrl({ ...parsed, startSeconds: t });
    if (!watchUrl) return;
    try {
      await navigator.clipboard.writeText(watchUrl);
      this._setStatus("Watch link copied.");
    } catch {
      this._setStatus("Failed to copy (clipboard blocked).", { warn: true });
    }
  }

  _jumpToTime() {
    const parsed = this._currentParsedFromIframe();
    if (!parsed) return;
    const t = parseTimeToSeconds(this._els.timeInput.value || "");
    this._loadFromInput({ overrideStartSeconds: t });
  }

  _savePresetFromUI() {
    this._preset = {
      endSeconds: parseTimeToSeconds(this._els.endInput.value || "") || 0,
      loop: !!this._els.loop.checked
    };
    this._savePreset();
    this._setStatus("Preset saved.");
  }

  _resetPreset() {
    this._preset = { endSeconds: 0, loop: false };
    this._savePreset();
    this._els.endInput.value = "";
    this._els.loop.checked = false;
    this._setStatus("Preset reset.");
  }

  async _exportAll() {
    const payload = {
      v: 1,
      prefs: this._prefs,
      preset: this._preset,
      recent: this._recent,
      favorites: this._favorites
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload));
      this._setStatus("Export JSON copied.");
    } catch {
      this._setStatus("Failed to copy export.", { warn: true });
    }
  }

  async _importAll() {
    const text = await customPrompt("Paste YouTube Utilities JSON export:");
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
    if (data.preset) {
      this._preset = { ...this._preset, ...data.preset };
      this._savePreset();
    }
    if (Array.isArray(data.recent)) {
      this._recent = data.recent.slice(-30);
      this._saveRecent();
    }
    if (Array.isArray(data.favorites)) {
      this._favorites = data.favorites.slice(-100);
      this._saveFavorites();
    }
    this._els.nocookie.checked = !!this._prefs.nocookie;
    this._els.autoplay.checked = !!this._prefs.autoplay;
    this._els.controls.checked = !!this._prefs.controls;
    this._els.mute.checked = !!this._prefs.mute;
    this._els.openInBrowser.checked = !!this._prefs.openInBrowserApp;
    this._els.loop.checked = !!this._preset.loop;
    this._els.endInput.value = this._preset.endSeconds ? String(this._preset.endSeconds) : "";
    this._renderLists();
    this._setStatus("Imported.");
  }

  _bindEvents() {
    this._els.loadBtn.addEventListener("click", () => this._loadFromInput());
    this._els.pasteBtn.addEventListener("click", () => this._pasteFromClipboard());
    this._els.clearBtn.addEventListener("click", () => this._clearEmbed());
    this._els.copyEmbedBtn.addEventListener("click", () => this._copyEmbedUrl());
    this._els.openYtBtn.addEventListener("click", () => this._openOnYouTube());
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

    this._els.copyTimeBtn.addEventListener("click", () => this._copyWatchUrlAtTime());
    this._els.jumpTimeBtn.addEventListener("click", () => this._jumpToTime());
    this._els.savePreset.addEventListener("click", () => this._savePresetFromUI());
    this._els.resetPreset.addEventListener("click", () => this._resetPreset());

    const persistToggles = () => this._readPrefsFromUI();
    this._els.nocookie.addEventListener("change", persistToggles);
    this._els.autoplay.addEventListener("change", persistToggles);
    this._els.controls.addEventListener("change", persistToggles);
    this._els.mute.addEventListener("change", persistToggles);
    this._els.openInBrowser.addEventListener("change", persistToggles);

    this._els.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this._loadFromInput();
    });
  }
}
