// Exposes a tiny, explicit bridge to the renderer. Nothing else from Node leaks in.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pulse', {
  isDesktop: true,
  platform: process.platform,
  getMaterial: () => ipcRenderer.invoke('pulse:get-material'),
  setMaterial: (m) => ipcRenderer.invoke('pulse:set-material', m),
  setTitleBar: (opts) => ipcRenderer.invoke('pulse:title-bar', opts),
  mini: (show) => ipcRenderer.invoke('pulse:mini', show),
  focusMain: () => ipcRenderer.invoke('pulse:focus-main'),
  googleLogin: () => ipcRenderer.invoke('pulse:google-login'),
  googleLogout: () => ipcRenderer.invoke('pulse:google-logout'),
});
