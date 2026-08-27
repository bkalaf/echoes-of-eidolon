-- Append the four reviewed production Puzzle versions without mutating the checksum-pinned 1.0.0 designs.
DO $$
DECLARE
  production_root_count INTEGER;
  base_version_count INTEGER;
  existing_target_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO production_root_count FROM "PuzzleBlueprint" WHERE "puzzleBlueprintId" IN ('PZB-011', 'PZB-012', 'PZB-021', 'PZB-037');
  IF production_root_count NOT IN (0, 4) THEN
    RAISE EXCEPTION 'MEMBER_PUZZLE_VERSION_BLOCKER: expected zero or four production roots, found %', production_root_count;
  END IF;
  SELECT COUNT(*) INTO base_version_count FROM "PuzzleBlueprintVersion" WHERE "puzzleBlueprintId" IN ('PZB-011', 'PZB-012', 'PZB-021', 'PZB-037') AND "generatorVersion" = '1.0.0';
  IF production_root_count = 4 AND base_version_count <> 4 THEN
    RAISE EXCEPTION 'MEMBER_PUZZLE_VERSION_BLOCKER: all four immutable 1.0.0 versions are required, found %', base_version_count;
  END IF;
  SELECT COUNT(*) INTO existing_target_count FROM "PuzzleBlueprintVersion" WHERE "puzzleBlueprintId" IN ('PZB-011', 'PZB-012', 'PZB-021', 'PZB-037') AND "generatorVersion" = '1.1.0';
  IF existing_target_count <> 0 THEN
    RAISE EXCEPTION 'MEMBER_PUZZLE_VERSION_BLOCKER: 1.1.0 already exists outside this guarded migration';
  END IF;
END $$;

INSERT INTO "PuzzleBlueprintVersion" ("puzzleBlueprintId", "generatorVersion", "design", "createdAt")
SELECT
  base."puzzleBlueprintId",
  '1.1.0',
  base."design"::jsonb || CASE base."puzzleBlueprintId"
    WHEN 'PZB-011' THEN '{"accessibilityModalities":["KEYBOARD","SCREEN_READER_PAIRED_VALUES","PRINT_WORKSHEET","HIGH_CONTRAST"],"answerFormat":"SIX_CHARACTER_BITMAP_CODE","concept":"Two independent signed-value records contain exact cancellations that form a generated six-character bitmap.","publicPresentation":{"description":"Two companion records disagree with unusual precision.","opening":"Two records were prepared together, though neither admits it. Their disagreements are deliberate. Find what they were made to preserve.","slug":"quiet-accord","title":"The Quiet Accord"},"productionContract":{"playerRenderer":"apps/web/src/components/puzzles/OrdinalCancellationPuzzle.tsx","status":"PRODUCTION","submissionKind":"bitmap-code"},"schemaVersion":"puzzle-blueprint-design-v2","serverValidationMethod":"SERVER_SIDE_STRUCTURED_EXACT_MATCH","uniquenessProofMethod":"DETERMINISTIC_GENERATOR_AND_SOLVER_EXACTLY_ONE"}'::jsonb
    WHEN 'PZB-012' THEN '{"accessibilityModalities":["KEYBOARD","SCREEN_READER_LITERAL_MARKS","HIGH_CONTRAST"],"answerFormat":"OBJECT_ARRANGEMENT_SIGNATURE","concept":"Ambiguous U and I marks admit several scoped set readings, but only one result matches the seal.","publicPresentation":{"description":"A sealed collection permits more than one reading.","opening":"The marks on these cards have survived more than one interpretation. Only one reading leaves the collection intact.","slug":"third-reading","title":"The Third Reading"},"productionContract":{"playerRenderer":"apps/web/src/components/puzzles/SetAmbigramPuzzle.tsx","status":"PRODUCTION","submissionKind":"set"},"schemaVersion":"puzzle-blueprint-design-v2","serverValidationMethod":"SERVER_SIDE_STRUCTURED_EXACT_MATCH","uniquenessProofMethod":"DETERMINISTIC_GENERATOR_AND_SOLVER_EXACTLY_ONE"}'::jsonb
    WHEN 'PZB-021' THEN '{"accessibilityModalities":["KEYBOARD","SCREEN_READER_TONE_TABLE","HIGH_CONTRAST"],"answerFormat":"ORDERED_SYMBOL_SEQUENCE","concept":"A microtext field must be reduced to a module pattern before its recovered passage yields sortable symbol cards.","publicPresentation":{"description":"Dense type conceals a second passage.","opening":"The page contains exactly what it appears to contain. That does not mean you are seeing all of it.","slug":"the-pall","title":"The Pall"},"productionContract":{"playerRenderer":"apps/web/src/components/puzzles/TypographicQrPuzzle.tsx","status":"PRODUCTION","submissionKind":"ordered-symbols"},"schemaVersion":"puzzle-blueprint-design-v2","serverValidationMethod":"SERVER_SIDE_STRUCTURED_EXACT_MATCH","uniquenessProofMethod":"DETERMINISTIC_GENERATOR_AND_SOLVER_EXACTLY_ONE"}'::jsonb
    WHEN 'PZB-037' THEN '{"accessibilityModalities":["KEYBOARD","AUDIO","CAPTIONS","NOTE_EVENT_TABLE","TEXTURE_GRID","REDUCED_MOTION","HIGH_CONTRAST"],"answerFormat":"SIX_CHARACTER_HEXADECIMAL","concept":"A generated score maps six-note A-F groups to a 32 by 4 color field whose six glyph regions spell the answer.","publicPresentation":{"description":"A score survives in sound, ink, and glass.","opening":"The score was written to be heard. It was also written to survive being read another way.","slug":"glass-vespers","title":"Glass Vespers"},"productionContract":{"playerRenderer":"apps/web/src/components/puzzles/MusicalHexPuzzle.tsx","status":"PRODUCTION","submissionKind":"hex"},"schemaVersion":"puzzle-blueprint-design-v2","serverValidationMethod":"SERVER_SIDE_STRUCTURED_EXACT_MATCH","uniquenessProofMethod":"DETERMINISTIC_GENERATOR_AND_SOLVER_EXACTLY_ONE"}'::jsonb
  END,
  NOW()
