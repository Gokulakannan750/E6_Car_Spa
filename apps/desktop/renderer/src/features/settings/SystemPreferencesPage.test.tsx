import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import SystemPreferencesPage, {
	SYSTEM_PREFERENCES_STORAGE_KEY,
	DEFAULT_SYSTEM_PREFERENCES,
} from './SystemPreferencesPage';
import { renderWithProviders } from '../../test/test-utils';
import * as api from '../../lib/api';

vi.mock('../../lib/api', async (importOriginal) => {
	const actual = await importOriginal<typeof api>();
	return {
		...actual,
		getSystemPreferences: vi.fn(),
		updateSystemPreferences: vi.fn(),
	};
});

describe('SystemPreferencesPage Component', () => {
	beforeEach(() => {
		localStorage.clear();
		vi.clearAllMocks();
		vi.mocked(api.getSystemPreferences).mockResolvedValue({
			dateFormat: 'DD/MM/YYYY',
			timeFormat: '12h',
			currencySymbol: '₹',
			decimalPrecision: 2,
			defaultPrintCopies: 1,
			autoPrintReceipt: true,
			refreshInterval: 30,
			updatedAt: null,
		});
		vi.mocked(api.updateSystemPreferences).mockImplementation(async (req) => ({
			...req,
			updatedAt: new Date().toISOString(),
		}));
	});

	it('renders canonical System Preferences page with all 7 preference controls', async () => {
		renderWithProviders(<SystemPreferencesPage />, {
			initialEntries: ['/settings/system'],
			authUser: {
				id: 'usr-1',
				fullName: 'Admin User',
				username: 'admin',
				role: 'Owner',
				isOwner: true,
				permissions: ['settings.view'],
			},
		});

		expect(screen.getByRole('heading', { name: 'System Preferences', level: 1 })).toBeInTheDocument();
		expect(
			screen.getByText('Manage application preferences, formatting defaults, and system behavior')
		).toBeInTheDocument();

		// Section headings
		expect(screen.getByText('Date & Formatting')).toBeInTheDocument();
		expect(screen.getByText('Print & Document Defaults')).toBeInTheDocument();
		expect(screen.getByText('Operational Auto-Refresh')).toBeInTheDocument();
		expect(screen.getByText('System Environment')).toBeInTheDocument();
		expect(screen.getByText('Suite Launcher Shortcuts')).toBeInTheDocument();

		// All 7 controls
		expect(screen.getByLabelText('Date Display Format')).toBeInTheDocument();
		expect(screen.getByLabelText('Time Format')).toBeInTheDocument();
		expect(screen.getByLabelText('Default Currency Symbol')).toBeInTheDocument();
		expect(screen.getByLabelText('Decimal Precision')).toBeInTheDocument();
		expect(screen.getByLabelText('Default Invoice Print Copies')).toBeInTheDocument();
		expect(screen.getByLabelText(/auto-print on settlement/i)).toBeInTheDocument();
		expect(screen.getByLabelText('Live Operational Data Refresh Rate')).toBeInTheDocument();
	});

	it('loads authoritative preferences from server API and updates local storage cache', async () => {
		vi.mocked(api.getSystemPreferences).mockResolvedValueOnce({
			dateFormat: 'YYYY-MM-DD',
			timeFormat: '24h',
			currencySymbol: '₹',
			decimalPrecision: 0,
			defaultPrintCopies: 3,
			autoPrintReceipt: false,
			refreshInterval: 60,
			updatedAt: '2026-09-27T10:00:00Z',
		});

		renderWithProviders(<SystemPreferencesPage />, {
			initialEntries: ['/settings/system'],
			authUser: {
				id: 'usr-1',
				fullName: 'Admin User',
				username: 'admin',
				role: 'Owner',
				isOwner: true,
				permissions: ['settings.view'],
			},
		});

		await waitFor(() => {
			const dateSelect = screen.getByLabelText('Date Display Format') as HTMLSelectElement;
			expect(dateSelect.value).toBe('YYYY-MM-DD');
		});

		const currencySelect = screen.getByLabelText('Default Currency Symbol') as HTMLSelectElement;
		expect(currencySelect.value).toBe('₹');

		const decimalSelect = screen.getByLabelText('Decimal Precision') as HTMLSelectElement;
		expect(decimalSelect.value).toBe('0');

		const saved = JSON.parse(localStorage.getItem(SYSTEM_PREFERENCES_STORAGE_KEY) || '{}');
		expect(saved.currencySymbol).toBe('₹');
		expect(saved.decimalPrecision).toBe(0);
	});

	it('updates preferences via API mutation and persists to localStorage on save', async () => {
		renderWithProviders(<SystemPreferencesPage />, {
			initialEntries: ['/settings/system'],
			authUser: {
				id: 'usr-1',
				fullName: 'Admin User',
				username: 'admin',
				role: 'Owner',
				isOwner: true,
				permissions: ['settings.view', 'settings.business'],
			},
		});

		// Change decimal precision to 0
		const decimalSelect = screen.getByLabelText('Decimal Precision');
		fireEvent.change(decimalSelect, { target: { value: '0' } });

		// Change refresh interval to 15
		const refreshSelect = screen.getByLabelText('Live Operational Data Refresh Rate');
		fireEvent.change(refreshSelect, { target: { value: '15' } });

		// Click Save Preferences
		const saveButton = screen.getByRole('button', { name: /save preferences/i });
		fireEvent.click(saveButton);

		await waitFor(() => {
			expect(api.updateSystemPreferences).toHaveBeenCalledWith(
				expect.objectContaining({
					currencySymbol: '₹',
					decimalPrecision: 0,
					refreshInterval: 15,
				})
			);
		});

		await waitFor(() => {
			expect(screen.getByText('System preferences saved successfully.')).toBeInTheDocument();
		});

		const saved = JSON.parse(localStorage.getItem(SYSTEM_PREFERENCES_STORAGE_KEY) || '{}');
		expect(saved.currencySymbol).toBe('₹');
		expect(saved.decimalPrecision).toBe(0);
		expect(saved.refreshInterval).toBe(15);
	});

	it('resets preferences to canonical defaults via API and updates cache', async () => {
		localStorage.setItem(
			SYSTEM_PREFERENCES_STORAGE_KEY,
			JSON.stringify({ ...DEFAULT_SYSTEM_PREFERENCES, refreshInterval: 60 })
		);

		renderWithProviders(<SystemPreferencesPage />, {
			initialEntries: ['/settings/system'],
			authUser: {
				id: 'usr-1',
				fullName: 'Admin User',
				username: 'admin',
				role: 'Owner',
				isOwner: true,
				permissions: ['settings.view', 'settings.business'],
			},
		});

		const resetButton = screen.getByRole('button', { name: /reset defaults/i });
		fireEvent.click(resetButton);

		await waitFor(() => {
			expect(api.updateSystemPreferences).toHaveBeenCalledWith(
				expect.objectContaining({
					currencySymbol: '₹',
					dateFormat: 'DD/MM/YYYY',
					decimalPrecision: 2,
					refreshInterval: 30,
				})
			);
		});

		await waitFor(() => {
			expect(screen.getByText('Preferences reset to standard defaults.')).toBeInTheDocument();
		});

		const saved = JSON.parse(localStorage.getItem(SYSTEM_PREFERENCES_STORAGE_KEY) || '{}');
		expect(saved.currencySymbol).toBe('₹');
	});

	it('falls back to cached localStorage preferences when server load fails', async () => {
		localStorage.setItem(
			SYSTEM_PREFERENCES_STORAGE_KEY,
			JSON.stringify({
				dateFormat: 'MM/DD/YYYY',
				timeFormat: '24h',
				currencySymbol: '₹',
				decimalPrecision: 0,
				defaultPrintCopies: 2,
				autoPrintReceipt: false,
				refreshInterval: 15,
			})
		);

		vi.mocked(api.getSystemPreferences).mockRejectedValueOnce(new Error('Network error'));

		renderWithProviders(<SystemPreferencesPage />, {
			initialEntries: ['/settings/system'],
			authUser: {
				id: 'usr-1',
				fullName: 'Admin User',
				username: 'admin',
				role: 'Owner',
				isOwner: true,
				permissions: ['settings.view'],
			},
		});

		await waitFor(() => {
			expect(screen.getByText(/server currently unavailable/i)).toBeInTheDocument();
		});

		const currencySelect = screen.getByLabelText('Default Currency Symbol') as HTMLSelectElement;
		expect(currencySelect.value).toBe('₹');

		const dateSelect = screen.getByLabelText('Date Display Format') as HTMLSelectElement;
		expect(dateSelect.value).toBe('MM/DD/YYYY');
	});

	it('keeps the colour settings on their own Colours tab', async () => {
		renderWithProviders(<SystemPreferencesPage />, {
			initialEntries: ['/settings/system'],
			authUser: {
				id: 'usr-1',
				fullName: 'Admin User',
				username: 'admin',
				role: 'Owner',
				isOwner: true,
				permissions: ['settings.view'],
			},
		});

		// General tab: formatting controls, no colour card
		expect(screen.getByRole('tab', { name: 'General' })).toHaveAttribute('aria-selected', 'true');
		expect(screen.queryByLabelText('App colour code')).toBeNull();
		expect(screen.getByRole('button', { name: /save preferences/i })).toBeVisible();

		fireEvent.click(screen.getByRole('tab', { name: 'Colours' }));

		expect(screen.getByRole('tab', { name: 'Colours' })).toHaveAttribute('aria-selected', 'true');
		expect(await screen.findByLabelText('App colour code')).toBeInTheDocument();
		expect(screen.getByLabelText('Sidebar and login page code')).toBeInTheDocument();
		expect(screen.getByLabelText('Invoices and job cards code')).toBeInTheDocument();
		// The general-preferences Save button is hidden on this tab; the colours have their own Save.
		expect(screen.queryByRole('button', { name: /save preferences/i })).toBeNull();
	});
});
