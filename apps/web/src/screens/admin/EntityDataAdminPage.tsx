import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { FiniteChipSelection } from "../../components/ui/controls";
import { DataTable, type DataTableColumnDef } from "../../components/DataTable";
import { LookupDisplay } from "../../components/LookupDisplay";
import { OwnerFieldValue } from "../../components/OwnerFieldValue";
import { entityFields, entityForPath, type EntityName } from "../../content/entities";
import contractData from "../../data/entity-admin-contract.json";
import { adminFieldControl, validateAdminEntityDraft } from "../../domain/entity-form";
import { lookupSearchText, LookupPresentationError, ownerFormLookupPresentationFor } from "../../domain/lookup-presentation";
import { buildOwnerFormPlan, ownerFormSections, subtypeParentEntity, type OwnerFormFieldPlan } from "../../domain/owner-form-contract";
import { clothingSections, formatClothingSections, parseClothingSections } from "../../domain/presentation-audit";
import { orderOwnerTableFields } from "../../domain/owner-table-field-order";
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
  auditFields?: Array<{ editability: "EDITABLE" | "EXCLUDED"; exclusionReason: string | null; enumName: string | null; isList: boolean; isRequired: boolean; kind: "enum" | "json" | "relation" | "scalar"; name: string; relationFromFields?: string[]; type: string }>;
  delegate: string;
  fields: AdminField[];
  idField: string;
}

type AuditField = NonNullable<AdminContract["auditFields"]>[number];

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

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function editableValue(value: unknown, field: AdminField): string {
  if (value === null || value === undefined) return field.isList ? "[]" : field.kind === "json" ? "{}" : "";
  if (field.isList || field.kind === "json") return JSON.stringify(value, null, 2);
  return String(value);
}

