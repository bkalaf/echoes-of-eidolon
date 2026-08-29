import { defineConfig, devices } from "@playwright/test";

process.env.EIDOLON_E2E_CAPTURE_OWNER_EVIDENCE = "0";
process.env.EIDOLON_E2E_CAPTURE_REPOSITORY_EVIDENCE = "0";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  outputDir: "/tmp/echoes-production-e2e-results",
  timeout: 60_000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/run-with-local-secrets.mjs node .output/server/index.mjs",
    env: {
      BETTER_AUTH_URL: "http://127.0.0.1:3100",
      EIDOLON_E2E_AUTH_CODE_DIR: "/tmp/echoes-e2e-auth-codes",
      EIDOLON_ATLAS_RELEASE_ROOT:
        "../../EIDOLON_ATLAS_DATASET_R09_AUTHORITATIVE_DEPLOYMENT_V2",
      HOST: "127.0.0.1",
      PORT: "3100",
    },
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
