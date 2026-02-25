import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',
    use: {
        baseURL: 'http://localhost:5174',
        trace: 'on-first-retry',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'Mobile Chrome',
            use: { ...devices['Pixel 5'] },
        },
    ],
    webServer: [
        {
            command: 'npm run server',
            url: 'http://localhost:3001/api/sessions',
            reuseExistingServer: !process.env.CI,
            env: {
                NODE_ENV: 'test',
                PLAYWRIGHT_TEST: 'true',
                PORT: '3001'
            }
        },
        {
            command: 'npm run dev -- --port 5174',
            url: 'http://localhost:5174',
            reuseExistingServer: !process.env.CI,
            env: {
                VITE_PROXY_TARGET: 'http://localhost:3001'
            }
        }
    ],
});
