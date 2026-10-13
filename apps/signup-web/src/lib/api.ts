import type { Business, PlanChoice, PublicCatalog, Quote, SignupResult } from './types';

const BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export class ApiError extends Error {
	constructor(
		message: string,
		readonly status: number,
	) {
		super(message);
		this.name = 'ApiError';
	}
}

async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
	let response: Response;
	try {
		response = await fetch(`${BASE_URL}/api/public${path}`, {
			method,
			headers: body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
			body: body === undefined ? undefined : JSON.stringify(body),
			credentials: 'omit',
			cache: 'no-store',
		});
	} catch {
		throw new ApiError('We could not reach Trovo. Check your internet connection and try again.', 0);
	}
	if (!response.ok) {
		let message =
			response.status === 429
				? 'Too many attempts from this connection. Please wait a few minutes and try again.'
				: response.status === 404
					? 'This sign-up could not be found. Please start again or call Trovo.'
					: 'Something went wrong. Please try again.';
		try {
			const data = await response.json();
			if (typeof data?.error === 'string' && response.status !== 429) message = data.error;
		} catch {
			// Not JSON: keep the friendly message.
		}
		throw new ApiError(message, response.status);
	}
	return (await response.json()) as T;
}

const toBody = (business: Business) => ({ ...business, gstin: business.gstin.trim() || null });

export const api = {
	catalog: () => request<PublicCatalog>('/catalog'),
	quote: (choice: PlanChoice) => request<Quote>('/signup/quote', 'POST', choice),
	startTrial: (business: Business) =>
		request<SignupResult>('/signup', 'POST', { business: toBody(business), startTrial: true, acceptTerms: true }),
	placeOrder: (business: Business, plan: PlanChoice, acceptTerms: boolean) =>
		request<SignupResult>('/signup', 'POST', { business: toBody(business), startTrial: false, plan, acceptTerms }),
	payTest: (orderId: string, token: string) => request<SignupResult>(`/signup/${orderId}/test-payment`, 'POST', { token }),
	status: (orderId: string, token: string) => request<SignupResult>(`/signup/${orderId}/status`, 'POST', { token }),
};
