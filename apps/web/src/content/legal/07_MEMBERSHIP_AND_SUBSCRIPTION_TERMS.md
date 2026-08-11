# Membership and Subscription Terms

**Slug:** `/legal/membership`  
**Version:** `0.2.0`  
**Status:** `OWNER APPROVED — 0.2.0`  
**Proposed effective date:** `[PROPOSED EFFECTIVE DATE]`  
**Audience:** Eligible Echoes of Eidolon participants who purchase, receive, cancel, or otherwise hold Member entitlement.

## Plain-language summary

Membership is an optional entitlement. For version 0.2.0, the recurring subscription price is $9.99 per calendar month through Stripe. These terms define calendar-month stacking, the exclusive `memberThrough` boundary, cancellation and renewal, failed payments, mutable perks, donation-earned Member time, and the rule that paid status never buys beta admission.

## Table of contents

1. Optional membership
2. Price and billing provider
3. Recurring-charge authorization
4. What a Member month means
5. The exclusive `memberThrough` boundary
6. Renewal
7. Cancellation
8. Failed or declined payments
9. Receipts and billing history
10. Current perks and changes
11. Member time earned through support
12. No beta or gameplay advantage purchase
13. Refunds and proration
14. Taxes
15. Price changes
16. Changes to membership terms
17. Contact and support
18. Related documents
19. What changed / version notes

## 1. Optional membership

**A subscription will never be required.** Echoes of Eidolon can be participated in without purchasing a subscription, subject to ordinary eligibility and invitation rules. “Member” describes an entitlement state. It is not an administrator, moderator, owner, staff, invitation, or authorization role.

## 2. Price and billing provider

For version 0.2.0, the subscription price is **$9.99 per calendar month**, plus taxes where applicable. Stripe is the sole payment provider for subscription billing, payment-method handling where enabled, receipts, and subscription refunds. No free trial is created by these terms.

## 3. Recurring-charge authorization

By starting a recurring subscription, you authorize Stripe, on behalf of Eidolon Gaming, to charge the selected payment method at the recurring billing interval until you cancel renewal or the subscription otherwise ends. The checkout flow should display the amount and recurring nature of the charge before confirmation.

If a saved payment method is enabled, its management is handled through Stripe-supported billing controls or another Stripe-enabled flow made available by Eidolon Gaming. Do not send full card numbers or security codes to Eidolon support.

## 4. What a Member month means

A Member month is a **calendar month**, not a fixed 30-day period. Entitlement stacking preserves the original anchor day where possible. If a target month lacks that anchor day, the boundary clamps to the last valid day of that month and the original anchor day is restored in later months where possible.

For example, an entitlement anchored on January 31 advances one calendar month to the last valid day of February, then advances to March 31 when the original anchor day exists again. The precise timestamp/time-zone implementation must use the product's authoritative entitlement service; the legal rule is the calendar-month behavior described here.

## 5. The exclusive `memberThrough` boundary

`memberThrough` is an exclusive boundary. Member entitlement is active before that boundary and is not active merely because the current time equals the boundary. This definition prevents an extra instant or extra day from being implied by an inclusive interpretation.

When additional Member months are earned, the entitlement service stacks calendar months using the preserved anchor semantics rather than simply adding 30-day blocks.

## 6. Renewal

A recurring subscription is expected to renew by charging the payment method on file through Stripe at the applicable billing boundary, unless renewal has been canceled or the subscription otherwise ends. A successful provider-authoritative payment can create the next subscription-earned Member period. A browser redirect or client-only success indicator does not control entitlement if the server/provider status says otherwise.

## 7. Cancellation

You may cancel future subscription renewal using the account or Stripe-enabled subscription-management flow made available for the service. Cancellation of renewal does not ordinarily remove Member time that has already been paid for and earned. Unless a refund or other adjustment is approved, Member access continues through the already-earned current period and ends at the applicable exclusive `memberThrough` boundary.

Cancellation of a recurring subscription does not remove separate Member time earned through qualifying support contributions.

## 8. Failed or declined payments

If Stripe reports a renewal payment as failed, declined, canceled, or otherwise unsuccessful, a new paid subscription month is not treated as successfully purchased merely because a client attempted checkout. The service may prompt you to update a payment method or retry payment through a Stripe-enabled flow.

A failed subscription payment does not retroactively erase already-consumed Member time or separate Member entitlement validly earned from another source.

## 9. Receipts and billing history

Stripe can provide receipts and billing records for successful subscription payments according to the configured integration. Eidolon Gaming may retain transaction identifiers, amounts, statuses, entitlement entries, and related metadata needed for support, accounting, refunds, security, and audit integrity. Raw card credentials are not ordinary Eidolon application data.

## 10. Current perks and changes

Membership perks may change over time. A mutable perk is not guaranteed forever unless the terms for a specific paid period expressly promise that perk for that period. Changes must not retroactively take away a right already earned under an express paid commitment or a mandatory legal right.

The currently configured voice interaction values are **15 seconds for ordinary participation** and **30 seconds for Members**. Text is not limited by that perk. These values describe the current configuration; they are not a perpetual guaranteed entitlement unless a paid period expressly promises otherwise.

## 11. Member time earned through support

Qualifying support contributions can also create Member months under the Donations and Perks Terms. Subscription-earned and support-earned Member months use the same calendar-month and `memberThrough` semantics. A support contribution is not itself a subscription unless the checkout expressly creates a recurring subscription.

## 12. No beta or gameplay advantage purchase

Membership does not purchase a beta invitation, beta admission, invitation priority, moderation authority, or administrative power. It also does not create a pay-to-win gameplay path. Paid status must never be presented as an invitation fast-track.

## 13. Refunds and proration

Subscription refunds, credits, or proration are available only as stated in the Returns, Refunds, and Cancellation Policy, an express transaction offer, or mandatory law. Canceling renewal is not automatically the same as obtaining a refund. Submitting a support request is not itself a completed refund. Approved monetary refunds are processed through Stripe.

## 14. Taxes

Applicable taxes may be collected where required based on transaction details and configured tax handling. These terms do not promise tax treatment that depends on jurisdiction, exemption status, or a live provider configuration.

## 15. Price changes

Eidolon Gaming may change the subscription price prospectively. A price change for recurring billing must be disclosed with the notice and renewed consent, if any, required by applicable law and the configured payment method. A new price does not silently re-price a completed past billing period.

## 16. Changes to membership terms

Membership features or these terms may change prospectively for product, security, legal, or operational reasons. Where a change materially affects an existing paid period, the service will provide the notice or remedy required by the applicable promise and law. Mutable perks may change, but already-earned transactional rights remain governed by the terms that applied to the relevant purchase.

## 17. Contact and support

Membership/account support: `/account/support`. Signed-out users seeking Player Support should sign in and return there.

Billing records and payment methods may also be available through Stripe-enabled account controls where configured. Do not send raw card credentials through support.

Company-level legal or privacy inquiries: `/contact`. **Player support messages should be sent from the Support tab, not this webform.**

## 18. Related documents

See the Terms of Service, Donations and Perks Terms, Returns/Refunds/Cancellation Policy, Privacy Policy, Beta and Invitation Participation Terms, and AI/Automated Interaction Disclosure.

## 19. What changed / version notes

Version 0.2.0 locks the $9.99 calendar-month price, optional-subscription promise, preserved anchor-day stacking, exclusive `memberThrough` boundary, Stripe recurring billing, cancellation-through-earned-period rule, current 15/30-second voice configuration, and separation of membership from beta admission or authority.
