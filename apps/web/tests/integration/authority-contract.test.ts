import { describe, expect, it } from "vitest";

import { inviteConsent, publicFeatures } from "../../src/content/public";
import { pageManifest } from "../../src/lib/page-manifest";

describe("current authority integration", () => {
  it("keeps modal states owned by their parent flow", () => {
    const verifyEmail = pageManifest.find((entry) => entry.screenId === "AUTH06");
    const changeEmail = pageManifest.find((entry) => entry.screenId === "ACC002");
    expect(verifyEmail?.path).toBe("Modal in /auth/sign-up");
    expect(changeEmail?.path).toBe("Modal in /account/profile");
  });

  it("uses the exact invite consent and nine-feature public set", () => {
    expect(inviteConsent).toBe("I agree to be contacted by email.");
    expect(publicFeatures).toHaveLength(9);
  });
});
