import { createElement } from "../shared/domUtils.js";
import { BaseApp, PersistenceTypes, StorageKeys, os } from "../framework.js";
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

export class YouTubeUtilsApp extends BaseApp {
  constructor(services) {
    super(services);
    this.browserApp = null;
    this.winId = "youtube-utils";
    this.els = null;
    this.prefs = this.loadPrefs();
    this.preset = this.loadPreset();
    this.recent = this.loadRecent();
    this.favorites = this.loadFavorites();
  }

  getDeclarativeSchema(opts) {
    return {
      id: "youtube-utils",
      name: "YouTube Utilities",
      icon: "fab fa-youtube",
      windows: [
        {
          id: "youtube-utils",
          title: "YouTube Utilities",
          size: ["980px", "640px"],
          icon: "fab fa-youtube",
          iconColor: "#ff2a2a",
          ui: `<div class="window-content yt-utils">
        <div class="toolbar">
          <div class="row">
            <input id="yt-input" type="text" spellcheck="false" autocomplete="off"
              placeholder="Paste a YouTube video/shorts/playlist URL (or a video id)"/>
            <button id="yt-load">Load</button>
            <button id="yt-paste" title="Paste from clipboard">Paste</button>
            <button id="yt-clear" title="Clear embed">Clear</button>
          </div>
          <div class="row meta" style="justify-content:space-between;margin-top:10px">
            <div class="row">
              <label class="toggle" title="Use youtube-nocookie.com for embeds">
                <input id="yt-nocookie" type="checkbox" checked/>
                <span>No-Cookie</span>
              </label>
              <label class="toggle" title="Autoplay when loaded (some browsers block unless muted)">
                <input id="yt-autoplay" type="checkbox"/>
                <span>Autoplay</span>
              </label>
              <label class="toggle" title="Show player controls">
                <input id="yt-controls" type="checkbox" checked/>
                <span>Controls</span>
              </label>
              <label class="toggle" title="Mute when autoplay is enabled">
                <input id="yt-mute" type="checkbox"/>
                <span>Mute</span>
              </label>
              <label class="toggle" title="Open links inside Yuki Browser instead of a new tab">
                <input id="yt-open-in-browser" type="checkbox"/>
                <span>Internal Browser</span>
              </label>
            </div>
            <div class="row">
              <span id="yt-status" class="meta"></span>
            </div>
          </div>

          <div class="row" style="margin-top:10px">
            <div class="yt-preview" id="yt-preview" style="display:none">
              <img id="yt-preview-img" alt="" />
              <div class="yt-preview-txt">
                <div class="yt-preview-title" id="yt-preview-title"></div>
                <div class="yt-preview-sub meta" id="yt-preview-sub"></div>
              </div>
            </div>
          </div>

          <div class="row meta" style="margin-top:10px;justify-content:space-between">
            <div class="row">
              <label class="toggle" title="Timestamp tool">
                <span>Time</span>
                <input id="yt-time" type="text" placeholder="1:23 or 1m23s" style="width:140px" />
              </label>
              <button class="mini" id="yt-copy-time" title="Copy watch link at time">Copy Link @ Time</button>
              <button class="mini" id="yt-jump-time" title="Reload embed starting at time">Jump</button>
            </div>
            <div class="row">
              <label class="toggle" title="End time (seconds or 1m30s)">
                <span>End</span>
                <input id="yt-end" type="text" placeholder="(optional)" style="width:140px" />
              </label>
              <label class="toggle" title="Loop playback">
                <input id="yt-loop" type="checkbox"/>
                <span>Loop</span>
              </label>
              <button class="mini" id="yt-save-preset" title="Save loop/end as default">Save Preset</button>
              <button class="mini" id="yt-reset-preset" title="Reset preset">Reset</button>
            </div>
          </div>
        </div>
        <div class="split">
          <div class="panel embed">
            <div class="panel-h">
              <span>Embed</span>
              <div class="row">
                <button class="mini" id="yt-pin" title="Pin/unpin current item">Pin</button>
                <button class="mini" id="yt-copy-embed" title="Copy embed URL">Copy Embed URL</button>
                <button class="mini" id="yt-open-yt" title="Open watch page">Open</button>
                <button class="mini" id="yt-create-desktop" title="Create desktop entry">Create Desktop Entry</button>
              </div>
            </div>
            <div class="panel-b" style="padding:0">
              <iframe id="yt-iframe" title="YouTube embed" allow="autoplay; encrypted-media; picture-in-picture; fullscreen"></iframe>
            </div>
          </div>
          <div class="panel">
            <div class="panel-h">
              <div class="row" style="gap:8px">
                <button class="mini yt-tab-btn" id="yt-tab-recent" data-tab="recent">Recent</button>
                <button class="mini yt-tab-btn" id="yt-tab-fav" data-tab="fav">Pinned</button>
              </div>
              <div class="row">
                <button class="mini" id="yt-export" title="Copy export JSON to clipboard">Export</button>
                <button class="mini" id="yt-import" title="Import JSON from clipboard/paste">Import</button>
                <button class="mini" id="yt-clear-list">Clear</button>
              </div>
            </div>
            <div class="panel-b" id="yt-list"></div>
          </div>
        </div>
        <div class="meta">
          Tips: Supports <code>watch</code>, <code>youtu.be</code>, <code>shorts</code>, <code>embed</code>, and playlists. Time params like <code>&t=1m30s</code> or <code>&start=90</code> are respected.
        </div>
      </div>`,
          events: {
            "#yt-load": {
              click: {
                type: "custom:load",
                stopPropagation: true
              }
            },
            "#yt-paste": {
              click: {
                type: "custom:paste",
                stopPropagation: true
              }
            },
            "#yt-clear": {
              click: {
                type: "custom:clear",
                stopPropagation: true
              }
            },
            "#yt-copy-embed": {
              click: {
                type: "custom:copyEmbed",
                stopPropagation: true
              }
            },
            "#yt-open-yt": {
              click: {
                type: "custom:openYt",
                stopPropagation: true
              }
            },
            "#yt-create-desktop": {
              click: {
                type: "custom:createDesktop",
                stopPropagation: true
              }
            },
            "#yt-pin": {
              click: {
                type: "custom:pin",
                stopPropagation: true
              }
            },
            "#yt-tab-recent": {
              click: {
                type: "custom:tabRecent",
                stopPropagation: true
              }
            },
            "#yt-tab-fav": {
              click: {
                type: "custom:tabFav",
                stopPropagation: true
              }
            },
            "#yt-export": {
              click: {
                type: "custom:export",
                stopPropagation: true
              }
            },
            "#yt-import": {
              click: {
                type: "custom:import",
                stopPropagation: true
              }
            },
            "#yt-clear-list": {
              click: {
                type: "custom:clearList",
                stopPropagation: true
              }
            },
            "#yt-copy-time": {
              click: {
                type: "custom:copyTime",
                stopPropagation: true
              }
            },
            "#yt-jump-time": {
              click: {
                type: "custom:jumpTime",
                stopPropagation: true
              }
            },
            "#yt-save-preset": {
              click: {
                type: "custom:savePreset",
                stopPropagation: true
              }
            },
            "#yt-reset-preset": {
              click: {
                type: "custom:resetPreset",
                stopPropagation: true
              }
            },
            "#yt-input": {
              keydown: {
                type: "custom:inputKeydown",
                stopPropagation: false
              }
            }
          }
        }
      ],
      state: {
        initial: {
          prefs: {
            nocookie: true,
            autoplay: false,
            controls: true,
            mute: false,
            openInBrowserApp: false
          },
          preset: {
            endSeconds: 0,
            loop: false
          },
          recent: [],
          favorites: []
        },
        persistence: PersistenceTypes.LOCAL_STORAGE
      },
      actions: {
        load: (payload, event, element, state) => {
          this.loadFromInput();
        },
        paste: async (payload, event, element, state) => {
          await this.pasteFromClipboard();
        },
        clear: (payload, event, element, state) => {
          this.clearEmbed();
        },
        copyEmbed: async (payload, event, element, state) => {
          await this.copyEmbedUrl();
        },
        openYt: (payload, event, element, state) => {
          this.openOnYouTube();
        },
        createDesktop: async (payload, event, element, state) => {
          await this.createDesktopEntry();
        },
        pin: (payload, event, element, state) => {
          this.togglePin();
        },
        tabRecent: (payload, event, element, state) => {
          this.setActiveTab("recent");
        },
        tabFav: (payload, event, element, state) => {
          this.setActiveTab("fav");
        },
        export: async (payload, event, element, state) => {
          await this.exportAll();
        },
        import: async (payload, event, element, state) => {
          await this.importAll();
        },
        clearList: (payload, event, element, state) => {
          if (this.activeTab === "fav") {
            this.favorites = [];
            this.saveFavorites();
          } else {
            this.recent = [];
            this.saveRecent();
          }
          this.renderLists();
        },
        copyTime: async (payload, event, element, state) => {
          await this.copyWatchUrlAtTime();
        },
        jumpTime: (payload, event, element, state) => {
          this.jumpToTime();
        },
        savePreset: (payload, event, element, state) => {
          this.savePresetFromUI();
        },
        resetPreset: (payload, event, element, state) => {
          this.resetPreset();
        },
        inputKeydown: (payload, event, element, state) => {
          if (event.key === "Enter") {
            this.loadFromInput();
          }
        },
        initYoutube: (payload, event, element, state) => {
          this.initYoutube(payload, event, element, state);
        }
      },
      onMount: "initYoutube"
    };
  }

