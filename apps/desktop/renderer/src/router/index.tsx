import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '../components/shell/AppLayout';

// Import wrappers (lowercase names to avoid collision with destructured exports)
const loadDashboard = () => import('../features/dashboard/DashboardPage');
const loadCustomers = () => import('../features/customers/CustomersPage');
const loadCustomerDetail = () => import('../features/customers/CustomerDetailPage');
const loadJobCards = () => import('../features/job-cards/JobCardsPage');
const loadNewJobCard = () => import('../features/job-cards/NewJobCard');
const loadJobCardDetail = () => import('../features/job-cards/JobCardDetailPage');
const loadInvoices = () => import('../features/invoices/Invoices');
const loadCatalogue = () => import('../features/catalogue/CataloguePage');
const loadStaffAdvances = () => import('../features/staff-advances/StaffAdvancesPage');
const loadReports = () => import('../features/reports/ReportsPage');
const loadShowroom = () => import('../features/showroom/ShowroomPage');
const loadSettings = () => import('../features/settings/SettingsPage');

export const router = createBrowserRouter([
 {
 path: '/',
 element: <AppLayout />,
 children: [
 { path: '/dashboard', lazy: async () => { const m = await loadDashboard(); return { Component: m.DashboardPage }; } },
 { path: '/customers', lazy: async () => { const m = await loadCustomers(); return { Component: m.CustomersPage }; } },
 { path: '/customers/:id', lazy: async () => { const m = await loadCustomerDetail(); return { Component: m.CustomerDetailPage }; } },
 { path: '/job-cards', lazy: async () => { const m = await loadJobCards(); return { Component: m.JobCardsPage }; } },
 { path: '/job-cards/new', lazy: async () => { const m = await loadNewJobCard(); return { Component: m.default }; } },
 { path: '/job-cards/:id', lazy: async () => { const m = await loadJobCardDetail(); return { Component: m.JobCardDetailPage }; } },
 { path: '/invoices', lazy: async () => { const m = await loadInvoices(); return { Component: m.Invoices }; } },
 { path: '/catalogue', lazy: async () => { const m = await loadCatalogue(); return { Component: m.CataloguePage }; } },
 { path: '/staff-advances', lazy: async () => { const m = await loadStaffAdvances(); return { Component: m.StaffAdvancesPage }; } },
 { path: '/reports', lazy: async () => { const m = await loadReports(); return { Component: m.ReportsPage }; } },
 { path: '/showroom', lazy: async () => { const m = await loadShowroom(); return { Component: m.ShowroomPage }; } },
 { path: '/settings', lazy: async () => { const m = await loadSettings(); return { Component: m.default }; } },
 { path: '*', lazy: async () => { const m = await loadDashboard(); return { Component: m.DashboardPage }; } },
 ],
 },
]);
