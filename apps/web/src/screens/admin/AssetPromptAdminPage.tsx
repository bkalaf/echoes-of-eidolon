import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { DataTable, type DataTableColumnDef } from "../../components/DataTable";
import type { ManagedAssetMediaKind, PromptFamily, PromptStatus } from "../../generated/prisma/enums";
import type { PageManifestEntry } from "../../lib/page-manifest";

interface AssetRow {
  byteSize: string;
  managedAssetId: string;
  mediaKind: ManagedAssetMediaKind;
  mimeType: string;
  objectKey: string;
  purposeLinks: Array<{ purpose: string }>;
  sha256: string;
  technicalMetadata: unknown;
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
    responseContract: unknown;
    version: number;
  }>;
}

const promptFamilies = ["IMAGE", "MUSIC", "PUZZLE", "NAMING"] as const satisfies readonly PromptFamily[];
const promptStatuses = ["OUTSTANDING", "READY", "COMPLETED"] as const satisfies readonly PromptStatus[];

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

function AssetManager({ mediaKind }: { mediaKind: Extract<ManagedAssetMediaKind, "AUDIO" | "VIDEO"> }) {
  const [selectedId, setSelectedId] = useState<string>();
  const assets = useQuery({
    queryKey: ["admin", "assets", mediaKind],
    queryFn: async () => readJson<{ assets: AssetRow[]; total: number }>(await fetch(`/api/admin/assets/?mediaKind=${mediaKind}`)),
    retry: false,
  });
  if (assets.isPending) return <p className="notice">Loading managed {mediaKind.toLowerCase()} assets…</p>;
  if (assets.isError) return <p className="notice notice--bad" role="alert">{assets.error.message}</p>;
  const selected = assets.data.assets.find((asset) => asset.managedAssetId === selectedId);
  return <div className="stack"><section className="card"><div className="action-row action-row--between"><div><h2>{mediaKind === "AUDIO" ? "Audio" : "Video"} assets</h2><p>Final sanitized bytes determine SHA-256 identity and object key. Activate a row to open its verified metadata.</p></div><span className="tag">{assets.data.total} records</span></div>{assets.data.assets.length === 0 ? <p>No managed {mediaKind.toLowerCase()} assets are stored.</p> : <DataTable columns={assetColumns} data={assets.data.assets} getRowId={(asset) => asset.managedAssetId} onRowActivate={(asset) => setSelectedId(asset.managedAssetId)} preferenceKey={`admin.assets.${mediaKind.toLowerCase()}`} />}<p className="muted">Storage credentials and workstation paths are not returned.</p></section>{selected && <section className="card"><div className="action-row action-row--between"><div><h2>Managed asset detail</h2><p>{selected.managedAssetId}</p></div><button className="button" onClick={() => setSelectedId(undefined)} type="button">Close</button></div><dl className="detail-grid"><div><dt>Media kind</dt><dd>{selected.mediaKind}</dd></div><div><dt>MIME type</dt><dd>{selected.mimeType}</dd></div><div><dt>Bytes</dt><dd>{selected.byteSize}</dd></div><div><dt>SHA-256</dt><dd><code>{selected.sha256}</code></dd></div><div><dt>Final-byte object key</dt><dd><code>{selected.objectKey}</code></dd></div><div><dt>Purpose links</dt><dd>{selected.purposeLinks.map((link) => link.purpose).join(", ") || "None"}</dd></div></dl><h3>Technical probe</h3><pre>{JSON.stringify(selected.technicalMetadata, null, 2)}</pre><p className="notice">New or replacement bytes must use the existing sanitized managed-asset import pipeline; this page does not accept an unsafe second upload path.</p></section>}</div>;
}

