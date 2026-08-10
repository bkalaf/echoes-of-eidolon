import { describe, expect, it, vi } from "vitest";

import {
  applyDefinitionImport,
  applyLessonImport,
  applyLegendaryRewardImport,
  applyTimelineEventImport,
  applyInterludeImport,
  applyArkImport,
  applyLayetteImport,
  applyTomeImport,
  applyRegisteredEntityImport,
  applySoulImport,
  parseDefinitionImportRows,
  parseLessonImportRows,
  parseLegendaryRewardImportRows,
  parseTimelineEventImportRows,
  parseInterludeImportRows,
  parseArkImportRows,
  parseLayetteImportRows,
  parseTomeImportRows,
  parseSoulImportRows,
} from "../../src/server/soul-import";

interface StoredSoul {
  name: string;
  soulId: string;
}

function database(initial: StoredSoul[] = []) {
  const stored = new Map(initial.map((row) => [row.soulId, { ...row }]));
  const transaction = vi.fn(async <Result>(work: (client: {
    soul: {
      createMany(input: { data: StoredSoul[] }): Promise<{ count: number }>;
      findMany(input: {
        select: { name: true; soulId: true };
        where: { soulId: { in: string[] } };
      }): Promise<StoredSoul[]>;
    };
  }) => Promise<Result>) => {
    const snapshot = new Map([...stored].map(([key, value]) => [key, { ...value }]));
    try {
      return await work({
        soul: {
          async createMany({ data }) {
            for (const row of data) {
              if (stored.has(row.soulId)) throw new Error("duplicate");
              stored.set(row.soulId, { ...row });
            }
            return { count: data.length };
          },
          async findMany({ where }) {
            return where.soulId.in.flatMap((soulId) => {
              const row = stored.get(soulId);
              return row ? [{ ...row }] : [];
            });
          },
        },
      });
    } catch (error) {
      stored.clear();
      for (const [key, value] of snapshot) stored.set(key, value);
      throw error;
    }
  });

  return { stored, transaction };
}

interface StoredDefinition {
  definition: string;
  definitionId: string;
  term: string;
}

function definitionDatabase(initial: StoredDefinition[] = []) {
  const stored = new Map(initial.map((row) => [row.definitionId, { ...row }]));
  const transaction = vi.fn(async <Result>(work: (client: {
    definition: {
      createMany(input: { data: StoredDefinition[] }): Promise<{ count: number }>;
      findMany(input: {
        select: { definition: true; definitionId: true; term: true };
        where: { definitionId: { in: string[] } };
      }): Promise<StoredDefinition[]>;
    };
  }) => Promise<Result>) => work({
    definition: {
      async createMany({ data }) {
        for (const row of data) stored.set(row.definitionId, { ...row });
        return { count: data.length };
      },
      async findMany({ where }) {
        return where.definitionId.in.flatMap((definitionId) => {
          const row = stored.get(definitionId);
          return row ? [{ ...row }] : [];
        });
      },
    },
  }));
  return { stored, transaction };
}

interface StoredLesson {
  description: string;
  lessonId: string;
  name: string;
}

function lessonDatabase(initial: StoredLesson[] = []) {
  const stored = new Map(initial.map((row) => [row.lessonId, { ...row }]));
  const transaction = vi.fn(async <Result>(work: (client: {
    lesson: {
      createMany(input: { data: StoredLesson[] }): Promise<{ count: number }>;
      findMany(input: {
        select: { description: true; lessonId: true; name: true };
        where: { lessonId: { in: string[] } };
      }): Promise<StoredLesson[]>;
    };
  }) => Promise<Result>) => work({
    lesson: {
      async createMany({ data }) {
        for (const row of data) stored.set(row.lessonId, { ...row });
        return { count: data.length };
      },
      async findMany({ where }) {
        return where.lessonId.in.flatMap((lessonId) => {
          const row = stored.get(lessonId);
          return row ? [{ ...row }] : [];
        });
      },
    },
  }));
  return { stored, transaction };
}

