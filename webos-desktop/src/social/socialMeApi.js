import { StorageKeys, os } from "../framework.js";
import { getLiveUserId } from "./userIdentity.js";
import { socialGet, socialPost, socialDelete } from "./socialApi.js";

let meCache = null;
let meTime = 0;

export async function fetchSocialMe({ refresh = false } = {}) {
  const userId = getLiveUserId();
  if (!userId) return null;
  if (!refresh && meCache && Date.now() - meTime < 15 * 1000) return meCache;
  const data = await socialGet(`/live/social/me?userId=${encodeURIComponent(userId)}`);
  if (!data || !data.userId) return null;
  meCache = data;
  meTime = Date.now();
  os.storage.set(StorageKeys.socialCoins, typeof data.coins === "number" ? data.coins : 0);
  os.storage.set(StorageKeys.socialInventory, Array.isArray(data.inventory) ? data.inventory : []);
  os.storage.set(StorageKeys.socialStreak, typeof data.streak === "number" ? data.streak : 0);
  return data;
}

export function invalidateSocialMe() {
  meCache = null;
  meTime = 0;
}

export function getCachedSocialMe() {
  return meCache;
}

export async function fetchQuests() {
  const userId = getLiveUserId();
  if (!userId) return [];
  const data = await socialGet(`/live/quests?userId=${encodeURIComponent(userId)}`);
  return Array.isArray(data?.quests) ? data.quests : [];
}

export async function claimQuest(questId) {
  const userId = getLiveUserId();
  if (!userId || !questId) return { error: "Missing profile." };
  const res = await socialPost("/live/quests/claim", { userId, questId });
  if (res.ok) invalidateSocialMe();
  return res.ok ? { status: "ok", rewardCoins: res.data.rewardCoins } : { error: res.data.error || "Could not claim." };
}

export async function fetchLeaderboard(week, sort) {
  const params = new URLSearchParams();
  if (week) params.set("week", week);
  if (sort) params.set("sort", sort);
  const query = params.toString();
  const data = await socialGet(`/live/leaderboard${query ? `?${query}` : ""}`);
  return Array.isArray(data?.board) ? data.board : [];
}

export async function fetchReactions(targetId) {
  if (!targetId) return null;
  const userId = getLiveUserId();
  const params = new URLSearchParams({ targetId });
  if (userId) params.set("userId", userId);
  return await socialGet(`/live/reactions?${params.toString()}`);
}

export async function sendReaction(targetId, reaction) {
  const userId = getLiveUserId();
  if (!userId || !targetId || !reaction) return { error: "Missing profile." };
  const res = await socialPost("/live/reactions", { userId, targetId, reaction });
  return res.ok ? { status: "ok" } : { error: res.data.error || "Could not react." };
}

export async function removeReaction(targetId) {
  const userId = getLiveUserId();
  if (!userId || !targetId) return { error: "Missing profile." };
  const res = await socialDelete("/live/reactions", { userId, targetId });
  return res.ok ? { status: "ok" } : { error: res.data.error || "Could not remove." };
}
