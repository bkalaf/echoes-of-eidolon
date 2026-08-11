import { describe, expect, it } from "vitest";

import { legalDocuments, legalDocumentStatus, legalPublicationStatus } from "../../src/content/legal-documents";
import { screenForPath } from "../../src/lib/page-manifest";

const requiredTitles = [
  "Terms of Service",
  "Privacy Policy",
  "Cookie Policy",
  "Accessibility Statement",
  "Acceptable Use and Player Conduct",
  "Beta and Invitation Participation Terms",
  "Membership and Subscription Terms",
  "Donations and Perks Terms",
  "Store Terms of Sale",
  "Shipping and Fulfillment Policy",
  "Returns, Refunds, and Cancellation Policy",
  "Intellectual Property and Fan Content Policy",
  "AI, Automated Interaction, and Player Content Disclosure",
  "Cultural Use, Attribution, and Research Corrections Policy",
] as const;

describe("owner-approved legal draft register", () => {
  it("contains exactly the fourteen substantive draft documents", () => {
    expect(legalDocuments.map((document) => document.title)).toEqual(requiredTitles);
    expect(legalDocuments.map((document) => document.screenId)).toEqual(
      Array.from({ length: 14 }, (_, index) => `LEGAL${String(index + 1).padStart(2, "0")}`),
    );
    expect(legalDocuments.every((document) => document.content.length > 1_000)).toBe(true);
  });

  it("resolves every owner-approved public slug to its legal screen", () => {
    for (const document of legalDocuments) {
      expect(screenForPath(`/legal/${document.slug}`)?.screenId).toBe(document.screenId);
    }
  });

  it("keeps owner approval distinct from publication and deployment", () => {
    expect(legalDocumentStatus).toBe("OWNER APPROVED — 0.2.0");
    expect(legalPublicationStatus).toBe("NOT PUBLISHED — DEPLOYMENT AUTHORIZATION NOT GRANTED");
    expect(legalPublicationStatus).not.toContain("LIVE");
  });

  it("preserves product promises and support boundaries without stale providers or hidden architecture", () => {
    const content = legalDocuments.map((document) => document.content).join("\n");
    expect(content).toContain("A subscription will never be required.");
    expect(content).toContain("never pay-to-win");
    expect(content).toContain("never sell you");
    expect(content).toContain("never waste your time");
    expect(content).toContain("/account/support");
    expect(content).toContain("/contact");
    expect(content).not.toMatch(/\bSquare\b/i);
    expect(content).not.toMatch(/\b(?:three|3) worlds\b/i);
  });

  it("preserves unresolved counsel facts as explicit owner-input markers", () => {
    const content = legalDocuments.map((document) => document.content).join("\n");
    expect(content).toContain("[PROPOSED EFFECTIVE DATE]");
    expect(content).toMatch(/governing law/i);
    expect(content).toContain("[DMCA AGENT — IF REGISTERED]");
  });
});
