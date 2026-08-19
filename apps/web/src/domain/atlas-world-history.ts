export type AtlasHistoryPhase = "INITIAL" | "POST_DJT";
export type AtlasWorldKey = "CONCORD" | "SCHISM" | "RUIN";

export const INNERWOOD_REGION_ID = "R10" as const;
export const INNERWOOD_SITE_ID = "SITE-0243" as const;

export const INITIAL_FOUNDING_REGION_IDS = [
  "R01", "R02", "R03", "R04", "R05", "R06", "R07", "R08", "R09",
  "R11", "R12", "R13", "R14", "R15", "R16", "R17", "R18", "R19",
  "R20", "R21", "R22", "R23", "R24", "R25",
] as const;

export const INNERWOOD_WORLD_DIVERGENCE = {
  CONCORD: {
    djtSpecies: "Lion",
    federalCapitalRegionId: "R06",
    foundingCityName: "Ashgarden",
    foundingPopulation: [
      "Iranian, Kurdish & Eastern West Asian",
      "Caucasian & Anatolian",
      "Djinn & Genie-Kin",
    ],
    sourceRegionId: "R06",
  },
  SCHISM: {
    djtSpecies: "Hamadryas baboon",
    federalCapitalRegionId: "R22",
    foundingCityName: "Second Song",
    foundingPopulation: [
      "Australian Indigenous",
      "Marsupials & Monotremes",
      "Other Specialized Birds",
    ],
    sourceRegionId: "R22",
  },
  RUIN: {
    djtSpecies: "Peacock spider",
    federalCapitalRegionId: "R11",
    foundingCityName: "Last Well",
    foundingPopulation: [
      "Arabian Peninsula",
      "North African & Saharan",
      "Elephants, Hyraxes & Afrotherians",
    ],
    sourceRegionId: "R11",
  },
} as const satisfies Record<AtlasWorldKey, {
  djtSpecies: string;
  federalCapitalRegionId: string;
  foundingCityName: string;
  foundingPopulation: readonly string[];
  sourceRegionId: string;
}>;

export const AFFECTED_INITIAL_REGION_POPULATIONS = {
  R06: [
    "Iranian, Kurdish & Eastern West Asian",
    "Angels & Celestials",
    "Djinn & Genie-Kin",
  ],
  R15: [
    "South Asian",
    "Primates",
    "Caucasian & Anatolian",
  ],
} as const;

export function settlementExistsInAtlasHistory(regionId: string, phase: AtlasHistoryPhase): boolean {
  return regionId !== INNERWOOD_REGION_ID || phase === "POST_DJT";
}

export function resolveSettlementWorldName(input: {
  fallbackName: string | null | undefined;
  regionId: string;
  worldKey: AtlasWorldKey;
}): string | null {
  if (input.regionId === INNERWOOD_REGION_ID) {
    return INNERWOOD_WORLD_DIVERGENCE[input.worldKey].foundingCityName;
  }
  return input.fallbackName ?? null;
}

export function federalCapitalRegionId(worldKey: AtlasWorldKey, phase: AtlasHistoryPhase): string | null {
  return phase === "POST_DJT" ? INNERWOOD_WORLD_DIVERGENCE[worldKey].federalCapitalRegionId : null;
}

export function isFederalCapital(input: {
  phase: AtlasHistoryPhase;
  regionId: string;
  worldKey: AtlasWorldKey;
}): boolean {
  return federalCapitalRegionId(input.worldKey, input.phase) === input.regionId;
}
