# Returns, Refunds, and Cancellation Policy

**Slug:** `/legal/refunds`  
**Version:** `0.2.0`  
**Status:** `OWNER APPROVED — 0.2.0`  
**Proposed effective date:** `[PROPOSED EFFECTIVE DATE]`  
**Audience:** Store customers, subscribers, and eligible participants who request a refund or cancellation for merchandise, subscriptions, or support contributions.

## Plain-language summary

This policy separates merchandise returns, defects, lost shipments, merchandise cancellation, subscription cancellation/refunds, and support-contribution refunds. A request is not itself a completed refund. Approved monetary refunds are processed through Stripe, while fulfillment and production outcomes remain separate.

## Table of contents

1. General rules for requests and refunds
2. A. Merchandise returns
3. B. Damaged, defective, or incorrect merchandise
4. C. Lost or non-delivered merchandise
5. D. Merchandise cancellation
6. E. Subscription cancellation
7. Subscription refunds and proration
8. F. Support-contribution refunds
9. Full support-contribution refund effect
10. Partial support-contribution refund effect
11. Chargebacks and reversals
12. Refund method and timing
13. G. Mandatory legal rights
14. Contact and help routes
15. Related documents
16. What changed / version notes

## 1. General rules for requests and refunds

A request for cancellation, return, replacement, reshipment, or refund starts a review; it is not itself a completed refund. We may need order, payment, shipment, entitlement, or provider records before deciding the appropriate remedy.

Stripe is the payment provider for approved monetary refunds. Printful fulfillment status and Stripe payment/refund status are separate. A product can be canceled in fulfillment without a refund yet being complete, or a refund can be approved while a provider event is still processing.

## 2. A. Merchandise returns

For ordinary merchandise return requests, contact [STORE/ORDER SUPPORT ROUTE] within **[CONFIGURED RETURN/CLAIM WINDOW]** after the event defined by the configured Store policy, unless applicable law provides a longer or different right.

Because merchandise may be produced on demand, buyer-remorse, wrong-size, wrong-color, exchange, and return eligibility must follow the configured customer policy presented for the product and destination. The version 0.2.0 owner rules do not authorize inventing a numeric return period or silently importing a fulfillment provider's merchant-facing limitation as the customer's legal right.

If a return is approved, instructions will explain whether physical return is required, where it must go, and who bears authorized return shipping costs. Do not mail an item to the public business address without instructions.

## 3. B. Damaged, defective, or incorrect merchandise

If an item arrives damaged, defective, materially misprinted, or materially different from what was ordered, report it through [STORE/ORDER SUPPORT ROUTE] within **[CONFIGURED RETURN/CLAIM WINDOW]**, or within any longer mandatory period.

We may request photographs, packaging information, or other evidence reasonably needed to distinguish manufacturing, transit, or picking errors. Approved remedies can include replacement, reshipment, repair where appropriate, refund, or another remedy required by law. A customer should not be required to surrender a mandatory defect remedy merely because Printful is the fulfillment provider.

## 4. C. Lost or non-delivered merchandise

For shipments that appear lost or are not delivered, contact [STORE/ORDER SUPPORT ROUTE] within **[CONFIGURED RETURN/CLAIM WINDOW]** or the longer mandatory period. We may review tracking, carrier scans, fulfillment records, address information, delivery location, and any relevant carrier/provider investigation.

A carrier status of “delivered” can be evidence, but it does not automatically end review where a customer reasonably reports non-receipt. Depending on the facts and applicable rights, the remedy can include reshipment, replacement, refund, or another resolution.

## 5. D. Merchandise cancellation

Cancellation availability depends on whether payment has been confirmed and whether production has started. A cancellation request should be made through [STORE/ORDER SUPPORT ROUTE] as soon as possible. The configured production/cancellation cutoff is **[ADDRESS CHANGE CUTOFF/PROCESS]** or another Store cancellation control expressly displayed in the live order flow.

If production can be stopped and cancellation is approved, any monetary refund is processed through Stripe. If production has already begun and cannot be canceled, return/refund eligibility is evaluated under the merchandise rules above and mandatory law. A fulfillment cancellation and a payment refund are never treated as the same system event.

