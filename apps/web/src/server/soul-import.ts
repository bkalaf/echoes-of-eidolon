import { z } from "zod";

import { TimelineEventType } from "../generated/prisma/enums";

const soulImportRowSchema = z.object({
  name: z.string().refine((value) => value.trim().length > 0, "name cannot be blank"),
  soulId: z.string().refine((value) => value.trim().length > 0, "soulId cannot be blank"),
}).strict();

const definitionImportRowSchema = z.object({
  definition: z.string().refine((value) => value.trim().length > 0, "definition cannot be blank"),
  definitionId: z.string().refine((value) => value.trim().length > 0, "definitionId cannot be blank"),
  term: z.string().refine((value) => value.trim().length > 0, "term cannot be blank"),
}).strict();

const lessonImportRowSchema = z.object({
  description: z.string().refine((value) => value.trim().length > 0, "description cannot be blank"),
  lessonId: z.string().refine((value) => value.trim().length > 0, "lessonId cannot be blank"),
  name: z.string().refine((value) => value.trim().length > 0, "name cannot be blank"),
}).strict();

const legendaryRewardImportRowSchema = z.object({
  description: z.string().refine((value) => value.trim().length > 0, "description cannot be blank"),
  legendaryRewardId: z.string().refine((value) => value.trim().length > 0, "legendaryRewardId cannot be blank"),
  name: z.string().refine((value) => value.trim().length > 0, "name cannot be blank"),
}).strict();

const timelineEventImportRowSchema = z.object({
  name: z.string().refine((value) => value.trim().length > 0, "name cannot be blank"),
  summary: z.string().refine((value) => value.trim().length > 0, "summary cannot be blank"),
  timelineEventId: z.string().refine((value) => value.trim().length > 0, "timelineEventId cannot be blank"),
  timelineEventType: z.enum(TimelineEventType),
}).strict();

export type SoulImportRow = z.infer<typeof soulImportRowSchema>;
export type DefinitionImportRow = z.infer<typeof definitionImportRowSchema>;
export type LessonImportRow = z.infer<typeof lessonImportRowSchema>;
export type LegendaryRewardImportRow = z.infer<typeof legendaryRewardImportRowSchema>;
export type TimelineEventImportRow = z.infer<typeof timelineEventImportRowSchema>;

interface SoulImportTransaction {
  soul: {
    createMany(input: { data: SoulImportRow[] }): Promise<{ count: number }>;
    findMany(input: {
      select: { name: true; soulId: true };
      where: { soulId: { in: string[] } };
    }): Promise<SoulImportRow[]>;
  };
}

export interface SoulImportDatabase {
  transaction<Result>(work: (transaction: SoulImportTransaction) => Promise<Result>): Promise<Result>;
}

interface DefinitionImportTransaction {
  definition: {
    createMany(input: { data: DefinitionImportRow[] }): Promise<{ count: number }>;
    findMany(input: {
      select: { definition: true; definitionId: true; term: true };
      where: { definitionId: { in: string[] } };
    }): Promise<DefinitionImportRow[]>;
  };
}

export interface DefinitionImportDatabase {
  transaction<Result>(work: (transaction: DefinitionImportTransaction) => Promise<Result>): Promise<Result>;
}

interface LessonImportTransaction {
  lesson: {
    createMany(input: { data: LessonImportRow[] }): Promise<{ count: number }>;
    findMany(input: {
      select: { description: true; lessonId: true; name: true };
      where: { lessonId: { in: string[] } };
    }): Promise<LessonImportRow[]>;
  };
}

export interface LessonImportDatabase {
  transaction<Result>(work: (transaction: LessonImportTransaction) => Promise<Result>): Promise<Result>;
}

interface LegendaryRewardImportTransaction {
  legendaryReward: {
    createMany(input: { data: LegendaryRewardImportRow[] }): Promise<{ count: number }>;
    findMany(input: {
      select: { description: true; legendaryRewardId: true; name: true };
      where: { legendaryRewardId: { in: string[] } };
    }): Promise<LegendaryRewardImportRow[]>;
  };
}

export interface LegendaryRewardImportDatabase {
  transaction<Result>(work: (transaction: LegendaryRewardImportTransaction) => Promise<Result>): Promise<Result>;
}

interface TimelineEventImportTransaction {
  timelineEvent: {
    createMany(input: { data: TimelineEventImportRow[] }): Promise<{ count: number }>;
    findMany(input: {
      select: { name: true; summary: true; timelineEventId: true; timelineEventType: true };
      where: { timelineEventId: { in: string[] } };
    }): Promise<TimelineEventImportRow[]>;
  };
}

