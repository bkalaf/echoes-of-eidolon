import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({ useSession: vi.fn() }));

vi.mock("../../src/lib/auth-client", () => ({
  authClient: { useSession: authMocks.useSession },
}));

import { pageManifest } from "../../src/lib/page-manifest";
import { AdminPage } from "../../src/screens/admin/AdminPage";

function adminScreen(screenId: string) {
  return pageManifest.find((entry) => entry.screenId === screenId)!;
}

describe("administrative authorization boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires a session before exposing any administrative task", () => {
    authMocks.useSession.mockReturnValue({ data: null, isPending: false });
    render(<AdminPage screen={adminScreen("DATA_SOUL_IMPORT")} />);

    expect(screen.getByRole("heading", { name: "Sign in required" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Paste structured data" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Apply/ })).not.toBeInTheDocument();
  });

  it.each([
    ["DATA_SOUL_IMPORT", /Import preview, validation reports/],
    ["DATA003", /Canonical record lists, editors/],
    ["AT004_FOUND_CITY", /settlement operations/],
    ["CAMPAIGN_CONCORD", /Campaign assignments, puzzle records/],
    ["ADM014", /payments, orders, and fulfillment state/],
    ["OPS001", /restart controls, and deployment controls/],
  ])("does not treat a signed-in user as an administrator for %s", (screenId, scope) => {
    authMocks.useSession.mockReturnValue({ data: { user: { id: "user-1" } }, isPending: false });
    render(<AdminPage screen={adminScreen(screenId)} />);

    expect(screen.getByRole("heading", { name: "Administrative authorization owner-deferred" })).toBeInTheDocument();
    expect(screen.getByText(scope)).toBeInTheDocument();
    expect(screen.getByText(/valid account session alone does not grant/)).toBeInTheDocument();
  });

  it("never renders fabricated admin records or action results", () => {
    authMocks.useSession.mockReturnValue({ data: { user: { id: "user-1" } }, isPending: false });
    render(<AdminPage screen={adminScreen("ADM005")} />);

    expect(screen.queryByText(/player-one|player@example.com|INV-REQ-001|EID-10482/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Approve|Decline|Revoke|Deploy|Restart/ })).not.toBeInTheDocument();
  });
});
