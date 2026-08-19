import { useQuery } from "@tanstack/react-query";

import { DataTable, type DataTableColumnDef } from "../../components/DataTable";
import type { ReleaseNotes } from "../../domain/release-notes";
import type { PageManifestEntry } from "../../lib/page-manifest";

function ReleaseManager() {
  const releases = useQuery({ queryKey: ["admin", "releases"], queryFn: async () => { const response = await fetch("/api/admin/releases"); if (!response.ok) throw new Error("Release records could not be loaded."); return response.json() as Promise<{ releases: ReleaseNotes[] }>; } });
  const columns: DataTableColumnDef<ReleaseNotes>[] = [
    { accessorKey: "version", header: "Version" },
    { accessorKey: "status", header: "Status" },
    { accessorKey: "title", header: "Title" },
    { accessorKey: "summary", header: "Summary" },
    { accessorKey: "releaseDate", header: "Date", cell: ({ row }) => row.original.releaseDate ?? "Not assigned" },
    { accessorKey: "previousVersion", header: "Previous version", cell: ({ row }) => row.original.previousVersion ?? "None" },
    { accessorFn: (release) => JSON.stringify(release.items), header: "Items", id: "items" },
    { cell: () => <button className="button" disabled>Owner-reviewed repository change required</button>, enableColumnFilter: false, enableSorting: false, header: "Publication", id: "publication" },
    { cell: () => <button className="button" disabled>Requires explicit authorization</button>, enableColumnFilter: false, enableSorting: false, header: "Deployment", id: "deployment" },
  ];
  return <div className="stack"><section className="card"><h2>Canonical release authority</h2><p>Release drafts are owner-reviewed Markdown in the production repository. Runtime forms cannot create or publish competing release records.</p></section><section className="card"><h2>Release records</h2>{releases.isPending ? <p>Loading releases…</p> : releases.isError ? <p className="notice notice--bad">{releases.error.message}</p> : releases.data.releases.length === 0 ? <p>No canonical release records.</p> : <DataTable columns={columns} data={releases.data.releases} getRowId={(release) => release.version} preferenceKey="admin.operations.releases" />}<p className="notice">Generated drafts never publish notes. Publication, tags, GitHub Releases, migrations, and application deployment remain separate authorized operations.</p></section></div>;
}

export function OperationsAdminPage({ screen }: { screen: PageManifestEntry }) {
  if (screen.path === "/admin/operations/releases") return <ReleaseManager />;
  return <div className="stack"><section className="card"><h2>Bounded operations</h2><p>Health, safe build identity, and release records use server-owned endpoints. Arbitrary shell execution is not accepted.</p><div className="action-row"><a className="button" href="/api/health">Public health</a><a className="button" href="/api/version">Build identity</a><a className="button button--gold" href="/admin/operations/releases">Release management</a></div></section><section className="card"><h2>Campaign document workflows</h2><p>Document corpus and research planning belong to the active Campaign Manager context.</p><div className="action-row"><a className="button" href="/admin/campaigns/current/documents">Historical Document Corpus</a><a className="button" href="/admin/campaigns/current/document-quests">Document Quest and Research Planner</a></div></section></div>;
}
