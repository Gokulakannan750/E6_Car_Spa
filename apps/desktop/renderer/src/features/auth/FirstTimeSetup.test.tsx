import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, act } from '@testing-library/react';
import FirstTimeSetup from './FirstTimeSetup';
import { renderWithProviders } from '../../test/test-utils';
import * as api from '../../lib/api';

vi.mock('../../lib/api', async () => {
	const actual = await vi.importActual('../../lib/api');
	return {
		...actual,
		getAuthStatus: vi.fn(),
		bootstrapOwner: vi.fn(),
	};
});

describe('FirstTimeSetup Component & Cross-Device Refresh', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers({ shouldAdvanceTime: true });
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('1. renders first-time setup screen when initialized is false', () => {
		vi.mocked(api.getAuthStatus).mockResolvedValue({ initialized: false });

		renderWithProviders(<FirstTimeSetup />, {
			authContextValue: { isInitialized: false },
			initialEntries: ['/setup'],
		});

		expect(screen.getByText('WELCOME TO E6 CAR SPA')).toBeInTheDocument();
		expect(screen.getByText('First-Time Setup — Create Owner Account')).toBeInTheDocument();
		expect(screen.getByText(/initial setup/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /create owner account/i })).toBeInTheDocument();
	});

	it('2. inputs are NOT pre-populated with hardcoded user identity', () => {
		vi.mocked(api.getAuthStatus).mockResolvedValue({ initialized: false });

		renderWithProviders(<FirstTimeSetup />, {
			authContextValue: { isInitialized: false },
			initialEntries: ['/setup'],
		});

		const nameInput = screen.getByLabelText(/full name/i) as HTMLInputElement;
		const userInput = screen.getByLabelText(/username/i) as HTMLInputElement;

		expect(nameInput.value).toBe('');
		expect(userInput.value).toBe('');
	});

	it('3. periodically polls getAuthStatus and triggers checkInitialization when initialized becomes true', async () => {
		let pollCount = 0;
		vi.mocked(api.getAuthStatus).mockImplementation(async () => {
			pollCount++;
			if (pollCount >= 2) {
				return { initialized: true };
			}
			return { initialized: false };
		});

		const mockCheckInit = vi.fn().mockResolvedValue(true);

		renderWithProviders(<FirstTimeSetup />, {
			authContextValue: {
				isInitialized: false,
				checkInitialization: mockCheckInit,
			},
			initialEntries: ['/setup'],
		});

		// Initial render: screen is visible
		expect(screen.getByText('WELCOME TO E6 CAR SPA')).toBeInTheDocument();

		// Advance time by 10s (first poll interval)
		await act(async () => {
			await vi.advanceTimersByTimeAsync(10000);
		});

		// After first poll, initialized was still false
		expect(api.getAuthStatus).toHaveBeenCalledTimes(1);
		expect(mockCheckInit).not.toHaveBeenCalled();

		// Advance time by another 10s (second poll interval -> initialized = true)
		await act(async () => {
			await vi.advanceTimersByTimeAsync(10000);
		});

		expect(api.getAuthStatus).toHaveBeenCalledTimes(2);
		expect(mockCheckInit).toHaveBeenCalledWith(false);
	});

	it('4. triggers status check when window regains focus', async () => {
		vi.mocked(api.getAuthStatus).mockResolvedValue({ initialized: false });

		renderWithProviders(<FirstTimeSetup />, {
			authContextValue: { isInitialized: false },
			initialEntries: ['/setup'],
		});

		// Fire window focus event
		await act(async () => {
			window.dispatchEvent(new Event('focus'));
		});

		expect(api.getAuthStatus).toHaveBeenCalled();
	});

	it('5. preserves setup screen and state when periodic status check fails (backend offline)', async () => {
		vi.mocked(api.getAuthStatus).mockRejectedValue(new Error('Network connection timeout'));
		const mockCheckInit = vi.fn();

		renderWithProviders(<FirstTimeSetup />, {
			authContextValue: {
				isInitialized: false,
				checkInitialization: mockCheckInit,
			},
			initialEntries: ['/setup'],
		});

		// Type in some text to ensure form input is preserved
		const nameInput = screen.getByLabelText(/full name/i) as HTMLInputElement;
		fireEvent.change(nameInput, { target: { value: 'Draft Owner Name' } });
		expect(nameInput.value).toBe('Draft Owner Name');

		// Advance timer by 10 seconds to trigger periodic poll
		await act(async () => {
			await vi.advanceTimersByTimeAsync(10000);
		});

		// Screen remains intact and field value is preserved
		expect(screen.getByText('WELCOME TO E6 CAR SPA')).toBeInTheDocument();
		expect(nameInput.value).toBe('Draft Owner Name');
		expect(mockCheckInit).not.toHaveBeenCalled();
	});

	it('6. stops polling when component unmounts', async () => {
		vi.mocked(api.getAuthStatus).mockResolvedValue({ initialized: false });

		const { unmount } = renderWithProviders(<FirstTimeSetup />, {
			authContextValue: { isInitialized: false },
			initialEntries: ['/setup'],
		});

		unmount();

		// Advance time after unmount
		await act(async () => {
			await vi.advanceTimersByTimeAsync(30000);
		});

		// No polls should have been triggered after unmount
		expect(api.getAuthStatus).not.toHaveBeenCalled();
	});

	it('7. validates required fields on submit', async () => {
		renderWithProviders(<FirstTimeSetup />, {
			authContextValue: { isInitialized: false },
			initialEntries: ['/setup'],
		});

		const submitBtn = screen.getByRole('button', { name: /create owner account/i });
		fireEvent.submit(submitBtn.closest('form')!);

		expect(screen.getByText('Full name is required.')).toBeInTheDocument();
	});
});
