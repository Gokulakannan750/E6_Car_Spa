import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { CataloguePage } from './CataloguePage';
import { renderWithProviders } from '../../test/test-utils';
import * as api from '../../lib/api';
import { CATALOGUE_CATEGORIES } from '../../constants/catalogue';

vi.mock('../../lib/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../lib/api')>();
	return {
		...actual,
		getServices: vi.fn(),
		getServiceCategories: vi.fn(),
		createService: vi.fn(),
		updateService: vi.fn(),
	};
});

describe('CataloguePage Dynamic Service & Category Tests (Step 6 Verification)', () => {
	const dynamicBackendService: api.ServiceDto = {
		id: 'svc-dynamic-1',
		name: 'Brand New Dynamic Ceramic Service',
		category: 'Protection Packages',
		price: 15499,
		taxPercentage: 18,
		durationMinutes: 180,
		description: 'Authoritative backend dynamic ceramic coating',
		isActive: true,
		createdAt: '2026-03-01T10:00:00Z',
	};

	const secondBackendService: api.ServiceDto = {
		id: 'svc-dynamic-2',
		name: 'Ultra Interior Steaming',
		category: 'Interior Care',
		price: 3200,
		taxPercentage: 18,
		durationMinutes: 60,
		description: 'Deep high-temp steam cleaning',
		isActive: true,
		createdAt: '2026-03-01T10:00:00Z',
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('1. Backend catalogue service appears in the UI', async () => {
		vi.mocked(api.getServices).mockResolvedValue({
			items: [dynamicBackendService],
			totalCount: 1,
			page: 1,
			pageSize: 200,
		});
		vi.mocked(api.getServiceCategories).mockResolvedValue(['Protection Packages']);

		renderWithProviders(<CataloguePage />, { initialRoute: '/catalogue' });

		await waitFor(() => {
			expect(screen.getByText('Brand New Dynamic Ceramic Service')).toBeInTheDocument();
		});
	});

	it('2. A service not present in hardcoded client data still appears when returned by backend', async () => {
		const unknownService: api.ServiceDto = {
			id: 'svc-unknown-999',
			name: 'Completely Unique Future Service 2027',
			category: 'Exterior Detailing',
			price: 4999,
			taxPercentage: 18,
			durationMinutes: 90,
			description: 'Future service not present anywhere in codebase',
			isActive: true,
			createdAt: '2026-03-01T10:00:00Z',
		};

		vi.mocked(api.getServices).mockResolvedValue({
			items: [unknownService],
			totalCount: 1,
			page: 1,
			pageSize: 200,
		});
		vi.mocked(api.getServiceCategories).mockResolvedValue(['Exterior Detailing']);

		renderWithProviders(<CataloguePage />, { initialRoute: '/catalogue' });

		await waitFor(() => {
			expect(screen.getByText('Completely Unique Future Service 2027')).toBeInTheDocument();
		});
	});

	it('3. Backend service price is displayed and formatted properly', async () => {
		vi.mocked(api.getServices).mockResolvedValue({
			items: [dynamicBackendService],
			totalCount: 1,
			page: 1,
			pageSize: 200,
		});
		vi.mocked(api.getServiceCategories).mockResolvedValue(['Protection Packages']);

		renderWithProviders(<CataloguePage />, { initialRoute: '/catalogue' });

		await waitFor(() => {
			// ₹15,499 formatted in en-IN
			expect(screen.getByText(/₹15,499/)).toBeInTheDocument();
		});
	});

	it('4. Backend service category is respected and filters appropriately', async () => {
		vi.mocked(api.getServices).mockResolvedValue({
			items: [dynamicBackendService, secondBackendService],
			totalCount: 2,
			page: 1,
			pageSize: 200,
		});
		vi.mocked(api.getServiceCategories).mockResolvedValue(['Protection Packages', 'Interior Care']);

		renderWithProviders(<CataloguePage />, { initialRoute: '/catalogue' });

		await waitFor(() => {
			expect(screen.getByText('Brand New Dynamic Ceramic Service')).toBeInTheDocument();
			expect(screen.getByText('Ultra Interior Steaming')).toBeInTheDocument();
		});

		// Filter by 'Interior Care'
		const interiorTab = screen.getByRole('button', { name: /Interior Care/i });
		fireEvent.click(interiorTab);

		await waitFor(() => {
			expect(screen.getByText('Ultra Interior Steaming')).toBeInTheDocument();
			expect(screen.queryByText('Brand New Dynamic Ceramic Service')).not.toBeInTheDocument();
		});
	});

	it('5. Existing four categories remain available in category filters', async () => {
		vi.mocked(api.getServices).mockResolvedValue({
			items: [],
			totalCount: 0,
			page: 1,
			pageSize: 200,
		});
		vi.mocked(api.getServiceCategories).mockResolvedValue([]);

		renderWithProviders(<CataloguePage />, { initialRoute: '/catalogue' });

		// Verify the 4 fixed categories are all present as tabs
		for (const cat of CATALOGUE_CATEGORIES) {
			expect(screen.getByRole('button', { name: new RegExp(cat, 'i') })).toBeInTheDocument();
		}
	});

	it('6. No hardcoded production service list is required (renders purely from API)', async () => {
		vi.mocked(api.getServices).mockResolvedValue({
			items: [dynamicBackendService],
			totalCount: 1,
			page: 1,
			pageSize: 200,
		});
		vi.mocked(api.getServiceCategories).mockResolvedValue([]);

		renderWithProviders(<CataloguePage />, { initialRoute: '/catalogue' });

		await waitFor(() => {
			expect(api.getServices).toHaveBeenCalled();
			expect(screen.getByText('Brand New Dynamic Ceramic Service')).toBeInTheDocument();
		});
	});

	it('7. Empty catalogue response is handled gracefully with empty state', async () => {
		vi.mocked(api.getServices).mockResolvedValue({
			items: [],
			totalCount: 0,
			page: 1,
			pageSize: 200,
		});
		vi.mocked(api.getServiceCategories).mockResolvedValue([]);

		renderWithProviders(<CataloguePage />, { initialRoute: '/catalogue' });

		await waitFor(() => {
			expect(screen.getByText('No services found.')).toBeInTheDocument();
		});
	});

	it('8. API failure does not crash the application and provides retry option', async () => {
		vi.mocked(api.getServices).mockRejectedValue(new Error('Network error loading catalogue'));
		vi.mocked(api.getServiceCategories).mockRejectedValue(new Error('Network error'));

		renderWithProviders(<CataloguePage />, { initialRoute: '/catalogue' });

		await waitFor(() => {
			expect(screen.getByText('Failed to load services. Please try again.')).toBeInTheDocument();
			expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
		});
	});
});

describe('Catalogue Category Rename ("General Services") Tests', () => {
	const generalService: api.ServiceDto = {
		id: '74b58d22-17bc-441f-ad96-e0c79fdefdc5',
		name: 'Android service Testing',
		category: 'General Services',
		price: 15500,
		taxPercentage: 18,
		description: 'Android Testing',
		isActive: true,
		createdAt: '2026-09-05T05:49:03.317115Z',
	};

	const exteriorService: api.ServiceDto = {
		id: 'svc-ext-1',
		name: 'Level 3 Paint Correction',
		category: 'Exterior Detailing',
		price: 5000,
		taxPercentage: 18,
		description: 'Paint correction',
		isActive: true,
		createdAt: '2026-09-05T05:49:03.317115Z',
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('1. "General Services" appears in category tabs and "General Detailing" does NOT appear', async () => {
		vi.mocked(api.getServices).mockResolvedValue({
			items: [generalService, exteriorService],
			totalCount: 2,
			page: 1,
			pageSize: 200,
		});
		vi.mocked(api.getServiceCategories).mockResolvedValue(['Exterior Detailing', 'General Services']);

		renderWithProviders(<CataloguePage />, { initialRoute: '/catalogue' });

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /General Services/i })).toBeInTheDocument();
			expect(screen.queryByRole('button', { name: /General Detailing/i })).not.toBeInTheDocument();
			expect(screen.queryByText(/General Detailing/i)).not.toBeInTheDocument();
		});
	});

	it('2. Correct service count is displayed for General Services tab', async () => {
		vi.mocked(api.getServices).mockResolvedValue({
			items: [generalService],
			totalCount: 1,
			page: 1,
			pageSize: 200,
		});
		vi.mocked(api.getServiceCategories).mockResolvedValue(['General Services']);

		renderWithProviders(<CataloguePage />, { initialRoute: '/catalogue' });

		await waitFor(() => {
			// Tab should show General Services (1)
			expect(screen.getByRole('button', { name: /General Services \(1\)/i })).toBeInTheDocument();
		});
	});

	it('3. Service previously under General Detailing appears under General Services with badge GENERAL SERVICES', async () => {
		vi.mocked(api.getServices).mockResolvedValue({
			items: [generalService],
			totalCount: 1,
			page: 1,
			pageSize: 200,
		});
		vi.mocked(api.getServiceCategories).mockResolvedValue(['General Services']);

		renderWithProviders(<CataloguePage />, { initialRoute: '/catalogue' });

		await waitFor(() => {
			expect(screen.getByText('Android service Testing')).toBeInTheDocument();
			// Category badge in UI has uppercase: GENERAL SERVICES
			expect(screen.getByText('General Services')).toBeInTheDocument();
		});
	});

	it('4. Filtering by General Services isolates only General Services items', async () => {
		vi.mocked(api.getServices).mockResolvedValue({
			items: [generalService, exteriorService],
			totalCount: 2,
			page: 1,
			pageSize: 200,
		});
		vi.mocked(api.getServiceCategories).mockResolvedValue(['Exterior Detailing', 'General Services']);

		renderWithProviders(<CataloguePage />, { initialRoute: '/catalogue' });

		await waitFor(() => {
			expect(screen.getByText('Android service Testing')).toBeInTheDocument();
			expect(screen.getByText('Level 3 Paint Correction')).toBeInTheDocument();
		});

		// Click General Services tab
		const genTab = screen.getByRole('button', { name: /General Services/i });
		fireEvent.click(genTab);

		await waitFor(() => {
			expect(screen.getByText('Android service Testing')).toBeInTheDocument();
			expect(screen.queryByText('Level 3 Paint Correction')).not.toBeInTheDocument();
		});
	});

	it('5. Other categories continue to work alongside General Services', async () => {
		vi.mocked(api.getServices).mockResolvedValue({
			items: [generalService, exteriorService],
			totalCount: 2,
			page: 1,
			pageSize: 200,
		});
		vi.mocked(api.getServiceCategories).mockResolvedValue(['Exterior Detailing', 'General Services']);

		renderWithProviders(<CataloguePage />, { initialRoute: '/catalogue' });

		await waitFor(() => {
			expect(screen.getByRole('button', { name: /Exterior Detailing/i })).toBeInTheDocument();
			expect(screen.getByRole('button', { name: /Interior Care/i })).toBeInTheDocument();
			expect(screen.getByRole('button', { name: /Protection Packages/i })).toBeInTheDocument();
			expect(screen.getByRole('button', { name: /Others/i })).toBeInTheDocument();
			expect(screen.getByRole('button', { name: /General Services/i })).toBeInTheDocument();
		});
	});
});

