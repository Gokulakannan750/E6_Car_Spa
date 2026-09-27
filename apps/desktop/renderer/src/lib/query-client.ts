import { QueryClient } from '@tanstack/react-query';
import { getStoredPreferences } from '../features/settings/SystemPreferencesPage';

export function getSystemRefreshIntervalMs(): number | false {
	try {
		const prefs = getStoredPreferences();
		if (!prefs || prefs.refreshInterval === undefined || prefs.refreshInterval === 0) {
			return false;
		}
		return prefs.refreshInterval * 1000;
	} catch {
		return 30000;
	}
}

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 1000 * 10,
			retry: 1,
			refetchOnWindowFocus: true,
			refetchOnReconnect: true,
			refetchInterval: () => getSystemRefreshIntervalMs(),
			refetchIntervalInBackground: false,
		},
	},
});