  initYoutube(payload, event, element, state) {
    this.els = {
      win: document.getElementById("youtube-utils"),
      input: document.getElementById("yt-input"),
      loadBtn: document.getElementById("yt-load"),
      pasteBtn: document.getElementById("yt-paste"),
      clearBtn: document.getElementById("yt-clear"),
      nocookie: document.getElementById("yt-nocookie"),
      autoplay: document.getElementById("yt-autoplay"),
      controls: document.getElementById("yt-controls"),
      mute: document.getElementById("yt-mute"),
      openInBrowser: document.getElementById("yt-open-in-browser"),
      preview: document.getElementById("yt-preview"),
      previewImg: document.getElementById("yt-preview-img"),
      previewTitle: document.getElementById("yt-preview-title"),
      previewSub: document.getElementById("yt-preview-sub"),
      timeInput: document.getElementById("yt-time"),
      copyTimeBtn: document.getElementById("yt-copy-time"),
      jumpTimeBtn: document.getElementById("yt-jump-time"),
      endInput: document.getElementById("yt-end"),
      loop: document.getElementById("yt-loop"),
      savePreset: document.getElementById("yt-save-preset"),
      resetPreset: document.getElementById("yt-reset-preset"),
      iframe: document.getElementById("yt-iframe"),
      status: document.getElementById("yt-status"),
      pinBtn: document.getElementById("yt-pin"),
      copyEmbedBtn: document.getElementById("yt-copy-embed"),
      openYtBtn: document.getElementById("yt-open-yt"),
      tabRecent: document.getElementById("yt-tab-recent"),
      tabFav: document.getElementById("yt-tab-fav"),
      list: document.getElementById("yt-list"),
      exportBtn: document.getElementById("yt-export"),
      importBtn: document.getElementById("yt-import"),
      clearListBtn: document.getElementById("yt-clear-list")
    };
    this.activeTab = "recent";
    this.bindEvents();
    this.renderLists();
  }