function auditFieldsFor(contract: AdminContract): AuditField[] {
  return contract.auditFields?.length ? contract.auditFields : contract.fields.map((field) => ({
    editability: "EDITABLE" as const,
    enumName: field.kind === "enum" ? field.type : null,
    exclusionReason: null,
    isList: field.isList,
    isRequired: field.isRequired,
    kind: field.kind,
    name: field.name,
    type: field.type,
  }));
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

const spectralChannels = ["SPECTRAL_VIOLET", "GREEN", "WHITE"] as const;

function SpectralColorEditor({ disabled, value, onChange }: { disabled: boolean; value: string; onChange: (value: string) => void }) {
  let parsed: Partial<Record<typeof spectralChannels[number], number>> = {};
  try { parsed = JSON.parse(value || "{}") as typeof parsed; } catch { /* invalid legacy value remains editable */ }
  const normalized = Object.fromEntries(spectralChannels.map((channel) => [channel, Number(parsed[channel] ?? 0)])) as Record<typeof spectralChannels[number], number>;
  const total = spectralChannels.reduce((sum, channel) => sum + normalized[channel], 0);
  const update = (channel: typeof spectralChannels[number], nextValue: string) => onChange(JSON.stringify({ ...normalized, [channel]: Number(nextValue) }, null, 2));
  return <fieldset className="field span-2"><legend>Color percentages</legend><div className="form-grid">{spectralChannels.map((channel) => <label className="field" key={channel}>{channel} %<input className="input" disabled={disabled} max={100} min={0} step="0.01" type="number" value={normalized[channel]} onChange={(event) => update(channel, event.target.value)} /></label>)}</div><output aria-label="Spectral color total" className={Math.abs(total - 100) < 0.0001 ? "notice notice--good" : "notice notice--bad"}>Total: {total}% {Math.abs(total - 100) < 0.0001 ? "— valid" : "— must equal 100%"}</output></fieldset>;
}

async function readLookupOptions(relationType: string): Promise<{ idField: string; records: Record<string, unknown>[] }> {
  if (relationType === "ManagedAsset") {
    const response = await fetch("/api/admin/assets/");
    const result = await response.json() as { assets?: Record<string, unknown>[]; error?: string };
    if (!response.ok || !result.assets) throw requestError(result, "Managed assets could not be loaded.");
    return { idField: "managedAssetId", records: result.assets };
  }
  const response = await fetch(`/api/admin/data/${relationType.toLowerCase()}`);
  const result = await response.json() as EntityCollection | { error?: string };
  if (!response.ok || !("records" in result)) throw requestError(result, `${relationType} lookups could not be loaded.`);
  return { idField: result.contract.idField, records: result.records };
}

function RelationLookupEditor({ disabled, initialRecord, label, nullable, relationType, value, onChange }: { disabled: boolean; initialRecord?: Record<string, unknown>; label: string; nullable: boolean; relationType: string; value: string; onChange: (value: string) => void }) {
  const [search, setSearch] = useState("");
  const options = useQuery({
    enabled: !disabled,
    queryFn: () => readLookupOptions(relationType),
    queryKey: ["owner-form-lookup", relationType],
  });
  const records = options.data?.records ?? [];
  const selectedRecord = records.find((record) => String(record[options.data?.idField ?? ""]) === value) ?? initialRecord;
  let selectedPresentation = null;
  let presentationError: string | null = null;
  try { selectedPresentation = ownerFormLookupPresentationFor(relationType, selectedRecord); }
  catch (error) { presentationError = error instanceof LookupPresentationError ? error.message : String(error); }
  const matching = records.flatMap((record) => {
    try {
      const presentation = ownerFormLookupPresentationFor(relationType, record);
      return !search.trim() || lookupSearchText(presentation).includes(search.trim().toLocaleLowerCase()) ? [{ presentation, record }] : [];
    } catch { return []; }
  }).slice(0, 20);
  return <fieldset className="field span-2" disabled={disabled}><legend>{label}</legend><LookupDisplay presentation={selectedPresentation} /><label className="field">Search {relationType} by name or canonical ID<input className="input" type="search" value={search} onChange={(event) => setSearch(event.target.value)} /></label>{options.isPending && <small>Loading {relationType} choices…</small>}{options.error && <p className="notice notice--bad" role="alert">{options.error.message}</p>}{presentationError && <p className="notice notice--bad" role="alert">{presentationError}</p>}<div className="lookup-option-list">{matching.map(({ presentation, record }) => { const id = String(record[options.data?.idField ?? ""]); return <button aria-label={`Select ${presentation?.primary ?? id}`} className="lookup-option" key={id} onClick={() => { onChange(id); setSearch(""); }} type="button"><LookupDisplay presentation={presentation} /></button>; })}</div>{nullable && value && <button className="button" onClick={() => onChange("")} type="button">Clear {label}</button>}</fieldset>;
}

function ReadOnlyOwnerField({ field, value }: { field: OwnerFormFieldPlan; value: unknown }) {
  return <div className="field owner-form-readonly"><span>{field.name}</span><OwnerFieldValue field={field} value={value} />{field.exclusionReason && <small>{field.exclusionReason}</small>}</div>;
}

function AdminFieldEditor({ contract, controlOverride, disabled, entity, field, initialRelation, labelOverride, relationType, value, onChange }: { contract: AdminContract; controlOverride?: OwnerFormFieldPlan["control"]; disabled: boolean; entity: EntityName; field: AdminField; initialRelation?: Record<string, unknown>; labelOverride?: string; relationType?: string | null; value: string; onChange: (value: string) => void }) {
  const label = `${labelOverride ?? field.name}${field.isRequired ? " *" : ""}`;
  const control = controlOverride ?? adminFieldControl(entity, contract.idField, field);
  if (control === "RELATION_LOOKUP" && relationType) return <RelationLookupEditor disabled={disabled} initialRecord={initialRelation} label={label} nullable={!field.isRequired} relationType={relationType} value={value} onChange={onChange} />;
  if (control === "SPECTRAL_COLOR") return <SpectralColorEditor disabled={disabled} value={value} onChange={onChange} />;
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

function ParentCharacterContext({ initial }: { initial?: Record<string, unknown> }) {
  const parent = initial?.character;
  const character = typeof parent === "object" && parent !== null && !Array.isArray(parent) ? parent as Record<string, unknown> : undefined;
  const characterContract = (contractData.entities as unknown as Record<string, AdminContract>).Character;
  const fields = orderOwnerTableFields("Character", characterContract.idField, auditFieldsFor(characterContract));
  return character ? <><p className="notice">Parent Character is shown in the same subtype editor. Use the Character record workflow for changes that require its separate write authorization.</p><div className="form-grid">{fields.map((field) => <div className="field owner-form-readonly" key={`parent:${field.name}`}><span>{field.name}</span><OwnerFieldValue field={field} value={character[field.name]} /></div>)}</div></> : <p className="notice notice--bad" role="alert">Parent Character data is unavailable for this subtype record.</p>;
}

function ContextValue({ label, value }: { label: string; value: unknown }) {
  return <div className="field owner-form-readonly"><span>{label}</span><strong>{display(value)}</strong></div>;
}

function WitnessDefSourceContext({ initial }: { initial?: Record<string, unknown> }) {
  const soul = asRecord(initial?.architectSoul);
  const characters = Array.isArray(soul?.characters) ? soul.characters.map(asRecord).filter((record): record is Record<string, unknown> => Boolean(record)) : [];
  const department = initial?.department;
  const source = characters.find((character) => asRecord(character.architect)?.department === department) ?? characters.find((character) => character.architect);
  if (!initial) return <p className="muted">Choose the Architect Soul by human-readable Soul name; source Architect identity appears after the persisted relation is resolved.</p>;
  return <div className="form-grid owner-form-context"><ContextValue label="Source Architect Character Name" value={source?.displayName} /><ContextValue label="Source Architect Character ID" value={source?.characterId} /><ContextValue label="Architect Soul ID" value={initial.architectSoulId} /></div>;
}

function WitnessDefinitionContext({ initial }: { initial?: Record<string, unknown> }) {
  const definition = asRecord(initial?.witnessDef);
  if (!definition) return null;
  const color = asRecord(definition.color);
  return <div className="form-grid owner-form-context"><ContextValue label="Witness Definition Name" value={definition.name} /><ContextValue label="WitnessDef ID" value={definition.witnessDefId} /><ContextValue label="Department" value={definition.department} /><ContextValue label="Apparent Domain" value={definition.apparentDomain} /><ContextValue label="Real Domain" value={definition.realDomain} />{spectralChannels.map((channel) => <ContextValue key={channel} label={`${channel} %`} value={color?.[channel]} />)}</div>;
}

function WitnessContinuityContext({ initial }: { initial?: Record<string, unknown> }) {
  const witnessCharacter = asRecord(initial?.character);
  const definition = asRecord(initial?.witnessDef);
  const architect = asRecord(initial?.architect);
  const architectCharacter = asRecord(architect?.character);
  if (!initial) return null;
  const witnessSoul = witnessCharacter?.soulId;
  const definitionSoul = definition?.architectSoulId;
  const architectSoul = architectCharacter?.soulId;
  const complete = typeof witnessSoul === "string" && witnessSoul === definitionSoul && witnessSoul === architectSoul;
  return <div className="owner-form-context"><div className="form-grid"><ContextValue label="Source Architect Name" value={architectCharacter?.displayName} /><ContextValue label="Source Architect Character ID" value={initial.architectCharacterId} /><ContextValue label="Witness Character Soul ID" value={witnessSoul} /><ContextValue label="WitnessDef Architect Soul ID" value={definitionSoul} /><ContextValue label="Architect Character Soul ID" value={architectSoul} /></div><p className={complete ? "notice notice--good" : "notice notice--bad"} role="status">Continuity status: {complete ? "PROVEN — all three Soul IDs match" : "FAILED OR INCOMPLETE — Soul IDs do not all match"}</p></div>;
}

function EntityForm({ contract, entity, initial, mode, onCancel, onComplete }: {
  contract: AdminContract;
  entity: EntityName;
  initial?: Record<string, unknown>;
  mode: "create" | "edit";
  onCancel?: () => void;
  onComplete: (record: Record<string, unknown>) => void;
}) {
  const entityKey = entity.toLowerCase();
  const canonicalKind = canonicalKindForEntity(entity);
  const [draft, setDraft] = useState<Record<string, string>>(() => Object.fromEntries(contract.fields.map((field) => [field.name, editableValue(initial?.[field.name], field)])));
  const parentEntity = subtypeParentEntity(entity);
  const parentInitial = asRecord(initial?.character);
  const parentContract = (contractData.entities as unknown as Record<string, AdminContract>).Character;
  const resolvedParentContract = { ...parentContract, auditFields: auditFieldsFor(parentContract) };
  const parentPlan = buildOwnerFormPlan("Character", resolvedParentContract);
  const parentEditableByName = new Map(parentContract.fields.map((field) => [field.name, field]));
  const [parentDraft, setParentDraft] = useState<Record<string, string>>(() => parentInitial ? Object.fromEntries(parentContract.fields.map((field) => [field.name, editableValue(parentInitial[field.name], field)])) : {});
  const recordId = initial?.[contract.idField];
  const resolvedContract = { ...contract, auditFields: auditFieldsFor(contract) };
  const formPlan = buildOwnerFormPlan(entity, resolvedContract);
  const editableByName = new Map(contract.fields.map((field) => [field.name, field]));
  const sections = ownerFormSections(entity);
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
      if (mode === "edit" && parentEntity && parentInitial) formErrors.push(...validateAdminEntityDraft("Character", parentContract.idField, parentContract.fields, parentDraft));
      if (formErrors.length) throw new Error(formErrors.join(" "));
      const record = payloadFromDraft(contract, draft);
      const endpoint = mode === "edit" ? `/api/admin/data/${entityKey}/${encodeURIComponent(String(recordId))}` : `/api/admin/data/${entityKey}`;
      const parentCharacter = mode === "edit" && parentEntity && parentInitial ? payloadFromDraft(parentContract, parentDraft) : undefined;
      const response = await fetch(endpoint, { body: JSON.stringify({ ...(parentCharacter ? { parentCharacter } : {}), record }), headers: { "content-type": "application/json" }, method: mode === "edit" ? "PATCH" : "POST" });
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
    <div className="owner-form-sections">
      {sections.map((section) => {
        const sectionFields = formPlan.filter((field) => field.section === section);
        if (!sectionFields.length) return null;
        return <fieldset className="span-2 owner-form-section" key={section}><legend>{section}</legend>{section === "Character identity" && parentEntity && (mode === "edit" && parentInitial ? <div className="form-grid">{parentPlan.filter((field) => field.name !== parentContract.idField).map((planned) => {
          const editable = parentEditableByName.get(planned.name);
          if (!editable) return <ReadOnlyOwnerField field={{ ...planned, name: `Character.${planned.name}` }} key={`parent:${planned.name}`} value={parentInitial[planned.name]} />;
          const relationRecord = planned.relationField ? asRecord(parentInitial[planned.relationField]) : undefined;
          return <AdminFieldEditor contract={resolvedParentContract} controlOverride={planned.control} disabled={false} entity="Character" field={editable} initialRelation={relationRecord} key={`parent:${planned.name}`} labelOverride={`Character.${planned.name}`} relationType={planned.relationType} value={parentDraft[planned.name] ?? ""} onChange={(value) => setParentDraft((current) => ({ ...current, [planned.name]: value }))} />;
        })}</div> : <ParentCharacterContext initial={initial} />)}{entity === "WitnessDef" && section === "Source Architect / Soul" && <WitnessDefSourceContext initial={initial} />}{entity === "Witness" && section === "Witness definition" && <WitnessDefinitionContext initial={initial} />}{entity === "Witness" && section === "Architect continuity" && <WitnessContinuityContext initial={initial} />}<div className="form-grid">{sectionFields.map((planned) => {
          const editable = editableByName.get(planned.name);
          if (!editable) return <ReadOnlyOwnerField field={planned} key={planned.name} value={initial?.[planned.name]} />;
          const relationRecord = planned.relationField && typeof initial?.[planned.relationField] === "object" && initial[planned.relationField] !== null
            ? initial[planned.relationField] as Record<string, unknown>
            : undefined;
          return <AdminFieldEditor contract={resolvedContract} controlOverride={planned.control} disabled={fieldDisabled(editable)} entity={entity} field={editable} initialRelation={relationRecord} key={planned.name} relationType={planned.relationType} value={draft[planned.name] ?? ""} onChange={(value) => updateDraftField(editable, value)} />;
        })}</div></fieldset>;
      })}
    </div>
    <div className="action-row"><button className="button button--gold" disabled={mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? "Saving…" : mode === "edit" ? "Save Changes" : `Create ${entity}`}</button>{mode === "edit" && onCancel && <button className="button" disabled={mutation.isPending} onClick={onCancel} type="button">Cancel</button>}</div>
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
  const auditRows = auditEntries.flatMap(([entity, model]) => model.fields.map((field) => {
    const policy = (contracts as Record<string, AdminContract>)[entity]?.auditFields?.find((candidate) => candidate.name === field.name);
    return { ...field, domain: domainFor(entity), editability: policy?.editability ?? "EXCLUDED", entity, exclusionReason: policy?.exclusionReason ?? "—" };
  }));
  const auditColumns: DataTableColumnDef<(typeof auditRows)[number]>[] = [
    { accessorKey: "entity", header: "Entity" },
    { accessorKey: "name", header: "Field" },
    { accessorKey: "kind", header: "Kind" },
    { accessorKey: "type", header: "Type" },
    { accessorFn: (field) => field.isRequired ? "No" : "Yes", header: "Nullable", id: "nullable" },
    { accessorFn: (field) => field.isList ? "Yes" : "No", header: "List", id: "isList" },
    { accessorFn: (field) => field.enumName ?? "—", header: "Enum", id: "enumName" },
    { accessorKey: "editability", header: "Editability" },
    { accessorKey: "exclusionReason", header: "Exclusion reason" },
  ];
  return <div className="stack"><section className="card"><div className="action-row action-row--between"><div><p className="kicker">CANONICAL OBJECT TYPES</p><h2>Data Registry</h2></div><span className="tag">{entries.length} active types</span></div><p>Open a persisted record table, search canonical fields, create records, or enter the validated import workflow.</p><div className="data-registry-grid">{entries.map(({ entity, path }) => <article className="mini-card" key={entity}><h3>{entity}</h3><p>{auditFieldsFor(contracts[entity]).length} persisted fields · {entityFields[entity].length} generic-form fields</p><a className="button" href={path}>Open Records</a></article>)}</div></section><section className="card"><div className="action-row action-row--between"><div><p className="kicker">SHARED DOMAIN VALIDATION</p><h2>WorldBuilding Integrity</h2></div><span className="tag">{integrity.data?.length ?? 0} issues</span></div>{integrity.isPending ? <p>Evaluating canonical rows…</p> : integrity.isError ? <p className="notice notice--bad">{integrity.error.message}</p> : integrity.data?.length ? <ul>{integrity.data.map((issue) => <li key={`${issue.entity}:${issue.entityId}:${issue.message}`}><strong>{issue.entity} {issue.entityId}</strong>: {issue.message}</li>)}</ul> : <p className="notice notice--good">All persisted WorldBuilding rows satisfy the shared domain validator.</p>}</section><section className="card"><div className="action-row action-row--between"><div><p className="kicker">SCHEMA COMPLETENESS</p><h2>Data Integrity Field Audit</h2></div><span className="tag">{auditRows.length} fields</span></div><p>Every canonical persisted Prisma field appears here. Generic-form editability is shown separately and relations remain workflow-owned.</p>{domains.map((domain) => <section className="integrity-domain" key={domain}><h3>{domain}</h3><DataTable columns={auditColumns} data={auditRows.filter((field) => field.domain === domain)} getRowId={(field) => `${field.entity}.${field.name}`} preferenceKey={`admin.data-integrity.${domain}`} /></section>)}</section></div>;
}

function EntityRecordsAdminPage({ entity, pathname, screen }: { entity: EntityName; pathname: string; screen: PageManifestEntry }) {
  const entityKey = entity.toLowerCase();
  const queryClient = useQueryClient();
  const collection = useQuery({ queryKey: ["entity-admin", entityKey], queryFn: () => readCollection(entityKey) });
  const [creating, setCreating] = useState(pathname.endsWith("/new"));
  const [editing, setEditing] = useState(false);
  const [editingRowId, setEditingRowId] = useState<string>();
  const [rowDraft, setRowDraft] = useState<Record<string, string>>({});
  const [parentCharacterDraft, setParentCharacterDraft] = useState<Record<string, string>>({});
  const [rowValidationError, setRowValidationError] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const isEditor = screen.screenId.endsWith("_EDIT") || pathname.endsWith("/new");
  const requestedId = decodeURIComponent(pathname.split("/").filter(Boolean).at(-1) ?? "");
  const selected = collection.data?.records.find((record) => String(record[collection.data?.contract.idField ?? ""]) === requestedId)
    ?? (requestedId === "sample-record" ? collection.data?.records[0] : undefined);
  const complete = (record: Record<string, unknown>) => {
    queryClient.setQueryData<EntityCollection>(["entity-admin", entityKey], (current) => current ? { ...current, records: [...current.records.filter((candidate) => candidate[current.contract.idField] !== record[current.contract.idField]), record].sort((left, right) => String(left[current.contract.idField]).localeCompare(String(right[current.contract.idField]))) } : current);
    setCreating(false);
    setEditing(false);
    setSaveStatus(`${entity} saved.`);
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
  const inlineSave = useMutation({
    mutationFn: async ({ parentCharacter, record, recordId }: { parentCharacter?: Record<string, unknown>; record: Record<string, unknown>; recordId: string }) => {
      const response = await fetch(`/api/admin/data/${entityKey}/${encodeURIComponent(recordId)}`, {
        body: JSON.stringify({ ...(parentCharacter ? { parentCharacter } : {}), record }),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      });
      const result = await response.json() as { error?: string; record?: Record<string, unknown> };
      if (!response.ok || !result.record) throw requestError(result, `${entity} row could not be saved.`);
      return result.record;
    },
    onSuccess: (record) => {
      queryClient.setQueryData<EntityCollection>(["entity-admin", entityKey], (current) => current ? {
        ...current,
        records: current.records.map((candidate) => candidate[current.contract.idField] === record[current.contract.idField] ? record : candidate),
      } : current);
      setEditingRowId(undefined);
      setRowDraft({});
      setParentCharacterDraft({});
      setRowValidationError("");
      setSaveStatus(`${entity} row saved.`);
    },
  });
  if (collection.isLoading) return <p className="notice">Loading {entity} records…</p>;
  if (collection.error || !collection.data) return <p className="notice notice--bad" role="alert">{collection.error?.message ?? `${entity} records are unavailable.`}</p>;
  const contract = collection.data.contract;
  if (isEditor && !pathname.endsWith("/new")) return selected
    ? editing
      ? <EntityForm contract={contract} entity={entity} initial={selected} mode="edit" onCancel={() => setEditing(false)} onComplete={complete} />
      : <section className="card stack"><div className="action-row action-row--between"><div><p className="kicker">RECORD DETAIL</p><h2>{String(selected.displayName ?? selected.name ?? selected.title ?? selected.term ?? selected[contract.idField])}</h2><p className="muted">{String(selected[contract.idField])}</p></div><button className="button button--gold" onClick={() => { setSaveStatus(""); setEditing(true); }} type="button">Edit Record</button></div>{saveStatus && <p className="notice notice--good" role="status">{saveStatus}</p>}<div className="owner-form-sections">{ownerFormSections(entity).map((section) => { const fields = buildOwnerFormPlan(entity, { ...contract, auditFields: auditFieldsFor(contract) }).filter((field) => field.section === section); if (!fields.length) return null; return <fieldset className="span-2 owner-form-section" key={section}><legend>{section}</legend>{section === "Character identity" && subtypeParentEntity(entity) && <ParentCharacterContext initial={selected} />}{entity === "WitnessDef" && section === "Source Architect / Soul" && <WitnessDefSourceContext initial={selected} />}{entity === "Witness" && section === "Witness definition" && <WitnessDefinitionContext initial={selected} />}{entity === "Witness" && section === "Architect continuity" && <WitnessContinuityContext initial={selected} />}<div className="form-grid">{fields.map((field) => <ReadOnlyOwnerField field={field} key={field.name} value={selected[field.name]} />)}</div></fieldset>; })}</div><a className="button" href={`/admin/data/${entityKey}`}>Back to records</a></section>
    : <section className="card"><h2>{entity} record not found</h2><p>No persisted record matches {requestedId}.</p><a className="button" href={`/admin/data/${entityKey}`}>Back to records</a></section>;
  const resolvedContract = { ...contract, auditFields: auditFieldsFor(contract) };
  const formPlan = buildOwnerFormPlan(entity, resolvedContract);
  const formPlanByName = new Map(formPlan.map((field) => [field.name, field]));
  const editableByName = new Map(contract.fields.map((field) => [field.name, field]));
  const characterContract = (contractData.entities as unknown as Record<string, AdminContract>).Character;
  const resolvedCharacterContract = { ...characterContract, auditFields: auditFieldsFor(characterContract) };
  const characterPlanByName = new Map(buildOwnerFormPlan("Character", resolvedCharacterContract).map((field) => [field.name, field]));
  const characterEditableByName = new Map(characterContract.fields.map((field) => [field.name, field]));
  const hasParentCharacter = subtypeParentEntity(entity) === "Character";
  const beginInlineEdit = (record: Record<string, unknown>) => {
    setSaveStatus("");
    setRowValidationError("");
    inlineSave.reset();
    setEditingRowId(String(record[contract.idField]));
    setRowDraft(Object.fromEntries(contract.fields.map((field) => [field.name, editableValue(record[field.name], field)])));
    const character = asRecord(record.character);
    setParentCharacterDraft(character ? Object.fromEntries(characterContract.fields.map((field) => [field.name, editableValue(character[field.name], field)])) : {});
  };
  const cancelInlineEdit = () => {
    inlineSave.reset();
    setEditingRowId(undefined);
    setRowDraft({});
    setParentCharacterDraft({});
    setRowValidationError("");
  };
  const saveInlineRow = (recordId: string) => {
    try {
      setRowValidationError("");
      const errors = validateAdminEntityDraft(entity, contract.idField, contract.fields, rowDraft);
      if (hasParentCharacter) errors.push(...validateAdminEntityDraft("Character", characterContract.idField, characterContract.fields, parentCharacterDraft));
      if (errors.length) throw new Error(errors.join(" "));
      inlineSave.mutate({
        ...(hasParentCharacter ? { parentCharacter: payloadFromDraft(characterContract, parentCharacterDraft) } : {}),
        record: payloadFromDraft(contract, rowDraft),
        recordId,
      });
    } catch (error) {
      // Client-side failures use the same visible error region while retaining the row draft.
      setRowValidationError(error instanceof Error ? error.message : String(error));
    }
  };
  const inlineCell = (record: Record<string, unknown>, field: AuditField, owner: "Character" | "Entity") => {
    const recordId = String(record[contract.idField]);
    const editingThisRow = editingRowId === recordId;
    const parent = asRecord(record.character);
    const source = owner === "Character" ? parent : record;
    const ownerContract = owner === "Character" ? characterContract : contract;
    const ownerEntity = owner === "Character" ? "Character" : entity;
    const editable = (owner === "Character" ? characterEditableByName : editableByName).get(field.name);
    const planned = (owner === "Character" ? characterPlanByName : formPlanByName).get(field.name);
    const immutable = field.name === ownerContract.idField;
    if (!editingThisRow || !editable || immutable) return <span className={editingThisRow ? "inline-row-readonly" : undefined}><OwnerFieldValue field={field} value={source?.[field.name]} /></span>;
    const relationRecord = planned?.relationField ? asRecord(source?.[planned.relationField]) : undefined;
    const draft = owner === "Character" ? parentCharacterDraft : rowDraft;
    const update = owner === "Character" ? setParentCharacterDraft : setRowDraft;
    return <div className="inline-row-editor"><AdminFieldEditor contract={ownerContract} controlOverride={planned?.control} disabled={false} entity={ownerEntity} field={editable} initialRelation={relationRecord} labelOverride={owner === "Character" ? `Character.${field.name}` : undefined} relationType={planned?.relationType} value={draft[field.name] ?? ""} onChange={(value) => update((current) => ({ ...current, [field.name]: value }))} /></div>;
  };
  const parentColumns: DataTableColumnDef<Record<string, unknown>>[] = hasParentCharacter
    ? orderOwnerTableFields("Character", characterContract.idField, auditFieldsFor(characterContract)).filter((field) => field.name !== characterContract.idField).map((field) => ({
      accessorFn: (record: Record<string, unknown>) => asRecord(record.character)?.[field.name],
      cell: ({ row }: { row: { original: Record<string, unknown> } }) => inlineCell(row.original, field, "Character"),
      header: `Character.${field.name}`,
      id: `character.${field.name}`,
      meta: { filterVariant: field.kind === "relation" ? "relation" as const : field.isList ? "array" as const : field.kind === "enum" ? "enum" as const : undefined, nullable: !field.isRequired },
    }))
    : [];
  const columns: DataTableColumnDef<Record<string, unknown>>[] = [
    ...parentColumns,
    ...orderOwnerTableFields(entity, contract.idField, auditFieldsFor(contract)).map((field) => ({
      accessorFn: (record: Record<string, unknown>) => record[field.name],
      cell: ({ row }: { row: { original: Record<string, unknown> } }) => inlineCell(row.original, field, "Entity"),
      header: field.name,
      id: field.name,
      meta: { filterVariant: field.kind === "relation" ? "relation" as const : field.isList ? "array" as const : field.kind === "enum" ? "enum" as const : undefined, nullable: !field.isRequired },
    })),
    {
      cell: ({ row }) => {
        const id = String(row.original[contract.idField]);
        const editingThisRow = editingRowId === id;
        return <div className="action-row">{editingThisRow ? <><button aria-label={`Save Row ${id}`} className="button button--small button--gold" disabled={inlineSave.isPending} onClick={() => saveInlineRow(id)} type="button">✓</button><button className="button button--small" disabled={inlineSave.isPending} onClick={cancelInlineEdit} type="button">Cancel Row</button></> : <button className="button button--small button--gold" disabled={editingRowId !== undefined} onClick={() => beginInlineEdit(row.original)} type="button">Edit Row</button>}<a className="button button--small" href={`/admin/data/${entityKey}/${encodeURIComponent(id)}`}>View Record</a><button className="button button--small button--danger" disabled={editingRowId !== undefined} onClick={() => { if (window.confirm(`Delete ${entity} ${id}? This cannot be undone.`)) remove.mutate(id); }}>Delete</button></div>;
      },
      enableColumnFilter: false,
      enableSorting: false,
      header: "Actions",
      id: "actions",
    },
  ];
  return <div className="stack">
    <section className="card">
      <div className="action-row action-row--between"><div><p className="kicker">PERSISTED RECORDS</p><h2>{entity}</h2></div><span className="tag">{collection.data.records.length} records</span></div>
      <div className="action-row"><button className="button button--gold" onClick={() => setCreating((value) => !value)}>{creating ? "Close New Record" : "New"}</button><a className="button" href={`/admin/data/${entityKey}/import`}>Import</a></div>
      <DataTable columns={columns} data={collection.data.records} getRowId={(record) => String(record[contract.idField])} preferenceKey={`entity-${entityKey}`} searchLabel={`Search ${entity}`} />
      {inlineSave.error && <p className="notice notice--bad" role="alert">{inlineSave.error.message}</p>}
      {!inlineSave.error && rowValidationError && <p className="notice notice--bad" role="alert">{rowValidationError}</p>}
      {!editingRowId && saveStatus && <p className="notice notice--good" role="status">{saveStatus}</p>}
      {remove.error && <p className="notice notice--bad" role="alert">{remove.error.message}</p>}
    </section>
    {creating && <EntityForm contract={contract} entity={entity} mode="create" onComplete={complete} />}
  </div>;
}

export function EntityDataAdminPage({ pathname, screen }: { pathname: string; screen: PageManifestEntry }) {
  const entity = entityForPath(screen.path);
  return entity ? <EntityRecordsAdminPage entity={entity} pathname={pathname} screen={screen} /> : <ObjectTypeIndex />;
}
