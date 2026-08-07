import { $, $$, createElement, setStyle, setText, setHTML } from "./shared/domUtils.js";
import { os, MODES } from "./framework.js";
import { audioMixer } from "./audioMixer.js";
import { isTaskbarTop } from "./utils/utils.js";
import { getTrayPosition } from "./tray/tray.js";
import { BusEvents } from "./core/EventBus.js";
import "./styles/mediaPlayer.css";

const TRAY_WIN_ID = "media-player-tray";
const PANEL_ID = "media-player-panel";
const SPEED_OPTIONS = [0.5, 1, 1.25, 1.5, 2];

const formatTime = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const s = total % 60;
  const m = Math.floor((total / 60) % 60);
  const h = Math.floor(total / 3600);
  const ss = s < 10 ? `0${s}` : String(s);
  if (h > 0) return `${h}:${m < 10 ? "0" : ""}${m}:${ss}`;
  return `${m}:${ss}`;
};

const qualityLabel = (video) => {
  if (!video || !video.videoWidth) return null;
  const w = video.videoWidth;
  if (w >= 3840) return "4K";
  if (w >= 2560) return "1440p";
  if (w >= 1920) return "1080p";
  if (w >= 1280) return "720p";
  return null;
};

const captureFrame = (video) => {
  try {
    if (!video.videoWidth || !video.videoHeight) return "";
    const canvas = createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.6);
  } catch {
    return "";
  }
};

class MediaPlayerTray {
  constructor() {
    this.mediaSources = new Map();
    this.metadataSources = new Map();
    this.artworkCache = new WeakMap();
    this.panel = null;
    this.isOpen = false;
    this.pinned = false;
    this.justOpened = false;
    this.trayActive = false;
    this.interval = null;
    this.activeType = null;
    this.activeId = null;
    this.mediaPlayHandler = null;
    this.mediaPauseHandler = null;
    this.mediaTimeHandler = null;
    this.mediaEndedHandler = null;
    this.mediaDurationHandler = null;
    this.windowClosedHandler = null;
    this.clickOutsideHandler = null;
  }

  init() {
    this.createPanel();
    this.attachListeners();
    this.interval = setInterval(() => this.reconcile(), 1000);
  }

  attachListeners() {
    this.mediaPlayHandler = (e) => {
      const el = e.target;
      if (!(el instanceof HTMLMediaElement)) return;
      this.handlePlay(el);
    };
    this.mediaPauseHandler = (e) => {
      if (e.target instanceof HTMLMediaElement) this.updatePlayState();
    };
    this.mediaTimeHandler = (e) => {
      if (e.target instanceof HTMLMediaElement && this.isOpen) this.updateProgress();
    };
    this.mediaEndedHandler = () => this.updatePlayState();
    this.mediaDurationHandler = () => {
      if (this.isOpen) this.updateProgress();
    };

    const handlers = {
      play: this.mediaPlayHandler,
      pause: this.mediaPauseHandler,
      timeupdate: this.mediaTimeHandler,
      loadedmetadata: this.mediaTimeHandler,
      durationchange: this.mediaTimeHandler,
      ended: this.mediaEndedHandler
    };
    for (const evt of Object.keys(handlers)) {
      document.addEventListener(evt, handlers[evt], true);
    }

    this.windowClosedHandler = ({ winId }) => {
      if (this.mediaSources.delete(winId)) {
        if (this.activeType === "element" && this.activeId === winId) {
          this.activeType = null;
          this.activeId = null;
        }
        this.refreshTray();
      }
      if (this.metadataSources.delete(winId)) {
        if (this.activeType === "metadata" && this.activeId === winId) {
          this.activeType = null;
          this.activeId = null;
        }
        this.refreshTray();
      }
    };
    os.events.on(BusEvents.WINDOW_CLOSED, this.windowClosedHandler);

    this.clickOutsideHandler = (e) => {
      if (this.justOpened || this.pinned) return;
      if (this.isOpen && this.panel && !this.panel.contains(e.target)) {
        const btn = $(`[data-win-id="${TRAY_WIN_ID}"]`);
        if (!btn || !btn.contains(e.target)) this.close();
      }
    };
    document.addEventListener("click", this.clickOutsideHandler);
  }