export interface TimelineEventImportDatabase {
  transaction<Result>(work: (transaction: TimelineEventImportTransaction) => Promise<Result>): Promise<Result>;
}

export class UnsupportedImportEntityError extends Error {}
export class CanonicalImportDriftError extends Error {}

export function parseSoulImportRows(value: unknown): SoulImportRow[] {
  const rows = z.array(soulImportRowSchema).min(1, "Import requires at least one row.").parse(value);
  const identifiers = new Set<string>();
  for (const row of rows) {
    if (identifiers.has(row.soulId)) throw new Error(`Import duplicates soulId ${row.soulId}.`);
    identifiers.add(row.soulId);
  }
  return rows;
}

export function parseDefinitionImportRows(value: unknown): DefinitionImportRow[] {
  const rows = z.array(definitionImportRowSchema).min(1, "Import requires at least one row.").parse(value);
  const identifiers = new Set<string>();
  for (const row of rows) {
    if (identifiers.has(row.definitionId)) throw new Error(`Import duplicates definitionId ${row.definitionId}.`);
    identifiers.add(row.definitionId);
  }
  return rows;
}

export function parseLessonImportRows(value: unknown): LessonImportRow[] {
  const rows = z.array(lessonImportRowSchema).min(1, "Import requires at least one row.").parse(value);
  const identifiers = new Set<string>();
  for (const row of rows) {
    if (identifiers.has(row.lessonId)) throw new Error(`Import duplicates lessonId ${row.lessonId}.`);
    identifiers.add(row.lessonId);
  }
  return rows;
}

export function parseLegendaryRewardImportRows(value: unknown): LegendaryRewardImportRow[] {
  const rows = z.array(legendaryRewardImportRowSchema).min(1, "Import requires at least one row.").parse(value);
  const identifiers = new Set<string>();
  for (const row of rows) {
    if (identifiers.has(row.legendaryRewardId)) {
      throw new Error(`Import duplicates legendaryRewardId ${row.legendaryRewardId}.`);
    }
    identifiers.add(row.legendaryRewardId);
  }
  return rows;
}

export function parseTimelineEventImportRows(value: unknown): TimelineEventImportRow[] {
  const rows = z.array(timelineEventImportRowSchema).min(1, "Import requires at least one row.").parse(value);
  const identifiers = new Set<string>();
  for (const row of rows) {
    if (identifiers.has(row.timelineEventId)) {
      throw new Error(`Import duplicates timelineEventId ${row.timelineEventId}.`);
    }
    identifiers.add(row.timelineEventId);
  }
  return rows;
}

export async function applySoulImport(
  value: unknown,
  database: SoulImportDatabase,
): Promise<{ changed: number; unchanged: number }> {
  const rows = parseSoulImportRows(value);

  return database.transaction(async (transaction) => {
    const existing = await transaction.soul.findMany({
      select: { name: true, soulId: true },
      where: { soulId: { in: rows.map((row) => row.soulId) } },
    });
    const existingById = new Map(existing.map((row) => [row.soulId, row]));

    for (const row of rows) {
      const persisted = existingById.get(row.soulId);
      if (persisted && persisted.name !== row.name) {
        throw new CanonicalImportDriftError(`Canonical drift refused for Soul ${row.soulId}.`);
      }
    }

    const missing = rows.filter((row) => !existingById.has(row.soulId));
    if (missing.length > 0) await transaction.soul.createMany({ data: missing });
    return { changed: missing.length, unchanged: rows.length - missing.length };
  });
}

export async function applyDefinitionImport(
  value: unknown,
  database: DefinitionImportDatabase,
): Promise<{ changed: number; unchanged: number }> {
  const rows = parseDefinitionImportRows(value);
  return database.transaction(async (transaction) => {
    const existing = await transaction.definition.findMany({
      select: { definition: true, definitionId: true, term: true },
      where: { definitionId: { in: rows.map((row) => row.definitionId) } },
    });
    const existingById = new Map(existing.map((row) => [row.definitionId, row]));
    for (const row of rows) {
      const persisted = existingById.get(row.definitionId);
      if (persisted && (persisted.term !== row.term || persisted.definition !== row.definition)) {
        throw new CanonicalImportDriftError(`Canonical drift refused for Definition ${row.definitionId}.`);
      }
    }
    const missing = rows.filter((row) => !existingById.has(row.definitionId));
    if (missing.length > 0) await transaction.definition.createMany({ data: missing });
    return { changed: missing.length, unchanged: rows.length - missing.length };
  });
}

