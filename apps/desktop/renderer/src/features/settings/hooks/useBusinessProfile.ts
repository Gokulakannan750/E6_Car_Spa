import { useQuery } from '@tanstack/react-query';
import {
	getBusinessProfile,
	getCachedBusinessProfile,
	getAuthToken,
	resolveLogoUrl,
	type BusinessProfileDto,
} from '../../../lib/api';

export const BUSINESS_PROFILE_QUERY_KEY = ['business-profile'] as const;

export function useBusinessProfile() {
	const token = getAuthToken();
	const hasAuth = Boolean(token);

	const query = useQuery<BusinessProfileDto | null>({
		queryKey: BUSINESS_PROFILE_QUERY_KEY,
		queryFn: async () => {
			try {
				return await getBusinessProfile();
			} catch (err) {
				// If error occurs, fallback to cached profile
				const cached = getCachedBusinessProfile();
				if (cached) return cached;
				throw err;
			}
		},
		initialData: () => getCachedBusinessProfile() ?? null,
		enabled: hasAuth,
		staleTime: 30 * 1000, // 30 seconds
		refetchInterval: hasAuth ? 15 * 1000 : false, // Synchronize cross-device updates every 15s
		refetchOnWindowFocus: true,
	});

	const profile = query.data ?? getCachedBusinessProfile();
	const logoUrl = resolveLogoUrl(profile?.logoPath, profile?.updatedAt);
	const hasCustomLogo = Boolean(profile?.logoPath && profile.logoPath.trim().length > 0);

	return {
		profile,
		logoUrl,
		hasCustomLogo,
		isLoading: query.isLoading,
		isFetching: query.isFetching,
		error: query.error,
		refetch: query.refetch,
	};
}
