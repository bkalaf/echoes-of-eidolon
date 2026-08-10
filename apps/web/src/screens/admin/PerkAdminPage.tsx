import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { DataTable, type DataTableColumnDef } from "../../components/DataTable";
import { FiniteChipSelection } from "../../components/ui/controls";
import type { PerkStatus } from "../../generated/prisma/enums";

const perkStatuses = ["ACTIVE", "INACTIVE"] as const satisfies readonly PerkStatus[];

interface PerkRow {
  description: string;
  name: string;
  perkId: string;
  status: PerkStatus;
}

async function readJson<T>(response: Response): Promise<T> {
  const result = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(result.error ?? "Perk administration request failed.");
  return result;
}

const perkColumns: DataTableColumnDef<PerkRow>[] = [
  { accessorKey: "perkId", header: "Perk", cell: ({ row }) => <a href={`/admin/perks/${encodeURIComponent(row.original.perkId)}`}>{row.original.perkId}</a> },
  { accessorKey: "name", header: "Name" },
  { accessorKey: "description", header: "Description" },
  { accessorKey: "status", header: "Status", cell: ({ row }) => <span className="tag">{row.original.status}</span> },
];

function PerkList() {
  const perks = useQuery({
    queryKey: ["admin", "perks"],
    queryFn: async () => readJson<{ perks: PerkRow[] }>(await fetch("/api/admin/perks/")),
    retry: false,
  });

  if (perks.isPending) return <p className="notice">Loading perks…</p>;
  if (perks.isError) return <p className="notice notice--bad" role="alert">{perks.error.message}</p>;
  return <section className="card"><div className="action-row action-row--between"><div><h2>Donation perks</h2><p>Only ACTIVE perks are visible to entitled players. INACTIVE records remain available here.</p></div><span className="tag">{perks.data.perks.length} records</span></div>{perks.data.perks.length === 0 ? <p>No perks are stored.</p> : <DataTable columns={perkColumns} data={perks.data.perks} getRowId={(perk) => perk.perkId} preferenceKey="admin.perks" />}</section>;
}

function PerkDetail({ perkId }: { perkId: string }) {
  const perk = useQuery({
    queryKey: ["admin", "perk", perkId],
    queryFn: async () => readJson<{ perk: PerkRow }>(await fetch(`/api/admin/perks/${encodeURIComponent(perkId)}`)),
    retry: false,
  });

  if (perk.isPending) return <p className="notice">Loading perk…</p>;
  if (perk.isError) return <p className="notice notice--bad" role="alert">{perk.error.message}</p>;
  return <PerkEditor key={perk.data.perk.perkId} perk={perk.data.perk} />;
}

function PerkEditor({ perk }: { perk: PerkRow }) {
  const queryClient = useQueryClient();
  const [description, setDescription] = useState(perk.description);
  const [name, setName] = useState(perk.name);
  const [status, setStatus] = useState<PerkStatus[]>([perk.status]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);

  const save = async () => {
    if (!status[0]) return;
    setBusy(true);
    setError(undefined);
    setSaved(false);
    try {
      await readJson(await fetch(`/api/admin/perks/${encodeURIComponent(perk.perkId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ description, name, status: status[0] }),
      }));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "perk", perk.perkId] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "perks"] }),
      ]);
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Perk could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  return <section className="card"><div className="action-row action-row--between"><div><h2>{perk.name}</h2><p>{perk.perkId}</p></div><a className="button" href="/admin/perks">All perks</a></div><form className="stack" onSubmit={(event) => { event.preventDefault(); void save(); }}><label className="field">Name<input className="input" value={name} onChange={(event) => setName(event.target.value)} /></label><label className="field">Description<textarea className="textarea" value={description} onChange={(event) => setDescription(event.target.value)} /></label><FiniteChipSelection allowedTokens={perkStatuses} label="Status" onChange={(tokens) => setStatus(tokens as PerkStatus[])} selectedTokens={status} /><div className="action-row"><button className="button button--gold" disabled={busy || status.length !== 1} type="submit">{busy ? "Saving…" : "Save perk"}</button></div>{saved && <p className="notice notice--good" role="status">Perk saved.</p>}{error && <p className="notice notice--bad" role="alert">{error}</p>}</form></section>;
}

export function PerkAdminPage({ pathname }: { pathname: string }) {
  if (pathname === "/admin/perks") return <PerkList />;
  const perkId = pathname.startsWith("/admin/perks/") ? decodeURIComponent(pathname.slice("/admin/perks/".length)) : "";
  return perkId ? <PerkDetail perkId={perkId} /> : <p className="notice notice--bad" role="alert">A concrete perk identifier is required.</p>;
}
