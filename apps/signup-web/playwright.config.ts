import { defineConfig, devices } from '@playwright/test';

/**
 * - mocked: the website in Chromium with the public API replaced by an in-memory fake (e2e/mocked). Runs in CI.
 * - live: against a running API with sign-up and test payments on (e2e/live). Creates real companies and databases:
 *   only for a local throwaway setup. Start the site with SIGNUP_API_PROXY pointing at that API.
 */
const live = process.argv.includes('--project=live');

export default defineConfig({
	timeout: 60_000,
	expect: { timeout: 10_000 },
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: 0,
	reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
	use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' },
	projects: [
		{ name: 'mocked', testDir: 'e2e/mocked', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 }, baseURL: 'http://localhost:5193' } },
		{
			name: 'live',
			testDir: 'e2e/live',
			use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 }, baseURL: process.env.SIGNUP_E2E_URL ?? 'http://localhost:5192' },
		},
	],
	webServer: live
		? undefined
		: { command: 'pnpm exec vite --port 5193 --strictPort', url: 'http://localhost:5193', reuseExistingServer: !process.env.CI, timeout: 120_000 },
});
