import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { FiniteChipSelection } from "../../components/ui/controls";
import { entityFields, entityForPath, type EntityName } from "../../content/entities";
import contractData from "../../data/entity-admin-contract.json";
import { adminFieldControl, validateAdminEntityDraft } from "../../domain/entity-form";
import { clothingSections, formatClothingSections, parseClothingSections } from "../../domain/presentation-audit";
import { canonicalEntityId, canonicalTaxonomyLevelId, type CanonicalWorldbuildingEntityKind, type TaxonomyType } from "../../domain/worldbuilding";
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

function canonicalKindForEntity(entity: EntityName): CanonicalWorldbuildingEntityKind | undefined {
  return entity === "Species" ? "SPECIES" : entity === "Culture" ? "CULTURE" : entity === "Breed" ? "BREED" : undefined;
}

function TaxonomyEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const ranks = ["KINGDOM", "PHYLUM", "CLASS", "ORDER", "FAMILY", "GENUS", "SPECIES"] as const;
  type Node = { taxonomyLevelId: string; type: typeof ranks[number]; name: string; isOfficial: boolean; text?: string; commonName?: string; parent?: Node };
  let parsed: Node | undefined;
  try { const valueParsed = JSON.parse(value) as Node; if (valueParsed && typeof valueParsed === "object") parsed = valueParsed; } catch { /* editor starts blank */ }
  const nodes: Node[] = [];
  for (let current = parsed; current; current = current.parent) nodes.push(current);
  const update = (index: number, changes: Partial<Omit<Node, "parent">>) => {
    const cloned: Node = structuredClone(parsed ?? { taxonomyLevelId: "", type: "SPECIES" as const, name: "", isOfficial: false });
    let current = cloned; for (let cursor = 0; cursor < index; cursor += 1) current = current.parent!;
    Object.assign(current, changes);
    if (changes.text === "") delete current.text;
    if (changes.commonName === "") delete current.commonName;
    if (current.name.trim()) current.taxonomyLevelId = canonicalTaxonomyLevelId(current.type as TaxonomyType, current.name);
    onChange(JSON.stringify(cloned, null, 2));
  };
  const addParent = () => {
    const cloned: Node = structuredClone(parsed ?? { taxonomyLevelId: "", type: "SPECIES" as const, name: "", isOfficial: false });
    let current = cloned; while (current.parent) current = current.parent;
    const index = ranks.indexOf(current.type); if (index <= 0) return;
    current.parent = { taxonomyLevelId: "", type: ranks[index - 1], name: "", isOfficial: false };
    onChange(JSON.stringify(cloned, null, 2));
  };
  if (!parsed) return <div className="span-2"><button className="button" type="button" onClick={() => onChange(JSON.stringify({ taxonomyLevelId: "", type: "SPECIES", name: "", isOfficial: false }, null, 2))}>Add taxonomy</button></div>;
  return <fieldset className="span-2"><legend>taxonomy</legend>{nodes.map((node, index) => <div className="form-grid" key={index}><label className="field">rank<select className="select" value={node.type} onChange={(event) => update(index, { type: event.target.value as TaxonomyType })}>{ranks.map((rank) => <option key={rank}>{rank}</option>)}</select></label><label className="field">taxonomyLevelId<input className="input" readOnly value={node.taxonomyLevelId} /></label><label className="field">name<input className="input" value={node.name} onChange={(event) => update(index, { name: event.target.value })} /></label><label className="field">commonName<input className="input" value={node.commonName ?? ""} onChange={(event) => update(index, { commonName: event.target.value })} /></label><label className="field"><input checked={node.isOfficial === true} type="checkbox" onChange={(event) => update(index, { isOfficial: event.target.checked })} /> Recognized by authoritative real-world taxonomy</label><label className="field span-2">text<input className="input" value={node.text ?? ""} onChange={(event) => update(index, { text: event.target.value })} /></label></div>)}<div className="action-row"><button className="button" type="button" onClick={addParent}>Add parent rank</button><button className="button button--danger" type="button" onClick={() => onChange("{}")}>Clear taxonomy</button></div></fieldset>;
}

function StringListEditor({ disabled, label, value, onChange }: { disabled: boolean; label: string; value: string; onChange: (value: string) => void }) {
  const values = selectedList(value);
  const update = (next: string[]) => onChange(JSON.stringify(next));
  return <fieldset className="field span-2" disabled={disabled}><legend>{label}</legend><div className="stack">{values.map((entry, index) => <div className="action-row" key={`${index}:${entry}`}><input aria-label={`${label} value ${index + 1}`} className="input" value={entry} onChange={(event) => update(values.map((current, currentIndex) => currentIndex === index ? event.target.value : current))} /><button aria-label={`Remove ${label} value ${index + 1}`} className="button button--danger" onClick={() => update(values.filter((_, currentIndex) => currentIndex !== index))} type="button">Remove</button></div>)}</div><button className="button" onClick={() => update([...values, ""])} type="button">Add {label} value</button></fieldset>;
}

function ClothingEditor({ disabled, label, value, onChange }: { disabled: boolean; label: string; value: string; onChange: (value: string) => void }) {
  const sections = parseClothingSections(value);
  return <fieldset aria-label={label} className="field span-2" disabled={disabled}><legend>{label}</legend>{clothingSections.map((section) => <label className="field" key={section}>{section}<textarea className="textarea" rows={3} value={sections[section] ?? ""} onChange={(event) => onChange(formatClothingSections({ ...sections, [section]: event.target.value }))} /></label>)}</fieldset>;
}

