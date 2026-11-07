import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: true,
  use: {baseURL: 'http://127.0.0.1:8080', headless: true, launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH} : {}},
  webServer: {command: 'python3 -m http.server 8080 --bind 127.0.0.1', url: 'http://127.0.0.1:8080', reuseExistingServer: !process.env.CI},
  projects: [{name: 'desktop', use: {viewport: {width: 1280, height: 900}}}, {name: 'mobile', use: {viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true}}]
});
