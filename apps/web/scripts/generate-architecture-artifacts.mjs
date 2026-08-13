import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const root = resolve(repositoryRoot, "docs/architecture");
const sourceRoot = resolve(root, "mermaid");
const svgRoot = resolve(root, "svg");
const prismaSchema = await readFile(resolve(repositoryRoot, "apps/web/prisma/schema.prisma"), "utf8");
const prismaModels = [...prismaSchema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)].map((match) => ({
  name: match[1],
  body: match[2],
}));
const prismaModelNames = new Set(prismaModels.map(({ name }) => name));

const processDiagrams = [
  ["P01", "Authenticated session resolution", ["Request", "Better Auth", "Session", "User", "Role projection", "Bounded response"], "User, Session", "Auth and protected routes"],
  ["P02", "Sign up and verify-email modal", ["Sign Up form", "Age eligibility", "Create User", "Send verification", "Verify Email modal", "Verified session"], "User, Verification", "AUTH001, AUTH004"],
  ["P03", "Profile change-email modal", ["Profile", "Change Email modal", "Re-authenticate", "Send verification", "Confirm new email", "Invalidate other sessions"], "User, Session, Verification", "ACC003, ACC004"],
  ["P04", "Passkey and two-factor enrollment", ["Security settings", "Re-authenticate", "Register factor", "Verify challenge", "Persist credential", "Recovery state"], "Passkey, TwoFactor, User", "Account security states"],
  ["P05", "Beta invitation lifecycle", ["Consent request", "Persist request", "Admin review", "Issue code", "Email code", "Redeem once", "Set eligibility"], "BetaInviteRequest, BetaInvitationCode, User", "PUB023 and Admin invitation states"],
  ["P06", "Authorization and player access", ["Session", "Canonical role", "Admin capability", "Beta eligibility", "Player access decision", "Allow or deny"], "User, MembershipGrant", "Admin, Account, Game"],
  ["P07", "Account session revocation", ["List server projection", "Select other session", "Re-authenticate", "Revoke token", "Audit result", "Refresh list"], "Session, User", "Account sessions"],
  ["P08", "Membership entitlement reduction", ["Payment evidence", "MembershipGrant", "MembershipRevocation", "Chronological reduction", "Effective entitlement", "Member benefits"], "MembershipGrant, MembershipRevocation", "Donation and Account membership"],
  ["P09", "Donation checkout and membership grant", ["Eligible user", "Choose 10 to 100 dollars", "Stripe checkout", "Signed webhook", "Payment confirmation", "Grant 1 6 or 15 months"], "User, StripeWebhookEvent, MembershipGrant", "PUB009, PUB020, PUB021"],
  ["P10", "Company contact submission", ["Select topic", "Validate fields", "Persist ContactRequest", "Route recipient", "Resend delivery", "Receipt and target"], "ContactRequest and Resend provider port", "PUB015"],
  ["P11", "Nine-feature carousel", ["Nine governed cards", "Three-second timer", "Advance", "Endpoint dwell", "Reverse", "Pause on focus", "Reduced-motion stop"], "FeatureViewModel, ManagedAsset", "Home and Features"],
  ["P12", "Store catalog projection", ["StoreProduct", "Available variants", "Managed artwork", "Server prices", "Catalog response", "Product screen"], "StoreProduct, StoreVariant, ManagedAsset", "Store catalog and product"],
  ["P13", "Authenticated merchandise checkout", ["Cart lines", "Authenticate", "Resolve variants", "Authoritative prices", "Create Order", "Stripe checkout", "Return URL"], "Order, OrderLine, StoreVariant", "Store cart and checkout"],
  ["P14", "Signed Stripe webhook", ["Raw request bytes", "Verify signature", "Deduplicate event", "Database transaction", "Payment confirmation", "Membership or order transition"], "StripeWebhookEvent, OrderPaymentConfirmation", "Provider API"],
  ["P15", "Printful fulfillment after payment", ["Confirmed order", "Assert payment confirmation", "Build configured request", "Printful port", "Persist submission", "Expose safe status"], "OrderPaymentConfirmation, PrintfulFulfillmentSubmission", "Admin commerce and Account order"],
  ["P16", "Refund and return eligibility", ["Order status", "Configured policy", "Return eligibility", "Stripe refund", "Signed refund event", "OrderRefund", "Membership adjustment if donation"], "Order, OrderRefund, OrderReturnEligibility", "Account returns and Admin commerce"],
  ["P17", "Managed asset final-byte intake", ["Exact source preflight", "Magic validation", "Metadata strip", "Technical probe", "SHA-256 final bytes", "Spaces upload", "Remote stream verify", "Atomic purpose link"], "ManagedAsset, AssetPurposeLink", "Public media, Atlas, Admin assets"],
  ["P18", "Safe globe-package extraction", ["New temporary root", "Inventory central directory", "Reject unsafe types and paths", "Bound size and ratio", "Exact member match", "Stream extract", "Checksum inventory"], "AssetSourceManifest", "Admin assets and Atlas"],
  ["P19", "Atlas R09 release validation", ["Resolve controlled dataset root", "Verify deployment and file manifests", "Validate JSON schemas", "Check canonical invariants", "Load EPSG 4326 records", "Include authoritative SITE-0401"], "R09ReleaseManifest, Site, PointOfInterest", "Atlas admin"],
  ["P20", "Atlas two-dimensional layers", ["Layer choice", "Physical Region Site or POI coordinates", "Resolve Region through Region Mapping", "Expose derived LatticeId", "Render EPSG 4326 marker overlay", "Shared selection", "Detail panel"], "ManagedAsset, Site, PointOfInterest, Settlement, RegionLatticeMapping", "Atlas 2D screens"],
  ["P21", "Owner WebGL2 globe renderer", ["Managed albedo", "WebGL2 context", "Sphere 256 by 512", "UV and shaders", "Lighting and camera", "Inertia and zoom", "Separate marker projection", "Accessible fallback"], "ManagedAsset, AtlasGlobeViewModel", "Atlas 3D and Game globe"],
  ["P22", "Shared Atlas selection", ["Select physical marker", "Canonical record and RegionId", "Resolve Region Mapping", "Project derived Lattice topology", "Selection store", "Project coordinates on globe", "Open detail", "Player disclosure filter"], "Site, PointOfInterest, Settlement, RegionLatticeMapping, AtlasConnection", "Atlas 2D, Atlas 3D, Game map"],
  ["P23", "Reset Worlds required control boundary", ["Owner authorization", "Typed confirmation", "Verified backup", "Exact reset scope required", "Transactional reset", "Immediate canonical reseed", "Commit and audit"], "SettlementWorld, SettlementPopulationEvent, City; implementation blocked until exact destructive scope is owned", "Admin Reset Worlds"],
  ["P24", "Canonical initial Breed seed", ["Region founder manifest", "Included Species", "All Species Breeds", "Allocate 1600 each", "Name then ID remainder", "Three World keys", "Founding events"], "Species, Breed, SettlementWorld, SettlementPopulationEvent", "Admin seed and Reset Worlds"],
  ["P25", "Found City", ["Owning world context", "Choose Site", "Choose origin populations", "Validate departures", "Ceil 90 percent arrival", "Apportion by Breed", "Name with nearby empty", "Atomic create and events"], "Site, Settlement, SettlementWorld, Breed", "Admin Found City"],
  ["P26", "Migrate", ["Origin SettlementWorld", "Breed amounts", "Existing Settlement or Site", "Validate population", "Migration-out event", "Migration-in event or new city", "Recompute dominant Breed"], "Settlement, Site, SettlementWorld, SettlementPopulationEvent", "Admin Migrate"],
  ["P27", "Settlement population replay", ["Ordered append-only events", "Replay by year and sequence", "Reject negative totals", "Rank population", "Breed-name tie break", "Breed-ID final tie break", "Project Culture"], "SettlementPopulationEvent, Breed, Culture", "Atlas settlement history"],
  ["P28", "Settlement naming prompt", ["Selected Site", "Breed populations", "Culture context", "Nearby exact empty array", "Immutable prompt version", "Provider request", "Validate proposal", "Naming completion"], "PromptRecord, PromptVersion, Settlement", "Found City and naming"],
  ["P29", "Campaign planner persistence", ["World context", "Eighteen Book rows", "Drag governed object or edit explicit grouping membership", "Derive exact Book segments", "Validate complete linked group or three-value partition", "Commit one serializable transaction", "Return placements plus derived grouping projection", "Render each contiguous segment by row span"], "Campaign, CampaignPlacement, BookGroupingDefinition, BookGroupingValue", "CAM002 through CAM007 and Campaign world states"],
  ["P30", "Puzzle blueprint versioning", ["Stable blueprint root", "Create immutable version", "Deterministic generator", "Two answer-free hints", "Validation preview", "Publish version"], "PuzzleBlueprint, PuzzleBlueprintVersion, PuzzleHintTemplate", "Admin Puzzle states"],
  ["P31", "Puzzle acceptance and countdown", ["Player challenge offer", "Explicit accept", "Persist acceptedAt", "Start 2160000 seconds", "Generate instance", "Directional hint", "Guided hint", "Submit answer"], "PuzzleChallengeAccepted, PuzzleBlueprintVersion", "Game Witness Trial"],
  ["P32", "Capability event reduction", ["Resolve immutable definition version", "Resolve typed address and explicit scope", "Validate SET ADD or CLEAR", "Append with database sequence and idempotency", "Database trigger projects state", "CLEAR records absence", "Compare deterministic rebuild"], "CapabilityDefinitionVersion, CapabilityAddress, CapabilityEvent, CapabilityState", "CAP01, CAP02, CAP05, Knowledge and achievements"],
  ["P33", "Knowledge disclosure", ["Base blocks", "Scoped capability projection", "Validate recursive ALL ANY NOT tree", "Evaluate fully bound addresses", "Reveal append or replace", "Collect visible citations", "Deduplicate first use", "Player-safe response"], "KnowledgeBaseItem, KnowledgeBaseDisclosure, CapabilityState, Citation", "CAP03 and Game Knowledge"],
  ["P34", "Typed Breed research authoring", ["Select Breed and dimension", "Controlled value", "Legitimate Source", "Citation", "Begin transaction", "Research assertion", "BreedResearchEvidence", "Commit typed owner"], "BreedResearchValue, BreedResearchEvidence, Research", "Admin Breed Research"],
  ["P35", "Atomic typed entity import", ["Upload JSON YAML Markdown or HTML", "Parse", "Map fields", "Validate schema-derived contract", "Preview errors", "Begin transaction", "Create missing", "Reject canonical drift", "Append bulk operation audit"], "Schema-derived entity contract, repository import requests, BulkOperationAudit", "Admin Data import and Bulk Operations states"],
  ["P36", "Canonical document builder", ["Ordered source bullets", "Amendments", "Document bucket", "Generate draft", "Persist version", "Review", "Publish export", "Keep bullets authoritative"], "DocumentBucket, DocumentSourcePoint, DocumentDraft", "Admin Document Builder"],
  ["P37", "Authenticated game turn", ["Eligible player", "Player-safe context", "Voice or text", "Runtime port", "Persist turn", "NPC response", "Discovery changes", "Refresh viewport"], "GameSession, GameTurn, KnowledgeBaseItem", "Game viewport"],
  ["P38", "Release-note publication", ["Verified exact SHA", "Draft note sections", "Review", "Publish ReleaseNoteItem rows", "Bind running version", "Public archive", "Safe version response"], "Release, ReleaseNoteItem", "Admin Release and public Status"],
  ["P39", "Exact-SHA production deployment", ["Pushed 40-character SHA", "Complete gates", "Dry run", "PostgreSQL backup", "Asset reconcile", "Fetch exact commit", "Migrate deploy", "Restart systemd", "Smoke and version proof"], "Release, DeploymentRecord", "Operations and production"],
  ["P40", "Application rollback boundary", ["Failed post-deploy check", "Record failure", "Keep database migration", "Select prior healthy SHA", "Deploy application only", "Restart service", "Verify health", "Open recovery plan"], "DeploymentRecord and externally verified backup artifact", "Operations"],
];

