const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  launchGame: (gameId) => ipcRenderer.invoke("launch-game", gameId),
  readGlobalVariable: (key) => ipcRenderer.invoke("read-global-variable", key)
});

contextBridge.exposeInMainWorld("assets", {
  onProgress: (callback) => {
    ipcRenderer.on("asset-sync", (event, data) => callback(data));
  }
});
