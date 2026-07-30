const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.js",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure"
  },
  webServer: {
    command: "node scripts/playwright-static-server.mjs",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
    timeout: 20_000
  }
});

