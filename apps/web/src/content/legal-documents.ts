import terms from "./legal/01_TERMS_OF_SERVICE.md?raw";
import privacy from "./legal/02_PRIVACY_POLICY.md?raw";
import cookies from "./legal/03_COOKIE_POLICY.md?raw";
import accessibility from "./legal/04_ACCESSIBILITY_STATEMENT.md?raw";
import conduct from "./legal/05_ACCEPTABLE_USE_AND_PLAYER_CONDUCT.md?raw";
import beta from "./legal/06_BETA_AND_INVITATION_PARTICIPATION_TERMS.md?raw";
import membership from "./legal/07_MEMBERSHIP_AND_SUBSCRIPTION_TERMS.md?raw";
import donations from "./legal/08_DONATIONS_AND_PERKS_TERMS.md?raw";
import store from "./legal/09_STORE_TERMS_OF_SALE.md?raw";
import shipping from "./legal/10_SHIPPING_AND_FULFILLMENT_POLICY.md?raw";
import returns from "./legal/11_RETURNS_REFUNDS_CANCELLATION_POLICY.md?raw";
import intellectualProperty from "./legal/12_INTELLECTUAL_PROPERTY_AND_FAN_CONTENT_POLICY.md?raw";
import aiPlayerContent from "./legal/13_AI_AUTOMATED_INTERACTION_AND_PLAYER_CONTENT_DISCLOSURE.md?raw";
import culturalUse from "./legal/14_CULTURAL_USE_ATTRIBUTION_AND_RESEARCH_CORRECTIONS_POLICY.md?raw";

export const legalDocumentStatus = "OWNER APPROVED — 0.2.0" as const;
export const legalPublicationStatus = "NOT PUBLISHED — DEPLOYMENT AUTHORIZATION NOT GRANTED" as const;

export interface LegalDocument {
  content: string;
  screenId: string;
  slug: string;
  title: string;
}

export const legalDocuments = [
  { content: terms, screenId: "LEGAL01", slug: "terms-of-service", title: "Terms of Service" },
  { content: privacy, screenId: "LEGAL02", slug: "privacy", title: "Privacy Policy" },
  { content: cookies, screenId: "LEGAL03", slug: "cookies", title: "Cookie Policy" },
  { content: accessibility, screenId: "LEGAL04", slug: "accessibility", title: "Accessibility Statement" },
  { content: conduct, screenId: "LEGAL05", slug: "player-conduct", title: "Acceptable Use and Player Conduct" },
  { content: beta, screenId: "LEGAL06", slug: "beta-terms", title: "Beta and Invitation Participation Terms" },
  { content: membership, screenId: "LEGAL07", slug: "membership", title: "Membership and Subscription Terms" },
  { content: donations, screenId: "LEGAL08", slug: "support", title: "Donations and Perks Terms" },
  { content: store, screenId: "LEGAL09", slug: "store-terms", title: "Store Terms of Sale" },
  { content: shipping, screenId: "LEGAL10", slug: "shipping", title: "Shipping and Fulfillment Policy" },
  { content: returns, screenId: "LEGAL11", slug: "refunds", title: "Returns, Refunds, and Cancellation Policy" },
  { content: intellectualProperty, screenId: "LEGAL12", slug: "ip-and-fan-content", title: "Intellectual Property and Fan Content Policy" },
  { content: aiPlayerContent, screenId: "LEGAL13", slug: "ai-disclosure", title: "AI, Automated Interaction, and Player Content Disclosure" },
  { content: culturalUse, screenId: "LEGAL14", slug: "cultural-research", title: "Cultural Use, Attribution, and Research Corrections Policy" },
] as const satisfies readonly LegalDocument[];

export function legalDocumentForScreen(screenId: string): LegalDocument | undefined {
  return legalDocuments.find((document) => document.screenId === screenId);
}
