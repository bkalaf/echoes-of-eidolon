import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { pageManifest } from "../../src/lib/page-manifest";
import { OperationsAdminPage } from "../../src/screens/admin/OperationsAdminPage";

afterEach(() => vi.unstubAllGlobals());

describe("release-note operations boundary", () => {
  it("publishes a matching reviewed draft without exposing a deployment action", async () => {
    const release = { gitSha: "a".repeat(40), publishedAt: null, releaseId: "REL-1", status: "DRAFT", summary: "Reviewed notes", version: "0.2.0" };
    const fetchMock = vi.fn().mockImplementation(async (request: RequestInfo | URL) => String(request).includes("/publish")
      ? { json: async () => ({ release: { ...release, status: "PUBLISHED" } }), ok: true }
      : { json: async () => ({ releases: [release] }), ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const entry = pageManifest.find((item) => item.screenId === "OPS002")!;
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><OperationsAdminPage screen={entry} /></QueryClientProvider>);
    fireEvent.click(await screen.findByRole("button", { name: "Publish reviewed notes" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/releases/REL-1/publish", {
      body: JSON.stringify({ gitSha: "a".repeat(40) }),
      headers: { "content-type": "application/json" },
      method: "POST",
    }));
    expect(await screen.findByRole("status")).toHaveTextContent("No deployment was started");
    expect(screen.getByRole("button", { name: "Requires explicit authorization" })).toBeDisabled();
    expect(initMethods(fetchMock)).not.toContain("DEPLOY");
  });
});

function initMethods(mock: ReturnType<typeof vi.fn>): string[] {
  return mock.mock.calls.map((call) => String(call[1]?.method ?? "GET"));
}
