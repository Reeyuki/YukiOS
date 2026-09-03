import { os, StorageKeys } from "../framework.js";

export const DEFAULT_WISP_URL = "wss://hurt-agata-liventcord-api-7072e9a6.koyeb.app/";

export const WISP_SERVERS = [
  { name: "Reeyuki Wisp", url: DEFAULT_WISP_URL },
  { name: "Mercury Wisp", url: "wss://wisp.mercurywork.shop/" },
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
