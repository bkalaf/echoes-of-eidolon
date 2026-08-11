# Donations and Perks Terms

**Slug:** `/legal/support`  
**Version:** `0.2.0`  
**Status:** `OWNER APPROVED — 0.2.0`  
**Proposed effective date:** `[PROPOSED EFFECTIVE DATE]`  
**Audience:** Authenticated eligible Echoes of Eidolon participants who make or receive the effects of voluntary support contributions.

## Plain-language summary

Support contributions are voluntary payments from authenticated eligible participants. For version 0.2.0, a single qualifying contribution must be between $10.00 and $100.00 and can create Member months under the exact cumulative formula in these terms. Support does not purchase admission, priority, or gameplay advantage, and no tax-deductibility claim is made without verified legal authority.

## Table of contents

1. Voluntary support
2. Who may contribute
3. Contribution amount
4. Member-month formula
5. Required examples
6. How support-earned Member time works
7. Perks may change
8. No invitation, admission, or priority purchase
9. Payment processing
10. Tax treatment
11. Full refunds and Member entitlement
12. Partial refunds and Member entitlement
13. Chargebacks and payment reversals
14. No conversion into gameplay advantage
15. Refund requests
16. Contact and support
17. Related documents
18. What changed / version notes

## 1. Voluntary support

A support contribution is a voluntary payment intended to support Eidolon Gaming and Echoes of Eidolon. It is not a purchase of a beta invitation, admission, access priority, queue priority, administrative status, or gameplay advantage. The public product commitment is **never pay-to-win**.

## 2. Who may contribute

A signed-out visitor may read the Donate page but cannot complete a contribution. Checkout requires an authenticated participant who is eligible to participate. Standard participation is 18+; a participant age 14–17 may contribute only when the participant has valid guardian permission and the payment is otherwise lawful and authorized. People under 14 are not eligible.

## 3. Contribution amount

For version 0.2.0, each qualifying support contribution must be at least **$10.00** and no more than **$100.00**, in U.S. dollars. The checkout should not silently accept an amount outside that range as a qualifying contribution under these terms.

## 4. Member-month formula

A qualifying contribution creates Member months using this exact cumulative formula, where `amount` is the support amount in U.S. dollars for that contribution:

```text
floor(amount / 10)
+ floor(amount / 50)
+ 3 * floor(amount / 100)
```

The components are cumulative. The formula is applied per qualifying contribution; separate contributions are not silently combined into a larger contribution unless a later owner-approved rule expressly changes that behavior.

## 5. Required examples

The formula produces these required examples:

- **$10 → 1 Member month**
- **$50 → 6 Member months**
- **$100 → 15 Member months**

For $50, the result is `floor(50/10)=5` plus `floor(50/50)=1`, for 6 total. For $100, the result is `10 + 2 + 3`, for 15 total.

## 6. How support-earned Member time works

Member months earned through support use the same calendar-month stacking, preserved anchor-day behavior, and exclusive `memberThrough` boundary as subscription-earned Member time. If a target month lacks the anchor day, the entitlement clamps to that month's last valid day and restores the original anchor day later where possible.

Support-earned Member time is an entitlement only. It does not create staff, moderator, administrator, owner, invitation, or admission authority.

## 7. Perks may change

Current Member perks can change over time. The current voice interaction configuration is 15 seconds for ordinary participation and 30 seconds for Members, while text is not limited by that perk. Those current values are not a perpetual guarantee unless a specific paid period expressly promises them.

A change to a mutable perk does not authorize rewriting already-consumed Member history or removing a specific right that was expressly promised for an already-earned period.

## 8. No invitation, admission, or priority purchase

A contribution does not purchase an invitation, beta admission, access priority, queue position, preferential selection, or an invitation fast-track. A person who contributes has no greater claim to beta admission merely because money was paid. This remains true even if the contribution creates Member entitlement.

## 9. Payment processing

Stripe is the sole payment provider for support contributions, receipts, saved payment methods where enabled, and refunds. A contribution is treated as successfully paid only when server/provider-authoritative status confirms success. Eidolon Gaming does not treat raw payment-card credentials as ordinary application data.

## 10. Tax treatment

Eidolon Gaming does **not** represent a support contribution as charitable or tax-deductible unless verified legal and tax status expressly permits that representation. A receipt may document payment, but a payment receipt is not by itself a charitable-deduction certificate. Contributors are responsible for obtaining their own tax advice where needed.

## 11. Full refunds and Member entitlement

If a qualifying support contribution is fully refunded, all **unconsumed** Member entitlement created by that contribution is revoked. Member time that was already consumed remains a historical fact and is not rewritten as though it never existed.

The original Member grant remains in the audit history. The refund-related revocation is recorded as a separate event so the entitlement ledger accurately reflects both what happened originally and what changed later.

## 12. Partial refunds and Member entitlement

If a support contribution is partially refunded, the qualifying Member months are recomputed from the **remaining net support amount** using the same formula. Only the unconsumed difference between the original grant and the recomputed grant is revoked. Already-consumed historical Member time is never rewritten.

Example: a $100 contribution originally creates 15 Member months. If $40 is later refunded, the remaining net support is $60. The formula for $60 is `6 + 1 + 0 = 7` Member months. The system may revoke up to the 8-month difference only from entitlement that remains unconsumed. If some or all of that difference has already been consumed, the consumed history remains and no negative historical rewrite is created.

## 13. Chargebacks and payment reversals

A final chargeback, payment reversal, or provider-authoritative transaction reversal is treated as a reduction of the settled net support amount for entitlement reconciliation. The same principles apply: preserve the original grant in audit history, record the reversal separately, recompute qualifying entitlement from the remaining settled amount where applicable, and revoke only unconsumed entitlement that is no longer supported.

A pending dispute is not described as a completed refund until the payment provider's authoritative status resolves it.

## 14. No conversion into gameplay advantage

Member time or other support-related acknowledgment must not be converted into combat power, puzzle solutions, progression shortcuts, access to hidden outcome advantages, or other pay-to-win effects. If a future support perk is introduced, it must remain consistent with the never pay-to-win commitment.

## 15. Refund requests

Submitting a refund request does not itself mean a refund has been approved or completed. Approved monetary refunds are processed through Stripe and can be subject to provider processing time. Refund eligibility is governed by the Returns, Refunds, and Cancellation Policy and mandatory law.

## 16. Contact and support

Support-contribution account questions: `/account/support`. Signed-out users seeking Player Support should sign in and return there.

Privacy, legal, or company-level inquiries: `/contact`. **Player support messages should be sent from the Support tab, not this webform.** Do not send raw card credentials through either form.

## 17. Related documents

See the Terms of Service, Membership and Subscription Terms, Returns/Refunds/Cancellation Policy, Privacy Policy, and Beta and Invitation Participation Terms.

## 18. What changed / version notes

Version 0.2.0 locks the authenticated-participant checkout rule, $10–$100 contribution range, cumulative Member-month formula, required $10/$50/$100 examples, Stripe processing, no-invitation/no-pay-to-win rules, and full/partial refund treatment that preserves consumed history and ledger integrity.
