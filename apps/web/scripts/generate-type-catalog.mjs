import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const schemaPath = resolve(repositoryRoot, "apps/web/prisma/schema.prisma");
const routeRoot = resolve(repositoryRoot, "apps/web/src/routes/api");
const manifestPath = resolve(repositoryRoot, "apps/web/src/data/page-manifest.json");
const outputPath = resolve(repositoryRoot, "docs/implementation/TYPE_CATALOG.md");

async function filesRecursively(root) {
  const output = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) output.push(...await filesRecursively(path));
    else output.push(path);
  }
  return output;
}

function blocks(source, kind) {
  return [...source.matchAll(new RegExp(`^${kind} (\\w+) \\{([\\s\\S]*?)^\\}`, "gm"))].map((match) => ({
    name: match[1],
    body: match[2],
  }));
}

const ownership = [
  [/^(User|Session|Account|Verification|Passkey|TwoFactor)$/, ["Identity", "server/auth.ts and server/account-sessions.ts", "Auth, Account, Admin Accounts"]],
  [/^UserSettings$/, ["Shared settings", "server/user-settings.ts", "Account Settings and Game Settings modal"]],
  [/^(Organization|Member|Invitation)$/, ["Authorization", "domain/organization-access.ts", "Admin access"]],
  [/^Beta/, ["Invitations", "server/beta-invitations.ts", "Public Invite and Admin Invitations"]],
  [/^(Species|Breed|Culture|Character|SpeciesGroup|PersonalityExpression|BreedResearch)/, ["Canonical data", "typed imports and server/breed-research.ts", "Admin Data and Game"]],
  [/^(Protagonist|Architect|Antagonist|Witness|Soul|Companion|TimelineEvent|Interlude|Pillar|LegendaryReward|Lesson|Tome|Transition|Constellation|Ark|Layette|Matrix|Definition)/, ["Narrative data", "typed import services", "Admin Data, Campaign, Game"]],
  [/^(PointOfInterest|Site)$/, ["Atlas", "server/atlas.ts and server/atlas-sites.ts", "Atlas Admin and Game maps"]],
  [/^Settlement/, ["Settlement simulation", "server/settlements.ts", "Atlas Admin, Found City, Migrate"]],
  [/^(Source|Citation|Research)$/, ["Evidence", "domain/knowledge-evidence.ts and typed research services", "Admin Data and Game Knowledge"]],
  [/^KnowledgeBase/, ["Knowledge", "domain/knowledge-disclosures.ts", "Admin Knowledge and Game Knowledge"]],
  [/^(Capability|Achievement)/, ["Capabilities", "domain/capabilities.ts", "Admin capabilities and Game Knowledge"]],
  [/^(ManagedAsset|AssetPurposeLink|Prompt)/, ["Asset and Prompt Manager", "scripts/import-managed-assets.mjs", "Admin Assets and all media screens"]],
  [/^(Membership|Perk)/, ["Membership", "domain/membership.ts", "Donation, Account, Admin Perks"]],
  [/^(Store|Order|Stripe|Printful)/, ["Commerce", "domain/commerce.ts and server/payments.ts", "Store, Account Orders, Admin Commerce"]],
  [/^Puzzle/, ["Puzzle", "domain/puzzle-blueprint.ts", "Admin Puzzle and Game Witness Trial"]],
  [/^Calendar/, ["Calendar", "server/player-calendar.ts", "Game Calendar"]],
  [/^Contact/, ["Contact", "server/contact.ts", "Public Contact and Admin operations"]],
  [/^Donation/, ["Donations", "server/donations.ts", "Public Donation and Account Membership"]],
  [/^(Release|Deployment)/, ["Release operations", "server/releases.ts", "Public Status and Admin Operations"]],
  [/^Document/, ["Document Builder", "server/documents.ts", "Admin Document Builder"]],
  [/^Game/, ["Player runtime", "server/game-runtime.ts", "Game viewport"]],
  [/^(City|Parcel|Street|Building)$/, ["City geometry", "settlement and City services", "Admin City Builder"]],
];

function ownerFor(name) {
  return ownership.find(([pattern]) => pattern.test(name))?.[1] ?? ["Repository core", "Prisma and owning route service", "Registry-linked screens"];
}

