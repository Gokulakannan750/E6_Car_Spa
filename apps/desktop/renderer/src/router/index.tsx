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
const loadStaffDirectory = () => import('../features/staff/StaffDirectoryPage');
const loadStaffAdvances = () => import('../features/staff/StaffAdvancesPage');
const loadAttendance = () => import('../features/staff/AttendancePage');
const loadSalary = () => import('../features/staff/SalaryPage');
const loadReports = () => import('../features/reports/ReportsPage');
const loadShowroom = () => import('../features/showroom/ShowroomPage');
const loadShowroomAttendance = () => import('../features/showroom/ShowroomAttendancePage');
const loadShowroomBill = () => import('../features/showroom/ShowroomBillPage');
const loadShowroomOperations = () => import('../features/showroom/ShowroomOperationsPage');
const loadSettings = () => import('../features/settings/SettingsPage');
const loadWhatsAppSettings = () => import('../features/settings/WhatsAppSettingsPage');
const loadSystemPreferences = () => import('../features/settings/SystemPreferencesPage');
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
				path: '/payments',
				element: <Navigate to="/invoices" replace />,
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
				path: '/staff',
				lazy: async () => {
					const m = await loadStaffDirectory();
					return {
						Component: () => (
							<RouteGuard requiredPermission="staff_advances.view">
								<m.StaffDirectoryPage />
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
				path: '/staff-attendance',
				lazy: async () => {
					const m = await loadAttendance();
					return {
						Component: () => (
							<RouteGuard requiredPermission="staff_advances.view">
								<m.AttendancePage />
							</RouteGuard>
						),
					};
				},
			},
			{
				path: '/attendance',
				lazy: async () => {
					const m = await loadAttendance();
					return {
						Component: () => (
							<RouteGuard requiredPermission="staff_advances.view">
								<m.AttendancePage />
							</RouteGuard>
						),
					};
				},
			},
			{
				path: '/staff-salary',
				lazy: async () => {
					const m = await loadSalary();
					return {
						Component: () => (
							<RouteGuard requiredPermission="staff_advances.view">
								<m.SalaryPage />
							</RouteGuard>
						),
					};
				},
			},
			{
				path: '/salary',
				lazy: async () => {
					const m = await loadSalary();
					return {
						Component: () => (
							<RouteGuard requiredPermission="staff_advances.view">
								<m.SalaryPage />
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
				path: '/showroom/attendance',
				lazy: async () => {
					const m = await loadShowroomAttendance();
					return {
						Component: () => (
							<RouteGuard requiredPermission="showroom.view">
								<m.ShowroomAttendancePage />
							</RouteGuard>
						),
					};
				},
			},
			{
				path: '/showroom/bill',
				lazy: async () => {
					const m = await loadShowroomBill();
					return {
						Component: () => (
							<RouteGuard requiredPermission="showroom.view">
								<m.ShowroomBillPage />
							</RouteGuard>
						),
					};
				},
			},
			{
				path: '/showroom/billing',
				element: <Navigate to="/showroom/bill" replace />,
			},
			{
				path: '/showroom/operations',
				lazy: async () => {
					const m = await loadShowroomOperations();
					return {
						Component: () => (
							<RouteGuard requiredPermission="showroom.view">
								<m.ShowroomOperationsPage />
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
				path: '/settings/whatsapp',
				lazy: async () => {
					const m = await loadWhatsAppSettings();
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
				path: '/settings/system',
				lazy: async () => {
					const m = await loadSystemPreferences();
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
], {
	future: {
		v7_relativeSplatPath: true,
	},
});
