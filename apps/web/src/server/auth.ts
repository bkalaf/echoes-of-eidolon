import { passkey } from "@better-auth/passkey";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";

import { getDatabase } from "./database";
import { sendVerificationEmail } from "./email";
import { getAuthEnv } from "./env";

function createAuth() {
  const env = getAuthEnv();
  const authUrl = new URL(env.BETTER_AUTH_URL);
  return betterAuth({
    appName: "Echoes of Eidolon",
    baseURL: authUrl.origin,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [authUrl.origin],
    database: prismaAdapter(getDatabase(), { provider: "postgresql" }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
    },
    emailVerification: {
      sendOnSignUp: true,
      sendVerificationEmail: async ({ user, url }) => {
        await sendVerificationEmail({ recipient: user.email, url });
      },
    },
    plugins: [
      passkey({
        origin: authUrl.origin,
        rpID: authUrl.hostname,
        rpName: "Echoes of Eidolon",
      }),
    ],
  });

}

type EchoesAuth = ReturnType<typeof createAuth>;

let auth: EchoesAuth | undefined;

export function getAuth(): EchoesAuth {
  auth ??= createAuth();
  return auth;
}
