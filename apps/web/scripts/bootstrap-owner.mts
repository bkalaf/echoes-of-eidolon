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
  }

  if (user.role !== "owner" || !user.emailVerified) {
    user = await database.user.update({
      where: { id: user.id },
      data: { role: "owner", emailVerified: true },
      include: { accounts: { where: { providerId: "credential" } } },
    });
  }

  const credential = user.accounts[0]?.password;
  if (!credential) throw new Error("Owner credential account was not created.");
  const passwordMatches = await (await getAuth().$context).password.verify({ hash: credential, password });
  if (!passwordMatches) throw new Error("Existing Owner credential does not match OWNER_BOOTSTRAP_SECRET.");

  process.stdout.write(`Owner account verified: ${user.email} (${user.username}, ${user.role})\n`);
}

try {
  await main();
} finally {
  await disconnectDatabase();
}
