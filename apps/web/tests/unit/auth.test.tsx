import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({ sendOtp: vi.fn(), signInEmail: vi.fn(), useSession: vi.fn(), verifyOtp: vi.fn() }));

vi.mock("../../src/lib/auth-client", () => ({
  authClient: {
    signIn: { email: authMocks.signInEmail },
    twoFactor: { sendOtp: authMocks.sendOtp, verifyOtp: authMocks.verifyOtp },
    useSession: authMocks.useSession,
  },
}));

import { pageManifest } from "../../src/lib/page-manifest";
import { loginSoundtrackKeys } from "../../src/content/managed-assets";
import { AuthPage } from "../../src/screens/auth/AuthPage";

function authScreen(screenId: string) {
  return pageManifest.find((entry) => entry.screenId === screenId)!;
}

describe("reviewed authentication states", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.sendOtp.mockResolvedValue({ data: { status: true }, error: null });
    authMocks.signInEmail.mockResolvedValue({ data: {}, error: null });
    authMocks.verifyOtp.mockResolvedValue({ data: {}, error: null });
    authMocks.useSession.mockReturnValue({ data: null, isPending: false });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: async () => ({ redeemed: true }),
      ok: true,
    }));
    window.sessionStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  it("uses the privacy-minimal signup eligibility contract", () => {
    render(<AuthPage screen={authScreen("AUTH03")} />);

    expect(screen.getByLabelText("Username")).not.toHaveAttribute("minlength");
    expect(screen.getByLabelText("Username")).not.toHaveAttribute("maxlength");
    expect(screen.getByLabelText("Password")).not.toHaveAttribute("minlength");
    expect(screen.getByRole("radio", { name: "18 or older" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "14–17 with verified guardian consent" })).toBeDisabled();
    expect(screen.getByText(/No date of birth or exact age is collected/)).toBeInTheDocument();
    expect(screen.queryByText("Invitation required")).not.toBeInTheDocument();
  });

  it("passes only a safe preserved return URL to Better Auth sign-in", async () => {
    window.history.replaceState({}, "", "/auth/sign-in?returnTo=%2Fgame%2Fmaps%3Flayer%3Dknown");
    render(<AuthPage screen={authScreen("AUTH01")} />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "player@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "long-password" } });
    const submit = screen.getByRole("button", { name: "Sign In" });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);

    await waitFor(() => expect(authMocks.signInEmail).toHaveBeenCalledWith({
      callbackURL: "/game/maps?layer=known",
      email: "player@example.com",
      password: "long-password",
    }));
    expect(loginSoundtrackKeys).toContain(window.sessionStorage.getItem("echoes.login-soundtrack"));
  });

  it("does not leave a soundtrack queued after a failed sign-in", async () => {
    authMocks.signInEmail.mockResolvedValue({ data: null, error: { message: "Invalid credentials" } });
    render(<AuthPage screen={authScreen("AUTH01")} />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "player@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "long-password" } });
    const submit = screen.getByRole("button", { name: "Sign In" });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid credentials");
    expect(window.sessionStorage.getItem("echoes.login-soundtrack")).toBeNull();
  });

  it("redeems a bearer beta invitation without changing an organization role", async () => {
    const invite = render(<AuthPage screen={authScreen("AUTH07")} />);
    const submit = screen.getByRole("button", { name: "Redeem Invitation" });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Invitation code"), {
      target: { value: "one-time-beta-code" },
    });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/beta-invitations/redeem", expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ code: "one-time-beta-code" }),
      }));
    });
    expect(await screen.findByText("Invitation redeemed. Beta access granted.")).toBeInTheDocument();
    invite.unmount();
  });

  it("sends and verifies a six-digit email two-factor OTP", async () => {
    render(<AuthPage screen={authScreen("AUTH08")} />);
    expect(screen.getByLabelText("6-digit code")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("6-digit code")).toHaveAttribute("maxlength", "6");
    expect(screen.getByLabelText("6-digit code")).toHaveAttribute("pattern", "[0-9]{6}");
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));
    await waitFor(() => expect(authMocks.sendOtp).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText("6-digit code"), { target: { value: "123456" } });
    const verify = screen.getByRole("button", { name: "Verify" });
    await waitFor(() => expect(verify).toBeEnabled());
    fireEvent.click(verify);
    await waitFor(() => expect(authMocks.verifyOtp).toHaveBeenCalledWith({ code: "123456" }));
    expect(await screen.findByText("Two-factor verification completed.")).toBeInTheDocument();
  });
});
