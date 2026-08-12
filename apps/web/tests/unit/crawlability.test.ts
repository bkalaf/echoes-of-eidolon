import { describe, expect, it } from "vitest";

import { isCrawlablePath, robotsDocument, sitemapDocument, sitemapPaths } from "../../src/lib/crawlability";
import { pageManifest, shellFor } from "../../src/lib/page-manifest";

describe("closed-world crawlability", () => {
  it.each([
    "/",
    "/about",
    "/features/a-living-world",
    "/features/free-to-play",
    "/store/products/official-print",
    "/status/releases/0.2.0",
  ])("allowlists the approved public/store path %s", (path) => {
    expect(isCrawlablePath(path)).toBe(true);
  });

  it.each([
    "/auth/sign-in",
    "/account/profile",
    "/admin/atlas",
    "/game/maps",
    "/review/navigation-states",
    "/store/orders/bearer-token",
    "/api/health",
    "/not-in-the-registry",
  ])("fails closed for non-public path %s", (path) => {
    expect(isCrawlablePath(path)).toBe(false);
  });

  it("publishes only concrete allowlisted paths in the sitemap", () => {
    const sitemap = sitemapDocument("https://example.test");
    expect(sitemapPaths).toContain("/features/free-to-play");
    expect(sitemapPaths).toContain("/gameplay");
    expect(sitemapPaths).toContain("/gameplay/world-atlas");
    expect(sitemap).toContain("<loc>https://example.test/features</loc>");
    expect(sitemap).toContain("<loc>https://example.test/status/releases/0.2.0</loc>");
    expect(sitemap).not.toMatch(/:version|:slug|store\/orders|\/auth|\/admin|\/game(?:\/|<)|\/review/);
  });

  it("uses the exact required robots disallow boundaries", () => {
    expect(robotsDocument("https://example.test")).toBe([
      "User-agent: *",
      "Allow: /",
      "Disallow: /auth",
      "Disallow: /account",
      "Disallow: /admin",
      "Disallow: /game",
      "Disallow: /review",
      "Disallow: /store/orders/",
      "Sitemap: https://example.test/sitemap.xml",
      "",
    ].join("\n"));
  });

  it("classifies route-owned modal states under their protected shell", () => {
    expect(shellFor(pageManifest.find((entry) => entry.screenId === "ACC002")!)).toBe("account");
    expect(shellFor(pageManifest.find((entry) => entry.screenId === "GAME015")!)).toBe("game");
  });
});