describe("typed Soul import", () => {
  it("fails closed on every unregistered entity key", async () => {
    const db = database();
    await expect(applyRegisteredEntityImport("user-supplied-table", [], db))
      .rejects.toThrow("Typed import is unavailable for entity key user-supplied-table");
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("rejects empty batches, unknown fields, blank values, and duplicate identifiers", () => {
    expect(() => parseSoulImportRows([])).toThrow("at least one row");
    expect(() => parseSoulImportRows([{ soulId: "SOUL-1", name: "One", status: "READY" }])).toThrow();
    expect(() => parseSoulImportRows([{ soulId: "", name: "One" }])).toThrow();
    expect(() => parseSoulImportRows([{ soulId: "SOUL-1", name: "" }])).toThrow();
    expect(() => parseSoulImportRows([
      { soulId: "SOUL-1", name: "One" },
      { soulId: "SOUL-1", name: "One" },
    ])).toThrow("duplicates soulId SOUL-1");
  });

  it("creates missing rows together and reports exact results", async () => {
    const db = database();
    const result = await applySoulImport([
      { soulId: "SOUL-1", name: "One" },
      { soulId: "SOUL-2", name: "Two" },
    ], db);

    expect(result).toEqual({ changed: 2, unchanged: 0 });
    expect([...db.stored.values()]).toEqual([
      { soulId: "SOUL-1", name: "One" },
      { soulId: "SOUL-2", name: "Two" },
    ]);
    expect(db.transaction).toHaveBeenCalledOnce();
  });

  it("is idempotent when persisted rows match exactly", async () => {
    const db = database([{ soulId: "SOUL-1", name: "One" }]);

    await expect(applySoulImport([{ soulId: "SOUL-1", name: "One" }], db))
      .resolves.toEqual({ changed: 0, unchanged: 1 });
    expect([...db.stored.values()]).toEqual([{ soulId: "SOUL-1", name: "One" }]);
  });

  it("refuses canonical drift without partially creating missing rows", async () => {
    const db = database([{ soulId: "SOUL-2", name: "Canonical" }]);

    await expect(applySoulImport([
      { soulId: "SOUL-1", name: "New" },
      { soulId: "SOUL-2", name: "Changed" },
    ], db)).rejects.toThrow("Canonical drift refused for Soul SOUL-2");
    expect([...db.stored.values()]).toEqual([{ soulId: "SOUL-2", name: "Canonical" }]);
  });
});

describe("typed Definition import", () => {
  it("accepts only the three exact nonblank persisted fields", () => {
    expect(parseDefinitionImportRows([{
      definition: "The supplied meaning.",
      definitionId: "DEF-1",
      term: "Supplied term",
    }])).toEqual([{
      definition: "The supplied meaning.",
      definitionId: "DEF-1",
      term: "Supplied term",
    }]);
    expect(() => parseDefinitionImportRows([{
      definition: "The supplied meaning.",
      definitionId: "DEF-1",
      term: "Supplied term",
      status: "READY",
    }])).toThrow();
    expect(() => parseDefinitionImportRows([{
      definition: " ",
      definitionId: "DEF-1",
      term: "Supplied term",
    }])).toThrow();
  });

  it("creates missing definitions and is idempotent on an exact rerun", async () => {
    const db = definitionDatabase();
    const rows = [{ definition: "Meaning", definitionId: "DEF-1", term: "Term" }];

    await expect(applyDefinitionImport(rows, db)).resolves.toEqual({ changed: 1, unchanged: 0 });
    await expect(applyRegisteredEntityImport("definition", rows, db)).resolves.toEqual({ changed: 0, unchanged: 1 });
    expect([...db.stored.values()]).toEqual(rows);
  });

  it("refuses drift in either authored field", async () => {
    const db = definitionDatabase([{ definition: "Canonical", definitionId: "DEF-1", term: "Term" }]);
    await expect(applyDefinitionImport([
      { definition: "Changed", definitionId: "DEF-1", term: "Term" },
    ], db)).rejects.toThrow("Canonical drift refused for Definition DEF-1");
    expect([...db.stored.values()]).toEqual([
      { definition: "Canonical", definitionId: "DEF-1", term: "Term" },
    ]);
  });
});

describe("typed Lesson import", () => {
  const row = { description: "Supplied description", lessonId: "LESSON-1", name: "Supplied lesson" };

  it("rejects unknown fields, blank authored text, and duplicate identifiers", () => {
    expect(parseLessonImportRows([row])).toEqual([row]);
    expect(() => parseLessonImportRows([{ ...row, book: 1 }])).toThrow();
    expect(() => parseLessonImportRows([{ ...row, name: "" }])).toThrow();
    expect(() => parseLessonImportRows([row, row])).toThrow("duplicates lessonId LESSON-1");
  });

  it("creates, reruns idempotently, and refuses authored drift", async () => {
    const db = lessonDatabase();
    await expect(applyLessonImport([row], db)).resolves.toEqual({ changed: 1, unchanged: 0 });
    await expect(applyRegisteredEntityImport("lesson", [row], db)).resolves.toEqual({ changed: 0, unchanged: 1 });
    await expect(applyLessonImport([{ ...row, description: "Changed" }], db))
      .rejects.toThrow("Canonical drift refused for Lesson LESSON-1");
    expect([...db.stored.values()]).toEqual([row]);
  });
});

describe("typed LegendaryReward import", () => {
  const row = {
    description: "Supplied reward description",
    legendaryRewardId: "REWARD-1",
    name: "Supplied reward",
  };
  const stored = new Map<string, typeof row>();
  const database = {
    transaction: vi.fn(async <Result>(work: (client: {
      legendaryReward: {
        createMany(input: { data: typeof row[] }): Promise<{ count: number }>;
        findMany(input: {
          select: { description: true; legendaryRewardId: true; name: true };
          where: { legendaryRewardId: { in: string[] } };
        }): Promise<typeof row[]>;
      };
    }) => Promise<Result>) => work({
      legendaryReward: {
        async createMany({ data }) {
          for (const item of data) stored.set(item.legendaryRewardId, { ...item });
          return { count: data.length };
        },
        async findMany({ where }) {
          return where.legendaryRewardId.in.flatMap((id) => stored.has(id) ? [{ ...stored.get(id)! }] : []);
        },
      },
    })),
  };

  it("imports only exact authored fields without creating relationships", async () => {
    stored.clear();
    expect(parseLegendaryRewardImportRows([row])).toEqual([row]);
    expect(() => parseLegendaryRewardImportRows([{ ...row, antagonistId: "ANT-1" }])).toThrow();
    await expect(applyLegendaryRewardImport([row], database)).resolves.toEqual({ changed: 1, unchanged: 0 });
    await expect(applyRegisteredEntityImport("legendaryreward", [row], database)).resolves.toEqual({ changed: 0, unchanged: 1 });
  });

  it("rejects duplicates and canonical drift", async () => {
    stored.clear();
    stored.set(row.legendaryRewardId, row);
    expect(() => parseLegendaryRewardImportRows([row, row])).toThrow("duplicates legendaryRewardId REWARD-1");
    await expect(applyLegendaryRewardImport([{ ...row, name: "Changed" }], database))
      .rejects.toThrow("Canonical drift refused for LegendaryReward REWARD-1");
  });
});

describe("typed TimelineEvent import", () => {
  const row = {
    name: "Supplied event",
    summary: "Supplied summary",
    timelineEventId: "EVENT-1",
    timelineEventType: "HISTORICAL" as const,
  };
  const stored = new Map<string, typeof row>();
  const database = {
    transaction: vi.fn(async <Result>(work: (client: {
      timelineEvent: {
        createMany(input: { data: typeof row[] }): Promise<{ count: number }>;
        findMany(input: {
          select: { name: true; summary: true; timelineEventId: true; timelineEventType: true };
          where: { timelineEventId: { in: string[] } };
        }): Promise<typeof row[]>;
      };
    }) => Promise<Result>) => work({
      timelineEvent: {
        async createMany({ data }) {
          for (const item of data) stored.set(item.timelineEventId, { ...item });
          return { count: data.length };
        },
        async findMany({ where }) {
          return where.timelineEventId.in.flatMap((id) => stored.has(id) ? [{ ...stored.get(id)! }] : []);
        },
      },
    })),
  };

  it("requires an exact Prisma TimelineEventType without a default", () => {
    expect(parseTimelineEventImportRows([row])).toEqual([row]);
    expect(() => parseTimelineEventImportRows([{ ...row, timelineEventType: "UNRESOLVED" }])).toThrow();
    const missingType: Partial<typeof row> = { ...row };
    delete missingType.timelineEventType;
    expect(() => parseTimelineEventImportRows([missingType])).toThrow();
  });

  it("is idempotent and refuses finite-field drift", async () => {
    stored.clear();
    await expect(applyTimelineEventImport([row], database)).resolves.toEqual({ changed: 1, unchanged: 0 });
    await expect(applyRegisteredEntityImport("timelineevent", [row], database)).resolves.toEqual({ changed: 0, unchanged: 1 });
    await expect(applyTimelineEventImport([{ ...row, timelineEventType: "ATROCITY" }], database))
      .rejects.toThrow("Canonical drift refused for TimelineEvent EVENT-1");
  });
});

describe("typed Interlude import", () => {
  const row = {
    interludeId: "INTERLUDE-1",
    interludeType: "SCIENCE" as const,
    name: "Supplied interlude",
    summary: "Supplied summary",
  };
  const stored = new Map<string, typeof row>();
  const database = {
    transaction: vi.fn(async <Result>(work: (client: {
      interlude: {
        createMany(input: { data: typeof row[] }): Promise<{ count: number }>;
        findMany(input: {
          select: { interludeId: true; interludeType: true; name: true; summary: true };
          where: { interludeId: { in: string[] } };
        }): Promise<typeof row[]>;
      };
    }) => Promise<Result>) => work({
      interlude: {
        async createMany({ data }) {
          for (const item of data) stored.set(item.interludeId, { ...item });
          return { count: data.length };
        },
        async findMany({ where }) {
          return where.interludeId.in.flatMap((id) => stored.has(id) ? [{ ...stored.get(id)! }] : []);
        },
      },
    })),
  };

  it("requires an exact authored InterludeType and exact fields", () => {
    expect(parseInterludeImportRows([row])).toEqual([row]);
    expect(() => parseInterludeImportRows([{ ...row, interludeType: "DREAM" }])).toThrow();
    expect(() => parseInterludeImportRows([{ ...row, substitutionId: "SUB-1" }])).toThrow();
  });

  it("applies once, reruns unchanged, and refuses drift", async () => {
    stored.clear();
    await expect(applyInterludeImport([row], database)).resolves.toEqual({ changed: 1, unchanged: 0 });
    await expect(applyRegisteredEntityImport("interlude", [row], database)).resolves.toEqual({ changed: 0, unchanged: 1 });
    await expect(applyInterludeImport([{ ...row, interludeType: "MYTH" }], database))
      .rejects.toThrow("Canonical drift refused for Interlude INTERLUDE-1");
  });
});

describe("typed Ark import", () => {
  const row = { arkId: "ARK-1", name: "Supplied ark", status: "OPERATIONAL" as const };
  const stored = new Map<string, typeof row>();
  const database = {
    transaction: vi.fn(async <Result>(work: (client: {
      ark: {
        createMany(input: { data: typeof row[] }): Promise<{ count: number }>;
        findMany(input: {
          select: { arkId: true; name: true; status: true };
          where: { arkId: { in: string[] } };
        }): Promise<typeof row[]>;
      };
    }) => Promise<Result>) => work({
      ark: {
        async createMany({ data }) {
          for (const item of data) stored.set(item.arkId, { ...item });
          return { count: data.length };
        },
        async findMany({ where }) {
          return where.arkId.in.flatMap((id) => stored.has(id) ? [{ ...stored.get(id)! }] : []);
        },
      },
    })),
  };

  it("accepts only exact ArkStatus values and exact fields", () => {
    expect(parseArkImportRows([row])).toEqual([row]);
    expect(() => parseArkImportRows([{ ...row, status: "UNKNOWN" }])).toThrow();
    expect(() => parseArkImportRows([{ ...row, campaignBook: 1 }])).toThrow();
  });

  it("applies idempotently and refuses status drift", async () => {
    stored.clear();
    await expect(applyArkImport([row], database)).resolves.toEqual({ changed: 1, unchanged: 0 });
    await expect(applyRegisteredEntityImport("ark", [row], database)).resolves.toEqual({ changed: 0, unchanged: 1 });
    await expect(applyArkImport([{ ...row, status: "DAMAGED" }], database))
      .rejects.toThrow("Canonical drift refused for Ark ARK-1");
  });
});

describe("typed Layette import", () => {
  const row = { description: "Supplied description", layetteId: "LAYETTE-1", name: "Supplied layette" };
  const stored = new Map<string, typeof row>();
  const database = {
    transaction: vi.fn(async <Result>(work: (client: {
      layette: {
        createMany(input: { data: typeof row[] }): Promise<{ count: number }>;
        findMany(input: {
          select: { description: true; layetteId: true; name: true };
          where: { layetteId: { in: string[] } };
        }): Promise<typeof row[]>;
      };
    }) => Promise<Result>) => work({ layette: {
      async createMany({ data }) { for (const item of data) stored.set(item.layetteId, { ...item }); return { count: data.length }; },
      async findMany({ where }) { return where.layetteId.in.flatMap((id) => stored.has(id) ? [{ ...stored.get(id)! }] : []); },
    } })),
  };

  it("accepts exact nonblank scalar fields only", () => {
    expect(parseLayetteImportRows([row])).toEqual([row]);
    expect(() => parseLayetteImportRows([{ ...row, ownerId: "OWNER-1" }])).toThrow();
    expect(() => parseLayetteImportRows([{ ...row, description: "" }])).toThrow();
  });

  it("applies idempotently and refuses drift", async () => {
    stored.clear();
    await expect(applyLayetteImport([row], database)).resolves.toEqual({ changed: 1, unchanged: 0 });
    await expect(applyRegisteredEntityImport("layette", [row], database)).resolves.toEqual({ changed: 0, unchanged: 1 });
    await expect(applyLayetteImport([{ ...row, name: "Changed" }], database))
      .rejects.toThrow("Canonical drift refused for Layette LAYETTE-1");
  });
});

describe("typed Tome import", () => {
  const row = { author: null, title: "Supplied title", tomeId: "TOME-1" };
  const stored = new Map<string, { author: string | null; title: string; tomeId: string }>();
  const database = {
    transaction: vi.fn(async <Result>(work: (client: {
      tome: {
        createMany(input: { data: Array<{ author: string | null; title: string; tomeId: string }> }): Promise<{ count: number }>;
        findMany(input: {
          select: { author: true; title: true; tomeId: true };
          where: { tomeId: { in: string[] } };
        }): Promise<Array<{ author: string | null; title: string; tomeId: string }>>;
      };
    }) => Promise<Result>) => work({ tome: {
      async createMany({ data }) { for (const item of data) stored.set(item.tomeId, { ...item }); return { count: data.length }; },
      async findMany({ where }) { return where.tomeId.in.flatMap((id) => stored.has(id) ? [{ ...stored.get(id)! }] : []); },
    } })),
  };

  it("requires author to be explicitly nonblank or null", () => {
    expect(parseTomeImportRows([row])).toEqual([row]);
    expect(parseTomeImportRows([{ ...row, author: "Supplied author" }])).toEqual([{ ...row, author: "Supplied author" }]);
    expect(() => parseTomeImportRows([{ title: row.title, tomeId: row.tomeId }])).toThrow();
    expect(() => parseTomeImportRows([{ ...row, author: "" }])).toThrow();
  });

  it("applies idempotently and treats null-to-text as drift", async () => {
    stored.clear();
    await expect(applyTomeImport([row], database)).resolves.toEqual({ changed: 1, unchanged: 0 });
    await expect(applyRegisteredEntityImport("tome", [row], database)).resolves.toEqual({ changed: 0, unchanged: 1 });
    await expect(applyTomeImport([{ ...row, author: "Changed" }], database))
      .rejects.toThrow("Canonical drift refused for Tome TOME-1");
  });
});
