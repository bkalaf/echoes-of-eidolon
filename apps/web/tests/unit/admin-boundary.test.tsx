import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  getActiveMemberRole: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock("../../src/lib/auth-client", () => ({
  authClient: {
    organization: { getActiveMemberRole: authMocks.getActiveMemberRole },
    useSession: authMocks.useSession,
  },
}));

import { pageManifest } from "../../src/lib/page-manifest";
import { AdminPage } from "../../src/screens/admin/AdminPage";

function adminScreen(screenId: string) {
  return pageManifest.find((entry) => entry.screenId === screenId)!;
}

function renderAdmin(screenId: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminPage screen={adminScreen(screenId)} />
    </QueryClientProvider>,
  );
}

describe("administrative authorization boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires a session before exposing any administrative task", () => {
    authMocks.useSession.mockReturnValue({ data: null, isPending: false });
    renderAdmin("DATA_SOUL_IMPORT");

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
  ])("does not treat a member as an administrator for %s", async (screenId, scope) => {
    authMocks.useSession.mockReturnValue({ data: { user: { id: "user-1" } }, isPending: false });
    authMocks.getActiveMemberRole.mockResolvedValue({ data: { role: "member" }, error: null });
    renderAdmin(screenId);

    expect(await screen.findByRole("heading", { name: "Administrative access denied" })).toBeInTheDocument();
    expect(screen.getByText(scope)).toBeInTheDocument();
    expect(screen.getByText(/Only the admin and owner roles/)).toBeInTheDocument();
  });

  it.each(["admin", "owner"] as const)("authorizes the %s role", async (role) => {
    authMocks.useSession.mockReturnValue({ data: { user: { id: "user-1" } }, isPending: false });
    authMocks.getActiveMemberRole.mockResolvedValue({ data: { role }, error: null });
    renderAdmin("DATA003");

    expect(await screen.findByRole("heading", { name: "Administrative authorization verified" })).toBeInTheDocument();
    expect(screen.getByText(role)).toBeInTheDocument();
  });

  it("fails closed when Better Auth cannot verify the active organization role", async () => {
    authMocks.useSession.mockReturnValue({ data: { user: { id: "user-1" } }, isPending: false });
    authMocks.getActiveMemberRole.mockResolvedValue({
      data: null,
      error: { message: "No active organization" },
    });
    renderAdmin("DATA003");

    expect(await screen.findByRole("heading", { name: "Administrative access unavailable" })).toBeInTheDocument();
    expect(screen.getByText(/fails closed/)).toBeInTheDocument();
  });

  it("never renders fabricated admin records or action results", async () => {
    authMocks.useSession.mockReturnValue({ data: { user: { id: "user-1" } }, isPending: false });
    authMocks.getActiveMemberRole.mockResolvedValue({ data: { role: "admin" }, error: null });
    renderAdmin("ADM005");

    await screen.findByRole("heading", { name: "Administrative authorization verified" });
    expect(screen.queryByText(/player-one|player@example.com|INV-REQ-001|EID-10482/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Approve|Decline|Revoke|Deploy|Restart/ })).not.toBeInTheDocument();
  });
});
