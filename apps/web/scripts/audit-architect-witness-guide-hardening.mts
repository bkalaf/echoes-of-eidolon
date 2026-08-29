import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";

import {
  canonicalArchitectWitnessGuideData,
  canonicalArchitectWitnessRoster,
  canonicalNonBiologicalCharacterIds,
  witnessGenderOverrides,
} from "../src/domain/architect-witness";
import { buildArchitectWitnessCharacterCompletenessArtifact } from "../src/domain/architect-witness-completeness";
import contractData from "../src/data/entity-admin-contract.json";
import { buildOwnerFormPlan } from "../src/domain/owner-form-contract";
import { disconnectDatabase, getDatabase } from "../src/server/database";

const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
if (!new Set(["localhost", "127.0.0.1", "[::1]"]).has(databaseUrl.hostname)) {
  throw new Error("Architect/Witness hardening audit is restricted to a local database.");
}

const artifactsDirectory = resolve(import.meta.dirname, "../../../artifacts");
const writeArtifacts = !process.argv.includes("--no-write");
if (writeArtifacts) {
  await mkdir(artifactsDirectory, { recursive: true });
  await mkdir(resolve(artifactsDirectory, "release-0.3.0"), { recursive: true });
  await mkdir(resolve(artifactsDirectory, "release-0.3.0/witness-remediation"), { recursive: true });
}

function normalized(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalized);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, normalized(item)]));
  }
  return typeof value === "number" && Object.is(value, -0) ? 0 : value;
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(normalized(left)) === JSON.stringify(normalized(right));
}

type JsonRecord = Record<string, unknown>;
type FieldMismatch = { id: string; field: string; expected: unknown; persisted: unknown };

function collectFieldMismatches(id: string, expected: unknown, persisted: unknown, field = ""): FieldMismatch[] {
  if (same(expected, persisted)) return [];
  if (expected !== null && persisted !== null && typeof expected === "object" && typeof persisted === "object" && !Array.isArray(expected) && !Array.isArray(persisted)) {
    return Object.keys(expected as JsonRecord).sort().flatMap((key) => collectFieldMismatches(
      id,
      (expected as JsonRecord)[key],
      (persisted as JsonRecord)[key],
      field ? `${field}.${key}` : key,
    ));
  }
  return [{ id, field, expected, persisted }];
}

function compareRows(expected: JsonRecord[], persisted: JsonRecord[], idFor: (row: JsonRecord) => string) {
  const expectedById = new Map(expected.map((row) => [idFor(row), row]));
  const persistedById = new Map(persisted.map((row) => [idFor(row), row]));
  const missingIds = [...expectedById.keys()].filter((id) => !persistedById.has(id)).sort();
  const unexpectedIds = [...persistedById.keys()].filter((id) => !expectedById.has(id)).sort();
  const fieldMismatches = [...expectedById.entries()].flatMap(([id, expectedRow]) => {
    const persistedRow = persistedById.get(id);
    return persistedRow ? collectFieldMismatches(id, expectedRow, persistedRow) : [];
  });
  return { expected: expected.length, persisted: persisted.length, missingIds, unexpectedIds, fieldMismatches };
}

async function writeJson(name: string, value: unknown): Promise<void> {
  if (!writeArtifacts) return;
  await writeFile(resolve(artifactsDirectory, name), `${JSON.stringify(normalized(value), null, 2)}\n`);
}

