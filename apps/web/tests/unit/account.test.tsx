import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  changePassword: vi.fn(),
  changeEmail: vi.fn(),
  listSessions: vi.fn(),
  requestPasswordReset: vi.fn(),
  sendVerificationOtp: vi.fn(),
  updateUser: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock("../../src/lib/auth-client", () => ({
  authClient: {
    changePassword: authMocks.changePassword,
    emailOtp: {
      changeEmail: authMocks.changeEmail,
      requestPasswordReset: authMocks.requestPasswordReset,
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
    authMocks.changePassword.mockResolvedValue({ data: { status: true }, error: null });
    authMocks.requestPasswordReset.mockResolvedValue({ data: { status: true }, error: null });
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

  it("lists only authenticated server-projected orders without provider identifiers", async () => {
    authMocks.useSession.mockReturnValue({
      data: { user: { email: "player@example.test", name: "Player", username: "player" } },
      isPending: false,
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: async () => ({
        orders: [{
          createdAt: "2026-08-10T00:00:00.000Z",
          lines: [{ color: null, name: "Poster", orderLineId: "LINE-1", quantity: 1, size: null, storeVariantId: "VARIANT-1", unitPriceCents: 2500 }],
          orderId: "ORDER-1",
          payment: { amountCents: 2500, confirmedAt: "2026-08-10T00:01:00.000Z", fulfillmentSubmittedAt: null },
          refunds: [],
          returnEligibleAt: null,
        }],
      }),
      ok: true,
    }));

    render(<AccountPage pathname="/account/orders" screen={accountScreen("ACC011")} />);

    expect(await screen.findByRole("link", { name: "ORDER-1" })).toHaveAttribute("href", "/account/orders/ORDER-1");
    expect(screen.getByText("$25.00 confirmed")).toBeInTheDocument();
    expect(screen.getByText("Not submitted")).toBeInTheDocument();
    expect(screen.queryByText(/stripe_|printful_/i)).not.toBeInTheDocument();
  });

  it("shows a return action only when persisted order eligibility exists", async () => {
    authMocks.useSession.mockReturnValue({
      data: { user: { email: "player@example.test", name: "Player", username: "player" } },
      isPending: false,
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: async () => ({
        order: {
          createdAt: "2026-08-10T00:00:00.000Z",
          lines: [],
          orderId: "ORDER-1",
          payment: null,
          refunds: [],
          returnEligibleAt: null,
        },
      }),
      ok: true,
    }));

    render(<AccountPage pathname="/account/orders/ORDER-1/return" screen={accountScreen("ACC013")} />);

    expect(await screen.findByRole("heading", { name: "Return unavailable" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit return unavailable" })).not.toBeInTheDocument();
  });

  it("fails closed for an unknown authenticated account screen", () => {
    authMocks.useSession.mockReturnValue({
      data: { user: { email: "owner@example.test", name: "Owner", username: "owner" } },
      isPending: false,
    });
    render(<AccountPage screen={{ ...accountScreen("ACC022"), screenId: "ACC_UNKNOWN" }} />);

    expect(screen.getByRole("heading", { name: "Account screen unavailable" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Request a friend invitation" })).not.toBeInTheDocument();
  });

  it("renders immutable identity as static values and saves only the focusable display name", async () => {
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

    expect(screen.queryByRole("textbox", { name: "Username" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Email" })).not.toBeInTheDocument();
    expect(screen.getByText("Owner_Name")).toBeVisible();
    expect(screen.getByText("owner@example.test")).toBeVisible();
    const displayName = screen.getByRole("textbox", { name: "Display name" });
    displayName.focus();
    expect(displayName).toHaveFocus();
    fireEvent.change(displayName, {
      target: { value: "Updated Name" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(authMocks.updateUser).toHaveBeenCalledWith({ name: "Updated Name" }));
  });

  it("projects the authenticated beta landing from server-owned access dimensions", async () => {
    authMocks.useSession.mockReturnValue({
      data: { user: { email: "player@example.test", name: "Player", username: "player" } },
      isPending: false,
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: async () => ({
        betaEligible: true,
        canPlay: true,
        membershipEntitled: false,
        role: "user",
        voiceWindowSeconds: 15,
      }),
      ok: true,
    }));

    render(<AccountPage screen={accountScreen("ACC030")} />);

    expect(await screen.findByRole("heading", { name: "Beta access verified" })).toBeInTheDocument();
    expect(screen.getByText("USER")).toBeInTheDocument();
    expect(screen.getByText("Inactive")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Enter Game" })).toHaveAttribute("href", "/game");
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

    expect(screen.queryByRole("textbox", { name: "Current email" })).not.toBeInTheDocument();
    expect(screen.getAllByText("owner@example.test")).toHaveLength(2);
    expect(screen.queryByLabelText("Current password")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send Verification" })).toBeDisabled();
  });

  it("exposes authenticated password management through Better Auth with canonical password controls", async () => {
    authMocks.useSession.mockReturnValue({
      data: { user: { email: "owner@example.test", name: "Owner", username: "owner" } },
      isPending: false,
    });
    render(<AccountPage screen={accountScreen("ACC024")} />);

    const current = screen.getByLabelText("Current password");
    const replacement = screen.getByLabelText("New password", { exact: true });
    const confirmation = screen.getByLabelText("Confirm new password");
    expect(current).toHaveAttribute("autocomplete", "current-password");
    expect(replacement).toHaveAttribute("autocomplete", "new-password");
    expect(confirmation).toHaveAttribute("autocomplete", "new-password");
    expect(screen.getAllByRole("button", { name: "Show password" })).toHaveLength(3);
    const submit = screen.getByRole("button", { name: "Change Password" });
    expect(submit).toBeDisabled();

    fireEvent.change(current, { target: { value: "Old-Password!" } });
    fireEvent.change(replacement, { target: { value: "New-Password!" } });
    fireEvent.change(confirmation, { target: { value: "mismatch" } });
    expect(submit).toBeDisabled();
    fireEvent.change(confirmation, { target: { value: "New-Password!" } });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    await waitFor(() => expect(authMocks.changePassword).toHaveBeenCalledWith({
      currentPassword: "Old-Password!",
      newPassword: "New-Password!",
    }));
    expect(await screen.findByRole("heading", { name: "Password Changed" })).toBeVisible();
    expect(screen.getByText("Your password has been changed successfully.")).toBeVisible();
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

  it("shows the fixed monthly membership offer through server-owned Stripe checkout", async () => {
    authMocks.useSession.mockReturnValue({
      data: { user: { email: "owner@example.test", name: "Owner", username: "owner" } },
      isPending: false,
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: async () => ({ active: false, activePerks: [], effectiveEndAt: null, grants: [], subscription: null, voiceWindowSeconds: 15 }),
      ok: true,
    }));

    render(<AccountPage screen={accountScreen("ACC005")} />);

    expect(await screen.findByText("$9.99 per calendar month")).toBeInTheDocument();
    expect(screen.getByText("A subscription will never be required.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Subscribe with Stripe" })).toBeEnabled();
  });

  it.each([
    ["ACC006", "Payment accepted"],
    ["ACC007", "Payment not completed"],
    ["ACC009", "Cancel renewal"],
    ["ACC010", "Subscription event history"],
  ])("renders reviewed subscription state %s from persisted provider truth", async (screenId, expectedHeading) => {
    authMocks.useSession.mockReturnValue({ data: { user: { email: "owner@example.test", name: "Owner", username: "owner" } }, isPending: false });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: async () => ({
        active: true,
        activePerks: [],
        effectiveEndAt: "2027-03-31T00:00:00.000Z",
        grants: [{ effectiveEndAt: "2027-03-31T00:00:00.000Z", effectiveStartAt: "2027-02-28T00:00:00.000Z", membershipGrantId: "GRANT-1", monthsGranted: 1, source: "SUBSCRIPTION" }],
        subscription: { cancelAtPeriodEnd: false, events: [{ eventType: "invoice.paid", occurredAt: "2027-02-28T00:00:00.000Z", providerStatus: "ACTIVE" }], providerStatus: "ACTIVE", stripeCustomerReference: "cus_1" },
        voiceWindowSeconds: 30,
      }),
      ok: true,
    }));

    render(<AccountPage screen={accountScreen(screenId)} />);

    expect((await screen.findAllByRole("heading", { name: expectedHeading })).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/2027/).length).toBeGreaterThan(0);
  });

  it("lists current and other sessions and never offers to revoke the current session", async () => {
    authMocks.useSession.mockReturnValue({
      data: {
        session: { token: "current-token" },
        user: { email: "owner@example.test", name: "Owner", username: "owner" },
      },
      isPending: false,
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: async () => ({ sessions: [
        { sessionId: "session-current", isCurrent: true, userAgent: "Current browser", ipAddress: "127.0.0.1", updatedAt: "2026-08-10T01:00:00Z", expiresAt: "2026-08-17T01:00:00Z" },
        { sessionId: "session-other", isCurrent: false, userAgent: "Other browser", ipAddress: "192.0.2.1", updatedAt: "2026-08-09T01:00:00Z", expiresAt: "2026-08-16T01:00:00Z" },
      ] }),
      ok: true,
    }));
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
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        json: async () => ({ sessions: [
          { sessionId: "session-current", isCurrent: true, updatedAt: "2026-08-10T01:00:00Z", expiresAt: "2026-08-17T01:00:00Z" },
          { sessionId: "session-other", isCurrent: false, updatedAt: "2026-08-09T01:00:00Z", expiresAt: "2026-08-16T01:00:00Z" },
        ] }),
        ok: true,
      })
      .mockResolvedValue({ json: async () => ({ revoked: true }), ok: true });
    vi.stubGlobal("fetch", fetchMock);
    render(<AccountPage screen={accountScreen("ACC004")} />);
    fireEvent.click(await screen.findByRole("button", { name: "Revoke this other session" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/account/sessions/revoke-other",
      expect.objectContaining({
        body: JSON.stringify({ sessionId: "session-other" }),
        method: "POST",
      }),
    ));
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/account/sessions/revoke-other",
      expect.objectContaining({ body: JSON.stringify({ sessionId: "session-current" }) }),
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
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        json: async () => ({ sessions: [
          { sessionId: "session-current", isCurrent: true, updatedAt: "2026-08-10T01:00:00Z", expiresAt: "2026-08-17T01:00:00Z" },
          { sessionId: "session-other", isCurrent: false, updatedAt: "2026-08-09T01:00:00Z", expiresAt: "2026-08-16T01:00:00Z" },
        ] }),
        ok: true,
      })
      .mockResolvedValue({ json: async () => ({ revokedCount: 1 }), ok: true });
    vi.stubGlobal("fetch", fetchMock);
    render(<AccountPage screen={accountScreen("ACC004")} />);
    fireEvent.click(await screen.findByRole("button", { name: "Revoke all other sessions" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
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
    expect(screen.getByRole("button", { name: "Submit request" })).toBeDisabled();
    fireEvent.click(screen.getByLabelText("I agree to be contacted by email."));
    fireEvent.click(screen.getByRole("button", { name: "Submit request" }));

    expect(await screen.findByRole("heading", { name: "Invitation request received" })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/beta-invitations/request", expect.objectContaining({
      body: JSON.stringify({
        consent: true,
        email: "friend@example.test",
        friendName: "Friend Name",
        reason: "We want to investigate together.",
      }),
      method: "POST",
    }));
    expect(screen.queryByText(/rejected|queue position|pending review/i)).not.toBeInTheDocument();
  });

  it("does not infer a successful invitation submission from a reviewed screen state", () => {
    authMocks.useSession.mockReturnValue({
      data: { session: { token: "current-token" }, user: { email: "player@example.test", name: "Player", username: "player" } },
      isPending: false,
    });
    render(<AccountPage screen={accountScreen("ACC023")} />);

    expect(screen.getByRole("button", { name: "Submit request" })).toBeInTheDocument();
    expect(screen.getByText("I agree to be contacted by email.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Invitation request received" })).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});
