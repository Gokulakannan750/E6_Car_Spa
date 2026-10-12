import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { clearSession } from '@/lib/session';

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	clearSession();
	window.sessionStorage.clear();
});
