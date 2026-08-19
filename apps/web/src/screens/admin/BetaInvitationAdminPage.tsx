import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { DataTable, type DataTableColumnDef } from "../../components/DataTable";
import { adminCapabilities, hasAdminCapability } from "../../domain/authorization";
import type { FriendInvitationRequestStatus } from "../../generated/prisma/enums";
import type { PageManifestEntry } from "../../lib/page-manifest";

interface BetaInviteRow {
  createdAt: string;
  email: string;
  friendName: string;
  id: string;
  invitation: null | {
    consumedAt: string | null;
    expiresAt: string;
    id: string;
    revokedAt: string | null;
  };
  reason: string;
  status: FriendInvitationRequestStatus;
}

async function loadRequests(): Promise<BetaInviteRow[]> {
  const response = await fetch("/api/admin/beta-invitations/");
  if (!response.ok) throw new Error("Invitation administration could not be loaded.");
  const result = await response.json() as { requests: BetaInviteRow[] };
  return result.requests;
}

async function mutateRequest(id: string, action: "approve" | "reject", expiresAt?: string) {
  const response = await fetch(`/api/admin/beta-invitations/${encodeURIComponent(id)}/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: action === "approve" ? JSON.stringify({ expiresAt: new Date(expiresAt!).toISOString() }) : undefined,
  });
  const result = await response.json() as { error?: string };
  if (!response.ok) throw new Error(result.error ?? `Invitation request could not be ${action}d.`);
}

function Roles({ role }: { role: "admin" | "owner" }) {
  const rows = [
    { accessLevel: "GUEST", administration: "No", memberBenefits: "No", play: "No" },
    { accessLevel: "USER", administration: "No", memberBenefits: "No", play: "When beta/player eligible" },
    { accessLevel: "MEMBER", administration: "No", memberBenefits: "From membership entitlement", play: "When beta/player eligible" },
    { accessLevel: "ADMIN", administration: "Yes", memberBenefits: "Not implicit", play: "Participation-dependent" },
    { accessLevel: "OWNER", administration: "Yes", memberBenefits: "Owner policy", play: "Yes" },
  ];
  const columns: DataTableColumnDef<(typeof rows)[number]>[] = [
    { accessorKey: "accessLevel", header: "Access level" },
    { accessorKey: "administration", header: "Administration" },
    { accessorKey: "memberBenefits", header: "Member benefits" },
    { accessorKey: "play", header: "Play" },
  ];
  return <section className="card"><div className="action-row action-row--between"><div><h2>Access levels and administrative capabilities</h2><p>Authorization roles are a finite application policy, not administrator-created records.</p></div><a className="button" href="/admin/access">Manage account assignments</a></div><DataTable columns={columns} data={rows} getRowId={(row) => row.accessLevel} preferenceKey="admin.access.roles" /><h3>Current administrative capabilities</h3><ul>{adminCapabilities.map((capability) => <li key={capability}><strong>{capability}</strong>: {hasAdminCapability(role, capability) ? "granted" : "not granted"}</li>)}</ul><p className="notice">Only OWNER may change authorization roles for accounts through the account-detail workflow. Membership entitlement and beta/player eligibility remain separate.</p></section>;
}

export function BetaInvitationAdminPage({ role, screen }: { role: "admin" | "owner"; screen: PageManifestEntry }) {
  const queryClient = useQueryClient();
  const requests = useQuery({ queryKey: ["admin", "beta-invitations"], queryFn: loadRequests, retry: false });
  const [expiries, setExpiries] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string>();
  const [error, setError] = useState<string>();

  if (screen.screenId === "ADM003") return <Roles role={role} />;

  const run = async (row: BetaInviteRow, action: "approve" | "reject") => {
    setBusyId(row.id);
    setError(undefined);
    try {
      await mutateRequest(row.id, action, expiries[row.id]);
      await queryClient.invalidateQueries({ queryKey: ["admin", "beta-invitations"] });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Invitation request action failed.");
    } finally {
      setBusyId(undefined);
    }
  };

  const showCodes = screen.screenId === "ADM006";
  const rows = requests.data ?? [];
  const visibleRows = rows.filter((row) => showCodes ? row.invitation !== null : row.status === "PENDING");
  const columns: DataTableColumnDef<BetaInviteRow>[] = [
    { accessorKey: "friendName", header: "Friend" },
    { accessorKey: "id", header: "Request ID" },
    { accessorKey: "email", header: "Email" },
    { accessorKey: "reason", header: "Reason" },
    { accessorKey: "status", header: "Status" },
    { accessorKey: "createdAt", header: "Created", cell: ({ row }) => new Date(row.original.createdAt).toLocaleString() },
    ...(showCodes ? [
      { accessorFn: (row: BetaInviteRow) => row.invitation?.id ?? "Not issued", header: "Invitation ID", id: "invitationId" },
      { accessorFn: (row: BetaInviteRow) => row.invitation ? new Date(row.invitation.expiresAt).toLocaleString() : "Not issued", header: "Expires", id: "expiresAt" },
      { accessorFn: (row: BetaInviteRow) => row.invitation?.consumedAt ? "Consumed" : row.invitation?.revokedAt ? "Revoked" : "Available", header: "Lifecycle", id: "lifecycle" },
    ] satisfies DataTableColumnDef<BetaInviteRow>[] : [{
      cell: ({ row }: { row: { original: BetaInviteRow } }) => <><label className="field">Invitation expiry<input className="input" type="datetime-local" value={expiries[row.original.id] ?? ""} onChange={(event) => setExpiries((current) => ({ ...current, [row.original.id]: event.target.value }))} /></label><div className="action-row"><button className="button button--gold" disabled={busyId === row.original.id || !expiries[row.original.id]} onClick={() => run(row.original, "approve")}>Approve & send</button><button className="button" disabled={busyId === row.original.id} onClick={() => run(row.original, "reject")}>Reject</button></div></>,
      enableColumnFilter: false,
      enableSorting: false,
      header: "Actions",
      id: "actions",
    }] satisfies DataTableColumnDef<BetaInviteRow>[]),
  ];
  return <section className="card"><div className="action-row action-row--between"><div><h2>{showCodes ? "Issued beta invitations" : "Invite/access approval queue"}</h2><p>{showCodes ? "Safe invitation lifecycle fields; plaintext bearer codes are never displayed or stored." : "Approve or reject participant requests. Approval sends the invitation by email."}</p></div><span className="tag">{visibleRows.length} records</span></div>{requests.isPending ? <p className="notice">Loading invitation records…</p> : requests.isError ? <p className="notice notice--bad" role="alert">{requests.error.message}</p> : visibleRows.length === 0 ? <p>No invitation records were returned.</p> : <DataTable columns={columns} data={visibleRows} getRowId={(row) => row.id} preferenceKey={`admin.beta-invitations.${showCodes ? "codes" : "requests"}`} />}{error && <p className="notice notice--bad" role="alert">{error}</p>}</section>;
}
