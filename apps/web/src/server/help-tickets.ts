import { createHash, randomUUID } from "node:crypto";

import { z } from "zod";

import type { Prisma, PrismaClient } from "../generated/prisma/client";
import type { HelpTicketChannel } from "../generated/prisma/enums";
import { getDatabase } from "./database";

type Database = PrismaClient;
type Transaction = Parameters<Parameters<Database["$transaction"]>[0]>[0];

export const playerSupportCategories = ["ACCOUNT_ACCESS", "GAMEPLAY", "TECHNICAL", "OTHER"] as const;
export const storeSupportCategories = [
  "PRODUCTION_DEFECT_REPLACEMENT",
  "DAMAGED_SHIPMENT",
  "WRONG_ADDRESS",
  "BUYER_REMORSE",
  "LOST_PACKAGE",
  "CANCELLATION_BEFORE_OR_AFTER_FULFILLMENT",
] as const;

const attachmentSchema = z.object({
  base64: z.string().min(1),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf", "text/plain"]),
}).strict();

export const helpTicketCreateSchema = z.object({
  attachments: z.array(attachmentSchema).max(3).default([]),
  categoryKey: z.string().trim().min(1),
  message: z.string().trim().min(1).max(10_000),
  orderId: z.string().trim().min(1).optional(),
  subject: z.string().trim().min(1).max(200),
}).strict();

export const helpTicketReplySchema = z.object({
  attachments: z.array(attachmentSchema).max(3).default([]),
  message: z.string().trim().min(1).max(10_000),
}).strict();

function categoryAllowed(channel: HelpTicketChannel, categoryKey: string): boolean {
  if (channel === "PLAYER") return (playerSupportCategories as readonly string[]).includes(categoryKey);
  if (channel === "RETURN") return categoryKey === "RETURN_REQUEST";
  return (storeSupportCategories as readonly string[]).includes(categoryKey);
}

function attachmentData(input: z.infer<typeof attachmentSchema>) {
  const content = Buffer.from(input.base64, "base64");
  if (content.length < 1 || content.length > 5 * 1024 * 1024) throw new Error("Each attachment must be between 1 byte and 5 MiB.");
  if (content.toString("base64").replace(/=+$/, "") !== input.base64.replace(/=+$/, "")) throw new Error("Attachment encoding is invalid.");
  return {
    byteSize: content.length,
    content,
    fileName: input.fileName,
    helpTicketAttachmentId: randomUUID(),
    mimeType: input.mimeType,
    sha256: createHash("sha256").update(content).digest("hex"),
  };
}

const ticketSelection = {
  categoryKey: true,
  channel: true,
  createdAt: true,
  helpTicketId: true,
  messages: {
    orderBy: [{ createdAt: "asc" }, { helpTicketMessageId: "asc" }],
    select: {
      attachments: { orderBy: { fileName: "asc" }, select: { byteSize: true, fileName: true, helpTicketAttachmentId: true, mimeType: true } },
      authorKind: true,
      createdAt: true,
      helpTicketMessageId: true,
      message: true,
    },
  },
  orderId: true,
  status: true,
  subject: true,
  updatedAt: true,
} satisfies Prisma.HelpTicketSelect;

export async function listHelpTickets(userId: string, database: Database = getDatabase()) {
  return database.helpTicket.findMany({
    where: { userId },
    orderBy: [{ updatedAt: "desc" }, { helpTicketId: "asc" }],
    select: ticketSelection,
  });
}

export async function getHelpTicket(helpTicketId: string, userId: string, database: Database = getDatabase()) {
  return database.helpTicket.findFirst({ where: { helpTicketId, userId }, select: ticketSelection });
}

async function assertOwnedOrder(transaction: Transaction, orderId: string | undefined, userId: string | null) {
  if (!orderId) return null;
  const order = await transaction.order.findFirst({
    where: userId ? { orderId, userId } : { orderId },
    select: { contactEmail: true, orderId: true, returnEligibility: { select: { eligibleAt: true } } },
  });
  if (!order) throw new Error("The selected order is not available to this account.");
  return order;
}

export async function createHelpTicket(input: {
  channel: HelpTicketChannel;
  contactEmail: string;
  request: z.infer<typeof helpTicketCreateSchema>;
  userId: string | null;
}, database: Database = getDatabase()) {
  if (!categoryAllowed(input.channel, input.request.categoryKey)) throw new Error("Support category is not allowed for this workflow.");
  return database.$transaction(async (transaction) => {
    const order = await assertOwnedOrder(transaction, input.request.orderId, input.userId);
    if ((input.channel === "STORE" || input.channel === "RETURN") && !order) throw new Error("Order support requires an authorized order.");
    if (input.channel === "RETURN" && !order?.returnEligibility) throw new Error("This order has no authoritative return eligibility.");
    const helpTicketId = randomUUID();
    const helpTicketMessageId = randomUUID();
    const ticket = await transaction.helpTicket.create({
      data: {
        categoryKey: input.request.categoryKey,
        channel: input.channel,
        contactEmail: input.contactEmail.trim().toLowerCase(),
        helpTicketId,
        orderId: order?.orderId,
        status: "OPEN",
        subject: input.request.subject,
        userId: input.userId,
        messages: { create: {
          attachments: { create: input.request.attachments.map(attachmentData) },
          authorKind: input.userId ? "ACCOUNT" : "GUEST",
          authorUserId: input.userId,
          helpTicketMessageId,
          message: input.request.message,
        } },
      },
      select: ticketSelection,
    });
    if (input.channel === "RETURN") {
      await transaction.orderReturnRequest.create({
        data: { helpTicketId, orderId: order!.orderId, orderReturnRequestId: randomUUID() },
      });
    }
    return ticket;
  });
}

export async function replyToHelpTicket(input: {
  helpTicketId: string;
  request: z.infer<typeof helpTicketReplySchema>;
  userId: string;
}, database: Database = getDatabase()) {
  return database.$transaction(async (transaction) => {
    const ticket = await transaction.helpTicket.findFirst({ where: { helpTicketId: input.helpTicketId, userId: input.userId } });
    if (!ticket) throw new Error("Help Ticket was not found.");
    if (ticket.status !== "OPEN") throw new Error("Resolved Help Tickets cannot receive account replies.");
    await transaction.helpTicketMessage.create({
      data: {
        attachments: { create: input.request.attachments.map(attachmentData) },
        authorKind: "ACCOUNT",
        authorUserId: input.userId,
        helpTicketId: ticket.helpTicketId,
        helpTicketMessageId: randomUUID(),
        message: input.request.message,
      },
    });
    await transaction.helpTicket.update({ where: { helpTicketId: ticket.helpTicketId }, data: { updatedAt: new Date() } });
    return transaction.helpTicket.findUniqueOrThrow({ where: { helpTicketId: ticket.helpTicketId }, select: ticketSelection });
  });
}
