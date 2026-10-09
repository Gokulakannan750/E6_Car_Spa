import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SESSION_CHANGED_EVENT } from './auth-context';

/**
 * Forgets everything the app has loaded whenever the session changes (someone signs out, signs in, or the session
 * expires), so one company never sees another company's cached data in the same window.
 */
export function SessionCacheReset() {
	const queryClient = useQueryClient();
	useEffect(() => {
		const reset = () => queryClient.clear();
		window.addEventListener(SESSION_CHANGED_EVENT, reset);
		return () => window.removeEventListener(SESSION_CHANGED_EVENT, reset);
	}, [queryClient]);
	return null;
}
