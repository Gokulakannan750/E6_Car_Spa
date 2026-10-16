import { createContext, useContext } from 'react';
import { productApi } from '@/lib/api';
import { branding } from '@/lib/config';
import type { PublicCatalog } from '@/lib/types';
export const ProductContext = createContext<{ catalog: PublicCatalog; api: ReturnType<typeof productApi>; brand: ReturnType<typeof branding> } | null>(null);
export function useProduct() {
	const value = useContext(ProductContext);
	if (!value) throw new Error('Product context is missing');
	return value;
}
export function useBrand() {
	return useContext(ProductContext)?.brand ?? branding();
}
export function usePaths() {
	const { catalog } = useProduct();
	return { signup: `/signup/${catalog.productKey}`, pricing: `/pricing/${catalog.productKey}`, step: (step: string) => `/signup/${catalog.productKey}/${step}` };
}
