import { contextBridge, ipcRenderer } from 'electron';
import { ElectronAPI } from '../shared/types';

const api: ElectronAPI = {
  vaultExists: () => ipcRenderer.invoke('vault:exists'),
  unlock: (masterPassword: string) => ipcRenderer.invoke('vault:unlock', masterPassword),
  lock: () => ipcRenderer.invoke('vault:lock'),
  save: (entries) => ipcRenderer.invoke('vault:save', entries),
  logAppend: (entry) => ipcRenderer.invoke('log:append', entry),
  logRead: () => ipcRenderer.invoke('log:read'),
  copyToClip: (text: string) => ipcRenderer.invoke('clipboard:copy', text),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
};

contextBridge.exposeInMainWorld('api', api);

// Auto-lock event from main process
contextBridge.exposeInMainWorld('onAutoLocked', (callback: () => void) => {
  ipcRenderer.on('auto-locked', callback);
});
