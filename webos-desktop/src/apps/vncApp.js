import "../styles/vnc.css";
import { createElement } from "../shared/domUtils.js";
import { BaseApp, os, StorageKeys } from "../framework.js";

const NOVNC_CDN = "https://cdn.jsdelivr.net/npm/@novnc/novnc@1.5.0/dist/rfb.min.js";

export class VNCApp extends BaseApp {
  constructor(services) {
    super(services);
    this.rfb = null;
    this.connected = false;
    this.connecting = false;
    this.profiles = [];
    this.loaded = false;
  }

  open(opts) {
    const win = os.window.create("vnc-client", "VNC Client", "850px", "580px", {
      icon: "fas fa-display"
    });
    win.innerHTML = `
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
      </div>`;

    this.initVNC();
  }

  initVNC() {
    this.profiles = this.loadProfiles();
    if (this.profiles.length > 0) {
      this.renderProfiles();
    }

    const newBtn = document.getElementById("vnc-new-connection");
    if (newBtn)
      newBtn.addEventListener("click", () => {
        this.disconnect();
        const connectScreen = document.getElementById("vnc-connect-screen");
        const viewer = document.getElementById("vnc-viewer-container");
        if (connectScreen) connectScreen.style.display = "flex";
        if (viewer) viewer.style.display = "none";
      });

    const disconnectBtn = document.getElementById("vnc-disconnect");
    if (disconnectBtn) disconnectBtn.addEventListener("click", () => this.disconnect());

    const fullscreenBtn = document.getElementById("vnc-fullscreen");
    if (fullscreenBtn) fullscreenBtn.addEventListener("click", () => this.toggleFullscreen());

    const cadBtn = document.getElementById("vnc-ctrl-alt-del");
    if (cadBtn)
      cadBtn.addEventListener("click", () => {
        if (this.rfb && this.connected) this.rfb.sendCtrlAltDel();
      });

    const connectBtn = document.getElementById("vnc-connect-btn");
    if (connectBtn) connectBtn.addEventListener("click", () => this.loadNoVNCAndConnect());

    const hostInput = document.getElementById("vnc-host");
    const portInput = document.getElementById("vnc-port");

    if (hostInput && portInput) {
      const handleEnter = (e) => {
        if (e.key === "Enter") this.loadNoVNCAndConnect();
      };
      hostInput.addEventListener("keydown", handleEnter);
      portInput.addEventListener("keydown", handleEnter);
    }
  }

  async loadNoVNCAndConnect() {
    if (!this.loaded) {
      try {
        await this.loadNoVNCScript();
      } catch (e) {
        os.dialog.alert("VNC Client", "Failed to load noVNC library. Check your internet connection.");
        return;
      }
    }
    this.connect();
  }

  loadNoVNCScript() {
    return new Promise((resolve, reject) => {
      if (window.RFB) {
        this.loaded = true;
        resolve();
        return;
      }

      const script = createElement("script");
      script.src = NOVNC_CDN;
      script.async = true;
      script.onload = () => {
        this.loaded = true;
        resolve();
      };
      script.onerror = () => reject(new Error("Failed to load noVNC"));
      document.head.appendChild(script);
    });
  }