export async function applyLessonImport(
  value: unknown,
  database: LessonImportDatabase,
): Promise<{ changed: number; unchanged: number }> {
  const rows = parseLessonImportRows(value);
  return database.transaction(async (transaction) => {
    const existing = await transaction.lesson.findMany({
      select: { description: true, lessonId: true, name: true },
      where: { lessonId: { in: rows.map((row) => row.lessonId) } },
    });
    const existingById = new Map(existing.map((row) => [row.lessonId, row]));
    for (const row of rows) {
      const persisted = existingById.get(row.lessonId);
      if (persisted && (persisted.name !== row.name || persisted.description !== row.description)) {
        throw new CanonicalImportDriftError(`Canonical drift refused for Lesson ${row.lessonId}.`);
      }
    }
    const missing = rows.filter((row) => !existingById.has(row.lessonId));
    if (missing.length > 0) await transaction.lesson.createMany({ data: missing });
    return { changed: missing.length, unchanged: rows.length - missing.length };
  });
}

export async function applyLegendaryRewardImport(
  value: unknown,
  database: LegendaryRewardImportDatabase,
): Promise<{ changed: number; unchanged: number }> {
  const rows = parseLegendaryRewardImportRows(value);
  return database.transaction(async (transaction) => {
    const existing = await transaction.legendaryReward.findMany({
      select: { description: true, legendaryRewardId: true, name: true },
      where: { legendaryRewardId: { in: rows.map((row) => row.legendaryRewardId) } },
    });
    const existingById = new Map(existing.map((row) => [row.legendaryRewardId, row]));
    for (const row of rows) {
      const persisted = existingById.get(row.legendaryRewardId);
      if (persisted && (persisted.name !== row.name || persisted.description !== row.description)) {
        throw new CanonicalImportDriftError(`Canonical drift refused for LegendaryReward ${row.legendaryRewardId}.`);
      }
    }
    const missing = rows.filter((row) => !existingById.has(row.legendaryRewardId));
    if (missing.length > 0) await transaction.legendaryReward.createMany({ data: missing });
    return { changed: missing.length, unchanged: rows.length - missing.length };
  });
}

export async function applyTimelineEventImport(
  value: unknown,
  database: TimelineEventImportDatabase,
): Promise<{ changed: number; unchanged: number }> {
  const rows = parseTimelineEventImportRows(value);
  return database.transaction(async (transaction) => {
    const existing = await transaction.timelineEvent.findMany({
      select: { name: true, summary: true, timelineEventId: true, timelineEventType: true },
      where: { timelineEventId: { in: rows.map((row) => row.timelineEventId) } },
    });
    const existingById = new Map(existing.map((row) => [row.timelineEventId, row]));
    for (const row of rows) {
      const persisted = existingById.get(row.timelineEventId);
      if (persisted && (
        persisted.name !== row.name ||
        persisted.summary !== row.summary ||
        persisted.timelineEventType !== row.timelineEventType
      )) {
        throw new CanonicalImportDriftError(`Canonical drift refused for TimelineEvent ${row.timelineEventId}.`);
      }
    }
    const missing = rows.filter((row) => !existingById.has(row.timelineEventId));
    if (missing.length > 0) await transaction.timelineEvent.createMany({ data: missing });
    return { changed: missing.length, unchanged: rows.length - missing.length };
  });
}

export async function applyRegisteredEntityImport(
  entityKey: string,
  value: unknown,
  database: SoulImportDatabase | DefinitionImportDatabase | LessonImportDatabase | LegendaryRewardImportDatabase | TimelineEventImportDatabase,
) {
  if (entityKey === "soul") return applySoulImport(value, database as SoulImportDatabase);
  if (entityKey === "definition") return applyDefinitionImport(value, database as DefinitionImportDatabase);
  if (entityKey === "lesson") return applyLessonImport(value, database as LessonImportDatabase);
  if (entityKey === "legendaryreward") return applyLegendaryRewardImport(value, database as LegendaryRewardImportDatabase);
  if (entityKey === "timelineevent") return applyTimelineEventImport(value, database as TimelineEventImportDatabase);
  throw new UnsupportedImportEntityError(`Typed import is unavailable for entity key ${entityKey}.`);
}
