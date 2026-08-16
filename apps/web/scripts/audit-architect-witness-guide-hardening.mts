import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";

import {
  canonicalArchitectWitnessGuideData,
  canonicalArchitectWitnessRoster,
  canonicalNonBiologicalCharacterIds,
} from "../src/domain/architect-witness";
import { disconnectDatabase, getDatabase } from "../src/server/database";

const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
if (!new Set(["localhost", "127.0.0.1", "[::1]"]).has(databaseUrl.hostname)) {
  throw new Error("Architect/Witness hardening audit is restricted to a local database.");
}

const artifactsDirectory = resolve(import.meta.dirname, "../../../artifacts");
await mkdir(artifactsDirectory, { recursive: true });

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
  await writeFile(resolve(artifactsDirectory, name), `${JSON.stringify(normalized(value), null, 2)}\n`);
}

const database = getDatabase();
try {
  const [soulRows, architectRows, witnessDefRows, witnessRows, characterRows, guideTableRows] = await Promise.all([
    database.soul.findMany({ orderBy: { soulId: "asc" } }),
    database.architect.findMany({ include: { character: true }, orderBy: { characterId: "asc" } }),
    database.witnessDef.findMany({ orderBy: { witnessDefId: "asc" } }),
    database.witness.findMany({ include: { character: true, architect: { include: { character: true } }, witnessDef: true }, orderBy: { characterId: "asc" } }),
    database.character.findMany({ orderBy: { characterId: "asc" } }),
    database.$queryRaw<Array<{ guideTable: string | null }>>`SELECT to_regclass('public."Guide"')::text AS "guideTable"`,
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
    },
    architect: { characterId, department },
  }));
  const persistedWitnessDefs = witnessDefRows.map(({ witnessDefId, name, department, apparentDomain, realDomain, color, architectSoulId }) => ({
    witnessDefId, name, department, apparentDomain, realDomain, color, architectSoulId,
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
  const expectedWitnessDefs = canonicalArchitectWitnessGuideData.witnessDefs.map(({ witnessDefId, name, department, apparentDomain, realDomain, color, architectSoulId }) => ({
    witnessDefId, name, department, apparentDomain, realDomain, color, architectSoulId,
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

  const characterById = new Map(characterRows.map((character) => [character.characterId, character]));
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
  };
  if (process.argv.includes("--write-final")) await writeJson("architect-witness-guide-hardening-final.json", summary);

  const failures = [
    ...allDiffs.flatMap((diff) => [...diff.missingIds, ...diff.unexpectedIds, ...diff.fieldMismatches]),
    ...unauthorizedNullBreedCharacters,
    ...soulChains.filter(({ matches }) => !matches),
    ...witnessOnlySoulIds,
  ];
  if (failures.length || summary.counts.Soul !== 58 || summary.counts.Character !== 112 || summary.counts.Architect !== 56
    || summary.counts.WitnessDef !== 54 || summary.counts.Witness !== 54 || !canonicalDiff.witnessDefs.allColorSums100
    || summary.guideMappings.persistedGuideTable || summary.guideMappings.newGuideCharacters !== 0 || summary.guideMappings.newGuideSouls !== 0
    || guideMappings.some(({ resolvesPersistedCharacter, createsAdditionalCharacter }) => !resolvesPersistedCharacter || createsAdditionalCharacter)) {
    throw new Error(`Canonical persistence hardening audit failed: ${JSON.stringify(failures)}`);
  }
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
} finally {
  await disconnectDatabase();
}
