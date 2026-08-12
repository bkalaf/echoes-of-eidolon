import { spawn } from "node:child_process";
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(appRoot, "../..");
const defaultConfigPath = resolve(repositoryRoot, ".local/config.json");
const secretFiles = {
  database_url: "DATABASE_URL",
  better_auth_secret: "BETTER_AUTH_SECRET",
  better_auth_url: "BETTER_AUTH_URL",
  resend_api_key: "RESEND_API_KEY",
  resend_sender_address: "RESEND_FROM_EMAIL",
  owner_bootstrap_secret: "OWNER_BOOTSTRAP_SECRET",
};

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function regularSecret(path, name) {
  if (!existsSync(path)) throw new Error(`Missing canonical Owner bootstrap file: ${name}`);
  const metadata = lstatSync(path);
  if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error(`Canonical Owner bootstrap file must be a regular non-symlink: ${name}`);
  if ((metadata.mode & 0o077) !== 0) throw new Error(`Canonical Owner bootstrap file permissions are too broad: ${name}`);
  const value = readFileSync(path, "utf8").trim();
  if (!value) throw new Error(`Canonical Owner bootstrap file is empty: ${name}`);
  return value;
}

const requestedConfigPath = option("--config") ?? defaultConfigPath;
const configPath = realpathSync(requestedConfigPath);
if (!isAbsolute(configPath)) throw new Error("Owner bootstrap config path must resolve to an absolute path.");
const config = JSON.parse(readFileSync(configPath, "utf8"));
if (typeof config.credentialDirectory !== "string") throw new Error("Owner bootstrap config must define credentialDirectory.");
const credentialDirectory = realpathSync(isAbsolute(config.credentialDirectory)
  ? config.credentialDirectory
  : resolve(repositoryRoot, config.credentialDirectory));

const canonicalEnvironment = {};
for (const [fileName, environmentName] of Object.entries(secretFiles)) {
  canonicalEnvironment[environmentName] = regularSecret(resolve(credentialDirectory, fileName), fileName);
}

const email = option("--email");
const username = option("--username");
if (!email || !username) throw new Error("Owner bootstrap requires explicit --email and --username values.");
const rotate = process.argv.includes("--rotate-existing-credential");
const ownerSecretPath = realpathSync(resolve(credentialDirectory, "owner_bootstrap_secret"));
const child = spawn("pnpm", ["exec", "tsx", "scripts/bootstrap-owner.mts", ...(rotate ? ["--rotate-existing-credential"] : [])], {
  cwd: appRoot,
  env: {
    ...process.env,
    ...canonicalEnvironment,
    EIDOLON_OWNER_BOOTSTRAP_SECRET_SOURCE: ownerSecretPath,
    OWNER_BOOTSTRAP_EMAIL: email,
    OWNER_BOOTSTRAP_USERNAME: username,
  },
  stdio: "inherit",
});

child.on("error", (error) => { throw error; });
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
