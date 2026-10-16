import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { carSpa } from '@/test/products';
import { adminWith, fakeApi, renderApp, signIn } from '@/test/utils';

describe('PublicListingCard', () => {
	it('displays current public listing fields and updates them with a reason dialog', async () => {
		signIn(adminWith('Owner'));
		const api = fakeApi([
			{ path: '/api/platform/products', body: [carSpa] },
			{ path: '/api/platform/settings', body: { trialDays: 7, trialLicences: 3, graceDays: 7, renewalInvoiceDaysBefore: 7, franchiseCodeMinutes: 60 } },
			{ path: '/api/platform/migrations', body: [] },
			{
				method: 'PUT',
				path: '/api/platform/products/carspa/public-listing',
				handle: (body) => ({ ...carSpa, ...(body as object) }),
			},
		]);
		const user = userEvent.setup();
		renderApp('/system');

		await screen.findByRole('heading', { name: 'Public listing · Car Spa' });
		const taglineInput = screen.getByLabelText('Public tagline');
		const descInput = screen.getByLabelText('Public description');
		const urlInput = screen.getByLabelText('Learn more URL');

		expect(taglineInput).toHaveValue(carSpa.publicTagline);
		expect(descInput).toHaveValue(carSpa.publicDescription);
		expect(urlInput).toHaveValue(carSpa.learnMoreUrl);

		// Non-https URL validation
		await user.clear(urlInput);
		await user.type(urlInput, 'http://insecure.test');
		await user.click(screen.getByRole('button', { name: 'Save changes' }));
		expect(await screen.findByText(/must use https:\/\//)).toBeInTheDocument();
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

		// Fix URL and save
		await user.clear(urlInput);
		await user.type(urlInput, 'https://trovotechsolutions.in/products/baylior/v2');
		await user.clear(taglineInput);
		await user.type(taglineInput, 'New public tagline for auto spas');
		await user.click(screen.getByRole('button', { name: 'Save changes' }));

		// Reason dialog opens
		const dialog = await screen.findByRole('dialog');
		expect(within(dialog).getByRole('heading', { name: 'Update public listing · Car Spa' })).toBeVisible();

		// Confirming without reason is blocked
		await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
		expect(within(dialog).getByText('A reason is required.')).toBeInTheDocument();

		// Enter reason and submit
		await user.type(within(dialog).getByLabelText('Reason (recorded in the audit log)'), 'Updating marketing copy for Stage 7');
		await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

		expect(await screen.findByText('Public listing updated · Car Spa')).toBeInTheDocument();
		const call = api.calls.find((c) => c.method === 'PUT' && c.url.includes('/public-listing'));
		expect(call).toBeDefined();
		expect((call?.body as any)?.publicTagline).toBe('New public tagline for auto spas');
		expect((call?.body as any)?.learnMoreUrl).toBe('https://trovotechsolutions.in/products/baylior/v2');
		expect((call?.body as any)?.reason).toBe('Updating marketing copy for Stage 7');
	});
});
