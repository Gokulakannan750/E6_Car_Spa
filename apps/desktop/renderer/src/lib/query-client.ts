/**
 * React Query client setup
 */

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 1000 * 10,
			retry: 1,
			refetchOnWindowFocus: true,
			refetchOnReconnect: true,
			refetchInterval: 12000,
			refetchIntervalInBackground: false,
		},
	},
});
