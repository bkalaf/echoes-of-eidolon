import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { FiniteChipSelection } from "../../components/ui/controls";
import { entityFields, entityForPath, type EntityName } from "../../content/entities";
import contractData from "../../data/entity-admin-contract.json";
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
  auditFields: Array<{ editability: "EDITABLE" | "EXCLUDED"; exclusionReason: string | null; enumName: string | null; isList: boolean; isRequired: boolean; kind: "enum" | "json" | "relation" | "scalar"; name: string; type: string }>;
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

function selectedList(value: string): string[] {
  try { const parsed = JSON.parse(value) as unknown; return Array.isArray(parsed) && parsed.every((entry) => typeof entry === "string") ? parsed : []; } catch { return []; }
}

function TaxonomyEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const ranks = ["KINGDOM", "PHYLUM", "CLASS", "ORDER", "FAMILY", "GENUS", "SPECIES"] as const;
  type Node = { taxonomyLevelId: string; type: typeof ranks[number]; name: string; text?: string; commonName?: string; parent?: Node };
  let parsed: Node | undefined;
  try { const valueParsed = JSON.parse(value) as Node; if (valueParsed && typeof valueParsed === "object") parsed = valueParsed; } catch { /* editor starts blank */ }
  const nodes: Node[] = [];
  for (let current = parsed; current; current = current.parent) nodes.push(current);
  const update = (index: number, field: keyof Omit<Node, "parent">, next: string) => {
    const cloned: Node = structuredClone(parsed ?? { taxonomyLevelId: "", type: "SPECIES" as const, name: "" });
    let current = cloned; for (let cursor = 0; cursor < index; cursor += 1) current = current.parent!;
    if ((field === "text" || field === "commonName") && !next) delete current[field]; else (current as unknown as Record<string, string>)[field] = next;
    onChange(JSON.stringify(cloned, null, 2));
  };
  const addParent = () => {
    const cloned: Node = structuredClone(parsed ?? { taxonomyLevelId: "", type: "SPECIES" as const, name: "" });
    let current = cloned; while (current.parent) current = current.parent;
    const index = ranks.indexOf(current.type); if (index <= 0) return;
    current.parent = { taxonomyLevelId: "", type: ranks[index - 1], name: "" };
    onChange(JSON.stringify(cloned, null, 2));
  };
  if (!parsed) return <div className="span-2"><button className="button" type="button" onClick={() => onChange(JSON.stringify({ taxonomyLevelId: "", type: "SPECIES", name: "" }, null, 2))}>Add taxonomy</button></div>;
  return <fieldset className="span-2"><legend>taxonomy</legend>{nodes.map((node, index) => <div className="form-grid" key={index}><label className="field">rank<select className="select" value={node.type} onChange={(event) => update(index, "type", event.target.value)}>{ranks.map((rank) => <option key={rank}>{rank}</option>)}</select></label><label className="field">taxonomyLevelId<input className="input" value={node.taxonomyLevelId} onChange={(event) => update(index, "taxonomyLevelId", event.target.value)} /></label><label className="field">name<input className="input" value={node.name} onChange={(event) => update(index, "name", event.target.value)} /></label><label className="field">commonName<input className="input" value={node.commonName ?? ""} onChange={(event) => update(index, "commonName", event.target.value)} /></label><label className="field span-2">text<input className="input" value={node.text ?? ""} onChange={(event) => update(index, "text", event.target.value)} /></label></div>)}<div className="action-row"><button className="button" type="button" onClick={addParent}>Add parent rank</button><button className="button button--danger" type="button" onClick={() => onChange("{}")}>Clear taxonomy</button></div></fieldset>;
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
    <div className="form-grid">{contract.fields.map((field) => field.name === "taxonomy" ? <TaxonomyEditor key={field.name} value={draft[field.name] ?? "{}"} onChange={(value) => setDraft((current) => ({ ...current, [field.name]: value }))} /> : field.isList && field.kind === "enum" ? <div className="field span-2" key={field.name}><FiniteChipSelection allowedTokens={field.enumValues} label={`${field.name}${field.isRequired ? " *" : ""}`} multiple selectedTokens={selectedList(draft[field.name] ?? "[]")} onChange={(tokens) => setDraft((current) => ({ ...current, [field.name]: JSON.stringify(tokens) }))} /></div> : <label className={`field ${field.kind === "json" || field.isList ? "span-2" : ""}`} key={field.name}>{field.name}{field.isRequired && " *"}{field.kind === "enum" ? <select className="select" value={draft[field.name] ?? ""} disabled={mode === "edit" && field.name === contract.idField} onChange={(event) => setDraft((current) => ({ ...current, [field.name]: event.target.value }))}><option value="">Select…</option>{field.enumValues.map((value) => <option key={value} value={value}>{value}</option>)}</select> : field.type === "Boolean" ? <select className="select" value={draft[field.name] ?? ""} onChange={(event) => setDraft((current) => ({ ...current, [field.name]: event.target.value }))}><option value="">Select…</option><option value="true">true</option><option value="false">false</option></select> : field.kind === "json" || field.isList ? <textarea className="textarea" rows={4} value={draft[field.name] ?? ""} onChange={(event) => setDraft((current) => ({ ...current, [field.name]: event.target.value }))} /> : <input className="input" value={draft[field.name] ?? ""} disabled={mode === "edit" && field.name === contract.idField} inputMode={["Int", "Float", "Decimal"].includes(field.type) ? "decimal" : undefined} onChange={(event) => setDraft((current) => ({ ...current, [field.name]: event.target.value }))} />}</label>)}</div>
    <div className="action-row"><button className="button button--gold" disabled={mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? "Saving…" : mode === "edit" ? "Save Changes" : `Create ${entity}`}</button></div>
    {mutation.error && <p className="notice notice--bad" role="alert">{mutation.error.message}</p>}
    {mutation.isSuccess && <p className="notice notice--good" role="status">{entity} saved.</p>}
  </section>;
}

