import { readFile } from "node:fs/promises";

import { disconnectDatabase, getDatabase } from "../src/server/database";
import { getAtlasCatalog } from "../src/server/atlas";
import { importAtlasNamingProximity, type AtlasNamingProximitySupplement } from "../src/server/atlas-naming";

try {
  const [catalog, source] = await Promise.all([
    getAtlasCatalog(),
    readFile(new URL("../prisma/reference/atlas-naming-proximity-supplement-v1.json", import.meta.url), "utf8"),
  ]);
  const result = await importAtlasNamingProximity(JSON.parse(source) as AtlasNamingProximitySupplement, catalog.settlementSites, getDatabase());
  process.stdout.write(`Atlas naming features created=${result.createdFeatures} unchanged=${result.unchangedFeatures} eligibility created=${result.createdEligibility} unchanged=${result.unchangedEligibility}\n`);
} finally {
  await disconnectDatabase();
}
