import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ChooserPage } from './ChooserPage';
import type { PublicProduct } from '@/lib/types';

describe('ChooserPage', () => {
	const products: PublicProduct[] = [
		{
			key: 'carspa',
			name: 'Baylior',
			seatModel: 'PerType',
			capabilities: ['franchise'],
			publicTagline: 'Modern car spa management',
			publicDescription: 'Streamline detailing and auto spa operations.',
			learnMoreUrl: 'https://example.com/carspa',
			startingPrice: {
				amountMinor: 49900,
				interval: 'Month',
				currency: 'INR',
				perSeat: true,
			},
		},
		{
			key: 'demo',
			name: 'Demo Workspace',
			seatModel: 'None',
			capabilities: [],
			publicTagline: 'Seatless demo platform',
			publicDescription: 'Explore our features without per-user licensing.',
			learnMoreUrl: null,
			startingPrice: {
				amountMinor: 1234,
				interval: 'Month',
				currency: 'INR',
				perSeat: false,
			},
		},
	];

	it('renders product cards with full details, price lines, buttons, and links', () => {
		render(
			<MemoryRouter>
				<ChooserPage products={products} />
			</MemoryRouter>,
		);

		// Heading and trial intro line
		expect(screen.getByRole('heading', { level: 1, name: 'Choose your product' })).toBeInTheDocument();
		expect(
			screen.getByText('Pick the software you want to try. Every product starts with a free trial.'),
		).toBeInTheDocument();

		// Baylior card
		expect(screen.getByRole('heading', { level: 2, name: 'Baylior' })).toBeInTheDocument();
		expect(screen.getByText('Modern car spa management')).toBeInTheDocument();
		expect(screen.getByText('Streamline detailing and auto spa operations.')).toBeInTheDocument();
		expect(screen.getByText(/from ₹499/)).toBeInTheDocument();
		expect(screen.getByText(/\/mo \/ user/)).toBeInTheDocument();

		// Action buttons for Baylior
		const trialLink = screen.getByRole('link', { name: /Baylior Start free trial/ });
		expect(trialLink).toHaveAttribute('href', '/signup/carspa');
		const plansLink = screen.getByRole('link', { name: /Baylior View plans/ });
		expect(plansLink).toHaveAttribute('href', '/pricing/carspa');
		const learnMoreLink = screen.getByRole('link', { name: /Baylior Learn more/ });
		expect(learnMoreLink).toHaveAttribute('href', 'https://example.com/carspa');

		// Demo card
		expect(screen.getByRole('heading', { level: 2, name: 'Demo Workspace' })).toBeInTheDocument();
		expect(screen.getByText('Seatless demo platform')).toBeInTheDocument();
		expect(screen.getByText('Explore our features without per-user licensing.')).toBeInTheDocument();
		expect(screen.getByText(/from ₹12.34/)).toBeInTheDocument();
		expect(screen.queryByRole('link', { name: /Demo Workspace Learn more/ })).not.toBeInTheDocument();
	});

	it('omits trial intro text if any product has no trial', () => {
		const noTrialProducts: PublicProduct[] = [
			{ ...products[0]!, hasTrial: true },
			{ ...products[1]!, hasTrial: false },
		];

		render(
			<MemoryRouter>
				<ChooserPage products={noTrialProducts} />
			</MemoryRouter>,
		);

		expect(screen.getByText('Pick the software you want to try.')).toBeInTheDocument();
		expect(screen.queryByText(/Every product starts with a free trial/)).not.toBeInTheDocument();
	});
});
