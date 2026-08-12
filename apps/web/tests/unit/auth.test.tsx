import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  passkey: vi.fn(), requestPasswordReset: vi.fn(), resetPassword: vi.fn(), sendOtp: vi.fn(),
  signInEmail: vi.fn(), useSession: vi.fn(), verifyOtp: vi.fn(),
}));

vi.mock("../../src/lib/auth-client", () => ({
  authClient: {
    signIn: { email: authMocks.signInEmail, passkey: authMocks.passkey },
    emailOtp: { requestPasswordReset: authMocks.requestPasswordReset, resetPassword: authMocks.resetPassword },
    twoFactor: { sendOtp: authMocks.sendOtp, verifyOtp: authMocks.verifyOtp },
    useSession: authMocks.useSession,
  },
}));

import { pageManifest } from "../../src/lib/page-manifest";
import { AuthPage } from "../../src/screens/auth/AuthPage";

function authScreen(screenId: string) {
  return pageManifest.find((entry) => entry.screenId === screenId)!;
}

describe("reviewed authentication states", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.sendOtp.mockResolvedValue({ data: { status: true }, error: null });
    authMocks.passkey.mockResolvedValue({ data: {}, error: null });
    authMocks.requestPasswordReset.mockResolvedValue({ data: { status: true }, error: null });
    authMocks.resetPassword.mockResolvedValue({ data: { status: true }, error: null });
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
    expect(screen.getByRole("radio", { name: /14–17; guardian consent evidence required/ })).toBeEnabled();
    expect(screen.getByText(/No date of birth or exact age is collected/)).toBeInTheDocument();
    expect(screen.queryByText("Invitation required")).not.toBeInTheDocument();
  });

  it("passes only a safe preserved return URL to Better Auth sign-in", async () => {
    window.history.replaceState({}, "", "/auth/sign-in?returnTo=%2Fgame%2Fmaps%3Flayer%3Dknown");
    render(<AuthPage screen={authScreen("AUTH01")} />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "player@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "long-password" } });
    expect(screen.getByRole("button", { name: "Show password" })).toBeVisible();
    const submit = screen.getByRole("button", { name: "Sign In" });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);

    await waitFor(() => expect(authMocks.signInEmail).toHaveBeenCalledWith({
      callbackURL: "/game/maps?layer=known",
      email: "player@example.com",
      password: "long-password",
    }));
    expect(window.sessionStorage.getItem("echoes.login-soundtrack")).toBeNull();
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

  it("preserves a safe return URL for passkey sign-in", async () => {
    window.history.replaceState({}, "", "/auth/passkeys?returnTo=%2Fgame%2Fknowledge");
    render(<AuthPage screen={authScreen("AUTH09")} />);
    fireEvent.click(screen.getByRole("button", { name: "Continue with a passkey" }));

    await waitFor(() => expect(authMocks.passkey).toHaveBeenCalledWith({
      fetchOptions: { onSuccess: expect.any(Function) },
    }));
  });

  it("moves forgot password into a complete reset form and validates both passwords", async () => {
    render(<AuthPage screen={authScreen("AUTH04")} />);
    expect(screen.getByText("Enter your email address and we'll send you a password reset code.")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "player@example.com" } });
    const request = screen.getByRole("button", { name: "Send Reset Code" });
    await waitFor(() => expect(request).toBeEnabled());
    fireEvent.click(request);
    expect(await screen.findByRole("heading", { name: "Reset Password" })).toBeInTheDocument();
    expect(screen.getByText("Enter the 6-digit code sent to your email, then choose a new password.")).toBeVisible();
    expect(window.location.pathname).toBe("/auth/reset-password");
    expect(screen.queryByRole("textbox", { name: "Account/email" })).not.toBeInTheDocument();
    expect(screen.getByText("player@example.com")).toBeVisible();
    const otp = screen.getByLabelText("Reset code");
    expect(document.querySelectorAll("[data-otp-slot]")).toHaveLength(6);
    expect(otp).toHaveAttribute("autocomplete", "one-time-code");
    expect(otp).toHaveAttribute("inputmode", "numeric");
    const newPassword = screen.getByLabelText("New password", { exact: true });
    expect(otp.compareDocumentPosition(newPassword) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Show password" })).toHaveLength(2);
    fireEvent.input(otp, { target: { value: "12x3456" } });
    expect(otp).toHaveValue("123456");
    fireEvent.change(newPassword, { target: { value: "replacement-password" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "mismatch" } });
    const submit = screen.getByRole("button", { name: "Reset Password" });
    await waitFor(() => expect(submit).toBeDisabled());
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "replacement-password" } });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);
    await waitFor(() => expect(authMocks.resetPassword).toHaveBeenCalledWith({
      email: "player@example.com", otp: "123456", password: "replacement-password",
    }));
    expect(await screen.findByRole("heading", { name: "Password Reset" })).toBeVisible();
    expect(screen.getByText("Your password has been changed successfully.")).toBeVisible();
    expect(screen.getByText("Sign in with your new password.")).toBeVisible();
    expect(screen.queryByText("Enter the 6-digit code sent to your email, then choose a new password.")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Reset code")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resend code" })).not.toBeInTheDocument();
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

  it("never copies an invitation bearer code from the URL into the form", () => {
    window.history.replaceState({}, "", "/auth/redeem-invitation?id=secret-in-history");
    render(<AuthPage screen={authScreen("AUTH07")} />);

    expect(screen.getByLabelText("Invitation code")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Redeem Invitation" })).toBeDisabled();
  });

  it("fails closed for an unknown authentication screen", () => {
    render(<AuthPage screen={{ ...authScreen("AUTH03"), screenId: "AUTH_UNKNOWN" }} />);

    expect(screen.getByRole("heading", { name: "Authentication unavailable" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create Account" })).not.toBeInTheDocument();
  });

  it("sends and verifies a six-digit email two-factor OTP", async () => {
    render(<AuthPage screen={authScreen("AUTH08")} />);
    expect(document.querySelectorAll("[data-otp-slot]")).toHaveLength(6);
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