const entityDiagrams = [
  ["E01", "Identity and authentication", ["User", "Session", "Account", "Passkey", "TwoFactor"], "User, Session, Account, Passkey, TwoFactor", "Auth and Account"],
  ["E02", "Organization and access", ["Organization", "Member", "Invitation", "User", "ExternalBulkApiSession", "BulkOperationAudit"], "Organization, Member, Invitation, User, ExternalBulkApiSession, BulkOperationAudit", "Admin access and external Bulk Operations"],
  ["E03", "Beta invitation ownership", ["User", "BetaInviteRequest", "BetaInvitationCode"], "User, BetaInviteRequest, BetaInvitationCode", "Public invite and Admin invitations"],
  ["E04", "Membership ledger", ["User", "MembershipGrant", "MembershipRevocation"], "MembershipGrant, MembershipRevocation", "Donation and Account"],
  ["E05", "Commerce persistence", ["User", "StoreProduct", "StoreVariant", "Order", "OrderLine", "StripeWebhookEvent", "OrderPaymentConfirmation", "PrintfulFulfillmentSubmission", "OrderRefund", "OrderReturnEligibility"], "Commerce models", "Store, Account, Admin commerce"],
  ["E06", "Managed assets and purposes", ["ManagedAsset", "AssetPurposeLink", "PromptVersion", "AchievementDefinition", "StoreProduct"], "ManagedAsset, AssetPurposeLink", "All media consumers"],
  ["E07", "Prompt version ownership", ["PromptRecord", "PromptVersion", "ManagedAsset"], "PromptRecord, PromptVersion", "Admin Prompt and Asset Manager"],
  ["E08", "Release and deployment records", ["Release", "ReleaseNoteItem", "DeploymentRecord"], "Release, ReleaseNoteItem, DeploymentRecord", "Status and Operations"],
  ["E09", "Character biology", ["Species", "Breed", "Culture", "Character"], "Species, Breed, Culture, Character", "Admin Data and Game character"],
  ["E10", "Breed personality research", ["Breed", "BreedResearchValue", "BreedResearchEvidence", "Research", "Citation", "Source"], "Breed research models", "Admin Breed Research"],
  ["E11", "Source citation evidence", ["Source", "Citation", "Research", "KnowledgeBaseItemCitation", "KnowledgeBaseDisclosureCitation"], "Source, Citation, Research", "Admin Data and Game Knowledge"],
  ["E12", "Story identity", ["Character", "WitnessDef", "Witness", "Architect", "LegendaryReward", "PuzzleBlueprint"], "Character identity with direct subtypes and reusable Witness definitions", "Admin Campaign and Game"],
  ["E13", "Companion identity", ["CompanionDef", "Companion", "Character", "Soul"], "CompanionDef, concrete Character subtype, and Soul", "Admin Data and Game Companion"],
  ["E14", "Campaign placement", ["Campaign", "CampaignPlacement", "BookGroupingDefinition", "BookGroupingValue", "Pillar", "Lesson", "TimelineEvent", "Interlude", "Transition", "Companion"], "Campaign placements and explicit Book grouping membership", "CAM002 through CAM007 and Campaign world states"],
  ["E15", "Atlas geography", ["Site", "PointOfInterest", "Settlement", "RegionLatticeMapping", "AtlasConnection"], "Physical geography plus separate Region Mapping and Lattice-endpoint connections", "Atlas Admin and Game maps"],
  ["E16", "Settlement worlds", ["Site", "Settlement", "SettlementWorld", "Culture", "Breed"], "Settlement, SettlementWorld", "Atlas settlement states"],
  ["E17", "Population event authority", ["SettlementWorld", "SettlementPopulationEvent", "Breed"], "SettlementPopulationEvent", "Found City, Migrate, history"],
  ["E18", "City geometry", ["SettlementWorld", "City", "Parcel", "Street", "Building"], "City domain", "Admin City Builder"],
  ["E19", "Knowledge graph", ["KnowledgeBaseItem", "KnowledgeBaseBlock", "KnowledgeBaseItemCitation", "Citation", "KnowledgeBaseDisclosure", "KnowledgeBaseDisclosureBlock"], "Knowledge models", "Admin Knowledge and Game Knowledge"],
  ["E20", "Capabilities", ["CapabilityDefinition", "CapabilityDefinitionVersion", "CapabilityParameterDefinition", "CapabilityAddress", "CapabilityEvent", "CapabilityState", "FactionStandingScoringPolicy", "FactionStandingScoringWeight", "FactionStandingEvidenceEvent", "KnowledgeBaseDisclosure"], "Versioned definitions, typed addresses, append-only evidence and projections", "CAP01 through CAP05, Knowledge and achievements"],
  ["E21", "Achievement chain", ["AchievementDefinition", "ManagedAsset", "CapabilityDefinition"], "AchievementDefinition", "Admin achievements and Game"],
  ["E22", "Puzzle versions and acceptance", ["PuzzleBlueprint", "PuzzleBlueprintVersion", "PuzzleHintTemplate", "PuzzleChallengeAccepted", "User"], "Puzzle models", "Admin Puzzle and Game trial"],
  ["E23", "Calendar projection", ["CalendarOrdinal"], "CalendarOrdinal", "Game Calendar"],
  ["E24", "Narrative reference catalog", ["Tome", "Lesson", "Definition", "Layette", "Constellation", "Ark"], "Canonical narrative reference models; polluted Matrix entity removed", "Admin Data and Game reference surfaces"],
  ["E25", "Public contact and invitation", ["ContactRequest", "BetaInviteRequest", "BetaInvitationCode", "User"], "ContactRequest, BetaInviteRequest, BetaInvitationCode, User", "Contact and Invite"],
  ["E26", "Document Builder", ["DocumentBucket", "DocumentSourcePoint", "DocumentAmendment", "DocumentDraft", "User"], "Document Builder domain", "Admin Document Builder"],
  ["E27", "Player runtime", ["User", "GameSession", "GameTurn", "SettlementWorld", "Character", "KnowledgeBaseItem"], "Game runtime domain", "Game screens"],
  ["E28", "Atlas managed media", ["ManagedAsset", "AssetPurposeLink", "Site", "PointOfInterest"], "ManagedAsset, AssetPurposeLink, Site, PointOfInterest", "Atlas 2D and 3D"],
  ["E29", "Persisted provider boundaries", ["StripeWebhookEvent", "OrderPaymentConfirmation", "PrintfulFulfillmentSubmission", "ContactRequest", "DonationCheckout"], "Persisted provider evidence; provider requests remain typed service ports", "Commerce, Contact, Operations"],
  ["E30", "Release traceability", ["Release", "ReleaseNoteItem", "DeploymentRecord"], "Release, ReleaseNoteItem, DeploymentRecord", "Tools review and Operations"],
];

