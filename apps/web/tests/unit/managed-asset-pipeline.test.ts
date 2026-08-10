import { describe, expect, it } from "vitest";

import {
  assertManagedAssetSignature,
  finalByteIdentity,
  normalizeManagedExtension,
} from "../../scripts/managed-asset-pipeline.mjs";

describe("managed asset final-byte pipeline", () => {
  it("normalizes JPEG object extensions without changing the source token implicitly", () => {
    expect(normalizeManagedExtension(".jpeg")).toBe(".jpg");
    expect(normalizeManagedExtension(".PNG")).toBe(".png");
    expect(() => normalizeManagedExtension(".gif")).toThrow("Unsupported managed asset extension");
  });

  it.each([
    [".png", Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])],
    [".jpg", Uint8Array.from([0xff, 0xd8, 0xff])],
    [".mp3", Uint8Array.from([0x49, 0x44, 0x33])],
    [".mp4", Uint8Array.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0, 0, 0, 0])],
  ])("accepts a matching %s byte signature", (extension, bytes) => {
    expect(() => assertManagedAssetSignature(bytes, extension)).not.toThrow();
  });

  it("rejects a file whose extension does not match its bytes", () => {
    const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0x00]);
    expect(() => assertManagedAssetSignature(jpeg, ".png")).toThrow("does not match");
  });

  it("derives the public object filename only from sanitized final bytes", () => {
    expect(finalByteIdentity(Uint8Array.from([1, 2, 3]), ".jpeg")).toEqual({
      fileName: "039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81.jpg",
      sha256: "039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81",
    });
  });
});
