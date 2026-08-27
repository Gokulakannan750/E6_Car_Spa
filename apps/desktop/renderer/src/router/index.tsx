import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '../components/shell/AppLayout';
import { RouteGuard } from '../components/auth/RouteGuard';
import { LoginPage, FirstTimeSetup } from '../features/auth';

// Import wrappers
const loadDashboard = () => import('../features/dashboard/DashboardPage');
const loadCustomers = () => import('../features/customers/CustomersPage');
const loadCustomerDetail = () => import('../features/customers/CustomerDetailPage');
const loadJobCards = () => import('../features/job-cards/JobCardsPage');
const loadNewJobCard = () => import('../features/job-cards/NewJobCard');
const loadJobCardDetail = () => import('../features/job-cards/JobCardDetailPage');
const loadInvoices = () => import('../features/invoices/Invoices');
const loadInvoiceDetail = () => import('../features/invoices/InvoiceDetailPage');
const loadCatalogue = () => import('../features/catalogue/CataloguePage');
const loadStaffAdvances = () => import('../features/staff-advances/StaffAdvancesPage');
const loadReports = () => import('../features/reports/ReportsPage');
const loadShowroom = () => import('../features/showroom/ShowroomPage');
const loadSettings = () => import('../features/settings/SettingsPage');
const loadUsers = () => import('../features/users/UsersManagementPage');
const loadAudit = () => import('../features/audit/AuditLogPage');
const loadPublicInvoice = () => import('../features/invoices/PublicInvoicePage');

export const router = createBrowserRouter([
	{
		path: '/login',
		element: <LoginPage />,
	},
	{
		path: '/setup',
		element: <FirstTimeSetup />,
	},
	{
		path: '/i/:token',
		lazy: async () => {
			const m = await loadPublicInvoice();
			return {
				Component: m.PublicInvoicePage,
			};
		},
	},
	{
		path: '/',
		element: (
			<RouteGuard>
				<AppLayout />
			</RouteGuard>
		),
		children: [
			{
				index: true,
				element: <Navigate to="/dashboard" replace />,
			},
			{
				path: '/dashboard',
				lazy: async () => {
					const m = await loadDashboard();
					return {
						Component: () => (
							<RouteGuard requiredPermission="dashboard.view">
								<m.DashboardPage />
							</RouteGuard>
						),
					};
				},
			},
			{
				path: '/customers',
				lazy: async () => {
					const m = await loadCustomers();
					return {
						Component: () => (
							<RouteGuard requiredPermission="customers.view">
								<m.CustomersPage />
							</RouteGuard>
						),
					};
				},
			},
			{
				path: '/customers/:id',
				lazy: async () => {
					const m = await loadCustomerDetail();
					return {
						Component: () => (
							<RouteGuard requiredPermission="customers.view">
								<m.CustomerDetailPage />
							</RouteGuard>
						),
					};
				},
			},
			{
				path: '/job-cards',
				lazy: async () => {
					const m = await loadJobCards();
					return {
						Component: () => (
							<RouteGuard requiredPermission="jobcards.view">
								<m.JobCardsPage />
							</RouteGuard>
						),
					};
				},
			},
			{
				path: '/job-cards/new',
				lazy: async () => {
					const m = await loadNewJobCard();
					const Comp = m.default;
					return {
						Component: () => (
							<RouteGuard requiredPermission="jobcards.create">
								<Comp />
							</RouteGuard>
						),
					};
				},
			},
			{
				path: '/job-cards/:id',
				lazy: async () => {
					const m = await loadJobCardDetail();
					return {
						Component: () => (
							<RouteGuard requiredPermission="jobcards.view">
								<m.JobCardDetailPage />
							</RouteGuard>
						),
					};
				},
			},
			{
				path: '/invoices',
				lazy: async () => {
					const m = await loadInvoices();
					return {
						Component: () => (
							<RouteGuard requiredPermission="invoices.view">
								<m.Invoices />
							</RouteGuard>
						),
					};
				},
			},
			{
				path: '/invoices/:id',
				lazy: async () => {
					const m = await loadInvoiceDetail();
					return {
						Component: () => (
							<RouteGuard requiredPermission="invoices.view">
								<m.InvoiceDetailPage />
							</RouteGuard>
						),
					};
				},
			},
			{
				path: '/catalogue',
				lazy: async () => {
					const m = await loadCatalogue();
					return {
						Component: () => (
							<RouteGuard requiredPermission="catalogue.view">
								<m.CataloguePage />
							</RouteGuard>
						),
					};
				},
			},
			{
				path: '/staff-advances',
				lazy: async () => {
					const m = await loadStaffAdvances();
					return {
						Component: () => (
							<RouteGuard requiredPermission="staff_advances.view">
								<m.StaffAdvancesPage />
							</RouteGuard>
						),
					};
				},
			},
			{
				path: '/reports',
				lazy: async () => {
					const m = await loadReports();
					return {
						Component: () => (
							<RouteGuard requiredPermission="reports.view">
								<m.ReportsPage />
							</RouteGuard>
						),
					};
				},
			},
			{
				path: '/showroom',
				lazy: async () => {
					const m = await loadShowroom();
					return {
						Component: () => (
							<RouteGuard requiredPermission="showroom.view">
								<m.ShowroomPage />
							</RouteGuard>
						),
					};
				},
			},
			{
				path: '/audit',
				lazy: async () => {
					const m = await loadAudit();
					return {
						Component: () => (
							<RouteGuard requiredPermission="audit.view">
								<m.AuditLogPage />
							</RouteGuard>
						),
					};
				},
			},
			{
				path: '/settings',
				lazy: async () => {
					const m = await loadSettings();
					const Comp = m.default;
					return {
						Component: () => (
							<RouteGuard requiredPermission="settings.view">
								<Comp />
							</RouteGuard>
						),
					};
				},
			},
			{
				path: '/settings/users',
				lazy: async () => {
					const m = await loadUsers();
					const Comp = m.default;
					return {
						Component: () => (
							<RouteGuard requiredPermission="users.view">
								<Comp />
							</RouteGuard>
						),
					};
				},
			},
			{
				path: '*',
				lazy: async () => {
					const m = await loadDashboard();
					return {
						Component: () => (
							<RouteGuard requiredPermission="dashboard.view">
								<m.DashboardPage />
							</RouteGuard>
						),
					};
				},
			},
		],
	},
]);