  setBrowserApp(browserApp) {
    this.browserApp = browserApp || null;
  }

  loadPrefs() {
    const prefs = os.storage.get(StorageKeys.youtubePrefs) || {};
    return {
      nocookie: prefs.nocookie !== false,
      autoplay: prefs.autoplay === true,
      controls: prefs.controls !== false,
      mute: prefs.mute === true,
      openInBrowserApp: prefs.openInBrowserApp === true
    };
  }

  savePrefs() {
    os.storage.set(StorageKeys.youtubePrefs, this.prefs);
  }

  loadPreset() {
    const preset = os.storage.get(StorageKeys.youtubePreset) || {};
    return {
      endSeconds: typeof preset.endSeconds === "number" ? preset.endSeconds : 0,
      loop: preset.loop === true
    };
  }

  savePreset() {
    os.storage.set(StorageKeys.youtubePreset, this.preset);
  }

  loadRecent() {
    const items = os.storage.get(StorageKeys.youtubeRecent) || [];
    return Array.isArray(items) ? items.slice(-30) : [];
  }

  saveRecent() {
    os.storage.set(StorageKeys.youtubeRecent, this.recent.slice(-30));
  }

  loadFavorites() {
    const items = os.storage.get(StorageKeys.youtubeFavorites) || [];
    return Array.isArray(items) ? items.slice(-100) : [];
  }

