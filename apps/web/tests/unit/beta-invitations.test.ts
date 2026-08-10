import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../../src/generated/prisma/client";

const emailMocks = vi.hoisted(() => ({ sendBetaInvitation: vi.fn() }));

vi.mock("../../src/server/email", () => ({
  sendBetaInvitation: emailMocks.sendBetaInvitation,
}));

import {
  approveBetaInviteRequest,
  betaInvitationRedemptionInputSchema,
  betaInviteRequestInputSchema,
  hashBetaInvitationCode,
  redeemBetaInvitation,
} from "../../src/server/beta-invitations";

describe("beta invitation boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    emailMocks.sendBetaInvitation.mockResolvedValue(undefined);
  });

  it("requires supplied invitation fields without inventing maximum lengths", () => {
    const longText = "x".repeat(10_000);
    expect(betaInviteRequestInputSchema.parse({
      email: "friend@example.com",
      friendName: longText,
      reason: longText,
    })).toEqual({ email: "friend@example.com", friendName: longText, reason: longText });
    expect(betaInvitationRedemptionInputSchema.parse({ code: longText })).toEqual({ code: longText });
    expect(betaInviteRequestInputSchema.safeParse({ email: "friend@example.com", friendName: "", reason: "reason" }).success).toBe(false);
  });

  it("hashes bearer codes with SHA-256 instead of persisting plaintext", () => {
    const hash = hashBetaInvitationCode("plaintext-code");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain("plaintext-code");
    expect(hash).toBe(hashBetaInvitationCode("plaintext-code"));
  });

  it("requires an administrator-supplied future expiry and sends plaintext only by email", async () => {
    const upsert = vi.fn().mockResolvedValue({});
    const claim = vi.fn().mockResolvedValue({ count: 1 });
    const finish = vi.fn().mockResolvedValue({ count: 1 });
    const transaction = {
      betaInvitationCode: { upsert },
      betaInviteRequest: {
        findUnique: vi.fn().mockResolvedValue({ id: "request-1", email: "friend@example.com", status: "APPROVED" }),
        updateMany: claim,
      },
    };
    const database = {
      betaInviteRequest: { updateMany: finish },
      betaInvitationCode: { update: vi.fn() },
      $transaction: vi.fn(async (work: unknown) => typeof work === "function"
        ? (work as (value: typeof transaction) => Promise<unknown>)(transaction)
        : Promise.all(work as Promise<unknown>[])),
    } as unknown as PrismaClient;
    const expiresAt = new Date(Date.now() + 60_000);

    await approveBetaInviteRequest({ expiresAt, requestId: "request-1" }, database);

    const persisted = upsert.mock.calls[0]![0].create as { codeHash: string; expiresAt: Date };
    const emailed = emailMocks.sendBetaInvitation.mock.calls[0]![0] as { code: string; expiresAt: Date };
    expect(persisted.codeHash).toBe(hashBetaInvitationCode(emailed.code));
    expect(persisted).not.toHaveProperty("code");
    expect(emailed.expiresAt).toEqual(expiresAt);
    expect(claim).toHaveBeenCalledWith({ where: { id: "request-1", status: "PENDING" }, data: { status: "APPROVED" } });
    expect(finish).toHaveBeenCalledWith({ where: { id: "request-1", status: "APPROVED" }, data: { status: "INVITED" } });
  });

  it("revokes the code and returns the request to pending when email delivery fails", async () => {
    emailMocks.sendBetaInvitation.mockRejectedValue(new Error("delivery failed"));
    const invitationUpdate = vi.fn().mockResolvedValue({ count: 1 });
    const requestUpdate = vi.fn().mockResolvedValue({ count: 1 });
    const transaction = {
      betaInvitationCode: { upsert: vi.fn().mockResolvedValue({}), updateMany: invitationUpdate },
      betaInviteRequest: {
        findUnique: vi.fn().mockResolvedValue({ id: "request-1", email: "friend@example.com", status: "APPROVED" }),
        updateMany: requestUpdate,
      },
    };
    const database = {
      betaInviteRequest: { updateMany: vi.fn() },
      $transaction: vi.fn(async (work: unknown) => typeof work === "function"
        ? (work as (value: typeof transaction) => Promise<unknown>)(transaction)
        : Promise.all(work as Promise<unknown>[])),
    } as unknown as PrismaClient;

    await expect(approveBetaInviteRequest({
      expiresAt: new Date(Date.now() + 60_000),
      requestId: "request-1",
    }, database)).rejects.toThrow("delivery failed");

    expect(invitationUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { revokedAt: expect.any(Date) }, where: expect.objectContaining({ codeHash: expect.any(String) }) }));
    expect(requestUpdate).toHaveBeenCalledWith({ where: { id: "request-1", status: "APPROVED" }, data: { status: "PENDING" } });
  });

  it("allows only one caller to claim a pending request for approval", async () => {
    const transaction = {
      betaInvitationCode: { upsert: vi.fn() },
      betaInviteRequest: {
        findUnique: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const database = {
      $transaction: vi.fn((work: (value: typeof transaction) => Promise<unknown>) => work(transaction)),
    } as unknown as PrismaClient;

    await expect(approveBetaInviteRequest({
      expiresAt: new Date(Date.now() + 60_000),
      requestId: "request-1",
    }, database)).rejects.toThrow(/pending invitation request/);

    expect(transaction.betaInvitationCode.upsert).not.toHaveBeenCalled();
    expect(emailMocks.sendBetaInvitation).not.toHaveBeenCalled();
  });

  it("atomically consumes a matching code and grants only beta access", async () => {
    const code = "single-use-code";
    const codeUpdate = vi.fn().mockResolvedValue({ count: 1 });
    const userUpdate = vi.fn().mockResolvedValue({});
    const transaction = {
      betaInvitationCode: {
        findUnique: vi.fn().mockResolvedValue({
          id: "invite-1",
          recipientEmail: "friend@example.com",
          expiresAt: new Date(Date.now() + 60_000),
          revokedAt: null,
          consumedAt: null,
          request: { status: "INVITED" },
        }),
        updateMany: codeUpdate,
      },
      user: { update: userUpdate },
    };
    const database = {
      $transaction: vi.fn((work: (value: typeof transaction) => Promise<unknown>) => work(transaction)),
    } as unknown as PrismaClient;

    await redeemBetaInvitation({ code, email: "friend@example.com", userId: "user-1" }, database);

    expect(transaction.betaInvitationCode.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { codeHash: hashBetaInvitationCode(code) },
    }));
    expect(codeUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ consumedByUserId: "user-1" }) }));
    expect(userUpdate).toHaveBeenCalledWith({ where: { id: "user-1" }, data: { betaEligible: true } });
    expect(userUpdate.mock.calls[0]![0].data).not.toHaveProperty("role");
  });

  it("rejects a code presented by a different account email", async () => {
    const userUpdate = vi.fn();
    const transaction = {
      betaInvitationCode: {
        findUnique: vi.fn().mockResolvedValue({
          id: "invite-1",
          recipientEmail: "recipient@example.com",
          expiresAt: new Date(Date.now() + 60_000),
          revokedAt: null,
          consumedAt: null,
          request: { status: "INVITED" },
        }),
        updateMany: vi.fn(),
      },
      user: { update: userUpdate },
    };
    const database = {
      $transaction: vi.fn((work: (value: typeof transaction) => Promise<unknown>) => work(transaction)),
    } as unknown as PrismaClient;

    await expect(redeemBetaInvitation({
      code: "code",
      email: "other@example.com",
      userId: "user-1",
    }, database)).rejects.toThrow(/belongs to another account/);
    expect(userUpdate).not.toHaveBeenCalled();
  });
});
