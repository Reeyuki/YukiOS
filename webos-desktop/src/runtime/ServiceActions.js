import { ActionTypes } from "./AppSchema.js";

export const ServiceActions = {
  fs: {
    readFile: {
      type: ActionTypes.SERVICE,
      service: "fs",
      method: "readFile",
      description: "Read file content from filesystem"
    },
    writeFile: {
      type: ActionTypes.SERVICE,
      service: "fs",
      method: "safeWriteFile",
      description: "Write content to file"
    },
    readdir: { type: ActionTypes.SERVICE, service: "fs", method: "readdir", description: "List directory contents" },
    mkdir: { type: ActionTypes.SERVICE, service: "fs", method: "mkdir", description: "Create directory" },
    unlink: { type: ActionTypes.SERVICE, service: "fs", method: "unlink", description: "Delete file" },
    stat: { type: ActionTypes.SERVICE, service: "fs", method: "stat", description: "Get file metadata" },
    copy: { type: ActionTypes.SERVICE, service: "fs", method: "copy", description: "Copy file or directory" }
  },
  wm: {
    createWindow: {
      type: ActionTypes.SERVICE,
      service: "wm",
      method: "createWindow",
      description: "Create a new window"
    },
    closeWindow: { type: ActionTypes.SERVICE, service: "wm", method: "closeWindow", description: "Close a window" },
    minimizeWindow: {
      type: ActionTypes.SERVICE,
      service: "wm",
      method: "minimizeWindow",
      description: "Minimize a window"
    },
    maximizeWindow: {
      type: ActionTypes.SERVICE,
      service: "wm",
      method: "maximizeWindow",
      description: "Maximize a window"
    },
    bringToFront: {
      type: ActionTypes.SERVICE,
      service: "wm",
      method: "bringToFront",
      description: "Bring window to front"
    },
    notify: { type: ActionTypes.SERVICE, service: "wm", method: "notify", description: "Show desktop notification" }
  },
  notifications: {
    notify: { type: ActionTypes.SERVICE, service: "notifications", method: "notify", description: "Show notification" },
    setDND: {
      type: ActionTypes.SERVICE,
      service: "notifications",
      method: "setDND",
      description: "Toggle Do Not Disturb mode"
    },
    getNotifications: {
      type: ActionTypes.SERVICE,
      service: "notifications",
      method: "getNotifications",
      description: "Get notification history"
    }
  },
  bus: {
    emit: { type: ActionTypes.SERVICE, service: "bus", method: "emit", description: "Emit event to event bus" },
    on: { type: ActionTypes.SERVICE, service: "bus", method: "on", description: "Subscribe to event" },
    off: { type: ActionTypes.SERVICE, service: "bus", method: "off", description: "Unsubscribe from event" }
  }
};
