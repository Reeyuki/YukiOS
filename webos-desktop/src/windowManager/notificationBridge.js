export function notify(wm, title, message, type = "info", duration = 5000, icon = null) {
  if (wm.notificationCenter) {
    wm.notificationCenter.addNotification(title, message, type, duration, icon);
  } else {
    console.warn("[WM] notify called before NotificationCenter was set:", title);
  }
}

export function sendNotify(wm, text) {
  if (wm.notificationCenter) {
    wm.notificationCenter.addNotification(text, "", "info");
  } else {
    console.warn("[WM] sendNotify called before NotificationCenter was set:", text);
  }
}
