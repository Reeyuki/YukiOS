import { BaseApp } from "../core/BaseApp.js";
import { BusEvents } from "../core/EventBus.js";
import { refreshSteamUI } from "../games/games.js";
import { customAlert, showConfirm } from "../shared/dialogs.js";
import { resolveIconUrl } from "../shared/assetResolver.js";
import { PersistenceTypes } from "../runtime/AppSchema.js";
import { os } from "../os/index.js";
import { StorageKeys } from "../StorageKeys.js";

export const PREDEFINED_AVATARS = [
  resolveIconUrl("static/icons/guest.webp"),
  resolveIconUrl("static/icons/helltaker.jpg"),
  resolveIconUrl("static/icons/stardew.webp"),
  resolveIconUrl("static/icons/hollowKnight.webp"),
  resolveIconUrl("static/icons/fancypants2.webp"),
  resolveIconUrl("static/icons/isaac.webp"),
  resolveIconUrl("static/icons/angryBirds.webp"),
  resolveIconUrl("static/icons/nso.webp"),
  resolveIconUrl("static/icons/alienHominid.webp"),
  resolveIconUrl("static/icons/celeste.webp"),
  resolveIconUrl("static/icons/undertale.webp"),
  resolveIconUrl("static/icons/omori.webp"),
  resolveIconUrl("static/icons/inscryption.webp"),
  resolveIconUrl("static/icons/minecraft.webp"),
  resolveIconUrl("static/icons/sonic.webp"),
  resolveIconUrl("static/icons/mario.webp"),
  resolveIconUrl("static/icons/pvz.webp"),
  resolveIconUrl("static/icons/cookie.webp"),
  resolveIconUrl("static/icons/slime.webp"),
  resolveIconUrl("static/icons/doodle.webp"),
  resolveIconUrl("static/icons/star.webp"),
  resolveIconUrl("static/icons/night.webp"),
  resolveIconUrl("static/icons/brotato.webp"),
  resolveIconUrl("static/icons/vampireSurvivors.webp"),
  resolveIconUrl("static/icons/ultrakill.webp"),
  resolveIconUrl("static/icons/fez.webp"),
  resolveIconUrl("static/icons/geometryDash.webp"),
  resolveIconUrl("static/icons/pac-man.webp"),
  resolveIconUrl("static/icons/pokemonred.webp"),
  resolveIconUrl("static/icons/fnaf1.webp"),
  resolveIconUrl("static/icons/ddlc.webp"),
  resolveIconUrl("static/icons/bendy.webp"),
  resolveIconUrl("static/icons/clusterRush.webp")
];

