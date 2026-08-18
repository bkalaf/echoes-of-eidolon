export const PUZZLE_BLUEPRINT_PACKAGE_SHA256 = "a269001ef1e4f274caa956e45907811bb097a08b2fa0d83f6f62ed69e3138419";

export const PUZZLE_BLUEPRINT_PACKAGE_HEADERS = [
  "puzzleBlueprintId",
  "title",
  "concept",
  "primaryFamily",
  "secondaryFamilies",
  "difficultyTier",
  "intendedProgressionRange",
  "playerFacingModality",
  "accessibilityModalities",
  "reusableComponentRequirementIds",
  "collaborationProfile",
  "requiredTools",
  "outsideResearchExpectation",
  "generatorVersion",
  "answerFormat",
  "serverValidationMethod",
  "uniquenessProofMethod",
  "estimatedSolveTime",
  "hintLevel1",
  "hintLevel2",
  "implementationComplexity",
  "mobileFeasibility",
  "qualityScore",
  "recommendationStatus",
  "prototypeRequired",
  "prototypeDelivered",
  "tutorialConsideration",
  "highComplexityShowpiece",
] as const;

export type PuzzleBlueprintPackageRow = Record<typeof PUZZLE_BLUEPRINT_PACKAGE_HEADERS[number], string>;

function parseRfc4180(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }
    if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (character !== "\r") {
      field += character;
    }
  }
  if (quoted) throw new Error("Puzzle Blueprint CSV contains an unterminated quoted field.");
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function parsePuzzleBlueprintPackageCsv(text: string): PuzzleBlueprintPackageRow[] {
  const rows = parseRfc4180(text.replace(/^\uFEFF/, ""));
  const header = rows.shift();
  if (!header || header.length !== PUZZLE_BLUEPRINT_PACKAGE_HEADERS.length) {
    throw new Error("Puzzle Blueprint CSV header is missing or has the wrong column count.");
  }
  for (let index = 0; index < PUZZLE_BLUEPRINT_PACKAGE_HEADERS.length; index += 1) {
    if (header[index] !== PUZZLE_BLUEPRINT_PACKAGE_HEADERS[index]) {
      throw new Error(`Puzzle Blueprint CSV column ${index + 1} must be ${PUZZLE_BLUEPRINT_PACKAGE_HEADERS[index]}.`);
    }
  }
  return rows.map((values, rowIndex) => {
    if (values.length !== header.length) throw new Error(`Puzzle Blueprint CSV row ${rowIndex + 2} has ${values.length} columns; expected ${header.length}.`);
    return Object.fromEntries(header.map((key, index) => [key, values[index] ?? ""])) as PuzzleBlueprintPackageRow;
  });
}
