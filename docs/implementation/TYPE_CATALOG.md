# Echoes of Eidolon Complete Type Catalog

Generated from the current Prisma schema, API route tree, and mechanically reconciled 274-row base-plus-V3 registry. The compile-time forward map is `apps/web/src/domain/implementation-types.ts`.

## Inventory

- Persisted entity types: 105
- Controlled enums: 106
- HTTP method/path contracts: 59
- Wireframe view-model rows: 274
- Wireframe shell distribution: public 36, game 14, auth 10, account 23, state-only 18, store 12, admin 156, tools-review 5
- Provider ports: DigitalOcean Spaces, Resend, Stripe, Printful, and owner-configured NPC runtime.
- State machines: invitation, payment, fulfillment, release, import, and Puzzle challenge.

## Persisted entity/type matrix

| Type | Kind | Owner | Table/service | Consuming screens | Field count |
|---|---|---|---|---|---:|
| User | Persisted entity | Identity | `User` via server/auth.ts and server/account-sessions.ts | Auth, Account, Admin Accounts | 31 |
| UserSettings | Persisted entity | Shared settings | `UserSettings` via server/user-settings.ts | Account Settings and Game Settings modal | 12 |
| Session | Persisted entity | Identity | `Session` via server/auth.ts and server/account-sessions.ts | Auth, Account, Admin Accounts | 11 |
| Organization | Persisted entity | Authorization | `Organization` via domain/organization-access.ts | Admin access | 8 |
| Member | Persisted entity | Authorization | `Member` via domain/organization-access.ts | Admin access | 7 |
| Invitation | Persisted entity | Authorization | `Invitation` via domain/organization-access.ts | Admin access | 10 |
| TwoFactor | Persisted entity | Identity | `TwoFactor` via server/auth.ts and server/account-sessions.ts | Auth, Account, Admin Accounts | 8 |
| BetaInviteRequest | Persisted entity | Invitations | `BetaInviteRequest` via server/beta-invitations.ts | Public Invite and Admin Invitations | 10 |
| BetaInvitationCode | Persisted entity | Invitations | `BetaInvitationCode` via server/beta-invitations.ts | Public Invite and Admin Invitations | 11 |
| Account | Persisted entity | Identity | `Account` via server/auth.ts and server/account-sessions.ts | Auth, Account, Admin Accounts | 14 |
| Verification | Persisted entity | Identity | `Verification` via server/auth.ts and server/account-sessions.ts | Auth, Account, Admin Accounts | 6 |
| Passkey | Persisted entity | Identity | `Passkey` via server/auth.ts and server/account-sessions.ts | Auth, Account, Admin Accounts | 12 |
| Species | Persisted entity | Canonical data | `Species` via typed imports and server/breed-research.ts | Admin Data and Game | 8 |
| Breed | Persisted entity | Canonical data | `Breed` via typed imports and server/breed-research.ts | Admin Data and Game | 29 |
| Culture | Persisted entity | Canonical data | `Culture` via typed imports and server/breed-research.ts | Admin Data and Game | 13 |
| Character | Persisted entity | Canonical data | `Character` via typed imports and server/breed-research.ts | Admin Data and Game | 6 |
| Protagonist | Persisted entity | Narrative data | `Protagonist` via typed import services | Admin Data, Campaign, Game | 8 |
| Architect | Persisted entity | Narrative data | `Architect` via typed import services | Admin Data, Campaign, Game | 5 |
| Antagonist | Persisted entity | Narrative data | `Antagonist` via typed import services | Admin Data, Campaign, Game | 24 |
| Witness | Persisted entity | Narrative data | `Witness` via typed import services | Admin Data, Campaign, Game | 5 |
| Soul | Persisted entity | Narrative data | `Soul` via typed import services | Admin Data, Campaign, Game | 3 |
| Companion | Persisted entity | Narrative data | `Companion` via typed import services | Admin Data, Campaign, Game | 10 |
| TimelineEvent | Persisted entity | Narrative data | `TimelineEvent` via typed import services | Admin Data, Campaign, Game | 4 |
| Interlude | Persisted entity | Narrative data | `Interlude` via typed import services | Admin Data, Campaign, Game | 6 |
| InterludeSubstitution | Persisted entity | Narrative data | `InterludeSubstitution` via typed import services | Admin Data, Campaign, Game | 6 |
| Pillar | Persisted entity | Narrative data | `Pillar` via typed import services | Admin Data, Campaign, Game | 4 |
| LegendaryReward | Persisted entity | Narrative data | `LegendaryReward` via typed import services | Admin Data, Campaign, Game | 5 |
| Lesson | Persisted entity | Narrative data | `Lesson` via typed import services | Admin Data, Campaign, Game | 3 |
| Tome | Persisted entity | Narrative data | `Tome` via typed import services | Admin Data, Campaign, Game | 3 |
| Transition | Persisted entity | Narrative data | `Transition` via typed import services | Admin Data, Campaign, Game | 5 |
| Constellation | Persisted entity | Narrative data | `Constellation` via typed import services | Admin Data, Campaign, Game | 6 |
| Ark | Persisted entity | Narrative data | `Ark` via typed import services | Admin Data, Campaign, Game | 3 |
| PointOfInterest | Persisted entity | Atlas | `PointOfInterest` via server/atlas.ts and server/atlas-sites.ts | Atlas Admin and Game maps | 6 |
| Site | Persisted entity | Atlas | `Site` via server/atlas.ts and server/atlas-sites.ts | Atlas Admin and Game maps | 6 |
| Settlement | Persisted entity | Settlement simulation | `Settlement` via server/settlements.ts | Atlas Admin, Found City, Migrate | 6 |
| SettlementWorld | Persisted entity | Settlement simulation | `SettlementWorld` via server/settlements.ts | Atlas Admin, Found City, Migrate | 12 |
| SettlementPopulationEvent | Persisted entity | Settlement simulation | `SettlementPopulationEvent` via server/settlements.ts | Atlas Admin, Found City, Migrate | 9 |
| Source | Persisted entity | Evidence | `Source` via domain/knowledge-evidence.ts and typed research services | Admin Data and Game Knowledge | 8 |
| Citation | Persisted entity | Evidence | `Citation` via domain/knowledge-evidence.ts and typed research services | Admin Data and Game Knowledge | 9 |
| Research | Persisted entity | Evidence | `Research` via domain/knowledge-evidence.ts and typed research services | Admin Data and Game Knowledge | 6 |
| BreedResearchValue | Persisted entity | Canonical data | `BreedResearchValue` via typed imports and server/breed-research.ts | Admin Data and Game | 6 |
| BreedResearchEvidence | Persisted entity | Canonical data | `BreedResearchEvidence` via typed imports and server/breed-research.ts | Admin Data and Game | 5 |
| KnowledgeBaseItem | Persisted entity | Knowledge | `KnowledgeBaseItem` via domain/knowledge-disclosures.ts | Admin Knowledge and Game Knowledge | 8 |
| KnowledgeBaseBlock | Persisted entity | Knowledge | `KnowledgeBaseBlock` via domain/knowledge-disclosures.ts | Admin Knowledge and Game Knowledge | 7 |
| KnowledgeBaseDisclosure | Persisted entity | Knowledge | `KnowledgeBaseDisclosure` via domain/knowledge-disclosures.ts | Admin Knowledge and Game Knowledge | 10 |
| KnowledgeBaseDisclosureBlock | Persisted entity | Knowledge | `KnowledgeBaseDisclosureBlock` via domain/knowledge-disclosures.ts | Admin Knowledge and Game Knowledge | 6 |
| KnowledgeBaseDisclosureCitation | Persisted entity | Knowledge | `KnowledgeBaseDisclosureCitation` via domain/knowledge-disclosures.ts | Admin Knowledge and Game Knowledge | 5 |
| KnowledgeBaseItemCitation | Persisted entity | Knowledge | `KnowledgeBaseItemCitation` via domain/knowledge-disclosures.ts | Admin Knowledge and Game Knowledge | 5 |
| Definition | Persisted entity | Narrative data | `Definition` via typed import services | Admin Data, Campaign, Game | 3 |
| Matrix | Persisted entity | Narrative data | `Matrix` via typed import services | Admin Data, Campaign, Game | 4 |
| Layette | Persisted entity | Narrative data | `Layette` via typed import services | Admin Data, Campaign, Game | 3 |
| PersonalityExpression | Persisted entity | Canonical data | `PersonalityExpression` via typed imports and server/breed-research.ts | Admin Data and Game | 2 |
| CapabilityDefinition | Persisted entity | Capabilities | `CapabilityDefinition` via domain/capabilities.ts | Admin capabilities and Game Knowledge | 5 |
| CapabilityDefinitionVersion | Persisted entity | Capabilities | `CapabilityDefinitionVersion` via domain/capabilities.ts | Admin capabilities and Game Knowledge | 24 |
| CapabilityParameterDefinition | Persisted entity | Capabilities | `CapabilityParameterDefinition` via domain/capabilities.ts | Admin capabilities and Game Knowledge | 8 |
| CapabilityAddress | Persisted entity | Capabilities | `CapabilityAddress` via domain/capabilities.ts | Admin capabilities and Game Knowledge | 8 |
| CapabilityEvent | Persisted entity | Capabilities | `CapabilityEvent` via domain/capabilities.ts | Admin capabilities and Game Knowledge | 22 |
| CapabilityState | Persisted entity | Capabilities | `CapabilityState` via domain/capabilities.ts | Admin capabilities and Game Knowledge | 15 |
| RewardScoringPolicy | Persisted entity | Repository core | `RewardScoringPolicy` via Prisma and owning route service | Registry-linked screens | 8 |
| RewardScoringWeight | Persisted entity | Repository core | `RewardScoringWeight` via Prisma and owning route service | Registry-linked screens | 4 |
| RewardCandidate | Persisted entity | Repository core | `RewardCandidate` via Prisma and owning route service | Registry-linked screens | 6 |
| RewardEvidenceEvent | Persisted entity | Repository core | `RewardEvidenceEvent` via Prisma and owning route service | Registry-linked screens | 14 |
| FactionStandingScoringPolicy | Persisted entity | Repository core | `FactionStandingScoringPolicy` via Prisma and owning route service | Registry-linked screens | 8 |
| FactionStandingScoringWeight | Persisted entity | Repository core | `FactionStandingScoringWeight` via Prisma and owning route service | Registry-linked screens | 4 |
| FactionStandingEvidenceEvent | Persisted entity | Repository core | `FactionStandingEvidenceEvent` via Prisma and owning route service | Registry-linked screens | 12 |
| AchievementDefinition | Persisted entity | Capabilities | `AchievementDefinition` via domain/capabilities.ts | Admin capabilities and Game Knowledge | 7 |
| ManagedAsset | Persisted entity | Asset and Prompt Manager | `ManagedAsset` via scripts/import-managed-assets.mjs | Admin Assets and all media screens | 11 |
| AssetPurposeLink | Persisted entity | Asset and Prompt Manager | `AssetPurposeLink` via scripts/import-managed-assets.mjs | Admin Assets and all media screens | 4 |
| PromptRecord | Persisted entity | Asset and Prompt Manager | `PromptRecord` via scripts/import-managed-assets.mjs | Admin Assets and all media screens | 7 |
| PromptVersion | Persisted entity | Asset and Prompt Manager | `PromptVersion` via scripts/import-managed-assets.mjs | Admin Assets and all media screens | 9 |
| MembershipGrant | Persisted entity | Membership | `MembershipGrant` via domain/membership.ts | Donation, Account, Admin Perks | 12 |
| MembershipRevocation | Persisted entity | Membership | `MembershipRevocation` via domain/membership.ts | Donation, Account, Admin Perks | 11 |
| Perk | Persisted entity | Membership | `Perk` via domain/membership.ts | Donation, Account, Admin Perks | 4 |
| StoreProduct | Persisted entity | Commerce | `StoreProduct` via domain/commerce.ts and server/payments.ts | Store, Account Orders, Admin Commerce | 7 |
| StoreVariant | Persisted entity | Commerce | `StoreVariant` via domain/commerce.ts and server/payments.ts | Store, Account Orders, Admin Commerce | 10 |
| Order | Persisted entity | Commerce | `Order` via domain/commerce.ts and server/payments.ts | Store, Account Orders, Admin Commerce | 9 |
| OrderLine | Persisted entity | Commerce | `OrderLine` via domain/commerce.ts and server/payments.ts | Store, Account Orders, Admin Commerce | 7 |
| StripeWebhookEvent | Persisted entity | Commerce | `StripeWebhookEvent` via domain/commerce.ts and server/payments.ts | Store, Account Orders, Admin Commerce | 7 |
| OrderPaymentConfirmation | Persisted entity | Commerce | `OrderPaymentConfirmation` via domain/commerce.ts and server/payments.ts | Store, Account Orders, Admin Commerce | 9 |
| PrintfulFulfillmentSubmission | Persisted entity | Commerce | `PrintfulFulfillmentSubmission` via domain/commerce.ts and server/payments.ts | Store, Account Orders, Admin Commerce | 6 |
| OrderRefund | Persisted entity | Commerce | `OrderRefund` via domain/commerce.ts and server/payments.ts | Store, Account Orders, Admin Commerce | 8 |
| OrderReturnEligibility | Persisted entity | Commerce | `OrderReturnEligibility` via domain/commerce.ts and server/payments.ts | Store, Account Orders, Admin Commerce | 4 |
| SpeciesGroup | Persisted entity | Canonical data | `SpeciesGroup` via typed imports and server/breed-research.ts | Admin Data and Game | 4 |
| PuzzleBlueprint | Persisted entity | Puzzle | `PuzzleBlueprint` via domain/puzzle-blueprint.ts | Admin Puzzle and Game Witness Trial | 5 |
| PuzzleBlueprintVersion | Persisted entity | Puzzle | `PuzzleBlueprintVersion` via domain/puzzle-blueprint.ts | Admin Puzzle and Game Witness Trial | 6 |
| PuzzleHintTemplate | Persisted entity | Puzzle | `PuzzleHintTemplate` via domain/puzzle-blueprint.ts | Admin Puzzle and Game Witness Trial | 6 |
| PuzzleChallengeAccepted | Persisted entity | Puzzle | `PuzzleChallengeAccepted` via domain/puzzle-blueprint.ts | Admin Puzzle and Game Witness Trial | 7 |
| ContactRequest | Persisted entity | Contact | `ContactRequest` via server/contact.ts | Public Contact and Admin operations | 9 |
| DonationCheckout | Persisted entity | Donations | `DonationCheckout` via server/donations.ts | Public Donation and Account Membership | 9 |
| Release | Persisted entity | Release operations | `Release` via server/releases.ts | Public Status and Admin Operations | 10 |
| ReleaseNoteItem | Persisted entity | Release operations | `ReleaseNoteItem` via server/releases.ts | Public Status and Admin Operations | 6 |
| DeploymentRecord | Persisted entity | Release operations | `DeploymentRecord` via server/releases.ts | Public Status and Admin Operations | 9 |
| DocumentBucket | Persisted entity | Document Builder | `DocumentBucket` via server/documents.ts | Admin Document Builder | 5 |
| DocumentSourcePoint | Persisted entity | Document Builder | `DocumentSourcePoint` via server/documents.ts | Admin Document Builder | 6 |
| DocumentAmendment | Persisted entity | Document Builder | `DocumentAmendment` via server/documents.ts | Admin Document Builder | 5 |
| DocumentDraft | Persisted entity | Document Builder | `DocumentDraft` via server/documents.ts | Admin Document Builder | 11 |
| GameSession | Persisted entity | Player runtime | `GameSession` via server/game-runtime.ts | Game viewport | 8 |
| GameTurn | Persisted entity | Player runtime | `GameTurn` via server/game-runtime.ts | Game viewport | 11 |
| City | Persisted entity | City geometry | `City` via settlement and City services | Admin City Builder | 8 |
| Parcel | Persisted entity | City geometry | `Parcel` via settlement and City services | Admin City Builder | 4 |
| Street | Persisted entity | City geometry | `Street` via settlement and City services | Admin City Builder | 4 |
| Building | Persisted entity | City geometry | `Building` via settlement and City services | Admin City Builder | 5 |
| Campaign | Persisted entity | Repository core | `Campaign` via Prisma and owning route service | Registry-linked screens | 4 |
| CampaignPlacement | Persisted entity | Repository core | `CampaignPlacement` via Prisma and owning route service | Registry-linked screens | 7 |
| CalendarOrdinal | Persisted entity | Calendar | `CalendarOrdinal` via server/player-calendar.ts | Game Calendar | 6 |

