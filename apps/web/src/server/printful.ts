import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import { z } from "zod";

import { assertFulfillmentReady } from "../domain/commerce";
import type { PrismaClient } from "../generated/prisma/client";
import { getDatabase } from "./database";
import { getPrintfulEnv } from "./env";

export const printfulRecipientSchema = z.object({
  name: z.string().trim().min(1),
  address1: z.string().trim().min(1),
  address2: z.string().trim().min(1).optional(),
  city: z.string().trim().min(1),
  stateCode: z.string().trim().min(1).optional(),
  countryCode: z.string().regex(/^[A-Z]{2}$/),
  zip: z.string().trim().min(1),
  email: z.string().email().optional(),
}).strict();

export type PrintfulRecipient = z.infer<typeof printfulRecipientSchema>;

export interface PrintfulConfiguredLine {
  orderLineId: string;
  printfulVariantReference: string;
  quantity: number;
  unitPriceCents: number;
}

const printfulResponseSchema = z.object({
  code: z.number().int(),
  result: z.object({ id: z.union([z.number().int(), z.string().min(1)]) }).passthrough(),
}).passthrough();

export function printfulRecipientFromStripe(session: Stripe.Checkout.Session): PrintfulRecipient {
  const shipping = session.collected_information?.shipping_details;
  const address = shipping?.address;
  return printfulRecipientSchema.parse({
    name: shipping?.name,
    address1: address?.line1,
    ...(address?.line2 ? { address2: address.line2 } : {}),
    city: address?.city,
    ...(address?.state ? { stateCode: address.state } : {}),
    countryCode: address?.country,
    zip: address?.postal_code,
    ...(session.customer_details?.email ? { email: session.customer_details.email } : {}),
  });
}

export async function createPrintfulOrder(input: {
  orderId: string;
  recipient: PrintfulRecipient;
  lines: PrintfulConfiguredLine[];
}, options: {
  apiToken?: string;
  storeId?: string;
  fetcher?: typeof fetch;
} = {}): Promise<string> {
  const configured = options.apiToken ? { PRINTFUL_API_TOKEN: options.apiToken, PRINTFUL_STORE_ID: options.storeId } : getPrintfulEnv();
  const recipient = printfulRecipientSchema.parse(input.recipient);
  if (input.lines.length === 0) throw new Error("Printful fulfillment requires at least one configured order line.");
  const items = input.lines.map((line) => {
    if (!line.printfulVariantReference.trim()) throw new Error("Printful fulfillment requires configured StoreVariant references.");
    if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0) throw new Error("Printful fulfillment quantity is invalid.");
    if (!Number.isSafeInteger(line.unitPriceCents) || line.unitPriceCents <= 0) throw new Error("Printful retail price is invalid.");
    return {
      external_id: line.orderLineId,
      external_variant_id: line.printfulVariantReference,
      quantity: line.quantity,
      retail_price: (line.unitPriceCents / 100).toFixed(2),
    };
  });
  const response = await (options.fetcher ?? fetch)("https://api.printful.com/orders?confirm=true&update_existing=true", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${configured.PRINTFUL_API_TOKEN}`,
      "Content-Type": "application/json",
      ...(configured.PRINTFUL_STORE_ID ? { "X-PF-Store-Id": configured.PRINTFUL_STORE_ID } : {}),
    },
    body: JSON.stringify({
      external_id: input.orderId,
      recipient: {
        name: recipient.name,
        address1: recipient.address1,
        ...(recipient.address2 ? { address2: recipient.address2 } : {}),
        city: recipient.city,
        ...(recipient.stateCode ? { state_code: recipient.stateCode } : {}),
        country_code: recipient.countryCode,
        zip: recipient.zip,
        ...(recipient.email ? { email: recipient.email } : {}),
      },
      items,
    }),
  });
  if (!response.ok) throw new Error(`Printful order submission failed with HTTP ${response.status}.`);
  return String(printfulResponseSchema.parse(await response.json()).result.id);
}

export async function submitPrintfulFulfillment(input: {
  orderPaymentConfirmationId: string;
  recipient: PrintfulRecipient;
}, database: PrismaClient = getDatabase()): Promise<{ providerOrderReference: string; status: "submitted" | "duplicate" }> {
  const confirmation = await database.orderPaymentConfirmation.findUnique({
    where: { orderPaymentConfirmationId: input.orderPaymentConfirmationId },
    include: {
      fulfillment: true,
      order: { include: { lines: { include: { storeVariant: true }, orderBy: { orderLineId: "asc" } } } },
    },
  });
  assertFulfillmentReady({ orderPaymentConfirmationId: confirmation?.orderPaymentConfirmationId });
  if (!confirmation) throw new Error("Printful fulfillment payment confirmation was not found.");
  if (confirmation.fulfillment) {
    return { providerOrderReference: confirmation.fulfillment.providerOrderReference, status: "duplicate" };
  }
  const providerOrderReference = await createPrintfulOrder({
    orderId: confirmation.orderId,
    recipient: input.recipient,
    lines: confirmation.order.lines.map((line) => ({
      orderLineId: line.orderLineId,
      printfulVariantReference: line.storeVariant.printfulVariantReference,
      quantity: line.quantity,
      unitPriceCents: line.unitPriceCents,
    })),
  });
  await database.printfulFulfillmentSubmission.create({
    data: {
      printfulFulfillmentSubmissionId: randomUUID(),
      orderPaymentConfirmationId: confirmation.orderPaymentConfirmationId,
      providerOrderReference,
    },
  });
  return { providerOrderReference, status: "submitted" };
}
