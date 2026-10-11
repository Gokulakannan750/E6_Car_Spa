export interface SavePdfResult {
	success: boolean;
	canceled?: boolean;
	filePath?: string;
	error?: string;
}

export interface GetTokenResult {
	token: string | null;
	error?: string;
}

export interface SetTokenResult {
	success: boolean;
	error?: string;
}

export interface ElectronAPI {
	getVersion: () => Promise<string>;
	saveInvoicePdf?: (options?: { defaultFilename?: string }) => Promise<SavePdfResult>;
	getAuthToken?: () => Promise<GetTokenResult | string | null>;
	setAuthToken?: (token: string | null) => Promise<SetTokenResult | void>;
}

declare global {
	interface Window {
		electronAPI?: ElectronAPI;
	}
}

export {};
