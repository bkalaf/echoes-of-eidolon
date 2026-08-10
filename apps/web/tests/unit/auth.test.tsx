import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({ acceptInvitation: vi.fn() }));

vi.mock("../../src/lib/auth-client", () => ({
  authClient: {
    organization: { acceptInvitation: authMocks.acceptInvitation },
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
    authMocks.acceptInvitation.mockResolvedValue({ data: {}, error: null });
    window.history.replaceState({}, "", "/");
  });

  it("uses the privacy-minimal signup eligibility contract", () => {
    render(<AuthPage screen={authScreen("AUTH03")} />);

    expect(screen.getByRole("radio", { name: "18 or older" })).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: "14–17 with guardian permission" }),
    ).toBeInTheDocument();
    expect(screen.getByText("No date of birth or numeric age requested.")).toBeInTheDocument();
    expect(screen.queryByText("Invitation required")).not.toBeInTheDocument();
  });

  it("accepts an opaque Better Auth organization invitation ID", async () => {
    const invite = render(<AuthPage screen={authScreen("AUTH07")} />);
    const submit = screen.getByRole("button", { name: "Redeem Invitation" });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Invitation code"), {
      target: { value: "opaque-invitation-id" },
    });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);
    await waitFor(() => {
      expect(authMocks.acceptInvitation).toHaveBeenCalledWith({
        invitationId: "opaque-invitation-id",
      });
    });
    expect(await screen.findByText("Invitation accepted.")).toBeInTheDocument();
    invite.unmount();
  });

  it("fails closed for two-factor until its service contract is supplied", () => {
    render(<AuthPage screen={authScreen("AUTH08")} />);
    expect(screen.getByRole("button", { name: "Verify" })).toBeDisabled();
  });
});
