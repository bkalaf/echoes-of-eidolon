import { passkey } from "@better-auth/passkey";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { admin } from "better-auth/plugins/admin";
import { emailOTP } from "better-auth/plugins/email-otp";
import { organization } from "better-auth/plugins/organization";
import { twoFactor } from "better-auth/plugins/two-factor";
import { username } from "better-auth/plugins/username";
import { z } from "zod";

import { accountAuthorizationAccessControl, accountAuthorizationRoles } from "../domain/authorization-access";
import { organizationAccessControl, organizationRoles } from "../domain/organization-access";
import { AgeEligibility } from "../generated/prisma/enums";
import { getDatabase } from "./database";
import { sendAuthenticationCode } from "./email";
import { getAuthEnv } from "./env";

export const disabledDirectSessionRevocationPaths = ["/revoke-session", "/revoke-sessions"] as const;

function createAuth() {
  const env = getAuthEnv();
  const authUrl = new URL(env.BETTER_AUTH_URL);
  return betterAuth({
    appName: "Echoes of Eidolon",
    baseURL: authUrl.origin,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [authUrl.origin],
    database: prismaAdapter(getDatabase(), { provider: "postgresql" }),
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            if (user.eligibilityStatus === "MINOR_14_17_GUARDIAN_CONSENTED") {
              throw new APIError("BAD_REQUEST", {
                message: "Guardian-consent verification is not yet available.",
              });
            }
          },
        },
        update: {
          before: async (user) => {
            if ("username" in user || "displayUsername" in user) {
              throw new APIError("BAD_REQUEST", { message: "Username cannot be changed." });
            }
          },
        },
      },
    },
    user: {
      additionalFields: {
        eligibilityStatus: {
          type: Object.values(AgeEligibility),
          required: true,
          validator: {
            input: z.enum(AgeEligibility),
          },
        },
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
    },
    disabledPaths: [...disabledDirectSessionRevocationPaths],
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    plugins: [
      admin({
        ac: accountAuthorizationAccessControl,
        adminRoles: ["admin", "owner"],
        defaultRole: "user",
        roles: accountAuthorizationRoles,
      }),
      username(),
      emailOTP({
        allowedAttempts: 3,
        changeEmail: { enabled: true },
        expiresIn: 60 * 10,
        otpLength: 6,
        overrideDefaultEmailVerification: true,
        sendVerificationOnSignUp: true,
        storeOTP: "hashed",
        sendVerificationOTP: async ({ email, otp, type }) => {
          await sendAuthenticationCode({ recipient: email, code: otp, purpose: type });
        },
      }),
      twoFactor({
        otpOptions: {
          allowedAttempts: 3,
          digits: 6,
          sendOTP: async ({ otp, user }) => {
            await sendAuthenticationCode({ recipient: user.email, code: otp, purpose: "two-factor" });
          },
          storeOTP: "hashed",
        },
      }),
      organization({
        ac: organizationAccessControl,
        allowUserToCreateOrganization: false,
        roles: organizationRoles,
      }),
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