function slug(title) { return title.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function nodeId(label, index) { return `${label.replaceAll(/[^A-Za-z0-9]/g, "").slice(0, 18) || "Node"}${index}`; }
function processSource(entry) {
  const [, title, steps] = entry;
  const nodes = steps.map((step, index) => [nodeId(step, index), step]);
  return [`%% ${title}`, "flowchart LR", ...nodes.map(([id, label]) => `  ${id}["${label}"]`), ...nodes.slice(1).map(([id], index) => `  ${nodes[index][0]} --> ${id}`), ""].join("\n");
}
function entitySource(entry) {
  const [, title, entities] = entry;
  const unknown = entities.filter((entity) => !prismaModelNames.has(entity));
  if (unknown.length > 0) throw new Error(`${entry[0]} references non-Prisma entities: ${unknown.join(", ")}`);
  const declarations = entities.map((entity) => `  ${entity.replaceAll(/[^A-Za-z0-9_]/g, "_")} {\n    string id PK\n  }`);
  const entitySet = new Set(entities);
  const seenRelations = new Set();
  const relations = [];
  for (const model of prismaModels.filter(({ name }) => entitySet.has(name))) {
    for (const line of model.body.split("\n").map((value) => value.trim())) {
      const match = /^(\w+)\s+(\w+)(\[\]|\?)?(?:\s|$)/.exec(line);
      if (!match || !entitySet.has(match[2])) continue;
      const pair = [model.name, match[2]].sort().join(":");
      if (seenRelations.has(pair)) continue;
      seenRelations.add(pair);
      const rightCardinality = match[3] === "[]" ? "o{" : match[3] === "?" ? "o|" : "||";
      relations.push(`  ${model.name} ||--${rightCardinality} ${match[2]} : "relates to"`);
    }
  }
  return [`%% ${title}`, "erDiagram", ...declarations, ...relations, ""].join("\n");
}
function run(command, args) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { cwd: repositoryRoot, stdio: "inherit" });
    child.on("error", rejectPromise);
    child.on("exit", (code) => code === 0 ? resolvePromise() : rejectPromise(new Error(`${command} exited ${code}`)));
  });
}

