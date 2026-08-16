import { randomUUID } from "node:crypto";

import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { handleBulkOperationsAdminRequest } from "../../src/routes/api/admin/bulk-operations";
import { disconnectDatabase, getDatabase } from "../../src/server/database";

const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
if (!new Set(["127.0.0.1", "localhost", "[::1]"]).has(databaseUrl.hostname)) {
  throw new Error("Bulk Operations route integration tests require local PostgreSQL.");
}

const database = getDatabase();
let userId = "";

function request(method: "GET" | "POST", body?: unknown): Request {
  return new Request("http://localhost/api/admin/bulk-operations", {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    method,
  });
}

const authorize = async () => ({ userId });

beforeEach(async () => {
  userId = `bulk-route-${randomUUID()}`;
  await database.user.create({
    data: { eligibilityStatus: "ADULT_18_PLUS", email: `${userId}@example.test`, id: userId, name: "Bulk Route Owner", role: "owner" },
  });
});

afterEach(async () => {
  await database.externalBulkApiSession.deleteMany({ where: { issuedByUserId: userId } });
  await database.user.deleteMany({ where: { id: userId } });
});

afterAll(async () => disconnectDatabase());

describe.sequential("real Bulk Operations route persistence", () => {
  it("generates, reports, revokes, enables keyless, reports, and revokes through the route handler", async () => {
    const keyedResponse = await handleBulkOperationsAdminRequest("POST", request("POST", { action: "generate" }), database, authorize);
    expect(keyedResponse.status).toBe(201);
    const keyed = await keyedResponse.json() as { key: string; sessionId: string };
    expect(keyed.key).toMatch(/^eid_tmp_/);
    await expect(database.externalBulkApiSession.findUniqueOrThrow({ where: { externalBulkApiSessionId: keyed.sessionId } })).resolves.toEqual(expect.objectContaining({
      keyHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      revokedAt: null,
      state: "KEYED",
    }));

    const keyedOverview = await handleBulkOperationsAdminRequest("GET", request("GET"), database, authorize);
    expect(keyedOverview.status).toBe(200);
    await expect(keyedOverview.json()).resolves.toEqual(expect.objectContaining({ state: "KEYED" }));

    const keyedRevoke = await handleBulkOperationsAdminRequest("POST", request("POST", { action: "revoke", sessionId: keyed.sessionId }), database, authorize);
    expect(keyedRevoke.status).toBe(200);
    await expect(database.externalBulkApiSession.findUniqueOrThrow({ where: { externalBulkApiSessionId: keyed.sessionId } })).resolves.toEqual(expect.objectContaining({ state: "OFF", revokedAt: expect.any(Date) }));

    const keylessResponse = await handleBulkOperationsAdminRequest("POST", request("POST", { action: "enable-keyless" }), database, authorize);
    expect(keylessResponse.status).toBe(201);
    const keyless = await keylessResponse.json() as { sessionId: string; state: string };
    expect(keyless.state).toBe("KEYLESS");
    await expect(database.externalBulkApiSession.findUniqueOrThrow({ where: { externalBulkApiSessionId: keyless.sessionId } })).resolves.toEqual(expect.objectContaining({
      keyHash: null,
      revokedAt: null,
      state: "KEYLESS",
    }));

    const keylessOverview = await handleBulkOperationsAdminRequest("GET", request("GET"), database, authorize);
    expect(keylessOverview.status).toBe(200);
    await expect(keylessOverview.json()).resolves.toEqual(expect.objectContaining({ state: "KEYLESS" }));

    const keylessRevoke = await handleBulkOperationsAdminRequest("POST", request("POST", { action: "revoke", sessionId: keyless.sessionId }), database, authorize);
    expect(keylessRevoke.status).toBe(200);
    await expect(database.externalBulkApiSession.findUniqueOrThrow({ where: { externalBulkApiSessionId: keyless.sessionId } })).resolves.toEqual(expect.objectContaining({ state: "OFF", revokedAt: expect.any(Date) }));
  });
});
