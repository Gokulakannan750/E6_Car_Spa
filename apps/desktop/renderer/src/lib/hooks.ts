import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Generic query hook factory
export function useApiQuery<T>(
 key: string[],
 fn: () => Promise<T>,
 options?: { enabled?: boolean }
) {
 return useQuery({
 queryKey: key,
 queryFn: fn,
 enabled: options?.enabled,
 });
}

// Generic mutation hook factory
export function useApiMutation<TData, TVariables>(
 fn: (variables: TVariables) => Promise<TData>,
 options?: {
 onSuccess?: () => void;
 invalidateKey?: string[];
 }
) {
 const queryClient = useQueryClient();

 return useMutation({
 mutationFn: fn,
 onSuccess: () => {
 options?.onSuccess?.();
 if (options?.invalidateKey) {
 queryClient.invalidateQueries({ queryKey: options.invalidateKey });
 }
 },
 });
}
