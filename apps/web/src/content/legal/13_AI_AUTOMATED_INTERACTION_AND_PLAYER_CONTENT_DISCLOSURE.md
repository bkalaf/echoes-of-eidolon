# AI, Automated Interaction, and Player Content Disclosure

**Slug:** `/legal/ai-disclosure`  
**Version:** `0.2.0`  
**Status:** `OWNER APPROVED — 0.2.0`  
**Proposed effective date:** `[PROPOSED EFFECTIVE DATE]`  
**Audience:** Players, guardians, beta participants, and anyone using AI-mediated Echoes of Eidolon interactions.

## Plain-language summary

Echoes of Eidolon uses AI-mediated fictional characters and systems. Generated dialogue is probabilistic, can be wrong, and is not automatically authored canon. Player interaction content is sent to OpenAI where needed to provide AI functionality. Eidolon Gaming does not intentionally persist raw player/AI conversation text as ordinary gameplay history, while OpenAI provider-side processing follows separate provider controls and retention rules.

## Table of contents

1. What uses AI
2. Generated output is probabilistic
3. Authored canon and database truth
4. Historical and cultural accuracy
5. No professional advice
6. Player input sent to OpenAI
7. Eidolon application non-persistence policy
8. Structured gameplay state
9. Sanitized operational logs
10. OpenAI training and provider-side retention
11. Safety and moderation
12. Sensitive information
13. Reporting harmful or inaccurate output
14. Model and feature changes
15. Voice interaction configuration
16. Contact and help routes
17. Related documents
18. What changed / version notes

## 1. What uses AI

Echoes of Eidolon can use automated or AI-mediated systems to generate or shape dialogue, character responses, interpretation of player input, and other interactive behavior. These systems support a branching, multiple-story experience, but they do not make every generated sentence an authoritative statement of game canon, history, law, culture, or real-world fact.

## 2. Generated output is probabilistic

AI output is generated probabilistically. The same or similar input can produce different responses, and a response can be incomplete, inconsistent, implausible, offensive, anachronistic, or simply wrong. Safety and grounding measures can reduce risk but do not make generated output infallible.

## 3. Authored canon and database truth

Author-created content, curated source records, structured game state, and authoritative databases can have a different status from generated dialogue. A fictional character may lie, misunderstand, speculate, roleplay, or generate an error. When a game feature identifies a record as authoritative canon or structured state, that designation controls over an inconsistent generated statement.

The service may intentionally keep some story information unrevealed. This disclosure does not reveal unreleased story information or authorize attempts to extract hidden system instructions or protected secrets.

## 4. Historical and cultural accuracy

Echoes of Eidolon draws on real cultures, histories, traditions, languages, objects, music, architecture, folklore, historical events, and scholarship. Even where AI output is grounded in researched material, the generated response can misstate, flatten, mistranslate, combine, or misattribute source material. Research sources themselves can also be incomplete, contested, outdated, unreliable, or wrong.

A generated historical or cultural statement should not be treated as proof merely because an NPC states it confidently. Use the Cultural Use, Attribution, and Research Corrections Policy to report a factual, attribution, sacred/restricted-use, or sourcing concern.

## 5. No professional advice

Generated output is part of an entertainment product and is not legal, medical, financial, tax, mental-health, safety, or other professional advice. Do not rely on a fictional character or generated system response when a real-world decision requires qualified professional judgment or authoritative information.

## 6. Player input sent to OpenAI

Player interaction content is transmitted to OpenAI where needed to provide AI-powered interaction. Depending on the feature, the transmitted context can include the player's current input and limited relevant game/context information needed to generate a response. Users should not enter unnecessary sensitive information into ordinary gameplay conversations.

## 7. Eidolon application non-persistence policy

Eidolon Gaming does **not intentionally persist raw player conversation text or raw AI response text as ordinary gameplay history**. Raw conversation content must not deliberately be written to the ordinary application database as gameplay history, ordinary application logs, analytics events, error traces, or support traces.

The service can process conversation text transiently in memory or through providers to produce the requested interaction. “Not intentionally persisted by the Eidolon application” is not the same as “no system anywhere ever processes or retains the content.”

