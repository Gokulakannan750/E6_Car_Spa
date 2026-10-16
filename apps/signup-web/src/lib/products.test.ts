import { describe, it, expect, vi, afterEach } from 'vitest';
import { defaultChoice, seatMinimum, yearlyFreeMonths } from './rules';
import { featureName } from './featureNames';
import { branding } from './config';
import { productApi } from './api';
import { catalog, demoCatalog, countedCatalog } from '../../e2e/mocked/fakeApi';
afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});
describe('product definitions', () => {
	it('keeps the Car Spa default and supports None and Counted without app codes', () => {
		expect(defaultChoice(catalog).seats).toEqual({ android: 0, windows: 0, both: 1 });
		expect(defaultChoice(demoCatalog).seats).toEqual({});
		expect(seatMinimum(demoCatalog, 'basic')).toBe(0);
		expect(defaultChoice(countedCatalog).seats).toEqual({ user: 2 });
		expect(seatMinimum(countedCatalog, 'basic')).toBe(2);
		expect(yearlyFreeMonths(demoCatalog)).toBe(2);
	});
	it('uses labels and the raw key fallback', () => {
		expect(featureName(demoCatalog, 'demo.enabled')).toBe('Project workspace');
		expect(featureName(demoCatalog, 'other')).toBe('other');
	});
	it('keeps Baylior links and gives other products generic branding', () => {
		expect(branding(catalog).product).toContain('/products/baylior/');
		expect(branding(demoCatalog).name).toBe('Demo');
		expect(branding(demoCatalog).product).not.toContain('baylior');
		vi.stubEnv(
			'VITE_PRODUCT_CONFIG',
			JSON.stringify({
				demo: {
					name: 'Workspace',
					product: 'https://example.test/demo',
					terms: 'https://example.test/terms',
					downloads: [{ name: 'Open workspace', url: 'https://example.test/app' }],
				},
			}),
		);
		expect(branding(demoCatalog).name).toBe('Workspace');
		expect(branding(demoCatalog).terms).toBe('https://example.test/terms');
		expect(branding(demoCatalog).downloads).toEqual([{ name: 'Open workspace', url: 'https://example.test/app' }]);
	});
	it('scopes every product API call and sends only generic seat choices', async () => {
		const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
		vi.stubGlobal('fetch', fetch);
		const api = productApi('demo');
		const joining = { kind: 'own' as const, code: '', check: null, consent: false };
		const business = { name: 'Demo', ownerName: 'Owner', mobile: '9876543210', email: 'demo@test.in', city: 'Erode', state: 'Tamil Nadu', gstin: '' };
		await api.catalog();
		await api.quote(defaultChoice(demoCatalog));
		await api.checkFranchiseCode('CODE');
		await api.startTrial(business, joining);
		await api.placeOrder(business, defaultChoice(demoCatalog), true, joining);
		await api.payTest('id', 'token');
		await api.status('id', 'token');
		expect(fetch).toHaveBeenCalledTimes(7);
		for (const [url] of fetch.mock.calls) expect(url).toContain('?product=demo');
		const quote = JSON.parse(fetch.mock.calls[1]![1].body);
		expect(quote.seats).toEqual({});
		expect(quote).not.toHaveProperty('licences');
	});
});
