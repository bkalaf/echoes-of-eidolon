import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { pageManifest } from "../../src/lib/page-manifest";
import { BulkOperationsAdminPage } from "../../src/screens/admin/BulkOperationsAdminPage";

function renderState(screenId: string, pathname?: string) {
  const entry = pageManifest.find((candidate) => candidate.screenId === screenId)!;
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><BulkOperationsAdminPage pathname={pathname} screen={entry} /></QueryClientProvider>);
}

describe("Bulk Operations administration", () => {
  it("keeps the API off by default and shows a generated key exactly in the action result", async () => {
    const off = { activeSession: null, audits: [], envelopes: [], maximumLifetimeMinutes: 60, state: "OFF" };
    const on = { ...off, activeSession: { createdAt: "2026-08-10T12:00:00Z", externalBulkApiSessionId: "11111111-1111-4111-8111-111111111111", issuedBy: { email: "owner@example.test", name: "Owner" }, lastActivityAt: "2026-08-10T12:00:00Z", state: "KEYED" }, state: "KEYED" };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ json: async () => off, ok: true })
      .mockResolvedValueOnce({ json: async () => ({ key: "eid_tmp_copy_once" }), ok: true })
      .mockResolvedValueOnce({ json: async () => on, ok: true });
    vi.stubGlobal("fetch", fetchMock);
    renderState("ADM020");
    expect(await screen.findByRole("heading", { name: "OFF" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Generate Key" }));
    expect(await screen.findByText("eid_tmp_copy_once")).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/bulk-operations", expect.objectContaining({ method: "POST" })));
  });

  it("renders append-only audit rows in the reviewed audit state", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ activeSession: null, envelopes: [], maximumLifetimeMinutes: 60, state: "OFF", audits: [{ actor: null, bulkOperationAuditId: "audit-1", detail: null, entityName: "Soul", occurredAt: "2026-08-10T12:00:00Z", operation: "IMPORT", recordCount: 2, result: "CHANGED" }] }), ok: true }));
    renderState("ADM022");
    expect(await screen.findByRole("heading", { name: "Bulk Operations Audit" })).toBeInTheDocument();
    expect(screen.getByText("Temporary API key")).toBeInTheDocument();
    expect(screen.getByText("Soul")).toBeInTheDocument();
    expect(screen.getByText("CHANGED")).toBeInTheDocument();
  });

  it("exposes ordered rerun, apply, and delete actions on the envelope detail form", async () => {
    const envelope = { bulkMutationEnvelopeId: "11111111-1111-4111-8111-111111111111", decidedAt: null, dryRunResult: { valid: true }, entityCode: "worldbuilding-research", notes: "Ready", operation: "CREATE", receivedAt: "2026-08-10T12:00:00Z", recordCount: 3, revalidationResult: null, sequence: "1", status: "PENDING_REVIEW" };
    const overview = { activeSession: null, audits: [], envelopes: [envelope], maximumLifetimeMinutes: 60, state: "OFF" };
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => overview, ok: true });
    vi.stubGlobal("fetch", fetchMock);
    renderState("BULK02_BULK_CHANGE_DETAIL_V2", `/admin/bulk-changes/${envelope.bulkMutationEnvelopeId}`);

    expect(await screen.findByRole("button", { name: "Rerun dry-run for sequence 1" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Apply sequence 1" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Delete sequence 1" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Rerun dry-run for sequence 1" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/bulk-operations", expect.objectContaining({ method: "POST", body: JSON.stringify({ action: "rerun", envelopeId: envelope.bulkMutationEnvelopeId }) })));
  });
});
