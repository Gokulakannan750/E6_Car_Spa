import { app, BrowserWindow, dialog, ipcMain, safeStorage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
 mainWindow = new BrowserWindow({
 title: 'E6 Car Spa Management',
 width: 1400,
 height: 900,
 minWidth: 1024,
 minHeight: 700,
 center: true,
 show: true,
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

 mainWindow.once('ready-to-show', () => {
 mainWindow?.show();
 mainWindow?.focus();
});

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
 printWindow.webContents.print({ silent: false, printBackground: true }, () => {
 printWindow.close();
 });
 });
});

ipcMain.handle('app:printInvoice', async (_event, html: string) => {
	const printWindow = new BrowserWindow({
		width: 800,
		height: 600,
		show: false,
		webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
	});
	await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
	printWindow.webContents.on('did-finish-load', () => {
		printWindow.webContents.print({ silent: false, printBackground: true }, () => {
			printWindow.close();
		});
	});
});

ipcMain.handle('app:saveInvoicePdf', async (event, options?: { defaultFilename?: string }) => {
	const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
	if (!win) {
		return { success: false, error: 'Application window is not available.' };
	}

	const rawFilename = (options?.defaultFilename && options.defaultFilename.trim())
		? options.defaultFilename.trim()
		: 'Invoice.pdf';

	// Sanitize filename to prevent invalid characters in file path
	const sanitizedFilename = rawFilename.replace(/[\\/:*?"<>|]/g, '_');
	const defaultFilename = sanitizedFilename.toLowerCase().endsWith('.pdf')
		? sanitizedFilename
		: `${sanitizedFilename}.pdf`;

	const { canceled, filePath } = await dialog.showSaveDialog(win, {
		title: 'Save Invoice PDF',
		defaultPath: path.join(app.getPath('documents'), defaultFilename),
		filters: [
			{ name: 'PDF Documents (*.pdf)', extensions: ['pdf'] },
			{ name: 'All Files (*.*)', extensions: ['*'] }
		],
		properties: ['showOverwriteConfirmation', 'createDirectory']
	});

	if (canceled || !filePath) {
		return { success: false, canceled: true };
	}

	try {
		const pdfData = await win.webContents.printToPDF({
			printBackground: true,
			pageSize: 'A4',
			landscape: false,
			preferCSSPageSize: true,
			margins: { marginType: 'none' }
		});

		await fs.promises.writeFile(filePath, pdfData);
		return { success: true, filePath };
	} catch (err) {
		console.error('Failed to generate/save PDF:', err);
		const msg = err instanceof Error ? err.message : String(err);
		return { success: false, error: msg };
	}
});

function getAuthTokenFilePath(): string {
	return path.join(app.getPath('userData'), 'session.enc');
}

ipcMain.handle('auth:getToken', async () => {
	try {
		const filePath = getAuthTokenFilePath();
		if (!fs.existsSync(filePath)) return null;
		const buffer = fs.readFileSync(filePath);
		if (safeStorage.isEncryptionAvailable()) {
			return safeStorage.decryptString(buffer);
		}
		return buffer.toString('utf8');
	} catch (err) {
		console.error('Failed to read encrypted auth token:', err);
		return null;
	}
});

ipcMain.handle('auth:setToken', async (_event, token: string | null) => {
	try {
		const filePath = getAuthTokenFilePath();
		if (!token) {
			if (fs.existsSync(filePath)) {
				fs.unlinkSync(filePath);
			}
			return;
		}
		if (safeStorage.isEncryptionAvailable()) {
			const encrypted = safeStorage.encryptString(token);
			fs.writeFileSync(filePath, encrypted);
		} else {
			fs.writeFileSync(filePath, Buffer.from(token, 'utf8'));
		}
	} catch (err) {
		console.error('Failed to write encrypted auth token:', err);
	}
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
