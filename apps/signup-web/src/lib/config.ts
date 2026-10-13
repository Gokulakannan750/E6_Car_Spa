// Links that depend on where Trovo hosts things. Set at build time (VITE_*); the defaults are the brand website.

const site = 'https://trovotechsolutions.in';

export const links = {
	windowsDownload: import.meta.env.VITE_WINDOWS_DOWNLOAD_URL || null,
	androidDownload: import.meta.env.VITE_ANDROID_DOWNLOAD_URL || null,
	// The Terms and Refund policy pages still have to be published on the website before going live.
	terms: import.meta.env.VITE_TERMS_URL || `${site}/terms/`,
	refund: import.meta.env.VITE_REFUND_URL || `${site}/refund-policy/`,
	privacy: import.meta.env.VITE_PRIVACY_URL || `${site}/privacy-policy/`,
	contact: `${site}/contact.html`,
};
