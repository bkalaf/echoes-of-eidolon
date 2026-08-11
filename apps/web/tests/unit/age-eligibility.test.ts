import { describe, expect, it } from "vitest";

import { isParticipationEligible } from "../../src/domain/age-eligibility";

describe("participation age eligibility", () => {
  it("allows an adult attestation without date of birth or guardian evidence", () => {
    expect(isParticipationEligible("ADULT_18_PLUS", [])).toBe(true);
  });

  it("requires active guardian-consent evidence for a 14–17 account", () => {
    expect(isParticipationEligible("MINOR_14_17_GUARDIAN_CONSENTED", [])).toBe(false);
    expect(isParticipationEligible("MINOR_14_17_GUARDIAN_CONSENTED", [{
      consentedAt: new Date("2026-01-01T00:00:00Z"),
      revokedAt: null,
      verificationMethod: "approved-operational-record",
    }])).toBe(true);
  });

  it("fails closed after revocation or without verification provenance", () => {
    expect(isParticipationEligible("MINOR_14_17_GUARDIAN_CONSENTED", [{
      consentedAt: new Date("2026-01-01T00:00:00Z"),
      revokedAt: new Date("2026-02-01T00:00:00Z"),
      verificationMethod: "approved-operational-record",
    }])).toBe(false);
    expect(isParticipationEligible("MINOR_14_17_GUARDIAN_CONSENTED", [{
      consentedAt: new Date("2026-01-01T00:00:00Z"),
      revokedAt: null,
      verificationMethod: " ",
    }])).toBe(false);
  });
});
