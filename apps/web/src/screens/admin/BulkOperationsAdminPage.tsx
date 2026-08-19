import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { DataTable, type DataTableColumnDef } from "../../components/DataTable";
import type { PageManifestEntry } from "../../lib/page-manifest";

interface BulkOverview {
  activeSession: null | { createdAt: string; externalBulkApiSessionId: string; issuedBy: { email: string; name: string }; lastActivityAt: string; state: "KEYED" | "KEYLESS" };
  audits: Array<{ actor: null | { email: string; name: string }; bulkOperationAuditId: string; detail: string | null; entityName: string; occurredAt: string; operation: string; recordCount: number; result: string }>;
  envelopes: Array<{ bulkMutationEnvelopeId: string; decidedAt: string | null; dryRunResult: unknown; entityCode: string; notes: string; operation: string; receivedAt: string; recordCount: number; revalidationResult: unknown; sequence: string; status: string }>;
  maximumLifetimeMinutes: number;
  state: "OFF" | "KEYED" | "KEYLESS";
}

type BulkAuditRow = BulkOverview["audits"][number];
type BulkEnvelopeRow = BulkOverview["envelopes"][number];

async function loadOverview(): Promise<BulkOverview> {
  const response = await fetch("/api/admin/bulk-operations");
  const result = await response.json() as BulkOverview | { error?: string };
  if (!response.ok || !("audits" in result)) throw new Error("Bulk operation state could not be loaded.");
  return result;
}

type BulkAction =
  | { action: "generate" | "enable-keyless" }
  | { action: "revoke"; sessionId: string }
  | { action: "apply" | "delete" | "rerun"; envelopeId: string };

