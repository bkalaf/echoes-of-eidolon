import { passkeyClient } from "@better-auth/passkey/client";
import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";
import { emailOTPClient } from "better-auth/client/plugins";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { organizationClient } from "better-auth/client/plugins";
import { usernameClient } from "better-auth/client/plugins";
import { twoFactorClient } from "better-auth/client/plugins";
import { accountAuthorizationAccessControl, accountAuthorizationRoles } from "../domain/authorization-access";
import { organizationAccessControl, organizationRoles } from "../domain/organization-access";

export const authClient = createAuthClient({
  plugins: [
    adminClient({ ac: accountAuthorizationAccessControl, roles: accountAuthorizationRoles }),
    usernameClient(),
    emailOTPClient(),
    organizationClient({ ac: organizationAccessControl, roles: organizationRoles }),
    twoFactorClient({ twoFactorPage: "/auth/two-factor" }),
    passkeyClient(),
    inferAdditionalFields({
      user: {
        eligibilityStatus: {
          type: ["ADULT_18_PLUS", "MINOR_14_17_GUARDIAN_CONSENTED"],
          required: true,
        },
      },
    }),
  ],
});
