import "../styles/vnc.css";
import { BaseApp, PersistenceTypes, os, StorageKeys } from "../framework.js";

const NOVNC_CDN = "https://cdn.jsdelivr.net/npm/@novnc/novnc@1.5.0/dist/rfb.min.js";

export class VNCApp extends BaseApp {
  constructor(services) {
    super(services);
    this._rfb = null;
    this._connected = false;
    this._connecting = false;
    this._profiles = [];
    this._loaded = false;
  }

  getDeclarativeSchema(opts) {
    return {
      id: "vnc-client",
      name: "VNC Client",
      icon: "fas fa-display",
      windows: [
        {
          id: "vnc-client",
          title: "VNC Client",
          size: ["850px", "580px"],
          icon: "fas fa-display",
          ui: `
            <div class="vnc-app">
              <div class="vnc-toolbar">
                <div class="vnc-toolbar-left">
                  <button class="vnc-toolbar-btn" id="vnc-new-connection" title="New Connection">
                    <i class="fas fa-plus"></i>
                    <span>New</span>
                  </button>
                  <button class="vnc-toolbar-btn" id="vnc-disconnect" title="Disconnect" disabled>
                    <i class="fas fa-plug"></i>
                    <span>Disconnect</span>
                  </button>
                  <button class="vnc-toolbar-btn" id="vnc-fullscreen" title="Fullscreen" disabled>
                    <i class="fas fa-expand"></i>
                    <span>Fullscreen</span>
                  </button>
                  <button class="vnc-toolbar-btn" id="vnc-ctrl-alt-del" title="Send Ctrl+Alt+Del" disabled>
                    <i class="fas fa-keyboard"></i>
                    <span>Ctrl+Alt+Del</span>
                  </button>
                </div>
                <div class="vnc-toolbar-right">
                  <span class="vnc-status-badge" id="vnc-status-badge">
                    <span class="vnc-status-dot vnc-disconnected"></span>
                    Disconnected
                  </span>
                </div>
              </div>
              <div class="vnc-main">
                <div class="vnc-connect-screen" id="vnc-connect-screen">
                  <div class="vnc-connect-form">
                    <div class="vnc-connect-icon"><i class="fas fa-display"></i></div>
                    <h2 class="vnc-connect-title">VNC Remote Desktop</h2>
                    <p class="vnc-connect-desc">Connect to a remote computer via VNC</p>
                    <div class="vnc-form-group">
                      <label class="vnc-label">Host</label>
                      <input type="text" class="vnc-input" id="vnc-host" placeholder="e.g. 192.168.1.100" value="" />
                    </div>
                    <div class="vnc-form-row">
                      <div class="vnc-form-group">
                        <label class="vnc-label">Port</label>
                        <input type="number" class="vnc-input" id="vnc-port" placeholder="5900" value="5900" />
                      </div>
                      <div class="vnc-form-group">
                        <label class="vnc-label">WebSocket Port</label>
                        <input type="number" class="vnc-input" id="vnc-ws-port" placeholder="6080" value="6080" />
                      </div>
                    </div>
                    <div class="vnc-form-group">
                      <label class="vnc-label">Password (optional)</label>
                      <input type="password" class="vnc-input" id="vnc-password" placeholder="VNC password" />
                    </div>
                    <div class="vnc-form-group">
                      <label class="vnc-checkbox">
                        <input type="checkbox" id="vnc-use-wss" checked />
                        <span>Use WSS (encrypted WebSocket)</span>
                      </label>
                    </div>
                    <div class="vnc-form-group">
                      <label class="vnc-checkbox">
                        <input type="checkbox" id="vnc-save-profile" />
                        <span>Save as profile</span>
                      </label>
                    </div>
                    <div class="vnc-profiles-section" id="vnc-profiles-section" style="display:none">
                      <div class="vnc-profiles-header">
                        <span>Saved Profiles</span>
                      </div>
                      <div class="vnc-profiles-list" id="vnc-profiles-list"></div>
                    </div>
                    <button class="vnc-connect-btn" id="vnc-connect-btn">
                      <i class="fas fa-plug"></i>
                      <span>Connect</span>
                    </button>
                  </div>
                </div>
                <div class="vnc-viewer-container" id="vnc-viewer-container" style="display:none">
                  <div class="vnc-canvas-wrapper" id="vnc-canvas-wrapper">
                    <div class="vnc-loading" id="vnc-loading">
                      <i class="fas fa-spinner fa-spin"></i>
                      <span>Connecting to VNC server...</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          `
        }
      ],
      state: {
        initial: {
          connected: false
        },
        persistence: PersistenceTypes.MEMORY
      },
      actions: {
        newConnection: () => {
          this._disconnect();
          const connectScreen = document.getElementById("vnc-connect-screen");
          const viewer = document.getElementById("vnc-viewer-container");
          if (connectScreen) connectScreen.style.display = "flex";
          if (viewer) viewer.style.display = "none";
        },
        disconnect: () => {
          this._disconnect();
        },
        toggleFullscreen: () => {
          this._toggleFullscreen();
        },
        sendCtrlAltDel: () => {
          if (this._rfb && this._connected) {
            this._rfb.sendCtrlAltDel();
          }
        },
        connect: () => {
          this._loadNoVNCAndConnect();
        }
      },
      onMount: "initVNC"
    };
  }

