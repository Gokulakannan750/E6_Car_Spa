import { afterEach, describe, expect, it, vi } from 'vitest';
import { request, setAuthToken } from './api';

afterEach(async () => {
	vi.unstubAllGlobals();
	await setAuthToken(null);
});

describe('HTTP request options', () => {
	it.each([
		new Headers({ authorization: 'Bearer override', 'content-type': 'text/plain' }),
		[['authorization', 'Bearer override'], ['content-type', 'text/plain']] as [string, string][],
		{ authorization: 'Bearer override', 'content-type': 'text/plain' },
	])('preserves explicit headers in all supported formats', async (headers) => {
		await setAuthToken('stored-token');
		const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
		vi.stubGlobal('fetch', fetchMock);
		await request('/api/test', { method: 'POST', headers, body: 'text' });
		const sent = new Headers(fetchMock.mock.calls[0][1].headers);
		expect(sent.get('authorization')).toBe('Bearer override');
		expect(sent.get('content-type')).toBe('text/plain');
	});

	it('lets the browser set the multipart boundary', async () => {
		const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
		vi.stubGlobal('fetch', fetchMock);
		await request('/api/test', { method: 'POST', body: new FormData() });
		expect(new Headers(fetchMock.mock.calls[0][1].headers).has('content-type')).toBe(false);
	});

	it('preserves cancellation instead of reporting a network failure', async () => {
		const controller = new AbortController();
		controller.abort();
		const error = new DOMException('Cancelled', 'AbortError');
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(error));
		await expect(request('/api/test', { signal: controller.signal })).rejects.toBe(error);
	});
});
