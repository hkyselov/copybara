const { contextBridge, ipcRenderer } = require("electron/renderer");

contextBridge.exposeInMainWorld("electronAPI", {
  onUpdateClipboard: (callback) =>
    ipcRenderer.on("update-clipboard", (_event, value) => callback(value)),
  removeClip: (uuid) => ipcRenderer.send("remove-clip", uuid),
  pinClip: (uuid, pin) => ipcRenderer.send("pin-clip", uuid, pin),
  selectClip: (uuid) => ipcRenderer.send("select-clip", uuid),
  pinWindow: (pin) => ipcRenderer.send("pin-window", pin),
  hideWindow: () => ipcRenderer.send("hide-window"),
  clipInfo: (uuid) => ipcRenderer.send("clip-info", uuid),
  preventAutoHide: (uuid) => ipcRenderer.send("prevent-auto-hide", uuid),
  onUpdateWindowPin: (callback) =>
    ipcRenderer.on("update-window-pin", (_event, pin) => callback(pin)),
  onUpdateClipInfo: (callback) =>
    ipcRenderer.on("update-clip-info", (_event, clip) => callback(clip)),
  onNextClip: (callback) => ipcRenderer.on("next-clip", (_event) => callback()),
  onLoadSettings: (callback) =>
    ipcRenderer.on("settings:load-settings", (_event, settings) =>
      callback(settings)
    ),
  saveSettings: (key, value) =>
    ipcRenderer.send("settings:save-settings", key, value),
});
