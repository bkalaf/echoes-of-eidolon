import { disconnectDatabase, getDatabase } from "../src/server/database";
import { getAtlasReleaseBundle } from "../src/server/atlas";
import { importCanonicalSites } from "../src/server/atlas-sites";

try {
  const { catalog, foundingCitySites } = await getAtlasReleaseBundle();
  if (catalog.coordinateReferenceSystem !== "EPSG:4326") throw new Error("Atlas Site import requires EPSG:4326.");
  const result = await importCanonicalSites(catalog.settlementSites, foundingCitySites, getDatabase());
  process.stdout.write(`Atlas Sites created=${result.created} unchanged=${result.unchanged}\n`);
} finally {
  await disconnectDatabase();
}
