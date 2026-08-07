import { SOCIAL_BASE } from "./endpoints.js";
import { isSocialDisabled } from "./socialSettings.js";
export { SOCIAL_BASE };
function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}
const DISCOVER_TTL_MS = 30 * 1000;
let discoverCache = null;
let discoverCacheTime = 0;
let discoverPromise = null;

export function minutesToLabel(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  if (total < 60) return `${total}m`;
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
}

export function formatRelativeTime(value) {
  if (!value) return "Never online";
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return "Never online";
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "Just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function isUserOnline(user, ttlMs = 5 * 60 * 1000) {
  if (user.nowPlaying) return true;
  if (!user.lastSeen) return false;
  const ts = new Date(user.lastSeen).getTime();
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts < ttlMs;
}

export async function fetchDiscover({ refresh = false } = {}) {
  if (isSocialDisabled()) return [];
  if (!refresh && discoverCache && Date.now() - discoverCacheTime < DISCOVER_TTL_MS) {
    return discoverCache;
  }
  if (discoverPromise) return discoverPromise;
  discoverPromise = (async () => {
    try {
      const res = await fetchWithTimeout(`${SOCIAL_BASE}/api/discover`);
      if (!res.ok) return discoverCache || [];
      const data = await res.json();
      const users = Array.isArray(data.users) ? data.users : [];
      discoverCache = users;
      discoverCacheTime = Date.now();
      return users;
    } catch {
      return discoverCache || [];
    } finally {
      discoverPromise = null;
    }
  })();
  return discoverPromise;
}

export async function reportAchievements(userId, achievements) {
  if (isSocialDisabled()) return;
  if (!userId || !achievements || achievements.length === 0) return;
  try {
    await fetchWithTimeout(`${SOCIAL_BASE}/api/achievements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, achievements })
    });
  } catch {}
}

export async function socialGet(path) {
  try {
    const res = await fetchWithTimeout(`${SOCIAL_BASE}${path}`);
    if (!res.ok) return null;
    return await res.json().catch(() => null);
  } catch {
    return null;
  }
}

export async function socialPost(path, body) {
  try {
    const res = await fetchWithTimeout(`${SOCIAL_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "Could not reach the server." } };
  }
}

export async function socialDelete(path, body) {
  try {
    const res = await fetchWithTimeout(`${SOCIAL_BASE}${path}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "Could not reach the server." } };
  }
}
