import { StorageKeys, os } from "../framework.js";
import { getLiveUserId } from "./userIdentity.js";
import { socialGet, socialPost } from "./socialApi.js";
import { fetchSocialMe, invalidateSocialMe } from "./socialMeApi.js";

let catalogCache = null;
let catalogTime = 0;
const CATALOG_TTL = 60 * 1000;

export async function fetchShopCatalog({ refresh = false } = {}) {
  if (!refresh && catalogCache && Date.now() - catalogTime < CATALOG_TTL) return catalogCache;
  const data = await socialGet("/live/shop/catalog");
  catalogCache = Array.isArray(data?.items) ? data.items : [];
  catalogTime = Date.now();
  return catalogCache;
}

export function getShopItem(itemId) {
  if (!catalogCache) return null;
  return catalogCache.find((item) => item.id === itemId) || null;
}

export async function purchaseItem(itemId) {
  const userId = getLiveUserId();
  if (!userId || !itemId) return { error: "Missing profile." };
  const res = await socialPost("/live/coins/purchase", { userId, itemId });
  if (res.ok) {
    invalidateSocialMe();
    if (typeof res.data.coins === "number") os.storage.set(StorageKeys.socialCoins, res.data.coins);
    const owned = os.storage.get(StorageKeys.socialInventory) || [];
    if (!owned.includes(itemId)) owned.push(itemId);
    os.storage.set(StorageKeys.socialInventory, owned);
  }
  return res.ok ? { status: "ok", coins: res.data.coins } : { error: res.data.error || "Could not purchase." };
}

export async function fetchCoins() {
  const me = await fetchSocialMe();
  return me ? me.coins : 0;
}

export async function fetchInventory() {
  const me = await fetchSocialMe();
  return me ? me.inventory : [];
}