## API request/response contracts

Every route below has a corresponding key in `ApiContractMap`; Zod schemas and server-owned projections remain the runtime validators.

| Method | Path | Request owner | Response owner |
|---|---|---|---|
| GET | `/api/account/membership` | Route Zod schema or empty request | Route server projection or bounded error |
| GET | `/api/account/orders/:orderId` | Route Zod schema or empty request | Route server projection or bounded error |
| GET | `/api/account/orders` | Route Zod schema or empty request | Route server projection or bounded error |
| GET | `/api/account/sessions` | Route Zod schema or empty request | Route server projection or bounded error |
| POST | `/api/account/sessions/revoke-all-other` | Route Zod schema or empty request | Route server projection or bounded error |
| POST | `/api/account/sessions/revoke-other` | Route Zod schema or empty request | Route server projection or bounded error |
| GET | `/api/account/settings` | Route Zod schema or empty request | Route server projection or bounded error |
| PUT | `/api/account/settings` | Route Zod schema or empty request | Route server projection or bounded error |
| GET | `/api/admin/accounts/:userId` | Route Zod schema or empty request | Route server projection or bounded error |
| PATCH | `/api/admin/accounts/:userId/role` | Route Zod schema or empty request | Route server projection or bounded error |
| GET | `/api/admin/accounts` | Route Zod schema or empty request | Route server projection or bounded error |
| GET | `/api/admin/assets` | Route Zod schema or empty request | Route server projection or bounded error |
| POST | `/api/admin/beta-invitations/:id/approve` | Route Zod schema or empty request | Route server projection or bounded error |
| POST | `/api/admin/beta-invitations/:id/reject` | Route Zod schema or empty request | Route server projection or bounded error |
| GET | `/api/admin/beta-invitations` | Route Zod schema or empty request | Route server projection or bounded error |
| GET | `/api/admin/campaign` | Route Zod schema or empty request | Route server projection or bounded error |
| POST | `/api/admin/campaign` | Route Zod schema or empty request | Route server projection or bounded error |
| GET | `/api/admin/capabilities` | Route Zod schema or empty request | Route server projection or bounded error |
| POST | `/api/admin/capabilities` | Route Zod schema or empty request | Route server projection or bounded error |
| POST | `/api/admin/capabilities/:capabilityDefinitionVersionId/activate` | Route Zod schema or empty request | Route server projection or bounded error |
| GET | `/api/admin/capabilities/inspector` | Route Zod schema or empty request | Route server projection or bounded error |
| GET | `/api/admin/capabilities/scoring` | Route Zod schema or empty request | Route server projection or bounded error |
| POST | `/api/admin/capabilities/scoring` | Route Zod schema or empty request | Route server projection or bounded error |
| POST | `/api/admin/capabilities/scoring/:rewardScoringPolicyId/activate` | Route Zod schema or empty request | Route server projection or bounded error |
| GET | `/api/admin/commerce` | Route Zod schema or empty request | Route server projection or bounded error |
| POST | `/api/admin/data/:entityKey/import` | Route Zod schema or empty request | Route server projection or bounded error |
| GET | `/api/admin/documents` | Route Zod schema or empty request | Route server projection or bounded error |
| POST | `/api/admin/documents` | Route Zod schema or empty request | Route server projection or bounded error |
| GET | `/api/admin/perks/:perkId` | Route Zod schema or empty request | Route server projection or bounded error |
| PATCH | `/api/admin/perks/:perkId` | Route Zod schema or empty request | Route server projection or bounded error |
| GET | `/api/admin/perks` | Route Zod schema or empty request | Route server projection or bounded error |
| GET | `/api/admin/prompts` | Route Zod schema or empty request | Route server projection or bounded error |
| GET | `/api/admin/puzzles/blueprints` | Route Zod schema or empty request | Route server projection or bounded error |
| GET | `/api/admin/releases` | Route Zod schema or empty request | Route server projection or bounded error |
| POST | `/api/admin/releases` | Route Zod schema or empty request | Route server projection or bounded error |
| POST | `/api/admin/releases/:id/publish` | Route Zod schema or empty request | Route server projection or bounded error |
| POST | `/api/admin/settlements/complete-naming` | Route Zod schema or empty request | Route server projection or bounded error |
| POST | `/api/admin/settlements/found-city` | Route Zod schema or empty request | Route server projection or bounded error |
| GET | `/api/admin/settlements` | Route Zod schema or empty request | Route server projection or bounded error |
| POST | `/api/admin/settlements/migrate` | Route Zod schema or empty request | Route server projection or bounded error |
| GET | `/api/atlas/catalog` | Route Zod schema or empty request | Route server projection or bounded error |
| GET | `/api/auth/:` | Route Zod schema or empty request | Route server projection or bounded error |
| POST | `/api/auth/:` | Route Zod schema or empty request | Route server projection or bounded error |
| POST | `/api/beta-invitations/redeem` | Route Zod schema or empty request | Route server projection or bounded error |
| POST | `/api/beta-invitations/request` | Route Zod schema or empty request | Route server projection or bounded error |
| POST | `/api/contact` | Route Zod schema or empty request | Route server projection or bounded error |
| POST | `/api/donations/checkout` | Route Zod schema or empty request | Route server projection or bounded error |
| GET | `/api/health` | Route Zod schema or empty request | Route server projection or bounded error |
| GET | `/api/player/access` | Route Zod schema or empty request | Route server projection or bounded error |
| GET | `/api/player/calendar` | Route Zod schema or empty request | Route server projection or bounded error |
| GET | `/api/player/puzzles` | Route Zod schema or empty request | Route server projection or bounded error |
| POST | `/api/player/puzzles` | Route Zod schema or empty request | Route server projection or bounded error |
| GET | `/api/player/runtime` | Route Zod schema or empty request | Route server projection or bounded error |
| POST | `/api/player/runtime` | Route Zod schema or empty request | Route server projection or bounded error |
| GET | `/api/releases` | Route Zod schema or empty request | Route server projection or bounded error |
| GET | `/api/store/catalog` | Route Zod schema or empty request | Route server projection or bounded error |
| POST | `/api/store/checkout` | Route Zod schema or empty request | Route server projection or bounded error |
| POST | `/api/stripe/webhook` | Route Zod schema or empty request | Route server projection or bounded error |
| GET | `/api/version` | Route Zod schema or empty request | Route server projection or bounded error |

