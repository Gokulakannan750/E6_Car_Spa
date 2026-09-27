import { useEffect } from 'react';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { queryClient } from './lib/query-client';
import { AuthProvider } from './features/auth';
import { getSystemPreferences } from './lib/api';
import { saveStoredPreferences, type SystemPreferences } from './features/settings/SystemPreferencesPage';

function PreferencesSync() {
	const { data: serverPrefs } = useQuery({
		queryKey: ['system-preferences'],
		queryFn: getSystemPreferences,
		staleTime: 1000 * 30,
	});

	useEffect(() => {
		if (serverPrefs) {
			const loaded: SystemPreferences = {
				dateFormat: serverPrefs.dateFormat,
				timeFormat: serverPrefs.timeFormat,
				currencySymbol: '₹',
				decimalPrecision: serverPrefs.decimalPrecision ?? 2,
				defaultPrintCopies: serverPrefs.defaultPrintCopies ?? 1,
				autoPrintReceipt: serverPrefs.autoPrintReceipt ?? true,
				refreshInterval: serverPrefs.refreshInterval ?? 30,
			};
			saveStoredPreferences(loaded);
		}
	}, [serverPrefs]);

	return null;
}

export default function App() {
	return (
		<QueryClientProvider client={queryClient}>
			<PreferencesSync />
			<AuthProvider>
				<RouterProvider router={router} future={{ v7_startTransition: true }} />
			</AuthProvider>
		</QueryClientProvider>
	);
}