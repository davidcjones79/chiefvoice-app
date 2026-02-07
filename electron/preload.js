const { contextBridge, ipcRenderer } = require('electron');

// Expose Electron APIs to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Platform detection
  platform: process.platform,
  isElectron: true,

  // IPC communication
  onStartCall: (callback) => {
    ipcRenderer.on('start-call', () => callback());
  },

  // Window controls
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),

  // App info
  getVersion: () => ipcRenderer.invoke('get-version'),
});

// Add electron class to document for CSS styling (traffic light spacing)
window.addEventListener('DOMContentLoaded', () => {
  document.documentElement.classList.add('electron');
  document.body.classList.add('electron');
});

// Log that preload ran successfully
console.log('[Chief] Electron preload script loaded');
console.log('[Chief] WebRTC support:', !!window.RTCPeerConnection);
