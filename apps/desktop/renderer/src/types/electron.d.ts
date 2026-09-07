export interface SavePdfResult {
	success: boolean;
	canceled?: boolean;
	filePath?: string;
	error?: string;
}

export interface ElectronAPI {
	getVersion: () => Promise<string>;
	getPath: (name: string) => Promise<string>;
	printJobCard?: (html: string) => Promise<void>;
	printInvoice?: (html: string) => Promise<void>;
	saveInvoicePdf?: (options?: { defaultFilename?: string }) => Promise<SavePdfResult>;
	getAuthToken?: () => Promise<string | null>;
	setAuthToken?: (token: string | null) => Promise<void>;
}

declare global {
	interface Window {
		electronAPI?: ElectronAPI;
	}
}


export {};
