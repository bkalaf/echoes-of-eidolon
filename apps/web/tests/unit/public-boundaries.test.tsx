import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { pageManifest } from "../../src/lib/page-manifest";
import { contactTopicSchema, contactTopicTokens } from "../../src/domain/contact";
import { PublicPage } from "../../src/screens/public/PublicPage";

function publicScreen(screenId: string) {
  return pageManifest.find((entry) => entry.screenId === screenId)!;
}

function renderWithQuery(screenId: string, pathname?: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><PublicPage pathname={pathname} screen={publicScreen(screenId)} /></QueryClientProvider>);
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

  it("selects feature content by explicit screen identity rather than mutable title", () => {
    render(<PublicPage screen={{ ...publicScreen("FEATURE_01"), title: "Changed review title" }} />);

    expect(screen.getByRole("heading", { name: "A Living World", level: 1 })).toBeInTheDocument();
  });

  it("does not turn an unknown feature screen into the first feature", () => {
    render(<PublicPage screen={{ ...publicScreen("FEATURE_01"), screenId: "FEATURE_UNKNOWN" }} />);

    expect(screen.getByRole("heading", { name: "Feature unavailable" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "A Living World", level: 1 })).not.toBeInTheDocument();
  });

  it("keeps all eight approved contact topics and enables validated persisted delivery", () => {
    render(<PublicPage screen={publicScreen("PUB015")} />);
    expect(screen.getAllByRole("button").filter((button) => button.classList.contains("topic"))).toHaveLength(8);
    expect(contactTopicTokens).toEqual([...contactTopicTokens].sort());
    expect(screen.getByRole("button", { name: "Clear General company inquiry" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Clear General company inquiry" })).toHaveClass("selected");
    fireEvent.click(screen.getByRole("button", { name: "Select Press and media" }));
    expect(screen.getByRole("button", { name: "Clear Press and media" })).toHaveClass("topic--tone-5");
    expect(document.querySelector<HTMLInputElement>('input[name="topic"]')).toHaveValue("PRESS");
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
    expect(screen.getByText(/Player support messages should be sent from the Support tab/)).toBeInTheDocument();
  });

  it("rejects every fabricated company contact topic", () => {
    expect(contactTopicSchema.safeParse("SUPPORT").success).toBe(false);
    expect(contactTopicSchema.safeParse("GENERAL").success).toBe(true);
  });

  it("uses the exact invitation consent and requires a session before submission", () => {
    render(<PublicPage screen={publicScreen("PUB023")} />);
    expect(screen.getByText("I agree to be contacted by email.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit request" })).toBeDisabled();
  });

  it("does not turn the donation example into a default selection", () => {
    render(<PublicPage screen={publicScreen("PUB009")} />);
    expect(screen.getByLabelText("Amount in US dollars")).toHaveValue(null);
    expect(screen.getByText("Not selected")).toBeInTheDocument();
    expect(screen.queryByText("$50.00")).not.toBeInTheDocument();
    expect(screen.queryByText("+6 months")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue to secure payment" })).toBeDisabled();
  });

  it("shows the exact donation membership grant for the selected amount", () => {
    render(<PublicPage screen={publicScreen("PUB009")} />);

    fireEvent.change(screen.getByLabelText("Amount in US dollars"), { target: { value: "50" } });

    expect(screen.getByText("$50.00")).toBeInTheDocument();
    expect(screen.getByText("+6 months")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue to secure payment" })).toBeEnabled();
  });

  it("does not turn the reviewed eligible donation state into a live eligibility result", () => {
    render(<PublicPage screen={publicScreen("PUB021")} />);
    expect(screen.queryByRole("heading", { name: "Eligible participant" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Continue to donation checkout" })).not.toBeInTheDocument();
  });

  it("does not fabricate version history when no published release exists", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ releases: [] }) }));
    renderWithQuery("PUB017");
    expect(await screen.findByText("No player-visible release has been published.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Release archive" })).toBeInTheDocument();
    expect(screen.queryByText(/v0\.2\.0|v0\.1\.9|v0\.1\.8/)).not.toBeInTheDocument();
  });

  it("preserves corrected release-detail navigation without fake content", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ releases: [] }) }));
    renderWithQuery("PUB018");
    expect(screen.getByRole("link", { name: /Back to Release Notes/ })).toHaveAttribute("href", "/status/releases");
    expect(await screen.findByText("No player-visible release has been published.")).toBeInTheDocument();
  });

  it("selects a published release from the concrete version route and links adjacent releases", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ releases: [
      { releaseId: "R-2", version: "0.2.0", gitSha: "2".repeat(40), summary: "Current supplied release", publishedAt: "2026-08-10T00:00:00Z", notes: [] },
      { releaseId: "R-1", version: "0.1.0", gitSha: "1".repeat(40), summary: "Earlier supplied release", publishedAt: "2026-08-01T00:00:00Z", notes: [] },
    ] }) }));
    renderWithQuery("PUB018", "/status/releases/0.1.0");
    expect(await screen.findByRole("heading", { name: "0.1.0", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Earlier supplied release")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute("href", "/status/releases/0.2.0");
    expect(screen.queryByText("Current supplied release")).not.toBeInTheDocument();
  });
});
