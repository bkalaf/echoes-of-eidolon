import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  changeEmail: vi.fn(),
  listSessions: vi.fn(),
  sendVerificationOtp: vi.fn(),
  updateUser: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock("../../src/lib/auth-client", () => ({
  authClient: {
    emailOtp: {
      changeEmail: authMocks.changeEmail,
      sendVerificationOtp: authMocks.sendVerificationOtp,
    },
    listSessions: authMocks.listSessions,
    updateUser: authMocks.updateUser,
    useSession: authMocks.useSession,
  },
}));

import { pageManifest } from "../../src/lib/page-manifest";
import { AccountPage } from "../../src/screens/account/AccountPage";

function accountScreen(screenId: string) {
  return pageManifest.find((entry) => entry.screenId === screenId)!;
}

describe("account session boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.updateUser.mockResolvedValue({ error: null });
    authMocks.listSessions.mockResolvedValue({ data: [], error: null });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: async () => ({}),
      ok: true,
    }));
  });

  it("does not expose fabricated account data without a session", () => {
    authMocks.useSession.mockReturnValue({ data: null, isPending: false });
    render(<AccountPage screen={accountScreen("ACC011")} />);

    expect(screen.getByRole("heading", { name: "Orders" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sign in required" })).toBeInTheDocument();
    expect(screen.queryByText(/EID-1042/)).not.toBeInTheDocument();
  });

  it("renders the authenticated Better Auth identity and saves only the display name", async () => {
    authMocks.useSession.mockReturnValue({
      data: {
        user: {
          email: "owner@example.test",
          name: "Owner Name",
          username: "owner_name",
          displayUsername: "Owner_Name",
        },
      },
      isPending: false,
    });
    render(<AccountPage screen={accountScreen("ACC001")} />);

    expect(screen.getByDisplayValue("Owner_Name")).toHaveAttribute("readonly");
    expect(screen.getByDisplayValue("owner@example.test")).toHaveAttribute("readonly");
    fireEvent.change(screen.getByDisplayValue("Owner Name"), {
      target: { value: "Updated Name" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(authMocks.updateUser).toHaveBeenCalledWith({ name: "Updated Name" }));
  });

  it("uses the dedicated six-digit OTP control for email re-verification", () => {
    authMocks.useSession.mockReturnValue({
      data: { user: { email: "owner@example.test", name: "Owner", username: "owner" } },
      isPending: false,
    });
    render(<AccountPage screen={accountScreen("ACC003")} />);

    const code = screen.getByLabelText("Verification code");
    expect(code).toHaveAttribute("type", "text");
    expect(code).toHaveAttribute("maxlength", "6");
    expect(code).toHaveAttribute("pattern", "[0-9]{6}");
    fireEvent.change(screen.getByLabelText("New email"), { target: { value: "new@example.test" } });
    fireEvent.input(code, { target: { value: "12x3456" } });
    expect(code).toHaveValue("123456");
    expect(screen.getByRole("button", { name: "Verify & Change Email" })).toBeEnabled();
  });

  it("does not invent a current-password requirement for the change-email flow", () => {
    authMocks.useSession.mockReturnValue({
      data: { user: { email: "owner@example.test", name: "Owner", username: "owner" } },
      isPending: false,
    });
    render(<AccountPage screen={accountScreen("ACC002")} />);

    expect(screen.getByLabelText("Current email")).toHaveAttribute("readonly");
    expect(screen.queryByLabelText("Current password")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send Verification" })).toBeDisabled();
  });

  it("renders only server-projected membership state and keeps it separate from role and beta eligibility", async () => {
    authMocks.useSession.mockReturnValue({
      data: { user: { email: "owner@example.test", name: "Owner", username: "owner" } },
      isPending: false,
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: async () => ({
        active: false,
        activePerks: [],
        effectiveEndAt: null,
        grants: [],
        voiceWindowSeconds: 15,
      }),
      ok: true,
    }));
    render(<AccountPage screen={accountScreen("ACC008")} />);

    expect(screen.getByRole("heading", { name: "Subscription - Active" })).toBeInTheDocument();
    expect(await screen.findByText("Inactive")).toBeInTheDocument();
    expect(screen.getByText("No active entitlement")).toBeInTheDocument();
    expect(screen.getByText(/do not grant an authorization role or beta\/player eligibility/)).toBeInTheDocument();
    expect(screen.queryByText("Active", { exact: true })).not.toBeInTheDocument();
  });

  it("lists current and other sessions and never offers to revoke the current session", async () => {
    authMocks.useSession.mockReturnValue({
      data: {
        session: { token: "current-token" },
        user: { email: "owner@example.test", name: "Owner", username: "owner" },
      },
      isPending: false,
    });
    authMocks.listSessions.mockResolvedValue({
      data: [
        { token: "current-token", userAgent: "Current browser", ipAddress: "127.0.0.1", updatedAt: "2026-08-10T01:00:00Z", expiresAt: "2026-08-17T01:00:00Z" },
        { token: "other-token", userAgent: "Other browser", ipAddress: "192.0.2.1", updatedAt: "2026-08-09T01:00:00Z", expiresAt: "2026-08-16T01:00:00Z" },
      ],
      error: null,
    });
    render(<AccountPage screen={accountScreen("ACC004")} />);

    expect(await screen.findByText("Current browser")).toBeInTheDocument();
    expect(screen.getByText("Current session")).toBeInTheDocument();
    expect(screen.getByText("Other browser")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Revoke this other session" })).toHaveLength(1);
  });

  it("revokes one other session without revoking the current session", async () => {
    authMocks.useSession.mockReturnValue({
      data: {
        session: { token: "current-token" },
        user: { email: "owner@example.test", name: "Owner", username: "owner" },
      },
      isPending: false,
    });
    authMocks.listSessions.mockResolvedValue({
      data: [
        { token: "current-token", updatedAt: "2026-08-10T01:00:00Z", expiresAt: "2026-08-17T01:00:00Z" },
        { token: "other-token", updatedAt: "2026-08-09T01:00:00Z", expiresAt: "2026-08-16T01:00:00Z" },
      ],
      error: null,
    });
    render(<AccountPage screen={accountScreen("ACC004")} />);
    fireEvent.click(await screen.findByRole("button", { name: "Revoke this other session" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      "/api/account/sessions/revoke-other",
      expect.objectContaining({
        body: JSON.stringify({ token: "other-token" }),
        method: "POST",
      }),
    ));
    expect(fetch).not.toHaveBeenCalledWith(
      "/api/account/sessions/revoke-other",
      expect.objectContaining({ body: JSON.stringify({ token: "current-token" }) }),
    );
  });

  it("uses the server-owned other-session operation for revoke all other sessions", async () => {
    authMocks.useSession.mockReturnValue({
      data: {
        session: { token: "current-token" },
        user: { email: "owner@example.test", name: "Owner", username: "owner" },
      },
      isPending: false,
    });
    authMocks.listSessions.mockResolvedValue({
      data: [
        { token: "current-token", updatedAt: "2026-08-10T01:00:00Z", expiresAt: "2026-08-17T01:00:00Z" },
        { token: "other-token", updatedAt: "2026-08-09T01:00:00Z", expiresAt: "2026-08-16T01:00:00Z" },
      ],
      error: null,
    });
    render(<AccountPage screen={accountScreen("ACC004")} />);
    fireEvent.click(await screen.findByRole("button", { name: "Revoke all other sessions" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      "/api/account/sessions/revoke-all-other",
      { method: "POST" },
    ));
  });

  it("submits the friend beta-invitation request without exposing moderation state", async () => {
    authMocks.useSession.mockReturnValue({
      data: { session: { token: "current-token" }, user: { email: "player@example.test", name: "Player", username: "player" } },
      isPending: false,
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: async () => ({ received: true }),
      ok: true,
    }));
    render(<AccountPage screen={accountScreen("ACC022")} />);
    fireEvent.change(screen.getByLabelText("Friend name"), { target: { value: "Friend Name" } });
    fireEvent.change(screen.getByLabelText("Friend email"), { target: { value: "friend@example.test" } });
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "We want to investigate together." } });
    fireEvent.click(screen.getByRole("button", { name: "Submit request" }));

    expect(await screen.findByRole("heading", { name: "Invitation request received" })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/beta-invitations/request", expect.objectContaining({
      body: JSON.stringify({
        email: "friend@example.test",
        friendName: "Friend Name",
        reason: "We want to investigate together.",
      }),
      method: "POST",
    }));
    expect(screen.queryByText(/rejected|queue position|pending review/i)).not.toBeInTheDocument();
  });
});
