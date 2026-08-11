-- Replace the former adjacent-book duologies with the canonical mirrored
-- relationship. Existing rows are translated by their former pair ordinal.
UPDATE "Transition"
SET
  "bookA" = CASE LEAST("bookA", "bookB")
    WHEN 1 THEN 1
    WHEN 2 THEN 2
    WHEN 4 THEN 3
    WHEN 6 THEN 4
    WHEN 8 THEN 5
    WHEN 10 THEN 6
    WHEN 12 THEN 7
    WHEN 14 THEN 8
    WHEN 16 THEN 9
  END,
  "bookB" = CASE LEAST("bookA", "bookB")
    WHEN 1 THEN 18
    WHEN 2 THEN 17
    WHEN 4 THEN 16
    WHEN 6 THEN 15
    WHEN 8 THEN 14
    WHEN 10 THEN 13
    WHEN 12 THEN 12
    WHEN 14 THEN 11
    WHEN 16 THEN 10
  END
WHERE (LEAST("bookA", "bookB"), GREATEST("bookA", "bookB")) IN (
  (1, 18), (2, 3), (4, 5), (6, 7), (8, 9), (10, 11), (12, 13), (14, 15), (16, 17)
);

UPDATE "CampaignPlacement"
SET "bookNumbers" = CASE LEAST("bookNumbers"[1], "bookNumbers"[2])
  WHEN 1 THEN ARRAY[1, 18]
  WHEN 2 THEN ARRAY[2, 17]
  WHEN 4 THEN ARRAY[3, 16]
  WHEN 6 THEN ARRAY[4, 15]
  WHEN 8 THEN ARRAY[5, 14]
  WHEN 10 THEN ARRAY[6, 13]
  WHEN 12 THEN ARRAY[7, 12]
  WHEN 14 THEN ARRAY[8, 11]
  WHEN 16 THEN ARRAY[9, 10]
END
WHERE "objectType" IN ('TRANSITION', 'DEJA_VU', 'COMPANION')
  AND cardinality("bookNumbers") = 2
  AND (LEAST("bookNumbers"[1], "bookNumbers"[2]), GREATEST("bookNumbers"[1], "bookNumbers"[2])) IN (
    (1, 18), (2, 3), (4, 5), (6, 7), (8, 9), (10, 11), (12, 13), (14, 15), (16, 17)
  );

ALTER TABLE "Transition"
  ADD CONSTRAINT "Transition_canonical_duology_check"
  CHECK (
    "bookA" BETWEEN 1 AND 18
    AND "bookB" BETWEEN 1 AND 18
    AND "bookA" <> "bookB"
    AND "bookA" + "bookB" = 19
  );

ALTER TABLE "CampaignPlacement"
  ADD CONSTRAINT "CampaignPlacement_canonical_duology_check"
  CHECK (
    "objectType" NOT IN ('TRANSITION', 'DEJA_VU', 'COMPANION')
    OR (
      cardinality("bookNumbers") = 2
      AND "bookNumbers"[1] <> "bookNumbers"[2]
      AND "bookNumbers"[1] + "bookNumbers"[2] = 19
    )
  );