export function BulkOperationsAdminPage({ pathname, screen }: { pathname?: string; screen: PageManifestEntry }) {
  const queryClient = useQueryClient();
  const overview = useQuery({ queryKey: ["bulk-operations"], queryFn: loadOverview });
  const [rawKey, setRawKey] = useState<string>();
  const action = useMutation({
    mutationFn: async (input: BulkAction) => {
      const response = await fetch("/api/admin/bulk-operations", { body: JSON.stringify(input), headers: { "content-type": "application/json" }, method: "POST" });
      const result = await response.json() as { error?: string; key?: string };
      if (!response.ok) throw new Error(result.error ?? "Bulk API action failed.");
      return result;
    },
    onSuccess: async (result, input) => {
      setRawKey(input.action === "generate" ? result.key : undefined);
      await queryClient.invalidateQueries({ queryKey: ["bulk-operations"] });
    },
  });
  if (overview.isLoading) return <p className="notice">Loading bulk operation authority…</p>;
  if (overview.error || !overview.data) return <p className="notice notice--bad" role="alert">{overview.error?.message ?? "Bulk operation state is unavailable."}</p>;
  const data = overview.data;
  const terminal = new Set(["APPLIED", "DELETED"]);
  const headEnvelope = data.envelopes.find((envelope) => !terminal.has(envelope.status));
  const selectedEnvelopeId = pathname?.startsWith("/admin/bulk-changes/") ? pathname.split("/").at(-1) : undefined;
  const selectedEnvelope = selectedEnvelopeId ? data.envelopes.find((envelope) => envelope.bulkMutationEnvelopeId === selectedEnvelopeId) : undefined;
  const envelopeColumns: DataTableColumnDef<BulkEnvelopeRow>[] = [
    { accessorKey: "sequence", header: "Sequence", cell: ({ row }) => <a href={`/admin/bulk-changes/${row.original.bulkMutationEnvelopeId}`}>{row.original.sequence}</a> },
    { accessorKey: "bulkMutationEnvelopeId", header: "Envelope ID" },
    { accessorKey: "entityCode", header: "Entity" },
    { accessorKey: "operation", header: "Operation" },
    { accessorKey: "status", header: "Status" },
    { accessorKey: "recordCount", header: "Records" },
    { accessorKey: "notes", header: "Notes" },
    { accessorKey: "receivedAt", header: "Received", cell: ({ row }) => new Date(row.original.receivedAt).toLocaleString() },
    { accessorKey: "decidedAt", header: "Decided", cell: ({ row }) => row.original.decidedAt ? new Date(row.original.decidedAt).toLocaleString() : "—" },
    { accessorFn: (row) => JSON.stringify(row.dryRunResult), header: "Dry-run result", id: "dryRunResult" },
    { accessorFn: (row) => row.revalidationResult == null ? "—" : JSON.stringify(row.revalidationResult), header: "Revalidation result", id: "revalidationResult" },
    { cell: ({ row }) => { const envelope = row.original; const actionable = headEnvelope?.bulkMutationEnvelopeId === envelope.bulkMutationEnvelopeId; return <div className="action-row"><button className="button" disabled={action.isPending || terminal.has(envelope.status)} onClick={() => action.mutate({ action: "rerun", envelopeId: envelope.bulkMutationEnvelopeId })}>Rerun dry-run</button><button className="button" disabled={action.isPending || !actionable} onClick={() => action.mutate({ action: "apply", envelopeId: envelope.bulkMutationEnvelopeId })}>Apply</button><button className="button button--danger" disabled={action.isPending || !actionable} onClick={() => action.mutate({ action: "delete", envelopeId: envelope.bulkMutationEnvelopeId })}>Delete</button></div>; }, enableColumnFilter: false, enableSorting: false, header: "Actions", id: "actions" },
  ];
  const auditColumns: DataTableColumnDef<BulkAuditRow>[] = [
    { accessorFn: (row) => row.actor?.name ?? "Temporary API key", header: "Actor", id: "actorName" },
    { accessorFn: (row) => row.actor?.email ?? "—", header: "Actor email", id: "actorEmail" },
    { accessorKey: "bulkOperationAuditId", header: "Audit ID" },
    { accessorKey: "operation", header: "Operation" },
    { accessorKey: "entityName", header: "Entity" },
    { accessorKey: "result", header: "Result" },
    { accessorKey: "recordCount", header: "Records" },
    { accessorKey: "detail", header: "Detail" },
    { accessorKey: "occurredAt", header: "Time", cell: ({ row }) => new Date(row.original.occurredAt).toLocaleString() },
  ];
  if (screen.screenId === "BULK02_BULK_CHANGE_DETAIL_V2") return <section className="card">
    <div className="action-row action-row--between"><div><p className="kicker">ORDERED MUTATION DETAIL</p><h2>{selectedEnvelope ? `Sequence ${selectedEnvelope.sequence}` : "Envelope not found"}</h2></div><a className="button" href="/admin/bulk-changes">Back to queue</a></div>
    {selectedEnvelope ? <div className="stack"><p><strong>{selectedEnvelope.entityCode}</strong> · {selectedEnvelope.operation} · {selectedEnvelope.recordCount} records</p><p>{selectedEnvelope.notes}</p><span className="tag">{selectedEnvelope.status}</span><div className="action-row"><button aria-label={`Rerun dry-run for sequence ${selectedEnvelope.sequence}`} className="button" disabled={action.isPending || terminal.has(selectedEnvelope.status)} onClick={() => action.mutate({ action: "rerun", envelopeId: selectedEnvelope.bulkMutationEnvelopeId })} title="Rerun dry-run">↻</button><button aria-label={`Apply sequence ${selectedEnvelope.sequence}`} className="button" disabled={action.isPending || headEnvelope?.bulkMutationEnvelopeId !== selectedEnvelope.bulkMutationEnvelopeId} onClick={() => action.mutate({ action: "apply", envelopeId: selectedEnvelope.bulkMutationEnvelopeId })} title="Apply">✓</button><button aria-label={`Delete sequence ${selectedEnvelope.sequence}`} className="button button--danger" disabled={action.isPending || headEnvelope?.bulkMutationEnvelopeId !== selectedEnvelope.bulkMutationEnvelopeId} onClick={() => action.mutate({ action: "delete", envelopeId: selectedEnvelope.bulkMutationEnvelopeId })} title="Delete">×</button></div><h3>Automatic dry-run</h3><pre className="code-block">{JSON.stringify(selectedEnvelope.dryRunResult, null, 2)}</pre>{selectedEnvelope.revalidationResult != null && <><h3>Apply-time revalidation</h3><pre className="code-block">{JSON.stringify(selectedEnvelope.revalidationResult, null, 2)}</pre></>}{action.error && <p className="notice notice--bad" role="alert">{action.error.message}</p>}</div> : <p className="notice notice--bad">No retained envelope matches this route.</p>}
  </section>;
  if (screen.screenId === "BULK01_BULK_CHANGES_QUEUE_V2") return <div className="stack">
    {rawKey && <section className="notice notice--good" role="status"><strong>Copy this temporary key now.</strong><p className="code-block">{rawKey}</p><p>Only its SHA-256 hash is retained.</p></section>}
    <section className="card"><div className="action-row action-row--between"><div><p className="kicker">EXTERNAL BULK GATEWAY</p><h2>{data.state}</h2><p>Modes expire after {data.maximumLifetimeMinutes} minutes without endpoint activity.</p></div><div className="action-row">{data.activeSession ? <button className="button button--danger" disabled={action.isPending} onClick={() => action.mutate({ action: "revoke", sessionId: data.activeSession!.externalBulkApiSessionId })}>Turn Off</button> : <><button className="button" disabled={action.isPending} onClick={() => action.mutate({ action: "enable-keyless" })}>Enable Keyless</button><button className="button button--gold" disabled={action.isPending} onClick={() => action.mutate({ action: "generate" })}>Generate Key</button></>}</div></div></section>
    <section className="card"><div className="action-row action-row--between"><div><p className="kicker">RECEIVE ORDER</p><h2>Bulk Changes Queue</h2></div><span className="tag">{data.envelopes.length} envelopes</span></div><DataTable columns={envelopeColumns} data={data.envelopes} getRowId={(row) => row.bulkMutationEnvelopeId} preferenceKey="admin.bulk.envelopes" /></section>
    {action.error && <p className="notice notice--bad" role="alert">{action.error.message}</p>}
  </div>;
  const auditView = screen.screenId === "ADM022";
  if (auditView) return <section className="card">
    <div className="action-row action-row--between"><div><p className="kicker">APPEND-ONLY ACTIVITY</p><h2>Bulk Operations Audit</h2></div><span className="tag">{data.audits.length} recent events</span></div>
    <DataTable columns={auditColumns} data={data.audits} getRowId={(row) => row.bulkOperationAuditId} preferenceKey="admin.bulk.audits" />
  </section>;
  return <div className="stack">
    {rawKey && <section className="notice notice--good" role="status"><strong>Copy this temporary key now.</strong><p className="code-block">{rawKey}</p><p>It will not be shown again. Only its SHA-256 hash is retained.</p></section>}
    <div className="two-column-grid">
      <section className="card"><div className="action-row action-row--between"><div><p className="kicker">EXTERNAL JSON API</p><h2>{data.state}</h2></div><span className={`tag ${data.state !== "OFF" ? "tag--good" : ""}`}>{data.state}</span></div>{data.activeSession ? <><p>Issued by {data.activeSession.issuedBy.name} · last activity {new Date(data.activeSession.lastActivityAt).toLocaleString()}.</p><button className="button button--danger" disabled={action.isPending} onClick={() => action.mutate({ action: "revoke", sessionId: data.activeSession!.externalBulkApiSessionId })}>Turn Off</button></> : <><p>OFF by default. Enable only when an external data session is required.</p><div className="action-row"><button className="button" disabled={action.isPending} onClick={() => action.mutate({ action: "enable-keyless" })}>Enable Keyless</button><button className="button button--gold" disabled={action.isPending} onClick={() => action.mutate({ action: "generate" })}>Generate Key</button></div></>}</section>
      <section className="card"><p className="kicker">API POLICY</p><h2>Bounded authority</h2><ul><li>Maximum lifetime: {data.maximumLifetimeMinutes} minutes</li><li>Plaintext shown once; stored hash only</li><li>Closed-world entity registry</li><li>Validated writes and atomic imports</li><li>Every accepted operation is audited</li></ul></section>
      <section className="card"><p className="kicker">BULK IMPORT</p><h2>Validated import workflow</h2><p>Choose an object type in the Data Registry, then parse, map, validate, preview, and atomically apply JSON, YAML, Markdown, or HTML records.</p><a className="button" href="/admin/data">Open Data Registry</a></section>
      <section className="card"><p className="kicker">RECENT ACTIVITY</p><h2>{data.audits.length} audit events</h2><p>Review successful, unchanged, and failed operations without exposing secret material.</p><a className="button" href="/admin/data/bulk-operations?state=ADM022">Open Audit</a></section>
    </div>
    {action.error && <p className="notice notice--bad" role="alert">{action.error.message}</p>}
  </div>;
}
