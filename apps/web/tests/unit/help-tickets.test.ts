import { describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "../../src/generated/prisma/client";
import { createHelpTicket, getHelpTicket } from "../../src/server/help-tickets";

function databaseFor(transaction: Record<string, unknown>) {
  return {
    $transaction: vi.fn(async (work) => work(transaction)),
    helpTicket: { findFirst: vi.fn() },
  } as unknown as PrismaClient;
}

function transaction() {
  return {
    helpTicket: { create: vi.fn().mockResolvedValue({ helpTicketId: "TICKET-1" }) },
    order: { findFirst: vi.fn() },
    orderReturnRequest: { create: vi.fn() },
  };
}

const request = { attachments: [], categoryKey: "GAMEPLAY", message: "I need help.", subject: "Gameplay question" };

describe("first-party Help Ticket owner", () => {
  it("persists an account ticket, ordered message owner, and bounded attachment metadata", async () => {
    const tx = transaction();
    await expect(createHelpTicket({
      channel: "PLAYER",
      contactEmail: " Player@Example.Test ",
      request: { ...request, attachments: [{ base64: Buffer.from("evidence").toString("base64"), fileName: "evidence.txt", mimeType: "text/plain" }] },
      userId: "USER-1",
    }, databaseFor(tx))).resolves.toEqual({ helpTicketId: "TICKET-1" });

    expect(tx.helpTicket.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      categoryKey: "GAMEPLAY",
      channel: "PLAYER",
      contactEmail: "player@example.test",
      status: "OPEN",
      userId: "USER-1",
      messages: { create: expect.objectContaining({ attachments: { create: [expect.objectContaining({ byteSize: 8, mimeType: "text/plain", sha256: expect.stringMatching(/^[a-f0-9]{64}$/) })] }, authorKind: "ACCOUNT" }) },
    }), select: expect.any(Object) });
  });

  it("enforces account ownership for ticket detail and order-linked intake", async () => {
    const database = databaseFor(transaction());
    await getHelpTicket("TICKET-OTHER", "USER-1", database);
    expect(database.helpTicket.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { helpTicketId: "TICKET-OTHER", userId: "USER-1" } }));

    const tx = transaction();
    tx.order.findFirst.mockResolvedValue(null);
    await expect(createHelpTicket({ channel: "STORE", contactEmail: "player@example.test", request: { ...request, categoryKey: "DAMAGED_SHIPMENT", orderId: "ORDER-OTHER" }, userId: "USER-1" }, databaseFor(tx))).rejects.toThrow(/not available to this account/);
    expect(tx.helpTicket.create).not.toHaveBeenCalled();
  });

  it("rejects oversized attachments before persistence", async () => {
    const tx = transaction();
    await expect(createHelpTicket({
      channel: "PLAYER",
      contactEmail: "player@example.test",
      request: { ...request, attachments: [{ base64: Buffer.alloc(5 * 1024 * 1024 + 1).toString("base64"), fileName: "huge.txt", mimeType: "text/plain" }] },
      userId: "USER-1",
    }, databaseFor(tx))).rejects.toThrow(/5 MiB/);
    expect(tx.helpTicket.create).not.toHaveBeenCalled();
  });

  it("persists an eligible return intake without issuing a refund or mutating fulfillment", async () => {
    const tx = transaction();
    tx.order.findFirst.mockResolvedValue({ contactEmail: "player@example.test", orderId: "ORDER-1", returnEligibility: { eligibleAt: new Date() } });
    await createHelpTicket({
      channel: "RETURN",
      contactEmail: "player@example.test",
      request: { ...request, categoryKey: "RETURN_REQUEST", orderId: "ORDER-1" },
      userId: "USER-1",
    }, databaseFor(tx));

    expect(tx.orderReturnRequest.create).toHaveBeenCalledWith({ data: expect.objectContaining({ helpTicketId: expect.any(String), orderId: "ORDER-1" }) });
    expect(tx).not.toHaveProperty("orderRefund");
    expect(tx).not.toHaveProperty("printfulFulfillmentSubmission");
  });
});
