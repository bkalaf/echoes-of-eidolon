import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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

  it("ports the supplied globe renderer without its removed inspection overlays", () => {
    const source = readFileSync(resolve(import.meta.dirname, "../../src/components/AtlasGlobe.tsx"), "utf8");
    expect(source).toContain("makeSphere(latitudeSegments = 256, longitudeSegments = 512)");
    expect(source).toContain('atlasTextureUrl("albedo")');
    expect(source).toContain("uniform sampler2D uBaseTexture; uniform sampler2D uRegionTexture;");
    expect(source).toContain("#version 300 es");
    expect(source).not.toContain("Eidolon — Globe Inspection");
    expect(source).not.toContain("Official founding-cities world map wrapped directly");
    expect(source).not.toContain("Official world texture / 4096 × 2048");
  });
});
