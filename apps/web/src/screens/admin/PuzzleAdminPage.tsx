import { useQuery } from "@tanstack/react-query";

import { DataTable, type DataTableColumnDef } from "../../components/DataTable";
import type { PageManifestEntry } from "../../lib/page-manifest";

interface PuzzleBlueprintRow {
  difficultyTier: string;
  family: string;
  puzzleBlueprintId: string;
  versions: Array<{
    createdAt: string;
    generatorVersion: number;
    hints: Array<{ kind: string; level: number; template: string }>;
  }>;
}

const columns: DataTableColumnDef<PuzzleBlueprintRow>[] = [
  { accessorKey: "puzzleBlueprintId", header: "Puzzle Blueprint" },
  { accessorKey: "family", header: "Family" },
  { accessorKey: "difficultyTier", header: "Difficulty tier" },
  { id: "latestVersion", header: "Latest generator version", cell: ({ row }) => row.original.versions[0]?.generatorVersion ?? "No version" },
  { id: "hintContract", header: "Hint contract", cell: ({ row }) => {
    const hints = row.original.versions[0]?.hints ?? [];
    return hints.length === 2 && hints[0]?.level === 1 && hints[0].kind === "DIRECTIONAL" && hints[1]?.level === 2 && hints[1].kind === "GUIDED"
      ? "DIRECTIONAL → GUIDED"
      : "Invalid or unavailable";
  } },
];

async function loadBlueprints() {
  const response = await fetch("/api/admin/puzzles/blueprints");
  const result = await response.json() as { blueprints?: PuzzleBlueprintRow[]; error?: string; total?: number };
  if (!response.ok || !result.blueprints) throw new Error(result.error ?? "Puzzle Blueprints could not be loaded.");
  return { blueprints: result.blueprints, total: result.total ?? result.blueprints.length };
}

function BlueprintList() {
  const blueprints = useQuery({ queryKey: ["admin", "puzzles", "blueprints"], queryFn: loadBlueprints, retry: false });
  if (blueprints.isPending) return <p className="notice">Loading Puzzle Blueprints…</p>;
  if (blueprints.isError) return <p className="notice notice--bad" role="alert">{blueprints.error.message}</p>;
  return <div className="stack"><section className="card"><div className="action-row action-row--between"><div><h2>Puzzle Blueprints</h2><p>Stable roots with immutable generator versions and exactly two authored answer-free hint templates.</p></div><span className="tag">{blueprints.data.total} / 70 roots</span></div>{blueprints.data.blueprints.length === 0 ? <p>No Puzzle Blueprint roots are stored.</p> : <DataTable columns={columns} data={blueprints.data.blueprints} getRowId={(blueprint) => blueprint.puzzleBlueprintId} preferenceKey="admin.puzzles.blueprints" />}</section><p className={`notice ${blueprints.data.total === 70 ? "notice--good" : "notice--warn"}`}>{blueprints.data.total === 70 ? "The initial bank contains exactly 70 roots." : "The initial 70-root bank is incomplete. Missing roots are not generated."}</p></div>;
}

export function PuzzleAdminPage({ screen }: { screen: PageManifestEntry }) {
  if (["PZ001", "ADM027", "ADM028"].includes(screen.screenId)) return <BlueprintList />;
  if (["PZ002", "PZ003", "ADM029", "ADM030"].includes(screen.screenId)) return <section className="card"><h2>{screen.title}</h2><p>The immutable Puzzle Blueprint roots, versions, and hint templates are connected.</p><p className="notice notice--warn">Preview generation and editor writes remain unavailable because no generator configuration or answer-validation record contract is stored.</p></section>;
  return <section className="card"><h2>Puzzle workflow unavailable</h2><p>No Puzzle Designer workflow is inferred for this screen.</p></section>;
}
