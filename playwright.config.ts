import { defineConfig } from '@playwright/test';

export default defineConfig({
	use: { baseURL: 'http://localhost:3000' },
	webServer: {
		command: 'npm run build && npm run start',
		port: 3000,
		reuseExistingServer: !process.env.CI
	},
	testMatch: '**/*.e2e.{ts,js}'
});