  connect() {
    if (this.connecting || this.connected) return;

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

    this.connecting = true;
    this.updateUIState("connecting");

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
      this.rfb = new window.RFB(canvasWrapper, wsUrl, {
        credentials: { password: password || undefined },
        shared: true,
        repeaterID: "",
        wsProtocols: ["binary"]
      });

      this.rfb.viewOnly = false;
      this.rfb.scaleViewport = true;
      this.rfb.resizeSession = true;
      if (password) {
        this.rfb.sendCredentials({ password });
      }

      this.rfb.addEventListener("connect", () => {
        this.connected = true;
        this.connecting = false;
        if (loadingEl) loadingEl.style.display = "none";
        this.updateUIState("connected");

        if (saveProfile && host) {
          this.saveProfile({ host, port, wsPort, useWss });
        }

        os.notify.send("VNC Client", `Connected to ${host}:${port}`, {
          icon: "fas fa-display",
          type: "success",
          duration: 3000,
          appSource: "vncApp"
        });
      });

      this.rfb.addEventListener("disconnect", (detail) => {
        this.connected = false;
        this.connecting = false;
        this.updateUIState("disconnected");

        const reason = detail?.detail?.clean ? "" : " (connection lost)";
        this.showConnectScreen();
        os.dialog.alert("VNC Client", `Disconnected from ${host}:${port}${reason}`);
      });

      this.rfb.addEventListener("credentialsrequired", () => {
        this.connecting = false;
        if (password) {
          this.rfb.sendCredentials({ password });
        } else {
          this.showConnectScreen();
          os.dialog.alert("VNC Client", "Password required for this VNC server.");
        }
      });

      this.rfb.addEventListener("serververification", (e) => {
        if (e.detail && typeof e.detail === "function") {
          e.detail(true);
        }
      });

      this.rfb.addEventListener("clipboard", (e) => {
        if (e.detail && e.detail.text) {
          navigator.clipboard.writeText(e.detail.text).catch(() => {});
        }
      });

      this.rfb.scaleViewport = true;
      this.rfb.resizeSession = true;
    } catch (err) {
      this.connecting = false;
      this.updateUIState("disconnected");
      this.showConnectScreen();
      os.dialog.alert("VNC Client", `Failed to connect: ${err.message}`);
    }
  }

  disconnect() {
    if (this.rfb) {
      try {
        this.rfb.disconnect();
      } catch (e) {}
      this.rfb = null;
    }
    this.connected = false;
    this.connecting = false;
    this.updateUIState("disconnected");
    this.showConnectScreen();
  }

  showConnectScreen() {
    const connectScreen = document.getElementById("vnc-connect-screen");
    const viewer = document.getElementById("vnc-viewer-container");
    const loadingEl = document.getElementById("vnc-loading");

    if (connectScreen) connectScreen.style.display = "flex";
    if (viewer) viewer.style.display = "none";
    if (loadingEl) loadingEl.style.display = "none";
  }

  toggleFullscreen() {
    const wrapper = document.getElementById("vnc-canvas-wrapper");
    if (!wrapper) return;

    if (!document.fullscreenElement) {
      wrapper.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  updateUIState(state) {
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

  saveProfile(profile) {
    const existing = this.profiles.findIndex((p) => p.host === profile.host && p.port === profile.port);

    if (existing >= 0) {
      this.profiles[existing] = { ...profile, name: this.profiles[existing].name };
    } else {
      this.profiles.push({
        ...profile,
        name: `${profile.host}:${profile.port}`
      });
    }

    os.storage.set(StorageKeys.vncProfiles, JSON.stringify(this.profiles));
    this.renderProfiles();
  }

  loadProfiles() {
    try {
      const data = os.storage.get(StorageKeys.vncProfiles);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  renderProfiles() {
    const section = document.getElementById("vnc-profiles-section");
    const list = document.getElementById("vnc-profiles-list");

    if (!section || !list) return;

    if (this.profiles.length === 0) {
      section.style.display = "none";
      return;
    }

    section.style.display = "block";
    list.innerHTML = this.profiles
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
        const profile = this.profiles[index];

        const hostInput = document.getElementById("vnc-host");
        const portInput = document.getElementById("vnc-port");
        const wsPortInput = document.getElementById("vnc-ws-port");
        const wssCheck = document.getElementById("vnc-use-wss");

        if (hostInput) hostInput.value = profile.host;
        if (portInput) portInput.value = profile.port;
        if (wsPortInput) wsPortInput.value = profile.wsPort;
        if (wssCheck) wssCheck.checked = profile.useWss;

        this.loadNoVNCAndConnect();
      });
    });

    list.querySelectorAll(".vnc-profile-delete-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const item = e.target.closest(".vnc-profile-item");
        const index = parseInt(item.dataset.index);
        this.profiles.splice(index, 1);
        os.storage.set(StorageKeys.vncProfiles, this.profiles);
        this.renderProfiles();
      });
    });
  }

  onClose(winId) {
    this.disconnect();
  }
}
