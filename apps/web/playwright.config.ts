import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.EIDOLON_E2E_PORT ?? "3000");
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("EIDOLON_E2E_PORT must be a valid TCP port.");
}
const baseURL = `http://127.0.0.1:${port}`;
const useProductionBuild = process.env.EIDOLON_E2E_PRODUCTION_BUILD === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  timeout: 60_000,
  workers: 1,
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  webServer: {
    command: useProductionBuild
      ? "node scripts/run-with-local-secrets.mjs node .output/server/index.mjs"
      : `pnpm dev --host 127.0.0.1 --port ${port}`,
    env: {
      BETTER_AUTH_URL: baseURL,
      EIDOLON_E2E_AUTH_CODE_DIR: "/tmp/echoes-e2e-auth-codes",
      EIDOLON_ATLAS_RELEASE_ROOT:
        "../../EIDOLON_ATLAS_DATASET_R09_AUTHORITATIVE_DEPLOYMENT_V2",
      HOST: "127.0.0.1",
      PORT: String(port),
    },
    url: baseURL,
    reuseExistingServer: false,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
