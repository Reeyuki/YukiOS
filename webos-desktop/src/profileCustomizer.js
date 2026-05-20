import { BaseApp } from "./core/BaseApp.js";
import { BusEvents } from "./core/EventBus.js";
import { refreshSteamUI } from "./games.js";
import { customAlert } from "./shared/dialogs.js";
import { WindowHelper } from "./utils/WindowHelper.js";
import { resolveGhUrl, resolveIconUrl } from "./shared/assetResolver.js";
import { PersistenceTypes } from "./runtime/AppSchema.js";

export const STORAGE_KEYS = {
  username: "yukiOS_username",
  profilePicture: "yukiOS_profilePicture"
};

export const PREDEFINED_AVATARS = [
  resolveIconUrl("static/icons/guest.webp"),
  resolveIconUrl("static/icons/helltaker.jpg"),
  resolveIconUrl("static/icons/stardew.webp"),
  resolveIconUrl("static/icons/hollowKnight.webp"),
  resolveIconUrl("static/icons/fancypants2.webp"),
  resolveIconUrl("static/icons/isaac.webp"),
  resolveIconUrl("static/icons/angryBirds.webp"),
  resolveIconUrl("static/icons/nso.webp"),
  resolveIconUrl("static/icons/alienHominid.webp")
];

export class ProfileCustomizerApp extends BaseApp {
  constructor(services) {
    super(services);
    this.windowHelper = new WindowHelper(this.wm);
    this.settingsApp = null;
    this._setupEventListener();
    this._declarativeApp = null;
  }

