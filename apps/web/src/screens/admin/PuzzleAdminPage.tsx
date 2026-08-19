import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { DataTable, type DataTableColumnDef } from "../../components/DataTable";
import { PuzzleDifficultyTier, PuzzleFamily } from "../../generated/prisma/enums";
import type { PageManifestEntry } from "../../lib/page-manifest";
import { PuzzlePrototypeLab } from "./PuzzlePrototypeLab";

interface PuzzleVersionRow {
  createdAt: string;
  generatorVersion: string;
  hints: Array<{ kind: string; level: number; template: string }>;
}

interface PuzzleBlueprintRow {
  difficultyTier: string;
  primaryFamily: string;
  title: string;
  puzzleBlueprintId: string;
  versions: PuzzleVersionRow[];
}

async function responseJson<T>(response: Response, fallback: string): Promise<T> {
  const result = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(result.error ?? fallback);
  return result;
}

async function loadBlueprints() {
  const result = await responseJson<{ blueprints: PuzzleBlueprintRow[]; total?: number }>(await fetch("/api/admin/puzzles/blueprints"), "Puzzle Blueprints could not be loaded.");
  return { blueprints: result.blueprints, total: result.total ?? result.blueprints.length };
}

const columns: DataTableColumnDef<PuzzleBlueprintRow>[] = [
  { accessorKey: "title", header: "Title" },
  { accessorKey: "puzzleBlueprintId", header: "Puzzle Blueprint ID" },
  { accessorKey: "primaryFamily", header: "Family" },
  { accessorKey: "difficultyTier", header: "Difficulty tier" },
  { id: "latestVersion", header: "Latest generator version", cell: ({ row }) => row.original.versions[0]?.generatorVersion ?? "No version" },
  { id: "hintContract", header: "Hint contract", cell: ({ row }) => {
    const hints = row.original.versions[0]?.hints ?? [];
    return hints.length === 2 && hints[0]?.level === 1 && hints[0].kind === "DIRECTIONAL" && hints[1]?.level === 2 && hints[1].kind === "GUIDED"
      ? "DIRECTIONAL → GUIDED"
      : "Invalid or unavailable";
  } },
  { accessorFn: (blueprint) => JSON.stringify(blueprint.versions), header: "All versions", id: "versions" },
  { cell: ({ row }) => <a className="button" href={`/admin/puzzles/${encodeURIComponent(row.original.puzzleBlueprintId)}`}>Open blueprint</a>, enableColumnFilter: false, enableSorting: false, header: "Actions", id: "actions" },
];

