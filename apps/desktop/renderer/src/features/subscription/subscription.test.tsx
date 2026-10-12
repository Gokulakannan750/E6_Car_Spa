import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/test-utils';
import { featureForPermission, isFeatureOn, FEATURES } from './subscriptionFeatures';
import { SubscriptionBanner } from './SubscriptionBanner';
import { RouteGuard } from '../../components/auth/RouteGuard';
import type { SubscriptionStatusDto } from '../../lib/api';

const owner = { id: 'u1', fullName: 'Owner', username: 'owner', role: 'Owner' as const, isOwner: true, permissions: [] as string[] };

function subscription(overrides: Partial<SubscriptionStatusDto> = {}): SubscriptionStatusDto {
	return {
		managed: true,
		access: 'Full',
		status: 'Active',
		planCode: 'starter',
		planName: 'Starter',
		interval: 'Month',
		features: { [FEATURES.showroom]: 'false', [FEATURES.whatsApp]: 'false', [FEATURES.advancedReports]: 'false' },
		seatLimit: 3,
		seatsUsed: 1,
		banner: null,
		...overrides,
	};
}

describe('plan features', () => {
	it('maps the permissions of plan modules to their feature, and leaves the rest to every plan', () => {
		expect(featureForPermission('showroom.view')).toBe(FEATURES.showroom);
		expect(featureForPermission('reports.showrooms')).toBe(FEATURES.showroom);
		expect(featureForPermission('staff_salary.manage')).toBe(FEATURES.staffAdvances);
		expect(featureForPermission('outsidejobs.view')).toBe(FEATURES.outsideJobs);
		expect(featureForPermission('vendors.manage')).toBe(FEATURES.outsideJobs);
		expect(featureForPermission('audit.view')).toBe(FEATURES.auditTrail);
		expect(featureForPermission('reports.gst')).toBe(FEATURES.advancedReports);
		expect(featureForPermission('customers.view')).toBeNull();
		expect(featureForPermission('reports.sales')).toBeNull();
		// "Outstanding" uses reports.invoices and is a basic report; the Billing Reports page has its own feature check.
		expect(featureForPermission('reports.invoices')).toBeNull();
	});

	it('treats everything as included until the subscription is known, or on a single-company server', () => {
		expect(isFeatureOn(undefined, undefined, FEATURES.showroom)).toBe(true);
		expect(isFeatureOn({ [FEATURES.showroom]: 'false' }, false, FEATURES.showroom)).toBe(true);
		expect(isFeatureOn({ [FEATURES.showroom]: 'false' }, true, FEATURES.showroom)).toBe(false);
		expect(isFeatureOn({ [FEATURES.showroom]: 'true' }, true, FEATURES.showroom)).toBe(true);
		expect(isFeatureOn({}, true, FEATURES.showroom)).toBe(false);
	});
});

describe('SubscriptionBanner', () => {
	it('shows the server message, e.g. read-only', () => {
		renderWithProviders(<SubscriptionBanner />, {
			authUser: owner,
			authContextValue: {
				subscription: subscription({
					access: 'ReadOnly',
					status: 'ReadOnly',
					banner: { level: 'error', message: 'Read-only: your subscription is unpaid.' },
				}),
			},
		});
		expect(screen.getByRole('status')).toHaveTextContent('Read-only: your subscription is unpaid.');
	});

	it('shows nothing when there is no message', () => {
		const { container } = renderWithProviders(<SubscriptionBanner />, {
			authUser: owner,
			authContextValue: { subscription: subscription() },
		});
		expect(container).toBeEmptyDOMElement();
	});
});

describe('RouteGuard with a plan feature', () => {
	it('explains that a page is not in the plan instead of opening it', () => {
		renderWithProviders(
			<RouteGuard requiredFeature={FEATURES.whatsApp}>
				<p>WhatsApp settings page</p>
			</RouteGuard>,
			{ authUser: owner, authContextValue: { hasFeature: (key: string) => key !== FEATURES.whatsApp } },
		);
		expect(screen.getByText('Not included in your plan')).toBeInTheDocument();
		expect(screen.queryByText('WhatsApp settings page')).not.toBeInTheDocument();
	});

	it('opens the page when the plan includes it', () => {
		renderWithProviders(
			<RouteGuard requiredFeature={FEATURES.whatsApp}>
				<p>WhatsApp settings page</p>
			</RouteGuard>,
			{ authUser: owner, authContextValue: { hasFeature: () => true } },
		);
		expect(screen.getByText('WhatsApp settings page')).toBeInTheDocument();
	});
});
