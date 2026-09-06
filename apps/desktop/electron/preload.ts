import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
 getVersion: () => ipcRenderer.invoke('app:getVersion'),
 getPath: (name: string) => ipcRenderer.invoke('app:getPath', name),
 printJobCard: (html: string) => ipcRenderer.invoke('app:printJobCard', html),
 printInvoice: (html: string) => ipcRenderer.invoke('app:printInvoice', html),
 getAuthToken: () => ipcRenderer.invoke('auth:getToken'),
 setAuthToken: (token: string | null) => ipcRenderer.invoke('auth:setToken', token),
});
