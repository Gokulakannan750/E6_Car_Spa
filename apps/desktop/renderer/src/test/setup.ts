import * as matchers from '@testing-library/jest-dom/matchers';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Automatically unmount React component trees after each test
afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

// Mock window.matchMedia if missing in jsdom
if (typeof window !== 'undefined') {
	Object.defineProperty(window, 'matchMedia', {
		writable: true,
		value: vi.fn().mockImplementation((query: string) => ({
			matches: false,
			media: query,
			onchange: null,
			addListener: vi.fn(),
			removeListener: vi.fn(),
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			dispatchEvent: vi.fn(),
		})),
	});

	// Mock ResizeObserver
	class MockResizeObserver {
		observe = vi.fn();
		unobserve = vi.fn();
		disconnect = vi.fn();
	}

	window.ResizeObserver = window.ResizeObserver || (MockResizeObserver as unknown as typeof ResizeObserver);

	// Mock Electron IPC bridge with stable Promise returns
	if (!window.electronAPI) {
		window.electronAPI = {
			getVersion: () => Promise.resolve('1.0.0'),
			saveInvoicePdf: () => Promise.resolve({ success: true, filePath: '/mock/invoice.pdf' }),
			getAuthToken: () => Promise.resolve(null),
			setAuthToken: () => Promise.resolve(undefined),
		};
	}
}