  destroy() {
    const handlers = {
      play: this.mediaPlayHandler,
      pause: this.mediaPauseHandler,
      timeupdate: this.mediaTimeHandler,
      loadedmetadata: this.mediaTimeHandler,
      durationchange: this.mediaTimeHandler,
      ended: this.mediaEndedHandler
    };
    for (const evt of Object.keys(handlers)) {
      document.removeEventListener(evt, handlers[evt], true);
    }
    if (this.windowClosedHandler) os.events.off(BusEvents.WINDOW_CLOSED, this.windowClosedHandler);
    if (this.clickOutsideHandler) document.removeEventListener("click", this.clickOutsideHandler);
    if (this.interval) clearInterval(this.interval);
    this.unregisterTray();
    if (this.panel) this.panel.remove();
  }

  handlePlay(el) {
    const win = el.closest(".window");
    if (!win) return;
    const winId = win.id || el.parentElement?.closest(".window")?.id;
    if (!winId) return;
    this.mediaSources.set(winId, { element: el, winId });
    this.activeType = "element";
    this.activeId = winId;
    this.refreshTray();
    if (this.isOpen) this.reactivate();
  }

  getSubtitle(win) {
    const appId = win.dataset?.appId;
    if (appId) {
      try {
        const info = os.app.getAppInfo(appId);
        if (info && info.title) return info.title;
      } catch {
        void 0;
      }
    }
    return "Media Viewer";
  }

  getArtwork(el) {
    if (this.artworkCache.has(el)) return this.artworkCache.get(el);
    let artwork = el.poster || "";
    if (!artwork && el.tagName === "VIDEO") {
      artwork = captureFrame(el);
    }
    this.artworkCache.set(el, artwork);
    return artwork;
  }

  reconcile() {
    const live = new Set();
    try {
      audioMixer().channels.forEach((ch, winId) => {
        if (ch.nowPlaying && ch.nowPlaying.playbackState && ch.nowPlaying.playbackState !== "none") {
          live.add(winId);
          if (!this.metadataSources.has(winId)) {
            this.metadataSources.set(winId, ch);
            this.activeType = "metadata";
            this.activeId = winId;
          }
        }
      });
    } catch {
      live.clear();
    }

    let changed = false;
    for (const winId of [...this.metadataSources.keys()]) {
      if (!live.has(winId)) {
        this.metadataSources.delete(winId);
        if (this.activeType === "metadata" && this.activeId === winId) {
          this.activeType = null;
          this.activeId = null;
        }
        changed = true;
      }
    }

    for (const [winId, src] of [...this.mediaSources]) {
      if (!document.contains(src.element)) {
        this.mediaSources.delete(winId);
        if (this.activeType === "element" && this.activeId === winId) {
          this.activeType = null;
          this.activeId = null;
        }
        changed = true;
      }
    }

    if (changed || live.size > 0) {
      this.refreshTray();
      if (this.isOpen) this.reactivate();
    }
  }

  getActiveSource() {
    if (this.activeType === "element" && this.activeId) {
      const s = this.mediaSources.get(this.activeId);
      if (s) return { type: "element", winId: this.activeId, element: s.element };
    }
    if (this.activeType === "metadata" && this.activeId) {
      const ch = this.metadataSources.get(this.activeId);
      if (ch) return { type: "metadata", winId: this.activeId, channel: ch };
    }
    const elEntry = this.mediaSources.entries().next().value;
    if (elEntry) {
      this.activeType = "element";
      this.activeId = elEntry[0];
      return { type: "element", winId: elEntry[0], element: elEntry[1].element };
    }
    const metaEntry = this.metadataSources.entries().next().value;
    if (metaEntry) {
      this.activeType = "metadata";
      this.activeId = metaEntry[0];
      return { type: "metadata", winId: metaEntry[0], channel: metaEntry[1] };
    }
    return null;
  }

  refreshTray() {
    const has = this.mediaSources.size > 0 || this.metadataSources.size > 0;
    if (has && !this.trayActive) {
      this.registerTray();
      this.trayActive = true;
    } else if (!has && this.trayActive) {
      this.unregisterTray();
      this.trayActive = false;
      if (this.isOpen) this.close();
    }
  }

  registerTray() {
    os.tray.register(TRAY_WIN_ID, "fa-solid fa-circle-play", "Media Player", {
      resident: true,
      showInTray: true,
      priority: 70,
      onClick: () => this.toggle()
    });
  }

