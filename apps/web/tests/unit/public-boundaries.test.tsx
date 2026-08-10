import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { pageManifest } from "../../src/lib/page-manifest";
import { PublicPage } from "../../src/screens/public/PublicPage";

function publicScreen(screenId: string) {
  return pageManifest.find((entry) => entry.screenId === screenId)!;
}

describe("public mutation boundaries", () => {
  it("keeps all eight approved contact topics and blocks unowned delivery", () => {
    render(<PublicPage screen={publicScreen("PUB015")} />);
    expect(screen.getAllByRole("button").filter((button) => button.classList.contains("topic"))).toHaveLength(8);
    expect(screen.getByRole("button", { name: "Send unavailable" })).toBeDisabled();
    expect(screen.getByText(/The support recipient is not reused/)).toBeInTheDocument();
  });

  it("uses the exact invitation consent and blocks unowned issuance", () => {
    render(<PublicPage screen={publicScreen("PUB023")} />);
    expect(screen.getByText("I agree to be contacted by email.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit unavailable" })).toBeDisabled();
  });

  it("shows the reviewed donation amount and grant without enabling an unowned payment", () => {
    render(<PublicPage screen={publicScreen("PUB009")} />);
    expect(screen.getAllByText("$50.00")).toHaveLength(2);
    expect(screen.getByText("+6 months")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Donate unavailable" })).toBeDisabled();
  });
});
