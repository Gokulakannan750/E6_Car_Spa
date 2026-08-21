import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import electron from 'vite-plugin-electron/simple'
import renderer from 'vite-plugin-electron-renderer'
import path from 'path'

export default defineConfig({
 root: 'renderer',
 publicDir: 'public',
 plugins: [
 tailwindcss(),
 react(),
 electron({
 main: {
 entry: '../electron/main.ts',
 },
 preload: {
 input: path.resolve(__dirname, 'electron/preload.ts'),
 },
 renderer: {},
 }),
 renderer({
 ssrSetUpNoExternal: ['react', 'react-dom', 'react-router-dom'],
 }),
 ],
 resolve: {
 alias: {
 '@': path.resolve(__dirname, 'renderer/src'),
 '@shared': path.resolve(__dirname, 'renderer/src/shared'),
 },
 },
 server: {
 port: 5173,
 strictPort: true,
 },
 build: {
 outDir: 'dist-renderer',
 emptyOutDir: true,
 rollupOptions: {
 output: {
 manualChunks: {
 'react-vendor': ['react', 'react-dom', 'react-router-dom'],
 },
 },
 },
 },
})
