import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { InvoicePrintDocument } from './InvoicePrintDocument';
import type { BusinessProfileDto, InvoiceDto } from '../../lib/api';

const invoice: InvoiceDto = {
	id: 'inv-1',
	invoiceNumber: 'INV-2026-0001',
	jobCardId: 'jc-1',
	jobCardNumber: 'JC-2026-0001',
	customerId: 'cust-1',
	customerName: 'Test Customer',
	customerPhone: '9000000000',
	vehicleId: 'veh-1',
	registrationNumber: 'TN01AB1234',
	vehicleMake: 'Hyundai',
	vehicleModel: 'Creta',
	vehicleVariant: 'SX',
	vehicleColor: 'White',
	items: [
		{
			id: 'item-1',
			serviceId: 'svc-1',
			description: 'Foam Wash',
			quantity: 1,
			unitPrice: 800,
			discount: 0,
			taxableAmount: 800,
			taxAmount: 0,
			totalAmount: 800,
		},
	],
	subtotal: 800,
	discount: 0,
	taxableAmount: 800,
	gstAmount: 0,
	totalAmount: 800,
	paidAmount: 0,
	balanceAmount: 800,
	status: 'Generated',
	isGstEnabled: false,
	notes: null,
	invoiceDate: '2026-02-01T10:00:00Z',
	createdAt: '2026-02-01T10:00:00Z',
	updatedAt: null,
	payments: [],
};

const LEGACY_TEXT = [
	'E6',
	'Geetha',
	'Sakthi',
	'Perundurai',
	'9578749449',
	'e6carspa',
	'Premium Auto Detailing',
	'vehicle detailing services',
];

function expectNoLegacyText(html: string) {
	for (const text of LEGACY_TEXT) {
		expect(html).not.toContain(text);
	}
	expect(html.toLowerCase()).not.toContain('a11a1a');
}

describe('InvoicePrintDocument — company branding', () => {
	it('prints the company details, tagline, terms and accent colour it was given', () => {
		const profile = {
			businessName: 'Sunrise Detailing',
			addressLine1: '12 Park Road',
			city: 'Pune',
			state: 'Maharashtra',
			postalCode: '411001',
			phone: '9123456789',
			email: 'hello@sunrise.example',
			tagline: 'Shine every day',
			termsAndConditions: 'Pay within 7 days.\nNo refunds after delivery.',
			brandColor: '#0f766e',
			logoPath: '/uploads/logos/logo_1.png',
		} as BusinessProfileDto;

		const { container } = render(<InvoicePrintDocument invoice={invoice} businessProfile={profile} />);
		const text = container.textContent ?? '';

		expect(text).toContain('Sunrise Detailing');
		expect(text).toContain('12 Park Road');
		expect(text).toContain('Pune, Maharashtra - 411001');
		expect(text).toContain('9123456789');
		expect(text).toContain('hello@sunrise.example');
		expect(text).toContain('Shine every day');
		expect(text).toContain('Pay within 7 days.');
		expect(text).toContain('No refunds after delivery.');
		expect(text).toContain('Thank you for choosing Sunrise Detailing!');
		expect(container.querySelector('img')?.getAttribute('src')).toContain('/uploads/logos/logo_1.png');
		expect((container.firstElementChild as HTMLElement).style.getPropertyValue('--doc-accent')).toBe('#0F766E');
		expectNoLegacyText(container.innerHTML);
	});

	it('prints nothing about a company that has not filled in its details, and uses the neutral accent', () => {
		const { container } = render(<InvoicePrintDocument invoice={invoice} businessProfile={null} />);
		const text = container.textContent ?? '';

		expect(text).toContain('INV-2026-0001');
		expect(text).toContain('Thank you!');
		expect(text).not.toContain('Terms');
		expect(text).not.toContain('Phone:');
		expect(text).not.toContain('Email:');
		expect(container.querySelector('img')).toBeNull();
		expect((container.firstElementChild as HTMLElement).style.getPropertyValue('--doc-accent')).toBe('#1E293B');
		expectNoLegacyText(container.innerHTML);
	});

	it('leaves out only the contact lines that are empty', () => {
		const profile = { businessName: 'Only A Name', phone: '9123456789' } as BusinessProfileDto;

		const { container } = render(<InvoicePrintDocument invoice={invoice} businessProfile={profile} />);
		const text = container.textContent ?? '';

		expect(text).toContain('Only A Name');
		expect(text).toContain('Phone:');
		expect(text).not.toContain('Email:');
		expect(text).not.toContain('Terms');
		expectNoLegacyText(container.innerHTML);
	});

	it('has no HSN/SAC column on a GST invoice, but still shows the GST rate', () => {
		const gstInvoice = {
			...invoice,
			isGstEnabled: true,
			items: [{ ...invoice.items[0], taxRatePercent: 18 }],
		} as InvoiceDto;

		const { container } = render(<InvoicePrintDocument invoice={gstInvoice} businessProfile={null} />);
		const headers = Array.from(container.querySelectorAll('thead th')).map((th) => th.textContent?.trim());

		expect(headers).toContain('GST');
		expect(headers.join(' ')).not.toMatch(/HSN|SAC/i);
		expect(container.textContent).not.toMatch(/HSN|SAC|998714|998729/);
	});
});
