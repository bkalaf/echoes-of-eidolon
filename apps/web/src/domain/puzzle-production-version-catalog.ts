export const productionPuzzleIds = ["PZB-011", "PZB-012", "PZB-021", "PZB-037"] as const;
export type ProductionPuzzleId = (typeof productionPuzzleIds)[number];

export const productionPuzzleSlugs = ["quiet-accord", "third-reading", "the-pall", "glass-vespers"] as const;
export type ProductionPuzzleSlug = (typeof productionPuzzleSlugs)[number];

export interface ProductionPuzzleVersionPresentation {
  accessibilityModes: readonly string[];
  answerFormat: string;
  concept: string;
  expectedSolvePath: string[];
  generatorVersion: "1.1.0";
  hints: readonly [
    { kind: "DIRECTIONAL"; level: 1; text: string },
    { kind: "GUIDED"; level: 2; text: string },
  ];
  opening: string;
  publicDescription: string;
  publicSlug: ProductionPuzzleSlug;
  publicTitle: string;
  puzzleBlueprintId: ProductionPuzzleId;
}

export const productionPuzzleVersionCatalog = Object.freeze([
  {
    accessibilityModes: ["KEYBOARD", "SCREEN_READER_PAIRED_VALUES", "PRINT_WORKSHEET", "HIGH_CONTRAST"],
    answerFormat: "SIX_CHARACTER_BITMAP_CODE",
    concept: "Two independent signed-value records contain exact cancellations that form a generated six-character bitmap.",
    expectedSolvePath: [
      "Compare the two records at corresponding coordinates.",
      "Mark every corresponding signed pair that cancels exactly.",
      "Read the six glyphs formed by the complete cancellation mask and submit them.",
    ],
    generatorVersion: "1.1.0",
    hints: [
      { kind: "DIRECTIONAL", level: 1, text: "Read the two records in lockstep; every position in one has a partner in the other." },
      { kind: "GUIDED", level: 2, text: "Add each corresponding signed pair. Mark only exact cancellations, then read the six shapes they draw." },
    ],
    opening: "Two records were prepared together, though neither admits it. Their disagreements are deliberate. Find what they were made to preserve.",
    publicDescription: "Two companion records disagree with unusual precision.",
    publicSlug: "quiet-accord",
    publicTitle: "The Quiet Accord",
    puzzleBlueprintId: "PZB-011",
  },
  {
    accessibilityModes: ["KEYBOARD", "SCREEN_READER_LITERAL_MARKS", "HIGH_CONTRAST"],
    answerFormat: "OBJECT_ARRANGEMENT_SIGNATURE",
    concept: "Ambiguous U and I marks admit several scoped set readings, but only one result matches the seal.",
    expectedSolvePath: [
      "Inspect where U and I appear inside the scope ribbons.",
      "Evaluate the plausible scoped set readings.",
      "Select the sole result whose count, total, and product match the seal.",
    ],
    generatorVersion: "1.1.0",
    hints: [
      { kind: "DIRECTIONAL", level: 1, text: "Some marks are doing more than naming the cards. Notice where the ribbons give a mark room to act." },
      { kind: "GUIDED", level: 2, text: "Within a scoped ribbon, read U as union and I as intersection; test the bracketed readings against the seal." },
    ],
    opening: "The marks on these cards have survived more than one interpretation. Only one reading leaves the collection intact.",
    publicDescription: "A sealed collection permits more than one reading.",
    publicSlug: "third-reading",
    publicTitle: "The Third Reading",
    puzzleBlueprintId: "PZB-012",
  },
  {
    accessibilityModes: ["KEYBOARD", "SCREEN_READER_TONE_TABLE", "HIGH_CONTRAST"],
    answerFormat: "ORDERED_SYMBOL_SEQUENCE",
    concept: "A microtext field must be reduced to a module pattern before its recovered passage yields sortable symbol cards.",
    expectedSolvePath: [
      "Treat the page as a field of visual density rather than prose.",
      "Adjust the light-dark cutoff until the complete passage emerges.",
      "Follow the passage and order its symbol cards by their visible notches.",
    ],
    generatorVersion: "1.1.0",
    hints: [
      { kind: "DIRECTIONAL", level: 1, text: "Distance changes what this page is willing to show. Step back from the letters." },
      { kind: "GUIDED", level: 2, text: "Reduce the field to light and dark, then adjust the cutoff until a scannable passage emerges." },
    ],
    opening: "The page contains exactly what it appears to contain. That does not mean you are seeing all of it.",
    publicDescription: "Dense type conceals a second passage.",
    publicSlug: "the-pall",
    publicTitle: "The Pall",
    puzzleBlueprintId: "PZB-021",
  },
  {
    accessibilityModes: ["KEYBOARD", "AUDIO", "CAPTIONS", "NOTE_EVENT_TABLE", "TEXTURE_GRID", "REDUCED_MOTION", "HIGH_CONTRAST"],
    answerFormat: "SIX_CHARACTER_HEXADECIMAL",
    concept: "A generated score maps six-note A-F groups to a 32 by 4 color field whose six glyph regions spell the answer.",
    expectedSolvePath: [
      "Read or hear the score while tracking its written note names.",
      "Treat G as a phrase divider and group the remaining notes six at a time as hexadecimal colors.",
      "Render the 32 by 4 field and read the six darker glyphs across its hue regions.",
    ],
    generatorVersion: "1.1.0",
    hints: [
      { kind: "DIRECTIONAL", level: 1, text: "The melody can be read by the names of its notes as well as heard." },
      { kind: "GUIDED", level: 2, text: "Treat G as a divider. Read A–F in groups of six as colors; the 32×4 panes spell six characters." },
    ],
    opening: "The score was written to be heard. It was also written to survive being read another way.",
    publicDescription: "A score survives in sound, ink, and glass.",
    publicSlug: "glass-vespers",
    publicTitle: "Glass Vespers",
    puzzleBlueprintId: "PZB-037",
  },
] satisfies readonly ProductionPuzzleVersionPresentation[]);

export function productionPresentationById(puzzleBlueprintId: string) {
  return productionPuzzleVersionCatalog.find((entry) => entry.puzzleBlueprintId === puzzleBlueprintId);
}

export function productionPresentationBySlug(publicSlug: string) {
  return productionPuzzleVersionCatalog.find((entry) => entry.publicSlug === publicSlug);
}
