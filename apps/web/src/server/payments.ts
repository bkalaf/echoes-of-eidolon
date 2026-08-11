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

export function getStoreShippingCountries(): Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[] {
  const configured = getPaymentsEnv().STRIPE_SHIPPING_ALLOWED_COUNTRIES;
  if (!configured) throw new Error("STRIPE_SHIPPING_ALLOWED_COUNTRIES is required for Store checkout.");
  const countries = [...new Set(configured.split(",").map((country) => country.trim().toUpperCase()).filter(Boolean))];
  if (countries.length === 0 || countries.some((country) => !/^[A-Z]{2}$/.test(country))) {
    throw new Error("STRIPE_SHIPPING_ALLOWED_COUNTRIES must be a comma-separated list of ISO alpha-2 codes.");
  }
  return countries as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[];
}

export function verifyStripeWebhook(rawBody: Uint8Array, signature: string): { stripeWebhookEventId: string; eventType: string } {
  const event = getPayments().webhooks.constructEvent(rawBody, signature, getStripeWebhookSecret());
  return { stripeWebhookEventId: event.id, eventType: event.type };
}

export function verifyStripeWebhookEvent(rawBody: Uint8Array, signature: string) {
  const event = getPayments().webhooks.constructEvent(rawBody, signature, getStripeWebhookSecret());
  return { event, stripeWebhookEventId: event.id, eventType: event.type };
}
