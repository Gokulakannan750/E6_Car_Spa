import { describe, it, expect } from 'vitest';
import { getPageTitle, ROUTE_TITLES } from './AppLayout';

describe('AppLayout getPageTitle', () => {
	it('maps all expected routes to correct page titles', () => {
		// 1. Dashboard
		expect(getPageTitle('/')).toBe('Dashboard');
		expect(getPageTitle('/dashboard')).toBe('Dashboard');

		// 2. Customers
		expect(getPageTitle('/customers')).toBe('Customers');
		expect(getPageTitle('/customers/cust-123')).toBe('Customers');

		// 3. Job Cards
		expect(getPageTitle('/job-cards')).toBe('Job Cards');
		expect(getPageTitle('/job-cards/new')).toBe('Job Cards');
		expect(getPageTitle('/job-cards/jc-123')).toBe('Job Cards');

		// 4. Invoices & Payments
		expect(getPageTitle('/invoices')).toBe('Invoices');
		expect(getPageTitle('/invoices/inv-123')).toBe('Invoices');
		expect(getPageTitle('/payments')).toBe('Payments');
		expect(getPageTitle('/payments/pay-123')).toBe('Payments');

		// 5. Catalogue
		expect(getPageTitle('/catalogue')).toBe('Catalogue');

		// 6. Staff Workspace (Independent Features)
		expect(getPageTitle('/staff')).toBe('Staff Directory');
		expect(getPageTitle('/staff/staff-123')).toBe('Staff Directory');
		expect(getPageTitle('/staff-advances')).toBe('Staff Advances');
		expect(getPageTitle('/staff-advances/adv-123')).toBe('Staff Advances');
		expect(getPageTitle('/staff-attendance')).toBe('Staff Attendance');
		expect(getPageTitle('/attendance')).toBe('Staff Attendance');
		expect(getPageTitle('/staff-salary')).toBe('Staff Salary');
		expect(getPageTitle('/salary')).toBe('Staff Salary');

		// 7. Reports
		expect(getPageTitle('/reports')).toBe('Reports');

		// 8. Showroom
		expect(getPageTitle('/showroom')).toBe('Showroom');

		// 9. Audit Trail (previously returned Dashboard)
		expect(getPageTitle('/audit')).toBe('Audit Trail');
		expect(getPageTitle('/audit/details')).toBe('Audit Trail');

		// 10. Users & Access
		expect(getPageTitle('/settings/users')).toBe('Users & Access');

		// 11. Settings
		expect(getPageTitle('/settings')).toBe('Settings');
	});

	it('includes /audit in ROUTE_TITLES mapping', () => {
		expect(ROUTE_TITLES['/audit']).toBe('Audit Trail');
	});

	it('falls back to Dashboard for unknown routes', () => {
		expect(getPageTitle('/unknown-route')).toBe('Dashboard');
	});
});
