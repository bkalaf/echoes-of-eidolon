import { LookupDisplay } from "./LookupDisplay";
import { lookupPresentationFor, LookupPresentationError } from "../domain/lookup-presentation";

type OwnerField = {
  isList: boolean;
  kind: "enum" | "json" | "relation" | "scalar";
  name: string;
  type: string;
};

function scalarDisplay(value: unknown): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function OwnerFieldValue({ field, value }: { field: OwnerField; value: unknown }) {
  if (value == null) return <span aria-label="None" className="lookup-display--null">—</span>;
  if (field.kind !== "relation") return <span>{scalarDisplay(value)}</span>;
  const records = (field.isList ? value : [value]) as unknown[];
  if (!records.length) return <span aria-label="None" className="lookup-display--null">—</span>;
  let presentations;
  try {
    presentations = records.map((record) => lookupPresentationFor(field.type, record as Record<string, unknown>));
  } catch (error) {
    if (error instanceof LookupPresentationError) return <span className="lookup-contract-error" role="alert">Missing lookup presentation: {field.type}</span>;
    throw error;
  }
  return <span className="lookup-display-list">{presentations.map((presentation, index) => <LookupDisplay key={index} presentation={presentation} />)}</span>;
}
