const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests/browser",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure"
  },
  webServer: {
    command: "node node_modules/http-server/bin/http-server . -a 127.0.0.1 -p 4173 --silent",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
    timeout: 20_000
  }
});
