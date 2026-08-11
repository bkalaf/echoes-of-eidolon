import { useQuery } from "@tanstack/react-query";

import type { AdminDashboardProjection } from "../../server/admin-dashboard";

async function loadDashboard(): Promise<AdminDashboardProjection> {
  const response = await fetch("/api/admin/dashboard");
  const result = await response.json() as AdminDashboardProjection & { error?: string };
  if (!response.ok) throw new Error(result.error ?? "Administrative dashboard state could not be loaded.");
  return result;
}

const queueLinks = [
  ["Pending invitation requests", "pendingInvitationRequests", "/admin/access/approvals", "Open queue"],
  ["Outstanding prompts", "outstandingPrompts", "/admin/prompts?filter=outstanding", "Open queue"],
  ["Draft releases", "draftReleases", "/admin/operations/releases", "Open queue"],
  ["Failed bulk operation audits", "failedBulkOperations", "/admin/data/bulk-operations", "Recorded failures"],
] as const;

export function AdminDashboardPage() {
  const dashboard = useQuery({ queryKey: ["admin", "dashboard"], queryFn: loadDashboard, retry: false });
  if (dashboard.isPending) return <p className="notice">Loading authoritative work queues…</p>;
  if (dashboard.isError) return <p className="notice notice--bad" role="alert">{dashboard.error.message}</p>;
  return <div className="stack"><section className="card"><h2>Operational work queues</h2><p>Persisted work requiring attention. No revenue, conversion, or invented support metrics are shown.</p><div className="metric-grid">{queueLinks.map(([label, key, href, state]) => <a className="metric-card" href={href} key={key}><span>{label}</span><strong>{dashboard.data.queues[key]}</strong><small>{state}</small></a>)}</div></section><div className="grid-2"><section className="card"><h2>Work queue</h2><div className="table-scroll"><table className="simple-table"><thead><tr><th>Item</th><th>Count</th><th /></tr></thead><tbody>{queueLinks.map(([label, key, href]) => <tr key={key}><td>{label}</td><td>{dashboard.data.queues[key]}</td><td><a href={href}>Review</a></td></tr>)}</tbody></table></div></section><section className="card"><h2>System / content status</h2><p><span className="tag">API {dashboard.data.externalBulkApi.state}</span> {dashboard.data.externalBulkApi.activeSessions} active temporary external Bulk API session(s).</p><p><span className="tag">ATLAS</span> {dashboard.data.atlas.regionMappings} Region mappings · {dashboard.data.atlas.connections} Connections.</p><p className="notice notice--warn">Support tickets and store-exception metrics are omitted because those persisted owners do not exist.</p></section></div></div>;
}
