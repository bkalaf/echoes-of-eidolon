import { randomUUID } from "node:crypto";
import { z } from "zod";

import type { PrismaClient } from "../generated/prisma/client";
import { contactTopicSchema } from "../domain/contact";
import { getDatabase } from "./database";
import { sendCompanyContact } from "./email";

type Database = PrismaClient;

export const companyContactInputSchema = z.object({
  message: z.string().trim().min(10).max(10_000),
  replyEmail: z.email().max(320),
  topic: contactTopicSchema,
}).strict();

export interface CompanyContactReceipt {
  contactRequestId: string;
  delivery: "delivered" | "pending-configuration" | "delivery-failed";
  received: true;
}

export async function submitCompanyContact(
  input: z.infer<typeof companyContactInputSchema>,
  database: Database = getDatabase(),
): Promise<CompanyContactReceipt> {
  const contactRequestId = randomUUID();
  const recipient = process.env.COMPANY_CONTACT_RECIPIENT_ADDRESS;
  await database.contactRequest.create({
    data: {
      contactRequestId,
      message: input.message,
      replyEmail: input.replyEmail.toLowerCase(),
      status: recipient ? "DELIVERY_PENDING" : "RECEIVED",
      topic: input.topic,
    },
  });
  if (!recipient) return { contactRequestId, delivery: "pending-configuration", received: true };

  try {
    const providerReference = await sendCompanyContact({ ...input, recipient });
    await database.contactRequest.update({
      where: { contactRequestId },
      data: { deliveredAt: new Date(), providerReference, status: "DELIVERED" },
    });
    return { contactRequestId, delivery: "delivered", received: true };
  } catch (error) {
    await database.contactRequest.update({
      where: { contactRequestId },
      data: { failureReason: error instanceof Error ? error.message.slice(0, 500) : "Delivery failed", status: "DELIVERY_FAILED" },
    });
    return { contactRequestId, delivery: "delivery-failed", received: true };
  }
}
