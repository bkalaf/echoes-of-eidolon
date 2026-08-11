import { resolve } from "node:path";

import { generateReleaseArtifact } from "../src/server/release-gate";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const target = generateReleaseArtifact(repositoryRoot);
process.stdout.write(`release-artifact ${target}\n`);
