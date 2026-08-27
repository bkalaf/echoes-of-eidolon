import { describe, expect, it, vi } from "vitest";

import { atlasTextureUrl } from "../../src/content/atlas-textures";
import { deliverAtlasTexture } from "../../src/server/atlas-texture";

describe("Atlas managed texture delivery", () => {
  it("uses same-origin, content-addressed URLs for both managed WebGL textures", () => {
    expect(atlasTextureUrl("albedo", "http://127.0.0.1:3000")).toMatch(/^\/api\/atlas\/texture\?kind=albedo&sha256=[a-f0-9]{64}$/);
    expect(atlasTextureUrl("region-tint", "http://127.0.0.1:3000")).toMatch(/^\/api\/atlas\/texture\?kind=region-tint&sha256=[a-f0-9]{64}$/);
  });

  it("uses the CORS-verified managed origin in production", () => {
    expect(atlasTextureUrl("albedo", "https://app.eidolon-gaming.com")).toMatch(/^https:\/\/echoes-of-eidolon\.sfo3\.digitaloceanspaces\.com\/assets\/[a-f0-9]{64}\.png$/);
    expect(atlasTextureUrl("region-tint", "https://app.eidolon-gaming.com")).toMatch(/^https:\/\/echoes-of-eidolon\.sfo3\.digitaloceanspaces\.com\/assets\/[a-f0-9]{64}\.png$/);
  });

  it("streams only an allowlisted texture at its current managed manifest identity", async () => {
    const fetcher = vi.fn(async () => new Response(new Uint8Array([137, 80, 78, 71]), {
      headers: { "content-length": "4", "content-type": "image/png" },
      status: 200,
    }));
    const url = new URL(atlasTextureUrl("region-tint", "http://127.0.0.1:3000"), "http://127.0.0.1:3000");
    const response = await deliverAtlasTexture(url, fetcher);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cross-origin-resource-policy")).toBe("same-origin");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[0]).toMatch(/^https:\/\/echoes-of-eidolon\.sfo3\.digitaloceanspaces\.com\/assets\/[a-f0-9]{64}\.png$/);
  });

  it.each([
    ["unknown kind", "https://app.eidolon-gaming.com/api/atlas/texture?kind=other&sha256=abc"],
    ["missing digest", "https://app.eidolon-gaming.com/api/atlas/texture?kind=albedo"],
    ["stale digest", "https://app.eidolon-gaming.com/api/atlas/texture?kind=albedo&sha256=deadbeef"],
    ["injected URL", "https://app.eidolon-gaming.com/api/atlas/texture?kind=https%3A%2F%2Fevil.example&sha256=deadbeef"],
  ])("rejects %s without fetching", async (_label, requestUrl) => {
    const fetcher = vi.fn();
    const response = await deliverAtlasTexture(new URL(requestUrl), fetcher);

    expect(response.status).toBe(404);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
