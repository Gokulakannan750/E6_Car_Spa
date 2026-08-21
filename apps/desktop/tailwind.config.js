/** @type { import('tailwindcss').Config } */
export default {
 content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
 theme: {
 extend: {
 colors: {
 primary: {
 DEFAULT: '#2563eb',
 hover: '#1d4ed8',
 light: '#dbeafe',
 dark: '#1e40af',
},
},
 fontFamily: {
 sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto',
 'sans-serif'],
 mono: ['JetBrains Mono', 'monospace'],
},
 borderRadius: {
 '2xl': '1rem',
 '3xl': '1.5rem',
},
},
},
plugins: [],
};
