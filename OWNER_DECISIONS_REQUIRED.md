# Owner Decisions Required

OWNER_DECISION_REQUIRED: research-domain-ownership-shape
Subsystem: Data
Blocked slice: Replace generic Research owner fields in Prisma

Question: Which first-class relation or join record owns each Research row after `ownerEntityType` and `ownerEntityId` are removed?

## Owner response

Remove `ownerEntityType` and `ownerEntityId`. Research ownership must use domain-specific typed join records, never polymorphic ownership fields or JSON.

For Breed personality research:

- `SpeciesResearchValue` must be renamed to `BreedResearchValue`.
- `BreedResearchValue` represents the selected `(breedId, dimension, value)`.
- `BreedResearchEvidence` joins supporting Research to that value.
- Required fields:
  - `breedResearchEvidenceId`
  - `breedResearchValueId`
  - `researchId`
- `researchId` is unique so each Research row has exactly one owning join.
- One `BreedResearchValue` may have multiple supporting Research rows.

Use equivalent typed joins for other domains only when required, such as `CharacterResearchEvidence`. `Source` and `Citation` remain reusable, but each Research assertion belongs to exactly one typed domain owner.

Why authority does not settle it:

- The latest owner instruction prohibits Research from repeating owning entity type/ID.
- The v11.3 type map still requires `ownerEntityType` and `ownerEntityId`, while the relationship map names `SpeciesResearchValue` but supplies no fields or cardinality for that record.

Existing repository options:

- Keep the generic fields, which violates the latest owner instruction.
- Remove them without a replacement relation, which leaves Research ownership unenforced and contradicts the domain relationship.

Independent work continuing:

- Source and Citation evidence validation, visible-footnote projection, and unrelated data administration.

---

OWNER_DECISION_REQUIRED: capability-event-persistence-shape
Subsystem: Data
Blocked slice: Add append-only CapabilityEvent persistence

Question: What first-class identity owns a CapabilityEvent, and what exact fields store BOOLEAN, SCORE, COUNTER, ENUM, and REFERENCE values?

## Owner response

The canonical `User` owns `CapabilityEvent`. Do not create a separate Player, PlayerProfile, capability subject, or polymorphic subject system.

Required fields:

- `capabilityEventId`
- `userId`
- `capabilityDefinitionId`
- `operation`
- `booleanValue`
- `scoreValue`
- `counterValue`
- `enumValue`
- `referenceEntityType`
- `referenceEntityId`
- `occurredAt`
- `sequence`
- `sourceEntityType`
- `sourceEntityId`

Exactly one value payload must be populated according to the referenced `CapabilityDefinition.valueKind`. Do not use a JSON value field.

Value and operation rules:

- `BOOLEAN`: use `booleanValue`; `SET` only.
- `SCORE`: use `scoreValue`; `SET` or `ADD`.
- `COUNTER`: use `counterValue`; `SET` or `ADD`.
- `ENUM`: use `enumValue`; `SET` only; validate against the definition’s allowed values.
- `REFERENCE`: use `referenceEntityType` and `referenceEntityId`; `SET` only; validate the type against the definition’s permitted reference types.

Events are append-only. Deterministic reduction order is:

`(occurredAt, sequence, capabilityEventId)`

Existing events may not be updated or deleted.

Why authority does not settle it:

- The latest owner instruction requires append-only events, five value kinds, SET/ADD operations, and deterministic reduction.
- The v11.3 type map and current Prisma schema define only BOOLEAN/SCORE CapabilityDefinition rows and provide no CapabilityEvent subject or typed value fields.

Existing repository options:

- Store a polymorphic subject and JSON value, which would invent both an ownership boundary and a bypass around first-class invariants.
- Add per-kind nullable columns and a guessed User relation, which would invent the event subject and database shape.

Independent work continuing:

- Pure validation/reduction behavior that does not choose a persistence owner, plus unrelated packet surfaces.

---

OWNER_DECISION_REQUIRED: species-personality-values
Subsystem: Data
Blocked slice: Persist exactly twelve three-valued Breed personality dimensions

Question: What are the three allowed raw values for `LOQUACITY`, `EMOTIONAL_TEMPERATURE`, `OUTLOOK_ORIENTATION`, and `COLLABORATIVE_POSTURE`, and should all twelve dimension selections move onto Species directly?

## Owner response

No. All twelve selected personality dimensions belong on `Breed`, not `Species`.

Putting them on Species would give all 125 Human Breeds the same personality. Species contains shared biological and species-level characteristics. Breed is authoritative for the twelve selected personality dimensions.

The four additional value sets are:

### `LOQUACITY`

- `LIGHT_BANTER`
- `TALKATIVE`
- `TO_THE_POINT`

### `EMOTIONAL_TEMPERATURE`

- `COMPOSED`
- `IRRITABLE`
- `JOYFUL`

### `OUTLOOK_ORIENTATION`

- `NEUTRAL`
- `OPTIMISTIC`
- `PESSIMISTIC`

### `COLLABORATIVE_POSTURE`

- `HELPFUL`
- `JUST_ENOUGH`
- `WITHHOLDING`

Retain the existing eight selections on Breed and add the remaining four to Breed. Do not move any of the twelve selections onto Species.

`PersonalityExpression` may retain descriptive expression or wound content, but it is not authoritative for the twelve raw selected values.

Why authority does not settle it:

- The latest owner instruction supplies all twelve dimension keys and says each has exactly three dimension-specific values, but does not enumerate the last four value sets.
- The current schema puts eight dimension selections on Breed and four unconstrained strings on PersonalityExpression; the v11.3 compact types retain that older split.

Existing repository options:

- Guess four three-value enums and move all fields to Species, which invents raw tokens and migration behavior.
- Retain the current split, which violates the latest owner instruction that Species have exactly twelve dimensions.

Independent work continuing:

- Locking the twelve dimension keys and refusing unknown keys; no values or persistence locations are invented.

---

OWNER_DECISION_RESOLVED: canonical-duology-pairing
Subsystem: Campaign
Resolved slice: Transition, DEJA_VU, and Companion Book pairing

## Owner response

For every Book numbered 1 through 18, its canonical duology counterpart is:

`19 - bookNumber`

The resulting pairs are `1/18`, `2/17`, `3/16`, `4/15`, `5/14`, `6/13`, `7/12`, `8/11`, and `9/10`. This relationship replaces the former adjacent-Book pairing everywhere. The shared pairing remains assigned to `COMPANION` as well as the existing `TRANSITION` and `DEJA_VU` campaign placement rules.
