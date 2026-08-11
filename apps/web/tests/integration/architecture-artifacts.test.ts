import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "../../../..");
const sourceRoot = resolve(repositoryRoot, "docs/architecture/mermaid");
const svgRoot = resolve(repositoryRoot, "docs/architecture/svg");

describe("complete architecture atlas", () => {
  it("contains exactly 40 process and 30 entity Mermaid sources and rendered SVGs", () => {
    const processSources = readdirSync(resolve(sourceRoot, "process")).filter((name) => name.endsWith(".mmd"));
    const entitySources = readdirSync(resolve(sourceRoot, "entity")).filter((name) => name.endsWith(".mmd"));
    const processSvgs = readdirSync(resolve(svgRoot, "process")).filter((name) => name.endsWith(".svg"));
    const entitySvgs = readdirSync(resolve(svgRoot, "entity")).filter((name) => name.endsWith(".svg"));
    expect(processSources).toHaveLength(40);
    expect(entitySources).toHaveLength(30);
    expect(processSvgs).toHaveLength(40);
    expect(entitySvgs).toHaveLength(30);
    for (const name of processSvgs) expect(readFileSync(resolve(svgRoot, "process", name), "utf8")).toContain("<svg");
    for (const name of entitySvgs) expect(readFileSync(resolve(svgRoot, "entity", name), "utf8")).toContain("<svg");
  });

  it("indexes every diagram and excludes rejected parallel-domain inventions", () => {
    const index = readFileSync(resolve(repositoryRoot, "docs/architecture/ARCHITECTURE_INDEX.md"), "utf8");
    expect((index.match(/^\| P\d{2} \|/gm) ?? [])).toHaveLength(40);
    expect((index.match(/^\| E\d{2} \|/gm) ?? [])).toHaveLength(30);
    const allSources = ["process", "entity"].flatMap((category) => readdirSync(resolve(sourceRoot, category)).map((name) => readFileSync(resolve(sourceRoot, category, name), "utf8"))).join("\n");
    expect(allSources).not.toMatch(/ActualWitness|WitnessRepresentation|Simulator|CultureGroup|AtlasPOI|MinorArc|Campaign Action/);
  });
});