function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class AccountManagerApp extends BaseApp {
  constructor(services) {
    super(services);
    this.settingsApp = null;
    this._setupEventListener();
  }

  getDeclarativeSchema(opts) {
    const currentUserId = os.storage.get(StorageKeys.userId);
    const userHistory = os.storage.get(StorageKeys.userHistory) || [];
    const currentUser = userHistory.find((u) => u.userId === currentUserId) || {
      name: os.storage.get(StorageKeys.username) || "Guest",
      avatar: os.storage.get(StorageKeys.profilePicture) || PREDEFINED_AVATARS[0],
      userId: currentUserId || generateUUID()
    };

    const uniqueWindowId = `account-manager-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return {
      id: uniqueWindowId,
      name: "Accounts",
      icon: "fas fa-users",
      windows: [
        {
          id: uniqueWindowId,
          title: "Accounts",
          size: ["500px", "600px"],
          icon: "fas fa-users",
          iconColor: "var(--brand)",
          style: { left: "300px", top: "100px" },
          ui: `<div class="account-manager-body" style="padding: 16px; display: flex; flex-direction: column; gap: 16px; height: calc(100% - 32px); box-sizing: border-box;">
        
        <div class="account-manager-header" style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 12px; border-bottom: 1px solid var(--glass-border);">
          <div style="font-size: 16px; font-weight: 600; color: var(--text-primary);">User Accounts</div>
          <button id="create-user-btn" style="padding: 8px 16px; background: var(--brand); border: none; border-radius: 6px; color: var(--text-on-brand); font-weight: 600; cursor: pointer; transition: all 0.15s; display: flex; align-items: center; gap: 6px; font-size: 13px;">
            <i class="fas fa-plus"></i> Create User
          </button>
        </div>

        <div class="user-list" style="flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding: 4px;">
          ${this._renderUserList(userHistory, currentUser)}
        </div>

        <div id="account-status" style="text-align: center; font-size: 11px; color: var(--brand); opacity: 0; transition: opacity 0.3s; height: 14px; margin-top: -4px;"></div>
      </div>

      <div class="edit-user-modal" id="edit-user-modal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(8px); z-index: 10000; align-items: center; justify-content: center;">
        <div class="modal-content" style="background: var(--bg-primary); border: 1px solid var(--glass-border); border-radius: 12px; padding: 20px; width: 400px; max-width: 90%; box-shadow: 0 24px 64px rgba(0,0,0,0.65);">
          <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h3 id="modal-title" style="font-size: 16px; font-weight: 600; color: var(--text-primary); margin: 0;">Edit User</h3>
            <button id="modal-close-btn" style="background: none; border: none; color: var(--text-secondary); cursor: pointer; font-size: 16px; padding: 4px;">
              <i class="fas fa-times"></i>
            </button>
          </div>

          <div class="modal-body" style="display: flex; flex-direction: column; gap: 16px;">
            <div class="profile-preview" style="display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 16px; background: var(--brand-dim); border-radius: 8px; border: 1px solid var(--brand);">
              <div class="profile-preview-img" style="width: 64px; height: 64px; border-radius: 50%; overflow: hidden; border: 2px solid var(--brand); flex-shrink: 0;">
                <img id="modal-preview-img" src="" style="width: 100%; height: 100%; object-fit: cover;" />
              </div>
              <div id="modal-preview-name" style="font-size: 15px; font-weight: 600; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"></div>
            </div>

            <div class="profile-section" style="display: flex; flex-direction: column; gap: 6px;">
              <div style="font-size: 12px; font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: 6px;">
                <i class="fas fa-user"></i> Nickname
              </div>
              <input id="modal-username-input" type="text" placeholder="Enter nickname" style="padding: 10px 12px; border-radius: 6px; border: 1px solid var(--glass-border); background: var(--surface-1); color: var(--text-primary); font-size: 14px; outline: none; transition: border-color 0.15s; width: 100%; box-sizing: border-box;" />
            </div>

            <div class="profile-section" style="display: flex; flex-direction: column; gap: 8px;">
              <div style="font-size: 12px; font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: 6px;">
                <i class="fas fa-image"></i> Profile Picture
              </div>

              <button id="modal-avatar-picker-btn" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px; background: var(--brand-dim); border: 1px dashed var(--brand); border-radius: 6px; color: var(--text-primary); cursor: pointer; transition: all 0.15s; font-size: 12px;">
                <i class="fas fa-images"></i>
                <span>Choose Avatar</span>
              </button>
            </div>

            <div style="display: flex; gap: 8px; padding-top: 8px; border-top: 1px solid var(--glass-border);">
              <button id="modal-save-btn" style="flex: 2; padding: 10px; background: var(--brand); border: none; border-radius: 6px; color: var(--text-on-brand); font-weight: 600; cursor: pointer; transition: all 0.15s; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 13px;">
                <i class="fas fa-save"></i> Save
              </button>
              <button id="modal-cancel-btn" style="flex: 1; padding: 10px; background: var(--glass); border: none; border-radius: 6px; color: var(--text-secondary); cursor: pointer; transition: all 0.15s; font-size: 13px;">
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>`,
          events: {
            "#create-user-btn": {
              click: {
                type: "custom:openCreateModal",
                stopPropagation: true
              }
            },
            ".edit-user-btn": {
              click: {
                type: "custom:openEditModal",
                stopPropagation: true
              }
            },
            ".delete-user-btn": {
              click: {
                type: "custom:deleteUser",
                stopPropagation: true
              }
            },
            ".switch-user-btn": {
              click: {
                type: "custom:switchUser",
                stopPropagation: true
              }
            },
            "#modal-close-btn": {
              click: {
                type: "custom:closeModal",
                stopPropagation: true
              }
            },
            "#modal-cancel-btn": {
              click: {
                type: "custom:closeModal",
                stopPropagation: true
              }
            },
            "#modal-avatar-picker-btn": {
              click: {
                type: "custom:openAvatarPopup",
                stopPropagation: true
              }
            },
            "#modal-save-btn": {
              click: {
                type: "custom:saveUser",
                stopPropagation: true
              }
            },
            "#modal-username-input": {
              input: {
                type: "custom:updatePreview",
                stopPropagation: false
              }
            }
          }
        }
      ],
      state: {
        initial: {
          editingUserId: null,
          selectedAvatar: null,
          customImageDataUrl: null
        },
        persistence: PersistenceTypes.LOCAL_STORAGE
      },
      actions: {
        initAccountManager: (payload, event, element, state) => {
          this.initAccountManager(payload, event, element, state);
        },
        openCreateModal: (payload, event, element, state) => {
          this.openCreateModal(payload, event, element, state);
        },
        openEditModal: (payload, event, element, state) => {
          this.openEditModal(payload, event, element, state);
        },
        deleteUser: (payload, event, element, state) => {
          this.deleteUser(payload, event, element, state);
        },
        switchUser: (payload, event, element, state) => {
          this.switchUser(payload, event, element, state);
        },
        closeModal: (payload, event, element, state) => {
          this.closeModal(payload, event, element, state);
        },
        openAvatarPopup: (payload, event, element, state) => {
          this.openAvatarPopup(payload, event, element, state);
        },
        saveUser: (payload, event, element, state) => {
          this.saveUser(payload, event, element, state);
        },
        updatePreview: (payload, event, element, state) => {
          this.updatePreview(payload, event, element, state);
        },
        closeAvatarPopup: (payload, event, element, state) => {
          this.closeAvatarPopup(payload, event, element, state);
        }
      },
      onMount: "initAccountManager"
    };
  }

  _renderUserList(userHistory, currentUser) {
    if (!userHistory || userHistory.length === 0) {
      return `<div style="text-align: center; padding: 32px; color: var(--text-secondary); font-size: 13px;">No users yet. Create your first account!</div>`;
    }

    return userHistory
      .map((user) => {
        const isCurrentUser = user.userId === currentUser.userId;
        const lastLogin = user.lastLogin ? this._formatTimeAgo(new Date(user.lastLogin)) : "Never";
        return `
        <div class="user-card ${isCurrentUser ? "current-user" : ""}" data-user-id="${user.userId}" style="display: flex; align-items: center; gap: 12px; padding: 12px; background: ${isCurrentUser ? "var(--brand-dim)" : "var(--surface-1)"}; border: 1px solid ${isCurrentUser ? "var(--brand)" : "var(--glass-border)"}; border-radius: 8px; transition: all 0.15s;">
          <div class="user-avatar" style="width: 48px; height: 48px; border-radius: 50%; overflow: hidden; border: 2px solid ${isCurrentUser ? "var(--brand)" : "var(--glass-border)"}; flex-shrink: 0;">
            <img src="${user.avatar}" style="width: 100%; height: 100%; object-fit: cover;" />
          </div>
          <div class="user-info" style="flex: 1; min-width: 0;">
            <div class="user-name" style="font-size: 14px; font-weight: 600; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${user.name}</div>
            <div class="user-meta" style="font-size: 11px; color: var(--text-secondary); display: flex; align-items: center; gap: 6px;">
              ${isCurrentUser ? '<i class="fas fa-check-circle" style="color: var(--brand);"></i> Current' : `Last login: ${lastLogin}`}
            </div>
          </div>
          <div class="user-actions" style="display: flex; gap: 6px;">
            <button class="edit-user-btn" data-user-id="${user.userId}" style="padding: 6px 10px; background: var(--glass); border: 1px solid var(--glass-border); border-radius: 4px; color: var(--text-primary); cursor: pointer; transition: all 0.15s; font-size: 12px;">
              <i class="fas fa-edit"></i>
            </button>
            ${
              !isCurrentUser
                ? `
            <button class="switch-user-btn" data-user-id="${user.userId}" style="padding: 6px 10px; background: var(--brand-dim); border: 1px solid var(--brand); border-radius: 4px; color: var(--text-primary); cursor: pointer; transition: all 0.15s; font-size: 12px;">
              <i class="fas fa-sign-in-alt"></i>
            </button>
            `
                : ""
            }
            <button class="delete-user-btn" data-user-id="${user.userId}" style="padding: 6px 10px; background: ${isCurrentUser ? "var(--glass)" : "rgba(239, 68, 68, 0.2)"}; border: 1px solid ${isCurrentUser ? "var(--glass-border)" : "rgba(239, 68, 68, 0.4)"}; border-radius: 4px; color: ${isCurrentUser ? "var(--text-secondary)" : "#ef4444"}; cursor: ${isCurrentUser ? "not-allowed" : "pointer"}; transition: all 0.15s; font-size: 12px;" ${isCurrentUser ? "disabled" : ""}>
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      `;
      })
      .join("");
  }

  _formatTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  initAccountManager(payload, event, element, state) {
    this._bindGlobalEvents(element);
  }

  _setupEventListener() {
    os.events.on(BusEvents.SESSION_INITIALIZED, (session) => {
      this._refreshUI();
    });
    os.events.on(BusEvents.PROFILE_UPDATED, (data) => {
      this._refreshUI();
    });
  }

  _refreshUI() {
    const userHistory = os.storage.get(StorageKeys.userHistory) || [];
    const currentUserId = os.storage.get(StorageKeys.userId);
    const currentUser = userHistory.find((u) => u.userId === currentUserId);

    const userList = document.querySelector(".user-list");
    if (userList) {
      userList.innerHTML = this._renderUserList(userHistory, currentUser);
      this._bindUserListEvents();
    }
  }

  _bindGlobalEvents(element) {
    const modal = element.querySelector("#edit-user-modal");

    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        this.closeModal();
      }
    });

    this._bindUserListEvents();
  }

  _bindUserListEvents() {
    document.querySelectorAll(".edit-user-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const userId = btn.dataset.userId;
        this.openEditModal(userId);
      });
    });

    document.querySelectorAll(".delete-user-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const userId = btn.dataset.userId;
        this.deleteUser(userId);
      });
    });

    document.querySelectorAll(".switch-user-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const userId = btn.dataset.userId;
        this.switchUser(userId);
      });
    });
  }

  openCreateModal(payload, event, element, state) {
    const modal = document.querySelector("#edit-user-modal");
    const title = document.querySelector("#modal-title");
    const usernameInput = document.querySelector("#modal-username-input");
    const previewImg = document.querySelector("#modal-preview-img");
    const previewName = document.querySelector("#modal-preview-name");

    title.textContent = "Create New User";
    usernameInput.value = "";
    previewImg.src = PREDEFINED_AVATARS[0];
    previewName.textContent = "New User";

    this.editingUserId = null;
    this.selectedAvatar = PREDEFINED_AVATARS[0];
    this.customImageDataUrl = null;

    modal.style.display = "flex";
  }

  openEditModal(userId) {
    const userHistory = os.storage.get(StorageKeys.userHistory) || [];
    const user = userHistory.find((u) => u.userId === userId);
    if (!user) return;

    const modal = document.querySelector("#edit-user-modal");
    const title = document.querySelector("#modal-title");
    const usernameInput = document.querySelector("#modal-username-input");
    const previewImg = document.querySelector("#modal-preview-img");
    const previewName = document.querySelector("#modal-preview-name");

    title.textContent = "Edit User";
    usernameInput.value = user.name;
    previewImg.src = user.avatar;
    previewName.textContent = user.name;

    this.editingUserId = userId;
    this.selectedAvatar = user.avatar;
    this.customImageDataUrl = null;

    modal.style.display = "flex";
  }

  closeModal(payload, event, element, state) {
    const modal = document.querySelector("#edit-user-modal");
    if (modal) modal.style.display = "none";
    this.closeAvatarPopup();
  }

  openAvatarPopup(payload, event, element, state) {
    const avatarGridHtml = `
      <div class="avatar-grid" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; padding: 16px;">
        ${PREDEFINED_AVATARS.map(
          (avatar) => `
          <div class="avatar-option" data-src="${avatar}" style="border-radius: 50%; overflow: hidden; cursor: pointer; border: 2px solid var(--glass-border); transition: all 0.15s; position: relative; aspect-ratio: 1;">
            <img src="${avatar}" style="width: 100%; height: 100%; object-fit: cover;" />
          </div>
        `
        ).join("")}
      </div>
      <div style="padding: 0 16px 16px 16px;">
        <button id="avatar-upload-btn" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px; background: var(--brand-dim); border: 1px dashed var(--brand); border-radius: 6px; color: var(--text-primary); cursor: pointer; transition: all 0.15s; font-size: 12px;">
          <i class="fas fa-upload"></i>
          <span>Upload Custom</span>
        </button>
      </div>
    `;

    this.avatarWindow = os.window.create("avatar-picker", "Choose Avatar", "320px", "400px", {
      icon: "fas fa-images",
      iconColor: "var(--brand)"
    });

    const windowContent = this.avatarWindow.querySelector(".window-content") || this.avatarWindow;
    windowContent.innerHTML = avatarGridHtml;

    const avatarOptions = this.avatarWindow.querySelectorAll(".avatar-option");
    avatarOptions.forEach((opt) => {
      opt.style.borderColor = "var(--glass-border)";
      if (opt.dataset.src === this.selectedAvatar) {
        opt.style.borderColor = "var(--brand)";
        opt.style.boxShadow = "0 0 0 2px var(--brand)";
      }
      opt.addEventListener("click", (e) => {
        this.selectAvatarFromWindow(e, opt);
      });
    });

    const uploadBtn = this.avatarWindow.querySelector("#avatar-upload-btn");
    if (uploadBtn) {
      uploadBtn.addEventListener("click", (e) => {
        this.uploadAvatarFromWindow(e);
      });
    }

    os.window.bringToFront(this.avatarWindow);
  }

  closeAvatarPopup(payload, event, element, state) {
    if (this.avatarWindow) {
      os.window.close(this.avatarWindow);
      this.avatarWindow = null;
    }
  }

  selectAvatarFromWindow(event, option) {
    const avatarOptions = this.avatarWindow.querySelectorAll(".avatar-option");
    avatarOptions.forEach((opt) => {
      opt.style.borderColor = "var(--glass-border)";
      opt.style.boxShadow = "none";
    });

    option.style.borderColor = "var(--brand)";
    option.style.boxShadow = "0 0 0 2px var(--brand)";
    this.selectedAvatar = option.dataset.src;
    this.customImageDataUrl = null;

    const previewImg = document.querySelector("#modal-preview-img");
    if (previewImg) previewImg.src = this.selectedAvatar;

    os.window.close(this.avatarWindow);
    this.avatarWindow = null;
  }

  uploadAvatarFromWindow(event) {
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

        this.customImageDataUrl = dataUrl;
        this.selectedAvatar = dataUrl;

        const previewImg = document.querySelector("#modal-preview-img");
        if (previewImg) previewImg.src = dataUrl;

        os.window.close(this.avatarWindow);
        this.avatarWindow = null;
      } catch (e) {
        console.error("Upload failed:", e);
      }
    });

    input.click();
  }

  updatePreview(payload, event, element, state) {
    const usernameInput = document.querySelector("#modal-username-input");
    const previewName = document.querySelector("#modal-preview-name");
    if (previewName && usernameInput) previewName.textContent = usernameInput.value || "User";
  }

  saveUser(payload, event, element, state) {
    const usernameInput = document.querySelector("#modal-username-input");
    if (!usernameInput) return;

    const name = usernameInput.value.trim() || "User";
    const avatar = this.customImageDataUrl || this.selectedAvatar;
    const userHistory = os.storage.get(StorageKeys.userHistory) || [];

    if (this.editingUserId) {
      const existingIndex = userHistory.findIndex((u) => u.userId === this.editingUserId);
      if (existingIndex >= 0) {
        userHistory[existingIndex].name = name;
        userHistory[existingIndex].avatar = avatar;
      }
      os.storage.set(StorageKeys.userHistory, userHistory);

      const currentUserId = os.storage.get(StorageKeys.userId);
      if (this.editingUserId === currentUserId) {
        os.storage.set(StorageKeys.username, name);
        os.storage.set(StorageKeys.profilePicture, avatar);
        os.events.emit(BusEvents.PROFILE_UPDATED, {
          userId: currentUserId,
          name: name,
          avatar: avatar
        });
      }

      this._showStatus("User updated successfully!");
    } else {
      const newUserId = generateUUID();
      const newUser = {
        userId: newUserId,
        key: newUserId,
        name: name,
        avatar: avatar,
        lastLogin: Date.now()
      };

      userHistory.unshift(newUser);
      os.storage.set(StorageKeys.userHistory, userHistory);

      os.storage.set(StorageKeys.userId, newUserId);
      os.storage.set(StorageKeys.username, name);
      os.storage.set(StorageKeys.profilePicture, avatar);

      os.events.emit(BusEvents.SESSION_INITIALIZED, newUser);
      this._showStatus("User created successfully!");
    }

    this.closeModal();
    this._refreshUI();
    refreshSteamUI();
  }

  async deleteUser(userId) {
    const currentUserId = os.storage.get(StorageKeys.userId);
    if (userId === currentUserId) {
      customAlert("Cannot delete current user", "Please switch to another account first.");
      return;
    }

    const confirmed = await showConfirm(
      "Delete User",
      "Are you sure you want to delete this user? This action cannot be undone."
    );
    if (!confirmed) return;

    const userHistory = os.storage.get(StorageKeys.userHistory) || [];
    const filteredHistory = userHistory.filter((u) => u.userId !== userId);
    os.storage.set(StorageKeys.userHistory, filteredHistory);

    this._showStatus("User deleted successfully!");
    this._refreshUI();
  }

  async switchUser(userId) {
    const currentUserId = os.storage.get(StorageKeys.userId);
    if (userId === currentUserId) return;

    const userHistory = os.storage.get(StorageKeys.userHistory) || [];
    const user = userHistory.find((u) => u.userId === userId);
    if (!user) return;

    const confirmed = await showConfirm("Switch User", `Switch to ${user.name}?`);
    if (!confirmed) return;

    os.storage.set(StorageKeys.userId, userId);
    os.storage.set(StorageKeys.username, user.name);
    os.storage.set(StorageKeys.profilePicture, user.avatar);

    user.lastLogin = Date.now();
    os.storage.set(StorageKeys.userHistory, userHistory);

    os.events.emit(BusEvents.SESSION_INITIALIZED, user);
    this._showStatus(`Switched to ${user.name}`);
    this._refreshUI();
    refreshSteamUI();
  }

  _showStatus(message) {
    const status = document.querySelector("#account-status");
    if (status) {
      status.textContent = message;
      status.style.opacity = "1";
      setTimeout(() => (status.style.opacity = "0"), 2000);
    }
  }

  setSettingsApp(settingsApp) {
    this.settingsApp = settingsApp;
  }
}
