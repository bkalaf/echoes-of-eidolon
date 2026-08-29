import { LookupDisplay } from "./LookupDisplay";
import { lookupPresentationFor, LookupPresentationError } from "../domain/lookup-presentation";
import { breedGroupLabel } from "../domain/worldbuilding";
import { humanizeOwnerToken, ownerNullLabel } from "../domain/owner-presentation";

type OwnerField = {
  isList: boolean;
  kind: "enum" | "json" | "relation" | "scalar";
  name: string;
  type: string;
};

function scalarDisplay(field: OwnerField, value: unknown): string {
  if (field.type === "BreedGroupId" && typeof value === "string") return breedGroupLabel(value);
  if ((field.kind === "enum" || field.name === "gender" || field.name === "kernelKey") && typeof value === "string") return humanizeOwnerToken(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (field.name === "color" && typeof value === "object" && value !== null && !Array.isArray(value)) {
    const color = value as Record<string, unknown>;
    return ["SPECTRAL_VIOLET", "GREEN", "WHITE"].map((channel) => `${humanizeOwnerToken(channel)} ${String(color[channel] ?? 0)}%`).join(" · ");
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function OwnerFieldValue({ field, value }: { field: OwnerField; value: unknown }) {
  if (value == null) return <span aria-label="None" className="lookup-display--null">{field.kind === "relation" ? ownerNullLabel(field.name) : "—"}</span>;
  if (field.kind !== "relation") return <span>{scalarDisplay(field, value)}</span>;
  const records = (field.isList ? value : [value]) as unknown[];
  if (!records.length) return <span aria-label="None" className="lookup-display--null">{ownerNullLabel(field.name)}</span>;
  let presentations;
  try {
    presentations = records.map((record) => lookupPresentationFor(field.type, record as Record<string, unknown>));
  } catch (error) {
    if (error instanceof LookupPresentationError) return <span className="lookup-contract-error" role="alert">Missing lookup presentation: {field.type}</span>;
    throw error;
  }
  return <span className="lookup-display-list">{presentations.map((presentation, index) => <LookupDisplay key={index} nullLabel={ownerNullLabel(field.name)} presentation={presentation} />)}</span>;
}
