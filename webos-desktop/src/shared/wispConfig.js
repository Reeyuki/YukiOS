import { os, StorageKeys } from "../framework.js";

export const DEFAULT_WISP_URL = "wss://hurt-agata-liventcord-api-7072e9a6.koyeb.app/";

export const WISP_SERVERS = [
  { name: "Reeyuki Wisp", url: DEFAULT_WISP_URL },
  { name: "Reeyuki Wisp 2", url: "wss://reeyukiwisp.onrender.com/" }
];

export function getWispUrl() {
  return os.storage.get(StorageKeys.wispServer) || DEFAULT_WISP_URL;
}
