export interface ElectronAPI {
	getVersion: () => Promise<string>;
	getPath: (name: string) => Promise<string>;
	printJobCard?: (html: string) => Promise<void>;
	printInvoice?: (html: string) => Promise<void>;
	getAuthToken?: () => Promise<string | null>;
	setAuthToken?: (token: string | null) => Promise<void>;
}

declare global {
	interface Window {
		electronAPI?: ElectronAPI;
	}
}


export {};
