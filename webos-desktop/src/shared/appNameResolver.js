import { os } from "../framework.js";

export function resolveAppName(appId) {
  if (!appId) return "Unknown App";
  const info = os.app.getAppInfo(appId);
  if (info?.title) return info.title;
  return appId.charAt(0).toUpperCase() + appId.slice(1).replace(/([a-z])([A-Z])/g, "$1 $2");
}

export function resolveAppIcon(appId) {
  if (!appId) return null;
  const info = os.app.getAppInfo(appId);
  return info?.icon || null;
}
