import { defineConfig, devices } from '@playwright/test';

/**
 * Two suites:
 * - mocked: the portal in a real browser with the platform API replaced by an in-memory fake (e2e/mocked).
 *   Starts its own dev server; runs in CI.
 * - live: the portal against a running platform API and PostgreSQL (e2e/live). Creates real companies and
 *   databases, so only ever point it at a throwaway catalog. See e2e/live/README.md.
 */
const isLive = process.argv.some((argument) => argument.startsWith('--project=live'));
const livePortal = process.env.PLATFORM_E2E_PORTAL_URL ?? 'http://localhost:5190';

export default defineConfig({
	timeout: 60_000,
	expect: { timeout: 10_000 },
	fullyParallel: false,
	workers: isLive ? 1 : undefined,
	forbidOnly: !!process.env.CI,
	retries: 0,
	reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
	use: {
		...devices['Desktop Chrome'],
		viewport: { width: 1366, height: 768 },
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
	},
	projects: [
		{
			name: 'mocked',
			testDir: 'e2e/mocked',
			use: { baseURL: 'http://localhost:5191' },
		},
		{
			name: 'live',
			testDir: 'e2e/live',
			testMatch: 'saas-flow.spec.ts',
			// Each sign-in counts against the API's limit of 5 a minute, so the live flow waits when needed.
			timeout: 15 * 60_000,
			use: { baseURL: livePortal, acceptDownloads: true },
		},
		{ name: 'live-products', testDir: 'e2e/live', testMatch: 'product-review.spec.ts', timeout: 15 * 60_000, use: { baseURL: livePortal, acceptDownloads: true } },
	],
	webServer: isLive
		? undefined
		: {
				command: 'pnpm exec vite --port 5191 --strictPort',
				url: 'http://localhost:5191',
				reuseExistingServer: !process.env.CI,
				timeout: 120_000,
			},
});
