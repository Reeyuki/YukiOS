const STORAGE_KEY = "yukios_audio_mixer_v1";

class AudioMixer {
  constructor() {
    this.masterVolume = 1.0;
    this.channels = new Map();
    this.gainNodes = new Map();
    this.audioCtx = null;
    this.panel = null;
    this.trayBtn = null;
    this.isOpen = false;
    this._load();
  }

  _load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      this.masterVolume = saved.master ?? 1.0;
      this.savedChannels = saved.channels || {};
    } catch (e) {
      this.savedChannels = {};
    }
    this._muted = localStorage.getItem("yukiOS_sound_enabled") === "false";
  }

  _save() {
    const channels = {};
    this.channels.forEach((ch, winId) => {
      channels[winId] = ch.volume;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ master: this.masterVolume, channels }));
  }

  _getOrCreateAudioCtx() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  _isSameDomain(iframe) {
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      return !!doc;
    } catch (e) {
      return false;
    }
  }

  _applyVolumeToWindow(winId) {
    const ch = this.channels.get(winId);
    if (!ch) return;

    const effectiveVolume = this._muted ? 0 : this.masterVolume * ch.volume;
    const win = document.getElementById(winId);
    if (!win) return;

    const iframes = win.querySelectorAll("iframe");

    iframes.forEach((iframe) => {
      if (this._isSameDomain(iframe)) {
        try {
          if (iframe.contentWindow?.__yukioGain) {
            iframe.contentWindow.__yukioGain.gain.setTargetAtTime(
              effectiveVolume,
              iframe.contentWindow.__yukioGain.context.currentTime,
              0.01
            );
          }
          const doc = iframe.contentDocument || iframe.contentWindow.document;
          doc.querySelectorAll("audio, video").forEach((el) => {
            el.volume = Math.max(0, Math.min(1, effectiveVolume));
          });

          const rufflePlayer = iframe.contentWindow?.document?.querySelector("ruffle-player");
          if (rufflePlayer && typeof rufflePlayer.volume !== "undefined") {
            rufflePlayer.volume = effectiveVolume;
          }

          iframe.contentWindow?.postMessage({ __shittify_cmd: true, cmd: "volume", value: effectiveVolume }, "*");
        } catch (e) {}
      } else {
        this._applyGainNode(winId, iframe, effectiveVolume);
      }
    });

    win.querySelectorAll("audio, video").forEach((el) => {
      el.volume = Math.max(0, Math.min(1, effectiveVolume));
    });

    const rufflePlayer = win.querySelector("ruffle-player");
    if (rufflePlayer && typeof rufflePlayer.volume !== "undefined") {
      rufflePlayer.volume = effectiveVolume;
    }
  }

  _applyGainNode(winId, iframe, effectiveVolume) {
    const key = `${winId}::${iframe.src || iframe.srcdoc?.slice(0, 40)}`;

    if (!this.gainNodes.has(key)) {
      try {
        const ctx = this._getOrCreateAudioCtx();
        const gainNode = ctx.createGain();
        gainNode.gain.value = effectiveVolume;
        gainNode.connect(ctx.destination);

        const source = ctx.createMediaElementSource(iframe);
        source.connect(gainNode);
        this.gainNodes.set(key, gainNode);
      } catch (e) {}
    } else {
      const gainNode = this.gainNodes.get(key);
      if (gainNode) gainNode.gain.setTargetAtTime(effectiveVolume, this.audioCtx.currentTime, 0.01);
    }
  }

  _applyMasterToAll() {
    this.channels.forEach((_, winId) => this._applyVolumeToWindow(winId));
  }

  registerWindow(winId, title, iconHtml) {
    const savedVol = this.savedChannels[winId] ?? 1.0;
    this.channels.set(winId, { title, iconHtml, volume: savedVol, nowPlaying: null, _sendCommand: null });
    this._applyVolumeToWindow(winId);
    this._watchIframesInWindow(winId);
    if (this.panel) this._renderSliders();
  }

  _watchIframesInWindow(winId) {
    const win = document.getElementById(winId);
    if (!win) return;

    const applyOnLoad = (iframe) => {
      iframe.addEventListener("load", () => this._applyVolumeToWindow(winId));
    };

    win.querySelectorAll("iframe").forEach(applyOnLoad);

    if (!this._iframeObservers) this._iframeObservers = new Map();
    if (this._iframeObservers.has(winId)) this._iframeObservers.get(winId).disconnect();

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((m) => {
        m.addedNodes.forEach((node) => {
          if (node.tagName === "IFRAME") {
            applyOnLoad(node);
            this._applyVolumeToWindow(winId);
          } else if (node.querySelectorAll) {
            node.querySelectorAll("iframe").forEach((iframe) => {
              applyOnLoad(iframe);
              this._applyVolumeToWindow(winId);
            });
          }
        });
      });
    });

    observer.observe(win, { childList: true, subtree: true });
    this._iframeObservers.set(winId, observer);
  }

  updateChannelMeta(winId, nowPlaying) {
    const ch = this.channels.get(winId);
    if (!ch) return;
    ch.nowPlaying = nowPlaying;
    if (this.isOpen && this.panel) this._renderSliders();
  }

  setChannelCommandHandler(winId, fn) {
    const ch = this.channels.get(winId);
    if (ch) ch._sendCommand = fn;
  }

  unregisterWindow(winId) {
    this.channels.delete(winId);
    const keysToDelete = [];
    this.gainNodes.forEach((_, key) => {
      if (key.startsWith(winId + "::")) keysToDelete.push(key);
    });
    keysToDelete.forEach((k) => {
      const g = this.gainNodes.get(k);
      try {
        g.disconnect();
      } catch (e) {}
      this.gainNodes.delete(k);
    });
    if (this._iframeObservers?.has(winId)) {
      this._iframeObservers.get(winId).disconnect();
      this._iframeObservers.delete(winId);
    }
    this._save();
    if (this.panel) this._renderSliders();
  }

  setMaster(value) {
    this.masterVolume = value;
    this._applyMasterToAll();
    this._save();
    this._updateMasterLabel();
  }

  setChannel(winId, value) {
    const ch = this.channels.get(winId);
    if (!ch) return;
    ch.volume = value;
    this._applyVolumeToWindow(winId);
    this._save();
  }

  init() {
    this._createTrayButton();
    this._createPanel();

    document.addEventListener("click", (e) => {
      if (this.isOpen && this.panel && !this.panel.contains(e.target) && !this.trayBtn.contains(e.target)) {
        this.close();
      }
    });
    document.addEventListener("AUDIO_SETTINGS_CHANGED", (e) => {
      if (!e.detail) return;
      this._muted = e.detail.soundEnabled === false;
      this._applyMasterToAll();
      this._updateMasterLabel();
    });
  }

  _createTrayButton() {
    const tray = document.getElementById("system-tray");
    if (!tray) return;

    this.trayBtn = document.createElement("button");
    this.trayBtn.id = "audio-mixer-tray-btn";
    this.trayBtn.title = "Audio Mixer";
    this.trayBtn.innerHTML = `<i style="transform:scale(2);" class="fa-solid fa-bullhorn"></i>`;

    this.trayBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggle();
    });

    const ref = tray.querySelector("#time-container") || tray.querySelector("#clock");
    if (ref) {
      tray.insertBefore(this.trayBtn, ref);
    }
  }

  _createPanel() {
    this.panel = document.createElement("div");
    this.panel.id = "audio-mixer-panel";
    this.panel.style.display = "none";
    this.panel.innerHTML = `
      <div class="am-header">
        <span class="am-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
          Audio Mixer
        </span>
        <button class="am-close-btn" title="Close">✕</button>
      </div>
      <div class="am-master-section">
        <div class="am-channel-label">
          <span class="am-icon"><i class="fa-solid fa-bullhorn"></i></span>
          <span>Master</span>
        </div>
        <div class="am-slider-row">
          <input type="range" class="am-slider am-master-slider" min="0" max="100" step="1" value="${this._muted ? 0 : Math.round(this.masterVolume * 100)}" />
          <span class="am-vol-label" id="am-master-label">${this._muted ? 0 : Math.round(this.masterVolume * 100)}%</span>
        </div>
      </div>
      <div class="am-divider"></div>
      <div class="am-channels" id="am-channels"></div>
      <div class="am-empty" id="am-empty">No apps open</div>
    `;

    document.body.appendChild(this.panel);

    this.panel.querySelector(".am-close-btn").addEventListener("click", () => this.close());

    const masterSlider = this.panel.querySelector(".am-master-slider");
    masterSlider.addEventListener("input", (e) => {
      this.setMaster(parseInt(e.target.value) / 100);
    });

    this._renderSliders();
  }

  _updateMasterLabel() {
    const label = document.getElementById("am-master-label");
    const slider = this.panel?.querySelector(".am-master-slider");
    const displayValue = this._muted ? 0 : Math.round(this.masterVolume * 100);
    if (label) label.textContent = `${displayValue}%`;
    if (slider) slider.value = displayValue;
  }

  _renderSliders() {
    const container = document.getElementById("am-channels");
    const emptyMsg = document.getElementById("am-empty");
    if (!container) return;

    container.innerHTML = "";

    if (this.channels.size === 0) {
      if (emptyMsg) emptyMsg.style.display = "block";
      return;
    }
    if (emptyMsg) emptyMsg.style.display = "none";

    this.channels.forEach((ch, winId) => {
      const row = document.createElement("div");
      row.className = "am-channel-row";

      const pct = Math.round(ch.volume * 100);
      const np = ch.nowPlaying;
      const hasNowPlaying = np && (np.track || np.artist);
      const isPlaying = np && np.playbackState === "playing";

      const nowPlayingHtml = hasNowPlaying
        ? `
        <div class="am-now-playing" style="display:flex;align-items:center;gap:8px;padding:6px 0 4px;border-top:1px solid rgba(255,255,255,0.06);margin-top:4px;">
          ${np.artwork ? `<img src="${np.artwork}" style="width:32px;height:32px;border-radius:4px;object-fit:cover;flex-shrink:0;" />` : `<div style="width:32px;height:32px;border-radius:4px;background:rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="fas fa-music" style="opacity:0.4;font-size:13px;"></i></div>`}
          <div style="flex:1;min-width:0;">
            <div style="font-size:0.82em;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${np.track}">${np.track || "—"}</div>
            <div style="font-size:0.75em;opacity:0.55;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${np.artist}">${np.artist || ""}</div>
          </div>
          <div class="am-np-controls" style="display:flex;gap:4px;flex-shrink:0;">
            <button class="am-np-btn" data-cmd="previoustrack" title="Previous" style="background:none;border:none;color:inherit;cursor:pointer;opacity:0.7;padding:2px 4px;font-size:12px;"><i class="fas fa-backward-step"></i></button>
            <button class="am-np-btn" data-cmd="${isPlaying ? "pause" : "play"}" title="${isPlaying ? "Pause" : "Play"}" style="background:rgba(29,185,84,0.15);border:1px solid rgba(29,185,84,0.3);color:#1db954;cursor:pointer;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:10px;padding:0;"><i class="fas fa-${isPlaying ? "pause" : "play"}"></i></button>
            <button class="am-np-btn" data-cmd="nexttrack" title="Next" style="background:none;border:none;color:inherit;cursor:pointer;opacity:0.7;padding:2px 4px;font-size:12px;"><i class="fas fa-forward-step"></i></button>
          </div>
        </div>
      `
        : "";

      row.innerHTML = `
        <div class="am-channel-label">
          <span class="am-app-icon">${ch.iconHtml || "🖥"}</span>
          <span class="am-app-name" title="${ch.title}">${ch.title}</span>
        </div>
        <div class="am-slider-row">
          <input type="range" class="am-slider" min="0" max="100" step="1" value="${pct}" data-win="${winId}" />
          <span class="am-vol-label">${pct}%</span>
        </div>
        ${nowPlayingHtml}
      `;

      const slider = row.querySelector(".am-slider");
      const label = row.querySelector(".am-vol-label");

      slider.addEventListener("input", (e) => {
        const val = parseInt(e.target.value) / 100;
        label.textContent = `${e.target.value}%`;
        this.setChannel(winId, val);
      });

      row.querySelectorAll(".am-np-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const cmd = btn.dataset.cmd;
          if (ch._sendCommand) ch._sendCommand(cmd);
        });
      });

      container.appendChild(row);
    });
  }
  patchIframeAudioContext(winId, iframe) {
    const key = `${winId}::patch::${iframe.src || iframe.srcdoc?.slice(0, 40)}`;
    if (!this._patchedIframes) this._patchedIframes = new Set();
    if (this._patchedIframes.has(key)) return;

    try {
      const cw = iframe.contentWindow;
      if (!cw) return;

      const OriginalAudioContext = cw.AudioContext || cw.webkitAudioContext;
      if (!OriginalAudioContext) return;

      const self = this;
      const gainNodes = this.gainNodes;

      function PatchedAudioContext(...args) {
        const instance = new OriginalAudioContext(...args);
        const realDestination = instance.destination;

        const gainNode = instance.createGain();
        const ch = self.channels.get(winId);
        gainNode.gain.value = self._muted ? 0 : self.masterVolume * (ch?.volume ?? 1.0);
        gainNode.connect(realDestination);

        Object.defineProperty(instance, "destination", {
          get: () => gainNode,
          configurable: true
        });

        cw.__yukioGain = gainNode;
        gainNodes.set(key, gainNode);

        return instance;
      }

      PatchedAudioContext.prototype = OriginalAudioContext.prototype;
      cw.AudioContext = PatchedAudioContext;
      cw.webkitAudioContext = PatchedAudioContext;

      this._patchedIframes.add(key);
    } catch (e) {}
  }
  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    this.isOpen = true;
    this.panel.style.display = "flex";
    this.trayBtn?.classList.add("active");
    this._renderSliders();
    this._positionPanel();
  }

  close() {
    this.isOpen = false;
    this.panel.style.display = "none";
    this.trayBtn?.classList.remove("active");
  }

  _positionPanel() {
    if (!this.trayBtn || !this.panel) return;
    const btnRect = this.trayBtn.getBoundingClientRect();
    const panelW = 280;
    let left = btnRect.right - panelW;
    if (left < 8) left = 8;
    const bottom = window.innerHeight - btnRect.top + 6;
    this.panel.style.left = `${left}px`;
    this.panel.style.bottom = `${bottom}px`;
    this.panel.style.top = "auto";
  }

  getIconHtmlForTaskbar(win, iconValue) {
    if (!iconValue) return "🖥";
    const isImg =
      /\.(png|jpg|jpeg|webp|gif|svg|ico)$/i.test(iconValue) ||
      iconValue.startsWith("data:") ||
      iconValue.startsWith("http");
    if (isImg)
      return `<img src="${iconValue}" style="width:14px;height:14px;border-radius:2px;vertical-align:middle;object-fit:contain;" />`;
    if (iconValue.startsWith("fa")) return `<i class="${iconValue}" style="font-size:12px;"></i>`;
    return "🖥";
  }
}

export const audioMixer = new AudioMixer();
