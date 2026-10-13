import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { BusinessStep } from '@/pages/BusinessStep';
import { DonePage } from '@/pages/DonePage';
import { PlanStep } from '@/pages/PlanStep';
import { PricingPage } from '@/pages/PricingPage';
import { ReviewStep } from '@/pages/ReviewStep';
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

export function AppRoutes() {
	return (
		<>
			<ScrollToTop />
			<Routes>
				<Route path="/" element={<PricingPage />} />
				<Route path="/signup" element={<BusinessStep />} />
				<Route path="/signup/plan" element={<PlanStep />} />
				<Route path="/signup/review" element={<ReviewStep />} />
				<Route path="/signup/done" element={<DonePage />} />
				<Route path="*" element={<Navigate to="/" replace />} />
			</Routes>
		</>
	);
}

export function App({ queryClient = createQueryClient() }: { queryClient?: QueryClient }) {
	return (
		<QueryClientProvider client={queryClient}>
			<SignupProvider>
				<BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
					<AppRoutes />
				</BrowserRouter>
			</SignupProvider>
		</QueryClientProvider>
	);
}