function ObjectTypeIndex() {
  const integrity = useQuery({ queryKey: ["worldbuilding-integrity"], queryFn: async () => { const response = await fetch("/api/admin/data-integrity"); const result = await response.json() as { issues?: Array<{ entity: string; entityId: string; message: string }>; error?: string }; if (!response.ok || !result.issues) throw new Error(result.error ?? "WorldBuilding integrity could not be loaded."); return result.issues; } });
  const entries = useMemo(() => Object.keys(contractData.entities).sort().map((entity) => { const typed = entity as EntityName; const manifestEntry = pageManifest.find((entry) => entityForPath(entry.path) === typed && entry.path?.split("/").filter(Boolean).length === 3); return { entity: typed, path: manifestEntry?.path ?? `/admin/data/${entity.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase()}` }; }), []);
  const contracts = contractData.entities as unknown as Record<EntityName, AdminContract>;
  const auditModels = contractData.auditModels as Record<string, { fields: Array<{ enumName: string | null; isList: boolean; isRequired: boolean; kind: "enum" | "json" | "relation" | "scalar"; name: string; type: string }> }>;
  const domainFor = (entity: string) => ["User", "Session", "Account", "Verification", "BetaInvitation", "FriendInvitationRequest"].includes(entity) ? "Authentication" : ["Character", "Architect", "Witness", "WitnessDef", "Companion", "CompanionDef", "Pillar", "Lesson", "TimelineEvent", "Interlude", "InterludeSubstitution", "LegendaryReward", "Soul", "Tome", "Transition", "Campaign", "CampaignPlacement"].includes(entity) ? "CampaignDefinitions" : ["Order", "Payment", "Product", "ProductVariant", "DonationCheckout", "MembershipGrant"].includes(entity) ? "Commerce" : ["Species", "Breed", "Culture", "Settlement", "SettlementWorld", "SettlementPopulationEvent", "Site", "PointOfInterest", "WorldInstance"].includes(entity) ? "WorldBuilding" : "GameState";
  const domains = ["Authentication", "CampaignDefinitions", "GameState", "WorldBuilding", "Commerce"];
  const auditEntries = Object.entries(auditModels);
  return <div className="stack"><section className="card"><div className="action-row action-row--between"><div><p className="kicker">CANONICAL OBJECT TYPES</p><h2>Data Registry</h2></div><span className="tag">{entries.length} active types</span></div><p>Open a persisted record table, search canonical fields, create records, or enter the validated import workflow.</p><div className="data-registry-grid">{entries.map(({ entity, path }) => <article className="mini-card" key={entity}><h3>{entity}</h3><p>{contracts[entity].auditFields.length} persisted fields · {entityFields[entity].length} generic-form fields</p><a className="button" href={path}>Open Records</a></article>)}</div></section><section className="card"><div className="action-row action-row--between"><div><p className="kicker">SHARED DOMAIN VALIDATION</p><h2>WorldBuilding Integrity</h2></div><span className="tag">{integrity.data?.length ?? 0} issues</span></div>{integrity.isPending ? <p>Evaluating canonical rows…</p> : integrity.isError ? <p className="notice notice--bad">{integrity.error.message}</p> : integrity.data?.length ? <ul>{integrity.data.map((issue) => <li key={`${issue.entity}:${issue.entityId}:${issue.message}`}><strong>{issue.entity} {issue.entityId}</strong>: {issue.message}</li>)}</ul> : <p className="notice notice--good">All persisted WorldBuilding rows satisfy the shared domain validator.</p>}</section><section className="card"><div className="action-row action-row--between"><div><p className="kicker">SCHEMA COMPLETENESS</p><h2>Data Integrity Field Audit</h2></div><span className="tag">{auditEntries.reduce((sum, [, contract]) => sum + contract.fields.length, 0)} fields</span></div><p>Every canonical persisted Prisma field appears here. Generic-form editability is shown separately and relations remain workflow-owned.</p>{domains.map((domain) => <section className="integrity-domain" key={domain}><h3>{domain}</h3><div className="table-scroll"><table className="simple-table"><thead><tr><th>Entity</th><th>Field</th><th>Kind</th><th>Nullable</th><th>Enum</th><th>Editability</th></tr></thead><tbody>{auditEntries.filter(([entity]) => domainFor(entity) === domain).flatMap(([entity, model]) => model.fields.map((field) => { const policy = (contracts as Record<string, AdminContract>)[entity]?.auditFields.find((candidate) => candidate.name === field.name); return <tr key={`${entity}.${field.name}`}><td>{entity}</td><td>{field.name}</td><td>{field.kind}</td><td>{field.isRequired ? "no" : "yes"}</td><td>{field.enumName ?? "—"}</td><td title={policy?.exclusionReason ?? undefined}>{policy?.editability ?? "EXCLUDED"}</td></tr>; }))}</tbody></table></div></section>)}</section></div>;
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
