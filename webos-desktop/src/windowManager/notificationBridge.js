import { AppSource } from "../AppSource.js";

export function notify(wm, title, message, type = "info", duration = 5000, icon = null, appSource = null) {
  if (wm.notificationCenter) {
    wm.notificationCenter.addNotification(title, message, type, duration, icon, appSource);
  } else {
    console.warn("[WM] notify called before NotificationCenter was set:", title);
  }
}

export function sendNotify(wm, text, appSource = null) {
  if (wm.notificationCenter) {
    wm.notificationCenter.addNotification(text, "", "info", 5000, null, appSource);
  } else {
    console.warn("[WM] sendNotify called before NotificationCenter was set:", text);
  }
}
