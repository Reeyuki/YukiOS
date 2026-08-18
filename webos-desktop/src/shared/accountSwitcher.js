import { BusEvents } from "../core/EventBus.js";
import { StorageKeys, os, createElement, $$ } from "../framework.js";

export function getUserHistory() {
  return os.storage.get(StorageKeys.userHistory) || [];
}

export function getCurrentUser() {
  const currentUserId = os.storage.get(StorageKeys.userId);
  const userHistory = getUserHistory();
  return (
    userHistory.find((u) => u.userId === currentUserId) || {
      name: os.storage.get(StorageKeys.username) || "Guest",
      avatar: os.storage.get(StorageKeys.profilePicture) || "",
      userId: currentUserId
    }
  );
}

export function getOtherUsers() {
  const currentUserId = os.storage.get(StorageKeys.userId);
  const userHistory = getUserHistory();
  return userHistory.filter((u) => u.userId !== currentUserId);
}

export async function switchToUser(userId) {
  const userHistory = getUserHistory();
  const user = userHistory.find((u) => u.userId === userId);
  if (!user) return false;

  os.storage.set(StorageKeys.userId, userId);
  os.storage.set(StorageKeys.username, user.name);
  os.storage.set(StorageKeys.profilePicture, user.avatar);

  user.lastLogin = Date.now();
  os.storage.set(StorageKeys.userHistory, userHistory);

  os.events.emit(BusEvents.SESSION_INITIALIZED, user);
  return true;
}

export function showAccountSwitchDialog(container, onSwitch) {
  const otherUsers = getOtherUsers();
  
  if (otherUsers.length === 0) {
    return null;
  }

  const userOptions = otherUsers.map((user) => ({
    id: user.userId,
    label: user.name,
    avatar: user.avatar
  }));

  let selectedUserId = userOptions[0]?.id;

  const dialog = createElement("div");
  dialog.className = "deck-account-dialog";
  dialog.style.position = "fixed";
  dialog.style.inset = "0";
  dialog.style.zIndex = "999999";
  dialog.style.display = "flex";
  dialog.style.alignItems = "center";
  dialog.style.justifyContent = "center";
  dialog.style.background = "rgba(0, 0, 0, 0.8)";

  const dialogContent = createElement("div");
  dialogContent.style.background = "rgb(13, 20, 25)";
  dialogContent.style.padding = "24px";
  dialogContent.style.borderRadius = "8px";
  dialogContent.style.maxWidth = "400px";
  dialogContent.style.width = "100%";

  const title = createElement("div");
  title.textContent = "Switch Account";
  title.style.fontSize = "20px";
  title.style.fontWeight = "700";
  title.style.color = "var(--text-primary)";
  title.style.marginBottom = "16px";

  const userList = createElement("div");
  userList.className = "deck-account-list";
  userList.style.display = "flex";
  userList.style.flexDirection = "column";
  userList.style.gap = "8px";

  userOptions.forEach((option) => {
    const userBtn = createElement("div");
    userBtn.className = "deck-account-option";
    userBtn.style.display = "flex";
    userBtn.style.alignItems = "center";
    userBtn.style.gap = "12px";
    userBtn.style.padding = "12px";
    userBtn.style.background = "var(--glass)";
    userBtn.style.border = "1px solid var(--glass-border)";
    userBtn.style.borderRadius = "8px";
    userBtn.style.cursor = "pointer";
    userBtn.style.transition = "all 0.2s ease";

    if (option.id === selectedUserId) {
      userBtn.style.background = "var(--brand)";
      userBtn.style.borderColor = "var(--brand)";
    }

    const avatarImg = createElement("img");
    avatarImg.src = option.avatar;
    avatarImg.style.width = "40px";
    avatarImg.style.height = "40px";
    avatarImg.style.borderRadius = "50%";
    avatarImg.style.objectFit = "cover";

    const nameLabel = createElement("span");
    nameLabel.textContent = option.label;
    nameLabel.style.fontSize = "14px";
    nameLabel.style.fontWeight = "600";
    nameLabel.style.color = option.id === selectedUserId ? "var(--text-on-brand)" : "var(--text-primary)";

    userBtn.appendChild(avatarImg);
    userBtn.appendChild(nameLabel);

    userBtn.addEventListener("click", () => {
      selectedUserId = option.id;
      $$(".deck-account-option", userList).forEach((btn) => {
        btn.style.background = "var(--glass)";
        btn.style.borderColor = "var(--glass-border)";
        btn.querySelector("span").style.color = "var(--text-primary)";
      });
      userBtn.style.background = "var(--brand)";
      userBtn.style.borderColor = "var(--brand)";
      userBtn.querySelector("span").style.color = "var(--text-on-brand)";
    });

    userList.appendChild(userBtn);
  });

  const buttonRow = createElement("div");
  buttonRow.style.display = "flex";
  buttonRow.style.gap = "12px";
  buttonRow.style.marginTop = "20px";

  const switchBtn = createElement("button");
  switchBtn.textContent = "Switch";
  switchBtn.style.flex = "1";
  switchBtn.style.padding = "12px";
  switchBtn.style.background = "var(--brand)";
  switchBtn.style.color = "var(--text-on-brand)";
  switchBtn.style.border = "none";
  switchBtn.style.borderRadius = "6px";
  switchBtn.style.fontSize = "14px";
  switchBtn.style.fontWeight = "600";
  switchBtn.style.cursor = "pointer";

  const cancelBtn = createElement("button");
  cancelBtn.textContent = "Cancel";
  cancelBtn.style.flex = "1";
  cancelBtn.style.padding = "12px";
  cancelBtn.style.background = "var(--glass)";
  cancelBtn.style.color = "var(--text-primary)";
  cancelBtn.style.border = "1px solid var(--glass-border)";
  cancelBtn.style.borderRadius = "6px";
  cancelBtn.style.fontSize = "14px";
  cancelBtn.style.fontWeight = "600";
  cancelBtn.style.cursor = "pointer";

  switchBtn.addEventListener("click", () => {
    if (selectedUserId) {
      onSwitch(selectedUserId);
    }
    dialog.remove();
  });

  cancelBtn.addEventListener("click", () => {
    dialog.remove();
  });

  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) {
      dialog.remove();
    }
  });

  buttonRow.appendChild(switchBtn);
  buttonRow.appendChild(cancelBtn);

  dialogContent.appendChild(title);
  dialogContent.appendChild(userList);
  dialogContent.appendChild(buttonRow);
  dialog.appendChild(dialogContent);

  container.appendChild(dialog);

  return dialog;
}
