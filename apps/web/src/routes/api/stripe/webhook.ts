import { createFileRoute } from "@tanstack/react-router";
import type Stripe from "stripe";

import { processSignedStripeWebhook } from "../../../domain/commerce";
import { confirmDonationCheckout } from "../../../server/donations";
import { getDatabase } from "../../../server/database";
import { verifyStripeWebhookEvent } from "../../../server/payments";
import { printfulRecipientFromStripe, submitPrintfulFulfillment } from "../../../server/printful";
import { confirmStoreCheckout } from "../../../server/storefront";
import { processSubscriptionStripeEvent } from "../../../server/subscriptions";

export const Route = createFileRoute("/api/stripe/webhook")({
  server: { handlers: { POST: async ({ request }) => {
    const rawBody = new Uint8Array(await request.arrayBuffer());
    const signature = request.headers.get("stripe-signature");
    try {
      let verifiedEvent: ReturnType<typeof verifyStripeWebhookEvent> | undefined;
      const result = await processSignedStripeWebhook({
        database: getDatabase(), processedAt: new Date(), rawBody, signature, verify: (bytes, value) => {
          verifiedEvent = verifyStripeWebhookEvent(bytes, value);
          return verifiedEvent;
        },
        process: async ({ event }, transaction) => {
          await processSubscriptionStripeEvent(event, transaction);
          if (event.type !== "checkout.session.completed") return;
          const session = event.data.object as Stripe.Checkout.Session;
          const donationCheckoutId = session.metadata?.donationCheckoutId;
          if (donationCheckoutId && session.payment_status === "paid") await confirmDonationCheckout({ amountTotal: session.amount_total, checkoutReference: session.id, donationCheckoutId }, transaction);
          const orderId = session.metadata?.orderId;
          if (orderId && session.payment_status === "paid") await confirmStoreCheckout({ amountTotal: session.amount_total, checkoutReference: session.id, orderId, shippingSummary: session.collected_information?.shipping_details ?? undefined, stripeWebhookEventId: event.id }, transaction);
        },
      });
      const event = verifiedEvent?.event;
      if (event?.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId = session.metadata?.orderId;
        if (orderId && session.payment_status === "paid") {
          const confirmation = await getDatabase().orderPaymentConfirmation.findUnique({ where: { stripeWebhookEventId: event.id } });
          if (!confirmation) throw new Error("Confirmed Store order is missing payment evidence.");
          await submitPrintfulFulfillment({
            orderPaymentConfirmationId: confirmation.orderPaymentConfirmationId,
            recipient: printfulRecipientFromStripe(session),
          });
        }
      }
      return Response.json({ result });
    } catch { return Response.json({ error: "Stripe webhook verification or processing failed." }, { status: 400 }); }
  } } },
});
