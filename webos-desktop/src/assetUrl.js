import { resolveIconUrl as resolveIconUrlCentralized } from "./shared/assetResolver.js";

export { resolveIconUrl as resolveIconUrlCentralized };

export function resolveIconUrl(url) {
  return resolveIconUrlCentralized(url);
}
