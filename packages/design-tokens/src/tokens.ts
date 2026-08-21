/**
 * Car Spa Management — Design Tokens
 * Extracted from Google Stitch "Velocity Enterprise" design system.
 * Single source of truth for colors, typography, spacing, radius, shadows.
 */

export const colors = {
 // Surface hierarchy
 background: '#f8f9fa',
 surface: '#f8f9fa',
 'surface-dim': '#d9dadb',
 'surface-bright': '#f8f9fa',
 'surface-container-lowest': '#ffffff',
 'surface-container-low': '#f3f4f5',
 'surface-container': '#edeeef',
 'surface-container-high': '#e7e8e9',
 'surface-container-highest': '#e1e3e4',
 'surface-variant': '#e1e3e4',

 // Primary (Deep Charcoal)
 primary: '#000101',
 'on-primary': '#ffffff',
 'primary-container': '#1a1c1e',
 'on-primary-container': '#838486',
 'primary-fixed': '#e2e2e5',
 'primary-fixed-dim': '#c6c6c9',
 'on-primary-fixed': '#1a1c1e',
 'on-primary-fixed-variant': '#454749',
 'inverse-primary': '#c6c6c9',

 // Secondary (Metallic Blue)
 secondary: '#0453cd',
 'on-secondary': '#ffffff',
 'secondary-container': '#356ee7',
 'on-secondary-container': '#fefcff',
 'secondary-fixed': '#dae2ff',
 'secondary-fixed-dim': '#b2c5ff',
 'on-secondary-fixed': '#001848',
 'on-secondary-fixed-variant': '#0040a2',

 // Tertiary (Dark Navy)
 tertiary: '#000103',
 'on-tertiary': '#ffffff',
 'tertiary-container': '#0e1d2d',
 'on-tertiary-container': '#77859a',
 'tertiary-fixed': '#d4e4fa',
 'tertiary-fixed-dim': '#b9c8de',
 'on-tertiary-fixed': '#0d1c2d',
 'on-tertiary-fixed-variant': '#39485a',

 // Error
 error: '#ba1a1a',
 'on-error': '#ffffff',
 'error-container': '#ffdad6',
 'on-error-container': '#93000a',

 // Text / Outline
 'on-background': '#191c1d',
 'on-surface': '#191c1d',
 'on-surface-variant': '#44474a',
 outline: '#75777a',
 'outline-variant': '#c5c6ca',

 // Inverse
 'inverse-surface': '#2e3132',
 'inverse-on-surface': '#f0f1f2',

 // Brand accent tint
 'surface-tint': '#5d5e61',
} as const;

export const typography = {
 'display-lg': {
 fontFamily: 'Inter',
 fontSize: '48px',
 fontWeight: '700',
 lineHeight: '56px',
 letterSpacing: '-0.02em',
 },
 'headline-lg': {
 fontFamily: 'Inter',
 fontSize: '32px',
 fontWeight: '600',
 lineHeight: '40px',
 letterSpacing: '-0.01em',
 },
 'headline-md': {
 fontFamily: 'Inter',
 fontSize: '24px',
 fontWeight: '600',
 lineHeight: '32px',
 },
 'headline-sm': {
 fontFamily: 'Inter',
 fontSize: '20px',
 fontWeight: '600',
 lineHeight: '28px',
 },
 'body-lg': {
 fontFamily: 'Inter',
 fontSize: '18px',
 fontWeight: '400',
 lineHeight: '28px',
 },
 'body-md': {
 fontFamily: 'Inter',
 fontSize: '16px',
 fontWeight: '400',
 lineHeight: '24px',
 },
 'body-sm': {
 fontFamily: 'Inter',
 fontSize: '14px',
 fontWeight: '400',
 lineHeight: '20px',
 },
 'label-md': {
 fontFamily: 'Inter',
 fontSize: '12px',
 fontWeight: '600',
 lineHeight: '16px',
 letterSpacing: '0.05em',
 },
 'headline-lg-mobile': {
 fontFamily: 'Inter',
 fontSize: '28px',
 fontWeight: '600',
 lineHeight: '36px',
 },
} as const;

export const spacing = {
 base: 4,
 xs: 8,
 sm: 12,
 md: 16,
 lg: 24,
 xl: 32,
 gutter: 24,
 'margin-mobile': 16,
 'margin-desktop': 32,
 'max-width': 1440,
} as const;

export const borderRadius = {
 sm: '0.25rem',
 DEFAULT: '0.25rem',
 md: '0.75rem',
 lg: '0.5rem',
 xl: '0.75rem',
 full: '9999px',
} as const;

export const shadows = {
 sm: '0px 4px 12px rgba(0, 0, 0, 0.05)',
 md: '0px 12px 24px rgba(0, 0, 0, 0.1)',
 'table-row': '0px 4px 12px rgba(0, 0, 0, 0.05)',
} as const;

export const layout = {
 sidebarWidth: '16rem', // 256px
 headerHeight: '4rem', // 64px
 maxContentWidth: '1440px',
 desktopColumns: 12,
 gutter: '24px',
 'margin-desktop': '32px',
 'margin-mobile': '16px',
} as const;

export const statusColors = {
 pending: {
 bg: '#fef9c3',
 text: '#b45309',
 border: '#fde047',
 },
 'in-progress': {
 bg: '#e0f2fe',
 text: '#0369a1',
 border: '#bae6fd',
 },
 ready: {
 bg: '#dcfce7',
 text: '#047857',
 border: '#bbf7d0',
 },
 completed: {
 bg: '#dcfce7',
 text: '#047857',
 border: '#bbf7d0',
 },
 cancelled: {
 bg: '#fee2e2',
 text: '#991b1b',
 border: '#fca5a5',
 },
 delayed: {
 bg: '#fee2e2',
 text: '#991b1b',
 border: '#fca5a5',
 },
 inspection: {
 bg: '#fef08a',
 text: '#854d0e',
 border: '#fde047',
 },
 new: {
 bg: '#f3f4f5',
 text: '#44474a',
 border: '#c5c6ca',
 },
 approved: {
 bg: '#e0f2fe',
 text: '#0369a1',
 border: '#bae6fd',
 },
 'active-balance': {
 bg: '#fff8e1',
 text: '#ff8f00',
 border: '#ffe082',
 },
 'fully-recovered': {
 bg: '#e8f5e9',
 text: '#2e7d32',
 border: '#a5d6a7',
 },
 draft: {
 bg: '#f3f4f5',
 text: '#44474a',
 border: '#c5c6ca',
 },
 sent: {
 bg: '#e0f2fe',
 text: '#0369a1',
 border: '#bae6fd',
 },
 rejected: {
 bg: '#fee2e2',
 text: '#b91c1c',
 border: '#fca5a5',
 },
 converted: {
 bg: '#356ee7',
 text: '#ffffff',
 border: '#356ee7',
 },
 expired: {
 bg: '#fee2e2',
 text: '#b91c1c',
 border: '#fca5a5',
 },
} as const;

export type StatusColorKey = keyof typeof statusColors;

export const designTokens = {
 colors,
 typography,
 spacing,
 borderRadius,
 shadows,
 layout,
 statusColors,
};

export default designTokens;
