import { useQuery } from "@tanstack/react-query";

import { DataTable, type DataTableColumnDef } from "../../components/DataTable";
import type { PageManifestEntry } from "../../lib/page-manifest";

interface AssetRow {
  byteSize: string;
  managedAssetId: string;
  mediaKind: "IMAGE" | "AUDIO" | "VIDEO";
  mimeType: string;
  objectKey: string;
  purposeLinks: Array<{ purpose: string }>;
  sha256: string;
}

interface PromptRow {
  family: string;
  promptRecordId: string;
  purpose: string;
  status: string;
  targetId: string;
  targetType: string;
  versions: Array<{
    generatedManagedAssetId: string | null;
    promptText: string;
    promptVersionId: string;
    version: number;
  }>;
}

const assetColumns: DataTableColumnDef<AssetRow>[] = [
  { accessorKey: "managedAssetId", header: "Managed Asset" },
  { accessorKey: "mediaKind", header: "Kind" },
  { accessorKey: "mimeType", header: "MIME type" },
  { accessorKey: "byteSize", header: "Bytes" },
  { id: "purposes", header: "Purposes", cell: ({ row }) => row.original.purposeLinks.map((link) => link.purpose).join(", ") || "No purpose link" },
  { accessorKey: "objectKey", header: "Final-byte object key" },
];

const promptColumns: DataTableColumnDef<PromptRow>[] = [
  { accessorKey: "promptRecordId", header: "Prompt" },
  { accessorKey: "family", header: "Family" },
  { accessorKey: "purpose", header: "Purpose" },
  { accessorKey: "status", header: "Status" },
  { id: "target", header: "Target", cell: ({ row }) => `${row.original.targetType} · ${row.original.targetId}` },
  { id: "latestVersion", header: "Latest version", cell: ({ row }) => row.original.versions[0]?.version ?? "No version" },
  { id: "result", header: "Associated result", cell: ({ row }) => row.original.versions[0]?.generatedManagedAssetId ?? "None" },
];

async function readJson<T>(response: Response): Promise<T> {
  const result = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(result.error ?? "Administrative records could not be loaded.");
  return result;
}

function AssetManager({ mediaKind }: { mediaKind: "AUDIO" | "VIDEO" }) {
  const assets = useQuery({
    queryKey: ["admin", "assets", mediaKind],
    queryFn: async () => readJson<{ assets: AssetRow[]; total: number }>(await fetch(`/api/admin/assets/?mediaKind=${mediaKind}`)),
    retry: false,
  });
  if (assets.isPending) return <p className="notice">Loading managed {mediaKind.toLowerCase()} assets…</p>;
  if (assets.isError) return <p className="notice notice--bad" role="alert">{assets.error.message}</p>;
  return <section className="card"><div className="action-row action-row--between"><div><h2>{mediaKind === "AUDIO" ? "Audio" : "Video"} assets</h2><p>Final sanitized bytes determine SHA-256 identity and object key.</p></div><span className="tag">{assets.data.total} records</span></div>{assets.data.assets.length === 0 ? <p>No managed {mediaKind.toLowerCase()} assets are stored.</p> : <DataTable columns={assetColumns} data={assets.data.assets} getRowId={(asset) => asset.managedAssetId} preferenceKey={`admin.assets.${mediaKind.toLowerCase()}`} />}<p className="muted">Storage credentials and workstation paths are not returned.</p></section>;
}

function PromptManager({ outstandingOnly }: { outstandingOnly: boolean }) {
  const prompts = useQuery({
    queryKey: ["admin", "prompts", outstandingOnly ? "OUTSTANDING" : "ALL"],
    queryFn: async () => readJson<{ prompts: PromptRow[]; total: number }>(await fetch(`/api/admin/prompts/${outstandingOnly ? "?status=OUTSTANDING" : ""}`)),
    retry: false,
  });
  if (prompts.isPending) return <p className="notice">Loading prompts…</p>;
  if (prompts.isError) return <p className="notice notice--bad" role="alert">{prompts.error.message}</p>;
  return <section className="card"><div className="action-row action-row--between"><div><h2>{outstandingOnly ? "Outstanding prompts" : "Prompt Manager"}</h2><p>Prompt versions are append-only; generated results associate to an existing version.</p></div><span className="tag">{prompts.data.total} records</span></div>{prompts.data.prompts.length === 0 ? <p>No matching Prompt records are stored.</p> : <DataTable columns={promptColumns} data={prompts.data.prompts} getRowId={(prompt) => prompt.promptRecordId} preferenceKey={`admin.prompts.${outstandingOnly ? "outstanding" : "all"}`} />}</section>;
}

export function AssetPromptAdminPage({ screen }: { screen: PageManifestEntry }) {
  if (screen.path === "/admin/assets/audio") return <AssetManager mediaKind="AUDIO" />;
  if (screen.path === "/admin/assets/video") return <AssetManager mediaKind="VIDEO" />;
  if (screen.path === "/admin/prompts" && screen.screenId === "ADM033") return <PromptManager outstandingOnly={false} />;
  if (screen.path === "/admin/prompts" && screen.screenId === "ADM034") return <PromptManager outstandingOnly />;
  return <section className="card"><h2>Asset or prompt workflow unavailable</h2><p>No managed-asset or Prompt Manager workflow is inferred for this screen.</p></section>;
}
