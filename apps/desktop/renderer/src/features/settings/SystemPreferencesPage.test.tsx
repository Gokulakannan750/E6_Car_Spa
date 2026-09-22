import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import SystemPreferencesPage, {
	SYSTEM_PREFERENCES_STORAGE_KEY,
	DEFAULT_SYSTEM_PREFERENCES,
} from './SystemPreferencesPage';
import { renderWithProviders } from '../../test/test-utils';

describe('SystemPreferencesPage Component', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('renders canonical System Preferences page with controls', async () => {
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
	});

	it('updates preferences and persists to localStorage on save', async () => {
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

		// Change currency symbol
		const currencySelect = screen.getByLabelText('Default Currency Symbol');
		fireEvent.change(currencySelect, { target: { value: '$' } });

		// Click Save Preferences
		const saveButton = screen.getByRole('button', { name: /save preferences/i });
		fireEvent.click(saveButton);

		await waitFor(() => {
			expect(screen.getByText('System preferences saved successfully.')).toBeInTheDocument();
		});

		const saved = JSON.parse(localStorage.getItem(SYSTEM_PREFERENCES_STORAGE_KEY) || '{}');
		expect(saved.currencySymbol).toBe('$');
	});

	it('resets preferences to standard defaults', async () => {
		localStorage.setItem(
			SYSTEM_PREFERENCES_STORAGE_KEY,
			JSON.stringify({ ...DEFAULT_SYSTEM_PREFERENCES, currencySymbol: '€', refreshInterval: 60 })
		);

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

		const resetButton = screen.getByRole('button', { name: /reset defaults/i });
		fireEvent.click(resetButton);

		await waitFor(() => {
			expect(screen.getByText('Preferences reset to standard defaults.')).toBeInTheDocument();
		});

		const saved = JSON.parse(localStorage.getItem(SYSTEM_PREFERENCES_STORAGE_KEY) || '{}');
		expect(saved.currencySymbol).toBe('₹');
	});
});