if (processDiagrams.length !== 40 || entityDiagrams.length !== 30) throw new Error("Architecture inventory must be exactly 40 process and 30 entity diagrams.");
await rm(sourceRoot, { recursive: true, force: true });
await rm(svgRoot, { recursive: true, force: true });
await mkdir(resolve(sourceRoot, "process"), { recursive: true });
await mkdir(resolve(sourceRoot, "entity"), { recursive: true });
await mkdir(resolve(svgRoot, "process"), { recursive: true });
await mkdir(resolve(svgRoot, "entity"), { recursive: true });

const rows = [];
for (const [category, entries, sourceFactory] of [["process", processDiagrams, processSource], ["entity", entityDiagrams, entitySource]]) {
  for (const entry of entries) {
    const [id, title, , owners, screens] = entry;
    const fileName = `${id.toLowerCase()}-${slug(title)}`;
    const sourcePath = resolve(sourceRoot, category, `${fileName}.mmd`);
    const svgPath = resolve(svgRoot, category, `${fileName}.svg`);
    const source = sourceFactory(entry);
    if (/ActualWitness|WitnessRepresentation|Simulator|CultureGroup|AtlasPOI|MinorArc|Campaign Action/.test(source)) throw new Error(`Rejected invention in ${id}`);
    await writeFile(sourcePath, source, "utf8");
    await run("pnpm", ["exec", "mmdc", "-p", resolve(import.meta.dirname, "puppeteer-mermaid.json"), "-i", sourcePath, "-o", svgPath, "-b", "transparent"]);
    if (!(await readFile(svgPath, "utf8")).includes("<svg")) throw new Error(`Mermaid did not render ${id}`);
    rows.push({ id, title, category, sourcePath, svgPath, owners, screens });
  }
}

const index = [
  "# Echoes of Eidolon Architecture Atlas",
  "",
  "Exactly 70 repository-current diagrams: 40 process flows and 30 entity/relationship views.",
  "",
  "| ID | Category | Title | Mermaid source | Rendered SVG | Owning types | Consuming screens |",
  "|---|---|---|---|---|---|---|",
  ...rows.map((row) => {
    const source = row.sourcePath.slice(repositoryRoot.length + 1);
    const svg = row.svgPath.slice(repositoryRoot.length + 1);
    return `| ${row.id} | ${row.category} | ${row.title} | [source](../../${source}) | [SVG](../../${svg}) | ${row.owners} | ${row.screens} |`;
  }),
  "",
].join("\n");
await writeFile(resolve(root, "ARCHITECTURE_INDEX.md"), index, "utf8");
console.log(`architecture ${processDiagrams.length} process ${entityDiagrams.length} entity ${rows.length} rendered`);
/* global console */
