import { resolveGhUrl } from "./shared/assetResolver.js";
import { $, createElement } from "./shared/domUtils.js";

import { StorageKeys, os } from "./framework.js";
export const SystemAudio = Object.freeze({
  START: "static/audio/start.opus",
  SHUTDOWN: "static/audio/shutdown.opus",
  ERROR: "static/audio/error.opus",
  WARNING: "static/audio/warning.opus",
  DESKTOP_CHANGE: "static/audio/desktopchange.opus"
});

const STORAGE_KEY = StorageKeys.audioMixerV1;

class AudioMixer {
  constructor() {
    this.masterVolume = 1.0;
    this.systemVolume = 1.0;
    this.systemAudioEnabled = os.storage.get(StorageKeys.systemAudioEnabled) !== "false";
    this.channels = new Map();
    this.gainNodes = new Map();
    this.audioCtx = null;
    this.panel = null;
    this.isOpen = false;
    this.justOpened = false;
    this.load();
  }

  load() {
    try {
      const saved = os.storage.get(STORAGE_KEY) || {};
      this.masterVolume = saved.master ?? 1.0;
      this.systemVolume = saved.systemVolume ?? 1.0;
      this.savedChannels = saved.channels || {};
    } catch (e) {
      this.savedChannels = {};
    }
    const settingsSystemVolume = os.storage.get(StorageKeys.systemVolume);
    if (Number.isFinite(settingsSystemVolume)) {
      this.systemVolume = settingsSystemVolume;
    }
    this.muted = os.storage.get(StorageKeys.soundEnabled) === "false";
  }

  save() {
    const channels = {};
    this.channels.forEach((ch, winId) => {
      channels[winId] = ch.volume;
    });
    os.storage.set(STORAGE_KEY, { master: this.masterVolume, systemVolume: this.systemVolume, channels });
  }

