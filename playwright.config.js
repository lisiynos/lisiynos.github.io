const { defineConfig, devices } = require('@playwright/test');

// By default the tests serve this repository on localhost, so they check the working tree.
// BASE_URL=https://lisiynos.github.io runs the same tests against the deployed site.
const PORT = process.env.E2E_PORT || 4399;
const LOCAL_URL = `http://127.0.0.1:${PORT}`;

module.exports = defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  // One retry absorbs transient connection errors of the local server under full parallel load.
  // Playwright still reports such tests as flaky, so a real failure is never hidden.
  retries: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL || LOCAL_URL,
    // PW_CHANNEL=chrome uses the installed Google Chrome instead of the bundled Chromium.
    channel: process.env.PW_CHANNEL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'node tests/e2e/serve.js',
        url: `${LOCAL_URL}/s1/binsearch.html`, // any real page: the repository root has no index.html
        reuseExistingServer: true,
        env: { PORT: String(PORT) },
      },
});
