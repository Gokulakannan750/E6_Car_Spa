import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import UsersManagementPage from './UsersManagementPage';
import { renderWithProviders } from '../../test/test-utils';
import * as api from '../../lib/api';

vi.mock('../../lib/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../lib/api')>();
	return {
		...actual,
		getUsers: vi.fn(),
		getAvailablePermissions: vi.fn(),
		createUser: vi.fn(),
		updateUser: vi.fn(),
		toggleUserStatus: vi.fn(),
	};
});

describe('UsersManagementPage Component (User Management, Roles & Permissions)', () => {
	const mockUsers: api.UserItemDto[] = [
		{
			id: 'usr-1',
			username: 'owner',
			fullName: 'Gokul Kannan',
			email: 'gokul@e6carspa.com',
			role: 'Owner',
			isActive: true,
			permissions: ['*'],
			lastLoginAt: '2026-03-01T12:00:00Z',
			createdAt: '2026-01-01T00:00:00Z',
		},
		{
			id: 'usr-2',
			username: 'ramesh_mgr',
			fullName: 'Ramesh Kumar',
			email: 'ramesh@e6carspa.com',
			role: 'Manager',
			isActive: true,
			permissions: ['job_cards.create', 'invoices.create', 'payments.create'],
			lastLoginAt: '2026-03-02T15:30:00Z',
			createdAt: '2026-01-10T00:00:00Z',
		},
		{
			id: 'usr-3',
			username: 'suresh_staff',
			fullName: 'Suresh Raina',
			email: 'suresh@e6carspa.com',
			role: 'Staff',
			isActive: false,
			permissions: ['job_cards.view'],
			lastLoginAt: null,
			createdAt: '2026-02-01T00:00:00Z',
		},
	];

	const mockPermissionGroups: api.PermissionGroupDetailDto[] = [
		{
			module: 'job_cards',
			permissions: [
				{
					id: 'p-1',
					code: 'job_cards.create',
					name: 'Create Job Card',
					description: 'Allows creating new job cards',
					module: 'job_cards',
				},
				{
					id: 'p-2',
					code: 'job_cards.view',
					name: 'View Job Cards',
					description: 'Allows viewing job cards',
					module: 'job_cards',
				},
			],
		},
		{
			module: 'invoices',
			permissions: [
				{
					id: 'p-3',
					code: 'invoices.create',
					name: 'Create Invoice',
					description: 'Allows generating invoices',
					module: 'invoices',
				},
			],
		},
	];

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(api.getUsers).mockResolvedValue(mockUsers);
		vi.mocked(api.getAvailablePermissions).mockResolvedValue(mockPermissionGroups);
	});

	it('renders user directory with roles, permissions count, and search filter', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/users" element={<UsersManagementPage />} />
			</Routes>,
			{
				initialEntries: ['/users'],
				authUser: {
					id: 'usr-1',
					fullName: 'Gokul Kannan',
					username: 'owner',
					email: 'gokul@e6carspa.com',
					role: 'Owner',
					isOwner: true,
					permissions: ['*'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByText('Users & Permissions')).toBeInTheDocument();
			expect(screen.getByText('Gokul Kannan')).toBeInTheDocument();
			expect(screen.getByText('Ramesh Kumar')).toBeInTheDocument();
			expect(screen.getByText('Suresh Raina')).toBeInTheDocument();
		});

		// Verify role badges
		expect(screen.getByText('Owner')).toBeInTheDocument();
		expect(screen.getByText('Manager')).toBeInTheDocument();
		expect(screen.getByText('Staff')).toBeInTheDocument();

		// Verify search filter
		const searchInput = screen.getByPlaceholderText(/search users by name/i);
		fireEvent.change(searchInput, { target: { value: 'Ramesh' } });

		expect(screen.getByText('Ramesh Kumar')).toBeInTheDocument();
		expect(screen.queryByText('Suresh Raina')).not.toBeInTheDocument();
	});

	it('opens create user modal and submits a new user with selected permissions', async () => {
		vi.mocked(api.createUser).mockResolvedValue({
			id: 'usr-new',
			username: 'priya_mgr',
			fullName: 'Priya Sharma',
			email: 'priya@e6carspa.com',
			role: 'Manager',
			isActive: true,
			permissions: ['job_cards.create'],
			createdAt: '2026-03-08T00:00:00Z',
		});

		renderWithProviders(
			<Routes>
				<Route path="/users" element={<UsersManagementPage />} />
			</Routes>,
			{
				initialEntries: ['/users'],
				authUser: {
					id: 'usr-1',
					fullName: 'Gokul Kannan',
					username: 'owner',
					email: 'gokul@e6carspa.com',
					role: 'Owner',
					isOwner: true,
					permissions: ['users.create', 'users.edit', 'users.deactivate'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /add user/i })).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole('button', { name: /add user/i }));

		await waitFor(() => {
			expect(screen.getByText('Add New User')).toBeInTheDocument();
		});

		// Fill user form
		fireEvent.change(screen.getByPlaceholderText(/e\.g\. ramesh kumar/i), {
			target: { value: 'Priya Sharma' },
		});
		fireEvent.change(screen.getByPlaceholderText(/e\.g\. ramesh$/i), {
			target: { value: 'priya_mgr' },
		});
		fireEvent.change(screen.getByPlaceholderText('user@e6carspa.com'), {
			target: { value: 'priya@e6carspa.com' },
		});
		fireEvent.change(screen.getByPlaceholderText('Min 8 characters'), {
			target: { value: 'password123' },
		});
		fireEvent.change(screen.getByPlaceholderText('Confirm new password'), {
			target: { value: 'password123' },
		});

		// Submit user form
		const submitBtn = screen.getByRole('button', { name: /create user/i });
		fireEvent.click(submitBtn);

		await waitFor(() => {
			expect(api.createUser).toHaveBeenCalledWith(
				expect.objectContaining({
					fullName: 'Priya Sharma',
					username: 'priya_mgr',
					email: 'priya@e6carspa.com',
					password: 'password123',
					confirmPassword: 'password123',
					role: 'Staff',
				})
			);
		});
	});

	it('validates password mismatch during user creation', async () => {
		renderWithProviders(
			<Routes>
				<Route path="/users" element={<UsersManagementPage />} />
			</Routes>,
			{
				initialEntries: ['/users'],
				authUser: {
					id: 'usr-1',
					fullName: 'Gokul Kannan',
					username: 'owner',
					email: 'gokul@e6carspa.com',
					role: 'Owner',
					isOwner: true,
					permissions: ['users.create'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /add user/i })).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole('button', { name: /add user/i }));

		await waitFor(() => {
			expect(screen.getByText('Add New User')).toBeInTheDocument();
		});

		fireEvent.change(screen.getByPlaceholderText(/e\.g\. ramesh kumar/i), {
			target: { value: 'Test User' },
		});
		fireEvent.change(screen.getByPlaceholderText(/e\.g\. ramesh$/i), {
			target: { value: 'testuser' },
		});
		fireEvent.change(screen.getByPlaceholderText('Min 8 characters'), {
			target: { value: 'password123' },
		});
		fireEvent.change(screen.getByPlaceholderText('Confirm new password'), {
			target: { value: 'passwordMismatch' },
		});

		const submitBtn = screen.getByRole('button', { name: /create user/i });
		fireEvent.click(submitBtn);

		await waitFor(() => {
			expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
			expect(api.createUser).not.toHaveBeenCalled();
		});
	});

	it('opens edit modal and updates existing user details and role', async () => {
		vi.mocked(api.updateUser).mockResolvedValue({
			...mockUsers[1],
			fullName: 'Ramesh Kumar Senior',
			role: 'Manager',
		});

		renderWithProviders(
			<Routes>
				<Route path="/users" element={<UsersManagementPage />} />
			</Routes>,
			{
				initialEntries: ['/users'],
				authUser: {
					id: 'usr-1',
					fullName: 'Gokul Kannan',
					username: 'owner',
					email: 'gokul@e6carspa.com',
					role: 'Owner',
					isOwner: true,
					permissions: ['users.edit'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByText('Ramesh Kumar')).toBeInTheDocument();
		});

		const editButtons = screen.getAllByTitle('Edit user');
		fireEvent.click(editButtons[1]); // Edit Ramesh Kumar

		await waitFor(() => {
			expect(screen.getByText('Edit User: Ramesh Kumar')).toBeInTheDocument();
		});

		fireEvent.change(screen.getByDisplayValue('Ramesh Kumar'), {
			target: { value: 'Ramesh Kumar Senior' },
		});

		const saveBtn = screen.getByRole('button', { name: /save changes/i });
		fireEvent.click(saveBtn);

		await waitFor(() => {
			expect(api.updateUser).toHaveBeenCalledWith(
				'usr-2',
				expect.objectContaining({
					fullName: 'Ramesh Kumar Senior',
					role: 'Manager',
				})
			);
		});
	});

	it('toggles user activation status when confirmed', async () => {
		vi.spyOn(window, 'confirm').mockReturnValue(true);
		vi.mocked(api.toggleUserStatus).mockResolvedValue({ ...mockUsers[1], isActive: false });

		renderWithProviders(
			<Routes>
				<Route path="/users" element={<UsersManagementPage />} />
			</Routes>,
			{
				initialEntries: ['/users'],
				authUser: {
					id: 'usr-1',
					fullName: 'Gokul Kannan',
					username: 'owner',
					email: 'gokul@e6carspa.com',
					role: 'Owner',
					isOwner: true,
					permissions: ['users.deactivate'],
				},
			}
		);

		await waitFor(() => {
			expect(screen.getByText('Ramesh Kumar')).toBeInTheDocument();
		});

		const deactivateBtn = screen.getByTitle('Deactivate user');
		fireEvent.click(deactivateBtn);

		await waitFor(() => {
			expect(api.toggleUserStatus).toHaveBeenCalledWith('usr-2');
		});
	});
});