function BlueprintList({ allowCreate }: { allowCreate: boolean }) {
  const client = useQueryClient();
  const [puzzleBlueprintId, setPuzzleBlueprintId] = useState("");
  const [primaryFamily, setPrimaryFamily] = useState(Object.values(PuzzleFamily)[0]!);
  const [difficultyTier, setDifficultyTier] = useState(Object.values(PuzzleDifficultyTier)[0]!);
  const [generatorVersion, setGeneratorVersion] = useState("1.0.0");
  const [directionalHint, setDirectionalHint] = useState("");
  const [guidedHint, setGuidedHint] = useState("");
  const [message, setMessage] = useState("");
  const blueprints = useQuery({ queryKey: ["admin", "puzzles", "blueprints"], queryFn: loadBlueprints, retry: false });
  const create = async () => {
    setMessage("");
    try {
      await responseJson(await fetch("/api/admin/puzzles/blueprints", { body: JSON.stringify({ difficultyTier, directionalHint, primaryFamily, title: puzzleBlueprintId, generatorVersion, guidedHint, puzzleBlueprintId }), headers: { "content-type": "application/json" }, method: "POST" }), "Puzzle Blueprint could not be created.");
      setMessage("Puzzle Blueprint root and initial immutable version created.");
      setPuzzleBlueprintId(""); setDirectionalHint(""); setGuidedHint("");
      await client.invalidateQueries({ queryKey: ["admin", "puzzles", "blueprints"] });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Puzzle Blueprint could not be created.");
    }
  };
  if (blueprints.isPending) return <p className="notice">Loading Puzzle Blueprints…</p>;
  if (blueprints.isError) return <p className="notice notice--bad" role="alert">{blueprints.error.message}</p>;
  return <div className="stack"><section className="card"><div className="action-row action-row--between"><div><h2>Puzzle Blueprints</h2><p>Stable roots with immutable generator versions and exactly two authored answer-free hint templates.</p></div><span className="tag">{blueprints.data.total} {blueprints.data.total === 1 ? "root" : "roots"}</span></div><p><a className="button" href="/admin/puzzles/test-lab">Open the 70-prototype lab</a></p>{blueprints.data.blueprints.length === 0 ? <p>No Puzzle Blueprint roots are stored.</p> : <DataTable columns={columns} data={blueprints.data.blueprints} getRowId={(blueprint) => blueprint.puzzleBlueprintId} preferenceKey="admin.puzzles.blueprints" />}</section>{allowCreate && <section className="card form-grid"><h2 className="span-2">Create Puzzle Blueprint</h2><label className="field">Blueprint ID<input className="input" value={puzzleBlueprintId} onChange={(event) => setPuzzleBlueprintId(event.target.value)} /></label><label className="field">Generator version<input className="input" value={generatorVersion} onChange={(event) => setGeneratorVersion(event.target.value)} /></label><label className="field">Family<select className="input" value={primaryFamily} onChange={(event) => setPrimaryFamily(event.target.value as typeof primaryFamily)}>{Object.values(PuzzleFamily).map((value) => <option key={value}>{value}</option>)}</select></label><label className="field">Difficulty tier<select className="input" value={difficultyTier} onChange={(event) => setDifficultyTier(event.target.value as typeof difficultyTier)}>{Object.values(PuzzleDifficultyTier).map((value) => <option key={value}>{value}</option>)}</select></label><label className="field span-2">Hint 1 · DIRECTIONAL<textarea className="input" rows={4} value={directionalHint} onChange={(event) => setDirectionalHint(event.target.value)} /></label><label className="field span-2">Hint 2 · GUIDED<textarea className="input" rows={4} value={guidedHint} onChange={(event) => setGuidedHint(event.target.value)} /></label><p className="muted span-2">Hints must be authored without the answer. The repository has no stored answer contract, so semantic answer leakage cannot be automatically certified.</p><button className="button button--gold" disabled={!puzzleBlueprintId.trim() || !directionalHint.trim() || !guidedHint.trim() || !/^\d+\.\d+\.\d+/.test(generatorVersion)} onClick={() => void create()}>Create immutable version</button>{message && <p className={`notice span-2 ${message.startsWith("Puzzle Blueprint root") ? "notice--good" : "notice--bad"}`} role="status">{message}</p>}</section>}</div>;
}

function blueprintIdFromPath(pathname: string): string | undefined {
  const match = pathname.match(/^\/admin\/puzzles\/([^/]+)(?:\/test)?$/);
  if (!match?.[1] || ["blueprints", "components", "test-lab"].includes(match[1])) return undefined;
  return decodeURIComponent(match[1]);
}

