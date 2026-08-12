import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

interface ManagedAssetRecord {
  byteSize: number;
  mimeType: string;
  objectKey: string;
  publicUrl: string;
  sha256: string;
  technicalMetadata: Record<string, unknown>;
}

describe("managed asset manifest", () => {
  const manifest = JSON.parse(readFileSync(
    resolve(import.meta.dirname, "../../src/data/managed-assets.json"),
    "utf8",
  )) as Record<string, ManagedAssetRecord>;

  it("maps all imported media to final-byte SHA-256 object names", () => {
    expect(Object.keys(manifest).length).toBeGreaterThan(0);
    for (const record of Object.values(manifest)) {
      expect(record.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(record.objectKey).toMatch(new RegExp(`^assets/${record.sha256}\\.[a-z0-9]+$`));
      expect(record.publicUrl).toBe(`https://echoes-of-eidolon.sfo3.digitaloceanspaces.com/${record.objectKey}`);
      expect(record.byteSize).toBeGreaterThan(0);
      expect(record.technicalMetadata).toEqual(expect.objectContaining({ kind: expect.any(String) }));
    }
  });

  it("tracks the complete 80-file soundtrack source set plus the six stable login aliases", () => {
    const soundtrackKeys = Object.keys(manifest).filter((key) => key.startsWith("soundtrack."));
    const importedKeys = soundtrackKeys.filter((key) => key.startsWith("soundtrack.culture_"));
    expect(importedKeys).toHaveLength(80);
    expect(soundtrackKeys).toHaveLength(86);
    expect(soundtrackKeys.every((key) => manifest[key]?.mimeType === "audio/mpeg")).toBe(true);
  });
});
