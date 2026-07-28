import { WidgetBase } from "../widgetManager.js";
import { $$ } from "../../shared/domUtils.js";
import { audioMixer } from "../../audioMixer.js";

export class MusicControlWidget extends WidgetBase {
  constructor(manager, id) {
    super(manager, id, "musiccontrol", "Music Control", 260, 240);
    this.interval = null;
    this.activeWinId = null;
    this.muteEl = null;
  }

  onRender(contentEl) {
    contentEl.innerHTML = `
      <div class="widget-music-channel-selector" id="w-music-channels-${this.id}"></div>
      <div class="widget-music-nowplaying-label" id="w-music-np-label-${this.id}">Now Playing</div>
      <div class="widget-music-top">
        <div class="widget-music-cover" id="w-music-cover-${this.id}">
          <img id="w-music-cover-img-${this.id}" src="" alt="" style="display:none;width:100%;height:100%;object-fit:cover;">
          <div class="widget-music-cover-fallback" id="w-music-cover-fallback-${this.id}">
            <i class="fas fa-music"></i>
          </div>
        </div>
        <div class="widget-music-info" id="w-music-info-${this.id}">
          <span class="widget-music-track">No audio playing</span>
          <span class="widget-music-artist"></span>
        </div>
      </div>
      <div class="widget-music-controls">
        <button class="widget-music-btn" id="w-music-prev-${this.id}" title="Previous">
          <i class="fas fa-step-backward"></i>
        </button>
        <button class="widget-music-btn widget-music-play" id="w-music-play-${this.id}" title="Play/Pause">
          <i class="fas fa-play"></i>
        </button>
        <button class="widget-music-btn" id="w-music-next-${this.id}" title="Next">
          <i class="fas fa-step-forward"></i>
        </button>
      </div>
      <div class="widget-music-volume">
        <button class="widget-music-btn" id="w-music-mute-${this.id}" title="Mute/Unmute" style="width:20px;height:20px;font-size:12px;">
          <i class="fas fa-volume-up"></i>
        </button>
        <input type="range" class="widget-music-slider" id="w-music-vol-${this.id}" min="0" max="100" value="100">
        <span class="widget-music-vol-pct" id="w-music-vol-pct-${this.id}" style="font-size:10px;color:var(--text-secondary);min-width:28px;text-align:right;">100%</span>
      </div>
    `;

    this.muteEl = contentEl.querySelector(`#w-music-mute-${this.id}`);

    contentEl.querySelector(`#w-music-play-${this.id}`).addEventListener("click", () => {
      this.togglePlay();
    });

    contentEl.querySelector(`#w-music-prev-${this.id}`).addEventListener("click", () => {
      this.sendCmd("previoustrack");
    });

    contentEl.querySelector(`#w-music-next-${this.id}`).addEventListener("click", () => {
      this.sendCmd("nexttrack");
    });

    contentEl.querySelector(`#w-music-vol-${this.id}`).addEventListener("input", (e) => {
      const vol = parseInt(e.target.value);
      if (this.activeWinId) {
        audioMixer().setChannel(this.activeWinId, vol / 100);
      } else {
        audioMixer().setMaster(vol / 100);
      }
    });

    this.muteEl.addEventListener("click", () => {
      const mixer = audioMixer();
      if (this.activeWinId) {
        const ch = mixer.channels.get(this.activeWinId);
        if (!ch) return;
        const newVol = ch.volume > 0 ? 0 : this.savedVolume || 1;
        this.savedVolume = ch.volume > 0 ? ch.volume : this.savedVolume;
        mixer.setChannel(this.activeWinId, newVol);
      } else {
        mixer.setMaster(mixer.masterVolume > 0 ? 0 : 1);
      }
    });

    this.update();
    this.interval = setInterval(() => this.update(), 600);
  }

  getActiveChannel() {
    const mixer = audioMixer();
    if (this.activeWinId && mixer.channels.has(this.activeWinId)) {
      return { winId: this.activeWinId, ch: mixer.channels.get(this.activeWinId) };
    }
    if (mixer.channels.size > 0) {
      for (const [winId, ch] of mixer.channels) {
        const np = ch.nowPlaying;
        if (np && np.playbackState === "playing") {
          this.activeWinId = winId;
          return { winId, ch };
        }
      }
      const first = Array.from(mixer.channels.entries())[0];
      if (first) {
        this.activeWinId = first[0];
        return { winId: first[0], ch: first[1] };
      }
    }
    this.activeWinId = null;
    return null;
  }

