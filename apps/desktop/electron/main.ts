import { app, BrowserWindow, dialog, ipcMain, net, protocol, safeStorage, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Register custom application scheme as privileged before app is ready
protocol.registerSchemesAsPrivileged([
	{
		scheme: 'app',
		privileges: {
			standard: true,
			secure: true,
			supportFetchAPI: true,
			corsEnabled: true,
			stream: true,
		},
	},
]);

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const rendererDist = path.normalize(path.join(__dirname, '../dist-renderer'));

function registerAppProtocol() {
	protocol.handle('app', (request) => {
		try {
			const url = new URL(request.url);
			if (url.host !== 'carspa') {
				return new Response('Not Found', { status: 404 });
			}

			let pathname = decodeURIComponent(url.pathname);
			if (pathname === '/' || pathname === '') {
				pathname = '/index.html';
			}

			// Prevent directory traversal
			const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
			let filePath = path.join(rendererDist, safePath);

			// Verify the resolved path stays within rendererDist
			if (!filePath.startsWith(rendererDist)) {
				return new Response('Forbidden', { status: 403 });
			}

			// Fall back to index.html for SPA client-side routes (e.g. /customers, /job-cards)
			if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
				filePath = path.join(rendererDist, 'index.html');
			}

			return net.fetch(pathToFileURL(filePath).toString());
		} catch (err) {
			console.error('Failed to handle app:// protocol request:', err);
			return new Response('Internal Server Error', { status: 500 });
		}
	});
}

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

	// Navigation & Popup Hardening
	// 1. Intercept window.open calls (e.g. ShareInvoiceModal) and open in default system browser
	mainWindow.webContents.setWindowOpenHandler((details) => {
		try {
			const parsed = new URL(details.url);
			if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
				shell.openExternal(details.url);
			}
		} catch (err) {
			console.error('Invalid URL in window.open:', err);
		}
		return { action: 'deny' };
	});

	// 2. Prevent arbitrary navigation away from trusted origins in the main window
	mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
		try {
			const parsed = new URL(navigationUrl);
			if (isDev && parsed.origin === 'http://localhost:5173') {
				return; // allow legitimate dev navigation / Vite HMR
			}
			if (!isDev && parsed.protocol === 'app:' && parsed.host === 'carspa') {
				return; // allow legitimate production app navigation
			}

			// Block navigation inside BrowserWindow and open external web links in system browser
			event.preventDefault();
			if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
				shell.openExternal(navigationUrl);
			}
		} catch {
			event.preventDefault();
		}
	});

	if (isDev) {
		mainWindow.loadURL('http://localhost:5173');
		mainWindow.webContents.openDevTools();
	} else {
		mainWindow.loadURL('app://carspa/index.html');
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
	registerAppProtocol();
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