## 6. E. Subscription cancellation

Canceling a recurring subscription stops future renewal according to the available account or Stripe-enabled billing controls. Cancellation does not ordinarily remove already-earned Member time. Unless a refund or adjustment is approved, Member access continues through the current earned period and ends at the exclusive `memberThrough` boundary.

**A subscription will never be required.** Cancellation of a subscription does not cancel separate Member time earned through qualifying support contributions.

## 7. Subscription refunds and proration

A subscription payment is refundable or prorated only where an express transaction rule, this policy, a specific offer, or mandatory law provides that remedy. The owner-approved 0.2.0 rules do not create an automatic free trial, automatic partial-month refund, or automatic proration right merely because a customer cancels renewal.

If a subscription refund is approved, the entitlement adjustment must be consistent with the refunded paid period and must not rewrite valid consumed history in a way that contradicts the authoritative membership ledger. Approved money refunds are processed through Stripe.

## 8. F. Support-contribution refunds

A voluntary support contribution may be refunded only when approved under the applicable support/refund process or when required by law. A contribution is not represented as tax-deductible merely because it is called a donation or support payment.

Refunds affect support-earned Member entitlement according to the precise rules below, while preserving audit history.

## 9. Full support-contribution refund effect

A **full refund** revokes all **unconsumed** Member entitlement created by that contribution. Consumed historical Member time remains historical fact. The original grant remains in the audit history, and the revocation is recorded separately.

This means the system must not delete the original grant event or pretend that already-consumed Member time never occurred.

## 10. Partial support-contribution refund effect

A **partial refund** requires recomputing qualifying Member months from the remaining net support amount using the same formula that created the original grant:

```text
floor(amount / 10)
+ floor(amount / 50)
+ 3 * floor(amount / 100)
```

Only the unconsumed difference between the original grant and the recomputed grant is revoked. Already-consumed historical Member time is never rewritten.

## 11. Chargebacks and reversals

A final chargeback or provider-authoritative payment reversal is reconciled according to the underlying transaction type. For a support contribution, the remaining settled net amount determines the recalculated support-earned Member entitlement, with only unconsumed unsupported entitlement revoked and all historical events preserved.

For merchandise or subscription payments, the service must reconcile payment reversal, fulfillment, access, and any mandatory legal remedy without treating a browser-only event as authoritative.

## 12. Refund method and timing

Approved monetary refunds are processed through Stripe. Stripe ordinarily routes refunds according to the original payment method and provider rules. The time for a refund to appear can depend on the payment method, bank, card issuer, and provider processing. We do not guarantee a fixed bank-posting time unless the applicable transaction expressly provides one.

A refund status shown by Stripe/server-authoritative records controls over an unverified client message.

## 13. G. Mandatory legal rights

Nothing in this policy narrows a non-waivable consumer, payment, delivery, defect, cancellation, privacy, or other statutory right. If the configured claim window, made-to-order restriction, cancellation cutoff, or another contractual rule conflicts with a mandatory right in the customer's jurisdiction, the mandatory right controls.

## 14. Contact and help routes

Merchandise/order requests: **[STORE/ORDER SUPPORT ROUTE]**.

Subscription or support-contribution account issues: `/account/support`. Signed-out users seeking Player Support should sign in and return there.

Company-level legal or privacy matters: `/contact`. **Player support messages should be sent from the Support tab, not this webform.** Do not submit raw card credentials or unnecessary sensitive information.

## 15. Related documents

See the Store Terms of Sale, Shipping and Fulfillment Policy, Membership and Subscription Terms, Donations and Perks Terms, Terms of Service, and Privacy Policy.

## 16. What changed / version notes

Version 0.2.0 separates the required merchandise, defect, non-delivery, cancellation, subscription, support-refund, and mandatory-law categories; preserves configurable merchandise windows; routes approved refunds through Stripe; and locks full/partial support-refund effects on unconsumed Member entitlement and historical audit integrity.
