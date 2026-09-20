import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
	getVersion: () => ipcRenderer.invoke('app:getVersion'),
	saveInvoicePdf: (options?: { defaultFilename?: string }) => ipcRenderer.invoke('app:saveInvoicePdf', options),
	getAuthToken: () => ipcRenderer.invoke('auth:getToken'),
	setAuthToken: (token: string | null) => ipcRenderer.invoke('auth:setToken', token),
});
