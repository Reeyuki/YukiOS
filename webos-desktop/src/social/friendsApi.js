import { StorageKeys, os } from "../framework.js";
import { getLiveUserId } from "./userIdentity.js";
import { socialGet, socialPost } from "./socialApi.js";
import {
  fakeFriendsEnabled,
  fakeFriendsResult,
  fakeSendFriendRequest,
  fakeSendMessage,
  fakeFetchMessages,
  fakeFetchConversations,
  fakeRemoveFriend,
  fakeAcceptFriendRequest,
  fakeFriendRelation
} from "./fakeFriends.js";

let cachedFriends = null;
let cachedFriendsTime = 0;
const FRIENDS_TTL = 10 * 1000;

export async function fetchFriends({ refresh = false } = {}) {
  if (fakeFriendsEnabled()) return fakeFriendsResult();
  const userId = getLiveUserId();
  if (!userId) return { friends: [], requests: [], sentRequests: [] };
  if (!refresh && cachedFriends && Date.now() - cachedFriendsTime < FRIENDS_TTL) return cachedFriends;
  const data = await socialGet(`/live/friends?userId=${encodeURIComponent(userId)}`);
  const result = {
    friends: Array.isArray(data?.friends) ? data.friends : [],
    requests: Array.isArray(data?.requests) ? data.requests : [],
    sentRequests: Array.isArray(data?.sentRequests) ? data.sentRequests : []
  };
  cachedFriends = result;
  cachedFriendsTime = Date.now();
  os.storage.set(StorageKeys.socialFriends, result);
  return result;
}

export function getCachedFriends() {
  if (fakeFriendsEnabled()) return fakeFriendsResult();
  if (cachedFriends) return cachedFriends;
  const stored = os.storage.get(StorageKeys.socialFriends);
  return {
    friends: stored && Array.isArray(stored.friends) ? stored.friends : [],
    requests: stored && Array.isArray(stored.requests) ? stored.requests : [],
    sentRequests: stored && Array.isArray(stored.sentRequests) ? stored.sentRequests : []
  };
}

export async function areFriends(userId) {
  const list = await fetchFriends();
  return list.friends.some((friend) => friend.userId === userId);
}

export async function sendFriendRequest(friendId) {
  if (fakeFriendsEnabled()) return fakeSendFriendRequest(friendId);
  const userId = getLiveUserId();
  if (!userId || !friendId) return { error: "You need a profile first." };
  const res = await socialPost("/live/friends/request", { userId, friendId });
  if (res.ok) fetchFriends({ refresh: true }).catch(() => {});
  return res.ok ? { status: res.data.status } : { error: res.data.error || "Could not send the request." };
}

export async function acceptFriendRequest(friendId) {
  if (fakeFriendsEnabled()) return fakeAcceptFriendRequest(friendId);
  const userId = getLiveUserId();
  if (!userId || !friendId) return { error: "Missing profile." };
  const res = await socialPost("/live/friends/accept", { userId, friendId });
  if (res.ok) fetchFriends({ refresh: true }).catch(() => {});
  return res.ok ? { status: res.data.status } : { error: res.data.error || "Could not accept." };
}

export async function removeFriend(friendId) {
  if (fakeFriendsEnabled()) return fakeRemoveFriend(friendId);
  const userId = getLiveUserId();
  if (!userId || !friendId) return { error: "Missing profile." };
  const res = await socialPost("/live/friends/remove", { userId, friendId });
  if (res.ok) fetchFriends({ refresh: true }).catch(() => {});
  return res.ok ? { success: true } : { error: res.data.error || "Could not remove." };
}

export async function sendMessage(friendId, body) {
  if (fakeFriendsEnabled()) return fakeSendMessage(friendId, body);
  const userId = getLiveUserId();
  if (!userId || !friendId) return { error: "Missing profile." };
  const res = await socialPost("/live/messages", { userId, friendId, body });
  return res.ok ? { status: "ok" } : { error: res.data.error || "Could not send the message." };
}

export async function fetchMessages(friendId, after) {
  if (fakeFriendsEnabled()) return fakeFetchMessages(friendId);
  const userId = getLiveUserId();
  if (!userId || !friendId) return [];
  const params = new URLSearchParams({ userId, friendId });
  if (after) params.set("after", after);
  const data = await socialGet(`/live/messages?${params.toString()}`);
  return Array.isArray(data?.messages) ? data.messages : [];
}

let cachedConversations = null;
let cachedConversationsTime = 0;
const CONVERSATIONS_TTL = 12 * 1000;

export async function fetchConversations({ refresh = false } = {}) {
  if (fakeFriendsEnabled()) return fakeFetchConversations();
  const userId = getLiveUserId();
  if (!userId) return [];
  if (!refresh && cachedConversations && Date.now() - cachedConversationsTime < CONVERSATIONS_TTL) {
    return cachedConversations;
  }
  const data = await socialGet(`/live/messages?userId=${encodeURIComponent(userId)}&conversations=1`);
  const result = Array.isArray(data?.conversations) ? data.conversations : [];
  cachedConversations = result;
  cachedConversationsTime = Date.now();
  return result;
}

export function invalidateConversations() {
  cachedConversations = null;
  cachedConversationsTime = 0;
}

export async function getFriendRelation(userId) {
  if (fakeFriendsEnabled()) return fakeFriendRelation(userId);
  if (!userId) return "none";
  if (userId === getLiveUserId()) return "self";
  const list = await fetchFriends();
  if (list.friends.some((friend) => friend.userId === userId)) return "friend";
  if (list.requests.some((request) => request.userId === userId)) return "incoming";
  if (list.sentRequests.some((request) => request.userId === userId)) return "outgoing";
  return "none";
}
