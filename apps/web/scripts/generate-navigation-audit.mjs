/* global console, process */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const dataRoot = resolve(repositoryRoot, "apps/web/src/data");
const base = JSON.parse(await readFile(resolve(dataRoot, "page-manifest.json"), "utf8"));
const v3 = JSON.parse(await readFile(resolve(dataRoot, "page-manifest-v3-amendments.json"), "utf8"));
const v4 = JSON.parse(await readFile(resolve(dataRoot, "page-manifest-v4-amendments.json"), "utf8"));
const declarations = JSON.parse(await readFile(resolve(dataRoot, "navigation-registry.json"), "utf8"));
const routeTree = await readFile(resolve(repositoryRoot, "apps/web/src/routeTree.gen.ts"), "utf8");
const excluded = new Set(v3.excludedScreenIds);
const active = [...base.filter((entry) => !excluded.has(entry.screenId)), ...v3.additions, ...v4.additions]
  .sort((left, right) => left.reviewOrder - right.reviewOrder);
const declarationByOrder = new Map(declarations.entries.map((entry) => [entry.reviewOrder, entry]));
const allowedAuthorization = new Set(["public", "authenticated", "administration", "game"]);
const allowedStatuses = new Set(["REACHABLE", "ROLE_GATED_REACHABLE", "STATE_TRIGGERED", "ORPHANED", "DEAD_END", "BROKEN_LINK"]);
const splatRegistered = /path:\s*['"]\/\$['"]/.test(routeTree);

function normalizedOwner(path) {
  return path?.replace(/^Modal in /, "").split("?")[0] ?? null;
}

function shellFor(entry) {
  const owner = normalizedOwner(entry.path);
  if (!owner) {
    if (/^(GAME|GAM)/.test(entry.screenId)) return "game";
    if (/^(TOOL|TOO)/.test(entry.screenId)) return "tools-review";
    if (entry.screenId.startsWith("ACC")) return "account";
    if (entry.screenId === "CAM006") return "admin";
    return "state-only";
  }
  if (owner.startsWith("/admin")) return "admin";
  if (owner.startsWith("/account") || owner.startsWith("/settings")) return "account";
  if (owner.startsWith("/auth")) return "auth";
  if (owner.startsWith("/store")) return "store";
  if (owner === "/game" || owner.startsWith("/game/")) return "game";
  if (owner.startsWith("/tools") || owner.startsWith("/review")) return "tools-review";
  return "public";
}

function declarationFor(entry) {
  const explicit = declarationByOrder.get(entry.reviewOrder);
  const convention = declarations.conventions?.[shellFor(entry)];
  if (!explicit && !convention) return undefined;
  return {
    ...convention,
    automatedCoverage: declarations.automatedCoverage ?? [],
    ...explicit,
  };
}

function kindFor(path) {
  if (path === null) return "state";
  return path.startsWith("Modal in ") ? "modal" : "route";
}

function routeRegistered(entry, declaration) {
  if (entry.path === null) return Boolean(declaration?.parentAction);
  const owner = normalizedOwner(entry.path);
  return Boolean(owner && splatRegistered);
}

function statusFor(entry, declaration, registered) {
  if (!registered) return declaration ? "BROKEN_LINK" : "ORPHANED";
  if (!declaration?.entryPoint || !declaration.parentAction || !declaration.automatedCoverage?.length) return "ORPHANED";
  if (!declaration.exitDestination) return "DEAD_END";
  if (kindFor(entry.path) !== "route") return "STATE_TRIGGERED";
  return declaration.authorization === "public" ? "REACHABLE" : "ROLE_GATED_REACHABLE";
}

const duplicateOrders = active.filter((entry, index) => active.findIndex((candidate) => candidate.reviewOrder === entry.reviewOrder) !== index);
const unknownDeclarations = declarations.entries.filter((entry) => !active.some((screen) => screen.reviewOrder === entry.reviewOrder));
const invalidDeclarations = declarations.entries.filter((entry) => !allowedAuthorization.has(entry.authorization));
const invalidConventions = Object.values(declarations.conventions ?? {}).filter((entry) => !allowedAuthorization.has(entry.authorization));
if (duplicateOrders.length || unknownDeclarations.length || invalidDeclarations.length || invalidConventions.length || !splatRegistered) {
  throw new Error(`Navigation registry join failed: duplicateOrders=${duplicateOrders.length} unknownDeclarations=${unknownDeclarations.length} invalidDeclarations=${invalidDeclarations.length + invalidConventions.length} splatRegistered=${splatRegistered}`);
}

const rows = active.map((entry) => {
  const declaration = declarationFor(entry);
  const registered = routeRegistered(entry, declaration);
  const status = statusFor(entry, declaration, registered);
  if (!allowedStatuses.has(status)) throw new Error(`Unknown status for ${entry.screenId}`);
  return {
    reviewOrder: entry.reviewOrder,
    screenId: entry.screenId,
    title: entry.title,
    routeOrState: entry.path ?? "state-only",
    kind: kindFor(entry.path),
    shell: shellFor(entry),
    authorization: declaration?.authorization ?? null,
    entryPoint: declaration?.entryPoint ?? null,
    parentAction: declaration?.parentAction ?? null,
    exitDestination: declaration?.exitDestination ?? null,
    automatedCoverage: declaration?.automatedCoverage ?? [],
    routeRegistered: registered,
    status,
  };
});

const statusCounts = Object.fromEntries([...allowedStatuses].map((status) => [status, rows.filter((row) => row.status === status).length]));
const generated = {
  version: declarations.version,
  generatedFrom: ["page-manifest.json", "page-manifest-v3-amendments.json", "page-manifest-v4-amendments.json", "routeTree.gen.ts", "navigation-registry.json"],
  activeScreenCount: rows.length,
  statusCounts,
  rows,
};
const generatedPath = resolve(dataRoot, "navigation-registry.generated.json");
await writeFile(generatedPath, `${JSON.stringify(generated, null, 2)}\n`, "utf8");

const markdown = [
  "# Navigation Reachability Audit",
  "",
  "This artifact is generated from the active base, V3, and V4 screen registries, the explicit navigation registry, and the generated TanStack route tree.",
  "",
  "## Result",
  "",
  `- Active screens/states: ${rows.length}`,
  ...[...allowedStatuses].map((status) => `- ${status}: ${statusCounts[status]}`),
  "",
  "## Inventory",
  "",
  "| Review | Screen ID | Route/state/modal | Shell | Authorization | Entry point | Parent/action | Exit | Automated coverage | Status |",
  "|---:|---|---|---|---|---|---|---|---|---|",
  ...rows.map((row) => `| ${row.reviewOrder} | ${row.screenId} | ${row.routeOrState.replaceAll("|", "\\|")} | ${row.shell} | ${row.authorization ?? "UNDECLARED"} | ${row.entryPoint ?? "—"} | ${row.parentAction ?? "—"} | ${row.exitDestination ?? "—"} | ${row.automatedCoverage.join("<br>") || "—"} | **${row.status}** |`),
  "",
];
await mkdir(resolve(repositoryRoot, "docs/implementation"), { recursive: true });
await writeFile(resolve(repositoryRoot, "docs/implementation/NAVIGATION_REACHABILITY_AUDIT.md"), markdown.join("\n"), "utf8");

const brokenCount = statusCounts.ORPHANED + statusCounts.DEAD_END + statusCounts.BROKEN_LINK;
console.log(`navigation-audit ${rows.length} active ${brokenCount} ${brokenCount === 0 ? "blocking defects" : "incomplete"}`);
if (process.argv.includes("--strict") && brokenCount > 0) process.exitCode = 1;
