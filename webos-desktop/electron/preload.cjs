const { contextBridge, ipcRenderer, shell } = require("electron");

const isDev = process.argv.includes("--yukios-dev=true");

contextBridge.exposeInMainWorld("electronAPI", {
  isDev,
  startRemoteHost: (config) => ipcRenderer.invoke("remote-host:start", config),
  stopRemoteHost: () => ipcRenderer.invoke("remote-host:stop"),
  getRemoteHostStatus: () => ipcRenderer.invoke("remote-host:status"),
  toggleAudio: () => ipcRenderer.invoke("remote-host:toggle-audio"),
  onRemoteHostEvent: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on("remote-host:event", handler);
    return () => ipcRenderer.removeListener("remote-host:event", handler);
  },
  getScreenSources: () => ipcRenderer.invoke("desktop-capturer:get-sources"),
  sendRemoteHostEvent: (data) => ipcRenderer.send("remote-host:event", data),
  getRemoteHostSettings: () => ipcRenderer.invoke("remote-host:settings"),
  simulateInput: (input) => ipcRenderer.invoke("input:simulate", input),
  getPlatform: () => process.platform,
  openExternal: (url) => shell.openExternal(url),
  getAutostart: () => ipcRenderer.invoke("app:get-autostart"),
  setAutostart: (enabled) => ipcRenderer.invoke("app:set-autostart", enabled),
  saveFile: (info) => ipcRenderer.invoke("file:save", info),
  getPersistentRoom: () => ipcRenderer.invoke("remote-host:get-room"),
  savePersistentRoom: (roomId) => ipcRenderer.invoke("remote-host:save-room", roomId),
  clearPersistentRoom: () => ipcRenderer.invoke("remote-host:clear-room"),
  onTrayAction: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on("tray:action", handler);
    return () => ipcRenderer.removeListener("tray:action", handler);
  },
  sendTrayState: (state) => ipcRenderer.send("tray:state-update", state),
  gstreamerAvailable: () => ipcRenderer.invoke("remote-host:gstreamer-available"),
  gstreamerStart: (config) => ipcRenderer.invoke("remote-host:gstreamer-start", config),
  gstreamerStop: () => ipcRenderer.invoke("remote-host:gstreamer-stop"),
  openNativeWindow: (opts) => ipcRenderer.invoke("native-window:open-url", opts),

  analytics: {
    trackDownload: (info) => ipcRenderer.invoke("analytics:track-download", info),
    trackElectronUsage: (info) => ipcRenderer.invoke("analytics:track-electron-usage", info)
  },

  electronFs: {
    init: (sessionKey) => ipcRenderer.invoke("fs:init", { sessionKey }),
    writeFile: (filePath, content) => {
      if (typeof content === "string") {
        return ipcRenderer.invoke("fs:writeFile", { filePath, content, encoding: "utf8" });
      }
      if (content instanceof Uint8Array || content instanceof ArrayBuffer) {
        const bytes = content instanceof Uint8Array ? content : new Uint8Array(content);
        return ipcRenderer.invoke("fs:writeFile", { filePath, content: Array.from(bytes), encoding: "binary" });
      }
      return ipcRenderer.invoke("fs:writeFile", { filePath, content: "", encoding: "utf8" });
    },
    readFile: (filePath, encoding) => {
      if (encoding === "base64" || encoding === "binary") {
        return ipcRenderer.invoke("fs:readFile", { filePath, encoding: "base64" });
      }
      return ipcRenderer.invoke("fs:readFile", { filePath, encoding: "utf8" });
    },
    mkdir: (filePath, recursive) => ipcRenderer.invoke("fs:mkdir", { filePath, recursive }),
    readdir: (filePath) => ipcRenderer.invoke("fs:readdir", { filePath }),
    unlink: (filePath) => ipcRenderer.invoke("fs:unlink", { filePath }),
    rmdir: (filePath) => ipcRenderer.invoke("fs:rmdir", { filePath }),
    rename: (oldPath, newPath) => ipcRenderer.invoke("fs:rename", { oldPath, newPath }),
    stat: (filePath) => ipcRenderer.invoke("fs:stat", { filePath }),
    exists: (filePath) => ipcRenderer.invoke("fs:exists", { filePath }),
    copyFile: (src, dest) => ipcRenderer.invoke("fs:copyFile", { src, dest }),
    readdirAbsolute: (absPath) => ipcRenderer.invoke("fs:readdir", { filePath: absPath, absolute: true }),
    statAbsolute: (absPath) => ipcRenderer.invoke("fs:stat", { filePath: absPath, absolute: true }),
    readFileAbsolute: (absPath, encoding) => {
      if (encoding === "base64" || encoding === "binary") {
        return ipcRenderer.invoke("fs:readFile", { filePath: absPath, encoding: "base64", absolute: true });
      }
      return ipcRenderer.invoke("fs:readFile", { filePath: absPath, encoding: "utf8", absolute: true });
    },
    existsAbsolute: (absPath) => ipcRenderer.invoke("fs:exists", { filePath: absPath, absolute: true }),
    unlinkAbsolute: (absPath) => ipcRenderer.invoke("fs:unlink", { filePath: absPath, absolute: true })
  }
});