## Controlled enum catalog

| Enum | Values | Tokens |
|---|---:|---|
| Alignment | 3 | `ORDERED`, `CHAOS`, `NEUTRAL` |
| Faction | 3 | `CONCORD`, `RUIN`, `SCHISM` |
| SizeClass | 5 | `TINY`, `SMALL`, `MEDIUM`, `LARGE`, `EXTRA_LARGE` |
| PersonalityFamily | 80 | `ACCOUNTABILITY`, `AMBIGUITY`, `ANGER`, `APPETITE`, `ATTACHMENT`, `AUTHENTICITY`, `AUTHORITY`, `AUTONOMY`, `BELONGING`, `BOUNDARIES`, `CARE`, `CHANGE`, `CLOSURE`, `COLLECTIVE_MEMORY`, `COMPASSION`, `COMPETITION`, `CONFORMITY`, `CONTROL`, `COOPERATION`, `COURAGE`, `CURIOSITY`, `DESIRE`, `DISCIPLINE`, `DISSENT`, `DOMINANCE`, `DOUBT`, `DUTY`, `EMBODIMENT`, `EMPATHY`, `ENVY`, `EQUANIMITY`, `EXILE`, `EXPOSURE`, `EXPRESSION`, `FAIRNESS`, `FAITH`, `FEAR`, `FORCE`, `FORGIVENESS`, `GRIEF`, `HIERARCHY`, `HOPE`, `HOSPITALITY`, `IMPULSE`, `INDIVIDUALITY`, `INTIMACY`, `LAND`, `LEGITIMACY`, `LOYALTY`, `MEANING`, `MEMORY`, `MERCY`, `MORTALITY`, `NOVELTY`, `PATIENCE`, `PERFECTION`, `PERSEVERANCE`, `PERSPECTIVE`, `PLEASURE`, `POSSESSION`, `POWER`, `PROTECTION`, `PURPOSE`, `REACTANCE`, `RECIPROCITY`, `RECOGNITION`, `REPAIR`, `REPUTATION`, `RESTRAINT`, `RISK`, `SCARCITY`, `SECRECY`, `SELF_KNOWLEDGE`, `SELF_REGARD`, `STATUS`, `STEWARDSHIP`, `TRADITION`, `TRUST`, `TRUTH`, `VENGEANCE` |
| LatitudinalZone | 5 | `EQUATORIAL`, `TROPICS`, `TEMPERATE`, `TAIGA`, `POLAR` |
| CulturePoolId | 25 | `CP01`, `CP02`, `CP03`, `CP04`, `CP05`, `CP06`, `CP07`, `CP08`, `CP09`, `CP10`, `CP11`, `CP12`, `CP13`, `CP14`, `CP15`, `CP16`, `CP17`, `CP18`, `CP19`, `CP20`, `CP21`, `CP22`, `CP23`, `CP24`, `CP25` |
| WorldKey | 3 | `CONCORD`, `RUIN`, `SCHISM` |
| SpeciesKind | 4 | `HUMAN`, `BEAST`, `MYTHOS`, `PET` |
| ProtagonistImportance | 2 | `MINOR`, `MAJOR` |
| TimelineEventType | 4 | `HISTORICAL`, `ATROCITY`, `EXODUS`, `IN_TRANSIT` |
| InterludeType | 6 | `WWII`, `HISTORICAL`, `MYTH`, `SCIENCE`, `DEJA_VU`, `OTHER` |
| StructureOrientation | 3 | `ORDERED`, `NEUTRAL`, `CHAOS` |
| OperatingStyle | 3 | `TEAMWORK`, `SITUATIONAL`, `SOLO` |
| Motivation | 3 | `ALTRUISTIC`, `RECIPROCAL`, `SELFISH` |
| AdministrationMode | 3 | `CENTRALIZED`, `DELEGATED`, `DISTRIBUTED` |
| AuthoritySource | 3 | `APPOINTMENT`, `DIVINE_MANDATE`, `ELECTION` |
| LegitimacyBasis | 3 | `ANCESTRAL`, `CHARTERED`, `MARTIAL` |
| AllocationMode | 3 | `CUSTOMARY`, `MARKET`, `PLANNED` |
| OwnershipMode | 3 | `COMMON_USE`, `SHARED_TITLE`, `SINGLE_ENTITY` |
| PoliticalForm | 27 | `ACCLAIMED_IMPERATOR`, `APPOINTED_COMMISSION`, `APPOINTED_DIRECTORATE`, `CAPTAINS_COUNCIL`, `CHIEFTAIN_COUNCIL`, `CONSECRATED_REPUBLIC`, `COVENANT_ASSEMBLY`, `COVENANT_CROWN`, `DELEGATE_LEAGUE`, `DIVINE_THRONE`, `ELDER_MOOT`, `ELECTED_EXECUTIVE`, `ELECTIVE_CROWN`, `ESTATES_DIET`, `FEUDAL_ORDER`, `FREE_COMPANY`, `GARRISON_COMMAND`, `HALLOWED_CUSTOM`, `JUNTA`, `MILITANT_ORDER`, `MILITANT_THEOCRACY`, `POPULAR_FEDERATION`, `RAIDER_CONFEDERACY`, `REGENT_THRONE`, `REPUBLIC`, `TEMPLE_HIERARCHY`, `ZEALOT_BANDS` |
| EconomicForm | 9 | `COMMAND_DEMESNE`, `COMMUNE_PLAN`, `FOLK_COMMONS`, `GUILD_COMPACT`, `MONOPOLY_ESTATE`, `OPEN_BAZAAR`, `SHAREHOLDER_BOURSE`, `SYNDICATE_CARTEL`, `TRIBUTARY_DEMESNE` |
| LeadershipModel | 7 | `ASSEMBLY_PRIMACY`, `COLLECTIVE_EXECUTIVE`, `COUNCIL_PRIMACY`, `DUAL_EXECUTIVE`, `MILITARY_COMMAND`, `SACRED_OFFICE`, `SINGLE_EXECUTIVE` |
| SelectionMethod | 10 | `APPOINTMENT`, `CLERGY_SELECTION`, `COOPTATION`, `CUSTOMARY_SUCCESSION`, `DIRECT_ELECTION`, `DIVINE_DESIGNATION`, `HEREDITARY`, `INDIRECT_ELECTION`, `MILITARY_ACCLAMATION`, `SORTITION` |
| SuccessionMode | 10 | `APPOINTMENT`, `CLAN_OR_HOUSE_SELECTION`, `CLERGY_SELECTION`, `COUNCIL_COOPTATION`, `CUSTOMARY`, `ELECTION`, `HEREDITARY_DESIGNATED_HEIR`, `HEREDITARY_PRIMOGENITURE`, `MILITARY_ACCLAMATION`, `ROTATION` |
| OriginMode | 9 | `BIOLOGICAL`, `ASSEMBLED`, `ELEMENTAL_CONDENSATION`, `HEAVENFALL`, `MANIFESTED`, `PIT_BORN`, `RESURRECTED`, `TRANSFORMATION`, `UNKNOWN` |
| ReproductionMethod | 12 | `AQUATIC_SPAWNING`, `BROOD_POUCH`, `EGG_BEARING`, `EGG_LAYING`, `EXTERNAL_SPAWNING`, `HERMAPHRODITIC_COCOON`, `LIVE_BIRTH`, `MAGICAL_GESTATION`, `PARTHENOGENESIS`, `SELF_FERTILIZING`, `NONE`, `UNKNOWN` |
| JuvenileStage | 26 | `AMMOCOETE_LARVA`, `AQUATIC_LARVA`, `AQUATIC_NYMPH`, `CALF`, `CALIBRATION_STAGE`, `CATERPILLAR`, `CHICK`, `CORE_FORM`, `DEPENDENT_CHILD`, `DEPENDENT_INFANT`, `DEPENDENT_YOUNG`, `ESSENCE_FORM`, `FIRST_SHIFT`, `FRY`, `HATCHLING`, `JUVENILE`, `LARVA`, `METAMORPHOSIS`, `NYMPH`, `PLANKTONIC_LARVA`, `POUCH_YOUNG`, `PUP`, `PUPA`, `SPIDERLING`, `TADPOLE`, `TRILOBITE_LARVA` |
| NurseryMode | 12 | `NONE`, `GESTATIONAL_CARE`, `EGG_INCUBATION`, `BROOD_CARE`, `POUCH_CARE`, `AQUATIC_NURSERY`, `LARVAL_NURSERY`, `COLONY_NURSERY`, `CONSTRUCT_ASSEMBLY`, `ESSENCE_DEVELOPMENT`, `DEPENDENT_CHILDHOOD`, `UNKNOWN` |
| LongevityClass | 6 | `SHORT_LIVED`, `HUMAN_BASELINE`, `LONG_LIVED`, `EXTREMELY_LONG_LIVED`, `IN_PERPETUITY`, `UNKNOWN` |
| NaturalMortalityMode | 5 | `NORMAL`, `REDUCED`, `AGELESS`, `NONE`, `UNKNOWN` |
| SoulDisposition | 8 | `REINCARNATES`, `ONE_TIME_TRANSFERENCE`, `TERMINAL_BOUND`, `RETURNS_TO_WELL`, `DISSIPATES`, `NO_SOUL`, `SPECIAL_EXCEPTION`, `UNKNOWN` |
| ContinuityGroupType | 12 | `FAMILY`, `CLAN`, `HOUSE`, `BROOD`, `MAKER_LINE`, `ORDER`, `CHOIR`, `COVEN`, `PACK`, `COLONY`, `NONE`, `UNKNOWN` |
| ContinuityPropagationMode | 14 | `MATERNAL_DESCENT`, `PATERNAL_DESCENT`, `BILATERAL_DESCENT`, `MAKER_ASSIGNMENT`, `SIRE_LINE`, `ADOPTION`, `INITIATION`, `SPONSORSHIP`, `APPOINTMENT`, `CONTRACT`, `REINCARNATION_CONTINUITY`, `SELF_SELECTED`, `NONE`, `UNKNOWN` |
| NameGenderBucket | 3 | `FEMININE`, `MASCULINE`, `NEUTRAL` |
| FoodBroadCategory | 7 | `ANIMAL`, `ARCANE_ESSENCE`, `ELEMENTAL`, `FUNGUS_DETRITUS`, `MINERAL_MATERIAL`, `NO_FEEDING`, `PLANT` |
| FoodSpecific | 64 | `AIR_WIND`, `ALGAE_SEAWEED`, `ANGER`, `AQUATIC_PLANTS`, `ARTHROPODS`, `BAMBOO`, `BERRIES`, `BIRDS`, `BLOOD`, `BONE_MARROW`, `BREAD_PORRIDGE`, `CARRION`, `COLD_ICE`, `DAIRY`, `DESIRE`, `DETRITUS_COMPOST`, `DREAMS`, `EGGS`, `ELECTRICITY_STORM`, `EMOTION`, `ESSENCE_OF_FAITH`, `FEAR`, `FERMENTED_DRINK`, `FIRE`, `FISH`, `FLOWERS_POLLEN`, `FRUIT`, `FUNGI`, `GLASS_SAND`, `GRASSES`, `GRIEF`, `HERBS_SPICES`, `HONEY`, `INSECTS`, `LEAVES`, `LIGHT`, `MAGIC`, `MEMORY`, `METAL_ORE`, `MIXED_DIET`, `MOLLUSKS`, `MOONLIGHT`, `MUSIC_ATTENTION`, `NECROMANTIC_ESSENCE`, `NECTAR`, `NO_FEEDING`, `NUTS`, `OATHS_HONOR`, `OIL_FUEL`, `PLANKTON_KRILL`, `PREPARED_MEALS`, `RED_MEAT`, `REPTILES_AMPHIBIANS`, `ROOTS_TUBERS`, `SALT`, `SAP_RESIN`, `SEEDS_GRAINS`, `SHELLFISH_CRUSTACEANS`, `SIN`, `SMALL_GAME`, `STONE_CLAY`, `WATER`, `WOODY_BIOMASS`, `WORMS_LARVAE` |
| TerrainBroad | 12 | `BUILT_ENVIRONMENT`, `COASTAL`, `DESERT`, `FOREST`, `FRESHWATER`, `GENERALIST`, `GRASSLAND`, `MOUNTAIN`, `OCEAN`, `POLAR_ICE`, `SUBTERRANEAN`, `WETLAND` |
| TerrainSpecific | 63 | `ALPINE`, `BOG`, `BOREAL_FOREST`, `BURROW`, `CANOPY`, `CANYON`, `CASTLE`, `CAVE`, `CITY`, `CLIFF`, `CLOUD_FOREST`, `COASTAL_CLIFF`, `COLD_DESERT`, `CORAL_REEF`, `DELTA`, `DUNES`, `ESTUARY`, `FARMLAND`, `FJORD`, `FLOODPLAIN`, `FLOWERING_HABITAT`, `FOREST_EDGE`, `FOREST_FLOOR`, `GENERALIST`, `GLACIER`, `HOT_DESERT`, `ISLAND`, `KARST`, `KELP_FOREST`, `LAKE`, `MANGROVE`, `MARSH`, `MEADOW`, `MINE`, `MONTANE_FOREST`, `MUDFLAT`, `OASIS`, `OLD_GROWTH_FOREST`, `PACK_ICE`, `PELAGIC`, `PLATEAU`, `POND`, `PRAIRIE`, `RAIN_FOREST`, `RIVER`, `ROAD`, `RUINS`, `SAVANNA`, `SCRUBLAND`, `SEAGRASS_BED`, `SEA_CAVE`, `SHADOW_FOREST`, `SOIL`, `STEPPE`, `SWAMP`, `TEMPLE`, `TUNDRA`, `TUNNEL`, `UNDERGROUND_RIVER`, `VILLAGE`, `VOLCANIC`, `WOODLAND`, `WORKSHOP` |
| CitationQuality | 5 | `VERY_LOW`, `LOW`, `MODERATE`, `HIGH`, `VERY_HIGH` |
| SourceType | 11 | `BOOK`, `JOURNAL_ARTICLE`, `WEBPAGE`, `REPORT`, `THESIS`, `DATASET`, `ARCHIVE`, `INTERVIEW`, `AUDIOVISUAL`, `PRIMARY_DOCUMENT`, `OTHER` |
| ContributorType | 7 | `AUTHOR`, `EDITOR`, `TRANSLATOR`, `DIRECTOR`, `ORGANIZATION`, `INTERVIEWEE`, `OTHER` |
| ResearchCategory | 13 | `EXODUS_PROGRAM`, `REWARD`, `SPECIES`, `HISTORICAL_EVENT`, `CULTURAL_WOUND`, `PERSON`, `PLACE`, `INSTITUTION`, `ORGANIZATION`, `SYMBOL`, `TOME`, `TECHNOLOGY_OR_SYSTEM`, `OTHER` |
| DepartmentWitnessPathStatus | 3 | `NORMAL`, `EXEMPT`, `EXCLUDED` |
| PuzzleSharedComponentId | 31 | `PUZCMP_AUDIO_TRANSPORT`, `PUZCMP_MUSIC_NOTATION_RAIL`, `PUZCMP_RHYTHM_HAPTIC_TRACK`, `PUZCMP_TILE_SIGNAL`, `PUZCMP_LANTERN_LAYER_CONTROL`, `PUZCMP_GRID_VIEWPORT`, `PUZCMP_EIGHT_NEIGHBOR_NAV`, `PUZCMP_DIRECTIONAL_AUDIO_HAPTIC`, `PUZCMP_LOGIC_GRID`, `PUZCMP_SET_WORKBENCH`, `PUZCMP_DOCUMENT_COMPARE`, `PUZCMP_MATRIX_LAB`, `PUZCMP_IMAGE_TRANSFORM`, `PUZCMP_QR_BOUND_ROUTE`, `PUZCMP_COLOR_CHANNEL_LAB`, `PUZCMP_SHAPE_LAYER`, `PUZCMP_SLIDING_BLOCK_BOARD`, `PUZCMP_DRAG_CONNECTOR_BOARD`, `PUZCMP_MECHANISM_SIM`, `PUZCMP_POLYHEDRON_VIEWER`, `PUZCMP_NON3D_EQUIVALENT`, `PUZCMP_CHESS_REPLAY`, `PUZCMP_SPECTROGRAM`, `PUZCMP_TIMELINE_RESEARCH`, `PUZCMP_HINT_PANEL`, `PUZCMP_TIMER_BANNER`, `PUZCMP_ANSWER_SUBMISSION`, `PUZCMP_UNDO_RESET_HISTORY`, `PUZCMP_ACCESSIBILITY_MODE_SWITCHER`, `PUZCMP_PRINTABLE_WORKSHEET`, `PUZCMP_COLLABORATION_PACKET` |
| PuzzleFamily | 9 | `TEXT_LANGUAGE_LITERARY`, `CRYPTO_NUMERIC_DATA`, `VISUAL_COLOR_OPTICAL`, `SPATIAL_FOLDING_GEOMETRY`, `AUDIO_MUSIC_SPECTRAL`, `LOGIC_CONSTRAINT`, `HISTORICAL_RESEARCH`, `CONSTRUCTION_SIMULATION`, `CROSS_MODAL` |
| PuzzleDifficultyTier | 5 | `TIER_1_INITIATE`, `TIER_2_ADEPT`, `TIER_3_EXPERT`, `TIER_4_MASTER`, `TIER_5_ORDEAL` |
| CapabilityValueKind | 5 | `BOOLEAN`, `SCORE`, `COUNTER`, `ENUM`, `REFERENCE` |
| CompanionKey | 11 | `A`, `B`, `C`, `D`, `E`, `F`, `G`, `H`, `I`, `J`, `K` |
| RegionId | 25 | `R01`, `R02`, `R03`, `R04`, `R05`, `R06`, `R07`, `R08`, `R09`, `R10`, `R11`, `R12`, `R13`, `R14`, `R15`, `R16`, `R17`, `R18`, `R19`, `R20`, `R21`, `R22`, `R23`, `R24`, `R25` |
| NameStatus | 2 | `WORKING`, `CANONICAL` |
| SettlementClassification | 5 | `HAMLET`, `VILLAGE`, `TOWN`, `CITY`, `METROPOLIS` |
| SettlementSurfaceType | 10 | `LAND`, `COASTAL_LAND`, `SHALLOW_WATER`, `REEF`, `FLOATING_ISLAND`, `UNDERWATER`, `ICE`, `WETLAND`, `LAKE`, `DELTA` |
| CharacterType | 3 | `MAJOR`, `SUPPORTING`, `EXTRA` |
| LatticeId | 25 | `L01`, `L02`, `L03`, `L04`, `L05`, `L06`, `L07`, `L08`, `L09`, `L10`, `L11`, `L12`, `L13`, `L14`, `L15`, `L16`, `L17`, `L18`, `L19`, `L20`, `L21`, `L22`, `L23`, `L24`, `L25` |
| SettlementPopulationEventType | 4 | `FOUNDING`, `GROWTH`, `MIGRATION_IN`, `MIGRATION_OUT` |
| CapabilityOperation | 3 | `SET`, `ADD`, `CLEAR` |
| CapabilityRequirementOperator | 10 | `EXISTS`, `NOT_EXISTS`, `EQ`, `NEQ`, `GT`, `GTE`, `LT`, `LTE`, `IN`, `NOT_IN` |
| CapabilityParameterKind | 2 | `ENTITY`, `STRING` |
| CapabilityMonotonicPolicy | 4 | `NONE`, `TRUE_ONLY`, `NONDECREASING`, `NONINCREASING` |
| CapabilityDefinitionVersionStatus | 3 | `DRAFT`, `ACTIVE`, `RETIRED` |
| CapabilityScopeType | 5 | `ACCOUNT`, `PLAYTHROUGH`, `WORLD`, `PARTY`, `CHARACTER` |
| ScoringPolicyStatus | 3 | `DRAFT`, `ACTIVE`, `RETIRED` |
| RewardEvidenceKind | 6 | `RUMOR`, `EVIDENCE`, `PROOF`, `DOUBT`, `CONTRADICTION`, `REFUTATION` |
| FactionStandingEvidenceKind | 8 | `MINOR_HARM`, `MAJOR_HARM`, `MINOR_AID`, `MAJOR_AID`, `PUBLIC_CENSURE`, `PRIVATE_CENSURE`, `PUBLIC_SUPPORT`, `PRIVATE_SUPPORT` |
| KnowledgeBaseBlockKind | 4 | `HEADING`, `PARAGRAPH`, `QUOTE`, `LIST` |
| CalendarTrigger | 4 | `CONJUNCTION_BEGINS`, `CONJUNCTION_DEADLINE`, `BEACON_PREPARE`, `BEACON_WARNING` |
| ArkStatus | 4 | `OPERATIONAL`, `CANNIBALIZED`, `DAMAGED`, `DESTROYED` |
| DefinitionType | 2 | `INTERNAL`, `EXTERNAL` |
| Holiday | 4 | `DEEPWATCH`, `THAWMARCH`, `GOLDTIDE`, `VEILFALL` |
| EntityType | 36 | `CULTURE`, `CHARACTER`, `PROTAGONIST`, `ANTAGONIST`, `WITNESS`, `ARCHITECT`, `DEPARTMENT`, `SPECIES`, `SPECIES_GROUP`, `BREED`, `PERSONALITY_EXPRESSION`, `TIMELINE_EVENT`, `INTERLUDE`, `INTERLUDE_SUBSTITUTION`, `PILLAR`, `LESSON`, `TRANSITION`, `LAYETTE`, `ARK`, `CONSTELLATION`, `LEGENDARY_REWARD`, `SOUL`, `POINT_OF_INTEREST`, `SITE`, `SETTLEMENT`, `MATRIX`, `COMPANION`, `TOME`, `DEFINITION`, `KNOWLEDGE_BASE_ITEM`, `CAPABILITY_DEFINITION`, `ACHIEVEMENT_DEFINITION`, `SOURCE`, `CITATION`, `AUTHORED_NARRATIVE`, `NPC_CONVERSATION_GRAPH` |
| Heirloom | 15 | `NECKLACE`, `BRACELET`, `EARRINGS`, `CLOAK_CLASP`, `LIGHTER`, `POCKETWATCH`, `COIN_HEAD_BLACKENED`, `COIN_TAIL_BLACKENED`, `RING`, `TATTOO`, `BIRTHMARK`, `BROOCH`, `HAIR_BARRETTE`, `BELT_BUCKLE`, `BACKPACK_CLASP` |
| AgeEligibility | 2 | `ADULT_18_PLUS`, `MINOR_14_17_GUARDIAN_CONSENTED` |
| FriendInvitationRequestStatus | 4 | `PENDING`, `APPROVED`, `REJECTED`, `INVITED` |
| ExternalBulkApiState | 2 | `OFF`, `ON` |
| MembershipGrantSource | 2 | `SUBSCRIPTION`, `DONATION` |
| PerkStatus | 2 | `ACTIVE`, `INACTIVE` |
| PaymentProvider | 1 | `STRIPE` |
| FulfillmentProvider | 1 | `PRINTFUL` |
| ReleaseNotesStatus | 3 | `DRAFT`, `PUBLISHED`, `SUPERSEDED` |
| ReleaseAudience | 3 | `PLAYERS`, `OPERATORS`, `BOTH` |
| ReleaseNoteCategory | 5 | `ADDED`, `CHANGED`, `FIXED`, `SECURITY`, `KNOWN_ISSUE` |
| ContactTopic | 8 | `ACCESSIBILITY`, `CULTURAL_RESEARCH`, `GENERAL`, `LEGAL`, `PARTNERSHIP`, `PRESS`, `PRIVACY`, `SECURITY` |
| ContactRequestStatus | 4 | `RECEIVED`, `DELIVERY_PENDING`, `DELIVERED`, `DELIVERY_FAILED` |
| GameTurnStatus | 4 | `RECEIVED`, `PROVIDER_PENDING`, `COMPLETED`, `FAILED` |
| DocumentDraftStatus | 3 | `DRAFT`, `REVIEWED`, `PUBLISHED` |
| DeploymentStatus | 5 | `PLANNED`, `DEPLOYING`, `HEALTHY`, `FAILED`, `ROLLED_BACK` |
| CampaignObjectType | 16 | `PILLAR`, `LESSON`, `IN_TRANSIT`, `EXODUS`, `TRANSITION`, `DEJA_VU`, `COMPANION`, `ATROCITY`, `WITNESS`, `ARCHITECT`, `LEGENDARY_REWARD`, `HOLIDAY`, `WWII_INTERLUDE`, `MYTH_INTERLUDE`, `SCIENCE_INTERLUDE`, `HISTORICAL_INTERLUDE` |
| DonationCheckoutStatus | 4 | `PENDING`, `CONFIRMED`, `EXPIRED`, `FAILED` |
| StoreProductType | 3 | `POSTER`, `MUG`, `HOODIE` |
| KnowledgeBaseDisclosureMode | 4 | `APPEND_BLOCKS`, `INSERT_AFTER_BLOCK`, `REPLACE_BLOCK`, `REPLACE_ENTRY` |
| PuzzleHintKind | 2 | `DIRECTIONAL`, `GUIDED` |
| BulkOperation | 5 | `QUERY`, `CREATE`, `UPDATE`, `DELETE`, `IMPORT` |
| ImportAliasDisposition | 2 | `DIRECT`, `ALIASED` |
| ImportResultState | 3 | `UNCHANGED`, `CHANGED`, `FAILED` |
| MembershipRevocationReason | 1 | `DONATION_REFUND` |
| ManagedAssetMediaKind | 3 | `IMAGE`, `AUDIO`, `VIDEO` |
| PromptFamily | 4 | `IMAGE`, `MUSIC`, `PUZZLE`, `NAMING` |
| PromptStatus | 3 | `OUTSTANDING`, `READY`, `COMPLETED` |
| Loquacity | 3 | `LIGHT_BANTER`, `TALKATIVE`, `TO_THE_POINT` |
| EmotionalTemperature | 3 | `COMPOSED`, `IRRITABLE`, `JOYFUL` |
| OutlookOrientation | 3 | `NEUTRAL`, `OPTIMISTIC`, `PESSIMISTIC` |
| CollaborativePosture | 3 | `HELPFUL`, `JUST_ENOUGH`, `WITHHOLDING` |
| BreedResearchDimension | 12 | `ADMINISTRATION_MODE`, `STRUCTURE_ORIENTATION`, `OPERATING_STYLE`, `MOTIVATION`, `AUTHORITY_SOURCE`, `LEGITIMACY_BASIS`, `ALLOCATION_MODE`, `OWNERSHIP_MODE`, `LOQUACITY`, `EMOTIONAL_TEMPERATURE`, `OUTLOOK_ORIENTATION`, `COLLABORATIVE_POSTURE` |
| BreedResearchReviewStatus | 4 | `DRAFT`, `PENDING_REVIEW`, `APPROVED`, `REJECTED` |
| BreedResearchProvenanceKind | 2 | `MANUAL`, `IMPORT` |
| BreedDimensionValue | 35 | `CENTRALIZED`, `DELEGATED`, `DISTRIBUTED`, `ORDERED`, `NEUTRAL`, `CHAOS`, `TEAMWORK`, `SITUATIONAL`, `SOLO`, `ALTRUISTIC`, `RECIPROCAL`, `SELFISH`, `APPOINTMENT`, `DIVINE_MANDATE`, `ELECTION`, `ANCESTRAL`, `CHARTERED`, `MARTIAL`, `CUSTOMARY`, `MARKET`, `PLANNED`, `COMMON_USE`, `SHARED_TITLE`, `SINGLE_ENTITY`, `LIGHT_BANTER`, `TALKATIVE`, `TO_THE_POINT`, `COMPOSED`, `IRRITABLE`, `JOYFUL`, `OPTIMISTIC`, `PESSIMISTIC`, `HELPFUL`, `JUST_ENOUGH`, `WITHHOLDING` |

## Wireframe view models

All 274 active registry rows use `WireframeViewModel`: manifest identity, shell owner, governed revision, viewport, and explicit loading/empty/error/ready/success/denied state. Modal rows retain their parent owner and are not promoted to invented routes.

## Rejected-invention scan

The generated catalog and forward map contain none of the rejected parallel ownership or candidate/promotion types. `Witness` is the canonical story entity; `BreedResearchEvidence` is the typed research owner; `PointOfInterest` and `Site` remain the Atlas records.