  getOrCreateAudioCtx() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  isSameDomain(iframe) {
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      return !!doc;
    } catch (e) {
      return false;
    }
  }

  applyVolumeToWindow(winId) {
    const ch = this.channels.get(winId);
    if (!ch) return;

    const effectiveVolume = this.muted ? 0 : this.masterVolume * ch.volume;
    const win = document.getElementById(winId);
    if (!win) return;

    const iframes = win.querySelectorAll("iframe");

    iframes.forEach((iframe) => {
      if (this.isSameDomain(iframe)) {
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
            this.connectMediaElement(winId, el);
            if (el.__yukioGainNode) {
              el.__yukioGainNode.gain.setTargetAtTime(effectiveVolume, this.getOrCreateAudioCtx().currentTime, 0.01);
            }
          });

          const rufflePlayer = iframe.contentWindow?.document?.querySelector("ruffle-player");
          if (rufflePlayer && typeof rufflePlayer.volume !== "undefined") {
            rufflePlayer.volume = effectiveVolume;
          }

          iframe.contentWindow?.postMessage({ __shittify_cmd: true, cmd: "volume", value: effectiveVolume }, "*");
        } catch (e) {
          console.error("[AudioMixer]", e);
        }
      } else {
        this.applyGainNode(winId, iframe, effectiveVolume);
      }
    });

    win.querySelectorAll("audio, video").forEach((el) => {
      el.volume = Math.max(0, Math.min(1, effectiveVolume));
      this.connectMediaElement(winId, el);
      if (el.__yukioGainNode) {
        el.__yukioGainNode.gain.setTargetAtTime(effectiveVolume, this.getOrCreateAudioCtx().currentTime, 0.01);
      }
    });

    const rufflePlayer = win.querySelector("ruffle-player");
    if (rufflePlayer && typeof rufflePlayer.volume !== "undefined") {
      rufflePlayer.volume = effectiveVolume;
    }
  }

  applyGainNode(winId, iframe, effectiveVolume) {
    const key = `${winId}::${iframe.src || iframe.srcdoc?.slice(0, 40)}`;

    if (!this.gainNodes.has(key)) {
      try {
        const ctx = this.getOrCreateAudioCtx();
        const gainNode = ctx.createGain();
        gainNode.gain.value = effectiveVolume;
        gainNode.connect(ctx.destination);

        const source = ctx.createMediaElementSource(iframe);
        source.connect(gainNode);
        this.gainNodes.set(key, gainNode);
      } catch (e) {
        console.error("[AudioMixer]", e);
      }
    } else {
      const gainNode = this.gainNodes.get(key);
      if (gainNode) gainNode.gain.setTargetAtTime(effectiveVolume, this.audioCtx.currentTime, 0.01);
    }
  }

  getOrCreateAnalyser(winId) {
    if (!this.analysers) this.analysers = new Map();
    if (!this.analysers.has(winId)) {
      const ctx = this.getOrCreateAudioCtx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.0;
      this.analysers.set(winId, analyser);
      this.startIntensityLoop();
    }
    return this.analysers.get(winId);
  }

  connectMediaElement(winId, el) {
    if (el.__yukio_analyzed) return;
    el.__yukio_analyzed = true;
    try {
      const ctx = this.getOrCreateAudioCtx();
      const source = ctx.createMediaElementSource(el);
      const gain = ctx.createGain();
      el.__yukioGainNode = gain;

      const analyser = this.getOrCreateAnalyser(winId);
      source.connect(analyser);
      source.connect(gain);
      gain.connect(ctx.destination);
    } catch (e) {
      console.error("[AudioMixer]", e);
    }
  }

  startIntensityLoop() {
    if (this.intensityLoopRunning) return;
    this.intensityLoopRunning = true;

    const dataArray = new Uint8Array(256);
    if (!this.intensityValues) this.intensityValues = new Map();

    const loop = () => {
      if (this.analysers) {
        this.analysers.forEach((analyser, winId) => {
          analyser.getByteTimeDomainData(dataArray);
          let maxAmplitude = 0;
          for (let i = 0; i < dataArray.length; i++) {
            let val = Math.abs(dataArray[i] - 128);
            if (val > maxAmplitude) maxAmplitude = val;
          }

          const ch = this.channels.get(winId);
          const chVol = ch ? ch.volume : 1.0;
          let targetIntensity = (maxAmplitude / 127) * 100 * chVol;

          let currentIntensity = this.intensityValues.get(winId) || 0;
          if (targetIntensity > currentIntensity) {
            currentIntensity = currentIntensity + (targetIntensity - currentIntensity) * 0.4;
          } else {
            currentIntensity = currentIntensity + (targetIntensity - currentIntensity) * 0.05;
          }
          this.intensityValues.set(winId, currentIntensity);

          if (this.isOpen && this.panel) {
            const intensityEl = document.getElementById(`intensity-${winId}`);
            if (intensityEl) {
              intensityEl.style.width = `${currentIntensity}%`;
            }
          }
        });
      }

      this.updateTrayBars();

      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  getGlobalFrequencyData(dataArray) {
    if (!this.analysers) return false;
    let hasData = false;
    dataArray.fill(0);

    this.analysers.forEach((analyser) => {
      const binCount = analyser.frequencyBinCount;
      const tempArray = new Uint8Array(Math.min(binCount, dataArray.length));
      analyser.getByteFrequencyData(tempArray);
      for (let i = 0; i < tempArray.length; i++) {
        if (tempArray[i] > dataArray[i]) {
          dataArray[i] = tempArray[i];
          if (tempArray[i] > 0) hasData = true;
        }
      }
    });
    return hasData;
  }

  applyMasterToAll() {
    this.channels.forEach((_, winId) => this.applyVolumeToWindow(winId));
    this.updateSystemLabel();
  }

  registerWindow(winId, title, iconHtml) {
    const savedVol = this.savedChannels[winId] ?? 1.0;
    this.channels.set(winId, { title, iconHtml, volume: savedVol, nowPlaying: null, sendCommand: null });
    this.applyVolumeToWindow(winId);
    this.watchIframesInWindow(winId);
    if (this.panel) this.renderSliders();
  }

  watchIframesInWindow(winId) {
    const win = document.getElementById(winId);
    if (!win) return;

    const applyOnLoad = (iframe) => {
      iframe.addEventListener("load", () => this.applyVolumeToWindow(winId));
    };

    win.querySelectorAll("iframe").forEach(applyOnLoad);

    if (!this.iframeObservers) this.iframeObservers = new Map();
    if (this.iframeObservers.has(winId)) this.iframeObservers.get(winId).disconnect();

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((m) => {
        m.addedNodes.forEach((node) => {
          if (node.tagName === "IFRAME") {
            applyOnLoad(node);
            this.applyVolumeToWindow(winId);
          } else if (node.querySelectorAll) {
            node.querySelectorAll("iframe").forEach((iframe) => {
              applyOnLoad(iframe);
              this.applyVolumeToWindow(winId);
            });
          }
        });
      });
    });

    observer.observe(win, { childList: true, subtree: true });
    this.iframeObservers.set(winId, observer);
  }

  updateChannelMeta(winId, nowPlaying) {
    const ch = this.channels.get(winId);
    if (!ch) return;
    ch.nowPlaying = nowPlaying;
    this.applyVolumeToWindow(winId);
    if (this.isOpen && this.panel) this.renderSliders();
  }

  setChannelCommandHandler(winId, fn) {
    const ch = this.channels.get(winId);
    if (ch) ch.sendCommand = fn;
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
      } catch (e) {
        console.error("[AudioMixer]", e);
      }
      this.gainNodes.delete(k);
    });
    if (this.iframeObservers?.has(winId)) {
      this.iframeObservers.get(winId).disconnect();
      this.iframeObservers.delete(winId);
    }
    this.save();
    if (this.panel) this.renderSliders();
  }

  setMaster(value) {
    this.masterVolume = value;
    this.applyMasterToAll();
    this.save();
    this.updateMasterLabel();
    this.updateTrayBars();
  }

  setChannel(winId, value) {
    const ch = this.channels.get(winId);
    if (!ch) return;
    ch.volume = value;
    this.applyVolumeToWindow(winId);
    this.save();
  }

  init() {
    this.initTray();
    this.createPanel();
    this.startIntensityLoop();

    this.clickOutsideHandler = (e) => {
      if (this.justOpened) return;
      if (this.isOpen && this.panel && !this.panel.contains(e.target)) {
        const btn = $('[data-win-id="audio-mixer"]');
        if (!btn || !btn.contains(e.target)) {
          this.close();
        }
      }
    };
    document.addEventListener("click", this.clickOutsideHandler);

    this.settingsChangedHandler = (e) => {
      if (!e.detail) return;
      this.muted = e.detail.soundEnabled === false;
      this.applyMasterToAll();
      this.updateMasterLabel();
      this.updateSystemLabel();
      this.updateTrayBars();
    };
    document.addEventListener("AUDIO_SETTINGS_CHANGED", this.settingsChangedHandler);
  }

  destroy() {
    if (this.clickOutsideHandler) {
      document.removeEventListener("click", this.clickOutsideHandler);
      this.clickOutsideHandler = null;
    }
    if (this.settingsChangedHandler) {
      document.removeEventListener("AUDIO_SETTINGS_CHANGED", this.settingsChangedHandler);
      this.settingsChangedHandler = null;
    }
  }

  initTray() {
    os.tray.register("audio-mixer", "fa-solid fa-bullhorn", "Audio Mixer", {
      resident: true,
      showInTray: true,
      priority: 100,
      onClick: () => {
        this.toggle();
      },
      onWheel: (e) => {
        const delta = e.deltaY > 0 ? -0.05 : 0.05;
        const newVol = Math.max(0, Math.min(1, this.masterVolume + delta));
        this.setMaster(newVol);
      }
    });
    setTimeout(() => this.setupTrayIcon(), 0);
  }

  setupTrayIcon() {
    const btn = document.querySelector('[data-win-id="audio-mixer"]');
    if (!btn) return;
    btn.style.width = "auto";
    btn.style.padding = "0 4px";
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" id="tray-audio-bars" width="24" height="20" viewBox="0 0 28 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10 5 5 9H1v6h4l5 4V5Z"/>
        <path id="tray-bar-0" d="M15 7 a6 6 0 0 1 0 10" />
        <path id="tray-bar-1" d="M20 9 a8.4 8.4 0 0 1 0 14" />
      </svg>`;
  }

  updateTrayBars() {
    const svg = document.getElementById("tray-audio-bars");
    if (!svg) {
      this.setupTrayIcon();
      return;
    }

    const barX = [15, 20];
    const svgHeight = 24;
    const sizes = [
      { h: 10, r: 6, offset: 7 },
      { h: 14, r: 8.4, offset: 5 }
    ];

    const vol = this.muted ? 0 : this.masterVolume;
    const barCount = vol === 0 ? 0 : vol <= 0.5 ? 1 : 2;

    for (let i = 0; i < 2; i++) {
      const path = svg.querySelector(`#tray-bar-${i}`);
      if (!path) continue;
      if (i < barCount) {
        const { h, r, offset } = sizes[i];
        path.setAttribute("d", `M${barX[i]} ${svgHeight - h - offset} a${r} ${r} 0 0 1 0 ${h}`);
        path.setAttribute("opacity", "0.7");
      } else {
        path.setAttribute("d", `M${barX[i]} 22 v0`);
        path.setAttribute("opacity", "0.1");
      }
    }
  }

  createPanel() {
    this.panel = createElement("div");
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
          <input type="range" class="am-slider am-master-slider" min="0" max="100" step="1" value="${this.muted ? 0 : Math.round(this.masterVolume * 100)}" />
          <span class="am-vol-label" id="am-master-label">${this.muted ? 0 : Math.round(this.masterVolume * 100)}%</span>
        </div>
      </div>
      <div class="am-master-section">
        <div class="am-channel-label">
          <span class="am-icon"><i class="fa-solid fa-bell"></i></span>
          <span>System</span>
        </div>
        <div class="am-slider-row">
          <input type="range" class="am-slider am-system-slider" min="0" max="100" step="1" value="${!this.systemAudioEnabled ? 0 : Math.round(this.systemVolume * 100)}" ${!this.systemAudioEnabled ? "disabled" : ""} />
          <span class="am-vol-label" id="am-system-label">${!this.systemAudioEnabled ? 0 : Math.round(this.systemVolume * 100)}%</span>
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

    const systemSlider = this.panel.querySelector(".am-system-slider");
    systemSlider.addEventListener("input", (e) => {
      this.systemVolume = parseInt(e.target.value) / 100;
      this.updateSystemLabel();
      this.save();
    });

    this.renderSliders();
  }

  updateMasterLabel() {
    const label = document.getElementById("am-master-label");
    const slider = this.panel?.querySelector(".am-master-slider");
    const displayValue = this.muted ? 0 : Math.round(this.masterVolume * 100);
    if (label) label.textContent = `${displayValue}%`;
    if (slider) slider.value = displayValue;
  }

  updateSystemLabel() {
    const label = document.getElementById("am-system-label");
    const slider = this.panel?.querySelector(".am-system-slider");
    const displayValue = !this.systemAudioEnabled ? 0 : Math.round(this.systemVolume * 100);
    if (label) label.textContent = `${displayValue}%`;
    if (slider) {
      slider.value = displayValue;
      slider.disabled = !this.systemAudioEnabled;
    }
  }

  renderSliders() {
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
      const row = createElement("div");
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
            <div style="font-size:0.82em;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${np.track}">${np.track || "-"}</div>
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
          <div style="position:relative; flex:1; height:4px; display:flex; align-items:center; background:var(--glass); border-radius:4px;">
            <div id="intensity-${winId}" style="position:absolute; left:0; top:0; height:100%; width:0%; background:rgba(0,0,0,0.6); border-radius:4px; pointer-events:none; z-index:1;"></div>
            <input type="range" class="am-slider" style="position:absolute; left:0; top:0; width:100%; height:100%; margin:0; z-index:2; background:transparent;" min="0" max="100" step="1" value="${pct}" data-win="${winId}" />
          </div>
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
          if (ch.sendCommand) ch.sendCommand(cmd);
        });
      });

      container.appendChild(row);
    });
  }
  patchIframeAudioContext(winId, iframe) {
    const key = `${winId}::patch::${iframe.src || iframe.srcdoc?.slice(0, 40)}`;
    if (!this.patchedIframes) this.patchedIframes = new Set();
    if (this.patchedIframes.has(key)) return;

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

        const rawNode = instance.createGain();
        const gainNode = instance.createGain();
        const ch = self.channels.get(winId);
        gainNode.gain.value = self.muted ? 0 : self.masterVolume * (ch?.volume ?? 1.0);

        rawNode.connect(gainNode);
        gainNode.connect(realDestination);

        const analyser = self.getOrCreateAnalyser(winId);
        rawNode.connect(analyser);

        Object.defineProperty(instance, "destination", {
          get: () => rawNode,
          configurable: true
        });

        cw.__yukioGain = gainNode;
        gainNodes.set(key, gainNode);

        return instance;
      }

      PatchedAudioContext.prototype = OriginalAudioContext.prototype;
      cw.AudioContext = PatchedAudioContext;
      cw.webkitAudioContext = PatchedAudioContext;

      this.patchedIframes.add(key);
    } catch (e) {
      console.error("[AudioMixer]", e);
    }
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
    this.justOpened = true;
    setTimeout(() => {
      this.justOpened = false;
    }, 100);
    if (!this.panel) {
      return;
    }
    this.panel.classList.remove("closing");
    this.panel.style.display = "flex";
    const btn = document.querySelector('[data-win-id="audio-mixer"]');
    if (btn) btn.classList.add("active");
    this.renderSliders();
    this.positionPanel();
  }

  close() {
    this.isOpen = false;
    this.panel.classList.add("closing");
    const btn = document.querySelector('[data-win-id="audio-mixer"]');
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

  positionPanel() {
    const btn = document.querySelector('[data-win-id="audio-mixer"]');
    if (!this.panel) return;

    if (btn) {
      const btnRect = btn.getBoundingClientRect();
      const panelW = 280;
      let left = btnRect.right - panelW;
      if (left < 8) left = 8;
      const bottom = window.innerHeight - btnRect.top + 6;
      this.panel.style.left = `${left}px`;
      this.panel.style.bottom = `${bottom}px`;
      this.panel.style.top = "auto";
    } else {
      const trayEl = document.getElementById("app-tray");
      if (trayEl) {
        const trayRect = trayEl.getBoundingClientRect();
        this.panel.style.right = `${window.innerWidth - trayRect.right}px`;
        this.panel.style.bottom = `${window.innerHeight - trayRect.top + 8}px`;
        this.panel.style.left = "auto";
        this.panel.style.top = "auto";
      } else {
        this.panel.style.right = "16px";
        this.panel.style.bottom = "48px";
        this.panel.style.left = "auto";
        this.panel.style.top = "auto";
      }
    }
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

  playSystemSound(audioKey) {
    try {
      if (this.muted || !this.systemAudioEnabled) return;

      const soundPath = SystemAudio[audioKey] || audioKey;
      const audio = new Audio(resolveGhUrl(`https://cdn.jsdelivr.net/gh/Reeyuki/yukios@main/${soundPath}`));
      audio.volume = this.masterVolume * this.systemVolume;
      audio.play().catch(() => {});
    } catch (e) {
      console.error("[AudioMixer]", e);
    }
  }

  playCriticalWarning() {
    try {
      if (this.muted || !this.systemAudioEnabled) return;

      const audio = new Audio(resolveGhUrl(`https://cdn.jsdelivr.net/gh/Reeyuki/yukios@main/${SystemAudio.WARNING}`));
      audio.volume = this.masterVolume * this.systemVolume;
      audio.play().catch(() => {});
    } catch (e) {
      console.error("[AudioMixer]", e);
    }
  }

  safeLocalStorageSetItem(key, value) {
    try {
      os.storage.set(key, value);
      return true;
    } catch (e) {
      if (e.name === "QuotaExceededError") {
        this.playCriticalWarning();
      }
      return false;
    }
  }
}

let audioMixerInstance = null;
export const audioMixer = () => {
  if (!audioMixerInstance) {
    audioMixerInstance = new AudioMixer();
  }
  return audioMixerInstance;
};
