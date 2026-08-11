import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { entityFields, entityForPath, type EntityName } from "../../content/entities";
import { pageManifest, type PageManifestEntry } from "../../lib/page-manifest";

interface AdminField {
  enumValues: string[];
  hasDefault: boolean;
  isList: boolean;
  isRequired: boolean;
  kind: "enum" | "json" | "scalar";
  name: string;
  type: string;
}

interface AdminContract {
  delegate: string;
  fields: AdminField[];
  idField: string;
}

interface EntityCollection {
  contract: AdminContract;
  entity: EntityName;
  records: Record<string, unknown>[];
}

function display(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function editableValue(value: unknown, field: AdminField): string {
  if (value === null || value === undefined) return field.isList ? "[]" : field.kind === "json" ? "{}" : "";
  if (field.isList || field.kind === "json") return JSON.stringify(value, null, 2);
  return String(value);
}

function requestError(result: unknown, fallback: string): Error {
  return new Error(typeof result === "object" && result !== null && "error" in result && typeof result.error === "string" ? result.error : fallback);
}

async function readCollection(entityKey: string): Promise<EntityCollection> {
  const response = await fetch(`/api/admin/data/${entityKey}`);
  const result = await response.json() as EntityCollection | { error?: string };
  if (!response.ok || !("records" in result)) throw requestError(result, "Entity records could not be loaded.");
  return result;
}

function payloadFromDraft(contract: AdminContract, draft: Record<string, string>): Record<string, unknown> {
  return Object.fromEntries(contract.fields.flatMap((field) => {
    const value = draft[field.name] ?? "";
    if (!value && !field.isRequired) return [[field.name, null]];
    if (field.isList || field.kind === "json") {
      try {
        return [[field.name, JSON.parse(value) as unknown]];
      } catch {
        throw new Error(`${field.name} must contain valid JSON.`);
      }
    }
    return [[field.name, value]];
  }));
}

function EntityForm({ contract, entity, initial, mode, onComplete }: {
  contract: AdminContract;
  entity: EntityName;
  initial?: Record<string, unknown>;
  mode: "create" | "edit";
  onComplete: (record: Record<string, unknown>) => void;
}) {
  const entityKey = entity.toLowerCase();
  const [draft, setDraft] = useState<Record<string, string>>(() => Object.fromEntries(contract.fields.map((field) => [field.name, editableValue(initial?.[field.name], field)])));
  const recordId = initial?.[contract.idField];
  const mutation = useMutation({
    mutationFn: async () => {
      const record = payloadFromDraft(contract, draft);
      const endpoint = mode === "edit" ? `/api/admin/data/${entityKey}/${encodeURIComponent(String(recordId))}` : `/api/admin/data/${entityKey}`;
      const response = await fetch(endpoint, { body: JSON.stringify({ record }), headers: { "content-type": "application/json" }, method: mode === "edit" ? "PATCH" : "POST" });
      const result = await response.json() as { error?: string; record?: Record<string, unknown> };
      if (!response.ok || !result.record) throw requestError(result, `${entity} could not be saved.`);
      return result.record;
    },
    onSuccess: onComplete,
  });
  return <section className="card">
    <div className="action-row action-row--between"><div><p className="kicker">{mode === "edit" ? "RECORD EDITOR" : "NEW RECORD"}</p><h2>{mode === "edit" ? `Edit ${entity}` : `Create ${entity}`}</h2></div><span className="tag">{contract.fields.length} fields</span></div>
    <div className="form-grid">{contract.fields.map((field) => <label className={`field ${field.kind === "json" || field.isList ? "span-2" : ""}`} key={field.name}>{field.name}{field.isRequired && " *"}{field.kind === "enum" ? <select className="select" value={draft[field.name] ?? ""} disabled={mode === "edit" && field.name === contract.idField} onChange={(event) => setDraft((current) => ({ ...current, [field.name]: event.target.value }))}><option value="">Select…</option>{field.enumValues.map((value) => <option key={value} value={value}>{value}</option>)}</select> : field.type === "Boolean" ? <select className="select" value={draft[field.name] ?? ""} onChange={(event) => setDraft((current) => ({ ...current, [field.name]: event.target.value }))}><option value="">Select…</option><option value="true">true</option><option value="false">false</option></select> : field.kind === "json" || field.isList ? <textarea className="textarea" rows={4} value={draft[field.name] ?? ""} onChange={(event) => setDraft((current) => ({ ...current, [field.name]: event.target.value }))} /> : <input className="input" value={draft[field.name] ?? ""} disabled={mode === "edit" && field.name === contract.idField} inputMode={["Int", "Float", "Decimal"].includes(field.type) ? "decimal" : undefined} onChange={(event) => setDraft((current) => ({ ...current, [field.name]: event.target.value }))} />}</label>)}</div>
    <div className="action-row"><button className="button button--gold" disabled={mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? "Saving…" : mode === "edit" ? "Save Changes" : `Create ${entity}`}</button></div>
    {mutation.error && <p className="notice notice--bad" role="alert">{mutation.error.message}</p>}
    {mutation.isSuccess && <p className="notice notice--good" role="status">{entity} saved.</p>}
  </section>;
}

function ObjectTypeIndex() {
  const entries = useMemo(() => {
    const seen = new Set<EntityName>();
    return pageManifest.flatMap((entry) => {
      if (!entry.path?.startsWith("/admin/data/") || entry.path.split("/").filter(Boolean).length !== 3 || entry.screenId.endsWith("_IMPORT")) return [];
      const entity = entityForPath(entry.path);
      if (!entity || seen.has(entity)) return [];
      seen.add(entity);
      return [{ entity, entry }];
    });
  }, []);
  return <section className="card"><div className="action-row action-row--between"><div><p className="kicker">CANONICAL OBJECT TYPES</p><h2>Data Registry</h2></div><span className="tag">{entries.length} active types</span></div><p>Open a persisted record table, search its canonical fields, create records, or enter the validated import workflow.</p><div className="card-grid">{entries.map(({ entity, entry }) => <article className="mini-card" key={entity}><h3>{entity}</h3><p>{entityFields[entity].length} canonical fields</p><a className="button" href={entry.path ?? "/admin/data"}>Open Records</a></article>)}</div></section>;
}

function EntityRecordsAdminPage({ entity, pathname, screen }: { entity: EntityName; pathname: string; screen: PageManifestEntry }) {
  const entityKey = entity.toLowerCase();
  const queryClient = useQueryClient();
  const collection = useQuery({ queryKey: ["entity-admin", entityKey], queryFn: () => readCollection(entityKey) });
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(pathname.endsWith("/new"));
  const isEditor = screen.screenId.endsWith("_EDIT") || pathname.endsWith("/new");
  const requestedId = decodeURIComponent(pathname.split("/").filter(Boolean).at(-1) ?? "");
  const selected = collection.data?.records.find((record) => String(record[collection.data?.contract.idField ?? ""]) === requestedId)
    ?? (requestedId === "sample-record" ? collection.data?.records[0] : undefined);
  const visible = collection.data?.records.filter((record) => !search.trim() || JSON.stringify(record).toLowerCase().includes(search.trim().toLowerCase())) ?? [];
  const complete = (record: Record<string, unknown>) => {
    queryClient.setQueryData<EntityCollection>(["entity-admin", entityKey], (current) => current ? { ...current, records: [...current.records.filter((candidate) => candidate[current.contract.idField] !== record[current.contract.idField]), record].sort((left, right) => String(left[current.contract.idField]).localeCompare(String(right[current.contract.idField]))) } : current);
    setCreating(false);
  };
  const remove = useMutation({
    mutationFn: async (recordId: string) => {
      const response = await fetch(`/api/admin/data/${entityKey}/${encodeURIComponent(recordId)}`, { method: "DELETE" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw requestError(result, `${entity} could not be deleted.`);
      return recordId;
    },
    onSuccess: (recordId) => queryClient.setQueryData<EntityCollection>(["entity-admin", entityKey], (current) => current ? { ...current, records: current.records.filter((record) => String(record[current.contract.idField]) !== recordId) } : current),
  });
  if (collection.isLoading) return <p className="notice">Loading {entity} records…</p>;
  if (collection.error || !collection.data) return <p className="notice notice--bad" role="alert">{collection.error?.message ?? `${entity} records are unavailable.`}</p>;
  const contract = collection.data.contract;
  if (isEditor && !pathname.endsWith("/new")) return selected
    ? <EntityForm contract={contract} entity={entity} initial={selected} mode="edit" onComplete={complete} />
    : <section className="card"><h2>{entity} record not found</h2><p>No persisted record matches {requestedId}.</p><a className="button" href={`/admin/data/${entityKey}`}>Back to records</a></section>;
  const columns = contract.fields.slice(0, 6);
  return <div className="stack">
    <section className="card">
      <div className="action-row action-row--between"><div><p className="kicker">PERSISTED RECORDS</p><h2>{entity}</h2></div><span className="tag">{collection.data.records.length} records</span></div>
      <div className="action-row"><input className="input" aria-label={`Search ${entity}`} placeholder={`Search ${entity}…`} value={search} onChange={(event) => setSearch(event.target.value)} /><button className="button button--gold" onClick={() => setCreating((value) => !value)}>{creating ? "Close New Record" : "New"}</button><a className="button" href={`/admin/data/${entityKey}/import`}>Import</a></div>
      <div className="table-scroll"><table className="simple-table"><thead><tr>{columns.map(({ name }) => <th key={name}>{name}</th>)}<th>Actions</th></tr></thead><tbody>{visible.map((record) => { const id = String(record[contract.idField]); return <tr key={id}>{columns.map(({ name }) => <td key={name}>{display(record[name])}</td>)}<td><div className="action-row"><a className="button button--small" href={`/admin/data/${entityKey}/${encodeURIComponent(id)}`}>Edit</a><button className="button button--small button--danger" onClick={() => { if (window.confirm(`Delete ${entity} ${id}? This cannot be undone.`)) remove.mutate(id); }}>Delete</button></div></td></tr>; })}</tbody></table></div>
      {visible.length === 0 && <p className="empty-state">No {entity} records match the current search.</p>}
      {remove.error && <p className="notice notice--bad" role="alert">{remove.error.message}</p>}
    </section>
    {creating && <EntityForm contract={contract} entity={entity} mode="create" onComplete={complete} />}
  </div>;
}

export function EntityDataAdminPage({ pathname, screen }: { pathname: string; screen: PageManifestEntry }) {
  const entity = entityForPath(screen.path);
  return entity ? <EntityRecordsAdminPage entity={entity} pathname={pathname} screen={screen} /> : <ObjectTypeIndex />;
}
