import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CustomerConsentCard } from './CustomerConsentCard';

describe('CustomerConsentCard', () => {
	it('reports changes to the switch', () => {
		const onChange = vi.fn();
		render(<CustomerConsentCard checked={false} onChange={onChange} canManage={true} />);

		fireEvent.click(screen.getByRole('checkbox', { name: /require customer consent/i }));

		expect(onChange).toHaveBeenCalledWith(true);
	});

	it('explains that existing customers have no consent recorded yet', () => {
		render(<CustomerConsentCard checked={false} onChange={vi.fn()} canManage={true} />);

		expect(screen.getByText(/existing customers have no consent recorded yet/i)).toBeInTheDocument();
	});

	it('cannot be changed without manage permission', () => {
		render(<CustomerConsentCard checked={true} onChange={vi.fn()} canManage={false} />);

		const checkbox = screen.getByRole('checkbox', { name: /require customer consent/i });
		expect(checkbox).toBeChecked();
		expect(checkbox).toBeDisabled();
	});
});
