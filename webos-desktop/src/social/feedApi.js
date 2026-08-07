import { getLiveUserId } from "./userIdentity.js";
import { socialGet } from "./socialApi.js";

let feedCache = null;
let feedTime = 0;
const FEED_TTL = 20 * 1000;

export async function fetchFeed({ refresh = false } = {}) {
  const userId = getLiveUserId();
  if (!userId) return [];
  if (!refresh && feedCache && Date.now() - feedTime < FEED_TTL) return feedCache;
  const data = await socialGet(`/live/feed?userId=${encodeURIComponent(userId)}`);
  const result = Array.isArray(data?.feed) ? data.feed : [];
  feedCache = result;
  feedTime = Date.now();
  return result;
}

export function invalidateFeed() {
  feedCache = null;
  feedTime = 0;
}