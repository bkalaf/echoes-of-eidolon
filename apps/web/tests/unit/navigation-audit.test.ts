import { describe, expect, it } from "vitest";

import { projectNavigationAuditEntry } from "../../src/domain/navigation-audit";
import type { PageManifestEntry } from "../../src/lib/page-manifest";

const routeScreen: PageManifestEntry = {
  page: 1,
  screenId: "TEST_ROUTE",
  title: "Test route",
  path: "/admin/example",
  source: "TEST",
  originalPage: 1,
  reviewOrder: 1,
};

describe("navigation audit projection", () => {
  it("distinguishes authorized routes, triggered state, orphans, dead ends, and broken links", () => {
    expect(projectNavigationAuditEntry(routeScreen, undefined, true).status).toBe("ORPHANED");
    expect(projectNavigationAuditEntry(routeScreen, {
      authorization: "administration",
      entryPoint: "/admin",
      parentAction: "Administration > Example",
      exitDestination: "/admin",
      automatedCoverage: ["navigation-reachability:admin"],
    }, true).status).toBe("ROLE_GATED_REACHABLE");
    expect(projectNavigationAuditEntry(routeScreen, {
      authorization: "administration",
      entryPoint: "/admin",
      parentAction: "Administration > Example",
      exitDestination: null,
      automatedCoverage: ["navigation-reachability:admin"],
    }, true).status).toBe("DEAD_END");
    expect(projectNavigationAuditEntry(routeScreen, {
      authorization: "administration",
      entryPoint: "/admin",
      parentAction: "Administration > Example",
      exitDestination: "/admin",
      automatedCoverage: ["navigation-reachability:admin"],
    }, false).status).toBe("BROKEN_LINK");

    const state = { ...routeScreen, screenId: "TEST_MODAL", path: "Modal in /game" };
    expect(projectNavigationAuditEntry(state, {
      authorization: "game",
      entryPoint: "/game",
      parentAction: "Open test modal",
      exitDestination: "/game",
      automatedCoverage: ["navigation-reachability:game"],
    }, true).status).toBe("STATE_TRIGGERED");
  });
});
