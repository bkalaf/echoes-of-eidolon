import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { adminCapabilities, hasAdminCapability } from "../../domain/authorization";
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
  status: "PENDING" | "INVITED" | "REJECTED";
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
  return <section className="card"><h2>Access levels and administrative capabilities</h2><table className="simple-table"><thead><tr><th>Access level</th><th>Administration</th><th>Member benefits</th><th>Play</th></tr></thead><tbody><tr><td>GUEST</td><td>No</td><td>No</td><td>No</td></tr><tr><td>USER</td><td>No</td><td>No</td><td>When beta/player eligible</td></tr><tr><td>MEMBER</td><td>No</td><td>From membership entitlement</td><td>When beta/player eligible</td></tr><tr><td>ADMIN</td><td>Yes</td><td>Not implicit</td><td>Participation-dependent</td></tr><tr><td>OWNER</td><td>Yes</td><td>Owner policy</td><td>Yes</td></tr></tbody></table><h3>Current administrative capabilities</h3><ul>{adminCapabilities.map((capability) => <li key={capability}><strong>{capability}</strong>: {hasAdminCapability(role, capability) ? "granted" : "not granted"}</li>)}</ul><p className="notice">Only OWNER may change authorization roles. Membership entitlement and beta/player eligibility remain separate.</p></section>;
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
  return <section className="card"><div className="action-row action-row--between"><div><h2>{showCodes ? "Issued beta invitations" : "Invite/access approval queue"}</h2><p>{showCodes ? "Safe invitation lifecycle fields; plaintext bearer codes are never displayed or stored." : "Approve or reject participant requests. Approval sends the invitation by email."}</p></div><span className="tag">{rows.length} records</span></div>{requests.isPending ? <p className="notice">Loading invitation records…</p> : requests.isError ? <p className="notice notice--bad" role="alert">{requests.error.message}</p> : rows.length === 0 ? <p>No invitation records were returned.</p> : <div className="table-scroll"><table className="simple-table"><thead><tr><th>Friend</th><th>Email</th><th>Reason</th><th>Status</th>{showCodes ? <><th>Expires</th><th>Lifecycle</th></> : <th>Action</th>}</tr></thead><tbody>{rows.filter((row) => showCodes ? row.invitation !== null : row.status === "PENDING").map((row) => <tr key={row.id}><td>{row.friendName}</td><td>{row.email}</td><td>{row.reason}</td><td>{row.status}</td>{showCodes ? <><td>{row.invitation ? new Date(row.invitation.expiresAt).toLocaleString() : "Not issued"}</td><td>{row.invitation?.consumedAt ? "Consumed" : row.invitation?.revokedAt ? "Revoked" : "Available"}</td></> : <td><label className="field">Invitation expiry<input className="input" type="datetime-local" value={expiries[row.id] ?? ""} onChange={(event) => setExpiries((current) => ({ ...current, [row.id]: event.target.value }))} /></label><div className="action-row"><button className="button button--gold" disabled={busyId === row.id || !expiries[row.id]} onClick={() => run(row, "approve")}>Approve & send</button><button className="button" disabled={busyId === row.id} onClick={() => run(row, "reject")}>Reject</button></div></td>}</tr>)}</tbody></table></div>}{error && <p className="notice notice--bad" role="alert">{error}</p>}</section>;
}
