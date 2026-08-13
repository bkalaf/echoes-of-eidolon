import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const script = resolve(import.meta.dirname, "../../../../infra/scripts/deploy-production.sh");
const serviceUnit = resolve(import.meta.dirname, "../../../../infra/systemd/eidolon-web.service");
const playwrightConfig = resolve(import.meta.dirname, "../../playwright.config.ts");
const viteConfig = resolve(import.meta.dirname, "../../vite.config.ts");
const localSecretsRunner = resolve(import.meta.dirname, "../../scripts/run-with-local-secrets.mjs");

function fixture() {
  const root = mkdtempSync(resolve(tmpdir(), "eidolon-deploy-test-"));
  const repository = resolve(root, "repository");
  const backups = resolve(root, "backups");
  const atlas = resolve(root, "EIDOLON_ATLAS_DATASET_R09_AUTHORITATIVE_DEPLOYMENT_V2");
  const compose = resolve(root, "compose.yaml");
  const envFile = resolve(root, "deployment.env");
  mkdirSync(repository);
  mkdirSync(backups);
  mkdirSync(atlas);
  for (const file of ["DEPLOYMENT_DATASET_MANIFEST.json", "FILE_MANIFEST.json", "R09_AUTHORITATIVE_RELEASE_MANIFEST.json"]) {
    writeFileSync(resolve(atlas, file), "{}\n");
  }
  writeFileSync(compose, "services: {}\n");
  execFileSync("git", ["init", "-q", repository]);
  execFileSync("git", ["-C", repository, "config", "user.email", "test@example.test"]);
  execFileSync("git", ["-C", repository, "config", "user.name", "Test"]);
  writeFileSync(resolve(repository, "README.md"), "test\n");
  execFileSync("git", ["-C", repository, "add", "README.md"]);
  execFileSync("git", ["-C", repository, "commit", "-qm", "fixture"]);
  const revision = execFileSync("git", ["-C", repository, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  writeFileSync(envFile, [
    "DATABASE_URL=postgresql://unused:unused@127.0.0.1:5432/unused",
    "POSTGRES_DB=unused",
    "POSTGRES_PASSWORD=unused",
    "POSTGRES_USER=unused",
    `EIDOLON_BACKUP_DIR=${backups}`,
    `EIDOLON_ATLAS_RELEASE_ROOT=${atlas}`,
    `EIDOLON_COMPOSE_FILE=${compose}`,
    `EIDOLON_DEPLOYMENT_LOCK_FILE=${resolve(root, "deployment.lock")}`,
    `EIDOLON_DEPLOYMENT_RECORD_FILE=${resolve(root, "deployments.log")}`,
    "EIDOLON_HEALTHCHECK_URL=http://127.0.0.1:3000/api/health",
    `EIDOLON_REPOSITORY_DIR=${repository}`,
    "EIDOLON_SYSTEMD_SERVICE=eidolon-web.service",
    "",
  ].join("\n"));
  chmodSync(envFile, 0o600);
  return { backups, envFile, repository, revision, root };
}

describe("production deployment entry point", () => {
  it("runs the web process as the locked eidolon account with the exact environment boundary", () => {
    const unit = readFileSync(serviceUnit, "utf8");
    expect(unit).toContain("User=eidolon");
    expect(unit).toContain("Group=eidolon");
    expect(unit).toContain("EnvironmentFile=/etc/eidolon/deployment.env");
    expect(unit).toContain("Environment=NODE_ENV=production");
    expect(unit).toContain("Environment=HOST=127.0.0.1");
    expect(unit).toContain("Environment=PORT=3000");
    expect(unit).toContain("WorkingDirectory=/srv/eidolon/current/apps/web");
    expect(unit).toContain("ExecStart=/usr/bin/env node scripts/run-with-local-secrets.mjs node .output/server/index.mjs");
    expect(unit).toContain("NoNewPrivileges=true");
    expect(unit).toContain("ReadWritePaths=/srv/eidolon/current/apps/web/.output");
  });

  it("binds the E2E readiness server to the same IPv4 loopback address Playwright probes", () => {
    const source = readFileSync(playwrightConfig, "utf8");
    expect(source).toContain('process.env.EIDOLON_E2E_PORT ?? "3000"');
    expect(source).toContain("`http://127.0.0.1:${port}`");
    expect(source).toContain("`pnpm dev --host 127.0.0.1 --port ${port}`");
    expect(source).toContain("reuseExistingServer: false");
    expect(readFileSync(script, "utf8")).toContain("run_unlocked env EIDOLON_E2E_PORT=3100");
  });

  it("forwards termination signals so deployment test servers cannot survive their wrapper", () => {
    const source = readFileSync(localSecretsRunner, "utf8");
    expect(source).toContain('["SIGINT", "SIGTERM", "SIGHUP"]');
    expect(source).toContain("child.kill(signal)");
  });

  it("bundles Prisma Client runtime through Nitro instead of emitting a broken traced ESM subpath", () => {
    const source = readFileSync(viteConfig, "utf8");
    expect(source).toContain('nitro({ noExternals: ["@prisma/client", "tslib"] })');
    expect(source).toContain("__EIDOLON_BUILD_GIT_SHA__");
    expect(source).toContain("__EIDOLON_BUILD_VERSION__");
  });

  it("embeds the exact authorized revision into the production build", () => {
    const source = readFileSync(script, "utf8");
    expect(source).toContain('EIDOLON_BUILD_GIT_SHA="$target_revision"');
    expect(source).toContain('EIDOLON_BUILD_GIT_SHA="$previous_revision"');
  });

  it("creates the migration backup with the Compose-owned PostgreSQL client", () => {
    const source = readFileSync(script, "utf8");
    expect(source).toContain('run_unlocked docker compose -f "$EIDOLON_COMPOSE_FILE" exec -T postgres');
    expect(source).toContain('pg_dump --format=custom --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"');
    expect(source).not.toMatch(/run_unlocked pg_dump/);
  });

  it("allows bounded service startup time before promotion health fails", () => {
    const source = readFileSync(script, "utf8");
    expect(source).toContain("for health_attempt in {1..20}");
    expect(source).toContain("run_unlocked sleep 1");
    expect(source).toContain("Application health check did not pass after 20 attempts.");
  });

  it("closes the serialized deployment lock for every post-lock subprocess", () => {
    const source = readFileSync(script, "utf8");
    const postLock = source.split('exec 9>"$EIDOLON_DEPLOYMENT_LOCK_FILE"')[1]!;
    expect(source).toContain('"$@" 9>&-');
    expect(postLock).not.toContain("$(");
  });

  it("dry-runs the exact serialized gate order without mutating Git, database, Compose, or systemd", () => {
    const test = fixture();
    const before = execFileSync("git", ["-C", test.repository, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    const output = execFileSync("bash", [script, "--revision", test.revision, "--dry-run", "--env-file", test.envFile], { encoding: "utf8" });
    expect(output).toMatch(/pnpm lint[\s\S]*pnpm typecheck[\s\S]*pnpm test[\s\S]*pnpm test:integration[\s\S]*pnpm navigation:check[\s\S]*pnpm build[\s\S]*pnpm release:check/);
    expect(output).toMatch(/pg_dump before migration[\s\S]*prisma migrate deploy[\s\S]*pnpm test:e2e[\s\S]*restart systemd[\s\S]*verify HTTP health/);
    expect(execFileSync("git", ["-C", test.repository, "rev-parse", "HEAD"], { encoding: "utf8" }).trim()).toBe(before);
    expect(readFileSync(test.envFile, "utf8")).toContain("DATABASE_URL=");
    expect(output).not.toContain("unused:unused");
    expect(existsSync(resolve(test.root, "deployment.lock"))).toBe(false);
    expect(existsSync(resolve(test.root, "deployments.log"))).toBe(false);
  });

  it("runs database-dependent browser verification only after the guarded backup and migration", () => {
    const source = readFileSync(script, "utf8");
    const backup = source.indexOf('backup_path="$EIDOLON_BACKUP_DIR/');
    const migration = source.indexOf('run_unlocked pnpm --dir "$EIDOLON_REPOSITORY_DIR" --filter @echoes/web db:migrate');
    const e2e = source.indexOf("run_unlocked env EIDOLON_E2E_PORT=3100");
    const restart = source.lastIndexOf('run_unlocked systemctl restart "$EIDOLON_SYSTEMD_SERVICE"');
    expect(backup).toBeGreaterThan(-1);
    expect(migration).toBeGreaterThan(backup);
    expect(e2e).toBeGreaterThan(migration);
    expect(restart).toBeGreaterThan(e2e);
  });

  it("rejects a symlink backup directory and non-exact revision", () => {
    const test = fixture();
    const link = resolve(test.root, "backup-link");
    symlinkSync(test.backups, link);
    const linkedEnv = readFileSync(test.envFile, "utf8").replace(`EIDOLON_BACKUP_DIR=${test.backups}`, `EIDOLON_BACKUP_DIR=${link}`);
    writeFileSync(test.envFile, linkedEnv);
    expect(() => execFileSync("bash", [script, "--revision", test.revision, "--dry-run", "--env-file", test.envFile], { stdio: "pipe" })).toThrow();
    expect(() => execFileSync("bash", [script, "--revision", "main", "--dry-run", "--env-file", test.envFile], { stdio: "pipe" })).toThrow();
  });
});
