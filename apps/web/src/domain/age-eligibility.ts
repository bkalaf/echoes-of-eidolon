import type { AgeEligibility } from "../generated/prisma/enums";

export interface GuardianConsentEvidence {
  consentedAt: Date;
  revokedAt: Date | null;
  verificationMethod: string;
}

export function hasActiveGuardianConsent(records: readonly GuardianConsentEvidence[]): boolean {
  return records.some((record) => record.revokedAt == null && record.verificationMethod.trim().length > 0);
}

export function isParticipationEligible(
  eligibilityStatus: AgeEligibility,
  guardianConsents: readonly GuardianConsentEvidence[],
): boolean {
  if (eligibilityStatus === "ADULT_18_PLUS") return true;
  return hasActiveGuardianConsent(guardianConsents);
}
