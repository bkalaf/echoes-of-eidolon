import { passkey } from "@better-auth/passkey";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { emailOTP } from "better-auth/plugins/email-otp";
import { organization } from "better-auth/plugins/organization";
import { twoFactor } from "better-auth/plugins/two-factor";
import { username } from "better-auth/plugins/username";
import { z } from "zod";

import { organizationAccessControl, organizationRoles } from "../domain/organization-access";
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
          type: ["ADULT_18_PLUS", "MINOR_14_17_GUARDIAN_CONSENTED"],
          required: true,
          validator: {
            input: z.enum(["ADULT_18_PLUS", "MINOR_14_17_GUARDIAN_CONSENTED"]),
          },
        },
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    plugins: [
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
          period: 10,
          sendOTP: async ({ otp, user }) => {
            await sendAuthenticationCode({ recipient: user.email, code: otp, purpose: "two-factor" });
          },
          storeOTP: "hashed",
        },
      }),
      organization({
        ac: organizationAccessControl,
        allowUserToCreateOrganization: false,
        requireEmailVerificationOnInvitation: true,
        roles: organizationRoles,
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
