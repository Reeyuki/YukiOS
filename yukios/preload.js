const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("nativeAPI", {
  getGlobal: async (key) => {
    return await ipcRenderer.invoke("read-global-variable", key);
  }
});

contextBridge.exposeInMainWorld("assets", {
  onProgress: (callback) => ipcRenderer.on("asset-sync", (event, data) => callback(data))
});
