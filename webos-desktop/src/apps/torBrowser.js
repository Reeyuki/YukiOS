import "../styles/torBrowser.css";
import { BaseApp, PersistenceTypes, os } from "../framework.js";

export class TorBrowserApp extends BaseApp {
  constructor(services) {
    super(services);
    this._state = "stopped";
    this._unsubs = [];
  }

  getDeclarativeSchema(opts) {
    return {
      id: "tor-browser",
      name: "Tor Manager",
      icon: "fas fa-shield-halved",
      windows: [
        {
          id: "tor-browser",
          title: "Tor Manager",
          size: ["520px", "420px"],
          icon: "fas fa-shield-halved",
          ui: `
            <div class="tor-manager">
              <div class="tor-body">
                <div class="tor-controls">
                  <button class="tor-start-btn" id="tor-start-btn">
                    <i class="fas fa-play"></i>
                    <span id="tor-start-label">Start Tor</span>
                  </button>
                  <button class="tor-stop-btn" id="tor-stop-btn" disabled>
                    <i class="fas fa-stop"></i>
                    Stop Tor
                  </button>
                  <button class="tor-reconnect-btn" id="tor-reconnect-btn" disabled>
                    <i class="fas fa-sync-alt"></i>
                    Reconnect
                  </button>
                </div>

                <div class="tor-status-card" id="tor-status-card">
                  <div class="tor-status-row">
                    <span class="tor-status-label">Status</span>
                    <span class="tor-status-value" id="tor-status-value">
                      <span class="tor-dot tor-dot-idle"></span>
                      Stopped
                    </span>
                  </div>
                  <div class="tor-status-row" id="tor-fetch-row" style="display:none">
                    <span class="tor-status-label">Requests</span>
                    <span class="tor-status-value" id="tor-fetch-count">0</span>
                  </div>
                </div>

                <div class="tor-log-section">
                  <div class="tor-log-header">
                    <span>Connection Log</span>
                    <button class="tor-log-clear" id="tor-log-clear">
                      <i class="fas fa-trash"></i>
                    </button>
                  </div>
                  <div class="tor-log" id="tor-log">
                    <div class="tor-log-entry tor-log-info">
                      <span class="tor-log-time">—</span>
                      <span class="tor-log-msg">Ready. Click "Start Tor" to begin.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          `
        }
      ],
      state: {
        initial: {},
        persistence: PersistenceTypes.SESSION
      },
      onMount: "initTorManager"
    };
  }

  initTorManager() {
    this._syncFromSingleton();
    this._bindEvents();

    this._unsubs.push(
      os.events.on("TOR_STATUS_CHANGED", (status) => {
        this._renderStatus(status);
      })
    );
    this._unsubs.push(
      os.events.on("TOR_LOG", (msg) => {
        this._logEntry("info", msg);
      })
    );
  }

  _syncFromSingleton() {
    const status = os.tor.getStatus();
    this._renderStatus(status);
    os.tor.getLogs().forEach((msg) => this._logEntry("info", msg));
  }

  _bindEvents() {
    document.getElementById("tor-start-btn")?.addEventListener("click", () => this._startTor());
    document.getElementById("tor-stop-btn")?.addEventListener("click", () => this._stopTor());
    document.getElementById("tor-reconnect-btn")?.addEventListener("click", () => this._reconnectTor());
    document.getElementById("tor-log-clear")?.addEventListener("click", () => {
      const log = document.getElementById("tor-log");
      if (log) log.innerHTML = "";
    });
  }

  async _startTor() {
    if (os.tor.running) return;

    const startBtn = document.getElementById("tor-start-btn");
    const stopBtn = document.getElementById("tor-stop-btn");
    if (startBtn) startBtn.disabled = true;

    try {
      await os.tor.start({ appId: "torBrowserApp" });
      if (stopBtn) stopBtn.disabled = false;
    } catch (e) {
      if (startBtn) startBtn.disabled = false;
      this._logEntry("error", "Connection failed: " + (e.message || e));
    }
  }

  async _stopTor() {
    await os.tor.stop();
    this._syncButtons(false);
  }

  async _reconnectTor() {
    const reconnectBtn = document.getElementById("tor-reconnect-btn");
    const startBtn = document.getElementById("tor-start-btn");
    const stopBtn = document.getElementById("tor-stop-btn");
    if (reconnectBtn) reconnectBtn.disabled = true;
    if (startBtn) startBtn.disabled = true;
    if (stopBtn) stopBtn.disabled = true;
    this._logEntry("info", "Reconnecting Tor...");
    try {
      await os.tor.reconnect();
      this._logEntry("success", "Tor reconnected successfully.");
      os.notify.send("Tor", "Tor reconnected.", { type: "success", duration: 3000 });
    } catch (e) {
      this._logEntry("error", "Reconnect failed: " + (e.message || e));
    }
    this._syncButtons(os.tor.running);
  }

  _renderStatus(status) {
    const el = document.getElementById("tor-status-value");
    if (!el) return;
    const phase = status?.phase || "stopped";
    if (phase === "ready") {
      el.innerHTML = '<span class="tor-dot tor-dot-active"></span> Connected';
    } else if (phase === "reconnecting") {
      el.innerHTML = '<span class="tor-dot tor-dot-connecting"></span> Reconnecting...';
    } else if (
      phase === "connecting" ||
      phase === "loading" ||
      phase === "loading-wasm" ||
      phase === "init-wasm" ||
      phase === "building-circuit"
    ) {
      el.innerHTML = '<span class="tor-dot tor-dot-connecting"></span> Connecting...';
    } else if (phase === "error") {
      el.innerHTML = '<span class="tor-dot tor-dot-error"></span> Error';
    } else {
      el.innerHTML = '<span class="tor-dot tor-dot-idle"></span> Stopped';
    }
    const running =
      phase === "ready" ||
      phase === "connecting" ||
      phase === "loading" ||
      phase === "loading-wasm" ||
      phase === "init-wasm" ||
      phase === "building-circuit" ||
      phase === "reconnecting";
    this._syncButtons(running);
    this._updateFetchCount();
  }

  _syncButtons(running) {
    const startBtn = document.getElementById("tor-start-btn");
    const stopBtn = document.getElementById("tor-stop-btn");
    const reconnectBtn = document.getElementById("tor-reconnect-btn");
    if (startBtn) startBtn.disabled = running;
    if (stopBtn) stopBtn.disabled = !running;
    if (reconnectBtn) reconnectBtn.disabled = !running;
  }

  _updateFetchCount() {
    const row = document.getElementById("tor-fetch-row");
    const count = document.getElementById("tor-fetch-count");
    if (!count) return;
    const fc = os.tor.getFetchCount();
    count.textContent = fc;
    if (row) row.style.display = fc > 0 ? "" : "none";
  }

  _logEntry(type, msg) {
    const log = document.getElementById("tor-log");
    if (!log) return;
    const time = new Date().toLocaleTimeString();
    const entry = document.createElement("div");
    entry.className = "tor-log-entry tor-log-" + type;
    entry.innerHTML = `<span class="tor-log-time">${time}</span><span class="tor-log-msg">${this._escape(msg)}</span>`;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
  }

  _escape(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  onClose(winId) {
    this._unsubs.forEach((fn) => fn());
    this._unsubs = [];
  }
}
