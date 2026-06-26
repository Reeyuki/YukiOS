import { BusEvents } from "../core/EventBus.js";
import { refreshSteamUI } from "../games/games.js";
import { resolveAvatarUrl } from "../shared/avatarResolver.js";
import { PREDEFINED_AVATARS, generateUUID } from "../utils/avatarData.js";
import { StorageKeys, os } from "../framework.js";
import { $, $$, bindEvent, setText, setHTML } from "../shared/domUtils.js";
import { showContextMenu } from "../shared/contextMenu.js";

let _win = null;
let _selectedUserId = null;
let _selectedAvatar = null;
let _customImageDataUrl = null;
let _avatarWindow = null;
let _isCreating = false;

function getCurrentUser() {
  const currentUserId = os.storage.get(StorageKeys.userId);
  const userHistory = os.storage.get(StorageKeys.userHistory) || [];
  return (
    userHistory.find((u) => u.userId === currentUserId) || {
      name: os.storage.get(StorageKeys.username) || "Guest",
      avatar: os.storage.get(StorageKeys.profilePicture) || PREDEFINED_AVATARS[0],
      userId: currentUserId || generateUUID()
    }
  );
}

function getUserHistory() {
  return os.storage.get(StorageKeys.userHistory) || [];
}

function getSelectedUser() {
  const history = getUserHistory();
  const user = _selectedUserId ? history.find((u) => u.userId === _selectedUserId) : null;
  return user || getCurrentUser();
}