  initVNC(payload, vt, element, state) {
    this._profiles = this._loadProfiles();
    if (this._profiles.length > 0) {
      this._renderProfiles();
    }

    const newBtn = document.getElementById("vnc-new-connection");
    if (newBtn)
      newBtn.addEventListener("click", () => {
        this._disconnect();
        const connectScreen = document.getElementById("vnc-connect-screen");
        const viewer = document.getElementById("vnc-viewer-container");
        if (connectScreen) connectScreen.style.display = "flex";
        if (viewer) viewer.style.display = "none";
      });

    const disconnectBtn = document.getElementById("vnc-disconnect");
    if (disconnectBtn) disconnectBtn.addEventListener("click", () => this._disconnect());

    const fullscreenBtn = document.getElementById("vnc-fullscreen");
    if (fullscreenBtn) fullscreenBtn.addEventListener("click", () => this._toggleFullscreen());

    const cadBtn = document.getElementById("vnc-ctrl-alt-del");
    if (cadBtn)
      cadBtn.addEventListener("click", () => {
        if (this._rfb && this._connected) this._rfb.sendCtrlAltDel();
      });

    const connectBtn = document.getElementById("vnc-connect-btn");
    if (connectBtn) connectBtn.addEventListener("click", () => this._loadNoVNCAndConnect());

    const hostInput = document.getElementById("vnc-host");
    const portInput = document.getElementById("vnc-port");

    if (hostInput && portInput) {
      const handleEnter = (e) => {
        if (e.key === "Enter") this._loadNoVNCAndConnect();
      };
      hostInput.addEventListener("keydown", handleEnter);
      portInput.addEventListener("keydown", handleEnter);
    }
  }

  async _loadNoVNCAndConnect() {
    if (!this._loaded) {
      try {
        await this._loadNoVNCScript();
      } catch (e) {
        os.dialog.alert("VNC Client", "Failed to load noVNC library. Check your internet connection.");
        return;
      }
    }
    this._connect();
  }

