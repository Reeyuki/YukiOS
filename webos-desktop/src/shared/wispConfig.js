import { os, StorageKeys } from "../framework.js";

export const DEFAULT_WISP_URL = "wss://wisp.mercurywork.shop/";

export const WISP_SERVERS = [
  { name: "Mercury Wisp", url: DEFAULT_WISP_URL },
  { name: "Reeyuki Wisp", url: "wss://hurt-agata-liventcord-api-7072e9a6.koyeb.app/" },
  { name: "Reeyuki Wisp 2", url: "wss://reeyukiwisp.onrender.com/" }
];

export function getWispUrl() {
  let stored = os.storage.get(StorageKeys.wispServer);
  if (stored && !stored.endsWith("/")) {
    stored += "/";
  }
  if (!stored) {
    stored = DEFAULT_WISP_URL;
    os.storage.set(StorageKeys.wispServer, stored);
  }
  return stored;
}
