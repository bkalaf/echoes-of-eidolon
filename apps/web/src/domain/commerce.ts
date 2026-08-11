import { createHash } from "node:crypto";

export interface ConfiguredStoreVariant {
  storeVariantId: string;
  priceCents: number;
  available: boolean;
  stripePriceReference: string;
  printfulVariantReference: string;
}

export interface CheckoutLineRequest {
  storeVariantId: string;
  quantity: number;
}

export interface AuthoritativeCheckoutLine extends CheckoutLineRequest {
  unitPriceCents: number;
  stripePriceReference: string;
  printfulVariantReference: string;
}

export function resolveAuthoritativeCheckoutLine(
  request: CheckoutLineRequest,
  variants: readonly ConfiguredStoreVariant[],
): AuthoritativeCheckoutLine {
  if (!Number.isSafeInteger(request.quantity) || request.quantity <= 0) throw new Error("Order quantity must be a positive integer.");
  const variant = variants.find((candidate) => candidate.storeVariantId === request.storeVariantId);
  if (!variant || !variant.available) throw new Error("Configured merchandise variant is unavailable.");
  if (!Number.isSafeInteger(variant.priceCents) || variant.priceCents <= 0) throw new Error("Configured merchandise price is invalid.");
  return {
    storeVariantId: variant.storeVariantId,
    quantity: request.quantity,
    unitPriceCents: variant.priceCents,
    stripePriceReference: variant.stripePriceReference,
    printfulVariantReference: variant.printfulVariantReference,
  };
}

export function assertFulfillmentReady(input: { orderPaymentConfirmationId?: string | null }): string {
  if (!input.orderPaymentConfirmationId) throw new Error("Printful fulfillment requires server-confirmed Stripe payment.");
  return input.orderPaymentConfirmationId;
}

export interface VerifiedStripeEvent {
  stripeWebhookEventId: string;
  eventType: string;
}

interface StripeWebhookTransaction {
  stripeWebhookEvent: {
    findUnique(input: { where: { stripeWebhookEventId: string } }): Promise<unknown>;
    create(input: { data: { stripeWebhookEventId: string; eventType: string; payloadSha256: string; processedAt: Date } }): Promise<unknown>;
  };
}

interface StripeWebhookDatabase<Transaction extends StripeWebhookTransaction> {
  $transaction<Result>(work: (transaction: Transaction) => Promise<Result>): Promise<Result>;
}

export async function processSignedStripeWebhook<Event extends VerifiedStripeEvent, Transaction extends StripeWebhookTransaction>(input: {
  rawBody: Uint8Array;
  signature: string | null;
  verify: (rawBody: Uint8Array, signature: string) => Event;
  database: StripeWebhookDatabase<Transaction>;
  process: (event: Event, transaction: Transaction) => Promise<void>;
  processedAt: Date;
}): Promise<"processed" | "duplicate"> {
  if (!input.signature) throw new Error("Stripe webhook signature is required.");
  const event = input.verify(input.rawBody, input.signature);
  const payloadSha256 = createHash("sha256").update(input.rawBody).digest("hex");
  return input.database.$transaction(async (transaction) => {
    if (await transaction.stripeWebhookEvent.findUnique({ where: { stripeWebhookEventId: event.stripeWebhookEventId } })) {
      return "duplicate";
    }
    await transaction.stripeWebhookEvent.create({
      data: { ...event, payloadSha256, processedAt: input.processedAt },
    });
    await input.process(event, transaction);
    return "processed";
  });
}
