import { CDN_MIRRORS, setCdnMirror, getCdnMirror } from ".././shared/assetResolver.js";

import { BaseApp, StorageKeys, os } from "../framework.js";
class NetworkTrayApp extends BaseApp {
  constructor(services) {
    super(services);
    this.winId = "network-tray-window";
    this.popupId = "network-tray-popup";
    this._popupVisible = false;
    this._connecting = false;
    this.currentCdn = getCdnMirror();
    this._initTray();
  }

  _getSignalStrength(cdnId) {
    const signalMap = {
      jsdelivr: 4,
      quantil: 3,
      originfastly: 3,
      gcore: 3,
      esmsh: 2,
      statically: 2,
      staticdelivr: 2
    };
    return signalMap[cdnId] || 2;
  }

  _getWifiIcon(signalStrength) {
    const icons = ["fa-wifi", "fa-wifi", "fa-wifi", "fa-wifi", "fa-wifi"];
    return icons[signalStrength] || "fa-wifi";
  }

  _initTray() {
    this.registerTray(this.winId, "fas fa-wifi", "Network", {
      resident: true,
      showInTray: true,
      priority: 100,
      onClick: () => {
        this.togglePopup();
      },
      contextMenuItems: [
        { label: "Network Settings", icon: "fa-cog", action: () => this._openNetworkSettings() },
        { type: "divider" }
      ]
    });
    this._updateTrayIcon();
  }

  _updateTrayIcon() {
    const signalStrength = this._getSignalStrength(this.currentCdn);
    const iconClass = this._getWifiIcon(signalStrength);
    this.unregisterTray(this.winId);
    this.registerTray(this.winId, `fas ${iconClass}`, "Network", {
      resident: true,
      showInTray: true,
      priority: 100,
      onClick: () => {
        this.togglePopup();
      },
      contextMenuItems: [
        { label: "Network Settings", icon: "fa-cog", action: () => this._openNetworkSettings() },
        { type: "divider" }
      ]
    });
  }

  _openNetworkSettings() {
    os.app.launch("settingsApp", null, { section: "pane-network" });
  }

  togglePopup() {
    if (this._popupVisible) {
      this.closePopup();
    } else {
      this.openPopup();
    }
  }

  openPopup() {
    if (this._popupVisible) return;

    const existingPopup = document.getElementById(this.popupId);
    if (existingPopup) {
      existingPopup.remove();
    }

    const popup = document.createElement("div");
    popup.id = this.popupId;
    popup.className = "network-tray-popup";
    popup.innerHTML = this._buildPopupContent();

    document.body.appendChild(popup);

    const trayEl = document.getElementById("app-tray");
    const trayRect = trayEl ? trayEl.getBoundingClientRect() : { right: 16, top: window.innerHeight - 48 };

    popup.style.right = `${window.innerWidth - trayRect.right}px`;
    popup.style.bottom = `${window.innerHeight - trayRect.top + 8}px`;
    popup.style.display = "block";

    this._popupVisible = true;
    this._bindEvents(popup);

    document.addEventListener("click", this._handleOutsideClick);
  }

  _buildPopupContent() {
    const currentCdn = getCdnMirror();
    const cdnList = CDN_MIRRORS.map((cdn) => {
      const signalStrength = this._getSignalStrength(cdn.id);
      const isConnected = cdn.id === currentCdn;
      return `
        <div class="network-item ${isConnected ? "connected" : ""}" data-cdn="${cdn.id}">
          <div class="network-signal">
            ${this._buildSignalBars(signalStrength)}
          </div>
          <div class="network-info">
            <div class="network-name">${cdn.name}</div>
            <div class="network-status">${isConnected ? "Connected" : "Available"}</div>
          </div>
          ${isConnected ? '<div class="network-badge"><i class="fas fa-check"></i></div>' : ""}
        </div>
      `;
    }).join("");

    return `
      <div class="network-popup-content">
        <div class="network-header">
          <i class="fas fa-wifi"></i>
          <span>Network</span>
        </div>
        <div class="network-list">
          ${cdnList}
        </div>
        <div class="network-footer">
          <button class="network-settings-btn" id="network-settings-btn">
            <i class="fas fa-cog"></i>
            <span>Network Settings</span>
          </button>
        </div>
      </div>
    `;
  }

  _buildSignalBars(strength) {
    let bars = "";
    for (let i = 1; i <= 4; i++) {
      const active = i <= strength ? "active" : "";
      bars += `<div class="signal-bar ${active}"></div>`;
    }
    return bars;
  }

  closePopup() {
    const popup = document.getElementById(this.popupId);
    if (popup) {
      popup.classList.add("closing");
      popup.addEventListener(
        "animationend",
        () => {
          popup.remove();
        },
        { once: true }
      );
    }
    this._popupVisible = false;
    document.removeEventListener("click", this._handleOutsideClick);
  }

  _handleOutsideClick = (e) => {
    const popup = document.getElementById(this.popupId);
    const trayEl = document.getElementById("app-tray");
    if (popup && !e.target.closest("#network-tray-popup") && !e.target.closest("#app-tray")) {
      this.closePopup();
    }
  };

  open(options = {}) {
    this.togglePopup();
  }

  _bindEvents(popup) {
    const networkItems = popup.querySelectorAll(".network-item");
    const settingsBtn = popup.querySelector("#network-settings-btn");

    networkItems.forEach((item) => {
      item.addEventListener("click", () => {
        const cdnId = item.dataset.cdn;
        if (cdnId !== this.currentCdn && !this._connecting) {
          this._connectToCdn(cdnId, item);
        }
      });
    });

    if (settingsBtn) {
      settingsBtn.addEventListener("click", () => {
        this._openNetworkSettings();
        this.closePopup();
      });
    }
  }

  async _connectToCdn(cdnId, itemElement) {
    this._connecting = true;
    const originalContent = itemElement.innerHTML;

    itemElement.classList.add("connecting");
    itemElement.innerHTML = `
      <div class="network-signal">
        <div class="connecting-spinner">
          <i class="fas fa-spinner fa-spin"></i>
        </div>
      </div>
      <div class="network-info">
        <div class="network-name">Connecting...</div>
        <div class="network-status">Establishing connection</div>
      </div>
    `;

    await new Promise((resolve) => setTimeout(resolve, 1500));

    setCdnMirror(cdnId);
    this.currentCdn = cdnId;

    const cdn = CDN_MIRRORS.find((c) => c.id === cdnId);
    this.notify("Network Connected", `Connected to ${cdn.name}`, "success", 2000, "fa-wifi");

    this._updateTrayIcon();
    this._connecting = false;
  }

  onClose(winId) {
    this.closePopup();
  }
}

export { NetworkTrayApp };
