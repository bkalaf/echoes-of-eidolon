import { resolve } from "node:path";

import { runReleaseCheck } from "../src/server/release-gate";

const result = await runReleaseCheck(resolve(import.meta.dirname, "../../.."));
process.stdout.write(`release-check ${result.currentVersion} ${result.status} canonical=${result.releaseCount} public=${result.publicReleaseCount}\n`);
