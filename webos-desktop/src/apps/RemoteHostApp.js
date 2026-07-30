import "../styles/RemoteHostApp.css";
import { BaseApp, os } from "../framework.js";
import "../../remote/RemoteClientCore.js";
import "../../remote/RemoteHostCore.js";
const RemoteClientCore = window.RemoteClientCore;
const RemoteHostCore = window.RemoteHostCore;

const SIGNALING_BASE = "wss://yukios-remote-signaling.liventcord-a60.workers.dev";

export class RemoteHostApp extends BaseApp {
  constructor(services) {
    super(services);
    this.openWindows = new Set();
    this.hostStreaming = false;
    this.hostRoomCode = null;
    this.hostConnState = "idle";
    this.hostStatusInterval = null;
    this.core = null;
  }

  async open(opts = {}) {
    const winId = "remote-host";
    if (this.openWindows.has(winId)) return;

    const isElectron = typeof window.electronAPI !== "undefined";

    const win = os.window.create(winId, "Yuki Remote Desktop", "860px", "620px", {
      icon: "fas fa-desktop",
      resizable: true,
      minWidth: 500,
      minHeight: 400
    });

    win.innerHTML = `
      <div class="remote-host-app">
        <div class="remote-landing" id="remoteLanding">
          <div class="landing-content">
            <div class="landing-icon"><i class="fas fa-desktop"></i></div>
            <h2>Yuki Remote Desktop</h2>
            <p class="landing-subtitle">View and control your PC from anywhere</p>

            <div class="landing-actions">
              <button class="remote-btn primary landing-cta" data-action="connect">
                <i class="fas fa-plug"></i> Connect to a Remote PC
              </button>
              <button class="remote-btn secondary landing-cta" data-action="host">
                <i class="fas fa-share"></i> Share Your Desktop
              </button>
            </div>

            <div class="landing-steps">
              <div class="landing-step">
                <div class="step-num">1</div>
                <div class="step-desc">
                  <strong>Open YukiOS on your home PC</strong>
                  <p>Click <strong>Share Desktop</strong> to generate a code.</p>
                </div>
              </div>
              <div class="landing-step">
                <div class="step-num">2</div>
                <div class="step-desc">
                  <strong>Get your room code</strong>
                  <p>Enter the 6-character code from your home PC.</p>
                </div>
              </div>
              <div class="landing-step">
                <div class="step-num">3</div>
                <div class="step-desc">
                  <strong>Control your PC</strong>
                  <p>Use your mouse and keyboard to control it remotely.</p>
                </div>
              </div>
            </div>

            <p class="landing-security">
              <i class="fas fa-lock"></i> End-to-end encrypted via WebRTC
            </p>
          </div>
        </div>

        <div class="remote-main" id="remoteMain" style="display:none">
          <div class="remote-tabs">
            <button class="remote-tab active" data-panel="connect"><i class="fas fa-plug"></i> Connect</button>
            <button class="remote-tab" data-panel="host"><i class="fas fa-share"></i> Host</button>
          </div>

          <div class="tab-panel active" id="panel-connect">
            <div class="connect-screen" id="connectScreen">
              <div class="connect-icon"><i class="fas fa-desktop"></i></div>
              <h3>Connect to Yuki Remote Desktop</h3>
              <p>Enter the 6-character code shown on the host.</p>
              <div class="code-input-group">
                <input type="text" class="code-input" id="roomInput" maxlength="6" placeholder="CODE" autocomplete="off" autocapitalize="characters">
                <button class="remote-btn primary" id="connectBtn" disabled><i class="fas fa-plug"></i> Connect</button>
              </div>
              <p class="connect-hint" id="connectHint" style="display:none"></p>
              <button class="remote-btn secondary small back-to-landing" id="backToLandingBtn" style="margin-top:12px"><i class="fas fa-arrow-left"></i> Back</button>
            </div>

            <div class="viewer-screen" id="viewerScreen" style="display:none">
              <div class="viewer-toolbar">
                <div class="viewer-status">
                  <span class="viewer-status-dot" id="statusDot"></span>
                  <span id="statusText">Connecting...</span>
                </div>
                <span class="viewer-room-badge" id="roomBadge"></span>
                <span class="viewer-audio-indicator" id="audioIndicator" title="Audio" style="display:none"><i class="fas fa-volume-up"></i></span>
                <button class="remote-btn secondary small" id="copyRoomBadgeBtn" title="Copy room code"><i class="fas fa-copy"></i></button>
                <button class="remote-btn secondary small" id="fileUploadBtn" title="Send file to host"><i class="fas fa-upload"></i></button>
                <input type="file" id="fileInput" style="display:none">
                <button class="remote-btn secondary small" id="disconnectBtn"><i class="fas fa-times"></i> Disconnect</button>
              </div>
              <div class="video-container" id="videoContainer">
                <video id="remoteVideo" autoplay playsinline></video>
                <div class="video-overlay" id="videoOverlay">
                  <div class="spinner"></div>
                  <p>Waiting for stream...</p>
                </div>
              </div>
            </div>
          </div>

          <div class="tab-panel" id="panel-host">
            <div class="host-body">
              <div class="host-section">
                <label class="host-label">Stream Quality</label>
                <select class="host-select" id="qualitySelect">
                  <option value="1080p">1080p</option>
                  <option value="720p">720p</option>
                </select>
              </div>
              <div class="host-section">
                <label class="host-label">Frame Rate</label>
                <select class="host-select" id="fpsSelect">
                  <option value="30">30 FPS</option>
                  <option value="60">60 FPS</option>
                </select>
              </div>
              <div class="host-room" id="roomCodeSection" style="display:none">
                <label class="host-label">Share this code</label>
                <div style="display:flex;align-items:center;gap:8px">
                  <div class="host-room-code" id="roomCodeDisplay"></div>
                  <button class="remote-btn secondary small" id="copyRoomBtn" title="Copy room code"><i class="fas fa-copy"></i></button>
                  <button class="remote-btn secondary small" id="regenerateRoomBtn" title="Generate a new room code"><i class="fas fa-rotate"></i></button>
                </div>
                <p class="host-hint">Enter this code on the Connect tab or at yukios.pages.dev/remote</p>
              </div>
              <div class="host-actions">
                <button class="remote-btn primary" id="shareBtn">
                  <i class="fas fa-share"></i> <span>Share Desktop</span>
                </button>
                <button class="remote-btn secondary small" id="muteBtn" style="display:none" title="Mute/unmute audio">
                  <i class="fas fa-volume-up"></i>
                </button>
                <button class="remote-btn danger" id="stopBtn" style="display:none">
                  <i class="fas fa-stop"></i> Stop Sharing
                </button>
              </div>
            </div>
            <div class="host-log" id="eventLog">
              <div class="log-entry info">Ready to share your desktop</div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.openWindows.add(winId);
    this.win = win;
    this.winId = winId;

    const landing = win.querySelector("#remoteLanding");
    const remoteMain = win.querySelector("#remoteMain");

    const showMain = (tab) => {
      landing.style.display = "none";
      remoteMain.style.display = "flex";
      if (tab) {
        const tabs = win.querySelectorAll(".remote-tab");
        tabs.forEach((t) => t.classList.remove("active"));
        const target = win.querySelector(`.remote-tab[data-panel="${tab}"]`);
        if (target) target.classList.add("active");
        win.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
        const panel = win.querySelector(`#panel-${tab}`);
        if (panel) panel.classList.add("active");
      }
    };

    const showLanding = () => {
      landing.style.display = "flex";
      remoteMain.style.display = "none";
    };

    win.querySelectorAll(".landing-cta").forEach((btn) => {
      btn.addEventListener("click", () => showMain(btn.dataset.action));
    });

    const backBtn = win.querySelector("#backToLandingBtn");
    if (backBtn) {
      backBtn.addEventListener("click", showLanding);
    }

    if (isElectron) {
      const qualitySelect = win.querySelector("#qualitySelect");
      const fpsSelect = win.querySelector("#fpsSelect");
      if (window.electronAPI.isDev) {
        if (qualitySelect) qualitySelect.value = "1080p";
        if (fpsSelect) fpsSelect.value = "60";
      }
    }
    this.bindHostEvents(win);
    this.bindTabEvents(win);
    this.bindClientEvents(win);

    win.addEventListener("remove", () => {
      this.onClose(winId);
    });
  }

  bindTabEvents(win) {
    const tabs = win.querySelectorAll(".remote-tab");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        tabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        const target = tab.dataset.panel;
        win.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
        const panel = win.querySelector(`#panel-${target}`);
        if (panel) panel.classList.add("active");
      });
    });
  }

  bindHostEvents(win) {
    const shareBtn = win.querySelector("#shareBtn");
    const stopBtn = win.querySelector("#stopBtn");
    const muteBtn = win.querySelector("#muteBtn");
    const roomCodeSection = win.querySelector("#roomCodeSection");
    const roomCodeDisplay = win.querySelector("#roomCodeDisplay");
    const eventLog = win.querySelector("#eventLog");
    const qualitySelect = win.querySelector("#qualitySelect");
    const fpsSelect = win.querySelector("#fpsSelect");
    const isElectron = typeof window.electronAPI !== "undefined";
    const electronAPI = window.electronAPI;

    const log = (msg, type = "info") => {
      const entry = document.createElement("div");
      entry.className = `log-entry ${type}`;
      entry.textContent = msg;
      eventLog.insertBefore(entry, eventLog.firstChild);
      while (eventLog.children.length > 10) {
        eventLog.removeChild(eventLog.lastChild);
      }
    };

    const updateMuteIcon = (muted) => {
      if (!muteBtn) return;
      muteBtn.innerHTML = muted ? '<i class="fas fa-volume-mute"></i>' : '<i class="fas fa-volume-up"></i>';
      muteBtn.title = muted ? "Unmute audio" : "Mute audio";
    };

    const showRoomCode = (code) => {
      this.hostRoomCode = code;
      roomCodeDisplay.textContent = code.length === 6 ? code.slice(0, 3) + "-" + code.slice(3) : code;
      roomCodeSection.style.display = "block";
      shareBtn.style.display = "none";
      stopBtn.style.display = "";
      if (muteBtn) muteBtn.style.display = "";
    };

    const cleanup = () => {
      if (this.hostStatusInterval) {
        clearInterval(this.hostStatusInterval);
        this.hostStatusInterval = null;
      }
      this.hostStreaming = false;
      this.hostRoomCode = null;
      this.hostConnState = "idle";
      shareBtn.style.display = "";
      stopBtn.style.display = "none";
      if (muteBtn) muteBtn.style.display = "none";
      roomCodeSection.style.display = "none";
      shareBtn.disabled = false;
      shareBtn.querySelector("span").textContent = "Share Desktop";
      if (this.hostCore) {
        this.hostCore.stop();
        this.hostCore = null;
      }
    };

    shareBtn.addEventListener("click", async () => {
      shareBtn.disabled = true;
      shareBtn.querySelector("span").textContent = "Starting...";

      const quality = qualitySelect.value;
      const fps = parseInt(fpsSelect.value);

      if (isElectron) {
        try {
          let useGst = false;
          try {
            useGst = await electronAPI.gstreamerAvailable();
          } catch {}
          const result = await electronAPI.startRemoteHost({ quality, fps, useGstreamer: useGst });
          if (!result.success) {
            log(`Failed to start: ${result.error || "Unknown error"}`, "error");
            shareBtn.disabled = false;
            shareBtn.querySelector("span").textContent = "Share Desktop";
            return;
          }
          log("Remote host started, waiting for room code...", "info");
        } catch (err) {
          log(`Error: ${err.message}`, "error");
          shareBtn.disabled = false;
          shareBtn.querySelector("span").textContent = "Share Desktop";
        }
      } else {
        this.hostCore = new RemoteHostCore({
          onStatus: (msg) => log(msg, "info"),
          onError: (msg) => {
            log(msg, "error");
            cleanup();
          },
          onRoomReady: (code) => {
            showRoomCode(code);
            log(`Room ready: ${code}. Waiting for viewer...`, "info");
          },
          onClientJoined: () => {
            log("Viewer connected!", "success");
          },
          onConnectionState: (state) => {
            this.hostConnState = state;
            if (state === "failed" || state === "disconnected") {
              log(`Connection state: ${state}`, "error");
            }
            if (state === "connected") {
              this.hostStreaming = true;
              log("Stream is live", "success");
            }
          },
          onAudioState: (hasAudio, enabled) => {
            if (muteBtn) {
              updateMuteIcon(!enabled);
            }
            this.hostAudioEnabled = enabled;
            if (hasAudio) {
              log(`Audio ${enabled ? "active" : "muted"}`, "info");
            }
          },
          onInput: (input) => {}
        });

        const ok = await this.hostCore.start(quality, fps);
        if (!ok) {
          shareBtn.disabled = false;
          shareBtn.querySelector("span").textContent = "Share Desktop";
        }
      }
    });

    stopBtn.addEventListener("click", async () => {
      if (isElectron) {
        try {
          await electronAPI.stopRemoteHost();
          log("Desktop sharing stopped", "info");
        } catch (err) {
          log(`Error stopping: ${err.message}`, "error");
        }
      } else if (this.hostCore) {
        this.hostCore.stop();
        this.hostCore = null;
        log("Desktop sharing stopped", "info");
      }
      cleanup();
    });

    if (muteBtn) {
      muteBtn.addEventListener("click", async () => {
        if (isElectron) {
          try {
            await electronAPI.toggleAudio();
          } catch (err) {
            log(`Audio toggle error: ${err.message}`, "error");
          }
        } else if (this.hostCore) {
          this.hostCore.toggleAudio();
          updateMuteIcon(this.hostCore.hostAudioEnabled === false);
        }
      });
    }

    if (isElectron) {
      const unsubEvent = electronAPI.onRemoteHostEvent((data) => {
        switch (data.type) {
          case "room-ready":
            showRoomCode(data.room);
            log(`Room ready: ${data.room}. Waiting for viewer...`, "info");
            break;

          case "client-joined":
            log("Viewer connected!", "success");
            break;

          case "stream-started":
            this.hostStreaming = true;
            this.hostConnState = "streaming";
            log("Stream is live", "success");
            break;

          case "client-disconnected":
            log("Viewer disconnected", "info");
            this.hostConnState = "idle";
            break;

          case "disconnected":
            log("Session ended", "info");
            cleanup();
            break;

          case "connection-state":
            this.hostConnState = data.state;
            if (data.state === "failed" || data.state === "disconnected") {
              log(`Connection state: ${data.state}`, "error");
            }
            break;

          case "audio-state":
            if (muteBtn) {
              updateMuteIcon(data.muted || false);
            }
            if (data.enabled !== undefined) {
              this.hostAudioEnabled = data.enabled;
            }
            const src = data.source || "";
            if (data.hasAudio) {
              log(`Audio ${data.muted ? "muted" : "active"} (${src})`, "info");
            } else {
              log("No audio source available", "info");
            }
            break;

          case "error":
            log(`Error: ${data.message}`, "error");
            break;
        }
      });

      win.addEventListener("remove", () => {
        if (unsubEvent) unsubEvent();
        cleanup();
      });
    } else {
      win.addEventListener("remove", () => {
        cleanup();
      });
    }
  }

  bindClientEvents(win) {
    const roomInput = win.querySelector("#roomInput");
    const connectBtn = win.querySelector("#connectBtn");
    const connectScreen = win.querySelector("#connectScreen");
    const viewerScreen = win.querySelector("#viewerScreen");
    const disconnectBtn = win.querySelector("#disconnectBtn");
    const remoteVideo = win.querySelector("#remoteVideo");
    const videoOverlay = win.querySelector("#videoOverlay");
    const statusText = win.querySelector("#statusText");
    const statusDot = win.querySelector("#statusDot");
    const roomBadge = win.querySelector("#roomBadge");
    const connectHint = win.querySelector("#connectHint");
    const audioIndicator = win.querySelector("#audioIndicator");

    if (!roomInput) return;

    const showConnect = () => {
      if (connectScreen) connectScreen.style.display = "flex";
      if (viewerScreen) viewerScreen.style.display = "none";
      if (roomInput) roomInput.value = "";
      if (connectBtn) connectBtn.disabled = true;
      if (connectHint) connectHint.style.display = "none";
    };

    const showToast = (msg) => {
      if (connectHint) {
        connectHint.textContent = msg;
        connectHint.style.display = "block";
        connectHint.className = "connect-hint error";
      }
    };

    if (this.core) {
      this.core.disconnect();
      this.core = null;
    }

    const self = this;

    this.core = new RemoteClientCore({
      videoElement: remoteVideo,
      videoContainer: win.querySelector("#videoContainer"),
      onStatus(text, connected) {
        if (statusText) statusText.textContent = text;
        if (statusDot) {
          statusDot.classList.toggle("disconnected", !connected);
        }
      },
      onError(msg) {
        showToast(msg);
        if (self.core) self.core.disconnect();
        showConnect();
      },
      onOverlay(visible) {
        if (videoOverlay) {
          videoOverlay.classList.toggle("hidden", !visible);
        }
      },
      onKeydown(e) {
        if (e.key === "Escape") {
          if (self.core) self.core.disconnect();
          showConnect();
          return true;
        }
        return false;
      },
      onInput(input) {},
      onAudio(hasAudio) {
        if (audioIndicator) {
          audioIndicator.style.display = hasAudio ? "" : "none";
        }
      }
    });

    roomInput.addEventListener("input", () => {
      roomInput.value = roomInput.value
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 6);
      connectBtn.disabled = roomInput.value.length !== 6;
      if (connectHint) connectHint.style.display = "none";
    });

    roomInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && roomInput.value.length === 6) {
        connectBtn.click();
      }
    });

    connectBtn.addEventListener("click", () => {
      const code = roomInput.value.trim();
      if (code.length !== 6) return;
      connectScreen.style.display = "none";
      viewerScreen.style.display = "flex";
      roomBadge.textContent = code.slice(0, 3) + "-" + code.slice(3);
      this.core.connect(code);
    });

    disconnectBtn.addEventListener("click", () => {
      if (this.core) this.core.disconnect();
      showConnect();
    });

    const fileUploadBtn = win.querySelector("#fileUploadBtn");
    const fileInput = win.querySelector("#fileInput");
    if (fileUploadBtn && fileInput) {
      fileUploadBtn.addEventListener("click", () => fileInput.click());
      fileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file || !this.core) return;
        this.core.sendFile(file);
        fileInput.value = "";
      });
    }

    const copyRoomBtn = win.querySelector("#copyRoomBtn");
    if (copyRoomBtn) {
      copyRoomBtn.addEventListener("click", () => {
        if (this.hostRoomCode) {
          navigator.clipboard.writeText(this.hostRoomCode);
        }
      });
    }

    const copyRoomBadgeBtn = win.querySelector("#copyRoomBadgeBtn");
    if (copyRoomBadgeBtn) {
      copyRoomBadgeBtn.addEventListener("click", () => {
        const code = roomBadge.textContent;
        if (code) {
          navigator.clipboard.writeText(code.replace("-", ""));
        }
      });
    }

    const regenerateRoomBtn = win.querySelector("#regenerateRoomBtn");
    if (regenerateRoomBtn) {
      regenerateRoomBtn.addEventListener("click", async () => {
        try {
          await window.electronAPI.clearPersistentRoom();
        } catch {}
        await electronAPI.stopRemoteHost();
        cleanup();
        shareBtn.click();
      });
    }

    win.addEventListener("remove", () => {
      if (this.core) this.core.disconnect();
      this.core = null;
    });
  }

  onClose(winId) {
    this.openWindows.delete(winId);
    if (this.hostStatusInterval) {
      clearInterval(this.hostStatusInterval);
      this.hostStatusInterval = null;
    }
    if (this.core) {
      this.core.disconnect();
      this.core = null;
    }
  }
}
