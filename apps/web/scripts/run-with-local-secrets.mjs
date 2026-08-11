import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(appRoot, "../..");
const configPath = resolve(repositoryRoot, ".local/config.json");

const keyMap = {
  database_url: "DATABASE_URL",
  postgres_password: "POSTGRES_PASSWORD",
  better_auth_secret: "BETTER_AUTH_SECRET",
  better_auth_url: "BETTER_AUTH_URL",
  resend_api_key: "RESEND_API_KEY",
  resend_sender_address: "RESEND_FROM_EMAIL",
  support_recipient_address: "SUPPORT_RECIPIENT_ADDRESS",
  owner_bootstrap_secret: "OWNER_BOOTSTRAP_SECRET",
  stripe_secret_key: "STRIPE_SECRET_KEY",
  stripe_webhook_secret: "STRIPE_WEBHOOK_SECRET",
  digitalocean_spaces_access_key_id: "AWS_ACCESS_KEY_ID",
  digitalocean_spaces_drive_url: "DIGITALOCEAN_SPACES_DRIVE_URL",
  digitalocean_spaces_key_name: "DIGITALOCEAN_SPACES_KEY_NAME",
  digitalocean_spaces_secret: "AWS_SECRET_ACCESS_KEY",
};

function loadLocalEnvironment() {
  if (!existsSync(configPath)) return {};
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  if (typeof config.credentialDirectory !== "string") {
    throw new Error(".local/config.json must define credentialDirectory");
  }

  const credentialDirectory = resolve(repositoryRoot, config.credentialDirectory);
  const environment = {};
  for (const [fileName, environmentName] of Object.entries(keyMap)) {
    const path = resolve(credentialDirectory, fileName);
    if (!existsSync(path)) throw new Error(`Missing local secret file: ${fileName}`);
    const value = readFileSync(path, "utf8").trim();
    if (!value) throw new Error(`Empty local secret file: ${fileName}`);
    environment[environmentName] = value;
  }

  const atlasRoot = resolve(
    repositoryRoot,
    "EIDOLON_ATLAS_DATASET_R09_AUTHORITATIVE_DEPLOYMENT_V2",
  );
  if (existsSync(resolve(atlasRoot, "DEPLOYMENT_DATASET_MANIFEST.json"))) {
    environment.EIDOLON_ATLAS_RELEASE_ROOT = atlasRoot;
  }
  const databaseUrl = new URL(environment.DATABASE_URL);
  environment.POSTGRES_USER = decodeURIComponent(databaseUrl.username);
  environment.POSTGRES_DB = databaseUrl.pathname.replace(/^\//, "");
  return environment;
}

const [command, ...args] = process.argv.slice(2);
if (!command) throw new Error("A command is required");

const child = spawn(command, args, {
  cwd: appRoot,
  env: { ...loadLocalEnvironment(), ...process.env },
  stdio: "inherit",
});

child.on("error", (error) => {
  throw error;
});
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