function PromptManager({ outstandingOnly }: { outstandingOnly: boolean }) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [family, setFamily] = useState<PromptFamily>("IMAGE");
  const [status, setStatus] = useState<PromptStatus>("OUTSTANDING");
  const [purpose, setPurpose] = useState("");
  const [targetType, setTargetType] = useState("");
  const [targetId, setTargetId] = useState("");
  const [promptText, setPromptText] = useState("");
  const [responseContract, setResponseContract] = useState("");
  const [versionText, setVersionText] = useState("");
  const [versionContract, setVersionContract] = useState("");
  const [resultAssetId, setResultAssetId] = useState("");
  const [resultVersionId, setResultVersionId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const prompts = useQuery({
    queryKey: ["admin", "prompts", outstandingOnly ? "OUTSTANDING" : "ALL"],
    queryFn: async () => readJson<{ prompts: PromptRow[]; total: number }>(await fetch(`/api/admin/prompts/${outstandingOnly ? "?status=OUTSTANDING" : ""}`)),
    retry: false,
  });
  if (prompts.isPending) return <p className="notice">Loading prompts…</p>;
  if (prompts.isError) return <p className="notice notice--bad" role="alert">{prompts.error.message}</p>;
  const selected = prompts.data.prompts.find((prompt) => prompt.promptRecordId === selectedId);
  const parseContract = (value: string) => {
    if (!value.trim()) throw new Error("Response contract JSON is required.");
    return JSON.parse(value) as unknown;
  };
  const refresh = async () => queryClient.invalidateQueries({ queryKey: ["admin", "prompts"] });
  const perform = async (request: () => Promise<Response>, success: string) => {
    setBusy(true);
    setError(undefined);
    setMessage(undefined);
    try {
      await readJson(await request());
      await refresh();
      setMessage(success);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Prompt operation failed.");
    } finally {
      setBusy(false);
    }
  };
  const create = () => perform(() => fetch("/api/admin/prompts/", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ family, promptText, purpose, responseContract: parseContract(responseContract), status, targetId, targetType }),
  }), "Prompt record created with version 1.");
  const append = (prompt: PromptRow) => perform(() => fetch(`/api/admin/prompts/${encodeURIComponent(prompt.promptRecordId)}/versions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ promptText: versionText, responseContract: parseContract(versionContract) }),
  }), "Append-only prompt version created.");
  const associate = (prompt: PromptRow) => perform(() => fetch(`/api/admin/prompts/${encodeURIComponent(prompt.promptRecordId)}/result`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ generatedManagedAssetId: resultAssetId, promptVersionId: resultVersionId }),
  }), "Managed result associated and prompt completed.");
  return <div className="stack"><section className="card"><div className="action-row action-row--between"><div><h2>{outstandingOnly ? "Outstanding prompts" : "Prompt Manager"}</h2><p>Prompt versions are append-only; managed results associate to one explicit existing version.</p></div><div className="action-row"><span className="tag">{prompts.data.total} records</span><button className="button button--gold" onClick={() => setCreating((value) => !value)} type="button">{creating ? "Close new prompt" : "New prompt"}</button></div></div>{prompts.data.prompts.length === 0 ? <p>No matching Prompt records are stored.</p> : <DataTable columns={promptColumns} data={prompts.data.prompts} getRowId={(prompt) => prompt.promptRecordId} onRowActivate={(prompt) => { setSelectedId(prompt.promptRecordId); setResultVersionId(prompt.versions[0]?.promptVersionId ?? ""); }} preferenceKey={`admin.prompts.${outstandingOnly ? "outstanding" : "all"}`} />}</section>{creating && <section className="card"><h2>Create prompt record</h2><form className="form-grid" onSubmit={(event) => { event.preventDefault(); try { void create(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Response contract JSON is invalid."); } }}><label className="field">Family<select className="select" value={family} onChange={(event) => setFamily(event.target.value as PromptFamily)}>{promptFamilies.map((value) => <option key={value}>{value}</option>)}</select></label><label className="field">Status<select className="select" value={status} onChange={(event) => setStatus(event.target.value as PromptStatus)}>{promptStatuses.map((value) => <option key={value}>{value}</option>)}</select></label><label className="field span-2">Purpose<input className="input" value={purpose} onChange={(event) => setPurpose(event.target.value)} /></label><label className="field">Target type<input className="input" value={targetType} onChange={(event) => setTargetType(event.target.value)} /></label><label className="field">Target identifier<input className="input" value={targetId} onChange={(event) => setTargetId(event.target.value)} /></label><label className="field span-2">Prompt text<textarea className="textarea" value={promptText} onChange={(event) => setPromptText(event.target.value)} /></label><label className="field span-2">Response contract JSON<textarea className="textarea" placeholder='{"type":"object"}' value={responseContract} onChange={(event) => setResponseContract(event.target.value)} /></label><button className="button button--gold" disabled={busy || !purpose.trim() || !targetType.trim() || !targetId.trim() || !promptText.trim() || !responseContract.trim()} type="submit">{busy ? "Creating…" : "Create version 1"}</button></form></section>}{selected && <section className="card"><div className="action-row action-row--between"><div><h2>{selected.promptRecordId}</h2><p>{selected.family} · {selected.targetType} · {selected.targetId}</p></div><span className="tag">{selected.status}</span></div><div className="grid-2"><form className="stack" onSubmit={(event) => { event.preventDefault(); try { void append(selected); } catch (caught) { setError(caught instanceof Error ? caught.message : "Response contract JSON is invalid."); } }}><h3>Append version</h3><label className="field">Prompt text<textarea className="textarea" value={versionText} onChange={(event) => setVersionText(event.target.value)} /></label><label className="field">Response contract JSON<textarea className="textarea" value={versionContract} onChange={(event) => setVersionContract(event.target.value)} /></label><button className="button" disabled={busy || !versionText.trim() || !versionContract.trim()} type="submit">Append immutable version</button></form><form className="stack" onSubmit={(event) => { event.preventDefault(); void associate(selected); }}><h3>Associate managed result</h3>{selected.family === "IMAGE" || selected.family === "MUSIC" ? <><label className="field">Prompt version<select className="select" value={resultVersionId} onChange={(event) => setResultVersionId(event.target.value)}><option value="">Select version</option>{selected.versions.map((version) => <option key={version.promptVersionId} value={version.promptVersionId}>Version {version.version} · {version.promptVersionId}</option>)}</select></label><label className="field">Managed asset identifier<input className="input" value={resultAssetId} onChange={(event) => setResultAssetId(event.target.value)} /></label><button className="button" disabled={busy || !resultVersionId || !resultAssetId.trim()} type="submit">Associate result</button></> : <p className="notice notice--warn">{selected.family} has no persisted managed-asset result contract. Completion is not inferred.</p>}</form></div></section>}{message && <p className="notice notice--good" role="status">{message}</p>}{error && <p className="notice notice--bad" role="alert">{error}</p>}</div>;
}

export function AssetPromptAdminPage({ screen }: { screen: PageManifestEntry }) {
  if (screen.path === "/admin/assets/audio") return <AssetManager mediaKind="AUDIO" />;
  if (screen.path === "/admin/assets/video") return <AssetManager mediaKind="VIDEO" />;
  if (screen.path === "/admin/prompts" && screen.screenId === "ADM033") return <PromptManager outstandingOnly={false} />;
  if (screen.path === "/admin/prompts" && screen.screenId === "ADM034") return <PromptManager outstandingOnly />;
  return <section className="card"><h2>Asset or prompt workflow unavailable</h2><p>No managed-asset or Prompt Manager workflow is inferred for this screen.</p></section>;
}
