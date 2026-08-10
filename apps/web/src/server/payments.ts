import Stripe from "stripe";

import { getPaymentsEnv } from "./env";

let client: Stripe | undefined;

export function getPayments(): Stripe {
  client ??= new Stripe(getPaymentsEnv().STRIPE_SECRET_KEY, {
    appInfo: { name: "Echoes of Eidolon" },
  });
  return client;
}

export function getStripeWebhookSecret(): string {
  return getPaymentsEnv().STRIPE_WEBHOOK_SECRET;
}
