import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  loadCanonicalReleaseNotes,
  parseCanonicalReleaseNote,
  releaseNotesFileName,
  releaseNotesRoute,
} from "../../src/domain/release-notes";

function note(version = "0.2.0", status = "DRAFT", releaseDate = "null") {
  return `---
version: ${version}
status: ${status}
title: Echoes of Eidolon ${version}
summary: A verified release summary.
releaseDate: ${releaseDate}
previousVersion: null
---
# Echoes of Eidolon ${version}

## Added

### Branching conversations
Audience: PLAYERS
Routes: /features

Players can explore branching conversations.
`;
}

describe("canonical release-note loader", () => {
  it("RN-003 requires the filename to match the declared version", () => {
    expect(parseCanonicalReleaseNote("0_2_0.md", note()).version).toBe("0.2.0");
    expect(() => parseCanonicalReleaseNote("0_2_0.md", note("0.3.0"))).toThrow(/filename/i);
  });

  it("RN-004 rejects duplicate versions", () => {
    expect(() => loadCanonicalReleaseNotes([
      { fileName: "first/0_2_0.md", source: note() },
      { fileName: "second/0_2_0.md", source: note() },
    ], "0.2.0")).toThrow(/duplicate/i);
  });

  it("RN-007 fails closed on malformed canonical content", () => {
    expect(() => parseCanonicalReleaseNote("0_2_0.md", "# Missing metadata")).toThrow();
    expect(() => parseCanonicalReleaseNote("0_2_0.md", note().replace("## Added", "Added"))).toThrow(/section/i);
  });

  it("RN-008 resolves the current release from the application version", () => {
    const catalog = loadCanonicalReleaseNotes([
      { fileName: "0_10_0.md", source: note("0.10.0") },
      { fileName: "0_2_0.md", source: note("0.2.0") },
    ], "0.2.0");
    expect(catalog.current.version).toBe("0.2.0");
    expect(catalog.releases.map((release) => release.version)).toEqual(["0.10.0", "0.2.0"]);
  });

  it("RN-031 rejects unsafe raw HTML", () => {
    expect(() => parseCanonicalReleaseNote("0_2_0.md", note().replace("Players can explore", "<script>alert(1)</script> Players can explore"))).toThrow(/HTML/i);
    expect(() => parseCanonicalReleaseNote("0_2_0.md", note().replace("Players can explore branching conversations.", "[Open this](javascript:alert(1))"))).toThrow(/unsafe Markdown link/i);
  });

  it("RN-034 has no retired-repository runtime dependency", () => {
    const sourceRoot = resolve(process.cwd(), "src");
    const runtimeSources = [
      "domain/release-notes.ts",
      "server/releases.ts",
      "screens/public/PublicPage.tsx",
    ].map((file) => readFileSync(resolve(sourceRoot, file), "utf8")).join("\n");
    expect(runtimeSources).not.toMatch(/bkalaf\/eoe|\/home\/bobby\/eoe/);
  });

  it("RN-035 gives every consumer one canonical catalog", () => {
    const catalog = loadCanonicalReleaseNotes([{ fileName: "0_2_0.md", source: note() }], "0.2.0");
    expect(catalog.current).toBe(catalog.releases[0]);
  });

  it("RN-036 uses the same model for patch releases", () => {
    expect(releaseNotesFileName("0.2.1")).toBe("0_2_1.md");
    expect(releaseNotesRoute("0.2.1")).toBe("/status/releases/0.2.1");
  });
});
