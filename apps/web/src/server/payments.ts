import Stripe from "stripe";

import { getRuntimeEnv } from "./env";

let client: Stripe | undefined;

export function getPayments(): Stripe {
  client ??= new Stripe(getRuntimeEnv().STRIPE_SECRET_KEY, {
    appInfo: { name: "Echoes of Eidolon" },
  });
  return client;
}

export function getStripeWebhookSecret(): string {
  return getRuntimeEnv().STRIPE_WEBHOOK_SECRET;
}
