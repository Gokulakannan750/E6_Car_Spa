import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
 mainWindow = new BrowserWindow({
 width: 1400,
 height: 900,
 minWidth: 1024,
 minHeight: 700,
 backgroundColor: '#f8fafc',
 webPreferences: {
 preload: path.join(__dirname, 'preload.mjs'),
 contextIsolation: true,
 nodeIntegration: false,
 sandbox: true,
 },
});

 if (isDev) {
 mainWindow.loadURL('http://localhost:5173');
 mainWindow.webContents.openDevTools();
} else {
 mainWindow.loadFile(path.join(__dirname, '../dist-renderer/index.html'));
}

 mainWindow.on('closed', () => {
 mainWindow = null;
});
}

// IPC handlers
ipcMain.handle('app:getVersion', () => app.getVersion());
ipcMain.handle('app:getPath', (_event, name: string) => app.getPath(name as any));
ipcMain.handle('app:printJobCard', async (_event, html: string) => {
 const printWindow = new BrowserWindow({
 width: 800,
 height: 600,
 show: false,
 webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
 });
 await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
 printWindow.webContents.on('did-finish-load', () => {
 printWindow.webContents.print({ silent: false, printBackground: true });
 printWindow.close();
 });
});

app.whenReady().then(() => {
 createWindow();

 app.on('activate', () => {
 if (BrowserWindow.getAllWindows().length === 0) {
 createWindow();
}
});
});

app.on('window-all-closed', () => {
 if (process.platform !== 'darwin') {
 app.quit();
}
});
