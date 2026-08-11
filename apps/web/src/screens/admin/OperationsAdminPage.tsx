import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import type { PageManifestEntry } from "../../lib/page-manifest";

type AdminRelease = { releaseId: string; version: string; gitSha: string; status: string; summary: string; publishedAt: string | null };

function ReleaseManager() {
  const [version, setVersion] = useState("");
  const [gitSha, setGitSha] = useState("");
  const [summary, setSummary] = useState("");
  const [message, setMessage] = useState("");
  const [publishingId, setPublishingId] = useState<string>();
  const releases = useQuery({ queryKey: ["admin", "releases"], queryFn: async () => { const response = await fetch("/api/admin/releases"); if (!response.ok) throw new Error("Release records could not be loaded."); return response.json() as Promise<{ releases: AdminRelease[] }>; } });
  const publish = async (release: AdminRelease) => {
    setPublishingId(release.releaseId);
    setMessage("");
    const response = await fetch(`/api/admin/releases/${encodeURIComponent(release.releaseId)}/publish`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ gitSha: release.gitSha }) });
    const result = await response.json() as { error?: string };
    setPublishingId(undefined);
    setMessage(response.ok ? `Release notes ${release.version} published. No deployment was started.` : result.error ?? "Release notes could not be published.");
    if (response.ok) await releases.refetch();
  };
  return <div className="stack"><section className="card form-grid"><h2 className="span-2">Create reviewed release draft</h2><label className="field">Version<input className="input" value={version} onChange={(event) => setVersion(event.target.value)} /></label><label className="field">Exact Git SHA<input className="input" maxLength={40} value={gitSha} onChange={(event) => setGitSha(event.target.value)} /></label><label className="field span-2">Player summary<textarea className="textarea" value={summary} onChange={(event) => setSummary(event.target.value)} /></label><button className="button button--gold" disabled={!version || !summary || !/^[0-9a-f]{40}$/.test(gitSha)} onClick={async () => { const response = await fetch("/api/admin/releases", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ audience: "BOTH", gitSha, notes: [], summary, version }) }); setMessage(response.ok ? "Release draft created. It is not published or deployed." : "Release draft could not be created."); if (response.ok) await releases.refetch(); }}>Create draft</button>{message && <p className="notice span-2" role="status">{message}</p>}</section><section className="card"><h2>Release records</h2>{releases.isPending ? <p>Loading releases…</p> : releases.isError ? <p className="notice notice--bad">{releases.error.message}</p> : releases.data.releases.length === 0 ? <p>No release records.</p> : <div className="table-scroll"><table className="simple-table"><thead><tr><th>Version</th><th>SHA</th><th>Status</th><th>Summary</th><th>Release notes</th><th>Deployment</th></tr></thead><tbody>{releases.data.releases.map((release) => <tr key={release.releaseId}><td>{release.version}</td><td><code>{release.gitSha}</code></td><td>{release.status}</td><td>{release.summary}</td><td>{release.status === "DRAFT" ? <button className="button" disabled={Boolean(publishingId)} onClick={() => void publish(release)}>{publishingId === release.releaseId ? "Publishing…" : "Publish reviewed notes"}</button> : release.publishedAt ? `Published ${new Date(release.publishedAt).toLocaleString()}` : "Not publishable"}</td><td><button className="button" disabled>Requires explicit authorization</button></td></tr>)}</tbody></table></div>}<p className="notice">Release-note publication changes only the persisted public notes state. Production deployment remains a separate, disabled operation and this surface accepts no shell commands.</p></section></div>;
}

function DocumentBuilder() {
  const [selected, setSelected] = useState("");
  const [content, setContent] = useState("");
  const [message, setMessage] = useState("");
  const documents = useQuery({ queryKey: ["admin", "documents"], queryFn: async () => { const response = await fetch("/api/admin/documents"); if (!response.ok) throw new Error("Document buckets could not be loaded."); return response.json() as Promise<{ buckets: Array<{ documentBucketId: string; name: string; sourcePoints: Array<{ documentSourcePointId: string; ordinal: number; content: string; sourceLabel: string }>; amendments: Array<{ documentAmendmentId: string; ordinal: number; content: string }>; drafts: Array<{ documentDraftId: string; version: number; status: string }> }> }>; } });
  const bucket = documents.data?.buckets.find((item) => item.documentBucketId === selected);
  return <section className="card"><h2>Document Builder</h2><p>Authoritative bullet points and amendments remain separate from immutable generated draft versions.</p>{documents.isPending ? <p>Loading document buckets…</p> : documents.isError ? <p className="notice notice--bad">{documents.error.message}</p> : <><label className="field">Document bucket<select className="input" value={selected} onChange={(event) => setSelected(event.target.value)}><option value="">Select a bucket</option>{documents.data.buckets.map((item) => <option key={item.documentBucketId} value={item.documentBucketId}>{item.name}</option>)}</select></label>{bucket && <div className="grid-2"><div><h3>Source bullet points</h3><ol>{bucket.sourcePoints.map((point) => <li key={point.documentSourcePointId}>{point.content} <small>{point.sourceLabel}</small></li>)}</ol><h3>Amendments</h3><ol>{bucket.amendments.map((item) => <li key={item.documentAmendmentId}>{item.content}</li>)}</ol></div><div><label className="field">Generated draft prose<textarea className="textarea" value={content} onChange={(event) => setContent(event.target.value)} /></label><button className="button button--gold" disabled={!content.trim() || bucket.sourcePoints.length === 0} onClick={async () => { const response = await fetch("/api/admin/documents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ content, documentBucketId: bucket.documentBucketId }) }); setMessage(response.ok ? "New immutable draft version created." : "Draft version could not be created."); if (response.ok) { setContent(""); await documents.refetch(); } }}>Create draft version</button><p>{bucket.drafts.length} existing draft version(s).</p></div></div>}</>}{message && <p className="notice" role="status">{message}</p>}</section>;
}

export function OperationsAdminPage({ screen }: { screen: PageManifestEntry }) {
  if (screen.path === "/admin/operations/releases") return <ReleaseManager />;
  return <div className="stack"><section className="card"><h2>Bounded operations</h2><p>Health, safe build identity, release records, and document generation use server-owned endpoints. Arbitrary shell execution is not accepted.</p><div className="action-row"><a className="button" href="/api/health">Public health</a><a className="button" href="/api/version">Build identity</a><a className="button button--gold" href="/admin/operations/releases">Release management</a></div></section><DocumentBuilder /></div>;
}
