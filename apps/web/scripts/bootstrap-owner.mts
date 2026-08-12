import process from "node:process";

import { AgeEligibility } from "../src/generated/prisma/enums";
import { getAuth } from "../src/server/auth";
import { disconnectDatabase, getDatabase } from "../src/server/database";

function requiredEnvironment(name: "OWNER_BOOTSTRAP_EMAIL" | "OWNER_BOOTSTRAP_USERNAME" | "OWNER_BOOTSTRAP_SECRET"): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function main(): Promise<void> {
  if (!process.env.EIDOLON_OWNER_BOOTSTRAP_SECRET_SOURCE) {
    throw new Error("Owner bootstrap must be launched by the canonical secret loader.");
  }
  const email = requiredEnvironment("OWNER_BOOTSTRAP_EMAIL").trim().toLowerCase();
  const username = requiredEnvironment("OWNER_BOOTSTRAP_USERNAME").trim().toLowerCase();
  const password = requiredEnvironment("OWNER_BOOTSTRAP_SECRET");

  if (!email.includes("@")) throw new Error("OWNER_BOOTSTRAP_EMAIL must be an email address.");
  if (!/^[a-z0-9_]+$/.test(username)) throw new Error("OWNER_BOOTSTRAP_USERNAME must contain only lowercase letters, numbers, or underscores.");

  const database = getDatabase();
  const matches = await database.user.findMany({
    where: { OR: [{ email }, { username }] },
    include: { accounts: { where: { providerId: "credential" } } },
  });

  if (matches.length > 1 || (matches[0] && (matches[0].email !== email || matches[0].username !== username))) {
    throw new Error("Owner bootstrap identity conflicts with an existing account.");
  }

  const rotateExistingCredential = process.argv.includes("--rotate-existing-credential");
  let credentialResult: "created" | "rotated" | "verified" = "verified";
  let user = matches[0];
  if (!user) {
    const result = await getAuth().api.createUser({
      body: {
        email,
        password,
        name: username,
        role: "owner",
        data: {
          username,
          displayUsername: username,
          emailVerified: true,
          eligibilityStatus: AgeEligibility.ADULT_18_PLUS,
        },
      },
    });

    user = await database.user.findUniqueOrThrow({
      where: { id: result.user.id },
      include: { accounts: { where: { providerId: "credential" } } },
    });
    credentialResult = "created";
  }

  if (user.role !== "owner" || !user.emailVerified) {
    user = await database.user.update({
      where: { id: user.id },
      data: { role: "owner", emailVerified: true },
      include: { accounts: { where: { providerId: "credential" } } },
    });
  }

  let credential = user.accounts[0]?.password;
  if (!credential) throw new Error("Owner credential account was not created.");
  const passwordService = (await getAuth().$context).password;
  let passwordMatches = await passwordService.verify({ hash: credential, password });
  if (!passwordMatches && !rotateExistingCredential) {
    throw new Error("Existing Owner credential does not match the canonical Owner bootstrap secret. Re-run with explicit credential rotation authorization.");
  }
  if (!passwordMatches) {
    credential = await passwordService.hash(password);
    await database.account.update({
      where: { providerId_accountId: { providerId: "credential", accountId: user.id } },
      data: { password: credential },
    });
    passwordMatches = await passwordService.verify({ hash: credential, password });
    if (!passwordMatches) throw new Error("Rotated Owner credential did not verify.");
    credentialResult = "rotated";
  }

  process.stdout.write(`Owner account verified: ${user.email} (${user.username}, ${user.role}, credential=${credentialResult})\n`);
}

try {
  await main();
} finally {
  await disconnectDatabase();
}
