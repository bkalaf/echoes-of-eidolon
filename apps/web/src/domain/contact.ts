import { z } from "zod";

export const contactTopicTokens = [
  "ACCESSIBILITY",
  "CULTURAL_RESEARCH",
  "GENERAL",
  "LEGAL",
  "PARTNERSHIP",
  "PRESS",
  "PRIVACY",
  "SECURITY",
] as const;

export const contactTopicSchema = z.enum(contactTopicTokens);
export type ContactTopic = z.infer<typeof contactTopicSchema>;

export const contactTopicDetails: Readonly<Record<ContactTopic, { label: string; responseTarget: string }>> = Object.freeze({
  ACCESSIBILITY: { label: "Accessibility feedback", responseTarget: "3 business days" },
  CULTURAL_RESEARCH: { label: "Historical/cultural correction or sourcing concern", responseTarget: "5 business days acknowledgement; review status/substantive update targeted within 15 business days" },
  GENERAL: { label: "General company inquiry", responseTarget: "5 business days" },
  LEGAL: { label: "Legal notice", responseTarget: "3 business days acknowledgement" },
  PARTNERSHIP: { label: "Business partnerships and licensing", responseTarget: "7 business days" },
  PRESS: { label: "Press and media", responseTarget: "2 business days" },
  PRIVACY: { label: "Privacy and data-rights inquiry", responseTarget: "3 business days acknowledgement; applicable legal deadlines still control" },
  SECURITY: { label: "Security report", responseTarget: "2 business days acknowledgement; critical reports prioritized as soon as practicable" },
});
