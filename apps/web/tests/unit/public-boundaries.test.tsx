import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { pageManifest } from "../../src/lib/page-manifest";
import { contactTopicSchema, contactTopicTokens } from "../../src/domain/contact";
import { PublicPage } from "../../src/screens/public/PublicPage";

function publicScreen(screenId: string) {
  return pageManifest.find((entry) => entry.screenId === screenId)!;
}

describe("public mutation boundaries", () => {
  it("preserves the approved gameplay loop and feature explanation copy", () => {
    const gameplay = render(<PublicPage screen={publicScreen("PUB003")} />);
    expect(screen.getByText("Your Knowledge Base grows as you discover people, places, books, history and connections.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Accept a challenge when you are ready" })).toBeInTheDocument();
    expect(screen.queryByText("Choose what matters")).not.toBeInTheDocument();
    gameplay.unmount();

    render(<PublicPage screen={publicScreen("FEATURE_01")} />);
    expect(screen.getByText("Feature video and screenshots explain the idea without revealing late-story structure.")).toBeInTheDocument();
    expect(screen.queryByText(/content-addressed managed storage/)).not.toBeInTheDocument();
  });

  it("keeps all eight approved contact topics and blocks unowned delivery", () => {
    render(<PublicPage screen={publicScreen("PUB015")} />);
    expect(screen.getAllByRole("button").filter((button) => button.classList.contains("topic"))).toHaveLength(8);
    expect(contactTopicTokens).toEqual([...contactTopicTokens].sort());
    expect(screen.getByRole("button", { name: "Clear General company inquiry" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Clear General company inquiry" })).toHaveClass("selected");
    fireEvent.click(screen.getByRole("button", { name: "Select Press and media" }));
    expect(screen.getByRole("button", { name: "Clear Press and media" })).toHaveClass("topic--tone-5");
    expect(document.querySelector<HTMLInputElement>('input[name="topic"]')).toHaveValue("PRESS");
    expect(screen.getByRole("button", { name: "Send unavailable" })).toBeDisabled();
    expect(screen.getByText(/The support recipient is not reused/)).toBeInTheDocument();
  });

  it("rejects every fabricated company contact topic", () => {
    expect(contactTopicSchema.safeParse("SUPPORT").success).toBe(false);
    expect(contactTopicSchema.safeParse("GENERAL").success).toBe(true);
  });

  it("uses the exact invitation consent and blocks unowned issuance", () => {
    render(<PublicPage screen={publicScreen("PUB023")} />);
    expect(screen.getByText("I agree to be contacted by email.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit unavailable" })).toBeDisabled();
  });

  it("does not turn the donation example into a default selection", () => {
    render(<PublicPage screen={publicScreen("PUB009")} />);
    expect(screen.getByLabelText("Amount in US dollars")).toHaveValue(null);
    expect(screen.getByText("Not selected")).toBeInTheDocument();
    expect(screen.queryByText("$50.00")).not.toBeInTheDocument();
    expect(screen.queryByText("+6 months")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Donate unavailable" })).toBeDisabled();
  });

  it("does not turn the reviewed eligible donation state into a live eligibility result", () => {
    render(<PublicPage screen={publicScreen("PUB021")} />);
    expect(screen.getByRole("heading", { name: "Eligibility unavailable" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Eligible participant" })).not.toBeInTheDocument();
  });

  it("does not fabricate version history without a release source", () => {
    render(<PublicPage screen={publicScreen("PUB017")} />);
    expect(screen.getByRole("navigation", { name: "Release archive by year and month" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Release notes unavailable" })).toBeInTheDocument();
    expect(screen.queryByText(/v0\.2\.0|v0\.1\.9|v0\.1\.8/)).not.toBeInTheDocument();
  });

  it("preserves corrected release-detail navigation and sections without fake content", () => {
    render(<PublicPage screen={publicScreen("PUB018")} />);
    expect(screen.getByRole("link", { name: /Back to Release Notes/ })).toHaveAttribute("href", "/status/releases");
    for (const section of ["Summary", "Added", "Changed", "Fixed", "Known issues"]) {
      expect(screen.getByRole("heading", { name: section })).toBeInTheDocument();
    }
  });
});
