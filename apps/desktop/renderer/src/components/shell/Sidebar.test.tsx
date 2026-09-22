import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { Sidebar } from './Sidebar';
import { renderWithProviders } from '../../test/test-utils';
import { useAppStore } from '../../stores/app';
import {
	getWorkspaceFromPath,
	isItemActive,
	WORKSPACE_NAVIGATION,
	GLOBAL_AUDIT_ITEM,
} from '../../constants/navigation';

vi.mock('../../features/settings/hooks/useBusinessProfile', () => ({
	useBusinessProfile: () => ({
		profile: { businessName: 'E6 Car Spa' },
		logoUrl: '',
		hasCustomLogo: false,
	}),
}));

const mockOwnerUser = {
	id: 'owner-1',
	fullName: 'Admin User',
	username: 'admin',
	role: 'Owner' as const,
	isOwner: true,
	permissions: ['*'],
};

describe('Workspace Navigation & Sidebar Architecture', () => {
	beforeEach(() => {
		useAppStore.setState({ sidebarCollapsed: false });
	});

	// ── 1. Route to Workspace Mapping ──────────────────────────────────────────
	describe('getWorkspaceFromPath mapping', () => {
		it('maps launcher routes to launcher workspace', () => {
			expect(getWorkspaceFromPath('/')).toBe('launcher');
			expect(getWorkspaceFromPath('/dashboard')).toBe('launcher');
			expect(getWorkspaceFromPath('/dashboard/overview')).toBe('launcher');
		});

		it('maps billing routes to billing workspace', () => {
			expect(getWorkspaceFromPath('/job-cards')).toBe('billing');
			expect(getWorkspaceFromPath('/job-cards/new')).toBe('billing');
			expect(getWorkspaceFromPath('/job-cards/jc-123')).toBe('billing');
			expect(getWorkspaceFromPath('/customers')).toBe('billing');
			expect(getWorkspaceFromPath('/customers/cust-123')).toBe('billing');
			expect(getWorkspaceFromPath('/invoices')).toBe('billing');
			expect(getWorkspaceFromPath('/invoices/inv-123')).toBe('billing');
			expect(getWorkspaceFromPath('/catalogue')).toBe('billing');
			expect(getWorkspaceFromPath('/payments')).toBe('billing');
			expect(getWorkspaceFromPath('/payments/pay-123')).toBe('billing');
		});

		it('maps staff routes to staff workspace', () => {
			expect(getWorkspaceFromPath('/staff')).toBe('staff');
			expect(getWorkspaceFromPath('/staff/123')).toBe('staff');
			expect(getWorkspaceFromPath('/staff-advances')).toBe('staff');
			expect(getWorkspaceFromPath('/staff-advances/adv-123')).toBe('staff');
			expect(getWorkspaceFromPath('/staff-attendance')).toBe('staff');
			expect(getWorkspaceFromPath('/staff-attendance/today')).toBe('staff');
			expect(getWorkspaceFromPath('/staff-salary')).toBe('staff');
			expect(getWorkspaceFromPath('/staff-salary/2026-03')).toBe('staff');
			expect(getWorkspaceFromPath('/attendance')).toBe('staff');
			expect(getWorkspaceFromPath('/salary')).toBe('staff');
		});

		it('maps showroom routes to showroom workspace', () => {
			expect(getWorkspaceFromPath('/showroom')).toBe('showroom');
			expect(getWorkspaceFromPath('/showroom/sh-123')).toBe('showroom');
		});

		it('maps reports routes to reports workspace', () => {
			expect(getWorkspaceFromPath('/reports')).toBe('reports');
			expect(getWorkspaceFromPath('/reports/sales')).toBe('reports');
		});

		it('maps settings and audit routes to settings workspace', () => {
			expect(getWorkspaceFromPath('/settings')).toBe('settings');
			expect(getWorkspaceFromPath('/settings/users')).toBe('settings');
			expect(getWorkspaceFromPath('/audit')).toBe('settings');
			expect(getWorkspaceFromPath('/audit/details')).toBe('settings');
		});
	});

	// ── 2. Workspace Navigation Isolation ─────────────────────────────────────
	describe('Workspace Navigation Isolation (Items 1-23)', () => {
		it('1. /dashboard shows Launcher navigation only', () => {
			renderWithProviders(<Sidebar />, {
				initialEntries: ['/dashboard'],
				authUser: mockOwnerUser,
			});

			expect(screen.getByText('Suite Home')).toBeInTheDocument();
			expect(screen.getByText('Applications')).toBeInTheDocument();
			expect(screen.getByText('Settings')).toBeInTheDocument();
			expect(screen.getByText('Audit Trail')).toBeInTheDocument();

			// Operational ERP modules must NOT be present
			expect(screen.queryByText('Customers')).not.toBeInTheDocument();
			expect(screen.queryByText('Job Cards')).not.toBeInTheDocument();
			expect(screen.queryByText('Invoices')).not.toBeInTheDocument();
			expect(screen.queryByText('Catalogue')).not.toBeInTheDocument();
			expect(screen.queryByText('Payments')).not.toBeInTheDocument();
			expect(screen.queryByText('Staff Advances')).not.toBeInTheDocument();
			expect(screen.queryByText('Showrooms')).not.toBeInTheDocument();
			expect(screen.queryByText('Business Reports')).not.toBeInTheDocument();
		});

		it('2. /job-cards shows Billing navigation only', () => {
			renderWithProviders(<Sidebar />, {
				initialEntries: ['/job-cards'],
				authUser: mockOwnerUser,
			});

			expect(screen.getByText('Suite Home')).toBeInTheDocument();
			expect(screen.getByText('Customers')).toBeInTheDocument();
			expect(screen.getByText('Job Cards')).toBeInTheDocument();
			expect(screen.getByText('Invoices')).toBeInTheDocument();
			expect(screen.getByText('Catalogue')).toBeInTheDocument();
			expect(screen.getByText('Payments')).toBeInTheDocument();
			expect(screen.getByText('Audit Trail')).toBeInTheDocument();

			// Unrelated modules must NOT be present
			expect(screen.queryByText('Staff Advances')).not.toBeInTheDocument();
			expect(screen.queryByText('Showrooms')).not.toBeInTheDocument();
			expect(screen.queryByText('Business Reports')).not.toBeInTheDocument();
		});

		it('3. /customers shows Billing navigation only', () => {
			renderWithProviders(<Sidebar />, {
				initialEntries: ['/customers'],
				authUser: mockOwnerUser,
			});

			expect(screen.getByText('Customers')).toBeInTheDocument();
			expect(screen.getByText('Job Cards')).toBeInTheDocument();
			expect(screen.queryByText('Staff Advances')).not.toBeInTheDocument();
			expect(screen.queryByText('Showrooms')).not.toBeInTheDocument();
		});

		it('4. /invoices shows Billing navigation only', () => {
			renderWithProviders(<Sidebar />, {
				initialEntries: ['/invoices'],
				authUser: mockOwnerUser,
			});

			expect(screen.getByText('Invoices')).toBeInTheDocument();
			expect(screen.getByText('Job Cards')).toBeInTheDocument();
			expect(screen.queryByText('Staff Advances')).not.toBeInTheDocument();
			expect(screen.queryByText('Showrooms')).not.toBeInTheDocument();
		});

		it('5. /staff-advances shows Staff navigation only', () => {
			renderWithProviders(<Sidebar />, {
				initialEntries: ['/staff-advances'],
				authUser: mockOwnerUser,
			});

			expect(screen.getByText('Suite Home')).toBeInTheDocument();
			expect(screen.getByText('Staff Directory')).toBeInTheDocument();
			expect(screen.getByText('Staff Advances')).toBeInTheDocument();
			expect(screen.getByText('Attendance')).toBeInTheDocument();
			expect(screen.getByText('Salary')).toBeInTheDocument();
			expect(screen.getByText('Audit Trail')).toBeInTheDocument();

			expect(screen.queryByText('Customers')).not.toBeInTheDocument();
			expect(screen.queryByText('Job Cards')).not.toBeInTheDocument();
			expect(screen.queryByText('Showrooms')).not.toBeInTheDocument();
		});

		it('6. /showroom shows Showroom navigation only', () => {
			renderWithProviders(<Sidebar />, {
				initialEntries: ['/showroom'],
				authUser: mockOwnerUser,
			});

			expect(screen.getByText('Suite Home')).toBeInTheDocument();
			expect(screen.getByText('Showrooms')).toBeInTheDocument();
			expect(screen.getByText('Staff Requests')).toBeInTheDocument();
			expect(screen.getByText('Showroom Attendance')).toBeInTheDocument();
			expect(screen.getByText('Showroom Billing')).toBeInTheDocument();
			expect(screen.getByText('Audit Trail')).toBeInTheDocument();

			expect(screen.queryByText('Customers')).not.toBeInTheDocument();
			expect(screen.queryByText('Staff Directory')).not.toBeInTheDocument();
			expect(screen.queryByText('Business Reports')).not.toBeInTheDocument();
		});

		it('7. /reports shows Reports navigation only', () => {
			renderWithProviders(<Sidebar />, {
				initialEntries: ['/reports'],
				authUser: mockOwnerUser,
			});

			expect(screen.getByText('Suite Home')).toBeInTheDocument();
			expect(screen.getByText('Business Reports')).toBeInTheDocument();
			expect(screen.getByText('Billing Reports')).toBeInTheDocument();
			expect(screen.getByText('Staff Reports')).toBeInTheDocument();
			expect(screen.getByText('Showroom Reports')).toBeInTheDocument();
			expect(screen.getByText('Custom Reports')).toBeInTheDocument();
			expect(screen.getByText('Audit Trail')).toBeInTheDocument();

			expect(screen.queryByText('Customers')).not.toBeInTheDocument();
			expect(screen.queryByText('Job Cards')).not.toBeInTheDocument();
			expect(screen.queryByText('Showrooms')).not.toBeInTheDocument();
		});

		it('8. /settings shows Settings navigation only without operational modules', () => {
			renderWithProviders(<Sidebar />, {
				initialEntries: ['/settings'],
				authUser: mockOwnerUser,
			});

			expect(screen.getByText('Suite Home')).toBeInTheDocument();
			expect(screen.getByText('Company Settings')).toBeInTheDocument();
			expect(screen.getByText('WhatsApp Settings')).toBeInTheDocument();
			expect(screen.getByText('Users & Access')).toBeInTheDocument();
			expect(screen.getByText('System Preferences')).toBeInTheDocument();
			expect(screen.getByText('Audit Trail')).toBeInTheDocument();

			// Zero cross-application bleed
			expect(screen.queryByText('Customers')).not.toBeInTheDocument();
			expect(screen.queryByText('Job Cards')).not.toBeInTheDocument();
			expect(screen.queryByText('Invoices')).not.toBeInTheDocument();
			expect(screen.queryByText('Catalogue')).not.toBeInTheDocument();
			expect(screen.queryByText('Payments')).not.toBeInTheDocument();
			expect(screen.queryByText('Staff Advances')).not.toBeInTheDocument();
			expect(screen.queryByText('Showrooms')).not.toBeInTheDocument();
			expect(screen.queryByText('Business Reports')).not.toBeInTheDocument();
		});

		it('9-11. Billing navigation does not contain Staff, Showroom, or Reports items', () => {
			renderWithProviders(<Sidebar />, {
				initialEntries: ['/job-cards'],
				authUser: mockOwnerUser,
			});

			expect(screen.queryByText('Staff Directory')).not.toBeInTheDocument();
			expect(screen.queryByText('Staff Advances')).not.toBeInTheDocument();
			expect(screen.queryByText('Showrooms')).not.toBeInTheDocument();
			expect(screen.queryByText('Business Reports')).not.toBeInTheDocument();
		});

		it('12-14. Staff navigation does not contain Billing, Showroom, or Reports items', () => {
			renderWithProviders(<Sidebar />, {
				initialEntries: ['/staff-advances'],
				authUser: mockOwnerUser,
			});

			expect(screen.queryByText('Customers')).not.toBeInTheDocument();
			expect(screen.queryByText('Job Cards')).not.toBeInTheDocument();
			expect(screen.queryByText('Showrooms')).not.toBeInTheDocument();
			expect(screen.queryByText('Business Reports')).not.toBeInTheDocument();
		});

		it('15-17. Showroom navigation does not contain Billing, Staff, or Reports items', () => {
			renderWithProviders(<Sidebar />, {
				initialEntries: ['/showroom'],
				authUser: mockOwnerUser,
			});

			expect(screen.queryByText('Customers')).not.toBeInTheDocument();
			expect(screen.queryByText('Staff Advances')).not.toBeInTheDocument();
			expect(screen.queryByText('Business Reports')).not.toBeInTheDocument();
		});

		it('18-20. Reports navigation does not contain Billing, Staff, or Showroom items', () => {
			renderWithProviders(<Sidebar />, {
				initialEntries: ['/reports'],
				authUser: mockOwnerUser,
			});

			expect(screen.queryByText('Customers')).not.toBeInTheDocument();
			expect(screen.queryByText('Job Cards')).not.toBeInTheDocument();
			expect(screen.queryByText('Staff Advances')).not.toBeInTheDocument();
			expect(screen.queryByText('Showrooms')).not.toBeInTheDocument();
		});

		it('21-23. Settings navigation does not contain Billing, Staff, or Showroom items', () => {
			renderWithProviders(<Sidebar />, {
				initialEntries: ['/settings'],
				authUser: mockOwnerUser,
			});

			expect(screen.queryByText('Customers')).not.toBeInTheDocument();
			expect(screen.queryByText('Staff Advances')).not.toBeInTheDocument();
			expect(screen.queryByText('Showrooms')).not.toBeInTheDocument();
		});
	});

	// ── 3. Suite Home & Global Audit Trail (Items 24-26) ────────────────────────
	describe('Suite Home & Global Audit Trail', () => {
		const testRoutes = ['/dashboard', '/job-cards', '/staff-advances', '/showroom', '/reports', '/settings'];

		testRoutes.forEach((route) => {
			it(`24-25. Suite Home exists and links to /dashboard in ${route}`, () => {
				renderWithProviders(<Sidebar />, {
					initialEntries: [route],
					authUser: mockOwnerUser,
				});

				const suiteHomeLink = screen.getByRole('link', { name: /suite home/i });
				expect(suiteHomeLink).toBeInTheDocument();
				expect(suiteHomeLink).toHaveAttribute('href', '/dashboard');
			});

			it(`26. Audit Trail is accessible from ${route}`, () => {
				renderWithProviders(<Sidebar />, {
					initialEntries: [route],
					authUser: mockOwnerUser,
				});

				const auditLink = screen.getByRole('link', { name: /audit trail/i });
				expect(auditLink).toBeInTheDocument();
				expect(auditLink).toHaveAttribute('href', '/audit');
			});
		});
	});

	// ── 4. Active Route Highlighting & Query Params (Items 27-29) ──────────────
	describe('Active Route Highlighting & isItemActive', () => {
		it('27. Active route highlighting works for nested paths', () => {
			const jobCardsItem = WORKSPACE_NAVIGATION.billing.find((i) => i.path === '/job-cards')!;
			expect(isItemActive(jobCardsItem, '/job-cards')).toBe(true);
			expect(isItemActive(jobCardsItem, '/job-cards/new')).toBe(true);
			expect(isItemActive(jobCardsItem, '/job-cards/jc-123')).toBe(true);
			expect(isItemActive(jobCardsItem, '/customers')).toBe(false);
		});

		it('28. Query parameters correctly activate Settings items', () => {
			const companyItem = WORKSPACE_NAVIGATION.settings.find((i) => i.path === '/settings')!;
			const whatsappItem = WORKSPACE_NAVIGATION.settings.find((i) => i.path === '/settings?tab=whatsapp')!;
			const systemItem = WORKSPACE_NAVIGATION.settings.find((i) => i.path === '/settings?tab=system')!;
			const usersItem = WORKSPACE_NAVIGATION.settings.find((i) => i.path === '/settings/users')!;

			// /settings (default tab = company)
			expect(isItemActive(companyItem, '/settings', '')).toBe(true);
			expect(isItemActive(whatsappItem, '/settings', '')).toBe(false);
			expect(isItemActive(systemItem, '/settings', '')).toBe(false);
			expect(isItemActive(usersItem, '/settings', '')).toBe(false);

			// /settings?tab=whatsapp
			expect(isItemActive(companyItem, '/settings', '?tab=whatsapp')).toBe(false);
			expect(isItemActive(whatsappItem, '/settings', '?tab=whatsapp')).toBe(true);

			// /settings?tab=system
			expect(isItemActive(companyItem, '/settings', '?tab=system')).toBe(false);
			expect(isItemActive(systemItem, '/settings', '?tab=system')).toBe(true);

			// /settings/users
			expect(isItemActive(companyItem, '/settings/users', '')).toBe(false);
			expect(isItemActive(usersItem, '/settings/users', '')).toBe(true);
		});

		it('29. Staff workspace items activate on their dedicated routes', () => {
			const staffDirItem = WORKSPACE_NAVIGATION.staff.find((i) => i.path === '/staff')!;
			const advancesItem = WORKSPACE_NAVIGATION.staff.find((i) => i.path === '/staff-advances')!;
			const attendanceItem = WORKSPACE_NAVIGATION.staff.find((i) => i.path === '/staff-attendance')!;
			const salaryItem = WORKSPACE_NAVIGATION.staff.find((i) => i.path === '/staff-salary')!;

			// /staff activates staff directory
			expect(isItemActive(staffDirItem, '/staff')).toBe(true);
			expect(isItemActive(advancesItem, '/staff')).toBe(false);

			// /staff-advances activates staff advances
			expect(isItemActive(advancesItem, '/staff-advances')).toBe(true);
			expect(isItemActive(staffDirItem, '/staff-advances')).toBe(false);

			// /staff-attendance activates attendance
			expect(isItemActive(attendanceItem, '/staff-attendance')).toBe(true);
			expect(isItemActive(advancesItem, '/staff-attendance')).toBe(false);

			// /staff-salary activates salary
			expect(isItemActive(salaryItem, '/staff-salary')).toBe(true);
			expect(isItemActive(advancesItem, '/staff-salary')).toBe(false);
		});

		it('renders active class #831821 on active navigation item', () => {
			renderWithProviders(<Sidebar />, {
				initialEntries: ['/job-cards'],
				authUser: mockOwnerUser,
			});

			const jobCardsLink = screen.getByRole('link', { name: /job cards/i });
			expect(jobCardsLink.className).toContain('bg-[#831821]');

			const customersLink = screen.getByRole('link', { name: /customers/i });
			expect(customersLink.className).not.toContain('bg-[#831821]');
		});
	});

	// ── 5. Sidebar Collapse/Expand & Permission Filtering (Items 30-31) ─────────
	describe('Collapse & Permission Controls', () => {
		it('30. Sidebar collapse/expand behavior functions properly', () => {
			const { container } = renderWithProviders(<Sidebar />, {
				initialEntries: ['/dashboard'],
				authUser: mockOwnerUser,
			});

			const aside = container.querySelector('aside');
			expect(aside).toHaveStyle({ width: '256px' });

			const collapseBtn = screen.getByTitle('Collapse sidebar');
			fireEvent.click(collapseBtn);

			expect(aside).toHaveStyle({ width: '64px' });
		});

		it('31. Permission filtering removes unauthorized items from sidebar', () => {
			const restrictedUser = {
				id: 'staff-1',
				fullName: 'Staff Member',
				username: 'staff',
				role: 'Staff' as const,
				isOwner: false,
				permissions: ['customers.view'], // Does NOT have jobcards.view, invoices.view, catalogue.view, audit.view
			};

			renderWithProviders(<Sidebar />, {
				initialEntries: ['/job-cards'],
				authUser: restrictedUser,
			});

			// Customers is permitted
			expect(screen.getByText('Customers')).toBeInTheDocument();

			// Unauthorized items are filtered out
			expect(screen.queryByText('Job Cards')).not.toBeInTheDocument();
			expect(screen.queryByText('Invoices')).not.toBeInTheDocument();
			expect(screen.queryByText('Catalogue')).not.toBeInTheDocument();
			expect(screen.queryByText('Audit Trail')).not.toBeInTheDocument();
		});
	});
});
