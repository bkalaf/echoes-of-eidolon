import type { RegionId } from "../generated/prisma/enums";
import type { CrestColor } from "./region-crests";

export interface FeatureCrestPresentation {
  color: CrestColor;
  region: RegionId;
}

// Decorative, stable assignments only. These do not assert a semantic relationship
// between a public feature and a canonical Atlas region.
const featureCrestPresentations = {
  "a-living-world": { color: "blue", region: "R03" },
  "forge-your-path": { color: "yellow", region: "R17" },
  "real-challenges": { color: "red", region: "R08" },
  "leave-your-mark": { color: "blue", region: "R21" },
  "the-power-of-three": { color: "red", region: "R09" },
  "truth-still-matters": { color: "yellow", region: "R06" },
  "real-life-comes-first": { color: "blue", region: "R14" },
  "speak-or-type-freely": { color: "red", region: "R24" },
  "a-unique-and-powerful-story": { color: "yellow", region: "R19" },
} as const satisfies Record<string, FeatureCrestPresentation>;

export function featureCrestPresentation(slug: string): FeatureCrestPresentation {
  const presentation = featureCrestPresentations[slug as keyof typeof featureCrestPresentations];
  if (!presentation) throw new Error(`Feature crest presentation is missing for ${slug}.`);
  return presentation;
}
