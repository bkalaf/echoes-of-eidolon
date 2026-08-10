import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { pageManifest } from "../../src/lib/page-manifest";
import { AuthPage } from "../../src/screens/auth/AuthPage";

function authScreen(screenId: string) {
  return pageManifest.find((entry) => entry.screenId === screenId)!;
}

describe("reviewed authentication states", () => {
  it("uses the privacy-minimal signup eligibility contract", () => {
    render(<AuthPage screen={authScreen("AUTH03")} />);

    expect(screen.getByRole("radio", { name: "18 or older" })).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: "14–17 with guardian permission" }),
    ).toBeInTheDocument();
    expect(screen.getByText("No date of birth or numeric age requested.")).toBeInTheDocument();
    expect(screen.queryByText("Invitation required")).not.toBeInTheDocument();
  });

  it("fails closed for auth operations whose service contract is absent", () => {
    const invite = render(<AuthPage screen={authScreen("AUTH07")} />);
    expect(screen.getByRole("button", { name: "Redeem Invitation" })).toBeDisabled();
    invite.unmount();

    render(<AuthPage screen={authScreen("AUTH08")} />);
    expect(screen.getByRole("button", { name: "Verify" })).toBeDisabled();
  });
});
