import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import type { AuthorizationRole } from "../../domain/authorization";

const storedRoles = ["admin", "member", "owner", "user"] as const;

interface AccountListRow {
  banned: boolean;
  betaEligible: boolean;
  createdAt: string;
  email: string;
  name: string;
  role: (typeof storedRoles)[number];
  userId: string;
  username: string | null;
}

interface AccountDetail extends AccountListRow {
  banExpires: string | null;
  banReason: string | null;
  eligibilityStatus: "ADULT_18_PLUS" | "MINOR_14_17_GUARDIAN_CONSENTED";
  emailVerified: boolean;
  sessions: Array<{
    createdAt: string;
    expiresAt: string;
    ipAddress: string | null;
    sessionId: string;
    updatedAt: string;
    userAgent: string | null;
  }>;
  updatedAt: string;
}

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Account administration request failed.");
  return data;
}

function RoleBadge({ role }: { role: string }) {
  return <span className="tag" data-color-index={storedRoles.indexOf(role as (typeof storedRoles)[number])}>{role.toUpperCase()}</span>;
}

function AccountsList() {
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const accounts = useQuery({
    queryKey: ["admin", "accounts", submittedSearch],
    queryFn: async () => readJson<{ accounts: AccountListRow[]; total: number }>(
      await fetch(`/api/admin/accounts/?search=${encodeURIComponent(submittedSearch)}`),
    ),
    retry: false,
  });

  return <section className="card"><div className="action-row action-row--between"><div><h2>Accounts</h2><p>Authorization role and beta/player eligibility are separate fields.</p></div><span className="tag">{accounts.data?.total ?? 0} records</span></div><form className="action-row" onSubmit={(event) => { event.preventDefault(); setSubmittedSearch(search.trim()); }}><label className="field">Search name, username, or email<input className="input" value={search} onChange={(event) => setSearch(event.target.value)} /></label><button className="button" type="submit">Search</button></form>{accounts.isPending ? <p className="notice">Loading accounts…</p> : accounts.isError ? <p className="notice notice--bad" role="alert">{accounts.error.message}</p> : accounts.data.accounts.length === 0 ? <p>No accounts matched.</p> : <div className="table-scroll"><table className="simple-table"><thead><tr><th>Account</th><th>Email</th><th>Role</th><th>Beta/player eligible</th><th>Account state</th></tr></thead><tbody>{accounts.data.accounts.map((account) => <tr key={account.userId}><td><a href={`/admin/access/${encodeURIComponent(account.userId)}`}>{account.name}</a><br /><span className="muted">@{account.username ?? "username unavailable"}</span></td><td>{account.email}</td><td><RoleBadge role={account.role} /></td><td>{account.betaEligible ? "Yes" : "No"}</td><td>{account.banned ? "Banned" : "Active"}</td></tr>)}</tbody></table></div>}</section>;
}

function AccountDetailView({ actorRole, userId }: { actorRole: "admin" | "owner"; userId: string }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const account = useQuery({
    queryKey: ["admin", "account", userId],
    queryFn: async () => readJson<{ account: AccountDetail }>(await fetch(`/api/admin/accounts/${encodeURIComponent(userId)}`)),
    retry: false,
  });

  const changeRole = async (role: Exclude<AuthorizationRole, "guest">) => {
    setBusy(true);
    setError(undefined);
    try {
      await readJson(await fetch(`/api/admin/accounts/${encodeURIComponent(userId)}/role`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role }),
      }));
      await queryClient.invalidateQueries({ queryKey: ["admin", "account", userId] });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Account role could not be changed.");
    } finally {
      setBusy(false);
    }
  };

  if (account.isPending) return <p className="notice">Loading account…</p>;
  if (account.isError) return <p className="notice notice--bad" role="alert">{account.error.message}</p>;
  const record = account.data.account;
  return <div className="stack"><section className="card"><div className="action-row action-row--between"><div><h2>{record.name}</h2><p>@{record.username ?? "username unavailable"} · {record.email}</p></div><RoleBadge role={record.role} /></div><dl className="detail-list"><dt>Email verified</dt><dd>{record.emailVerified ? "Yes" : "No"}</dd><dt>Age eligibility</dt><dd>{record.eligibilityStatus}</dd><dt>Beta/player eligible</dt><dd>{record.betaEligible ? "Yes" : "No"}</dd><dt>Membership entitlement</dt><dd>Not connected</dd><dt>Account state</dt><dd>{record.banned ? "Banned" : "Active"}</dd></dl></section><section className="card"><h2>Authorization role</h2>{actorRole === "owner" ? <div className="action-row" aria-label="Set authorization role">{storedRoles.map((role) => <button aria-pressed={record.role === role} className={`button ${record.role === role ? "button--gold" : ""}`} disabled={busy || record.role === role} key={role} onClick={() => changeRole(role)}>{role.toUpperCase()}</button>)}</div> : <p className="notice">Only an OWNER may change authorization roles.</p>}{error && <p className="notice notice--bad" role="alert">{error}</p>}</section><section className="card"><h2>Authorized sessions</h2>{record.sessions.length === 0 ? <p>No active sessions.</p> : <div className="table-scroll"><table className="simple-table"><thead><tr><th>Device</th><th>IP</th><th>Last activity</th><th>Expires</th></tr></thead><tbody>{record.sessions.map((session) => <tr key={session.sessionId}><td>{session.userAgent ?? "Unknown device"}</td><td>{session.ipAddress ?? "Unavailable"}</td><td>{new Date(session.updatedAt).toLocaleString()}</td><td>{new Date(session.expiresAt).toLocaleString()}</td></tr>)}</tbody></table></div>}<p className="muted">Session bearer tokens are never returned by this administrative projection.</p></section></div>;
}

export function AccountAdminPage({ pathname, role }: { pathname: string; role: "admin" | "owner" }) {
  if (pathname === "/admin/access") return <AccountsList />;
  const userId = pathname.startsWith("/admin/access/") ? decodeURIComponent(pathname.slice("/admin/access/".length)) : "";
  return userId ? <AccountDetailView actorRole={role} userId={userId} /> : <p className="notice notice--bad" role="alert">A concrete account identifier is required.</p>;
}