  saveFavorites() {
    os.storage.set(StorageKeys.youtubeFavorites, this.favorites.slice(-100));
  }

  pushRecent(item) {
    const key = `${item.kind}:${item.videoId || ""}:${item.playlistId || ""}:${item.startSeconds || 0}`;
    this.recent = this.recent.filter((x) => x.key !== key);
    this.recent.push({ ...item, key, time: Date.now() });
    this.saveRecent();
    this.renderLists();
  }

  setStatus(text, { warn = false } = {}) {
    if (!this.els?.status) return;
    this.els.status.textContent = text || "";
    this.els.status.classList.toggle("warn", !!warn);
  }

  async pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        this.els.input.value = text;
        this.loadFromInput();
      }
    } catch {
      this.setStatus("Clipboard access blocked by browser.", { warn: true });
    }
  }

  readPrefsFromUI() {
    this.prefs = {
      nocookie: !!this.els.nocookie.checked,
      autoplay: !!this.els.autoplay.checked,
      controls: !!this.els.controls.checked,
      mute: !!this.els.mute.checked,
      openInBrowserApp: !!this.els.openInBrowser.checked
    };
    this.savePrefs();
  }

  async loadFromInput({ overrideStartSeconds = null } = {}) {
    this.readPrefsFromUI();
    const parsed = parseYouTubeInput(this.els.input.value);
    if (!parsed.kind || (!parsed.videoId && !parsed.playlistId)) {
      this.setStatus("Invalid YouTube URL or id.", { warn: true });
      return;
    }

    const endSeconds = parseTimeToSeconds(this.els.endInput.value || "") || 0;
    const loop = !!this.els.loop.checked;

    const embedUrl = buildEmbedUrl({
      ...parsed,
      startSeconds: overrideStartSeconds !== null ? overrideStartSeconds : parsed.startSeconds,
      endSeconds,
      loop,
      autoplay: this.prefs.autoplay,
      controls: this.prefs.controls,
      mute: this.prefs.mute,
      nocookie: this.prefs.nocookie
    });
    if (!embedUrl) {
      this.setStatus("Could not build embed URL.", { warn: true });
      return;
    }

    this.els.iframe.src = embedUrl;
    this.els.iframe.dataset.kind = parsed.kind;
    this.els.iframe.dataset.videoId = parsed.videoId || "";
    this.els.iframe.dataset.playlistId = parsed.playlistId || "";
    this.els.iframe.dataset.startSeconds = String(
      (overrideStartSeconds !== null ? overrideStartSeconds : parsed.startSeconds) || 0
    );
    this.els.iframe.dataset.endSeconds = String(endSeconds || 0);
    this.els.iframe.dataset.loop = loop ? "1" : "0";

    const label = parsed.kind === "playlist" ? `Playlist: ${parsed.playlistId}` : `Video: ${parsed.videoId}`;
    const startLabel = (overrideStartSeconds !== null ? overrideStartSeconds : parsed.startSeconds) || 0;
    this.setStatus(`${label}${startLabel ? ` @ ${startLabel}s` : ""}`);
    this.pushRecent({
      kind: parsed.kind,
      videoId: parsed.videoId || null,
      playlistId: parsed.playlistId || null,
      startSeconds: startLabel
    });

    await this.updateOembedPreview({ kind: parsed.kind, videoId: parsed.videoId, playlistId: parsed.playlistId });
    this.syncPinButton();
  }

  clearEmbed() {
    if (this.els?.iframe) this.els.iframe.removeAttribute("src");
    this.setStatus("");
  }

  currentParsedFromIframe() {
    if (!this.els?.iframe) return null;
    const kind = this.els.iframe.dataset.kind || null;
    const videoId = this.els.iframe.dataset.videoId || null;
    const playlistId = this.els.iframe.dataset.playlistId || null;
    const startSeconds = clampInt(this.els.iframe.dataset.startSeconds || 0, 0, 24 * 60 * 60);
    const endSeconds = clampInt(this.els.iframe.dataset.endSeconds || 0, 0, 24 * 60 * 60);
    const loop = this.els.iframe.dataset.loop === "1";
    if (!kind) return null;
    return { kind, videoId: videoId || null, playlistId: playlistId || null, startSeconds, endSeconds, loop };
  }

  async copyEmbedUrl() {
    const parsed = this.currentParsedFromIframe();
    if (!parsed) {
      this.setStatus("Nothing to copy.", { warn: true });
      return;
    }
    const embedUrl = buildEmbedUrl({
      ...parsed,
      autoplay: this.prefs.autoplay,
      controls: this.prefs.controls,
      mute: this.prefs.mute,
      nocookie: this.prefs.nocookie
    });
    if (!embedUrl) return;
    try {
      await navigator.clipboard.writeText(embedUrl);
      this.setStatus("Embed URL copied.");
    } catch {
      this.setStatus("Failed to copy (clipboard blocked).", { warn: true });
    }
  }

  openOnYouTube() {
    const parsed = this.currentParsedFromIframe();
    if (!parsed) return;
    const watchUrl = buildWatchUrl(parsed);
    if (!watchUrl) return;
    if (this.prefs.openInBrowserApp && this.browserApp?.open) {
      this.browserApp.open("Yuki Browser", watchUrl);
    } else {
      window.open(watchUrl, "blank", "noopener,noreferrer");
    }
  }

  renderLists() {
    if (!this.els?.list) return;
    const root = this.els.list;
    root.innerHTML = "";

    const src = this.activeTab === "fav" ? this.favorites : this.recent;
    const items = [...src].slice(-30).reverse();
    if (items.length === 0) {
      const empty = createElement("div");
      empty.className = "meta";
      empty.textContent = this.activeTab === "fav" ? "Nothing pinned yet" : "Nothing recent yet";
      root.appendChild(empty);
      return;
    }

    items.forEach((item) => {
      const el = createElement("div");
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
          if (this.activeTab === "fav") {
            this.favorites = this.favorites.filter((x) => x.key !== item.key);
            this.saveFavorites();
          } else {
            this.recent = this.recent.filter((x) => x.key !== item.key);
            this.saveRecent();
          }
          this.renderLists();
          return;
        }

        const watchUrl =
          item.kind === "playlist" && item.playlistId ? `https://www.youtube.com/playlist?list=${item.playlistId}` : "";
        this.els.input.value = watchUrl || `https://www.youtube.com/watch?v=${item.videoId || ""}`;
        if (item.startSeconds) {
          try {
            const u = new URL(this.els.input.value);
            u.searchParams.set("t", `${item.startSeconds}s`);
            if (item.playlistId) u.searchParams.set("list", item.playlistId);
            this.els.input.value = u.href;
          } catch {}
        }
        this.loadFromInput();
      });

      root.appendChild(el);
    });
  }

  setActiveTab(tab) {
    this.activeTab = tab === "fav" ? "fav" : "recent";
    this.els.tabRecent.classList.toggle("yt-tab-active", this.activeTab === "recent");
    this.els.tabFav.classList.toggle("yt-tab-active", this.activeTab === "fav");
    this.renderLists();
  }

  isPinned(parsed) {
    if (!parsed?.kind) return false;
    const key = `${parsed.kind}:${parsed.videoId || ""}:${parsed.playlistId || ""}:${parsed.startSeconds || 0}`;
    return this.favorites.some((x) => x.key === key);
  }

  syncPinButton() {
    const parsed = this.currentParsedFromIframe();
    if (!parsed) return;
    const pinned = this.isPinned(parsed);
    this.els.pinBtn.textContent = pinned ? "Pinned" : "Pin";
    this.els.pinBtn.classList.toggle("yt-pin-active", pinned);
  }

  togglePin() {
    const parsed = this.currentParsedFromIframe();
    if (!parsed) return;
    const key = `${parsed.kind}:${parsed.videoId || ""}:${parsed.playlistId || ""}:${parsed.startSeconds || 0}`;
    const existing = this.favorites.find((x) => x.key === key);
    if (existing) {
      this.favorites = this.favorites.filter((x) => x.key !== key);
    } else {
      this.favorites.push({ ...parsed, key, time: Date.now() });
    }
    this.saveFavorites();
    this.syncPinButton();
    this.renderLists();
  }

  async updateOembedPreview({ kind, videoId, playlistId }) {
    const watchUrl = buildWatchUrl({ kind, videoId, playlistId, startSeconds: 0 });
    if (!watchUrl) {
      this.els.preview.style.display = "none";
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

      this.els.previewTitle.textContent = title;
      this.els.previewSub.textContent = author;
      if (thumb) this.els.previewImg.src = thumb;
      this.els.preview.style.display = "";
    } catch {
      this.els.preview.style.display = "none";
    }
  }

  async copyWatchUrlAtTime() {
    const parsed = this.currentParsedFromIframe();
    if (!parsed) {
      this.setStatus("Nothing loaded.", { warn: true });
      return;
    }
    const t = parseTimeToSeconds(this.els.timeInput.value || "");
    const watchUrl = buildWatchUrl({ ...parsed, startSeconds: t });
    if (!watchUrl) return;
    try {
      await navigator.clipboard.writeText(watchUrl);
      this.setStatus("Watch link copied.");
    } catch {
      this.setStatus("Failed to copy (clipboard blocked).", { warn: true });
    }
  }

  jumpToTime() {
    const parsed = this.currentParsedFromIframe();
    if (!parsed) return;
    const t = parseTimeToSeconds(this.els.timeInput.value || "");
    this.loadFromInput({ overrideStartSeconds: t });
  }

  savePresetFromUI() {
    this.preset = {
      endSeconds: parseTimeToSeconds(this.els.endInput.value || "") || 0,
      loop: !!this.els.loop.checked
    };
    this.savePreset();
    this.setStatus("Preset saved.");
  }

  resetPreset() {
    this.preset = { endSeconds: 0, loop: false };
    this.savePreset();
    this.els.endInput.value = "";
    this.els.loop.checked = false;
    this.setStatus("Preset reset.");
  }

  async exportAll() {
    const payload = {
      v: 1,
      prefs: this.prefs,
      preset: this.preset,
      recent: this.recent,
      favorites: this.favorites
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload));
      this.setStatus("Export JSON copied.");
    } catch {
      this.setStatus("Failed to copy export.", { warn: true });
    }
  }

  async importAll() {
    const text = await os.dialog.prompt("Prompt", "Paste YouTube Utilities JSON export:");
    if (!text) return;
    const data = safeJsonParse(text, null);
    if (!data || typeof data !== "object") {
      this.setStatus("Invalid JSON.", { warn: true });
      return;
    }
    if (data.prefs) {
      this.prefs = { ...this.prefs, ...data.prefs };
      this.savePrefs();
    }
    if (data.preset) {
      this.preset = { ...this.preset, ...data.preset };
      this.savePreset();
    }
    if (Array.isArray(data.recent)) {
      this.recent = data.recent.slice(-30);
      this.saveRecent();
    }
    if (Array.isArray(data.favorites)) {
      this.favorites = data.favorites.slice(-100);
      this.saveFavorites();
    }
    this.els.nocookie.checked = !!this.prefs.nocookie;
    this.els.autoplay.checked = !!this.prefs.autoplay;
    this.els.controls.checked = !!this.prefs.controls;
    this.els.mute.checked = !!this.prefs.mute;
    this.els.openInBrowser.checked = !!this.prefs.openInBrowserApp;
    this.els.loop.checked = !!this.preset.loop;
    this.els.endInput.value = this.preset.endSeconds ? String(this.preset.endSeconds) : "";
    this.renderLists();
    this.setStatus("Imported.");
  }

  async createDesktopEntry() {
    const parsed = this.currentParsedFromIframe();
    if (!parsed) {
      this.setStatus("No video loaded to create desktop entry.", { warn: true });
      return;
    }

    const name = await os.dialog.prompt(
      "Prompt",
      "Enter name for desktop entry:",
      parsed.kind === "playlist" ? "YouTube Playlist" : "YouTube Video"
    );
    if (!name) return;

    const desktopEntry = {
      type: "youtube-embed",
      name: name,
      videoId: parsed.videoId || null,
      playlistId: parsed.playlistId || null,
      kind: parsed.kind,
      startSeconds: parsed.startSeconds || 0,
      endSeconds: parsed.endSeconds || 0,
      loop: parsed.loop || false,
      nocookie: this.prefs.nocookie,
      autoplay: this.prefs.autoplay,
      controls: this.prefs.controls,
      mute: this.prefs.mute
    };

    const fileName = `${name.replace(/[^a-zA-Z0-9_-]/g, "_")}.desktop`;
    const desktopDir = this.fs.resolveUserPath(["Desktop"]);
    const filePath = this.fs.join(desktopDir, fileName);

    try {
      await os.fs.write(filePath, JSON.stringify(desktopEntry, null, 2));
      await this.fs.writeMeta(desktopDir, fileName, {
        kind: "OTHER",
        icon: "static/icons/youtube.webp",
        faIcon: "fab fa-youtube"
      });
      this.setStatus(`Desktop entry "${fileName}" created.`);
      this.notify(
        "Desktop Entry Created",
        `${name} has been added to your desktop.`,
        "success",
        5000,
        "fab fa-youtube"
      );
    } catch (e) {
      console.error("Failed to create desktop entry:", e);
      this.setStatus("Failed to create desktop entry.", { warn: true });
    }
  }

  bindEvents() {
    this.els.loadBtn.addEventListener("click", () => this.loadFromInput());
    this.els.pasteBtn.addEventListener("click", () => this.pasteFromClipboard());
    this.els.clearBtn.addEventListener("click", () => this.clearEmbed());
    this.els.copyEmbedBtn.addEventListener("click", () => this.copyEmbedUrl());
    this.els.openYtBtn.addEventListener("click", () => this.openOnYouTube());
    this.els.pinBtn.addEventListener("click", () => this.togglePin());

    this.els.tabRecent.addEventListener("click", () => this.setActiveTab("recent"));
    this.els.tabFav.addEventListener("click", () => this.setActiveTab("fav"));
    this.setActiveTab("recent");

    this.els.exportBtn.addEventListener("click", () => this.exportAll());
    this.els.importBtn.addEventListener("click", () => this.importAll());
    this.els.clearListBtn.addEventListener("click", () => {
      if (this.activeTab === "fav") {
        this.favorites = [];
        this.saveFavorites();
      } else {
        this.recent = [];
        this.saveRecent();
      }
      this.renderLists();
    });

    this.els.copyTimeBtn.addEventListener("click", () => this.copyWatchUrlAtTime());
    this.els.jumpTimeBtn.addEventListener("click", () => this.jumpToTime());
    this.els.savePreset.addEventListener("click", () => this.savePresetFromUI());
    this.els.resetPreset.addEventListener("click", () => this.resetPreset());

    const persistToggles = () => this.readPrefsFromUI();
    this.els.nocookie.addEventListener("change", persistToggles);
    this.els.autoplay.addEventListener("change", persistToggles);
    this.els.controls.addEventListener("change", persistToggles);
    this.els.mute.addEventListener("change", persistToggles);
    this.els.openInBrowser.addEventListener("change", persistToggles);

    this.els.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.loadFromInput();
    });
  }
}
