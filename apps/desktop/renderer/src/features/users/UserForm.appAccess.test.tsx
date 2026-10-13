import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UserForm } from './UserForm';
import * as api from '../../lib/api';

vi.mock('../../lib/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../lib/api')>();
	return { ...actual, createUser: vi.fn(), updateUser: vi.fn() };
});

const licences: api.LicenceUsageDto[] = [
	{ appAccess: 'Both', total: 1, used: 1 },
	{ appAccess: 'Windows', total: 0, used: 0 },
	{ appAccess: 'Android', total: 2, used: 1 },
];

describe('UserForm app access (per-app user licences)', () => {
	beforeEach(() => {
		vi.mocked(api.createUser).mockResolvedValue({} as never);
		vi.mocked(api.updateUser).mockResolvedValue({} as never);
	});

	it('offers only app types with a free licence and sends the choice', async () => {
		render(<UserForm permissionGroups={[]} licences={licences} canChangeAppAccess onClose={() => {}} onSuccess={() => {}} />);

		const select = screen.getByLabelText('App access') as HTMLSelectElement;
		// Both apps and Windows have nothing free; the first free type (Android) is chosen.
		expect(select.value).toBe('Android');
		expect(screen.getByRole('option', { name: /Windows \+ Android — 0 of 1 free/ })).toBeDisabled();
		expect(screen.getByRole('option', { name: /Windows only — 0 of 0 free/ })).toBeDisabled();
		expect(screen.getByRole('option', { name: /Android only — 1 of 2 free/ })).not.toBeDisabled();

		fireEvent.change(screen.getByPlaceholderText('e.g. Ramesh Kumar'), { target: { value: 'Field Staff' } });
		fireEvent.change(screen.getByPlaceholderText('e.g. ramesh'), { target: { value: 'field' } });
		fireEvent.change(screen.getByPlaceholderText('Min 8 characters'), { target: { value: 'Password#2026' } });
		fireEvent.change(screen.getByPlaceholderText('Confirm new password'), { target: { value: 'Password#2026' } });
		fireEvent.click(screen.getByRole('button', { name: 'Create User' }));

		await waitFor(() => expect(api.createUser).toHaveBeenCalled());
		expect(vi.mocked(api.createUser).mock.calls[0]![0]).toMatchObject({ username: 'field', appAccess: 'Android' });
	});

	it('lets only the Owner change an existing user, and keeps the user’s own licence selectable', () => {
		const user: api.UserItemDto = {
			id: 'u1', username: 'field', fullName: 'Field Staff', role: 'Staff', isActive: true, permissions: [],
			createdAt: '2026-01-01T00:00:00Z', appAccess: 'Android',
		};
		const { rerender } = render(<UserForm user={user} permissionGroups={[]} licences={licences} onClose={() => {}} onSuccess={() => {}} />);
		expect(screen.getByLabelText('App access')).toBeDisabled();
		expect(screen.getByText(/Only the Owner can change it/)).toBeInTheDocument();

		rerender(<UserForm user={user} permissionGroups={[]} licences={licences} canChangeAppAccess onClose={() => {}} onSuccess={() => {}} />);
		expect(screen.getByLabelText('App access')).not.toBeDisabled();
		// Their own Android licence counts as free for them.
		expect(screen.getByRole('option', { name: /Android only — 2 of 2 free/ })).not.toBeDisabled();
	});

	it('is hidden on a single-company server', () => {
		render(<UserForm permissionGroups={[]} licences={null} onClose={() => {}} onSuccess={() => {}} />);
		expect(screen.queryByLabelText('App access')).not.toBeInTheDocument();
	});
});

describe('sign-in', () => {
	it('tells the server it is the Windows app', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(JSON.stringify({ token: 't', user: { id: '1', fullName: 'A', username: 'a', role: 'Owner', isOwner: true, permissions: [] } }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			}),
		);
		await api.loginApi({ username: 'a', password: 'b', companyCode: '0001' });
		const body = JSON.parse(String(fetchMock.mock.calls[0]![1]!.body));
		expect(body).toMatchObject({ username: 'a', companyCode: '0001', app: 'windows' });
		fetchMock.mockRestore();
	});
});
