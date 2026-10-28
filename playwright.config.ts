import { defineConfig } from '@playwright/test';

export default defineConfig({
	use: { baseURL: 'http://localhost:3000' },
	webServer: {
		command: 'pnpm build && pnpm start',
		port: 3000,
		env: { PORT: '3000', ENABLE_RENDER_HARNESS: '1' },
		reuseExistingServer: !process.env.CI
	},
	testMatch: '**/*.e2e.{ts,js}'
});
