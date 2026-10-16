import { createContext, useContext, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Product } from '@/lib/types';
import { ErrorState, LoadingState } from '@/components/Surface';
const STORAGE_KEY = 'trovo.product';
const Context = createContext<{ products: Product[]; key?: string; select: (key: string) => void }>({ products: [], select: () => {} });
export function ProductProvider({ children }: { children: ReactNode }) {
	const query = useQuery({ queryKey: ['products'], queryFn: api.products, staleTime: Infinity });
	const [saved, setSaved] = useState<string>(() => {
		try {
			return sessionStorage.getItem(STORAGE_KEY) ?? '';
		} catch {
			return '';
		}
	});
	const products = query.data ?? [];
	const key = products.length === 1 ? products[0]!.key : products.some((p) => p.key === saved) ? saved : undefined;
	function select(next: string) {
		setSaved(next);
		try {
			sessionStorage.setItem(STORAGE_KEY, next);
		} catch {
			/* Storage can be disabled. */
		}
	}
	if (query.isPending) return <LoadingState label="Loading products…" />;
	if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
	return <Context.Provider value={{ products, key, select }}>{children}</Context.Provider>;
}
export function useProducts(productKey?: string) {
	const context = useContext(Context);
	const key = productKey ?? context.key;
	return { ...context, key, product: context.products.find((p) => p.key === key) };
}
export function ProductSelector() {
	const { products, key, select } = useProducts();
	if (products.length < 2) return null;
	return (
		<label className="flex min-w-0 items-center gap-2 text-label text-text-secondary">
			<span className="hidden sm:inline">Product</span>
			<select
				aria-label="Product"
				value={key ?? ''}
				onChange={(e) => select(e.target.value)}
				className="h-9 w-40 rounded-md border border-border-subtle bg-surface-alt px-2 text-text-heading sm:w-48"
			>
				<option value="">All products</option>
				{products.map((p) => (
					<option key={p.key} value={p.key}>
						{p.name}
					</option>
				))}
			</select>
		</label>
	);
}
export function ChooseProduct() {
	return (
		<div role="status" className="rounded-lg border border-border-subtle bg-surface-alt p-5 text-text-secondary">
			Choose a product in the top bar to create or edit its catalog and settings.
		</div>
	);
}
export function ProductBadge({ productKey }: { productKey?: string | null }) {
	const { products } = useProducts();
	return (
		<span className="inline-block whitespace-nowrap rounded border border-border-subtle bg-surface-alt px-2 py-0.5 text-micro text-text-secondary">
			{products.find((p) => p.key === productKey)?.name ?? productKey ?? 'Platform'}
		</span>
	);
}
