import { passkeyClient } from "@better-auth/passkey/client";
import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { organizationClient } from "better-auth/client/plugins";
import { usernameClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [
    usernameClient(),
    emailOTPClient(),
    organizationClient(),
    passkeyClient(),
    inferAdditionalFields({
      user: {
        eligibilityStatus: {
          type: ["AGE_18_OR_OLDER", "AGE_14_TO_17_WITH_GUARDIAN_PERMISSION"],
          required: true,
        },
      },
    }),
  ],
});
