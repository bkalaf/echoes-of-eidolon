import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import type { PageManifestEntry } from "../../lib/page-manifest";

interface BulkOverview {
  activeSession: null | { createdAt: string; externalBulkApiSessionId: string; issuedBy: { email: string; name: string }; lastActivityAt: string; state: "KEYED" | "KEYLESS" };
  audits: Array<{ actor: null | { email: string; name: string }; bulkOperationAuditId: string; detail: string | null; entityName: string; occurredAt: string; operation: string; recordCount: number; result: string }>;
  envelopes: Array<{ bulkMutationEnvelopeId: string; decidedAt: string | null; dryRunResult: unknown; entityCode: string; notes: string; operation: string; receivedAt: string; recordCount: number; revalidationResult: unknown; sequence: string; status: string }>;
  maximumLifetimeMinutes: number;
  state: "OFF" | "KEYED" | "KEYLESS";
}

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
  const [search, setSearch] = useState("");
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
  if (screen.screenId === "BULK02_BULK_CHANGE_DETAIL_V2") return <section className="card">
    <div className="action-row action-row--between"><div><p className="kicker">ORDERED MUTATION DETAIL</p><h2>{selectedEnvelope ? `Sequence ${selectedEnvelope.sequence}` : "Envelope not found"}</h2></div><a className="button" href="/admin/bulk-changes">Back to queue</a></div>
    {selectedEnvelope ? <div className="stack"><p><strong>{selectedEnvelope.entityCode}</strong> · {selectedEnvelope.operation} · {selectedEnvelope.recordCount} records</p><p>{selectedEnvelope.notes}</p><span className="tag">{selectedEnvelope.status}</span><h3>Automatic dry-run</h3><pre className="code-block">{JSON.stringify(selectedEnvelope.dryRunResult, null, 2)}</pre>{selectedEnvelope.revalidationResult != null && <><h3>Apply-time revalidation</h3><pre className="code-block">{JSON.stringify(selectedEnvelope.revalidationResult, null, 2)}</pre></>}</div> : <p className="notice notice--bad">No retained envelope matches this route.</p>}
  </section>;
  if (screen.screenId === "BULK01_BULK_CHANGES_QUEUE_V2") return <div className="stack">
    {rawKey && <section className="notice notice--good" role="status"><strong>Copy this temporary key now.</strong><p className="code-block">{rawKey}</p><p>Only its SHA-256 hash is retained.</p></section>}
    <section className="card"><div className="action-row action-row--between"><div><p className="kicker">EXTERNAL BULK GATEWAY</p><h2>{data.state}</h2><p>Modes expire after {data.maximumLifetimeMinutes} minutes without endpoint activity.</p></div><div className="action-row">{data.activeSession ? <button className="button button--danger" disabled={action.isPending} onClick={() => action.mutate({ action: "revoke", sessionId: data.activeSession!.externalBulkApiSessionId })}>Turn Off</button> : <><button className="button" disabled={action.isPending} onClick={() => action.mutate({ action: "enable-keyless" })}>Enable Keyless</button><button className="button button--gold" disabled={action.isPending} onClick={() => action.mutate({ action: "generate" })}>Generate Key</button></>}</div></div></section>
    <section className="card"><div className="action-row action-row--between"><div><p className="kicker">RECEIVE ORDER</p><h2>Bulk Changes Queue</h2></div><span className="tag">{data.envelopes.length} envelopes</span></div><div className="table-scroll"><table className="simple-table"><thead><tr><th>Sequence</th><th>Received</th><th>Entity</th><th>Operation</th><th>Records</th><th>Notes</th><th>Status</th><th>Actions</th></tr></thead><tbody>{data.envelopes.map((envelope) => { const actionable = headEnvelope?.bulkMutationEnvelopeId === envelope.bulkMutationEnvelopeId; return <tr key={envelope.bulkMutationEnvelopeId}><td><a href={`/admin/bulk-changes/${envelope.bulkMutationEnvelopeId}`}>{envelope.sequence}</a></td><td>{new Date(envelope.receivedAt).toLocaleString()}</td><td>{envelope.entityCode}</td><td>{envelope.operation}</td><td>{envelope.recordCount}</td><td>{envelope.notes}</td><td><span className="tag">{envelope.status}</span></td><td><div className="action-row"><button aria-label={`Rerun dry-run for sequence ${envelope.sequence}`} className="button" disabled={action.isPending || terminal.has(envelope.status)} onClick={() => action.mutate({ action: "rerun", envelopeId: envelope.bulkMutationEnvelopeId })} title="Rerun dry-run">↻</button><button aria-label={`Apply sequence ${envelope.sequence}`} className="button" disabled={action.isPending || !actionable} onClick={() => action.mutate({ action: "apply", envelopeId: envelope.bulkMutationEnvelopeId })} title="Apply">✓</button><button aria-label={`Delete sequence ${envelope.sequence}`} className="button button--danger" disabled={action.isPending || !actionable} onClick={() => action.mutate({ action: "delete", envelopeId: envelope.bulkMutationEnvelopeId })} title="Delete">×</button></div></td></tr>; })}</tbody></table></div>{data.envelopes.length === 0 && <p className="empty-state">No mutation envelopes have been received.</p>}</section>
    {action.error && <p className="notice notice--bad" role="alert">{action.error.message}</p>}
  </div>;
  const auditView = screen.screenId === "ADM022";
  const filteredAudits = data.audits.filter((audit) => !search.trim() || JSON.stringify(audit).toLowerCase().includes(search.trim().toLowerCase()));
  if (auditView) return <section className="card">
    <div className="action-row action-row--between"><div><p className="kicker">APPEND-ONLY ACTIVITY</p><h2>Bulk Operations Audit</h2></div><span className="tag">{data.audits.length} recent events</span></div>
    <input className="input" aria-label="Search bulk activity" placeholder="Search activity…" value={search} onChange={(event) => setSearch(event.target.value)} />
    <div className="table-scroll"><table className="simple-table"><thead><tr><th>Time</th><th>Actor</th><th>Operation</th><th>Entity</th><th>Result</th><th>Records</th></tr></thead><tbody>{filteredAudits.map((audit) => <tr key={audit.bulkOperationAuditId}><td>{new Date(audit.occurredAt).toLocaleString()}</td><td>{audit.actor?.name ?? "Temporary API key"}</td><td>{audit.operation}</td><td>{audit.entityName}</td><td><span className="tag">{audit.result}</span></td><td>{audit.recordCount}</td></tr>)}</tbody></table></div>
    {filteredAudits.length === 0 && <p className="empty-state">No bulk activity matches the current search.</p>}
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
