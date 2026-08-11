import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { authenticateExternalBulkApi, externalBulkApiOverview, generateExternalBulkApiKey, revokeExternalBulkApiKey } from "../../src/server/bulk-operations";

describe("temporary external bulk API authority", () => {
  it("issues one 30-minute plaintext-once key while persisting only its hash", async () => {
    const updateMany = vi.fn(async () => ({ count: 0 }));
    const create = vi.fn(async () => undefined);
    const transaction = { externalBulkApiSession: { create, updateMany } };
    const database = { $transaction: vi.fn((work: (value: typeof transaction) => Promise<unknown>) => work(transaction)) };
    const now = new Date("2026-08-10T12:00:00.000Z");
    const result = await generateExternalBulkApiKey("owner-1", database as never, now);
    expect(result.key).toMatch(/^eid_tmp_[A-Za-z0-9_-]+$/);
    expect(result.expiresAt.toISOString()).toBe("2026-08-10T12:30:00.000Z");
    expect(updateMany).toHaveBeenCalledWith({ data: { revokedAt: now, state: "OFF" }, where: { revokedAt: null, state: "ON" } });
    const stored = create.mock.calls[0]![0].data;
    expect(stored).not.toHaveProperty("key");
    expect(stored.keyHash).toBe(createHash("sha256").update(result.key).digest("hex"));
  });

  it("authenticates only an active unexpired bearer key", async () => {
    const key = "eid_tmp_authoritative";
    const session = { expiresAt: new Date("2026-08-10T12:30:00.000Z"), externalBulkApiSessionId: "session-1", issuedByUserId: "owner-1", revokedAt: null, state: "ON" };
    const findUnique = vi.fn(async () => session);
    const request = new Request("https://example.test/api/external/data/soul", { headers: { authorization: `Bearer ${key}` } });
    await expect(authenticateExternalBulkApi(request, { externalBulkApiSession: { findUnique } } as never, new Date("2026-08-10T12:10:00.000Z"))).resolves.toEqual({ externalBulkApiSessionId: "session-1", issuedByUserId: "owner-1" });
    expect(findUnique).toHaveBeenCalledWith({ where: { keyHash: createHash("sha256").update(key).digest("hex") } });
    await expect(authenticateExternalBulkApi(new Request(request.url), { externalBulkApiSession: { findUnique } } as never)).rejects.toMatchObject({ status: 401 });
  });

  it("revokes exactly one active session and derives OFF when none is active", async () => {
    const updateMany = vi.fn(async () => ({ count: 1 }));
    await expect(revokeExternalBulkApiKey("session-1", { externalBulkApiSession: { updateMany } } as never, new Date("2026-08-10T12:10:00.000Z"))).resolves.toBeUndefined();
    const database = {
      bulkOperationAudit: { findMany: vi.fn(async () => []) },
      externalBulkApiSession: { findFirst: vi.fn(async () => null) },
    };
    await expect(externalBulkApiOverview(database as never)).resolves.toMatchObject({ activeSession: null, audits: [], maximumLifetimeMinutes: 30, state: "OFF" });
  });
});
