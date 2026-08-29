import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { buildArchitectWitnessCharacterCompletenessArtifact } from "../src/domain/architect-witness-completeness";

const output = resolve(import.meta.dirname, "../../../artifacts/release-0.3.0/owner-character-completeness.json");
await mkdir(resolve(output, ".."), { recursive: true });
await writeFile(output, `${JSON.stringify(buildArchitectWitnessCharacterCompletenessArtifact(), null, 2)}\n`);
process.stdout.write(`${output}\n`);
