# Owner Decisions Required

OWNER_DECISION_REQUIRED: research-domain-ownership-shape
Subsystem: Data
Blocked slice: Replace generic Research owner fields in Prisma
Question: Which first-class relation or join record owns each Research row after `ownerEntityType` and `ownerEntityId` are removed?
Why authority does not settle it:
- The latest owner instruction prohibits Research from repeating owning entity type/ID.
- The v11.3 type map still requires `ownerEntityType` and `ownerEntityId`, while the relationship map names `SpeciesResearchValue` but supplies no fields or cardinality for that record.
Existing repository options:
- Keep the generic fields, which violates the latest owner instruction.
- Remove them without a replacement relation, which leaves Research ownership unenforced and contradicts the domain relationship.
Independent work continuing:
- Source and Citation evidence validation, visible-footnote projection, and unrelated data administration.

OWNER_DECISION_REQUIRED: capability-event-persistence-shape
Subsystem: Data
Blocked slice: Add append-only CapabilityEvent persistence
Question: What first-class identity owns a CapabilityEvent, and what exact fields store BOOLEAN, SCORE, COUNTER, ENUM, and REFERENCE values?
Why authority does not settle it:
- The latest owner instruction requires append-only events, five value kinds, SET/ADD operations, and deterministic reduction.
- The v11.3 type map and current Prisma schema define only BOOLEAN/SCORE CapabilityDefinition rows and provide no CapabilityEvent subject or typed value fields.
Existing repository options:
- Store a polymorphic subject and JSON value, which would invent both an ownership boundary and a bypass around first-class invariants.
- Add per-kind nullable columns and a guessed User relation, which would invent the event subject and database shape.
Independent work continuing:
- Pure validation/reduction behavior that does not choose a persistence owner, plus unrelated packet surfaces.
