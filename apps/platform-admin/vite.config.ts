import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// The admin portal is its own website. In development the API is reached through the dev server (/api → the API
// running in platform mode on 5298); in production VITE_API_URL is the API's address and the portal's address is
// allowed there (Platform:AdminPortalOrigin).
/** Puts the API's origin into the page's Content-Security-Policy (connect-src); nothing extra in development. */
function apiOriginInCsp(apiUrl: string | undefined): Plugin {
	let origin = '';
	if (apiUrl) {
		const url = new URL(apiUrl);
		if (url.protocol !== 'https:' && url.hostname !== 'localhost') throw new Error('VITE_API_URL must use https.');
		origin = url.origin;
	}
	return {
		name: 'api-origin-in-csp',
		// The dev server's live reload needs its websocket; a built site does not.
		transformIndexHtml: (html, ctx) => html.replaceAll('%API_ORIGIN%', ctx.server ? `${origin} ws://localhost:5190`.trim() : origin),
	};
}

export default defineConfig(({ mode }) => ({
	plugins: [react(), apiOriginInCsp(loadEnv(mode, process.cwd(), 'VITE_').VITE_API_URL)],
	resolve: {
		alias: {
			'@': path.resolve(__dirname, 'src'),
		},
	},
	build: {
		outDir: 'dist',
		emptyOutDir: true,
		sourcemap: false,
		rollupOptions: {
			output: {
				manualChunks: {
					react: ['react', 'react-dom', 'react-router-dom'],
					vendor: ['@tanstack/react-query', '@tanstack/react-table', 'react-hook-form', 'zod', '@hookform/resolvers', 'qrcode', 'lucide-react'],
				},
			},
		},
	},
	server: {
		port: 5190,
		strictPort: true,
		proxy: {
			'/api': {
				target: process.env.PLATFORM_API_PROXY ?? 'http://localhost:5298',
				changeOrigin: true,
			},
		},
	},
}));
