import { describe, expect, it } from "vitest";

import { activePerks, addAnchoredCalendarMonths, donationMonths, planMembershipGrant, projectDonationRefund, subscriptionPriceCents, voiceWindowSeconds } from "../../src/domain/membership";

describe("membership entitlement ledger", () => {
  it("uses the exact server subscription price and donation formula", () => {
    expect(subscriptionPriceCents).toBe(999);
    expect(donationMonths(5_000)).toBe(6);
    expect(donationMonths(10_000)).toBe(15);
    expect(() => donationMonths(999)).toThrow(/between \$10 and \$100/);
    expect(() => donationMonths(10_001)).toThrow(/between \$10 and \$100/);
  });

  it("preserves the anchor day through short months and restores it later", () => {
    const january31 = new Date("2027-01-31T12:34:56.000Z");
    const february = addAnchoredCalendarMonths(january31, 1, 31);
    expect(february.toISOString()).toBe("2027-02-28T12:34:56.000Z");
    expect(addAnchoredCalendarMonths(february, 1, 31).toISOString()).toBe("2027-03-31T12:34:56.000Z");
  });

  it("stacks new calendar months after the effective entitlement end", () => {
    const now = new Date("2027-01-10T00:00:00.000Z");
    const currentEnd = new Date("2027-02-28T00:00:00.000Z");
    const grant = planMembershipGrant(now, 1, currentEnd, 31);
    expect(grant.effectiveStartAt.toISOString()).toBe(currentEnd.toISOString());
    expect(grant.effectiveEndAt.toISOString()).toBe("2027-03-31T00:00:00.000Z");
    expect(grant.anchorDay).toBe(31);
  });

  it("recomputes partial refunds from remaining net and never revokes consumed time", () => {
    const projection = projectDonationRefund({
      originalAmountCents: 10_000,
      refundedBeforeCents: 0,
      refundAmountCents: 5_000,
      grantStartAt: new Date("2027-01-01T00:00:00.000Z"),
      grantEndBefore: new Date("2028-04-01T00:00:00.000Z"),
      anchorDay: 1,
      now: new Date("2027-03-15T00:00:00.000Z"),
    });
    expect(projection.remainingNetAmountCents).toBe(5_000);
    expect(projection.monthsAfterRefund).toBe(6);
    expect(projection.effectiveEndAfter.toISOString()).toBe("2027-07-01T00:00:00.000Z");

    const consumed = projectDonationRefund({
      originalAmountCents: 5_000,
      refundedBeforeCents: 0,
      refundAmountCents: 5_000,
      grantStartAt: new Date("2027-01-01T00:00:00.000Z"),
      grantEndBefore: new Date("2027-07-01T00:00:00.000Z"),
      anchorDay: 1,
      now: new Date("2027-05-20T00:00:00.000Z"),
    });
    expect(consumed.effectiveEndAfter.toISOString()).toBe("2027-05-20T00:00:00.000Z");
  });

  it("changes only the voice window, not authorization or beta eligibility", () => {
    expect(voiceWindowSeconds(false)).toBe(15);
    expect(voiceWindowSeconds(true)).toBe(30);
  });

  it("projects only ACTIVE perks while preserving inactive rows for administration", () => {
    const perks = [{ perkId: "A", status: "ACTIVE" as const }, { perkId: "I", status: "INACTIVE" as const }];
    expect(activePerks(perks)).toEqual([{ perkId: "A", status: "ACTIVE" }]);
    expect(perks).toHaveLength(2);
  });
});
