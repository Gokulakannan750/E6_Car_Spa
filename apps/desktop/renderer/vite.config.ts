import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
 plugins: [react()],
 root: path.resolve(__dirname, '.'),
 base: './',
 build: {
 outDir: 'dist',
 emptyOutDir: true,
 },
 resolve: {
 alias: {
 '@': path.resolve(__dirname, 'src'),
 '@design-tokens': path.resolve(
 __dirname,
 '../../packages/design-tokens/src'
 ),
 },
 },
 server: {
 port: 5173,
 strictPort: true,
 },
});
