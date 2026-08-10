import { passkey } from "@better-auth/passkey";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { emailOTP } from "better-auth/plugins/email-otp";
import { organization } from "better-auth/plugins/organization";
import { username } from "better-auth/plugins/username";
import { z } from "zod";

import { getDatabase } from "./database";
import { sendAuthenticationCode, sendOrganizationInvitation } from "./email";
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
    databaseHooks: {
      user: {
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
          type: ["AGE_18_OR_OLDER", "AGE_14_TO_17_WITH_GUARDIAN_PERMISSION"],
          required: true,
          validator: {
            input: z.enum(["AGE_18_OR_OLDER", "AGE_14_TO_17_WITH_GUARDIAN_PERMISSION"]),
          },
        },
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
    },
    plugins: [
      username(),
      emailOTP({
        changeEmail: { enabled: true },
        overrideDefaultEmailVerification: true,
        sendVerificationOnSignUp: true,
        storeOTP: "hashed",
        sendVerificationOTP: async ({ email, otp, type }) => {
          await sendAuthenticationCode({ recipient: email, code: otp, purpose: type });
        },
      }),
      organization({
        allowUserToCreateOrganization: false,
        requireEmailVerificationOnInvitation: true,
        sendInvitationEmail: async ({ email, id, organization: invitedOrganization }) => {
          const invitationUrl = new URL("/auth/redeem-invite", authUrl.origin);
          invitationUrl.searchParams.set("id", id);
          await sendOrganizationInvitation({
            recipient: email,
            organizationName: invitedOrganization.name,
            url: invitationUrl.toString(),
          });
        },
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
