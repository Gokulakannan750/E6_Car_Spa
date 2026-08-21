import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
 getVersion: () => ipcRenderer.invoke('app:getVersion'),
 getPath: (name: string) => ipcRenderer.invoke('app:getPath', name),
 printJobCard: (html: string) => ipcRenderer.invoke('app:printJobCard', html),
});
