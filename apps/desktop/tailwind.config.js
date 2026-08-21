/** @type { import('tailwindcss').Config } */
export default {
 content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
 theme: {
 extend: {
 colors: {
 primary: { DEFAULT: '#000101', container: '#1a1c1e', 'on-primary': '#ffffff', hover: '#2d3032' },
 secondary: { DEFAULT: '#0453cd', container: '#356ee7', 'on-secondary': '#ffffff', hover: '#0344a8' },
 accent: { DEFAULT: '#0453cd', container: '#356ee7', 'on-accent': '#ffffff' },
 background: { DEFAULT: '#f8f9fa', dim: '#d9dadb' },
 surface: { DEFAULT: '#f8f9fa', dim: '#d9dadb', 'container-lowest': '#ffffff', 'container-low': '#f3f4f5', 'container': '#edeeef', 'container-high': '#e7e8e9', 'container-highest': '#e1e3e4', variant: '#e1e3e4' },
 'on-surface': '#191c1d',
 'on-surface-variant': '#44474a',
 'inverse-surface': '#2e3132',
 outline: { DEFAULT: '#75777a', variant: '#c5c6ca' },
 success: { DEFAULT: '#2e7d32', container: '#e8f5e9', 'on-success': '#ffffff' },
 warning: { DEFAULT: '#f57c00', container: '#fff3e0', 'on-warning': '#ffffff' },
 error: { DEFAULT: '#ba1a1a', container: '#ffdad6', 'on-error': '#ffffff' },
 info: { DEFAULT: '#1976d2', container: '#e3f2fd', 'on-info': '#ffffff' },
 },
 fontFamily: {
 sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
 mono: ['JetBrains Mono', 'monospace'],
 },
 fontSize: {
 'display-lg': ['48px', { lineHeight: '56px', letterSpacing: '-0.02em', fontWeight: '700' }],
 'headline-lg': ['32px', { lineHeight: '40px', letterSpacing: '-0.01em', fontWeight: '600' }],
 'headline-md': ['24px', { lineHeight: '32px', fontWeight: '600' }],
 'headline-sm': ['20px', { lineHeight: '28px', fontWeight: '600' }],
 'body-lg': ['18px', { lineHeight: '28px', fontWeight: '400' }],
 'body-md': ['16px', { lineHeight: '24px', fontWeight: '400' }],
 'body-sm': ['14px', { lineHeight: '20px', fontWeight: '400' }],
 'label-md': ['12px', { lineHeight: '16px', letterSpacing: '0.05em', fontWeight: '600' }],
 },
 borderRadius: { sm: '0.25rem', DEFAULT: '0.5rem', md: '0.75rem', lg: '1rem', xl: '1.5rem', full: '9999px' },
 spacing: { gutter: '24px', 'desktop-margin': '32px' },
 boxShadow: {
 'elevation-1': '0px 4px 12px rgba(0, 0, 0, 0.05)',
 'elevation-2': '0px 12px 24px rgba(0, 0, 0, 0.1)',
 },
 },
 },
 plugins: [],
};
