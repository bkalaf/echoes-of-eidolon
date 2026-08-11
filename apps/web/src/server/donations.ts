import { randomUUID } from "node:crypto";
import { z } from "zod";

import { donationMonths, planMembershipGrant, projectMembershipEntitlement } from "../domain/membership";
import type { PrismaClient } from "../generated/prisma/client";
import { getDatabase } from "./database";
import { getPayments } from "./payments";

type Database = PrismaClient;

export const donationCheckoutInputSchema = z.object({ amountCents: z.int().min(1_000).max(10_000) }).strict();

export async function createDonationCheckout(input: { amountCents: number; email: string; userId: string }, database: Database = getDatabase()) {
  const donationCheckoutId = randomUUID();
  const monthsGranted = donationMonths(input.amountCents);
  await database.donationCheckout.create({ data: { amountCents: input.amountCents, donationCheckoutId, monthsGranted, userId: input.userId } });
  try {
    const baseUrl = process.env.BETTER_AUTH_URL;
    if (!baseUrl) throw new Error("BETTER_AUTH_URL is required for donation checkout.");
    const checkout = await getPayments().checkout.sessions.create({
      cancel_url: `${baseUrl}/donate/checkout?state=cancelled`,
      customer_email: input.email,
      line_items: [{ price_data: { currency: "usd", product_data: { name: "Echoes of Eidolon donation" }, unit_amount: input.amountCents }, quantity: 1 }],
      metadata: { donationCheckoutId },
      mode: "payment",
      success_url: `${baseUrl}/donate/checkout?state=confirmed`,
    });
    if (!checkout.url) throw new Error("Stripe did not return a hosted checkout URL.");
    await database.donationCheckout.update({ where: { donationCheckoutId }, data: { stripeCheckoutReference: checkout.id } });
    return { checkoutUrl: checkout.url, donationCheckoutId, monthsGranted };
  } catch (error) {
    await database.donationCheckout.update({ where: { donationCheckoutId }, data: { status: "FAILED" } });
    throw error;
  }
}

export async function confirmDonationCheckout(input: { amountTotal: number | null; checkoutReference: string; donationCheckoutId: string }, transaction: Parameters<Parameters<Database["$transaction"]>[0]>[0]) {
  const checkout = await transaction.donationCheckout.findUnique({ where: { donationCheckoutId: input.donationCheckoutId } });
  if (!checkout || checkout.status === "CONFIRMED") return;
  if (checkout.status !== "PENDING" || checkout.stripeCheckoutReference !== input.checkoutReference || checkout.amountCents !== input.amountTotal) throw new Error("Donation checkout confirmation does not match the pending server record.");
  const grants = await transaction.membershipGrant.findMany({ where: { userId: checkout.userId }, include: { revocations: { select: { effectiveEndAfter: true } } } });
  const now = new Date();
  const current = projectMembershipEntitlement(grants, now);
  const anchor = grants.find((grant) => grant.effectiveEndAt.getTime() === current.effectiveEndAt?.getTime())?.anchorDay;
  const window = planMembershipGrant(now, checkout.monthsGranted, current.effectiveEndAt, anchor);
  await transaction.membershipGrant.create({ data: { ...window, amountCents: checkout.amountCents, membershipGrantId: randomUUID(), source: "DONATION", sourceReference: input.checkoutReference, userId: checkout.userId } });
  await transaction.donationCheckout.update({ where: { donationCheckoutId: checkout.donationCheckoutId }, data: { confirmedAt: now, status: "CONFIRMED" } });
}
