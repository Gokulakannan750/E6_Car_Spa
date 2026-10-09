import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionCacheReset } from './SessionCacheReset';
import { SESSION_CHANGED_EVENT } from './auth-context';

describe('SessionCacheReset', () => {
	it('drops everything loaded when the session changes, so the next company starts clean', () => {
		const client = new QueryClient();
		client.setQueryData(['franchise-access'], { canActAsFranchisor: true, isFranchisee: false });
		client.setQueryData(['customers'], [{ id: 'c1' }]);

		render(
			<QueryClientProvider client={client}>
				<SessionCacheReset />
			</QueryClientProvider>,
		);
		expect(client.getQueryData(['franchise-access'])).toBeDefined();

		window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));

		expect(client.getQueryData(['franchise-access'])).toBeUndefined();
		expect(client.getQueryData(['customers'])).toBeUndefined();
	});

	it('stops listening when it is removed', () => {
		const client = new QueryClient();
		const { unmount } = render(
			<QueryClientProvider client={client}>
				<SessionCacheReset />
			</QueryClientProvider>,
		);
		unmount();
		client.setQueryData(['x'], 1);

		window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));

		expect(client.getQueryData(['x'])).toBe(1);
	});
});
