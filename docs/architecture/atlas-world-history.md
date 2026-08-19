# Atlas world-specific settlement history

## Canonical historical invariant

The Atlas has **25 physical regions** but only **24 original founding cities**.

`R10 — Innerwood` is a physical geographic region from the beginning. Its region geometry and `SITE-0243` are stable Atlas geography. What is absent at initial founding is the settlement/political entity: no R10 city, no city name, no R10 founding population, and no R10 federal-capital status.

The existing split-looking R10 geometry is intentional. `SITE-0243` is the post-exile founding location in the southern/lower portion. Do not normalize the region shape and do not move the Site when history diverges.

## Identity ownership

Atlas must keep these concerns separate:

1. **Region / Site geography** — world-independent physical identity and coordinates.
2. **Settlement existence** — a settlement can be absent in a world/phase while the Site and Region still exist.
3. **Settlement name** — can vary by world.
4. **Founding event** — temporal, not inferred merely from a Site being present.
5. **Population** — world-specific and event-sourced through `SettlementPopulationEvent`.
6. **Federal-capital status** — world-specific and temporal; never a global flag on the physical Region or Settlement.

`RegionId`, `Site`, and coordinates must not be mutated merely because a world history diverges.

## Current repository model

The existing model already provides most of the separation:

- `Site` owns physical `regionId`, longitude, latitude, and candidate classification.
- `Settlement` is optional at a Site.
- `SettlementWorld` is a per-world incarnation with `@@unique([settlementId, worldKey])`.
- `SettlementPopulationEvent` is an append-only, year/sequence-ordered population ledger and already supports `FOUNDING`, `MIGRATION_IN`, and `MIGRATION_OUT`.
- `City` belongs to a `SettlementWorld`, so City geometry is already world-specific.

The current loss points are:

- `Settlement.name` is global.
- the naming response is targeted to `SettlementWorld` but currently writes the result to global `Settlement.name`.
- City creation currently derives its name from global `Settlement.name`.
- federal-capital and non-population settlement-history events do not yet have a dedicated durable ledger.

The domain module `apps/web/src/domain/atlas-world-history.ts` is the application contract for this canon while the durable database migration is completed. It deliberately overrides the legacy global R10 name at read/create time and must not serialize a slash-delimited R10 name as persistence.

## Required durable Prisma evolution

The durable schema should move current world-state values to `SettlementWorld` and add an append-only history ledger. The target shape is:

```prisma
model SettlementWorld {
  settlementWorldId String   @id
  settlementId      String
  worldKey          WorldKey
  name              String?
  foundedYear       Int?
  isFederalCapital  Boolean  @default(false)
  // existing population/culture fields remain
  historyEvents     SettlementWorldEvent[]
}

enum SettlementWorldEventType {
  FOUNDED
  RENAMED
  SEIZED
  FEDERAL_CAPITAL_DESIGNATED
  FEDERAL_CAPITAL_REVOKED
}

model SettlementWorldEvent {
  settlementWorldEventId String                   @id
  settlementWorldId      String
  year                   Int
  sequence               Int
  eventType               SettlementWorldEventType
  nameValue               String?
  sourceRegionId          RegionId?
  detail                  Json?
  settlementWorld         SettlementWorld          @relation(fields: [settlementWorldId], references: [settlementWorldId], onDelete: Cascade)

  @@unique([settlementWorldId, year, sequence])
  @@index([settlementWorldId, year])
}
```

Population remains in `SettlementPopulationEvent`; do not duplicate population authority into this ledger.

## Initial state

- 25 physical regions.
- 24 original founding cities.
- R10 geography and `SITE-0243` exist.
- no R10 `SettlementWorld` exists in any world.
- Highcourt, The Chains, and Sunscar remain under original populations.
- no world federal capital has yet been created by the DJT seizure event.

## Post-DJT divergence

### Concord / C

- DJT species: Lion.
- DJT seizes R06 Highcourt / Ascendancy.
- Highcourt becomes the Concord federal capital.
- R10 / SITE-0243 receives the exiles and founds **Ashgarden**.
- R10 founding population: Iranian, Kurdish & Eastern West Asian; Caucasian & Anatolian; Djinn & Genie-Kin.

### Schism / S

- DJT species: Hamadryas baboon.
- DJT seizes R22 The Chains / Tjuringa.
- The Chains becomes the Schism federal capital.
- R10 / SITE-0243 receives the exiles and founds **Second Song**.
- R10 founding population: Australian Indigenous; Marsupials & Monotremes; Other Specialized Birds.

### Ruin / R

- DJT species: Peacock spider.
- DJT seizes R11 Sunscar / Al-Mihraq.
- Sunscar becomes the Ruin federal capital.
- R10 / SITE-0243 receives the exiles and founds **Last Well**.
- R10 founding population: Arabian Peninsula; North African & Saharan; Elephants, Hyraxes & Afrotherians.

## Population corrections

### R06 Highcourt original population

- Iranian, Kurdish & Eastern West Asian
- Angels & Celestials
- Djinn & Genie-Kin

Highcourt is intentionally a floating-island region/city.

### R15 Forestfold

- South Asian
- Primates
- Caucasian & Anatolian

Angels & Celestials are no longer assigned to Forestfold.

## Derived-output rule

Every derived Atlas map/globe that shows cities or political status must declare a world/history snapshot.

- `INITIAL`: 24 city markers; no R10 city marker or name.
- `CONCORD / POST_DJT`: Ashgarden exists; Highcourt is federal capital.
- `SCHISM / POST_DJT`: Second Song exists; The Chains is federal capital.
- `RUIN / POST_DJT`: Last Well exists; Sunscar is federal capital.

A human-readable summary may display `Ashgarden [C] / Second Song [S] / Last Well [R]`. That string is presentation only and must never become the authoritative settlement name stored on `Settlement`.
