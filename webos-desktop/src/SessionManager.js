import { bus, BusEvents } from "./core/EventBus.js";
import { PREDEFINED_AVATARS, STORAGE_KEYS } from "./profileCustomizer.js";
import { resolveIconUrl } from "./shared/assetResolver.js";

export class SessionManager {
  constructor(services) {
    this.services = services;
    this.currentSession = null;
    this.container = null;
  }

  async showLogin() {
    return new Promise((resolve) => {
      this._createUI(resolve);
    });
  }

  _createUI(onComplete) {
    // Prevent multiple login screens
    if (document.getElementById("login-screen-container")) return;

    this.container = document.createElement("div");
    this.container.id = "login-screen-container";
    this.container.className = "login-screen-overlay";

    const lastUsername = localStorage.getItem(STORAGE_KEYS.username) || "";
    const lastAvatar = localStorage.getItem(STORAGE_KEYS.profilePicture) || PREDEFINED_AVATARS[0];

    this.container.innerHTML = `
      <div class="login-card glass">
        <div class="login-header">
          <div class="login-logo">
            <img class="abx-badge" src="${resolveIconUrl("static/icons/logo.png")}" style="height: 64px;">
          </div>
          <h1>Yuki OS</h1>
          <p>Sign in to start your session</p>
        </div>

        <div class="login-body">
          <div class="input-group">
            <label for="nickname-input">Nickname</label>
            <div class="input-wrapper">
              <i class="fas fa-user-tag"></i>
              <input type="text" id="nickname-input" placeholder="Enter nickname (optional)" value="${lastUsername}" autocomplete="off">
            </div>
          </div>

          <div class="avatar-section">
            <label>Select Avatar</label>
            <div class="avatar-grid-wrapper">
              <div class="avatar-grid" id="login-avatar-grid">
                ${PREDEFINED_AVATARS.map(
                  (url) => `
                  <div class="avatar-tile ${url === lastAvatar ? "active" : ""}" data-url="${url}">
                    <img src="${url}" alt="Avatar">
                    <div class="tile-check"><i class="fas fa-check"></i></div>
                  </div>
                `
                ).join("")}
              </div>
            </div>
            
            <div class="avatar-actions">
              <button class="btn-secondary" id="login-upload-btn">
                <i class="fas fa-upload"></i> Upload Custom
              </button>
            </div>
          </div>
        </div>

        <div class="login-footer">
          <button class="btn-primary" id="login-continue-btn">
            Continue <i class="fas fa-arrow-right"></i>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(this.container);
    this._injectStyles();
    this._bindEvents(onComplete);
  }

  _injectStyles() {
    if (document.getElementById("login-screen-styles")) return;
    const style = document.createElement("style");
    style.id = "login-screen-styles";
    style.textContent = `
      .login-screen-overlay {
        position: fixed;
        inset: 0;
        z-index: 999999;
        background: radial-gradient(circle at center, #1a1a2e 0%, #0f0f1a 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.8s ease-out;
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
        color: #fff;
      }

      @keyframes fadeIn {
        from { opacity: 0; transform: scale(1.05); }
        to { opacity: 1; transform: scale(1); }
      }

      .login-card {
        width: 100%;
        max-width: 440px;
        padding: 40px;
        border-radius: 24px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        flex-direction: column;
        gap: 32px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(20px);
        background: rgba(255, 255, 255, 0.03);
      }

      .login-header {
        text-align: center;
      }

      .login-logo {
        width: 64px;
        height: 64px;
        background: linear-gradient(135deg, #4f9eff 0%, #a259ff 100%);
        border-radius: 16px;
        margin: 0 auto 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 32px;
        box-shadow: 0 10px 20px rgba(79, 158, 255, 0.3);
      }

      .login-header h1 {
        font-size: 28px;
        font-weight: 800;
        margin-bottom: 8px;
        letter-spacing: -0.02em;
        background: linear-gradient(to bottom, #fff, #ccc);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }

      .login-header p {
        color: rgba(255, 255, 255, 0.5);
        font-size: 14px;
      }

      .input-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .input-group label {
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: rgba(255, 255, 255, 0.4);
      }

      .input-wrapper {
        position: relative;
        display: flex;
        align-items: center;
      }

      .input-wrapper i {
        position: absolute;
        left: 16px;
        color: rgba(255, 255, 255, 0.3);
        font-size: 14px;
      }

      .input-wrapper input {
        width: 100%;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        padding: 12px 12px 12px 42px;
        color: #fff;
        font-size: 14px;
        transition: all 0.2s;
        outline: none;
        box-sizing: border-box;
        margin-left: 10px;
        margin-bottom: 10px;
      }

      .input-wrapper input:focus {
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(79, 158, 255, 0.5);
        box-shadow: 0 0 0 4px rgba(79, 158, 255, 0.1);
      }

      .avatar-section {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .avatar-section label {
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: rgba(255, 255, 255, 0.4);
      }

      .avatar-grid-wrapper {
        background: rgba(0, 0, 0, 0.2);
        border-radius: 16px;
        padding: 12px;
        border: 1px solid rgba(255, 255, 255, 0.05);
      }

      .avatar-grid {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 10px;
        max-height: 140px;
        overflow-y: auto;
        padding-right: 4px;
      }

      .avatar-grid::-webkit-scrollbar {
        width: 4px;
      }
      .avatar-grid::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 10px;
      }

      .avatar-tile {
        aspect-ratio: 1;
        border-radius: 12px;
        overflow: hidden;
        cursor: pointer;
        position: relative;
        border: 2px solid transparent;
        transition: all 0.2s;
      }

      .avatar-tile img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .avatar-tile:hover {
        transform: scale(1.05);
        border-color: rgba(255, 255, 255, 0.2);
      }

      .avatar-tile.active {
        border-color: #4f9eff;
        box-shadow: 0 0 15px rgba(79, 158, 255, 0.3);
      }

      .tile-check {
        position: absolute;
        inset: 0;
        background: rgba(79, 158, 255, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.2s;
      }

      .avatar-tile.active .tile-check {
        opacity: 1;
      }

      .avatar-actions {
        display: flex;
        justify-content: flex-end;
      }

      .btn-secondary {
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: rgba(255, 255, 255, 0.7);
        padding: 8px 16px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .btn-secondary:hover {
        background: rgba(255, 255, 255, 0.05);
        color: #fff;
        border-color: rgba(255, 255, 255, 0.2);
      }

      .btn-primary {
        width: 100%;
        background: linear-gradient(135deg, #4f9eff 0%, #3482f6 100%);
        border: none;
        color: #fff;
        padding: 16px;
        border-radius: 12px;
        font-size: 16px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        box-shadow: 0 4px 15px rgba(79, 158, 255, 0.3);
      }

      .btn-primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(79, 158, 255, 0.4);
      }

      .btn-primary:active {
        transform: translateY(0);
      }

      .login-screen-overlay.exit {
        animation: fadeOut 0.5s forwards ease-in;
      }

      @keyframes fadeOut {
        from { opacity: 1; transform: scale(1); filter: blur(0); }
        to { opacity: 0; transform: scale(1.1); filter: blur(10px); }
      }
    `;
    document.head.appendChild(style);
  }

  _bindEvents(onComplete) {
    const grid = this.container.querySelector("#login-avatar-grid");
    const nicknameInput = this.container.querySelector("#nickname-input");
    const uploadBtn = this.container.querySelector("#login-upload-btn");
    const continueBtn = this.container.querySelector("#login-continue-btn");

    let selectedAvatar = localStorage.getItem(STORAGE_KEYS.profilePicture) || PREDEFINED_AVATARS[0];

    // Avatar selection
    grid.addEventListener("click", (e) => {
      const tile = e.target.closest(".avatar-tile");
      if (!tile) return;

      grid.querySelectorAll(".avatar-tile").forEach((t) => t.classList.remove("active"));
      tile.classList.add("active");
      selectedAvatar = tile.dataset.url;
    });

    // Upload
    uploadBtn.addEventListener("click", () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
          const dataUrl = event.target.result;
          selectedAvatar = dataUrl;

          // Add to grid
          const newTile = document.createElement("div");
          newTile.className = "avatar-tile active";
          newTile.dataset.url = dataUrl;
          newTile.innerHTML = `
            <img src="${dataUrl}" alt="Avatar">
            <div class="tile-check"><i class="fas fa-check"></i></div>
          `;

          grid.querySelectorAll(".avatar-tile").forEach((t) => t.classList.remove("active"));
          grid.prepend(newTile);
          grid.scrollTop = 0;
        };
        reader.readAsDataURL(file);
      };
      input.click();
    });

    // Continue
    const handleContinue = async () => {
      const nickname = nicknameInput.value.trim();
      const displayName = nickname || "Guest";
      const sessionKey = nickname.toLowerCase().replace(/[^a-z0-9]/g, "") || "guest";

      this.currentSession = {
        name: displayName,
        key: sessionKey,
        avatar: selectedAvatar
      };

      // Fade out
      this.container.classList.add("exit");

      // Initialize systems
      await this._initializeSession();

      setTimeout(() => {
        this.container.remove();
        onComplete(this.currentSession);
      }, 500);
    };

    continueBtn.addEventListener("click", handleContinue);
    nicknameInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") handleContinue();
    });
  }

  async _initializeSession() {
    const { name, key, avatar } = this.currentSession;

    // 1. Update Filesystem
    if (this.services.fileSystemManager) {
      await this.services.fileSystemManager.setSession(key);
    }

    // 2. Update Profile State (will be picked up by EventBus listener in ProfileCustomizerApp)
    // But we also want to emit it now for other systems
    bus.emit(BusEvents.SESSION_INITIALIZED, this.currentSession);

    if (this.services.windowManager) {
      this.services.windowManager.setFileSystemManager(this.services.fileSystemManager);
      await this.services.windowManager.restoreSession();
    }
  }
}
