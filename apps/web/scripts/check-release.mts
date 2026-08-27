import { resolve } from "node:path";

import { assertPuzzleClientBundleSafe, runReleaseCheck } from "../src/server/release-gate";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const result = await runReleaseCheck(repositoryRoot);
assertPuzzleClientBundleSafe(resolve(repositoryRoot, "apps/web/.output/public/assets"));
process.stdout.write(`release-check ${result.currentVersion} ${result.status} canonical=${result.releaseCount} public=${result.publicReleaseCount}\n`);
