import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { RouteGuard } from './RouteGuard';
import { renderWithProviders } from '../../test/test-utils';

describe('RouteGuard Component', () => {
	it('renders loading indicator while authentication status is loading', () => {
		renderWithProviders(
			<RouteGuard>
				<div data-testid="protected-content">Protected Area</div>
			</RouteGuard>,
			{
				authContextValue: {
					isLoading: true,
					isAuthenticated: false,
				},
			}
		);

		expect(screen.getByText(/loading e6 car spa\.\.\./i)).toBeInTheDocument();
		expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
	});

	it('redirects to /setup when system is not initialized', () => {
		renderWithProviders(
			<Routes>
				<Route
					path="/dashboard"
					element={
						<RouteGuard>
							<div data-testid="protected-content">Protected Area</div>
						</RouteGuard>
					}
				/>
				<Route path="/setup" element={<div data-testid="setup-screen">First Time Setup</div>} />
			</Routes>,
			{
				initialEntries: ['/dashboard'],
				authContextValue: {
					isLoading: false,
					isInitialized: false,
					isAuthenticated: false,
				},
			}
		);

		expect(screen.getByTestId('setup-screen')).toBeInTheDocument();
		expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
	});

	it('redirects unauthenticated user to /login', () => {
		renderWithProviders(
			<Routes>
				<Route
					path="/customers"
					element={
						<RouteGuard>
							<div data-testid="protected-content">Customer Directory</div>
						</RouteGuard>
					}
				/>
				<Route path="/login" element={<div data-testid="login-screen">Login Page</div>} />
			</Routes>,
			{
				initialEntries: ['/customers'],
				authContextValue: {
					isLoading: false,
					isInitialized: true,
					isAuthenticated: false,
					user: null,
				},
			}
		);

		expect(screen.getByTestId('login-screen')).toBeInTheDocument();
		expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
	});

	it('renders AccessDenied when user lacks required permission', () => {
		renderWithProviders(
			<RouteGuard requiredPermission="manage_settings">
				<div data-testid="protected-content">Settings Area</div>
			</RouteGuard>,
			{
				authUser: {
					id: 'user-2',
					username: 'staff_user',
					fullName: 'Staff User',
					role: 'Staff',
					isOwner: false,
					permissions: ['view_job_cards'],
				},
				authContextValue: {
					isLoading: false,
					isInitialized: true,
					isAuthenticated: true,
				},
			}
		);

		expect(screen.getByText(/access denied/i)).toBeInTheDocument();
		expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
	});

	it('renders protected content when user is authenticated with required permission', () => {
		renderWithProviders(
			<RouteGuard requiredPermission="view_customers">
				<div data-testid="protected-content">Customer Management Content</div>
			</RouteGuard>,
			{
				authUser: {
					id: 'user-3',
					username: 'manager',
					fullName: 'Manager User',
					role: 'Manager',
					isOwner: false,
					permissions: ['view_customers', 'create_customers'],
				},
				authContextValue: {
					isLoading: false,
					isInitialized: true,
					isAuthenticated: true,
				},
			}
		);

		expect(screen.getByTestId('protected-content')).toBeInTheDocument();
		expect(screen.getByText('Customer Management Content')).toBeInTheDocument();
	});

	it('allows Owner full access to protected routes regardless of specific permission codes', () => {
		renderWithProviders(
			<RouteGuard requiredPermission="some_restricted_action">
				<div data-testid="protected-content">Owner Unrestricted Area</div>
			</RouteGuard>,
			{
				authUser: {
					id: 'user-1',
					username: 'owner_boss',
					fullName: 'Business Owner',
					role: 'Owner',
					isOwner: true,
					permissions: [],
				},
				authContextValue: {
					isLoading: false,
					isInitialized: true,
					isAuthenticated: true,
					isOwner: true,
				},
			}
		);

		expect(screen.getByTestId('protected-content')).toBeInTheDocument();
		expect(screen.getByText('Owner Unrestricted Area')).toBeInTheDocument();
	});
});
