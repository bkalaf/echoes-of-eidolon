import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { pageManifest } from "../../src/lib/page-manifest";
import { OperationsAdminPage } from "../../src/screens/admin/OperationsAdminPage";

afterEach(() => vi.unstubAllGlobals());

describe("release-note operations boundary", () => {
  it("projects canonical drafts without exposing runtime publication or deployment", async () => {
    const release = { version: "0.2.0", status: "DRAFT", title: "Echoes of Eidolon 0.2.0", summary: "Reviewed notes", releaseDate: null, previousVersion: null, items: [] };
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ releases: [release] }), ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const entry = pageManifest.find((item) => item.screenId === "OPS002")!;
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><OperationsAdminPage screen={entry} /></QueryClientProvider>);
    expect(await screen.findByText("Echoes of Eidolon 0.2.0")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Publish reviewed notes" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create draft" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Owner-reviewed repository change required" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Requires explicit authorization" })).toBeDisabled();
    expect(initMethods(fetchMock)).toEqual(["GET"]);
  });

  it("removes the unauthorized bucket workflow and routes document work to Campaign Manager", () => {
    const entry = pageManifest.find((item) => item.screenId === "OPS001")!;
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><OperationsAdminPage screen={entry} /></QueryClientProvider>);
    expect(screen.queryByText("Document Builder")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Document bucket")).not.toBeInTheDocument();
    expect(screen.queryByText("Select a bucket")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Historical Document Corpus" })).toHaveAttribute("href", "/admin/campaigns/current/documents");
    expect(screen.getByRole("link", { name: "Document Quest and Research Planner" })).toHaveAttribute("href", "/admin/campaigns/current/document-quests");
  });
});

function initMethods(mock: ReturnType<typeof vi.fn>): string[] {
  return mock.mock.calls.map((call) => String(call[1]?.method ?? "GET"));
}
