import { StorageKeys, os } from "../framework.js";
export function getSetting(key, defaultValue) {
  const storageKey = StorageKeys[key];
  if (!storageKey) return defaultValue;
  const val = os.storage.get(storageKey);
  if (val === null) return defaultValue;
  if (val === "true") return true;
  if (val === "false") return false;
  const num = Number(val);
  if (!isNaN(num)) return num;
  return val;
}
