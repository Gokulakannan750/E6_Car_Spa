import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import { InvoiceSeriesSection } from './InvoiceSeriesSection';
import { renderWithProviders } from '../../test/test-utils';
import * as api from '../../lib/api';

vi.mock('../../lib/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../lib/api')>();
	return { ...actual, getInvoiceSeries: vi.fn(), updateInvoiceSeries: vi.fn() };
});

const series: api.InvoiceSeriesSettingsDto = {
	gst: { seriesKind: 'Gst', prefix: 'GST/', minDigits: 4, nextNumber: 8, nextNumberDisplay: '0008', nextInvoiceNumber: 'GST/0008' },
	nonGst: { seriesKind: 'NonGst', prefix: 'BILL/', minDigits: 4, nextNumber: 9, nextNumberDisplay: '0009', nextInvoiceNumber: 'BILL/0009' },
};

const gstCard = () => screen.getByTestId('gst-series');
const billCard = () => screen.getByTestId('non-gst-series');

describe('Invoice Configuration — GST / non-GST series (desktop)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(api.getInvoiceSeries).mockResolvedValue(series);
	});

	it('1. shows both series with prefix, read-only next number and example', async () => {
		renderWithProviders(<InvoiceSeriesSection isOwner />);

		await waitFor(() => expect(screen.getByText('GST Invoice Series')).toBeInTheDocument());
		expect(screen.getByText('Non-GST Invoice Series')).toBeInTheDocument();
		expect(within(gstCard()).getByDisplayValue('GST/')).toBeInTheDocument();
		expect(within(billCard()).getByDisplayValue('BILL/')).toBeInTheDocument();
		expect(within(gstCard()).getByLabelText('GST Invoice Series next number')).toHaveTextContent('0008');
		expect(within(billCard()).getByLabelText('Non-GST Invoice Series next number')).toHaveTextContent('0009');
		expect(screen.getByTestId('gst-series-example')).toHaveTextContent('GST/0008');
		expect(screen.getByTestId('non-gst-series-example')).toHaveTextContent('BILL/0009');
		expect(screen.getByText('GST and non-GST documents use separate numbering sequences.')).toBeInTheDocument();
		expect(screen.getByText('Invoice numbers are automatically assigned when an invoice is finalized.')).toBeInTheDocument();
		expect(screen.getByText('GST invoice numbers can be changed by the Owner after the invoice is fully paid.')).toBeInTheDocument();
	});

	it('2. next number is display-only (no editable counter field)', async () => {
		renderWithProviders(<InvoiceSeriesSection isOwner />);
		await waitFor(() => expect(screen.getByText('GST Invoice Series')).toBeInTheDocument());

		// Only the two prefix inputs are editable fields.
		expect(screen.getAllByRole('textbox')).toHaveLength(2);
		expect(screen.queryByDisplayValue('0008')).not.toBeInTheDocument();
	});

	it('3. Owner can edit prefixes, sees the live example, and saves', async () => {
		vi.mocked(api.updateInvoiceSeries).mockResolvedValue({
			gst: { ...series.gst, prefix: 'TAX/', nextInvoiceNumber: 'TAX/0008' },
			nonGst: series.nonGst,
		});
		renderWithProviders(<InvoiceSeriesSection isOwner />);
		await waitFor(() => expect(screen.getByText('GST Invoice Series')).toBeInTheDocument());

		fireEvent.change(within(gstCard()).getByLabelText('Prefix'), { target: { value: 'tax/' } });
		expect(screen.getByTestId('gst-series-example')).toHaveTextContent('TAX/0008');

		fireEvent.click(screen.getByRole('button', { name: /save invoice series/i }));
		await waitFor(() => expect(api.updateInvoiceSeries).toHaveBeenCalledWith({ gstPrefix: 'TAX/', nonGstPrefix: 'BILL/' }));
		expect(await screen.findByText('Invoice number prefixes saved.')).toBeInTheDocument();
	});

	it('4. non-Owner sees the values but cannot edit or save', async () => {
		renderWithProviders(<InvoiceSeriesSection isOwner={false} />);
		await waitFor(() => expect(screen.getByText('GST Invoice Series')).toBeInTheDocument());

		expect(within(gstCard()).getByLabelText('Prefix')).toBeDisabled();
		expect(within(billCard()).getByLabelText('Prefix')).toBeDisabled();
		expect(screen.queryByRole('button', { name: /save invoice series/i })).not.toBeInTheDocument();
		expect(screen.getByText('Only the Owner can change prefixes.')).toBeInTheDocument();
	});

	it('5. invalid or identical prefixes show validation errors and disable saving', async () => {
		renderWithProviders(<InvoiceSeriesSection isOwner />);
		await waitFor(() => expect(screen.getByText('GST Invoice Series')).toBeInTheDocument());

		fireEvent.change(within(gstCard()).getByLabelText('Prefix'), { target: { value: 'GS T#' } });
		expect(within(gstCard()).getByText(/letters, digits/)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /save invoice series/i })).toBeDisabled();

		fireEvent.change(within(gstCard()).getByLabelText('Prefix'), { target: { value: 'BILL/' } });
		expect(screen.getByText('GST and non-GST prefixes must be different.')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /save invoice series/i })).toBeDisabled();
		expect(api.updateInvoiceSeries).not.toHaveBeenCalled();
	});

	it('6. API errors are shown and the previous values are kept', async () => {
		vi.mocked(api.updateInvoiceSeries).mockRejectedValue(new Error('Only the Owner can change invoice number prefixes.'));
		renderWithProviders(<InvoiceSeriesSection isOwner />);
		await waitFor(() => expect(screen.getByText('GST Invoice Series')).toBeInTheDocument());

		fireEvent.change(within(billCard()).getByLabelText('Prefix'), { target: { value: 'INV-' } });
		fireEvent.click(screen.getByRole('button', { name: /save invoice series/i }));

		expect(await screen.findByRole('alert')).toHaveTextContent('Only the Owner can change invoice number prefixes.');
		expect(screen.getByTestId('gst-series-example')).toHaveTextContent('GST/0008');
	});

	it('7. load failure is reported', async () => {
		vi.mocked(api.getInvoiceSeries).mockRejectedValue(new Error('Network down'));
		renderWithProviders(<InvoiceSeriesSection isOwner />);
		expect(await screen.findByRole('alert')).toHaveTextContent('Network down');
	});
});