## 8. Structured gameplay state

The game may persist the minimum structured gameplay state derived from interaction when required to operate the experience—for example, a progression flag, relationship state, discovered fact, decision state, or other structured result. That structured state is not a transcript and should not be expanded into raw conversation history merely for convenience.

Durable progression and account records follow the category-specific retention rules in the Privacy Policy.

## 9. Sanitized operational logs

Sanitized transient operational logs target approximately 30 days. Logging should avoid raw player conversation and raw AI response text as ordinary log content. Security and audit records that are durable for a different reason are not subject to a blanket 30-day deletion rule.

## 10. OpenAI training and provider-side retention

OpenAI's current official API data-control documentation states that data sent to the OpenAI API is not used to train or improve OpenAI models by default unless the API customer explicitly opts in to share data. OpenAI also states that default abuse-monitoring logs may contain prompts and responses and may be retained for up to 30 days, subject to stated exceptions, while some API features can persist application state.

Those are OpenAI provider-side rules, not an Eidolon application-retention promise. Eidolon Gaming does not claim that Zero Data Retention, Modified Abuse Monitoring, `store: false`, or another endpoint/project-specific control is enabled unless the live configuration has been verified. Provider documentation and the actual API feature/configuration determine provider-side handling.

## 11. Safety and moderation

AI interactions may be subject to automated or human-assisted safety systems where necessary to enforce service rules, respond to abuse, comply with law, or protect users and systems. Safety handling should remain consistent with the Privacy Policy, including the rule against deliberately placing raw conversation content into ordinary support traces or logs.

A user may be restricted for using AI interactions to facilitate prohibited conduct, attack the service, obtain credentials, extract hidden system prompts, or access protected secrets.

## 12. Sensitive information

Do not submit passwords, payment-card data, access tokens, recovery codes, government IDs, private authentication secrets, or other unnecessary sensitive information in ordinary AI conversations. If an account, payment, safety, privacy, or legal issue requires assistance, use the appropriate support or Contact route instead of trying to resolve it through a fictional character.

## 13. Reporting harmful or inaccurate output

Player-facing harmful, broken, or inaccurate AI behavior can be reported through `/account/support`. Accessibility barriers should use `/contact` → **Accessibility feedback**. Security issues should use `/contact` → **Security report**. Historical/cultural errors or sourcing concerns should use `/contact` → **Historical/cultural correction or sourcing concern** with contact classification `CULTURAL_RESEARCH`.

A report can include the minimum context needed to identify the issue, but do not send unrelated sensitive data.

## 14. Model and feature changes

AI models, prompts, safety systems, context assembly, voice features, and interaction interfaces can change as the service evolves. A change does not authorize a hidden rewrite of an already-paid transaction or a retroactive removal of mandatory legal rights. Where a provider/data-practice change materially affects the Privacy Policy, the relevant disclosure should be updated before or with the changed practice as required.

## 15. Voice interaction configuration

The currently configured voice interaction window is 15 seconds for ordinary participation and 30 seconds for Members; text is not limited by that perk. Those values are a current mutable membership configuration, not a perpetual AI-service guarantee, unless a paid period expressly promises otherwise.

## 16. Contact and help routes

Player/account/gameplay and AI-output support: `/account/support`. Signed-out users seeking Player Support should sign in and return there.

Company-level privacy, accessibility, security, legal, or cultural/research matters: `/contact`. **Player support messages should be sent from the Support tab, not this webform.**

## 17. Related documents

See the Terms of Service, Privacy Policy, Acceptable Use and Player Conduct, Membership and Subscription Terms, Beta and Invitation Participation Terms, and Cultural Use/Attribution/Research Corrections Policy.

## 18. What changed / version notes

Version 0.2.0 establishes the owner-approved AI disclosure: probabilistic output, authored-canon distinction, OpenAI transmission, Eidolon raw-conversation non-persistence, structured-state persistence, approximately 30-day sanitized transient-log target, current official OpenAI training/retention wording without unsupported ZDR claims, and dedicated reporting routes.
