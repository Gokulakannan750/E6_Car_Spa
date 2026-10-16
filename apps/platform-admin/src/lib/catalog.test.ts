import { describe, it, expect } from 'vitest';
import { booleanFeatures, featureLabel, seatQuantities, seatTypes, totalSeats } from './catalog';
import { initialSeats, priceLines } from '@/features/plans/PlanPicker';
import { carSpa, demo } from '@/test/products';
import type { Catalog, Product } from './types';

describe('product catalog', () => {
	it('takes feature labels and Bool keys from the product, with raw-key fallback', () => {
		expect(featureLabel('demo.enabled', demo)).toBe('Project workspace');
		expect(featureLabel('unknown.enabled', demo)).toBe('unknown.enabled');
		expect(booleanFeatures(demo)).toEqual(['demo.enabled']);
	});
	it('preserves the module default without embedding seat codes', () => {
		expect(initialSeats(carSpa)).toEqual({ android: 0, windows: 0, both: 1 });
		const product: Product = {
			...demo,
			seatModel: 'PerType',
			seatTypes: [
				{ code: 'author', name: 'Author', sortOrder: 2, isActive: true, defaultSeat: true },
				{ code: 'viewer', name: 'Viewer', sortOrder: 1, isActive: true },
			],
		};
		expect(initialSeats(product)).toEqual({ viewer: 0, author: 1 });
	});
	it('None has no seat quantities or controls even if inactive definitions remain', () => {
		expect(initialSeats({ ...demo, seatTypes: carSpa.seatTypes })).toEqual({});
		expect(seatTypes(demo)).toEqual([]);
	});
	it('sorts active definitions without mutating product metadata', () => {
		const product: Product = { ...carSpa, seatTypes: [...carSpa.seatTypes].reverse().concat({ code: 'old', name: 'Old', isActive: false, sortOrder: 0 }) };
		expect(seatTypes(product).map((s) => s.code)).toEqual(['android', 'windows', 'both']);
		expect(product.seatTypes[0]!.code).toBe('both');
	});
	it('reads generic arrays and totals quantities without app fields', () => {
		const quantities = seatQuantities([
			{ code: 'editor', name: 'Editor', quantity: 3, priceMinor: 250 },
			{ code: 'reader', name: 'Reader', quantity: 2, priceMinor: 100 },
		]);
		expect(quantities).toEqual({ editor: 3, reader: 2 });
		expect(totalSeats(quantities)).toBe(5);
	});
	it('prices generic seats plus company fee and add-ons', () => {
		const catalog: Catalog = {
			chargesGst: false,
			gstRatePercent: 0,
			addOns: [],
			plans: [
				{
					id: 'p',
					code: 'basic',
					name: 'Basic',
					isActive: true,
					versions: [
						{
							id: 'v',
							version: 1,
							interval: 'Month',
							currency: 'INR',
							priceMinor: 1000,
							includedSeats: 1,
							effectiveFrom: '2026-10-01',
							effectiveTo: null,
							entitlements: [],
							seats: [{ code: 'editor', name: 'Editor', quantity: 0, priceMinor: 250 }],
						},
					],
				},
			],
		};
		expect(priceLines(catalog, { planCode: 'basic', interval: 'Month', seats: { editor: 3 }, addOns: {} }).totalMinor).toBe(1750);
	});
});
