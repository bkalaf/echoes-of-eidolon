import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  changeEmail: vi.fn(),
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
});
