import { useQuery } from "@tanstack/react-query";

import { DataTable, type DataTableColumnDef } from "../../components/DataTable";
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
  const queueRows = queueLinks.map(([label, key, href, state]) => ({ count: dashboard.data.queues[key], href, key, label, state }));
  const queueColumns: DataTableColumnDef<(typeof queueRows)[number]>[] = [
    { accessorKey: "label", header: "Item" },
    { accessorKey: "key", header: "Canonical queue key" },
    { accessorKey: "count", header: "Count" },
    { accessorKey: "state", header: "State" },
    { cell: ({ row }) => <a className="button button--small" href={row.original.href}>Review</a>, enableColumnFilter: false, enableSorting: false, header: "Actions", id: "actions" },
  ];
  return <div className="stack"><section className="card"><h2>Operational work queues</h2><p>Persisted work requiring attention. No revenue, conversion, or invented support metrics are shown.</p><div className="metric-grid">{queueLinks.map(([label, key, href, state]) => <a className="metric-card" href={href} key={key}><span>{label}</span><strong>{dashboard.data.queues[key]}</strong><small>{state}</small></a>)}</div></section><div className="grid-2"><section className="card"><h2>Work queue</h2><DataTable columns={queueColumns} data={queueRows} getRowId={(row) => row.key} preferenceKey="admin.dashboard.work-queue" /></section><section className="card"><h2>System / content status</h2><p><span className="tag">API {dashboard.data.externalBulkApi.state}</span> {dashboard.data.externalBulkApi.activeSessions} active temporary external Bulk API session(s).</p><p><span className="tag">ATLAS</span> {dashboard.data.atlas.regionMappings} Region mappings · {dashboard.data.atlas.connections} Connections.</p><p className="notice notice--warn">Support tickets and store-exception metrics are omitted because those persisted owners do not exist.</p></section></div></div>;
}