FROM "PuzzleBlueprintVersion" base
WHERE base."puzzleBlueprintId" IN ('PZB-011', 'PZB-012', 'PZB-021', 'PZB-037')
  AND base."generatorVersion" = '1.0.0';

INSERT INTO "PuzzleHintTemplate" ("puzzleBlueprintId", "generatorVersion", "level", "kind", "template")
SELECT hints."puzzleBlueprintId", '1.1.0', hints."level", hints."kind"::"PuzzleHintKind", hints."template"
FROM (VALUES
  ('PZB-011', 1, 'DIRECTIONAL', 'Read the two records in lockstep; every position in one has a partner in the other.'),
  ('PZB-011', 2, 'GUIDED', 'Add each corresponding signed pair. Mark only exact cancellations, then read the six shapes they draw.'),
  ('PZB-012', 1, 'DIRECTIONAL', 'Some marks are doing more than naming the cards. Notice where the ribbons give a mark room to act.'),
  ('PZB-012', 2, 'GUIDED', 'Within a scoped ribbon, read U as union and I as intersection; test the bracketed readings against the seal.'),
  ('PZB-021', 1, 'DIRECTIONAL', 'Distance changes what this page is willing to show. Step back from the letters.'),
  ('PZB-021', 2, 'GUIDED', 'Reduce the field to light and dark, then adjust the cutoff until a scannable passage emerges.'),
  ('PZB-037', 1, 'DIRECTIONAL', 'The melody can be read by the names of its notes as well as heard.'),
  ('PZB-037', 2, 'GUIDED', 'Treat G as a divider. Read A–F in groups of six as colors; the 32×4 panes spell six characters.')
) AS hints("puzzleBlueprintId", "level", "kind", "template")
JOIN "PuzzleBlueprintVersion" version
  ON version."puzzleBlueprintId" = hints."puzzleBlueprintId" AND version."generatorVersion" = '1.1.0';

DO $$
DECLARE
  production_root_count INTEGER;
  target_version_count INTEGER;
  target_hint_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO production_root_count FROM "PuzzleBlueprint" WHERE "puzzleBlueprintId" IN ('PZB-011', 'PZB-012', 'PZB-021', 'PZB-037');
  SELECT COUNT(*) INTO target_version_count FROM "PuzzleBlueprintVersion" WHERE "puzzleBlueprintId" IN ('PZB-011', 'PZB-012', 'PZB-021', 'PZB-037') AND "generatorVersion" = '1.1.0';
  SELECT COUNT(*) INTO target_hint_count FROM "PuzzleHintTemplate" WHERE "puzzleBlueprintId" IN ('PZB-011', 'PZB-012', 'PZB-021', 'PZB-037') AND "generatorVersion" = '1.1.0';
  IF production_root_count = 4 AND (target_version_count <> 4 OR target_hint_count <> 8) THEN
    RAISE EXCEPTION 'MEMBER_PUZZLE_VERSION_BLOCKER: expected four 1.1.0 versions and eight hints, found % and %', target_version_count, target_hint_count;
  END IF;
END $$;
