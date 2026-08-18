import { PREDEFINED_AVATARS } from "../utils/avatarData.js";
import { avatarUrlForIndex } from "../social/userIdentity.js";
import { liveActivityManager } from "../social/liveActivityManager.js";
import { fetchGamePlayCounts } from "../analytics.js";
import { fetchFriends, getCachedFriends } from "../social/friendsApi.js";
import { escapeHtml as esc } from "../utils/utils.js";

export const avatarSrcForIndex = (avatarIndex) => avatarUrlForIndex(avatarIndex) || PREDEFINED_AVATARS[0];

export function achievementsPercent(totalMin) {
  if (!totalMin) return 0;
  return Math.min(100, Math.round((totalMin / (60 * 30)) * 100));
}

export async function fetchCommunityOverview(appId) {
  const normalized = String(appId).toLowerCase();
  const [counts, nowPlaying, recentPlayers] = await Promise.all([
    fetchGamePlayCounts().catch(() => ({})),
    liveActivityManager.getNowPlaying().catch(() => []),
    liveActivityManager.getRecentPlayers(normalized).catch(() => [])
  ]);
  const playCount = counts[normalized] || 0;
  const playingNow = nowPlaying.filter((u) => String(u.appId || "").toLowerCase() === normalized);
  return { playCount, playingNow, recentPlayers: recentPlayers.slice(0, 6) };
}

export async function fetchActivityOverview() {
  let friends = [];
  try {
    const data = await fetchFriends();
    friends = Array.isArray(data?.friends) ? data.friends : [];
  } catch {}
  if (friends.length === 0) {
    const cached = getCachedFriends();
    friends = Array.isArray(cached?.friends) ? cached.friends : [];
  }
  const count = friends.length;
  return { friends: friends.slice(0, 12), count };
}

export function buildPlayerRows(recentPlayers, playingNow, classes) {
  return recentPlayers
    .map((u) => `
      <div class="${classes.row}">
        <img class="${classes.avatar}" src="${avatarSrcForIndex(u.avatarIndex)}" alt="">
        <div class="${classes.info}">
          <b>${esc(u.username || "Guest")}</b>
          <span>${playingNow.some((p) => p.userId && p.userId === u.userId) ? "Playing right now" : "Played recently"}</span>
        </div>
      </div>
    `)
    .join("");
}

export function buildFriendCards(friends, count, classes) {
  return friends
    .map((f) => `
      <div class="${classes.row}">
        <img class="${classes.avatar}" src="${avatarSrcForIndex(f.avatarIndex)}" alt="">
        <div class="${classes.info}">
          <b>${esc(f.username || "Friend")}</b>
          <span>${f.note ? esc(f.note) : count > 1 ? "Recently played together" : "On your friends list"}</span>
        </div>
      </div>
    `)
    .join("");
}

export function buildAvatarStrip(friends, className) {
  return friends.map((f) => `<img class="${className}" src="${avatarSrcForIndex(f.avatarIndex)}" alt="">`).join("");
}