  unregisterTray() {
    if (os.tray.isRegistered(TRAY_WIN_ID)) {
      os.tray.unregister(TRAY_WIN_ID);
    }
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  createPanel() {
    this.panel = createElement("div");
    this.panel.id = PANEL_ID;
    this.panel.style.display = "none";
    this.panel.innerHTML = `
      <div class="mp-header">
        <button class="mp-icon-btn mp-collapse" title="Close">
          <i class="fas fa-chevron-left"></i>
        </button>
        <span class="mp-title"><i class="fas fa-circle-play"></i><span>Media Player</span></span>
        <button class="mp-icon-btn mp-pin" title="Pin">
          <i class="fas fa-thumbtack"></i>
        </button>
      </div>
      <div class="mp-artwork">
        <img class="mp-artwork-img" alt="">
        <div class="mp-artwork-fallback"><i class="fas fa-music"></i></div>
        <span class="mp-quality-badge"></span>
        <span class="mp-source-badge"></span>
      </div>
      <div class="mp-meta">
        <div class="mp-track"></div>
        <div class="mp-subtitle"></div>
      </div>
      <div class="mp-progress">
        <span class="mp-time mp-elapsed">0:00</span>
        <div class="mp-seek-wrap">
          <div class="mp-seek-fill"></div>
          <input type="range" class="mp-seek" min="0" max="1000" value="0">
        </div>
        <span class="mp-time mp-remaining">0:00</span>
        <button class="mp-icon-btn mp-speed-btn" title="Playback speed">1x</button>
      </div>
      <div class="mp-controls">
        <button class="mp-ctl mp-shuffle" title="Shuffle"><i class="fas fa-shuffle"></i></button>
        <button class="mp-ctl mp-prev" title="Previous"><i class="fas fa-backward-step"></i></button>
        <button class="mp-ctl mp-play" title="Play/Pause"><i class="fas fa-play"></i></button>
        <button class="mp-ctl mp-next" title="Next"><i class="fas fa-forward-step"></i></button>
        <button class="mp-ctl mp-repeat" title="Repeat"><i class="fas fa-repeat"></i></button>
      </div>
    `;
    document.body.appendChild(this.panel);

    this.panel.querySelector(".mp-collapse").addEventListener("click", () => this.close());
    this.panel.querySelector(".mp-pin").addEventListener("click", () => this.togglePin());
    this.panel.querySelector(".mp-seek").addEventListener("input", (e) => this.handleSeek(e));
    this.panel.querySelector(".mp-shuffle").addEventListener("click", (e) => {
      e.stopPropagation();
      this.panel.querySelector(".mp-shuffle").classList.toggle("active");
    });
    this.panel.querySelector(".mp-repeat").addEventListener("click", (e) => this.toggleRepeat(e));
    this.panel.querySelector(".mp-prev").addEventListener("click", (e) => this.sendControl(e, "prev"));
    this.panel.querySelector(".mp-next").addEventListener("click", (e) => this.sendControl(e, "next"));
    this.panel.querySelector(".mp-play").addEventListener("click", (e) => this.sendControl(e, "playpause"));
    this.panel.querySelector(".mp-speed-btn").addEventListener("click", (e) => this.cycleSpeed(e));
  }

  togglePin() {
    this.pinned = !this.pinned;
    this.panel.classList.toggle("mp-pinned", this.pinned);
    this.panel.querySelector(".mp-pin").title = this.pinned ? "Unpin" : "Pin";
  }

  handleSeek(e) {
    const src = this.getActiveSource();
    if (!src || src.type !== "element" || !Number.isFinite(src.element.duration)) return;
    const pct = parseInt(e.target.value) / 1000;
    src.element.currentTime = pct * src.element.duration;
    this.updateProgress();
  }

  toggleRepeat(e) {
    e.stopPropagation();
    const src = this.getActiveSource();
    this.panel.querySelector(".mp-repeat").classList.toggle("active");
    if (src && src.type === "element") {
      src.element.loop = this.panel.querySelector(".mp-repeat").classList.contains("active");
    }
  }

  cycleSpeed(e) {
    e.stopPropagation();
    const src = this.getActiveSource();
    if (!src || src.type !== "element") return;
    const i = SPEED_OPTIONS.indexOf(src.element.playbackRate);
    const next = SPEED_OPTIONS[(i + 1) % SPEED_OPTIONS.length];
    src.element.playbackRate = next;
    setText(this.panel.querySelector(".mp-speed-btn"), `${next}x`);
    this.panel.querySelector(".mp-speed-btn").title = `Playback speed ${next}x`;
  }

  sendControl(e, kind) {
    e.stopPropagation();
    const src = this.getActiveSource();
    if (!src) return;
    if (src.type === "element") {
      const el = src.element;
      if (kind === "playpause") {
        if (el.paused) {
          el.play().catch(() => {});
        } else {
          el.pause();
        }
      } else if (kind === "prev") {
        el.currentTime = 0;
      } else if (kind === "next") {
        const winEl = el.closest(".window");
        const siblings = winEl
          ? Array.from(winEl.querySelectorAll("audio, video"))
          : [el];
        const idx = siblings.indexOf(el);
        const nextEl = siblings[(idx + 1) % siblings.length];
        if (nextEl !== el) {
          el.pause();
          nextEl.play().catch(() => {});
          this.handlePlay(nextEl);
        }
      }
      this.updatePlayState();
    } else if (src.channel && src.channel.sendCommand) {
      const cmd =
        kind === "playpause"
          ? src.channel.nowPlaying?.playbackState === "playing"
            ? "pause"
            : "play"
          : kind === "prev"
          ? "previoustrack"
          : kind === "next"
          ? "nexttrack"
          : null;
      if (cmd) src.channel.sendCommand(cmd);
    }
  }

  updatePlayState() {
    if (!this.panel) return;
    const src = this.getActiveSource();
    const playBtn = this.panel.querySelector(".mp-play");
    if (!playBtn) return;
    if (!src) {
      setHTML(playBtn, `<i class="fas fa-play"></i>`);
      playBtn.title = "Play/Pause";
      return;
    }
    if (src.type === "element") {
      const playing = !src.element.paused;
      setHTML(playBtn, `<i class="fas fa-${playing ? "pause" : "play"}"></i>`);
      playBtn.title = playing ? "Pause" : "Play";
    } else {
      const playing = src.channel.nowPlaying?.playbackState === "playing";
      setHTML(playBtn, `<i class="fas fa-${playing ? "pause" : "play"}"></i>`);
      playBtn.title = playing ? "Pause" : "Play";
    }
  }

  updateProgress() {
    if (!this.panel || !this.isOpen) return;
    const src = this.getActiveSource();
    if (!src || src.type !== "element") return;
    const el = src.element;
    const elapsedEl = this.panel.querySelector(".mp-elapsed");
    const remainingEl = this.panel.querySelector(".mp-remaining");
    const seekEl = this.panel.querySelector(".mp-seek");
    const fillEl = this.panel.querySelector(".mp-seek-fill");
    const progressEl = this.panel.querySelector(".mp-progress");
    if (!seekEl || !fillEl) return;

    const finite = Number.isFinite(el.duration) && el.duration > 0;
    setText(elapsedEl, formatTime(el.currentTime));
    if (finite) {
      setText(remainingEl, `-${formatTime(el.duration - el.currentTime)}`);
      const pct = Math.min(100, (el.currentTime / el.duration) * 100);
      seekEl.value = Math.round((el.currentTime / el.duration) * 1000);
      fillEl.style.width = `${pct}%`;
    } else {
      setText(remainingEl, "Live");
      seekEl.disabled = true;
      fillEl.style.width = "0%";
    }
    progressEl.classList.toggle("mp-live", !finite);
  }

  open() {
    if (!this.panel) return;
    const src = this.getActiveSource();
    if (!src) {
      this.close();
      return;
    }
    this.renderActive(src);
    this.isOpen = true;
    this.justOpened = true;
    setTimeout(() => (this.justOpened = false), 100);
    this.panel.classList.remove("closing");
    this.panel.classList.toggle("mp-metadata-mode", src.type === "metadata");
    this.panel.style.display = "flex";
    const btn = $(`[data-win-id="${TRAY_WIN_ID}"]`);
    if (btn) btn.classList.add("active");
    this.positionPanel();
  }

  close() {
    if (!this.panel) return;
    this.isOpen = false;
    this.panel.classList.add("closing");
    const btn = $(`[data-win-id="${TRAY_WIN_ID}"]`);
    if (btn) btn.classList.remove("active");
    this.panel.addEventListener(
      "animationend",
      () => {
        this.panel.classList.remove("closing");
        this.panel.style.display = "none";
      },
      { once: true }
    );
  }

  reactivate() {
    const src = this.getActiveSource();
    if (src && this.panel && this.isOpen) {
      this.renderActive(src);
    } else if (!src && this.panel && this.isOpen) {
      this.close();
    }
  }

  renderActive(src) {
    if (!this.panel) return;
    this.panel.classList.toggle("mp-metadata-mode", src.type === "metadata");
    const artworkImg = this.panel.querySelector(".mp-artwork-img");
    const fallback = this.panel.querySelector(".mp-artwork-fallback");
    const qualityEl = this.panel.querySelector(".mp-quality-badge");
    const sourceEl = this.panel.querySelector(".mp-source-badge");
    const trackEl = this.panel.querySelector(".mp-track");
    const subtitleEl = this.panel.querySelector(".mp-subtitle");
    const progressEl = this.panel.querySelector(".mp-progress");

    if (src.type === "metadata") {
      const np = src.channel.nowPlaying || {};
      const artwork = np.artwork || "";
      if (artwork) {
        artworkImg.src = artwork;
        artworkImg.style.display = "block";
        fallback.style.display = "none";
      } else {
        artworkImg.style.display = "none";
        fallback.style.display = "flex";
      }
      setText(trackEl, np.track || "Untitled");
      setText(subtitleEl, np.artist || "");
      setText(sourceEl, src.channel.title || "");
      sourceEl.style.display = "";
      setText(qualityEl, "");
      qualityEl.style.display = "none";
      progressEl.style.display = "none";
      this.updatePlayState();
      return;
    }

    const el = src.element;
    const win = el.closest(".window");
    const artwork = this.getArtwork(el);
    if (artwork) {
      artworkImg.src = artwork;
      artworkImg.style.display = "block";
      fallback.style.display = "none";
    } else {
      artworkImg.style.display = "none";
      fallback.style.display = "flex";
    }
    const title = win ? os.window.getTitle(win.id) : "";
    setText(trackEl, title || "Now Playing");
    setText(subtitleEl, win ? this.getSubtitle(win) : "Media");
    const quality = el.tagName === "VIDEO" ? qualityLabel(el) : null;
    if (quality) {
      setText(qualityEl, quality);
      qualityEl.style.display = "";
    } else {
      setText(qualityEl, "");
      qualityEl.style.display = "none";
    }
    const srcText = win ? this.getSubtitle(win) : "";
    if (srcText) {
      setText(sourceEl, srcText);
      sourceEl.style.display = "";
    } else {
      sourceEl.style.display = "none";
    }
    progressEl.style.display = "";
    const speedBtn = this.panel.querySelector(".mp-speed-btn");
    const rate = el.playbackRate || 1;
    setText(speedBtn, `${rate}x`);
    const repeatBtn = this.panel.querySelector(".mp-repeat");
    repeatBtn.classList.toggle("active", !!el.loop);
    this.updateProgress();
    this.updatePlayState();
  }

  positionPanel() {
    const candidates = $$(`[data-win-id="${TRAY_WIN_ID}"]`);
    const btn = Array.from(candidates).find((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    if (!this.panel) return;

    const tilingActive = os.modes.isActive(MODES.TILING);
    const chromeShelf = $("#chromeos-shelf");
    const chromeShelfVisible = chromeShelf && getComputedStyle(chromeShelf).display !== "none";
    let atTop;
    if (chromeShelfVisible && chromeShelf.dataset.shelfPos === "top") {
      atTop = true;
    } else if (tilingActive) {
      const tilingBar = $("#tiling-bar");
      atTop = tilingBar ? !tilingBar.classList.contains("position-bottom") : false;
    } else {
      atTop = isTaskbarTop();
    }

    if (btn) {
      const btnRect = btn.getBoundingClientRect();
      const panelW = 320;
      let left;
      if (chromeShelfVisible && chromeShelf.dataset.shelfPos === "left") {
        left = btnRect.right + 8;
      } else if (chromeShelfVisible && chromeShelf.dataset.shelfPos === "right") {
        left = window.innerWidth - btnRect.left - panelW;
        if (left < 8) left = 8;
      } else {
        left = btnRect.right - panelW;
        if (left < 8) left = 8;
      }
      if (atTop) {
        setStyle(this.panel, { top: `${btnRect.bottom + 6}px`, bottom: "auto" });
      } else {
        setStyle(this.panel, { bottom: `${window.innerHeight - btnRect.top + 6}px`, top: "auto" });
      }
      this.panel.style.left = `${left}px`;
    } else {
      const pos = getTrayPosition();
      setStyle(this.panel, { right: pos.right, top: pos.top, bottom: pos.bottom, left: "auto" });
    }
  }
}

let mediaTrayInstance = null;
export const mediaTray = () => {
  if (!mediaTrayInstance) mediaTrayInstance = new MediaPlayerTray();
  return mediaTrayInstance;
};