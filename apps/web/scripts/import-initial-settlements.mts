import { disconnectDatabase, getDatabase } from "../src/server/database";
import { importInitialFoundingSettlements } from "../src/server/initial-founding-settlements";

const unknownArguments = process.argv.slice(2).filter((argument) => argument !== "--apply");
if (unknownArguments.length > 0) throw new Error("Unknown arguments: " + unknownArguments.join(", "));

try {
  const mode = process.argv.includes("--apply") ? "apply" : "verify";
  const result = await importInitialFoundingSettlements(getDatabase(), { mode });
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
} finally {
  await disconnectDatabase();
}
