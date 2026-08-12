import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = resolve(import.meta.dirname, "../../prisma/migrations/20260812010000_v4_gameplay_foundation/migration.sql");

describe("0.3.0 gameplay foundation migration", () => {
  it("backfills only authored companion relationships and adds append-oriented world authorities", () => {
    const migration = readFileSync(migrationPath, "utf8");
    expect(migration).toContain("ALTER TYPE \"CompanionKey\" ADD VALUE IF NOT EXISTS 'L'");
    expect(migration).toContain('UPDATE "Soul" SET "companionKey" = "Companion"."companionKey"');
    expect(migration).toContain('CREATE TABLE "Occupation"');
    expect(migration).toContain('CREATE TABLE "MoneyTransaction"');
    expect(migration).toContain('MoneyTransaction_reject_update');
    expect(migration).toContain('MoneyTransaction_reject_delete');
    expect(migration).toContain('CREATE TABLE "Soundtrack"');
    expect(migration).toContain('SettlementSoundtrackAssignment_settlementId_category_ordinal_key');
    expect(migration).not.toContain('weeklyWithdrawalRemaining');
    expect(migration).not.toContain('nextLimitIncrease');
  });
});