  sendCmd(cmd) {
    const active = this.getActiveChannel();
    if (active && active.ch.sendCommand) {
      active.ch.sendCommand(cmd);
    }
  }

  togglePlay() {
    const active = this.getActiveChannel();
    if (active && active.ch.sendCommand) {
      const np = active.ch.nowPlaying;
      const isPlaying = np && np.playbackState === "playing";
      active.ch.sendCommand(isPlaying ? "pause" : "play");

      const els = $$(".window audio, .window video");
      for (const el of els) {
        if (el.paused) {
          el.play().catch(() => {});
        } else {
          el.pause();
        }
      }
    }
  }

  update() {
    const mixer = audioMixer();
    const channelsEl = document.getElementById(`w-music-channels-${this.id}`);
    const npLabel = document.getElementById(`w-music-np-label-${this.id}`);
    const playBtn = document.getElementById(`w-music-play-${this.id}`);
    const volSlider = document.getElementById(`w-music-vol-${this.id}`);
    const volPct = document.getElementById(`w-music-vol-pct-${this.id}`);
    const coverImg = document.getElementById(`w-music-cover-img-${this.id}`);
    const coverFallback = document.getElementById(`w-music-cover-fallback-${this.id}`);
    const infoEl = document.getElementById(`w-music-info-${this.id}`);

    const active = this.getActiveChannel();

    if (channelsEl) {
      channelsEl.innerHTML = "";
      if (mixer.channels.size > 0) {
        mixer.channels.forEach((ch, winId) => {
          const btn = document.createElement("button");
          btn.className = "widget-music-channel-btn";
          if (winId === this.activeWinId) btn.classList.add("active");
          if (ch.nowPlaying && ch.nowPlaying.playbackState === "playing") btn.classList.add("playing");
          btn.textContent = ch.title || "App";
          btn.title = ch.title;
          btn.addEventListener("click", () => {
            this.activeWinId = winId;
          });
          channelsEl.appendChild(btn);
        });
      }
    }

    if (playBtn) {
      const icon = playBtn.querySelector("i");
      const isPlaying = active && active.ch.nowPlaying && active.ch.nowPlaying.playbackState === "playing";
      if (icon) icon.className = isPlaying ? "fas fa-pause" : "fas fa-play";
      playBtn.classList.toggle("is-playing", !!isPlaying);
    }

    if (volSlider) {
      let vol;
      if (active) {
        vol = Math.round(active.ch.volume * 100);
      } else {
        vol = Math.round(mixer.masterVolume * 100);
      }
      volSlider.value = vol;
      if (volPct) volPct.textContent = `${vol}%`;
    }

    if (infoEl) {
      const trackEl = infoEl.querySelector(".widget-music-track");
      const artistEl = infoEl.querySelector(".widget-music-artist");
      if (active && active.ch.nowPlaying) {
        const np = active.ch.nowPlaying;
        trackEl.textContent = np.track || active.ch.title || "Audio";
        artistEl.textContent = np.artist || "";
        if (npLabel) npLabel.style.display = "block";
      } else if (active) {
        trackEl.textContent = active.ch.title || "Audio";
        artistEl.textContent = "";
        if (npLabel) npLabel.style.display = "none";
      } else {
        trackEl.textContent = "No audio playing";
        artistEl.textContent = "";
        if (npLabel) npLabel.style.display = "none";
      }
    }

    if (coverImg && coverFallback) {
      const artwork = active && active.ch.nowPlaying ? active.ch.nowPlaying.artwork : "";
      if (artwork) {
        coverImg.src = artwork;
        coverImg.style.display = "block";
        coverFallback.style.display = "none";
      } else {
        coverImg.style.display = "none";
        coverFallback.style.display = "flex";
      }
    }

    if (this.muteEl) {
      const icon = this.muteEl.querySelector("i");
      const isMuted = active && active.ch.volume === 0;
      if (icon)
        icon.className = isMuted ? "fas fa-volume-off" : mixer.muted ? "fas fa-volume-xmark" : "fas fa-volume-up";
      this.muteEl.title = isMuted ? "Unmute" : "Mute";
    }
  }

  destroy() {
    if (this.interval) clearInterval(this.interval);
    super.destroy();
  }
}