  getDeclarativeSchema(opts) {
    const currentUsername = localStorage.getItem(STORAGE_KEYS.username) || "Reeyuki";
    const currentProfilePic =
      localStorage.getItem(STORAGE_KEYS.profilePicture) || resolveIconUrl("static/icons/guest.webp");

    return {
      id: "profile-customizer",
      name: "Customize Profile",
      icon: "fas fa-user-circle",
      windows: [
        {
          id: "profile-customizer",
          title: "Customize Profile",
          size: ["400px", "520px"],
          icon: "fas fa-user-circle",
          iconColor: "#4f9eff",
          style: { left: "250px", top: "100px" },
          ui: `<div class="profile-customizer-body" style="padding: 12px; display: flex; flex-direction: column; gap: 12px; height: calc(100% - 32px); box-sizing: border-box;">
        
        <div class="profile-preview" style="display: flex; align-items: center; gap: 10px; padding: 10px; background: rgba(79, 158, 255, 0.08); border-radius: 8px; border: 1px solid rgba(79, 158, 255, 0.15);">
          <div class="profile-preview-img" style="width: 42px; height: 42px; border-radius: 50%; overflow: hidden; border: 2px solid var(--brand); flex-shrink: 0;">
            <img id="profile-preview-img" src="${currentProfilePic}" style="width: 100%; height: 100%; object-fit: cover;" />
          </div>
          <div class="profile-preview-info" style="flex: 1; min-width: 0;">
            <div id="profile-preview-name" style="font-size: 15px; font-weight: 600; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${currentUsername}</div>
            <div style="font-size: 11px; color: var(--tx2);">Profile Preview</div>
          </div>
        </div>

        <div class="profile-section" style="display: flex; flex-direction: column; gap: 6px;">
          <div style="font-size: 12px; font-weight: 600; color: var(--tx1); display: flex; align-items: center; gap: 6px;">
            <i class="fas fa-user"></i> Nickname
          </div>
          <input id="profile-username-input" type="text" value="${currentUsername}" placeholder="Enter your nickname" style="padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2); color: #fff; font-size: 14px; outline: none; transition: border-color 0.15s; width: 100%; box-sizing: border-box;" />
        </div>

        <div class="profile-section" style="display: flex; flex-direction: column; gap: 8px; flex: 1; min-height: 0;">
          <div style="font-size: 12px; font-weight: 600; color: var(--tx1); display: flex; align-items: center; gap: 6px;">
            <i class="fas fa-image"></i> Profile Picture
          </div>
          
          <button id="profile-upload-btn" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 8px; background: rgba(79, 158, 255, 0.1); border: 1px dashed rgba(79, 158, 255, 0.4); border-radius: 6px; color: var(--tx1); cursor: pointer; transition: all 0.15s; font-size: 12px;">
            <i class="fas fa-cloud-upload-alt"></i>
            <span>Upload Custom</span>
          </button>
          
          <div style="font-size: 11px; color: var(--tx2);">Choose an avatar:</div>
          <div class="avatar-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(45px, 1fr)); gap: 8px; overflow-y: auto; padding: 2px; flex: 1;">
            ${PREDEFINED_AVATARS.map(
              (avatar) => `
              <div class="avatar-option ${avatar === currentProfilePic ? "selected" : ""}" data-src="${avatar}" style="width: 100%; aspect-ratio: 1; border-radius: 50%; overflow: hidden; cursor: pointer; border: 2px solid ${avatar === currentProfilePic ? "var(--brand)" : "transparent"}; transition: all 0.15s; position: relative;">
                <img src="${avatar}" style="width: 100%; height: 100%; object-fit: cover;" />
                ${avatar === currentProfilePic ? '<div style="position: absolute; inset: 0; background: rgba(79, 158, 255, 0.3); display: flex; align-items: center; justify-content: center;"><i class="fas fa-check" style="color: #fff; font-size: 12px;"></i></div>' : ""}
              </div>
            `
            ).join("")}
          </div>
        </div>

        <div style="display: flex; gap: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.08); flex-shrink: 0;">
          <button id="profile-save-btn" style="flex: 2; padding: 10px; background: linear-gradient(to right, #47b230, #5ab941); border: none; border-radius: 6px; color: #fff; font-weight: 600; cursor: pointer; transition: all 0.15s; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 13px;">
            <i class="fas fa-save"></i> Save Changes
          </button>
          <button id="profile-reset-btn" style="flex: 1; padding: 10px; background: rgba(255,255,255,0.08); border: none; border-radius: 6px; color: var(--tx2); cursor: pointer; transition: all 0.15s; font-size: 13px;">
            <i class="fas fa-undo"></i> Reset
          </button>
        </div>

        <div id="profile-status" style="text-align: center; font-size: 11px; color: #5ab941; opacity: 0; transition: opacity 0.3s; height: 14px; margin-top: -4px;">Profile updated!</div>
      </div>`,
          events: {
            "#profile-username-input": {
              input: {
                type: "custom:updatePreviewName",
                stopPropagation: false
              }
            },
            "#profile-upload-btn": {
              click: {
                type: "custom:uploadImage",
                stopPropagation: true
              }
            },
            ".avatar-option": {
              click: {
                type: "custom:selectAvatar",
                stopPropagation: true
              }
            },
            "#profile-save-btn": {
              click: {
                type: "custom:saveProfile",
                stopPropagation: true
              }
            },
            "#profile-reset-btn": {
              click: {
                type: "custom:resetProfile",
                stopPropagation: true
              }
            }
          }
        }
      ],
      state: {
        initial: {
          username: currentUsername,
          profilePicture: currentProfilePic,
          selectedAvatar: currentProfilePic,
          customImageDataUrl: null
        },
        persistence: PersistenceTypes.LOCAL_STORAGE
      },
      actions: {
        initProfileCustomizer: (payload, event, element, state) => {
          this.initProfileCustomizer(payload, event, element, state);
        },
        updatePreviewName: (payload, event, element, state) => {
          console.log("Update preview name");
        },
        uploadImage: (payload, event, element, state) => {
          console.log("Upload image clicked");
        },
        selectAvatar: (payload, event, element, state) => {
          console.log("Select avatar clicked");
        },
        saveProfile: (payload, event, element, state) => {
          console.log("Save profile clicked");
        },
        resetProfile: (payload, event, element, state) => {
          console.log("Reset profile clicked");
        }
      },
      onMount: "initProfileCustomizer"
    };
  }

  initProfileCustomizer(payload, event, element, state) {
    const currentUsername = localStorage.getItem(STORAGE_KEYS.username) || "Reeyuki";
    const currentProfilePic =
      localStorage.getItem(STORAGE_KEYS.profilePicture) || resolveIconUrl("static/icons/guest.webp");
    this._bindEvents(element, currentUsername, currentProfilePic);
  }

  open() {
    if (this._isSingletonOpen("profile-customizer")) return;
    return super.open();
  }

  _setupEventListener() {
    this._services.eventBus.on(BusEvents.SESSION_INITIALIZED, (session) => {
      this.updateProfileState(session.name, session.avatar);
    });
  }

  updateProfileState(username, profilePic) {
    localStorage.setItem(STORAGE_KEYS.username, username);
    localStorage.setItem(STORAGE_KEYS.profilePicture, profilePic);

    if (window._settings) {
      window._settings.username = username;
    }

    if (this.settingsApp) {
      this.settingsApp.updateUsername?.(username);
    }

    const startUserSpan = document.querySelector(".start-user span");
    if (startUserSpan) startUserSpan.textContent = username;

    const startUserImg = document.querySelector(".start-user img");
    if (startUserImg) startUserImg.src = profilePic;

    refreshSteamUI();
  }

