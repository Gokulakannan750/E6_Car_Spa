import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProductShowcasePage } from './ProductShowcasePage';
import { ProductContext } from '@/state/product';
import { SignupProvider } from '@/state/signup';
import type { PublicCatalog } from '@/lib/types';
import { branding } from '@/lib/config';

describe('ProductShowcasePage', () => {
	const mockCatalog: PublicCatalog = {
		productName: 'Baylior',
		productKey: 'carspa',
		seatModel: 'PerType',
		trialPlanCode: 'professional',
		seatTypes: [
			{ code: 'android', name: 'Android only', sortOrder: 1, defaultSeat: false },
			{ code: 'windows', name: 'Windows only', sortOrder: 2, defaultSeat: false },
			{ code: 'both', name: 'Windows + Android', sortOrder: 3, defaultSeat: true },
		],
		capabilities: ['franchise'],
		features: [
			{ key: 'outside_jobs.enabled', label: 'Outside jobs & vendors', type: 'Bool' },
			{ key: 'whatsapp_automation.enabled', label: 'WhatsApp automation', type: 'Bool' },
		],
		plans: [
			{
				code: 'starter',
				name: 'Starter',
				minimumLicences: 1,
				modules: [],
				monthly: { companyFeeMinor: 0, seats: [{ code: 'both', name: 'Windows + Android', quantity: 0, priceMinor: 99900 }] },
				yearly: { companyFeeMinor: 0, seats: [{ code: 'both', name: 'Windows + Android', quantity: 0, priceMinor: 999000 }] },
			},
			{
				code: 'professional',
				name: 'Professional',
				minimumLicences: 1,
				modules: ['outside_jobs.enabled', 'whatsapp_automation.enabled'],
				monthly: { companyFeeMinor: 0, seats: [{ code: 'both', name: 'Windows + Android', quantity: 0, priceMinor: 149900 }] },
				yearly: { companyFeeMinor: 0, seats: [{ code: 'both', name: 'Windows + Android', quantity: 0, priceMinor: 1499000 }] },
			},
		],
		addOns: [
			{ code: 'whatsapp_automation', name: 'WhatsApp automation', featureKey: 'whatsapp_automation.enabled', isPack: false, perUnit: 1, monthlyPriceMinor: 29900, yearlyPriceMinor: 299000 },
		],
		trialDays: 7,
		trialLicences: 3,
		graceDays: 7,
		chargesGst: false,
		gstRatePercent: null,
		testPayments: true,
		sellerName: 'Trovo Tech Solutions',
		sellerPhone: '+91 90426 72148',
		sellerEmail: 'info@trovotechsolutions.in',
	};

	const mockApi = {
		catalog: vi.fn(),
		quote: vi.fn(),
		checkFranchiseCode: vi.fn(),
		startTrial: vi.fn().mockResolvedValue({
			orderId: 't1',
			orderToken: 'tok-123',
			status: 'Completed',
			start: 'Trial',
			amountMinor: 0,
			companyCode: '0008',
			registrationCode: 'H3TB-8KWQ-2MZD',
			trialEndsAt: '2026-10-27T00:00:00Z',
			paidUntil: null,
			invoiceNumber: null,
			quote: null,
			currency: 'INR',
			expiresAt: '2026-10-27T00:00:00Z',
			testPayments: true,
			registrationCodeExpiresAt: '2026-10-27T00:00:00Z',
		}),
		placeOrder: vi.fn(),
		payTest: vi.fn(),
		status: vi.fn(),
	};

	function renderComponent() {
		return render(
			<ProductContext.Provider value={{ catalog: mockCatalog, api: mockApi as any, brand: branding(mockCatalog) }}>
				<SignupProvider catalog={mockCatalog}>
					<MemoryRouter initialEntries={['/product/carspa']}>
						<Routes>
							<Route path="/product/carspa" element={<ProductShowcasePage />} />
							<Route path="/signup/carspa/done" element={<div>Done Page Rendered</div>} />
						</Routes>
					</MemoryRouter>
				</SignupProvider>
			</ProductContext.Provider>,
		);
	}

	it('renders the hero section, headline, and inline sign-up box', () => {
		renderComponent();

		expect(screen.getByRole('heading', { level: 1, name: /Your all-in-one suite for car spa success/i })).toBeInTheDocument();
		expect(screen.getByRole('heading', { level: 2, name: /Get started with your free trial/i })).toBeInTheDocument();
		expect(screen.getByLabelText(/Business name/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/Your name/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/Mobile number/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/Email address/i)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'START 7-DAY FREE TRIAL' })).toBeInTheDocument();
	});

	it('switches tabs and displays module details when clicked', () => {
		renderComponent();

		// Default active tab: Job Cards & Bay Ops
		expect(screen.getByRole('heading', { level: 3, name: /Streamline vehicle check-in, bay allocation/i })).toBeInTheDocument();

		// Click on Invoicing tab
		const invoicingTab = screen.getByRole('tab', { name: /GST Invoicing/i });
		fireEvent.click(invoicingTab);

		expect(screen.getByRole('heading', { level: 3, name: /Instant tax-compliant billing and multi-mode payment collection/i })).toBeInTheDocument();
	});

	it('renders pricing plans and toggles interval', () => {
		renderComponent();

		expect(screen.getByRole('heading', { level: 3, name: 'Starter' })).toBeInTheDocument();
		expect(screen.getByRole('heading', { level: 3, name: 'Professional' })).toBeInTheDocument();

		const yearlyBtn = screen.getByRole('radio', { name: /Yearly billing/i });
		fireEvent.click(yearlyBtn);
		expect(yearlyBtn).toHaveAttribute('aria-checked', 'true');
	});

	it('submits trial form and transitions to done page on valid input', async () => {
		renderComponent();

		fireEvent.change(screen.getByLabelText(/Business name/i), { target: { value: 'SpeedX Detailing' } });
		fireEvent.change(screen.getByLabelText(/Your name/i), { target: { value: 'Kannan' } });
		fireEvent.change(screen.getByLabelText(/Mobile number/i), { target: { value: '9876543210' } });
		fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: 'kannan@speedx.in' } });

		fireEvent.click(screen.getByRole('button', { name: 'START 7-DAY FREE TRIAL' }));

		await waitFor(() => {
			expect(mockApi.startTrial).toHaveBeenCalled();
			expect(screen.getByText('Done Page Rendered')).toBeInTheDocument();
		});
	});
});