function AdminFieldEditor({ contract, disabled, entity, field, value, onChange }: { contract: AdminContract; disabled: boolean; entity: EntityName; field: AdminField; value: string; onChange: (value: string) => void }) {
  const label = `${field.name}${field.isRequired ? " *" : ""}`;
  const control = adminFieldControl(entity, contract.idField, field);
  if (control === "TAXONOMY") return <TaxonomyEditor value={value || "{}"} onChange={onChange} />;
  if (control === "ENUM_LIST") return <div className="field span-2"><FiniteChipSelection allowedTokens={field.enumValues} label={label} multiple selectedTokens={selectedList(value || "[]")} onChange={(tokens) => onChange(JSON.stringify(tokens))} /></div>;
  if (control === "STRING_LIST") return <StringListEditor disabled={disabled} label={label} value={value || "[]"} onChange={onChange} />;
  if (control === "CLOTHING") return <ClothingEditor disabled={disabled} label={label} value={value} onChange={onChange} />;
  if (control === "ENUM") return <label className="field">{label}<select className="select" disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)}><option value="">Select…</option>{field.enumValues.map((option) => <option key={option}>{option}</option>)}</select></label>;
  if (control === "BOOLEAN") return <label className="field"><input checked={value === "true"} disabled={disabled} type="checkbox" onChange={(event) => onChange(String(event.target.checked))} /> {label}</label>;
  if (control === "JSON") return <label className="field span-2">{label}<textarea className="textarea" disabled={disabled} rows={8} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
  if (control === "LONG_TEXT") return <label className="field span-2">{label}<textarea className="textarea" disabled={disabled} rows={5} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
  if (control === "INTEGER" || control === "DECIMAL") return <label className="field">{label}<input className="input" disabled={disabled} inputMode="decimal" step={control === "INTEGER" ? 1 : "any"} type="number" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
  if (control === "DATETIME") return <label className="field">{label}<input className="input" disabled={disabled} type="datetime-local" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
  return <label className="field">{label}<input className="input" disabled={disabled} placeholder={control === "REFERENCE" ? "Canonical referenced entity ID" : undefined} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
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
  const canonicalKind = canonicalKindForEntity(entity);
  const [draft, setDraft] = useState<Record<string, string>>(() => Object.fromEntries(contract.fields.map((field) => [field.name, editableValue(initial?.[field.name], field)])));
  const recordId = initial?.[contract.idField];
  const petSpecies = entity === "Species" && draft.speciesKind === "PET";
  const petBreed = entity === "Breed" && draft.populationKind === "PET";
  const petSpeciesNullFields = new Set(["anthropomorphization", "clothing", "architecture"]);
  const petBreedNullFields = new Set([
    "cultureId", "personalityId", "accent", "clothing", "architecture", "motivation", "operatingStyle",
    "structureOrientation", "administrationMode", "ownershipMode", "allocationMode", "legitimacyBasis",
    "authoritySource", "loquacity", "emotionalTemperature", "outlookOrientation", "collaborativePosture",
  ]);
  const updateDraftField = (field: AdminField, value: string) => setDraft((current) => {
    const next = { ...current, [field.name]: value };
    if (mode === "create" && canonicalKind && field.name === "name") next[contract.idField] = value.trim() ? canonicalEntityId(canonicalKind, value) : "";
    if (entity === "Species" && field.name === "speciesKind" && value === "PET") {
      for (const nullField of petSpeciesNullFields) next[nullField] = "";
    }
    if (entity === "Breed" && field.name === "populationKind" && value === "PET") {
      for (const nullField of petBreedNullFields) next[nullField] = "";
    }
    return next;
  });
  const fieldDisabled = (field: AdminField) =>
    (field.name === contract.idField && (mode === "edit" || canonicalKind !== undefined))
    || (canonicalKind !== undefined && mode === "edit" && field.name === "name")
    || (petSpecies && petSpeciesNullFields.has(field.name))
    || (petBreed && petBreedNullFields.has(field.name));
  const mutation = useMutation({
    mutationFn: async () => {
      const formErrors = validateAdminEntityDraft(entity, contract.idField, contract.fields, draft);
      if (formErrors.length) throw new Error(formErrors.join(" "));
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
    {canonicalKind && mode === "edit" && <p className="notice">Canonical WorldBuilding names and persistence IDs are immutable. Create a reviewed replacement entity for a genuine identity change.</p>}
    {petSpecies && <p className="notice">PET invariant: clothing, architecture, and anthropomorphization remain null. Author a biologically prompt-ready appearance instead.</p>}
    {petBreed && <p className="notice">PET population invariant: Culture, Personality, sapient presentation, and governance dimensions remain null. Appearance may contain biologically prompt-ready Breed detail.</p>}
    <div className="form-grid">{contract.fields.map((field) => <AdminFieldEditor contract={contract} disabled={fieldDisabled(field)} entity={entity} field={field} key={field.name} value={draft[field.name] ?? ""} onChange={(value) => updateDraftField(field, value)} />)}</div>
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
