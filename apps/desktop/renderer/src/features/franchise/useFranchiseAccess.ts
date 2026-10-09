import { useQuery } from '@tanstack/react-query';
import { getAuthToken, getFranchiseAccess, type FranchiseAccessDto } from '../../lib/api';

export const FRANCHISE_ACCESS_QUERY_KEY = ['franchise-access'] as const;

const NONE: FranchiseAccessDto = { canActAsFranchisor: false, isFranchisee: false };

/**
 * What the signed-in company can do in the franchise network. The Franchise section is only for a company that
 * gives franchises to others (it needs the add-on); a franchisee only gets a small sharing page in Settings.
 * While this is loading, or if it cannot be loaded, nothing franchise-related is shown.
 */
export function useFranchiseAccess() {
	const hasAuth = Boolean(getAuthToken());
	const query = useQuery<FranchiseAccessDto>({
		queryKey: FRANCHISE_ACCESS_QUERY_KEY,
		queryFn: getFranchiseAccess,
		enabled: hasAuth,
		staleTime: 60 * 1000,
		retry: false,
	});

	return {
		...(query.data ?? NONE),
		isLoading: hasAuth && query.isLoading,
	};
}
