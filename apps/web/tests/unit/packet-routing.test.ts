import { describe, expect, it } from "vitest";
import { manifestByShell, pathMatches, screenForPath } from "../../src/lib/page-manifest";

function concretePath(pattern: string) {
  return pattern
    .replace(/^Modal in /, "")
    .split("?")[0]!
    .replaceAll(":version", "0.2.0")
    .replaceAll(":orderid", "EID-1042")
    .replaceAll(":ticketid", "TKT-0042")
    .replaceAll(":token", "order-token")
    .replaceAll(":slug", "conjunction-1-mug");
}

describe("packet route resolution", () => {
  it("matches parameterized paths without loosening fixed segments", () => {
    expect(pathMatches("/store/products/:slug", "/store/products/conjunction-1-mug")).toBe(true);
    expect(pathMatches("/store/products/:slug", "/store/cart")).toBe(false);
  });

  it("resolves every routed public, auth, account, and store screen", () => {
    const groups = manifestByShell();
    for (const shell of ["public", "auth", "account", "store"] as const) {
      for (const entry of groups[shell]) {
        if (!entry.path || entry.path === "/") continue;
        const resolved = screenForPath(concretePath(entry.path), entry.screenId);
        expect(resolved?.screenId, `${entry.screenId} at ${entry.path}`).toBe(entry.screenId);
      }
    }
  });
});
