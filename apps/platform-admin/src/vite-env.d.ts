/// <reference types="vite/client" />

interface ImportMetaEnv {
	/** The platform API address in production (for example https://api.trovotechsolutions.in). Empty in development. */
	readonly VITE_API_URL?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