  setSettingsApp(settingsApp) {
    this.settingsApp = settingsApp;
  }

  _bindEvents(win, originalUsername, originalProfilePic) {
    const usernameInput = win.querySelector("#profile-username-input");
    const uploadBtn = win.querySelector("#profile-upload-btn");
    const saveBtn = win.querySelector("#profile-save-btn");
    const resetBtn = win.querySelector("#profile-reset-btn");
    const previewImg = win.querySelector("#profile-preview-img");
    const previewName = win.querySelector("#profile-preview-name");
    const avatarOptions = win.querySelectorAll(".avatar-option");
    const statusMsg = win.querySelector("#profile-status");

    let selectedAvatar = originalProfilePic;
    let customImageDataUrl = null;

    usernameInput.addEventListener("input", () => {
      previewName.textContent = usernameInput.value || "Reeyuki";
    });

    avatarOptions.forEach((option) => {
      option.addEventListener("click", () => {
        avatarOptions.forEach((opt) => {
          opt.classList.remove("selected");
          opt.style.borderColor = "transparent";
          const check = opt.querySelector("div");
          if (check) check.remove();
        });

        option.classList.add("selected");
        option.style.borderColor = "var(--brand)";
        selectedAvatar = option.dataset.src;
        customImageDataUrl = null;

        option.innerHTML += `
          <div style="position: absolute; inset: 0; background: rgba(79, 158, 255, 0.3); display: flex; align-items: center; justify-content: center;">
            <i class="fas fa-check" style="color: #fff; font-size: 12px;"></i>
          </div>
        `;

        previewImg.src = selectedAvatar;
      });
    });

    uploadBtn.addEventListener("click", () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/png,image/jpeg,image/gif,image/webp,.png,.jpg,.jpeg,.gif,.webp";
      input.style.display = "none";
      document.body.appendChild(input);

      input.addEventListener("change", async () => {
        const file = input.files?.[0];
        input.remove();
        if (!file) return;

        try {
          if (file.size > 2 * 1024 * 1024) {
            customAlert("Image too large. Please use a file under 2MB.");
            return;
          }

          const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ""));
            reader.onerror = () => reject(new Error("Failed to read file"));
            reader.readAsDataURL(file);
          });

          customImageDataUrl = dataUrl;
          selectedAvatar = dataUrl;
          previewImg.src = dataUrl;

          avatarOptions.forEach((opt) => {
            opt.classList.remove("selected");
            opt.style.borderColor = "transparent";
            const check = opt.querySelector("div");
            if (check) check.remove();
          });

          statusMsg.textContent = "Image uploaded!";
          statusMsg.style.opacity = "1";
          setTimeout(() => (statusMsg.style.opacity = "0"), 1500);
        } catch (e) {
          console.error("Upload failed:", e);
        }
      });

      input.click();
    });

    saveBtn.addEventListener("click", () => {
      const newUsername = usernameInput.value.trim() || "Reeyuki";
      const newProfilePic = customImageDataUrl || selectedAvatar;

      localStorage.setItem(STORAGE_KEYS.username, newUsername);
      localStorage.setItem(STORAGE_KEYS.profilePicture, newProfilePic);

      if (window._settings) {
        window._settings.username = newUsername;
      }

      if (this.settingsApp) {
        this.settingsApp.updateUsername?.(newUsername);
      }

      const startUserSpan = document.querySelector(".start-user span");
      if (startUserSpan) startUserSpan.textContent = newUsername;

      const startUserImg = document.querySelector(".start-user img");
      if (startUserImg) startUserImg.src = newProfilePic;

      refreshSteamUI();

      statusMsg.textContent = "Profile updated successfully!";
      statusMsg.style.opacity = "1";
      setTimeout(() => (statusMsg.style.opacity = "0"), 2200);
    });

    resetBtn.addEventListener("click", () => {
      usernameInput.value = originalUsername;
      previewName.textContent = originalUsername;
      selectedAvatar = originalProfilePic;
      customImageDataUrl = null;
      previewImg.src = originalProfilePic;

      avatarOptions.forEach((opt) => {
        opt.classList.remove("selected");
        opt.style.borderColor = "transparent";
        const check = opt.querySelector("div");
        if (check) check.remove();

        if (opt.dataset.src === originalProfilePic) {
          opt.classList.add("selected");
          opt.style.borderColor = "var(--brand)";
          opt.innerHTML += `
            <div style="position: absolute; inset: 0; background: rgba(79, 158, 255, 0.3); display: flex; align-items: center; justify-content: center;">
              <i class="fas fa-check" style="color: #fff; font-size: 12px;"></i>
            </div>
          `;
        }
      });
    });
  }
}
