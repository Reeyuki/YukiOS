import { AppSource } from "../AppSource.js";
import { os } from "../os/index.js";

export function notify(wm, title, message, type = "info", duration = 5000, icon = null, appSource = null) {
  os.notify.send(title, message, type, duration, icon, appSource);
}

export function sendNotify(wm, text, appSource = null) {
  os.notify.send(text, "", "info", 5000, null, appSource);
}
