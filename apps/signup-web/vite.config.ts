import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// The public sign-up website. In development /api goes through the dev server to the API (platform mode, sign-up on);
// in production VITE_API_URL is the API's address and this site's address is allowed there (Platform:SignupOrigin).

/** Puts the API's origin into the page's Content-Security-Policy (connect-src). */
function apiOriginInCsp(apiUrl: string | undefined): Plugin {
	let origin = '';
	if (apiUrl) {
		const url = new URL(apiUrl);
		if (url.protocol !== 'https:' && url.hostname !== 'localhost') throw new Error('VITE_API_URL must use https.');
		origin = url.origin;
	}
	return {
		name: 'api-origin-in-csp',
		transformIndexHtml: (html, ctx) => html.replaceAll('%API_ORIGIN%', ctx.server ? `${origin} ws://localhost:5192`.trim() : origin),
	};
}

export default defineConfig(({ mode }) => ({
	plugins: [react(), apiOriginInCsp(loadEnv(mode, process.cwd(), 'VITE_').VITE_API_URL)],
	resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
	build: {
		outDir: 'dist',
		emptyOutDir: true,
		sourcemap: false,
		rollupOptions: { output: { manualChunks: { react: ['react', 'react-dom', 'react-router-dom'], vendor: ['@tanstack/react-query', 'lucide-react'] } } },
	},
	server: {
		port: 5192,
		strictPort: true,
		proxy: { '/api': { target: process.env.SIGNUP_API_PROXY ?? 'http://localhost:5298', changeOrigin: true } },
	},
}));