  _loadNoVNCScript() {
    return new Promise((resolve, reject) => {
      if (window.RFB) {
        this._loaded = true;
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src = NOVNC_CDN;
      script.async = true;
      script.onload = () => {
        this._loaded = true;
        resolve();
      };
      script.onerror = () => reject(new Error("Failed to load noVNC"));
      document.head.appendChild(script);
    });
  }

  _connect() {
    if (this._connecting || this._connected) return;

    const host = document.getElementById("vnc-host")?.value.trim();
    const port = parseInt(document.getElementById("vnc-port")?.value) || 5900;
    const wsPort = parseInt(document.getElementById("vnc-ws-port")?.value) || 6080;
    const password = document.getElementById("vnc-password")?.value || "";
    const useWss = document.getElementById("vnc-use-wss")?.checked ?? true;
    const saveProfile = document.getElementById("vnc-save-profile")?.checked ?? false;

    if (!host) {
      os.dialog.alert("VNC Client", "Please enter a host address.");
      return;
    }

    this._connecting = true;
    this._updateUIState("connecting");

    const protocol = useWss ? "wss" : "ws";
    const wsUrl = `${protocol}://${host}:${wsPort}`;

    const connectScreen = document.getElementById("vnc-connect-screen");
    const viewer = document.getElementById("vnc-viewer-container");
    const loadingEl = document.getElementById("vnc-loading");
    const canvasWrapper = document.getElementById("vnc-canvas-wrapper");

    if (connectScreen) connectScreen.style.display = "none";
    if (viewer) viewer.style.display = "flex";
    if (loadingEl) loadingEl.style.display = "flex";

    try {
      this._rfb = new window.RFB(canvasWrapper, wsUrl, {
        credentials: { password: password || undefined },
        shared: true,
        repeaterID: "",
        wsProtocols: ["binary"]
      });

      this._rfb.viewOnly = false;
      this._rfb.scaleViewport = true;
      this._rfb.resizeSession = true;
      if (password) {
        this._rfb.sendCredentials({ password });
      }

      this._rfb.addEventListener("connect", () => {
        this._connected = true;
        this._connecting = false;
        if (loadingEl) loadingEl.style.display = "none";
        this._updateUIState("connected");

        if (saveProfile && host) {
          this._saveProfile({ host, port, wsPort, useWss });
        }

        os.notify.send("VNC Client", `Connected to ${host}:${port}`, {
          icon: "fas fa-display",
          type: "success",
          duration: 3000,
          appSource: "vncApp"
        });
      });

      this._rfb.addEventListener("disconnect", (detail) => {
        this._connected = false;
        this._connecting = false;
        this._updateUIState("disconnected");

        const reason = detail?.detail?.clean ? "" : " (connection lost)";
        this._showConnectScreen();
        os.dialog.alert("VNC Client", `Disconnected from ${host}:${port}${reason}`);
      });

      this._rfb.addEventListener("credentialsrequired", () => {
        this._connecting = false;
        if (password) {
          this._rfb.sendCredentials({ password });
        } else {
          this._showConnectScreen();
          os.dialog.alert("VNC Client", "Password required for this VNC server.");
        }
      });

      this._rfb.addEventListener("serververification", (e) => {
        if (e.detail && typeof e.detail === "function") {
          e.detail(true);
        }
      });

      this._rfb.addEventListener("clipboard", (e) => {
        if (e.detail && e.detail.text) {
          navigator.clipboard.writeText(e.detail.text).catch(() => {});
        }
      });

      this._rfb.scaleViewport = true;
      this._rfb.resizeSession = true;
    } catch (err) {
      this._connecting = false;
      this._updateUIState("disconnected");
      this._showConnectScreen();
      os.dialog.alert("VNC Client", `Failed to connect: ${err.message}`);
    }
  }

  _disconnect() {
    if (this._rfb) {
      try {
        this._rfb.disconnect();
      } catch (e) {}
      this._rfb = null;
    }
    this._connected = false;
    this._connecting = false;
    this._updateUIState("disconnected");
    this._showConnectScreen();
  }

  _showConnectScreen() {
    const connectScreen = document.getElementById("vnc-connect-screen");
    const viewer = document.getElementById("vnc-viewer-container");
    const loadingEl = document.getElementById("vnc-loading");

    if (connectScreen) connectScreen.style.display = "flex";
    if (viewer) viewer.style.display = "none";
    if (loadingEl) loadingEl.style.display = "none";
  }

  _toggleFullscreen() {
    const wrapper = document.getElementById("vnc-canvas-wrapper");
    if (!wrapper) return;

    if (!document.fullscreenElement) {
      wrapper.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  _updateUIState(state) {
    const badge = document.getElementById("vnc-status-badge");
    const disconnectBtn = document.getElementById("vnc-disconnect");
    const fullscreenBtn = document.getElementById("vnc-fullscreen");
    const cadBtn = document.getElementById("vnc-ctrl-alt-del");

    if (badge) {
      const dot = badge.querySelector(".vnc-status-dot");
      if (dot) {
        dot.className = "vnc-status-dot";
        dot.classList.add(`vnc-${state}`);
      }
      const states = { connected: "Connected", connecting: "Connecting...", disconnected: "Disconnected" };
      badge.innerHTML = `<span class="vnc-status-dot vnc-${state}"></span> ${states[state] || "Disconnected"}`;
    }

    if (disconnectBtn) disconnectBtn.disabled = state !== "connected";
    if (fullscreenBtn) fullscreenBtn.disabled = state !== "connected";
    if (cadBtn) cadBtn.disabled = state !== "connected";
  }

  _saveProfile(profile) {
    const existing = this._profiles.findIndex((p) => p.host === profile.host && p.port === profile.port);

    if (existing >= 0) {
      this._profiles[existing] = { ...profile, name: this._profiles[existing].name };
    } else {
      this._profiles.push({
        ...profile,
        name: `${profile.host}:${profile.port}`
      });
    }

    os.storage.set("yukiOS_vnc_profiles", JSON.stringify(this._profiles));
    this._renderProfiles();
  }

  _loadProfiles() {
    try {
      const data = os.storage.get("yukiOS_vnc_profiles");
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  _renderProfiles() {
    const section = document.getElementById("vnc-profiles-section");
    const list = document.getElementById("vnc-profiles-list");

    if (!section || !list) return;

    if (this._profiles.length === 0) {
      section.style.display = "none";
      return;
    }

    section.style.display = "block";
    list.innerHTML = this._profiles
      .map(
        (profile, index) => `
      <div class="vnc-profile-item" data-index="${index}">
        <div class="vnc-profile-info">
          <div class="vnc-profile-name">${profile.name || `${profile.host}:${profile.port}`}</div>
          <div class="vnc-profile-details">${profile.host}:${profile.port}${profile.useWss ? " (WSS)" : " (WS)"}</div>
        </div>
        <div class="vnc-profile-actions">
          <button class="vnc-profile-connect-btn" title="Connect">
            <i class="fas fa-plug"></i>
          </button>
          <button class="vnc-profile-delete-btn" title="Delete">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `
      )
      .join("");

    list.querySelectorAll(".vnc-profile-connect-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const item = e.target.closest(".vnc-profile-item");
        const index = parseInt(item.dataset.index);
        const profile = this._profiles[index];

        const hostInput = document.getElementById("vnc-host");
        const portInput = document.getElementById("vnc-port");
        const wsPortInput = document.getElementById("vnc-ws-port");
        const wssCheck = document.getElementById("vnc-use-wss");

        if (hostInput) hostInput.value = profile.host;
        if (portInput) portInput.value = profile.port;
        if (wsPortInput) wsPortInput.value = profile.wsPort;
        if (wssCheck) wssCheck.checked = profile.useWss;

        this._loadNoVNCAndConnect();
      });
    });

    list.querySelectorAll(".vnc-profile-delete-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const item = e.target.closest(".vnc-profile-item");
        const index = parseInt(item.dataset.index);
        this._profiles.splice(index, 1);
        os.storage.set("yukiOS_vnc_profiles", JSON.stringify(this._profiles));
        this._renderProfiles();
      });
    });
  }

  onClose(winId) {
    this._disconnect();
  }
}
