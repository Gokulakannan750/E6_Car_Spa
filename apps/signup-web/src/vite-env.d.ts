/// <reference types="vite/client" />

interface ImportMetaEnv {
	/** The platform API address in production (for example https://api.trovotechsolutions.in). Empty in development. */
	readonly VITE_API_URL?: string;
	/** Where the Windows installer can be downloaded (shown after sign-up). */
	readonly VITE_WINDOWS_DOWNLOAD_URL?: string;
	/** Where the Android app can be installed from (Play Store or the APK). */
	readonly VITE_ANDROID_DOWNLOAD_URL?: string;
	/** Legal pages on trovotechsolutions.in. */
	readonly VITE_TERMS_URL?: string;
	readonly VITE_REFUND_URL?: string;
	readonly VITE_PRIVACY_URL?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
