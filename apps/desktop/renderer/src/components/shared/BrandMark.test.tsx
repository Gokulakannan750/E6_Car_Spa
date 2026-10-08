import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { BrandMark, DEFAULT_APP_NAME, displayName } from './BrandMark';

describe('BrandMark / displayName', () => {
	it('uses the company name and its first letter once a name is saved', () => {
		expect(displayName('  Sunrise Detailing ')).toBe('Sunrise Detailing');
		const { container } = render(<BrandMark name="sunrise" />);
		expect(container.textContent).toBe('S');
	});

	it('shows a neutral name and a car icon, never another company, while no name is saved', () => {
		for (const empty of [undefined, null, '', '   ']) {
			expect(displayName(empty)).toBe(DEFAULT_APP_NAME);
			const { container } = render(<BrandMark name={empty} />);
			expect(container.textContent).toBe('');
			expect(container.querySelector('svg')).not.toBeNull();
		}
		expect(DEFAULT_APP_NAME).not.toMatch(/e6/i);
	});
});