function BlueprintEditor({ blueprintId }: { blueprintId: string }) {
  const client = useQueryClient();
  const blueprint = useQuery({
    queryKey: ["admin", "puzzles", "blueprint", blueprintId],
    queryFn: async () => responseJson<{ blueprint: PuzzleBlueprintRow }>(await fetch(`/api/admin/puzzles/blueprints/${encodeURIComponent(blueprintId)}`), "Puzzle Blueprint could not be loaded."),
    retry: false,
  });
  const [generatorVersion, setGeneratorVersion] = useState<string>();
  const [directionalHint, setDirectionalHint] = useState("");
  const [guidedHint, setGuidedHint] = useState("");
  const [message, setMessage] = useState("");
  if (blueprint.isPending) return <p className="notice">Loading Puzzle Blueprint…</p>;
  if (blueprint.isError) return <p className="notice notice--bad" role="alert">{blueprint.error.message}</p>;
  const row = blueprint.data.blueprint;
  const nextVersion = generatorVersion ?? "1.0.0";
  const append = async () => {
    setMessage("");
    try {
      await responseJson(await fetch(`/api/admin/puzzles/blueprints/${encodeURIComponent(blueprintId)}`, { body: JSON.stringify({ directionalHint, generatorVersion: nextVersion, guidedHint, design: { schemaVersion: "manual-authoring-v1" } }), headers: { "content-type": "application/json" }, method: "PUT" }), "Puzzle version could not be created.");
      setMessage(`Immutable generator version ${nextVersion} created.`); setDirectionalHint(""); setGuidedHint(""); setGeneratorVersion(undefined);
      await client.invalidateQueries({ queryKey: ["admin", "puzzles", "blueprint", blueprintId] });
      await client.invalidateQueries({ queryKey: ["admin", "puzzles", "blueprints"] });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Puzzle version could not be created.");
    }
  };
  return <div className="stack"><section className="card"><h2>{row.puzzleBlueprintId}</h2><dl className="detail-list"><dt>Family</dt><dd>{row.primaryFamily}</dd><dt>Difficulty</dt><dd>{row.difficultyTier}</dd><dt>Versions</dt><dd>{row.versions.length}</dd></dl><p className="notice notice--warn">Prompt content, answer path, design status, assignments, and accessibility requirements have no canonical persisted owner and are not inferred.</p></section><section className="card"><h3>Immutable version history</h3>{row.versions.map((version) => <article className="inset-card" key={version.generatorVersion}><h4>Generator version {version.generatorVersion}</h4>{version.hints.map((hint) => <p key={hint.level}><strong>Hint {hint.level} · {hint.kind}</strong><br />{hint.template}</p>)}</article>)}</section><section className="card form-grid"><h3 className="span-2">Append generator version</h3><label className="field">Generator version<input className="input" value={nextVersion} onChange={(event) => setGeneratorVersion(event.target.value)} /></label><span /><label className="field span-2">Hint 1 · DIRECTIONAL<textarea className="input" rows={4} value={directionalHint} onChange={(event) => setDirectionalHint(event.target.value)} /></label><label className="field span-2">Hint 2 · GUIDED<textarea className="input" rows={4} value={guidedHint} onChange={(event) => setGuidedHint(event.target.value)} /></label><button className="button button--gold" disabled={!/^\d+\.\d+\.\d+/.test(nextVersion) || !directionalHint.trim() || !guidedHint.trim()} onClick={() => void append()}>Append immutable version</button><a className="button" href={`/admin/puzzles/${encodeURIComponent(blueprintId)}/test`}>Open validation identity</a>{message && <p className={`notice span-2 ${message.startsWith("Immutable") ? "notice--good" : "notice--bad"}`} role="status">{message}</p>}</section></div>;
}

