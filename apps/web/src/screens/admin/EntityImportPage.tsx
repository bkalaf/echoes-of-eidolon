import { useMemo, useState } from "react";

import { entityFields, entityForPath } from "../../content/entities";
import {
  createDefaultFieldMapping,
  parseEntityImport,
  prepareEntityImport,
  type FieldMapping,
  type ImportRecord,
} from "../../domain/entity-import";
import type { PageManifestEntry } from "../../lib/page-manifest";

const importFormats = {
  csv: "import.csv",
  json: "import.json",
  yaml: "import.yaml",
} as const;

type ImportFormat = keyof typeof importFormats;

function displayValue(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value) ?? "";
}

export function EntityImportPage({ screen }: { screen: PageManifestEntry }) {
  const entity = entityForPath(screen.path);
  const [format, setFormat] = useState<ImportFormat>("json");
  const [source, setSource] = useState("");
  const [sourceRows, setSourceRows] = useState<ImportRecord[]>([]);
  const [mapping, setMapping] = useState<FieldMapping>({});
  const [parseError, setParseError] = useState<string>();

  const prepared = useMemo(
    () => entity && sourceRows.length > 0
      ? prepareEntityImport(entity, sourceRows, mapping)
      : undefined,
    [entity, mapping, sourceRows],
  );

  if (!entity) {
    return <section className="card"><h2>Import contract unavailable</h2><p>No canonical entity field map matches this route. No input can be applied.</p></section>;
  }

  const preview = () => {
    try {
      const rows = parseEntityImport(source, importFormats[format]);
      setSourceRows(rows);
      setMapping(createDefaultFieldMapping(entity, rows));
      setParseError(undefined);
    } catch (error) {
      setSourceRows([]);
      setMapping({});
      setParseError(error instanceof Error ? error.message : "Import data could not be parsed.");
    }
  };

  const updateMapping = (sourceField: string, target: string) => {
    setMapping((current) => ({
      ...current,
      [sourceField]: target === "__ignore__" ? null : target || undefined,
    }));
  };

  return <div className="stack">
    <section className="card">
      <div className="action-row action-row--between">
        <div><p className="kicker">ENTITY IMPORT</p><h2>{entity}</h2></div>
        <span className="tag">{entityFields[entity].length} canonical fields</span>
      </div>
      <p>Validate structured input, map every source field, and review concrete rows before any mutation.</p>
      <div className="form-grid">
        <label className="field">Input format<select className="select" value={format} onChange={(event) => setFormat(event.target.value as ImportFormat)}><option value="json">JSON</option><option value="yaml">YAML</option><option value="csv">CSV</option></select></label>
        <label className="field span-2">Paste structured data<textarea className="textarea" rows={10} value={source} onChange={(event) => setSource(event.target.value)} placeholder={`Paste a ${format.toUpperCase()} array of ${entity} records`} /></label>
      </div>
      <button className="button button--gold" disabled={!source.trim()} onClick={preview}>Validate & Preview</button>
      {parseError && <p className="notice notice--bad" role="alert">{parseError}</p>}
    </section>

    {prepared && <>
      <section className="card">
        <h2>Field mapping</h2>
        <table className="simple-table"><thead><tr><th>Source field</th><th>Canonical {entity} field</th></tr></thead><tbody>{prepared.sourceFields.map((sourceField) => <tr key={sourceField}><td>{sourceField}</td><td><select className="select" aria-label={`Map ${sourceField}`} value={mapping[sourceField] ?? (mapping[sourceField] === null ? "__ignore__" : "")} onChange={(event) => updateMapping(sourceField, event.target.value)}><option value="">Select a field</option><option value="__ignore__">Ignore source field</option>{entityFields[entity].map((field) => <option value={field} key={field}>{field}</option>)}</select></td></tr>)}</tbody></table>
      </section>

      <section className="card">
        <div className="action-row action-row--between"><h2>Concrete preview</h2><span className="tag">{prepared.rows.length} rows</span></div>
        {prepared.errors.length > 0 && <div className="notice notice--bad" role="alert"><strong>Validation failed</strong><ul>{prepared.errors.map((error) => <li key={error}>{error}</li>)}</ul></div>}
        {prepared.errors.length === 0 && <div className="table-scroll"><table className="simple-table"><thead><tr>{entityFields[entity].map((field) => <th key={field}>{field}</th>)}</tr></thead><tbody>{prepared.rows.map((row, index) => <tr key={`${String(row[entityFields[entity][0]])}-${index}`}>{entityFields[entity].map((field) => <td key={field}>{displayValue(row[field])}</td>)}</tr>)}</tbody></table></div>}
        <div className="action-row"><button className="button button--gold" disabled>Apply unavailable</button><p className="muted">Atomic apply is disabled until the typed {entity} repository mutation is connected. Validation does not write data.</p></div>
      </section>
    </>}
  </div>;
}
