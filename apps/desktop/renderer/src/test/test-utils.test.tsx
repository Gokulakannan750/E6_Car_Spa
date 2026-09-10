import { describe, it, expect } from 'vitest';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { renderWithProviders, screen } from './test-utils';
import { useAuth } from '../features/auth';

function SampleComponent() {
	const location = useLocation();
	const { user, isAuthenticated, hasPermission } = useAuth();
	const { data, isLoading } = useQuery({
		queryKey: ['sample-data'],
		queryFn: async () => 'Query Data Loaded',
	});

	if (isLoading) return <div>Loading...</div>;

	return (
		<div>
			<div data-testid="route-path">{location.pathname}</div>
			<div data-testid="auth-status">{isAuthenticated ? `Logged in as ${user?.username}` : 'Anonymous'}</div>
			<div data-testid="permission-check">{hasPermission('invoices.view') ? 'Can View Invoices' : 'Cannot View Invoices'}</div>
			<div data-testid="query-result">{data}</div>
		</div>
	);
}

describe('Test Utilities (renderWithProviders)', () => {
	it('renders component with isolated QueryClient, MemoryRouter, and AuthContext', async () => {
		renderWithProviders(<SampleComponent />, {
			initialEntries: ['/invoices/123'],
			authUser: {
				id: 'u-1',
				username: 'manager_sam',
				fullName: 'Sam Manager',
				email: 'sam@e6carspa.com',
				role: 'Manager',
				isOwner: false,
				permissions: ['invoices.view'],
			},
		});

		expect(await screen.findByTestId('route-path')).toHaveTextContent('/invoices/123');
		expect(screen.getByTestId('auth-status')).toHaveTextContent('Logged in as manager_sam');
		expect(screen.getByTestId('permission-check')).toHaveTextContent('Can View Invoices');
		expect(screen.getByTestId('query-result')).toHaveTextContent('Query Data Loaded');
	});
});
