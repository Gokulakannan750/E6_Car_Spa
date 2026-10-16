import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams, Link } from 'react-router-dom';
import { BusinessStep } from '@/pages/BusinessStep';
import { DonePage } from '@/pages/DonePage';
import { PlanStep } from '@/pages/PlanStep';
import { PricingPage } from '@/pages/PricingPage';
import { ReviewStep } from '@/pages/ReviewStep';
import { useQuery } from '@tanstack/react-query';
import { products, productApi } from '@/lib/api';
import { branding } from '@/lib/config';
import { ProductContext } from '@/state/product';
import { Page } from '@/components/Frame';
import { SignupProvider } from '@/state/signup';

export function createQueryClient() {
	return new QueryClient({
		defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: 1 }, mutations: { retry: false } },
	});
}

function ScrollToTop() {
	const { pathname } = useLocation();
	useEffect(() => {
		window.scrollTo(0, 0);
	}, [pathname]);
	return null;
}

type View = 'pricing' | 'business' | 'plan' | 'review' | 'done';
function ProductRoute({ view }: { view: View }) {
	const { productKey } = useParams();
	const listing = useQuery({ queryKey: ['products'], queryFn: products });
	const key = productKey ?? (listing.data?.length === 1 ? listing.data[0]?.key : undefined);
	const api = productApi(key ?? '');
	const catalog = useQuery({ queryKey: ['catalog', key], queryFn: () => api.catalog(), enabled: !!key && !!listing.data?.some((p) => p.key === key), retry: false });
	if (listing.isError)
		return (
			<Page>
				<p role="alert">{listing.error.message}</p>
			</Page>
		);
	if (listing.isPending)
		return (
			<Page>
				<p>Loading products…</p>
			</Page>
		);
	if (!key)
		return (
			<Page>
				<h1 className="text-display text-text-heading">Choose your product</h1>
				<div className="mt-8 grid gap-5 sm:grid-cols-2">
					{listing.data.map((p) => (
						<Link className="rounded-lg border border-border-subtle bg-surface-card p-6 text-title text-text-heading" key={p.key} to={`/pricing/${p.key}`}>
							{p.name}
							<span className="mt-2 block text-body text-action">View plans and sign up</span>
						</Link>
					))}
				</div>
			</Page>
		);
	if (!listing.data.some((p) => p.key === key) || catalog.isError)
		return (
			<Page>
				<h1 className="text-headline text-text-heading">Product not found</h1>
				<p>This product is unavailable. Please choose another product.</p>
				<Link to="/" className="text-action">
					Choose a product
				</Link>
			</Page>
		);
	if (!catalog.data)
		return (
			<Page>
				<p>Loading plans…</p>
			</Page>
		);
	const data = { ...catalog.data, seatTypes: [...catalog.data.seatTypes].sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code)) };
	const content = { pricing: <PricingPage />, business: <BusinessStep />, plan: <PlanStep />, review: <ReviewStep />, done: <DonePage /> }[view];
	return (
		<ProductContext.Provider value={{ catalog: data, api, brand: branding(data) }}>
			<SignupProvider key={key} catalog={data}>
				{content}
			</SignupProvider>
		</ProductContext.Provider>
	);
}
export function AppRoutes() {
	return (
		<>
			<ScrollToTop />
			<Routes>
				<Route path="/" element={<ProductRoute view="pricing" />} />
				<Route path="/pricing/:productKey" element={<ProductRoute view="pricing" />} />
				<Route path="/signup" element={<ProductRoute view="business" />} />
				{(['plan', 'review', 'done'] as const).map((view) => (
					<Route key={view} path={`/signup/${view}`} element={<ProductRoute view={view} />} />
				))}
				<Route path="/signup/:productKey" element={<ProductRoute view="business" />} />
				{(['plan', 'review', 'done'] as const).map((view) => (
					<Route key={view} path={`/signup/:productKey/${view}`} element={<ProductRoute view={view} />} />
				))}
				<Route path="*" element={<Navigate to="/" replace />} />
			</Routes>
		</>
	);
}
export function App({ queryClient = createQueryClient() }: { queryClient?: QueryClient }) {
	return (
		<QueryClientProvider client={queryClient}>
			<BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
				<AppRoutes />
			</BrowserRouter>
		</QueryClientProvider>
	);
}