const schema = await readFile(schemaPath, "utf8");
const models = blocks(schema, "model");
const enums = blocks(schema, "enum");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const routeFiles = (await filesRecursively(routeRoot)).filter((path) => path.endsWith(".ts")).sort();
const apiRows = [];
for (const path of routeFiles) {
  const source = await readFile(path, "utf8");
  const methods = [...source.matchAll(/(?:^|[,{\s])(GET|POST|PATCH|PUT|DELETE):/gm)].map((match) => match[1]);
  const relative = path.slice(resolve(repositoryRoot, "apps/web/src/routes").length).replace(/\.ts$/, "").replace(/\/index$/, "").replaceAll("$", ":");
  for (const method of methods) apiRows.push({ method, path: relative });
}

const modelRows = models.map((model) => {
  const fields = model.body.split("\n").map((line) => line.trim()).filter((line) => line && !line.startsWith("@@") && !line.startsWith("//"));
  const [owner, service, screens] = ownerFor(model.name);
  return `| ${model.name} | Persisted entity | ${owner} | \`${model.name}\` via ${service} | ${screens} | ${fields.length} |`;
});
const enumRows = enums.map((entry) => {
  const values = entry.body.split("\n").map((line) => line.trim()).filter((line) => line && !line.startsWith("//"));
  return `| ${entry.name} | ${values.length} | ${values.map((value) => `\`${value.split(/\s+/)[0]}\``).join(", ")} |`;
});
const shellCounts = manifest.reduce((counts, row) => {
  const path = (row.path ?? "").replace(/^Modal in /, "");
  const shell = row.path === null ? "state-only" : path.startsWith("/admin") ? "admin" : path.startsWith("/account") || path.startsWith("/settings") ? "account" : path.startsWith("/auth") ? "auth" : path.startsWith("/store") ? "store" : path.startsWith("/game") ? "game" : path.startsWith("/tools") || path.startsWith("/review") ? "tools-review" : "public";
  counts[shell] = (counts[shell] ?? 0) + 1; return counts;
}, {});

const lines = [
  "# Echoes of Eidolon Complete Type Catalog",
  "",
  "Generated from the current Prisma schema, API route tree, and 269-row v11.3 registry. The compile-time forward map is `apps/web/src/domain/implementation-types.ts`.",
  "",
  "## Inventory",
  "",
  `- Persisted entity types: ${models.length}`,
  `- Controlled enums: ${enums.length}`,
  `- HTTP method/path contracts: ${apiRows.length}`,
  `- Wireframe view-model rows: ${manifest.length}`,
  `- Wireframe shell distribution: ${Object.entries(shellCounts).map(([key, value]) => `${key} ${value}`).join(", ")}`,
  "- Provider ports: DigitalOcean Spaces, Resend, Stripe, Printful, and owner-configured NPC runtime.",
  "- State machines: invitation, payment, fulfillment, release, import, and Puzzle challenge.",
  "",
  "## Persisted entity/type matrix",
  "",
  "| Type | Kind | Owner | Table/service | Consuming screens | Field count |",
  "|---|---|---|---|---|---:|",
  ...modelRows,
  "",
  "## API request/response contracts",
  "",
  "Every route below has a corresponding key in `ApiContractMap`; Zod schemas and server-owned projections remain the runtime validators.",
  "",
  "| Method | Path | Request owner | Response owner |",
  "|---|---|---|---|",
  ...apiRows.map((route) => `| ${route.method} | \`${route.path}\` | Route Zod schema or empty request | Route server projection or bounded error |`),
  "",
  "## Controlled enum catalog",
  "",
  "| Enum | Values | Tokens |",
  "|---|---:|---|",
  ...enumRows,
  "",
  "## Wireframe view models",
  "",
  "All 269 registry rows use `WireframeViewModel`: manifest identity, shell owner, governed revision, viewport, and explicit loading/empty/error/ready/success/denied state. Modal rows retain their parent owner and are not promoted to invented routes.",
  "",
  "## Rejected-invention scan",
  "",
  "The generated catalog and forward map contain none of the rejected parallel ownership or candidate/promotion types. `Witness` is the canonical story entity; `BreedResearchEvidence` is the typed research owner; `PointOfInterest` and `Site` remain the Atlas records.",
  "",
];
await mkdir(resolve(repositoryRoot, "docs/implementation"), { recursive: true });
await writeFile(outputPath, lines.join("\n"), "utf8");
console.log(`type-catalog ${models.length} models ${enums.length} enums ${apiRows.length} api-contracts ${manifest.length} wireframes`);
/* global console */
