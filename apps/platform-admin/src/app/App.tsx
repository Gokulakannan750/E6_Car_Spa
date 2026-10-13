import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ToastProvider } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { AuthProvider, OWNER_ROLES } from '@/features/auth/AuthProvider';
import { SignInPage } from '@/features/auth/SignInPage';
import { ChangePasswordPage } from '@/features/auth/ChangePasswordPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { CompaniesPage } from '@/features/companies/CompaniesPage';
import { CompanyDetailPage } from '@/features/companies/CompanyDetailPage';
import { InvoicesPage } from '@/features/invoices/InvoicesPage';
import { SignupsPage } from '@/features/signups/SignupsPage';
import { InvoicePrintPage } from '@/features/invoices/InvoicePrintPage';
import { PlansPage } from '@/features/plans/PlansPage';
import { AuditLogPage } from '@/features/audit/AuditLogPage';
import { AdminsPage } from '@/features/admins/AdminsPage';
import { SystemPage } from '@/features/system/SystemPage';
import { AccountPage } from '@/features/account/AccountPage';
import { AppShell } from './layout/AppShell';
import { RequireAuth } from './RequireAuth';

export function createQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: 30_000,
				refetchOnWindowFocus: false,
				// Do not retry refusals (401/403/404/400); retry network blips once.
				retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 1,
			},
			mutations: { retry: false },
		},
	});
}

export function AppRoutes() {
	return (
		<Routes>
			<Route path="/sign-in" element={<SignInPage />} />
			<Route path="/change-password" element={<ChangePasswordPage />} />
			<Route
				path="/invoices/:id/print"
				element={
					<RequireAuth>
						<InvoicePrintPage />
					</RequireAuth>
				}
			/>
			<Route
				element={
					<RequireAuth>
						<AppShell />
					</RequireAuth>
				}
			>
				<Route path="/dashboard" element={<DashboardPage />} />
				<Route path="/companies" element={<CompaniesPage />} />
				<Route path="/companies/:id" element={<CompanyDetailPage />} />
				<Route path="/invoices" element={<InvoicesPage />} />
				<Route path="/signups" element={<SignupsPage />} />
				<Route path="/plans" element={<PlansPage />} />
				<Route path="/audit-log" element={<RequireAuth roles={OWNER_ROLES}><AuditLogPage /></RequireAuth>} />
				<Route path="/admins" element={<RequireAuth roles={OWNER_ROLES}><AdminsPage /></RequireAuth>} />
				<Route path="/system" element={<RequireAuth roles={OWNER_ROLES}><SystemPage /></RequireAuth>} />
				<Route path="/account" element={<AccountPage />} />
			</Route>
			<Route path="*" element={<Navigate to="/dashboard" replace />} />
		</Routes>
	);
}

export function App({ queryClient = createQueryClient() }: { queryClient?: QueryClient }) {
	return (
		<QueryClientProvider client={queryClient}>
			<ToastProvider>
				<BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
					<AuthProvider>
						<AppRoutes />
					</AuthProvider>
				</BrowserRouter>
			</ToastProvider>
		</QueryClientProvider>
	);
}
