import { os } from "../framework.js";
import { StorageKeys } from "../StorageKeys.js";
import { PREDEFINED_AVATARS } from "../utils/avatarData.js";
import { getPresence } from "./presence.js";
import { SOCIAL_BASE } from "./socialApi.js";
import { isSocialDisabled } from "./socialSettings.js";
import { setSession, getSession } from "../account/session.js";

let cachedUserId = null;

function currentProfile() {
  const username = String(os.storage.get(StorageKeys.username) || "Anonymous").slice(0, 32);
  const profilePic = os.storage.get(StorageKeys.profilePicture) || "";
  const avatarIndex = PREDEFINED_AVATARS.indexOf(profilePic);
  const bio = String(os.storage.get(StorageKeys.liveBio) || "").slice(0, 300);
  return { username, avatarIndex: avatarIndex >= 0 ? avatarIndex : -1, bio };
}

export function getLiveUserId() {
  if (cachedUserId) return cachedUserId;
  const stored = os.storage.get(StorageKeys.liveUserId);
  if (typeof stored === "string" && stored) cachedUserId = stored;
  return cachedUserId || null;
}

export async function registerLiveIdentity(userId) {
  if (isSocialDisabled()) return null;
  const id = userId || getLiveUserId();
  if (!id) return ensureLiveUserId();
  const { username, avatarIndex, bio } = currentProfile();
  try {
    await fetch(`${SOCIAL_BASE}/live/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: id, username, avatarIndex, bio, presence: getPresence() })
    });
  } catch {}
  return id;
}

export async function ensureLiveUserId() {
  if (isSocialDisabled()) return null;
  const existing = getLiveUserId();
  if (existing) {
    registerLiveIdentity(existing).catch(() => {});
    return existing;
  }
  try {
    const { username, avatarIndex, bio } = currentProfile();
    const res = await fetch(`${SOCIAL_BASE}/live/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, avatarIndex, bio, presence: getPresence() })
    });
    const data = await res.json();
    if (data && data.userId) {
      cachedUserId = data.userId;
      os.storage.set(StorageKeys.liveUserId, data.userId);
      return data.userId;
    }
  } catch {}
  return null;
}

export async function saveBio(bio) {
  if (isSocialDisabled()) return null;
  const id = getLiveUserId();
  if (!id) return null;
  const cleaned = String(bio || "").slice(0, 300);
  try {
    const res = await fetch(`${SOCIAL_BASE}/live/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: id, bio: cleaned })
    });
    if (!res.ok) return null;
    os.storage.set(StorageKeys.liveBio, cleaned);
    return cleaned;
  } catch {
    return null;
  }
}

export function avatarUrlForIndex(avatarIndex) {
  if (typeof avatarIndex === "number" && avatarIndex >= 0 && avatarIndex < PREDEFINED_AVATARS.length) {
    return PREDEFINED_AVATARS[avatarIndex];
  }
  return null;
}

export async function loginWithAccount(identifier, password) {
  if (isSocialDisabled()) return { error: "Social features are disabled. Enable them in Yuki Steam Settings." };
  try {
    const res = await fetch(`${SOCIAL_BASE}/live/account/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.userId) {
      return { error: data.error || "Login failed. Try again." };
    }
    cachedUserId = data.userId;
    os.storage.set(StorageKeys.liveUserId, data.userId);
    os.storage.set(StorageKeys.liveAccount, { nickname: data.nickname || "" });
    registerLiveIdentity(data.userId).catch(() => {});
    setSession({ token: data.token || "", userId: data.userId, nickname: data.nickname || "", updatedAt: Date.now() });
    return { userId: data.userId, nickname: data.nickname };
  } catch {
    return { error: "Could not reach the server." };
  }
}

export async function registerAccount({ nickname, password }) {
  if (isSocialDisabled()) return { error: "Social features are disabled. Enable them in Yuki Steam Settings." };
  const currentId = getLiveUserId();
  try {
    const body = { nickname, password, userId: currentId };
    const res = await fetch(`${SOCIAL_BASE}/live/account/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.userId) {
      return { error: data.error || "Could not create the account." };
    }
    cachedUserId = data.userId;
    os.storage.set(StorageKeys.liveUserId, data.userId);
    os.storage.set(StorageKeys.liveAccount, { nickname: data.nickname || "" });
    registerLiveIdentity(data.userId).catch(() => {});
    setSession({ token: data.token || "", userId: data.userId, nickname: data.nickname || "", updatedAt: Date.now() });
    return { userId: data.userId, nickname: data.nickname };
  } catch {
    return { error: "Could not reach the server." };
  }
}

export function getAccountStatus() {
  return os.storage.get(StorageKeys.liveAccount) || null;
}

export function signOutAccount() {
  os.storage.remove(StorageKeys.liveAccount);
  os.storage.remove(StorageKeys.socialEquipped);
  setSession(null);
}
