import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const script = resolve(import.meta.dirname, "../../../../infra/scripts/deploy-production.sh");
const serviceUnit = resolve(import.meta.dirname, "../../../../infra/systemd/eidolon-web.service");

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
    expect(unit).toContain("ExecStart=/usr/bin/env pnpm --filter @echoes/web start");
    expect(unit).toContain("NoNewPrivileges=true");
  });

  it("creates the migration backup with the Compose-owned PostgreSQL client", () => {
    const source = readFileSync(script, "utf8");
    expect(source).toContain('run_unlocked docker compose -f "$EIDOLON_COMPOSE_FILE" exec -T postgres');
    expect(source).toContain('pg_dump --format=custom --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"');
    expect(source).not.toMatch(/run_unlocked pg_dump/);
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
    expect(output).toMatch(/pnpm lint[\s\S]*pnpm typecheck[\s\S]*pnpm test[\s\S]*pnpm test:integration[\s\S]*pnpm test:e2e[\s\S]*pnpm build/);
    expect(output).toMatch(/pg_dump before migration[\s\S]*prisma migrate deploy[\s\S]*restart systemd[\s\S]*verify HTTP health/);
    expect(execFileSync("git", ["-C", test.repository, "rev-parse", "HEAD"], { encoding: "utf8" }).trim()).toBe(before);
    expect(readFileSync(test.envFile, "utf8")).toContain("DATABASE_URL=");
    expect(output).not.toContain("unused:unused");
    expect(existsSync(resolve(test.root, "deployment.lock"))).toBe(false);
    expect(existsSync(resolve(test.root, "deployments.log"))).toBe(false);
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