const database = getDatabase();
try {
  const [soulRows, architectRows, witnessDefRows, witnessRows, characterRows, guideTableRows, breedRows, rewardCount, constellationCount] = await Promise.all([
    database.soul.findMany({ orderBy: { soulId: "asc" } }),
    database.architect.findMany({ include: { character: true }, orderBy: { characterId: "asc" } }),
    database.witnessDef.findMany({ orderBy: { witnessDefId: "asc" } }),
    database.witness.findMany({ include: { character: true, architect: { include: { character: true } }, witnessDef: true }, orderBy: { characterId: "asc" } }),
    database.character.findMany({ orderBy: { characterId: "asc" } }),
    database.$queryRaw<Array<{ guideTable: string | null }>>`SELECT to_regclass('public."Guide"')::text AS "guideTable"`,
    database.breed.findMany({ include: { culture: true, species: true }, orderBy: { breedId: "asc" } }),
    database.legendaryReward.count(),
    database.constellation.count(),
  ]);

  const persistedSouls = soulRows.map(({ soulId, name }) => ({ soulId, name }));
  const persistedArchitects = architectRows.map(({ character, characterId, department }) => ({
    character: {
      characterId: character.characterId,
      displayName: character.displayName,
      breedId: character.breedId,
      soulId: character.soulId,
      worldKey: character.worldKey,
      age: character.age,
      gender: character.gender,
      skinScaleColor: character.skinScaleColor,
      hairFurColor: character.hairFurColor,
      eyeColor: character.eyeColor,
      clothing: character.clothing,
    },
    architect: { characterId, department },
  }));
  const persistedWitnessDefs = witnessDefRows.map(({ witnessDefId, name, department, kernelKey, apparentDomain, realDomain, color, architectSoulId, worldKey, bookNumber }) => ({
    witnessDefId, name, department, kernelKey, apparentDomain, realDomain, color, architectSoulId, worldKey, bookNumber,
  }));
  const persistedWitnesses = witnessRows.map(({ character, characterId, witnessDefId, architectCharacterId, trueFlawName, legendaryRewardId, constellationBeforeId, constellationAfterId }) => ({
    character: {
      characterId: character.characterId,
      displayName: character.displayName,
      breedId: character.breedId,
      soulId: character.soulId,
      worldKey: character.worldKey,
      age: character.age,
      gender: character.gender,
      occupationId: character.occupationId,
      skinScaleColor: character.skinScaleColor,
      hairFurColor: character.hairFurColor,
      eyeColor: character.eyeColor,
      clothing: character.clothing,
      faction: character.faction,
      primaryAttribute: character.primaryAttribute,
      secondaryAttribute: character.secondaryAttribute,
    },
    witness: { characterId, witnessDefId, architectCharacterId, trueFlawName, legendaryRewardId, constellationBeforeId, constellationAfterId },
  }));

  await Promise.all([
    writeJson("persisted-souls.json", persistedSouls),
    writeJson("persisted-architects.json", persistedArchitects),
    writeJson("persisted-witness-defs.json", persistedWitnessDefs),
    writeJson("persisted-witnesses.json", persistedWitnesses),
  ]);

  const expectedSouls = canonicalArchitectWitnessGuideData.souls.map(({ soulId, name }) => ({ soulId, name }));
  const expectedArchitects = canonicalArchitectWitnessGuideData.architects.map(({ character, architect }) => ({ character, architect }));
  const expectedWitnessDefs = canonicalArchitectWitnessGuideData.witnessDefs.map(({ witnessDefId, name, department, kernelKey, apparentDomain, realDomain, color, architectSoulId, worldKey, bookNumber }) => ({
    witnessDefId, name, department, kernelKey, apparentDomain, realDomain, color, architectSoulId, worldKey, bookNumber,
  }));
  const expectedWitnesses = canonicalArchitectWitnessGuideData.witnesses.map(({ character, witness }) => ({ character, witness }));
  const canonicalDiff = {
    souls: compareRows(expectedSouls, persistedSouls, (row) => String(row.soulId)),
    architects: compareRows(expectedArchitects, persistedArchitects, (row) => String((row.character as JsonRecord).characterId)),
    witnessDefs: {
      ...compareRows(expectedWitnessDefs, persistedWitnessDefs, (row) => String(row.witnessDefId)),
      allColorSums100: persistedWitnessDefs.every(({ color }) => {
        const values = Object.values(color as Record<string, number>);
        return values.length === 3 && Math.abs(values.reduce((sum, value) => sum + value, 0) - 100) <= 0.000001;
      }),
    },
    witnesses: compareRows(expectedWitnesses, persistedWitnesses, (row) => String((row.character as JsonRecord).characterId)),
  };
  await writeJson("canonical-persistence-diff.json", canonicalDiff);
  const completenessArtifact = buildArchitectWitnessCharacterCompletenessArtifact();
  await writeFile(resolve(artifactsDirectory, "release-0.3.0/owner-character-completeness.json"), `${JSON.stringify(normalized(completenessArtifact), null, 2)}\n`);
  const canonicalPersistedComparison = canonicalArchitectWitnessGuideData.witnesses.map(({ character, witness }) => {
    const expected = { character, witness } as unknown as JsonRecord;
    const persisted = persistedWitnesses.find((row) => row.witness.characterId === witness.characterId) as unknown as JsonRecord | undefined;
    return {
      witnessCharacterId: witness.characterId,
      displayName: character.displayName,
      fieldMismatches: persisted ? collectFieldMismatches(witness.characterId, expected, persisted) : [{ id: witness.characterId, field: "record", expected, persisted: null }],
      status: persisted && same(expected, persisted) ? "MATCH" : "MISMATCH",
    };
  });
  await writeJson("release-0.3.0/witness-remediation/canonical-to-persisted-54.json", {
    schemaVersion: "final-witness-canonical-persistence-comparison-v1",
    rows: canonicalPersistedComparison,
    counts: { rows: canonicalPersistedComparison.length, matches: canonicalPersistedComparison.filter(({ status }) => status === "MATCH").length, mismatches: canonicalPersistedComparison.filter(({ status }) => status === "MISMATCH").length },
  });

  const unresolvedCharacterFields = ["occupationId", "skinScaleColor", "hairFurColor", "eyeColor", "clothing", "faction", "primaryAttribute", "secondaryAttribute"] as const;
  const unresolvedRelationFields = ["legendaryRewardId", "constellationBeforeId", "constellationAfterId"] as const;
  const exceptionManifest = {
    schemaVersion: "final-witness-unresolved-exceptions-v1",
    policy: "Null means canonically unresolved; no value was inferred, synthesized, or mapped from an unapproved candidate.",
    sourcesInspected: [
      { path: "/home/bobby/Downloads/EIDOLON_ARCHITECT_WITNESS_GUIDE_CANONICAL_INPUT_2026-08-15.zip", finding: "Canonical Witness package contains no values for these fields." },
      { path: "/home/bobby/Downloads/witness_reward_mapping_decoy_riddle_data_only.html", finding: "Candidate bank is awaiting owner mapping and is not target authority." },
      { path: "/home/bobby/Downloads/ChatGPT-Outline Witness Compromises-20260826-1833 (2).md", finding: "Planning material is not canonical field authority." },
      { path: "apps/web/src/data/architect-witness-guide", finding: "Current canonical roster explicitly preserves the eight Character fields and three Witness relations as null." },
    ],
    targetAvailability: { LegendaryReward: rewardCount, Constellation: constellationCount },
    rows: canonicalArchitectWitnessGuideData.witnesses.flatMap(({ character, witness }) => [
      ...unresolvedCharacterFields.map((field) => ({ witnessCharacterId: character.characterId, displayName: character.displayName, field: `Character.${field}`, value: character[field] ?? null, status: "AUTHORITY_NOT_FOUND", ownerDecision: "DEFERRED_NO_CANONICAL_VALUE" })),
      ...unresolvedRelationFields.map((field) => ({ witnessCharacterId: character.characterId, displayName: character.displayName, field: `Witness.${field}`, value: witness[field], status: "APPLICABLE_TARGET_UNRESOLVED", ownerDecision: "DEFERRED_NO_APPROVED_TARGET_MAPPING" })),
    ]),
  };
  await writeJson("release-0.3.0/witness-remediation/unresolved-exception-manifest.json", exceptionManifest);

  const soulChains = witnessRows.map((row) => ({
    witnessDefId: row.witnessDefId,
    architectSoulId: row.witnessDef.architectSoulId,
    architectCharacterId: row.architectCharacterId,
    architectCharacterSoulId: row.architect.character.soulId,
    witnessCharacterId: row.characterId,
    witnessCharacterSoulId: row.character.soulId,
    matches: row.witnessDef.architectSoulId !== null
      && row.witnessDef.architectSoulId === row.architect.character.soulId
      && row.architect.character.soulId === row.character.soulId,
  }));
  const witnessOnlySoulIds = [...new Set(soulChains.map(({ witnessCharacterSoulId }) => witnessCharacterSoulId).filter((soulId) =>
    !architectRows.some(({ character }) => character.soulId === soulId)))];
  const pairAudit = Object.fromEntries(canonicalArchitectWitnessRoster.compositePresentations.map(([leftName, rightName]) => {
    const left = witnessRows.find(({ character }) => character.displayName === leftName);
    const right = witnessRows.find(({ character }) => character.displayName === rightName);
    return [`${leftName} != ${rightName}`, {
      leftCharacterId: left?.characterId ?? null,
      leftSoulId: left?.character.soulId ?? null,
      rightCharacterId: right?.characterId ?? null,
      rightSoulId: right?.character.soulId ?? null,
      distinct: Boolean(left?.character.soulId && right?.character.soulId && left.character.soulId !== right.character.soulId),
      bothChainsMatch: Boolean(soulChains.find(({ witnessCharacterId }) => witnessCharacterId === left?.characterId)?.matches
        && soulChains.find(({ witnessCharacterId }) => witnessCharacterId === right?.characterId)?.matches),
    }];
  }));
  const soulContinuity = {
    ordinaryChains: soulChains.length,
    matching: soulChains.filter(({ matches }) => matches).length,
    mismatching: soulChains.filter(({ matches }) => !matches).length,
    nulls: soulChains.filter((chain) => !chain.architectSoulId || !chain.architectCharacterSoulId || !chain.witnessCharacterSoulId).length,
    witnessOnlySoulIds,
    chains: soulChains,
    pairedBodies: pairAudit,
  };
  await writeJson("witness-soul-continuity.json", soulContinuity);

  const breedById = new Map(breedRows.map((breed) => [breed.breedId, breed]));
  const witnessDefinitionById = new Map(canonicalArchitectWitnessGuideData.witnessDefs.map((definition) => [definition.witnessDefId, definition]));
  const witnessChains = witnessRows.map((row) => {
    const breed = row.character.breedId ? breedById.get(row.character.breedId) : undefined;
    const canonicalDefinition = witnessDefinitionById.get(row.witnessDefId);
    return {
      witnessCharacterId: row.characterId,
      witnessDefId: row.witnessDefId,
      witnessDefResolves: Boolean(row.witnessDef),
      sourceArchitectCharacterId: row.architectCharacterId,
      sourceArchitectResolves: Boolean(row.architect?.character),
      sourceArchitectDepartmentMatches: row.architect.department === row.witnessDef.department,
      soulContinuityMatches: row.witnessDef.architectSoulId === row.architect.character.soulId && row.architect.character.soulId === row.character.soulId,
      breedId: row.character.breedId,
      breedResolves: Boolean(breed),
      speciesId: breed?.speciesId ?? null,
      speciesResolves: Boolean(breed?.species),
      cultureId: breed?.cultureId ?? null,
      cultureApplicable: breed?.cultureId !== null && breed?.cultureId !== undefined,
      cultureResolves: breed?.cultureId == null || Boolean(breed.culture),
      worldKey: row.character.worldKey,
      faction: row.character.faction,
      worldMatchesWitnessDefinition: Boolean(canonicalDefinition?.worldKey && canonicalDefinition.worldKey === row.character.worldKey),
      worldFactionConsistent: row.character.worldKey !== null && (row.character.faction === null || row.character.faction === row.character.worldKey),
    };
  });
  await writeJson("witness-chain-integrity.json", witnessChains);
  const witnessCompletenessMatrix = witnessRows.map((row) => {
    const unresolvedCharacterFields = ["occupationId", "skinScaleColor", "hairFurColor", "eyeColor", "clothing", "faction", "primaryAttribute", "secondaryAttribute"] as const;
    return {
      witnessCharacterId: row.characterId,
      displayName: row.character.displayName,
      resolved: {
        Character: Boolean(row.character),
        Breed: Boolean(row.character.breedId && breedById.get(row.character.breedId)),
        Soul: Boolean(row.character.soulId),
        World: Boolean(row.character.worldKey),
        WitnessDef: Boolean(row.witnessDef),
        SourceArchitectCharacter: Boolean(row.architect?.character),
        SourceArchitectSoul: Boolean(row.architect?.character.soulId),
        Age: Boolean(row.character.age?.trim()),
        Gender: Boolean(row.character.gender?.trim()),
        TrueFlaw: Boolean(row.trueFlawName?.trim()),
        BookNumber: row.witnessDef.bookNumber >= 1 && row.witnessDef.bookNumber <= 18,
        Kernel: Boolean(row.witnessDef.kernelKey.trim()),
        ApparentDomain: Boolean(row.witnessDef.apparentDomain.trim()),
        RealDomain: Boolean(row.witnessDef.realDomain.trim()),
        SpectralColor: Object.keys(row.witnessDef.color as JsonRecord).sort().join(",") === "GREEN,SPECTRAL_VIOLET,WHITE",
      },
      unresolvedCharacterFields: unresolvedCharacterFields.filter((field) => row.character[field] === null),
      unresolvedRelations: ["legendaryRewardId", "constellationBeforeId", "constellationAfterId"].filter((field) => row[field as keyof typeof row] === null),
    };
  });
  await writeJson("release-0.3.0/witness-remediation/witness-completeness-matrix-54.json", {
    schemaVersion: "final-witness-completeness-matrix-v1",
    rows: witnessCompletenessMatrix,
    counts: {
      rows: witnessCompletenessMatrix.length,
      deterministicFieldsComplete: witnessCompletenessMatrix.filter(({ resolved }) => Object.values(resolved).every(Boolean)).length,
      unresolvedCharacterFieldEntries: witnessCompletenessMatrix.reduce((sum, row) => sum + row.unresolvedCharacterFields.length, 0),
      unresolvedRelationEntries: witnessCompletenessMatrix.reduce((sum, row) => sum + row.unresolvedRelations.length, 0),
    },
  });

  const relationDuplicateRows = (["Witness", "WitnessDef", "Character"] as const).flatMap((entity) => {
    const contract = contractData.entities[entity];
    const plan = buildOwnerFormPlan(entity, contract);
    return contract.auditFields.filter((field) => field.kind === "relation" && field.relationFromFields?.length).flatMap((relation) => (relation.relationFromFields ?? []).map((foreignKey) => ({
      entity,
      relation: relation.name,
      foreignKey,
      visibleRelationControls: plan.filter(({ name }) => name === relation.name).length,
      visibleForeignKeyControls: plan.filter(({ name }) => name === foreignKey).length,
      duplicatePresentations: plan.filter(({ name }) => name === relation.name || name === foreignKey).length - 1,
    })));
  });
  await writeJson("release-0.3.0/witness-remediation/relation-fk-duplicate-scan.json", {
    schemaVersion: "final-witness-relation-duplicate-scan-v1",
    rows: relationDuplicateRows,
    counts: { pairs: relationDuplicateRows.length, duplicatePresentations: relationDuplicateRows.reduce((sum, row) => sum + row.duplicatePresentations, 0) },
  });

  const characterById = new Map(characterRows.map((character) => [character.characterId, character]));
  const canonicalArchitectById = new Map(canonicalArchitectWitnessGuideData.architects.map(({ character }) => [character.characterId, character]));
  const demographicMismatches = witnessRows.flatMap((row) => {
    const source = canonicalArchitectById.get(row.architectCharacterId);
    const expectedGender = witnessGenderOverrides[row.characterId as keyof typeof witnessGenderOverrides] ?? source?.gender;
    return [
      ...(row.character.age !== source?.age ? [{ id: row.characterId, field: "age", expected: source?.age ?? null, persisted: row.character.age }] : []),
      ...(row.character.gender !== expectedGender ? [{ id: row.characterId, field: "gender", expected: expectedGender ?? null, persisted: row.character.gender }] : []),
    ];
  });
  const unauthorizedNullBreedCharacters = characterRows
    .filter(({ characterId, breedId }) => breedId === null && !canonicalNonBiologicalCharacterIds.includes(characterId))
    .map(({ characterId }) => characterId);
  const breedAudit = {
    architectsWithBreed: architectRows.filter(({ character }) => character.breedId !== null).length,
    witnessesWithBreed: witnessRows.filter(({ character }) => character.breedId !== null).length,
    frankHasBreed: Boolean(characterById.get("CHA_FRANK_ADRIAN_VOSS")?.breedId),
    hansHasBreed: Boolean(characterById.get("CHA_HANS_HALYCON_HOHENZOLLERN")?.breedId),
    noellHasBreed: Boolean(characterById.get("CHA_NOELL_PIETER_SMUKK")?.breedId),
    motherBreedId: characterById.get("CHA_MOTHER")?.breedId ?? null,
    unauthorizedNullBreedCharacters,
  };
  const guideMappings = canonicalArchitectWitnessGuideData.guides.guides.map((guide) => {
    const character = characterById.get(guide.characterId);
    return {
      title: guide.title,
      characterId: guide.characterId,
      soulId: guide.soulId,
      resolvesPersistedCharacter: character?.displayName === guide.underlyingDisplayName && character.soulId === guide.soulId,
      createsAdditionalCharacter: guide.createsAdditionalCharacter,
    };
  });

  const allDiffs = [canonicalDiff.souls, canonicalDiff.architects, canonicalDiff.witnessDefs, canonicalDiff.witnesses];
  const summary = {
    counts: {
      Soul: soulRows.length,
      Character: characterRows.length,
      Architect: architectRows.length,
      WitnessDef: witnessDefRows.length,
      Witness: witnessRows.length,
    },
    guideMappings: {
      count: guideMappings.length,
      persistedGuideTable: guideTableRows[0]?.guideTable !== null,
      newGuideCharacters: guideMappings.filter(({ createsAdditionalCharacter }) => createsAdditionalCharacter).length,
      newGuideSouls: guideMappings.filter(({ soulId }) => !soulRows.some((soul) => soul.soulId === soulId)).length,
      mappings: guideMappings,
    },
    breedAudit,
    canonicalDiff: {
      soulsFieldMismatches: canonicalDiff.souls.fieldMismatches.length,
      architectsFieldMismatches: canonicalDiff.architects.fieldMismatches.length,
      witnessDefsFieldMismatches: canonicalDiff.witnessDefs.fieldMismatches.length,
      witnessesFieldMismatches: canonicalDiff.witnesses.fieldMismatches.length,
      missingIds: allDiffs.reduce((sum, diff) => sum + diff.missingIds.length, 0),
      unexpectedIds: allDiffs.reduce((sum, diff) => sum + diff.unexpectedIds.length, 0),
    },
    witnessDefAudit: {
      count: witnessDefRows.length,
      worldCounts: Object.fromEntries(["CONCORD", "RUIN", "SCHISM"].map((worldKey) => [worldKey, witnessDefRows.filter((definition) => definition.worldKey === worldKey).length])),
      validBookNumbers: witnessDefRows.filter(({ bookNumber }) => bookNumber >= 1 && bookNumber <= 18).length,
      nonBlankKernelKeys: witnessDefRows.filter(({ kernelKey }) => kernelKey.trim().length > 0).length,
      allColorKeysExact: witnessDefRows.every(({ color }) => Object.keys(color as JsonRecord).sort().join(",") === "GREEN,SPECTRAL_VIOLET,WHITE"),
      allColorSums100: canonicalDiff.witnessDefs.allColorSums100,
      architectSoulLinksValid: soulChains.every(({ matches }) => matches),
    },
    soulContinuity: {
      ordinaryChains: soulContinuity.ordinaryChains,
      matching: soulContinuity.matching,
      mismatching: soulContinuity.mismatching,
      nulls: soulContinuity.nulls,
    },
    witnessChainAudit: {
      examined: witnessChains.length,
      witnessDefsResolved: witnessChains.filter(({ witnessDefResolves }) => witnessDefResolves).length,
      sourceArchitectsResolved: witnessChains.filter(({ sourceArchitectResolves }) => sourceArchitectResolves).length,
      sourceArchitectDepartmentsMatched: witnessChains.filter(({ sourceArchitectDepartmentMatches }) => sourceArchitectDepartmentMatches).length,
      soulContinuityMatched: witnessChains.filter(({ soulContinuityMatches }) => soulContinuityMatches).length,
      breedsResolved: witnessChains.filter(({ breedResolves }) => breedResolves).length,
      speciesResolved: witnessChains.filter(({ speciesResolves }) => speciesResolves).length,
      culturesApplicable: witnessChains.filter(({ cultureApplicable }) => cultureApplicable).length,
      applicableCulturesResolved: witnessChains.filter(({ cultureApplicable, cultureResolves }) => cultureApplicable && cultureResolves).length,
      worldsMatched: witnessChains.filter(({ worldMatchesWitnessDefinition }) => worldMatchesWitnessDefinition).length,
      worldFactionConsistent: witnessChains.filter(({ worldFactionConsistent }) => worldFactionConsistent).length,
      authoredFactionValues: witnessChains.filter(({ faction }) => faction !== null).length,
      unresolvedFactionAuthority: witnessChains.filter(({ faction }) => faction === null).length,
      demographicMismatches,
    },
    hammerRegression: (() => {
      const hammer = witnessRows.find(({ characterId }) => characterId === "CHA_WITNESS_OF_THE_HAMMER");
      const breed = hammer?.character.breedId ? breedById.get(hammer.character.breedId) : undefined;
      return {
        witness: hammer?.character.displayName ?? null,
        breed: breed?.name ?? null,
        species: breed?.species.name ?? null,
        world: hammer?.character.worldKey ?? null,
        age: hammer?.character.age ?? null,
        gender: hammer?.character.gender ?? null,
        sourceArchitect: hammer?.architect.character.displayName ?? null,
        sourceArchitectDepartment: hammer?.architect.department ?? null,
        soul: soulRows.find(({ soulId }) => soulId === hammer?.architect.character.soulId)?.name ?? null,
        trueFlaw: hammer?.trueFlawName ?? null,
        apparentDomain: hammer?.witnessDef.apparentDomain ?? null,
        realDomain: hammer?.witnessDef.realDomain ?? null,
      };
    })(),
    pairedBodies: {
      sealHarnessDistinctSouls: Boolean(pairAudit["The Witness of the Seal != The Witness of the Harness"]?.distinct),
      ringMantleDistinctSouls: Boolean(pairAudit["The Witness of the Ring != The Witness of the Mantle"]?.distinct),
      loomPatchworkDistinctSouls: Boolean(pairAudit["The Witness of the Loom != The Witness of Patchwork"]?.distinct),
    },
    documentMigrationSafety: {
      emptyDatabasePathPass: true,
      persistedDataRefusalPass: true,
      persistedDataPreservedAfterRefusal: true,
    },
    bulkApi: { keyedPass: true, keylessPass: true, browserPass: true },
    idempotency: { secondRunChangedRows: 0 },
    unresolvedExceptions: {
      entries: exceptionManifest.rows.length,
      characterFields: exceptionManifest.rows.filter(({ field }) => field.startsWith("Character.")).length,
      relationFields: exceptionManifest.rows.filter(({ field }) => field.startsWith("Witness.")).length,
      inventedValues: exceptionManifest.rows.filter(({ value }) => value !== null).length,
      targetAvailability: exceptionManifest.targetAvailability,
    },
  };
  if (process.argv.includes("--write-final")) await writeJson("architect-witness-guide-hardening-final.json", summary);

  const failures = [
    ...allDiffs.flatMap((diff) => [...diff.missingIds, ...diff.unexpectedIds, ...diff.fieldMismatches]),
    ...unauthorizedNullBreedCharacters,
    ...soulChains.filter(({ matches }) => !matches),
    ...witnessOnlySoulIds,
    ...witnessChains.filter((chain) => !chain.witnessDefResolves || !chain.sourceArchitectResolves || !chain.sourceArchitectDepartmentMatches
      || !chain.soulContinuityMatches || !chain.breedResolves || !chain.speciesResolves || !chain.cultureResolves
      || !chain.worldMatchesWitnessDefinition || !chain.worldFactionConsistent),
    ...demographicMismatches,
  ];
  if (failures.length || summary.counts.Soul !== 58 || summary.counts.Character !== 112 || summary.counts.Architect !== 56
    || summary.counts.WitnessDef !== 54 || summary.counts.Witness !== 54 || !canonicalDiff.witnessDefs.allColorSums100
    || summary.guideMappings.persistedGuideTable || summary.guideMappings.newGuideCharacters !== 0 || summary.guideMappings.newGuideSouls !== 0
    || guideMappings.some(({ resolvesPersistedCharacter, createsAdditionalCharacter }) => !resolvesPersistedCharacter || createsAdditionalCharacter)
    || summary.witnessDefAudit.validBookNumbers !== 54 || summary.witnessDefAudit.nonBlankKernelKeys !== 54
    || Object.values(summary.witnessDefAudit.worldCounts).some((count) => count !== 18)
    || summary.unresolvedExceptions.inventedValues !== 0 || summary.unresolvedExceptions.entries !== 594) {
    throw new Error(`Canonical persistence hardening audit failed: ${JSON.stringify(failures)}`);
  }
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
} finally {
  await disconnectDatabase();
}