function formatTimeAgo(date) {
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

function showStatus(message) {
  const status = $("#account-status", _win);
  if (status) {
    setText(status, message);
    status.style.opacity = "1";
    setTimeout(() => (status.style.opacity = "0"), 2000);
  }
}

export function renderUserList() {
  const userHistory = getUserHistory();
  const currentUser = getCurrentUser();

  if (!userHistory || userHistory.length === 0) {
    return `<div class="accounts-empty">No users yet. Add one!</div>`;
  }

  return userHistory
    .map((user) => {
      const isCurrentUser = user.userId === currentUser.userId;
      const isSelected = user.userId === (_selectedUserId || currentUser.userId);
      const lastLogin = user.lastLogin ? formatTimeAgo(new Date(user.lastLogin)) : "Never";
      return `
        <div class="accounts-user-item ${isSelected ? "selected" : ""} ${isCurrentUser ? "current" : ""}"
             data-user-id="${user.userId}" data-avatar="${user.avatar}">
          <div class="accounts-user-avatar">
            <img class="accounts-avatar-img" data-avatar-ref="${user.avatar}" src="${user.avatar}" />
          </div>
          <div class="accounts-user-info">
            <div class="accounts-user-name">${user.name}</div>
            <div class="accounts-user-meta">
              ${isCurrentUser ? '<i class="fas fa-check-circle"></i> Current' : `Last: ${lastLogin}`}
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

export function getAccountsDetailHTML() {
  const user = getSelectedUser();
  const currentUser = getCurrentUser();
  const isCurrentUser = user.userId === currentUser.userId && !_isCreating;
  const nameValue = _isCreating ? "" : user.name;

  return `
    <div class="accounts-detail-body">
      <div class="accounts-detail-avatar-section">
        <div class="accounts-detail-avatar" id="accounts-avatar-preview">
          <img id="accounts-detail-avatar-img" src="${user.avatar}" />
        </div>
        <button class="settings-btn" id="accounts-choose-avatar-btn" style="font-size: 12px; padding: 6px 12px;">
          <i class="fas fa-images"></i> Choose Avatar
        </button>
      </div>
      <div class="accounts-detail-fields">
        <div class="accounts-detail-field">
          <label><i class="fas fa-user"></i> Nickname</label>
          <input type="text" id="accounts-username-input" value="${nameValue}" placeholder="Enter nickname" />
        </div>
      </div>
    </div>
    <div class="accounts-detail-footer">
      <div class="accounts-detail-actions-left">
        ${
          !_isCreating && !isCurrentUser
            ? `
          <button class="settings-btn" id="accounts-switch-btn" style="font-size: 12px; padding: 6px 12px;">
            <i class="fas fa-sign-in-alt"></i> Switch
          </button>
          <button class="settings-btn" id="accounts-delete-btn" style="font-size: 12px; padding: 6px 12px; color: var(--error); border-color: var(--error);">
            <i class="fas fa-trash"></i> Delete
          </button>
        `
            : ""
        }
      </div>
      <div class="accounts-detail-actions-right">
        <button class="settings-btn" id="accounts-apply-btn" style="background: var(--brand); color: var(--text-on-brand); border: none;">
          <i class="fas fa-check"></i> Apply
        </button>
      </div>
    </div>
  `;
}

export function renderAccountsSettings() {
  const currentUser = getCurrentUser();
  _selectedUserId = currentUser.userId;
  _selectedAvatar = currentUser.avatar;
  _customImageDataUrl = null;
  _isCreating = false;

  return `
    <div id="pane-accounts" class="settings-category-pane">
      <div class="settings-category-header">Accounts</div>
      <div class="accounts-layout">
        <div class="accounts-sidebar">
          <div class="accounts-sidebar-header">
            <span>Users</span>
            <button class="settings-btn" id="accounts-create-btn" style="padding: 4px 10px; font-size: 12px;">
              <i class="fas fa-plus"></i>
            </button>
          </div>
          <div class="accounts-user-list" id="accounts-user-list">
            ${renderUserList()}
          </div>
        </div>
        <div class="accounts-detail" id="accounts-detail">
          ${getAccountsDetailHTML()}
        </div>
      </div>
      <div id="account-status" class="accounts-status"></div>
    </div>
  `;
}

async function refreshAvatarImages() {
  const imgs = $$(".accounts-avatar-img", _win);
  await Promise.all(
    Array.from(imgs).map(async (img) => {
      const avatarRef = img.dataset.avatarRef;
      if (avatarRef && avatarRef.startsWith("fs://")) {
        const resolvedUrl = await resolveAvatarUrl(avatarRef);
        img.src = resolvedUrl;
      }
    })
  );
}

function refreshUserList() {
  const list = $("#accounts-user-list", _win);
  if (list) {
    setHTML(list, renderUserList());
    bindUserListItemEvents();
    refreshAvatarImages();
  }
}

function refreshDetailPanel() {
  const detail = $("#accounts-detail", _win);
  if (detail) {
    setHTML(detail, getAccountsDetailHTML());
    bindDetailEvents();
  }
}

function buildUserContextMenu(userId) {
  const currentUser = getCurrentUser();
  const isCurrentUser = userId === currentUser.userId;
  const items = [];

  if (!isCurrentUser) {
    items.push({ id: "cm-accounts-switch", label: "Switch", icon: "fa-sign-in-alt", action: "switch" });
  }
  if (!isCurrentUser) {
    items.push("hr");
    items.push({ id: "cm-accounts-delete", label: "Delete", icon: "fa-trash", action: "delete" });
  }
  return items;
}

function bindUserListItemEvents() {
  $$(".accounts-user-item", _win).forEach((item) => {
    bindEvent(item, "click", () => {
      const userId = item.dataset.userId;
      _selectedUserId = userId;
      _isCreating = false;
      const history = getUserHistory();
      const user = history.find((u) => u.userId === userId);
      if (user) {
        _selectedAvatar = user.avatar;
        _customImageDataUrl = null;
      }
      refreshUserList();
      refreshDetailPanel();
    });

    bindEvent(item, "contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const userId = item.dataset.userId;
      _selectedUserId = userId;
      _isCreating = false;
      refreshUserList();
      refreshDetailPanel();

      const items = buildUserContextMenu(userId);
      if (!items.length) return;
      showContextMenu(e, items, {
        switch: () => {
          switchUser();
        },
        delete: () => {
          deleteUser();
        }
      });
    });
  });
}

function bindDetailEvents() {
  bindEvent($("#accounts-apply-btn", _win), "click", applyAction);
  bindEvent($("#accounts-create-btn", _win), "click", startCreateNewUser);
  bindEvent($("#accounts-choose-avatar-btn", _win), "click", openAvatarPicker);

  const switchBtn = $("#accounts-switch-btn", _win);
  if (switchBtn) bindEvent(switchBtn, "click", switchUser);

  const deleteBtn = $("#accounts-delete-btn", _win);
  if (deleteBtn) bindEvent(deleteBtn, "click", deleteUser);
}

function applyAction() {
  if (_isCreating) {
    createNewUser();
  } else {
    saveUser();
  }
}

function saveUser() {
  const usernameInput = $("#accounts-username-input", _win);
  if (!usernameInput) return;

  const name = usernameInput.value.trim() || "User";
  const avatar = _customImageDataUrl || _selectedAvatar;
  const userHistory = getUserHistory();

  const editingUserId = _selectedUserId;
  if (!editingUserId) return;

  const existingIndex = userHistory.findIndex((u) => u.userId === editingUserId);
  if (existingIndex >= 0) {
    userHistory[existingIndex].name = name;
    userHistory[existingIndex].avatar = avatar;
  }
  os.storage.set(StorageKeys.userHistory, userHistory);

  const currentUserId = os.storage.get(StorageKeys.userId);
  if (editingUserId === currentUserId) {
    os.storage.set(StorageKeys.username, name);
    os.storage.set(StorageKeys.profilePicture, avatar);
    os.events.emit(BusEvents.PROFILE_UPDATED, {
      userId: currentUserId,
      name,
      avatar
    });
  }

  showStatus("User updated successfully!");
  refreshUserList();
  refreshDetailPanel();
  refreshSteamUI();
}

function startCreateNewUser() {
  _isCreating = true;
  _selectedUserId = null;
  _selectedAvatar = PREDEFINED_AVATARS[0];
  _customImageDataUrl = null;
  refreshUserList();
  refreshDetailPanel();
}

function createNewUser() {
  const usernameInput = $("#accounts-username-input", _win);
  const name = usernameInput ? usernameInput.value.trim() || "New User" : "New User";
  const avatar = _customImageDataUrl || _selectedAvatar || PREDEFINED_AVATARS[0];
  const userHistory = getUserHistory();

  const newUserId = generateUUID();
  const newUser = {
    userId: newUserId,
    key: newUserId,
    name,
    avatar,
    lastLogin: Date.now()
  };

  userHistory.unshift(newUser);
  os.storage.set(StorageKeys.userHistory, userHistory);

  os.storage.set(StorageKeys.userId, newUserId);
  os.storage.set(StorageKeys.username, name);
  os.storage.set(StorageKeys.profilePicture, avatar);

  _isCreating = false;
  _selectedUserId = newUserId;

  os.events.emit(BusEvents.SESSION_INITIALIZED, newUser);
  showStatus("User created successfully!");
  refreshUserList();
  refreshDetailPanel();
  refreshSteamUI();
}

async function deleteUser() {
  const currentUser = getCurrentUser();
  if (_selectedUserId === currentUser.userId) {
    os.dialog.alert("Cannot Delete", "You cannot delete the currently active user. Switch to another user first.");
    return;
  }

  const userHistory = getUserHistory();
  const user = userHistory.find((u) => u.userId === _selectedUserId);
  if (!user) return;

  const confirmed = await os.dialog.confirm("Delete User", `Delete "${user.name}"? This cannot be undone.`);
  if (!confirmed) return;

  const filtered = userHistory.filter((u) => u.userId !== _selectedUserId);
  os.storage.set(StorageKeys.userHistory, filtered);

  _selectedUserId = currentUser.userId;
  _selectedAvatar = currentUser.avatar;
  _customImageDataUrl = null;

  showStatus(`Deleted ${user.name}`);
  refreshUserList();
  refreshDetailPanel();
  refreshSteamUI();
}

async function switchUser() {
  const currentUserId = os.storage.get(StorageKeys.userId);
  if (_selectedUserId === currentUserId) return;

  const userHistory = getUserHistory();
  const user = userHistory.find((u) => u.userId === _selectedUserId);
  if (!user) return;

  const confirmed = await os.dialog.confirm("Switch User", `Switch to ${user.name}?`);
  if (!confirmed) return;

  os.storage.set(StorageKeys.userId, _selectedUserId);
  os.storage.set(StorageKeys.username, user.name);
  os.storage.set(StorageKeys.profilePicture, user.avatar);

  user.lastLogin = Date.now();
  os.storage.set(StorageKeys.userHistory, userHistory);

  os.events.emit(BusEvents.SESSION_INITIALIZED, user);
  showStatus(`Switched to ${user.name}`);
  refreshUserList();
  refreshDetailPanel();
  refreshSteamUI();
}

function openAvatarPicker() {
  const avatarGridHtml = `
    <div class="accounts-avatar-grid" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; padding: 16px;">
      ${PREDEFINED_AVATARS.map(
        (avatar) => `
        <div class="accounts-avatar-option" data-src="${avatar}" style="width: 64px; height: 64px; border-radius: 50%; overflow: hidden; cursor: pointer; border: 2px solid var(--glass-border); transition: all 0.15s;">
          <img src="${avatar}" style="width: 100%; height: 100%; object-fit: cover;" />
        </div>
      `
      ).join("")}
    </div>
    <div style="padding: 0 16px 16px;">
      <button id="accounts-avatar-upload-btn" style="width: 100%; padding: 10px; background: var(--brand-dim); border: 1px dashed var(--brand); border-radius: 6px; color: var(--text-primary); cursor: pointer; font-size: 12px; display: flex; align-items: center; justify-content: center; gap: 8px;">
        <i class="fas fa-upload"></i> Upload Custom
      </button>
    </div>
  `;

  if (_avatarWindow) {
    os.window.close(_avatarWindow);
    _avatarWindow = null;
  }

  _avatarWindow = os.window.create("accounts-avatar-picker", "Choose Avatar", "320px", "400px", {
    icon: "fas fa-images",
    iconColor: "var(--brand)"
  });

  const windowContent = _avatarWindow.querySelector(".window-content") || _avatarWindow;
  windowContent.innerHTML = avatarGridHtml;

  const user = getSelectedUser();
  $$(".accounts-avatar-option", _avatarWindow).forEach((opt) => {
    if (opt.dataset.src === _selectedAvatar) {
      opt.style.borderColor = "var(--brand)";
      opt.style.boxShadow = "0 0 0 2px var(--brand)";
    }
    bindEvent(opt, "click", () => selectAvatar(opt));
  });

  bindEvent($("#accounts-avatar-upload-btn", _avatarWindow), "click", uploadAvatar);
  os.window.bringToFront(_avatarWindow);
}

function selectAvatar(option) {
  $$(".accounts-avatar-option", _avatarWindow).forEach((opt) => {
    opt.style.borderColor = "var(--glass-border)";
    opt.style.boxShadow = "none";
  });
  option.style.borderColor = "var(--brand)";
  option.style.boxShadow = "0 0 0 2px var(--brand)";
  _selectedAvatar = option.dataset.src;
  _customImageDataUrl = null;

  const detailImg = $("#accounts-detail-avatar-img", _win);
  if (detailImg) detailImg.src = _selectedAvatar;

  if (_avatarWindow) {
    os.window.close(_avatarWindow);
    _avatarWindow = null;
  }
}

async function uploadAvatar() {
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
        os.dialog.alert("Alert", "That image is too big. Keep it under 2MB.");
        return;
      }

      const currentUserId = os.storage.get(StorageKeys.userId) || generateUUID();
      const fileName = `avatar-${currentUserId}.${file.name.split(".").pop()}`;

      await os.fs.writeBinaryFile(["Pictures"], fileName, file, "image", "static/icons/image.webp");
      const fileRef = `fs://Pictures/${fileName}`;

      _customImageDataUrl = fileRef;
      _selectedAvatar = fileRef;

      const detailImg = $("#accounts-detail-avatar-img", _win);
      if (detailImg) {
        const blob = await os.fs.readBinaryFile(["Pictures"], fileName);
        if (blob) detailImg.src = URL.createObjectURL(blob);
      }

      if (_avatarWindow) {
        os.window.close(_avatarWindow);
        _avatarWindow = null;
      }
    } catch (e) {
      console.error("Upload failed:", e);
      os.dialog.alert("Upload Failed", "Couldn't save that avatar. Try a smaller image.");
    }
  });

  input.click();
}

export function bindAccountsCategory(win) {
  _win = win;

  os.events.on(BusEvents.SESSION_INITIALIZED, () => {
    if (_win && _win.isConnected) {
      refreshUserList();
      refreshDetailPanel();
    }
  });
  os.events.on(BusEvents.PROFILE_UPDATED, () => {
    if (_win && _win.isConnected) {
      refreshUserList();
      refreshDetailPanel();
    }
  });

  bindUserListItemEvents();
  bindDetailEvents();
  refreshAvatarImages();
}
