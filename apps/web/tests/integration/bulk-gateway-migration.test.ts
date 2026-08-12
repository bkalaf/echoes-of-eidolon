import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("bulk gateway persistence migration", () => {
  it("persists inactivity, hashed-key modes, receive order, and review state", () => {
    const migration = readFileSync(resolve(import.meta.dirname, "../../prisma/migrations/20260812020000_ordered_bulk_gateway/migration.sql"), "utf8");
    expect(migration).toContain("ALTER TYPE \"ExternalBulkApiState\" RENAME VALUE 'ON' TO 'KEYED'");
    expect(migration).toContain("ADD VALUE IF NOT EXISTS 'KEYLESS'");
    expect(migration).toContain('ALTER COLUMN "keyHash" DROP NOT NULL');
    expect(migration).toContain('CREATE TABLE "BulkMutationEnvelope"');
    expect(migration).toContain('"sequence" BIGSERIAL NOT NULL');
    expect(migration).toContain('BulkMutationEnvelope_sequence_key');
    expect(migration).toContain('ADD COLUMN "lastActivityAt" TIMESTAMP(3)');
    expect(migration).toContain('ALTER COLUMN "lastActivityAt" SET NOT NULL');
    expect(migration).not.toContain('plaintext');
  });
});
