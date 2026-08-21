import { contextBridge, ipcRenderer } from 'electron';

const electronAPI = {
 getVersion: () => ipcRenderer.invoke('app:get-version'),
 getPath: (name: string) => ipcRenderer.invoke('app:get-path', name),
 platform: process.platform,
};

contextBridge.exposeInMainWorld('electron', electronAPI);

declare global {
 interface Window {
 electron: typeof electronAPI;
 }
}

export {};