describe('Catalogue Duration Removal Verification', () => {
	const adminUser = {
		id: 'user-admin-1',
		username: 'admin',
		fullName: 'Administrator',
		role: 'Admin',
		isOwner: true,
		permissions: ['catalogue.view', 'catalogue.create', 'catalogue.edit'],
	};

	const testService: api.ServiceDto = {
		id: 'svc-test-dur',
		name: 'Standard Exterior Wash',
		category: 'Exterior Detailing',
		price: 750,
		taxPercentage: 18,
		durationMinutes: 45,
		description: 'Thorough exterior wash',
		isActive: true,
		createdAt: '2026-03-01T10:00:00Z',
	};

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(api.getServices).mockResolvedValue({
			items: [testService],
			totalCount: 1,
			page: 1,
			pageSize: 200,
		});
		vi.mocked(api.getServiceCategories).mockResolvedValue(['Exterior Detailing']);
	});

	it('1. Catalogue cards do not display Duration', async () => {
		renderWithProviders(<CataloguePage />, { initialRoute: '/catalogue', authUser: adminUser });

		await waitFor(() => {
			expect(screen.getByText('Standard Exterior Wash')).toBeInTheDocument();
			expect(screen.queryByText(/45 min/i)).not.toBeInTheDocument();
			expect(screen.queryByText(/^Duration$/i)).not.toBeInTheDocument();
		});
	});

	it('2. Duration sorting is removed from sort dropdown', async () => {
		renderWithProviders(<CataloguePage />, { initialRoute: '/catalogue', authUser: adminUser });

		await waitFor(() => {
			expect(screen.getByText('Standard Exterior Wash')).toBeInTheDocument();
		});

		expect(screen.queryByText(/Duration: Shortest First/i)).not.toBeInTheDocument();
	});

	it('3. Add Service modal does not display Duration field', async () => {
		renderWithProviders(<CataloguePage />, { initialRoute: '/catalogue', authUser: adminUser });

		await waitFor(() => {
			expect(screen.getByText('Standard Exterior Wash')).toBeInTheDocument();
		});

		const addBtn = screen.getByRole('button', { name: /Create Service/i });
		fireEvent.click(addBtn);

		await waitFor(() => {
			expect(screen.getByRole('heading', { name: /New Service/i })).toBeInTheDocument();
			expect(screen.queryByLabelText(/Duration/i)).not.toBeInTheDocument();
			expect(screen.queryByText(/Duration \(Minutes\)/i)).not.toBeInTheDocument();
		});
	});

	it('4. Service creation succeeds without sending Duration', async () => {
		vi.mocked(api.createService).mockResolvedValue({
			...testService,
			id: 'svc-new',
			name: 'Brand New Clean Service',
			price: 1000,
			durationMinutes: null,
		});

		renderWithProviders(<CataloguePage />, { initialRoute: '/catalogue', authUser: adminUser });

		await waitFor(() => {
			expect(screen.getByText('Standard Exterior Wash')).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole('button', { name: /Create Service/i }));

		await waitFor(() => {
			expect(screen.getByRole('heading', { name: /New Service/i })).toBeInTheDocument();
		});

		const nameInput = screen.getByPlaceholderText(/e\.g\. Level 3 Paint Correction/i);
		const priceInput = screen.getByPlaceholderText('0.00');

		fireEvent.change(nameInput, { target: { value: 'Brand New Clean Service' } });
		fireEvent.change(priceInput, { target: { value: '1000' } });

		const submitBtns = screen.getAllByRole('button', { name: /Create Service/i });
		fireEvent.click(submitBtns[submitBtns.length - 1]);

		await waitFor(() => {
			expect(api.createService).toHaveBeenCalledWith(
				expect.objectContaining({
					name: 'Brand New Clean Service',
					price: 1000,
					category: 'General Services',
					isActive: true,
				})
			);
			const callArg = vi.mocked(api.createService).mock.calls[0][0];
			expect(callArg.durationMinutes).toBeUndefined();
		});
	});

	it('5. View Details dialog does not display Duration', async () => {
		renderWithProviders(<CataloguePage />, { initialRoute: '/catalogue', authUser: adminUser });

		await waitFor(() => {
			expect(screen.getByText('Standard Exterior Wash')).toBeInTheDocument();
		});

		const detailsBtn = screen.getByTitle('View Details');
		fireEvent.click(detailsBtn);

		await waitFor(() => {
			expect(screen.getByText('Category: Exterior Detailing')).toBeInTheDocument();
			expect(screen.queryByText(/^Duration$/i)).not.toBeInTheDocument();
			expect(screen.queryByText(/45 min/i)).not.toBeInTheDocument();
		});
	});
});
