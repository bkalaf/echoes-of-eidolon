import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  changeEmail: vi.fn(),
  listSessions: vi.fn(),
  revokeOtherSessions: vi.fn(),
  revokeSession: vi.fn(),
  sendVerificationOtp: vi.fn(),
  signInEmail: vi.fn(),
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
    revokeOtherSessions: authMocks.revokeOtherSessions,
    revokeSession: authMocks.revokeSession,
    signIn: { email: authMocks.signInEmail },
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
    authMocks.revokeOtherSessions.mockResolvedValue({ data: { status: true }, error: null });
    authMocks.revokeSession.mockResolvedValue({ data: { status: true }, error: null });
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

  it("shows unowned subscription state as deferred instead of active or declined", () => {
    authMocks.useSession.mockReturnValue({
      data: { user: { email: "owner@example.test", name: "Owner", username: "owner" } },
      isPending: false,
    });
    render(<AccountPage screen={accountScreen("ACC008")} />);

    expect(screen.getByRole("heading", { name: "Subscription - Active" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Owner-deferred" })).toBeInTheDocument();
    expect(screen.queryByText("Subscription active.")).not.toBeInTheDocument();
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

    await waitFor(() => expect(authMocks.revokeSession).toHaveBeenCalledWith({ token: "other-token" }));
    expect(authMocks.revokeSession).not.toHaveBeenCalledWith({ token: "current-token" });
  });

  it("uses Better Auth's other-session operation for revoke all other sessions", async () => {
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

    await waitFor(() => expect(authMocks.revokeOtherSessions).toHaveBeenCalledTimes(1));
    expect(authMocks.revokeSession).not.toHaveBeenCalledWith({ token: "current-token" });
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
