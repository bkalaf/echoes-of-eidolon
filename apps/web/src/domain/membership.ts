import type { PerkStatus } from "../generated/prisma/enums";

export const subscriptionPriceCents = 999;
export const ordinaryVoiceWindowSeconds = 15;
export const memberVoiceWindowSeconds = 30;

export function donationMonths(amountCents: number): number {
  if (!Number.isSafeInteger(amountCents) || amountCents < 1_000 || amountCents > 10_000) {
    throw new Error("Donation amount must be between $10 and $100.");
  }
  return Math.floor(amountCents / 1_000) + Math.floor(amountCents / 5_000) + 3 * Math.floor(amountCents / 10_000);
}

function daysInUtcMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

export function addAnchoredCalendarMonths(value: Date, months: number, anchorDay: number): Date {
  if (Number.isNaN(value.getTime())) throw new Error("Membership date is invalid.");
  if (!Number.isSafeInteger(months)) throw new Error("Membership months must be an integer.");
  if (!Number.isSafeInteger(anchorDay) || anchorDay < 1 || anchorDay > 31) throw new Error("Membership anchor day must be 1 through 31.");
  const monthIndex = value.getUTCMonth() + months;
  const year = value.getUTCFullYear() + Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12;
  const day = Math.min(anchorDay, daysInUtcMonth(year, month));
  return new Date(Date.UTC(
    year, month, day,
    value.getUTCHours(), value.getUTCMinutes(), value.getUTCSeconds(), value.getUTCMilliseconds(),
  ));
}

export interface MembershipGrantWindow {
  effectiveStartAt: Date;
  effectiveEndAt: Date;
  anchorDay: number;
  monthsGranted: number;
}

export interface MembershipEntitlementGrant {
  effectiveEndAt: Date;
  effectiveStartAt: Date;
  revocations: readonly { effectiveEndAfter: Date }[];
}

export interface MembershipEntitlementProjection {
  active: boolean;
  effectiveEndAt: Date | null;
}

function projectedGrantWindow(grant: MembershipEntitlementGrant): { end: Date; start: Date } {
  const start = new Date(grant.effectiveStartAt.getTime());
  const end = new Date(grant.revocations.reduce(
    (earliest, revocation) => Math.min(earliest, revocation.effectiveEndAfter.getTime()),
    grant.effectiveEndAt.getTime(),
  ));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end.getTime() < start.getTime()) {
    throw new Error("Membership entitlement window is invalid.");
  }
  return { end, start };
}

export function projectMembershipEntitlement(
  grants: readonly MembershipEntitlementGrant[],
  now: Date,
): MembershipEntitlementProjection {
  if (Number.isNaN(now.getTime())) throw new Error("Membership projection time is invalid.");
  const windows = grants.map(projectedGrantWindow).sort((left, right) => left.start.getTime() - right.start.getTime());
  const currentWindows = windows.filter((window) => window.start.getTime() <= now.getTime() && now.getTime() < window.end.getTime());
  if (currentWindows.length === 0) return { active: false, effectiveEndAt: null };

  let continuousEnd = new Date(Math.max(...currentWindows.map((window) => window.end.getTime())));
  for (const window of windows) {
    if (window.start.getTime() < now.getTime()) continue;
    if (window.start.getTime() > continuousEnd.getTime()) break;
    if (window.end.getTime() > continuousEnd.getTime()) continuousEnd = new Date(window.end.getTime());
  }
  return { active: true, effectiveEndAt: continuousEnd };
}

export function planMembershipGrant(
  now: Date,
  monthsGranted: number,
  currentEffectiveEnd: Date | null,
  existingAnchorDay?: number | null,
): MembershipGrantWindow {
  if (Number.isNaN(now.getTime())) throw new Error("Membership grant time is invalid.");
  if (!Number.isSafeInteger(monthsGranted) || monthsGranted <= 0) throw new Error("Membership grant months must be a positive integer.");
  const stacksAfterCurrent = currentEffectiveEnd != null && currentEffectiveEnd.getTime() > now.getTime();
  const effectiveStartAt = new Date((stacksAfterCurrent ? currentEffectiveEnd : now).getTime());
  const anchorDay = stacksAfterCurrent && existingAnchorDay != null ? existingAnchorDay : effectiveStartAt.getUTCDate();
  return {
    effectiveStartAt,
    effectiveEndAt: addAnchoredCalendarMonths(effectiveStartAt, monthsGranted, anchorDay),
    anchorDay,
    monthsGranted,
  };
}

export interface DonationRefundProjection {
  remainingNetAmountCents: number;
  monthsAfterRefund: number;
  effectiveEndAfter: Date;
}

export function projectDonationRefund(input: {
  originalAmountCents: number;
  refundedBeforeCents: number;
  refundAmountCents: number;
  grantStartAt: Date;
  grantEndBefore: Date;
  anchorDay: number;
  now: Date;
}): DonationRefundProjection {
  const { originalAmountCents, refundedBeforeCents, refundAmountCents } = input;
  if (![originalAmountCents, refundedBeforeCents, refundAmountCents].every(Number.isSafeInteger)) {
    throw new Error("Donation refund amounts must use integer cents.");
  }
  const remainingBefore = originalAmountCents - refundedBeforeCents;
  if (refundAmountCents <= 0 || refundAmountCents > remainingBefore) throw new Error("Donation refund exceeds the remaining net amount.");
  const remainingNetAmountCents = remainingBefore - refundAmountCents;
  const monthsAfterRefund = remainingNetAmountCents >= 1_000 ? donationMonths(remainingNetAmountCents) : 0;
  const authoredEnd = addAnchoredCalendarMonths(input.grantStartAt, monthsAfterRefund, input.anchorDay);
  const consumedBoundary = input.now.getTime() > input.grantStartAt.getTime() ? input.now : input.grantStartAt;
  const effectiveEndAfter = new Date(Math.min(
    input.grantEndBefore.getTime(),
    Math.max(consumedBoundary.getTime(), authoredEnd.getTime()),
  ));
  return { remainingNetAmountCents, monthsAfterRefund, effectiveEndAfter };
}

export function voiceWindowSeconds(hasActiveMembership: boolean): number {
  return hasActiveMembership ? memberVoiceWindowSeconds : ordinaryVoiceWindowSeconds;
}

export function activePerks<Perk extends { status: PerkStatus }>(
  perks: readonly Perk[],
  membershipEntitled: boolean,
): Perk[] {
  return membershipEntitled ? perks.filter((perk) => perk.status === "ACTIVE") : [];
}
