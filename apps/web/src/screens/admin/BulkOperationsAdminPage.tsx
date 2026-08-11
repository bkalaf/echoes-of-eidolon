import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import type { PageManifestEntry } from "../../lib/page-manifest";

interface BulkOverview {
  activeSession: null | { createdAt: string; expiresAt: string; externalBulkApiSessionId: string; issuedBy: { email: string; name: string } };
  audits: Array<{ actor: null | { email: string; name: string }; bulkOperationAuditId: string; detail: string | null; entityName: string; occurredAt: string; operation: string; recordCount: number; result: string }>;
  maximumLifetimeMinutes: number;
  state: "OFF" | "ON";
}

async function loadOverview(): Promise<BulkOverview> {
  const response = await fetch("/api/admin/bulk-operations");
  const result = await response.json() as BulkOverview | { error?: string };
  if (!response.ok || !("audits" in result)) throw new Error("Bulk operation state could not be loaded.");
  return result;
}

export function BulkOperationsAdminPage({ screen }: { screen: PageManifestEntry }) {
  const queryClient = useQueryClient();
  const overview = useQuery({ queryKey: ["bulk-operations"], queryFn: loadOverview });
  const [rawKey, setRawKey] = useState<string>();
  const [search, setSearch] = useState("");
  const action = useMutation({
    mutationFn: async (input: { action: "generate" } | { action: "revoke"; sessionId: string }) => {
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
      <section className="card"><div className="action-row action-row--between"><div><p className="kicker">EXTERNAL JSON API</p><h2>{data.state}</h2></div><span className={`tag ${data.state === "ON" ? "tag--good" : ""}`}>{data.state}</span></div>{data.activeSession ? <><p>Issued by {data.activeSession.issuedBy.name} · expires {new Date(data.activeSession.expiresAt).toLocaleString()}.</p><button className="button button--danger" disabled={action.isPending} onClick={() => action.mutate({ action: "revoke", sessionId: data.activeSession!.externalBulkApiSessionId })}>Revoke Key</button></> : <><p>OFF by default. Generate a single short-lived key only when an external data session is required.</p><button className="button button--gold" disabled={action.isPending} onClick={() => action.mutate({ action: "generate" })}>Generate 30-Minute Key</button></>}</section>
      <section className="card"><p className="kicker">API POLICY</p><h2>Bounded authority</h2><ul><li>Maximum lifetime: {data.maximumLifetimeMinutes} minutes</li><li>Plaintext shown once; stored hash only</li><li>Closed-world entity registry</li><li>Validated writes and atomic imports</li><li>Every accepted operation is audited</li></ul></section>
      <section className="card"><p className="kicker">BULK IMPORT</p><h2>Validated import workflow</h2><p>Choose an object type in the Data Registry, then parse, map, validate, preview, and atomically apply JSON, YAML, Markdown, or HTML records.</p><a className="button" href="/admin/data">Open Data Registry</a></section>
      <section className="card"><p className="kicker">RECENT ACTIVITY</p><h2>{data.audits.length} audit events</h2><p>Review successful, unchanged, and failed operations without exposing secret material.</p><a className="button" href="/admin/data/bulk-operations?state=ADM022">Open Audit</a></section>
    </div>
    {action.error && <p className="notice notice--bad" role="alert">{action.error.message}</p>}
  </div>;
}