function PreviewIdentityLab({ fixedBlueprintId }: { fixedBlueprintId?: string }) {
  const blueprints = useQuery({ queryKey: ["admin", "puzzles", "blueprints"], queryFn: loadBlueprints, retry: false });
  const [selectedId, setSelectedId] = useState(fixedBlueprintId ?? "");
  const [generatorVersion, setGeneratorVersion] = useState("1.0.0");
  const [campaignId, setCampaignId] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [seed, setSeed] = useState("");
  const [result, setResult] = useState("");
  if (blueprints.isPending) return <p className="notice">Loading Puzzle versions…</p>;
  if (blueprints.isError) return <p className="notice notice--bad" role="alert">{blueprints.error.message}</p>;
  const blueprintId = fixedBlueprintId ?? selectedId;
  const validate = async () => {
    try {
      const response = await responseJson<{ key: string; timerStarted: false }>(await fetch("/api/admin/puzzles/preview", { body: JSON.stringify({ attempt, campaignId, generatorVersion, playerId, puzzleBlueprintId: blueprintId, seed }), headers: { "content-type": "application/json" }, method: "POST" }), "Preview identity could not be validated.");
      setResult(`Validated deterministic identity: ${response.key}. Timer started: ${response.timerStarted ? "yes" : "no"}.`);
    } catch (error) {
      setResult(error instanceof Error ? error.message : "Preview identity could not be validated.");
    }
  };
  return <section className="card form-grid"><h2 className="span-2">Puzzle Test & Validation Identity</h2><p className="span-2">Validate deterministic preview identity against a persisted immutable version. This does not generate a puzzle instance or start the player acceptance timer.</p>{fixedBlueprintId ? <p className="span-2"><strong>Blueprint:</strong> {fixedBlueprintId}</p> : <label className="field span-2">Puzzle Blueprint<select className="input" value={selectedId} onChange={(event) => { setSelectedId(event.target.value); const row = blueprints.data.blueprints.find((item) => item.puzzleBlueprintId === event.target.value); setGeneratorVersion(row?.versions[0]?.generatorVersion ?? "1.0.0"); }}><option value="">Select a Blueprint</option>{blueprints.data.blueprints.map((row) => <option key={row.puzzleBlueprintId}>{row.puzzleBlueprintId}</option>)}</select></label>}<label className="field">Generator version<input className="input" value={generatorVersion} onChange={(event) => setGeneratorVersion(event.target.value)} /></label><label className="field">Attempt<input className="input" min={0} type="number" value={attempt} onChange={(event) => setAttempt(Number(event.target.value))} /></label><label className="field">Campaign ID<input className="input" value={campaignId} onChange={(event) => setCampaignId(event.target.value)} /></label><label className="field">Player ID<input className="input" value={playerId} onChange={(event) => setPlayerId(event.target.value)} /></label><label className="field span-2">Seed<input className="input" value={seed} onChange={(event) => setSeed(event.target.value)} /></label><button className="button button--gold" disabled={!blueprintId || !campaignId || !playerId || !seed || !/^\d+\.\d+\.\d+/.test(generatorVersion) || !Number.isSafeInteger(attempt) || attempt < 0} onClick={() => void validate()}>Validate preview identity</button>{result && <p className={`notice span-2 ${result.startsWith("Validated") ? "notice--good" : "notice--bad"}`} role="status">{result}</p>}<p className="notice notice--warn span-2">Live instance generation remains deferred; sample answer validation is available in the prototype lab without starting a live timer.</p></section>;
}

function SharedComponents() {
  return <section className="card"><h2>Puzzle component proposal handles</h2><p>PUZCMP identifiers are retained only as Action-B source provenance. They do not establish a second reusable-component registry or persisted entity.</p></section>;
}

export function PuzzleAdminPage({ pathname, screen }: { pathname: string; screen: PageManifestEntry }) {
  if (["PZ001", "ADM027"].includes(screen.screenId)) return <BlueprintList allowCreate />;
  if (screen.screenId === "ADM028") return <BlueprintList allowCreate={false} />;
  const blueprintId = blueprintIdFromPath(pathname);
  if (screen.screenId === "PZ002") return blueprintId ? <BlueprintEditor blueprintId={blueprintId} /> : <p className="notice notice--bad">The route does not identify a Puzzle Blueprint.</p>;
  if (screen.screenId === "PZ003") return blueprintId ? <div className="stack"><PreviewIdentityLab fixedBlueprintId={blueprintId} /><PuzzlePrototypeLab fixedBlueprintId={blueprintId} /></div> : <p className="notice notice--bad">The route does not identify a Puzzle Blueprint.</p>;
  if (screen.screenId === "ADM029") return <SharedComponents />;
  if (screen.screenId === "ADM030") return <PuzzlePrototypeLab />;
  return <section className="card"><h2>Puzzle workflow unavailable</h2><p>No Puzzle Designer workflow is inferred for this screen.</p></section>;
}
