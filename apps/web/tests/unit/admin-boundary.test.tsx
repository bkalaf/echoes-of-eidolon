import { render, screen } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  useSession: vi.fn(),
}));

vi.mock("../../src/lib/auth-client", () => ({
  authClient: {
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
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: async () => ({ requests: [] }),
      ok: true,
    }));
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
    authMocks.useSession.mockReturnValue({ data: { user: { id: "user-1", role: "member" } }, isPending: false });
    renderAdmin(screenId);

    expect(await screen.findByRole("heading", { name: "Administrative access denied" })).toBeInTheDocument();
    expect(screen.getByText(scope)).toBeInTheDocument();
    expect(screen.getByText(/Only the admin and owner roles/)).toBeInTheDocument();
  });

  it.each(["admin", "owner"] as const)("authorizes the %s role", async (role) => {
    authMocks.useSession.mockReturnValue({ data: { user: { id: "user-1", role } }, isPending: false });
    renderAdmin("DATA003");

    expect(await screen.findByRole("heading", { name: "Administrative authorization verified" })).toBeInTheDocument();
    expect(screen.getByText(role)).toBeInTheDocument();
  });

  it("fails closed when Better Auth returns an unknown account role", async () => {
    authMocks.useSession.mockReturnValue({ data: { user: { id: "user-1", role: "unexpected" } }, isPending: false });
    renderAdmin("DATA003");

    expect(await screen.findByRole("heading", { name: "Administrative access denied" })).toBeInTheDocument();
    expect(screen.getByText(/Current authorization role:/)).toHaveTextContent("user");
  });

  it("never renders fabricated admin records or action results", async () => {
    authMocks.useSession.mockReturnValue({ data: { user: { id: "user-1", role: "admin" } }, isPending: false });
    renderAdmin("ADM005");

    await screen.findByRole("heading", { name: "Administrative authorization verified" });
    expect(screen.queryByText(/player-one|player@example.com|INV-REQ-001|EID-10482/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Approve|Decline|Revoke|Deploy|Restart/ })).not.toBeInTheDocument();
  });

  it("lets an administrator validate and preview concrete entity import rows without applying them", async () => {
    authMocks.useSession.mockReturnValue({ data: { user: { id: "user-1", role: "admin" } }, isPending: false });
    renderAdmin("DATA_SOUL_IMPORT");

    const input = await screen.findByRole("textbox", { name: "Paste structured data" });
    fireEvent.change(input, { target: { value: '[{"soulId":"SOUL-1","name":"A supplied soul"}]' } });
    fireEvent.click(screen.getByRole("button", { name: "Validate & Preview" }));

    expect(screen.getByRole("heading", { name: "Concrete preview" })).toBeInTheDocument();
    expect(screen.getByText("SOUL-1")).toBeInTheDocument();
    expect(screen.getByText("A supplied soul")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply unavailable" })).toBeDisabled();
  });

  it("reports unmapped fields before an entity import can pass validation", async () => {
    authMocks.useSession.mockReturnValue({ data: { user: { id: "user-1", role: "owner" } }, isPending: false });
    renderAdmin("DATA_SOUL_IMPORT");

    const input = await screen.findByRole("textbox", { name: "Paste structured data" });
    fireEvent.change(input, { target: { value: '[{"soulId":"SOUL-1","unapproved":"value"}]' } });
    fireEvent.click(screen.getByRole("button", { name: "Validate & Preview" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Source field unapproved must be mapped or ignored.");
    expect(screen.queryByText("value")).not.toBeInTheDocument();
  });

  it("lets an admin review beta requests but not change authorization roles", async () => {
    authMocks.useSession.mockReturnValue({ data: { user: { id: "user-1", role: "admin" } }, isPending: false });
    renderAdmin("ADM003");

    expect((await screen.findByText("reviewInvitations")).parentElement).toHaveTextContent("reviewInvitations: granted");
    expect(screen.getByText("changeAuthorizationRoles").parentElement).toHaveTextContent("changeAuthorizationRoles: not granted");
    expect(screen.getByText(/Only OWNER may change authorization roles/)).toBeInTheDocument();
  });

  it("requires an explicit expiry before approving and sending a beta invitation", async () => {
    authMocks.useSession.mockReturnValue({ data: { user: { id: "user-1", role: "admin" } }, isPending: false });
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({
        json: async () => ({
          requests: [{
            id: "request-1",
            friendName: "Friend Name",
            email: "friend@example.test",
            reason: "Play together",
            status: "PENDING",
            createdAt: "2026-08-10T01:00:00Z",
            invitation: null,
          }],
        }),
        ok: true,
      })
      .mockResolvedValue({ json: async () => ({ approved: true }), ok: true }));
    renderAdmin("ADM004");

    const approve = await screen.findByRole("button", { name: "Approve & send" });
    expect(approve).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Invitation expiry"), { target: { value: "2026-08-20T12:00" } });
    expect(approve).toBeEnabled();
    fireEvent.click(approve);

    await vi.waitFor(() => expect(fetch).toHaveBeenCalledWith(
      "/api/admin/beta-invitations/request-1/approve",
      expect.objectContaining({ method: "POST" }),
    ));
    expect(screen.queryByText(/single-use-code|codeHash/)).not.toBeInTheDocument();
  });
});
