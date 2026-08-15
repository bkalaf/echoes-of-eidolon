import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { validateCompanionPlanner, type PlannerAssignment, type PlannerValidationIssue } from "../../domain/companion-planner";

const abilityTypes = ["CHARISMA", "DEXTERITY", "INTELLIGENCE", "STAMINA", "STRENGTH", "WISDOM"] as const;
const companionKeys = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"] as const;
const plannerWorlds = ["CONCORD", "RUIN", "SCHISM"] as const;
const plannerProperties = ["Name", "Gender", "Breed", "Age", "Occupation", "Faction", "Knowledge Skill", "Awareness Skill", "Heirloom", "Primary", "Secondary"] as const;
const knowledgeSkills = ["EIDETIC_MEMORY", "PHOTOGRAPHIC_MEMORY", "RECOGNITION", "ORIENTATION", "RESEARCH", "ORIGINS", "LORE", "GOSSIP", "PERFECT_PITCH", "CONNECTIONS", "TRACE"] as const;
const awarenessSkills = ["DANGER_SENSE", "TRAP_SENSE", "POISON_SENSE", "DIPLOMACY", "DECEPTION_SENSE", "READ_BETWEEN_THE_LINES", "EMPATHY", "STREETWISE", "GUARDIAN", "FIRST_AID", "RESOLVE"] as const;
const heirloomTypes = ["NECKLACE", "BRACELET", "EARRINGS", "CLOAK_CLASP", "LIGHTER", "POCKETWATCH", "COIN_HEAD_BLACKENED", "COIN_TAIL_BLACKENED", "RING", "TATTOO", "BIRTHMARK", "BROOCH", "HAIR_BARRETTE", "BELT_BUCKLE", "BACKPACK_CLASP"] as const;

interface OccupationRecord { occupationId: string; name: string; description: string | null; active: boolean; affinities: Array<{ abilityType: string; ordinal: number }> }

export function OccupationAdminPage() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["admin", "occupations"], queryFn: async () => { const response = await fetch("/api/admin/occupations"); const result = await response.json() as { occupations?: OccupationRecord[]; error?: string }; if (!response.ok || !result.occupations) throw new Error(result.error ?? "Occupations could not be loaded."); return result.occupations; } });
  const [key, setKey] = useState(""); const [name, setName] = useState(""); const [description, setDescription] = useState(""); const [active, setActive] = useState(true); const [affinity, setAffinity] = useState<string[]>([]); const [editing, setEditing] = useState(false); const [saving, setSaving] = useState(false); const [message, setMessage] = useState("");
  const reset = () => { setKey(""); setName(""); setDescription(""); setActive(true); setAffinity([]); setEditing(false); setMessage(""); };
  const toggle = (value: string) => setAffinity((current) => current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value]);
  const move = (index: number, offset: -1 | 1) => setAffinity((current) => { const next = [...current]; const target = index + offset; if (target < 0 || target >= next.length) return current; [next[index], next[target]] = [next[target]!, next[index]!]; return next; });
  return <div className="split"><section className="card"><div className="action-row action-row--between"><h2>Occupations</h2><button className="button" onClick={reset} type="button">New Occupation</button></div>{query.isPending ? <p>Loading…</p> : query.isError ? <p className="notice notice--bad">{query.error.message}</p> : <div className="stack">{query.data.map((occupation) => <button className="button" key={occupation.occupationId} onClick={() => { setKey(occupation.occupationId); setName(occupation.name); setDescription(occupation.description ?? ""); setActive(occupation.active); setAffinity(occupation.affinities.map((entry) => entry.abilityType)); setEditing(true); setMessage(""); }} type="button">{occupation.name} · {occupation.affinities.map((entry) => entry.abilityType).join(" → ")}{occupation.active ? "" : " · inactive"}</button>)}</div>}</section><section className="card"><h2>Occupation attributes</h2><label className="field">Stable key<input className="input" onChange={(event) => setKey(event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_"))} readOnly={editing} value={key} /></label><label className="field">Display name<input className="input" onChange={(event) => setName(event.target.value)} value={name} /></label><label className="field">Description<textarea className="textarea" onChange={(event) => setDescription(event.target.value)} value={description} /></label><label className="field"><input checked={active} onChange={(event) => setActive(event.target.checked)} type="checkbox" /> Active</label><fieldset className="field"><legend>Ordered AbilityType affinity</legend>{abilityTypes.map((ability) => <label key={ability}><input checked={affinity.includes(ability)} onChange={() => toggle(ability)} type="checkbox" /> {ability}</label>)}</fieldset><ol>{affinity.map((ability, index) => <li key={ability}>{ability} <button aria-label={`Move ${ability} earlier`} disabled={index === 0} onClick={() => move(index, -1)} type="button">↑</button><button aria-label={`Move ${ability} later`} disabled={index === affinity.length - 1} onClick={() => move(index, 1)} type="button">↓</button></li>)}</ol><button className="button button--gold" disabled={saving || !key || !name || affinity.length === 0} onClick={async () => { setSaving(true); try { const response = await fetch("/api/admin/occupations", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ occupationId: key, name, description: description || null, active, attributeAffinity: affinity }) }); const result = await response.json() as { error?: string }; setMessage(response.ok ? "Occupation saved." : result.error ?? "Occupation could not be saved."); if (response.ok) { setEditing(true); await client.invalidateQueries({ queryKey: ["admin", "occupations"] }); } } finally { setSaving(false); } }}>{saving ? "Saving…" : "Save Occupation"}</button>{message && <p role="status" className="notice">{message}</p>}</section></div>;
}

interface PlannerCharacter {
  age: string;
  breedId: string;
  displayName: string;
  faction: string | null;
  gender: string | null;
  occupationId: string | null;
  primaryAttribute: string | null;
  secondaryAttribute: string | null;
  worldKey: string | null;
}

interface PlannerCompanion {
  awarenessSkill: string | null;
  companionKey: string;
  concordCharacter: PlannerCharacter;
  heirloom: string;
  knowledgeSkill: string | null;
  ruinCharacter: PlannerCharacter;
  schismCharacter: PlannerCharacter;
  soul: { name: string };
  transformationBinding: null | { layetteId: string };
}

interface PlannerData { companions: PlannerCompanion[]; occupations: OccupationRecord[]; layettes: Array<{ layetteId: string; name: string }> }

function plannerCharacter(companion: PlannerCompanion, world: typeof plannerWorlds[number]) {
  return world === "CONCORD" ? companion.concordCharacter : world === "RUIN" ? companion.ruinCharacter : companion.schismCharacter;
}

function plannerValue(companion: PlannerCompanion, world: typeof plannerWorlds[number], property: typeof plannerProperties[number], occupations: OccupationRecord[]) {
  const character = plannerCharacter(companion, world);
  if (property === "Name") return character.displayName;
  if (property === "Gender") return character.gender ?? "Not authored";
  if (property === "Breed") return character.breedId;
  if (property === "Age") return character.age;
  if (property === "Occupation") return occupations.find((entry) => entry.occupationId === character.occupationId)?.name ?? character.occupationId ?? "Not authored";
  if (property === "Faction") return character.faction ?? "Not authored";
  if (property === "Knowledge Skill") return companion.knowledgeSkill ?? "Not participating";
  if (property === "Awareness Skill") return companion.awarenessSkill ?? "Not participating";
  if (property === "Heirloom") return companion.heirloom;
  if (property === "Primary") return character.primaryAttribute ?? "Not authored";
  return character.secondaryAttribute ?? "Not authored";
}

function cellIssueId(world: string, companion: string, property: typeof plannerProperties[number]) {
  const propertyKey = property === "Breed" ? "breedId" : property === "Occupation" ? "occupationId" : property === "Knowledge Skill" ? "knowledgeSkill" : property === "Awareness Skill" ? "awarenessSkill" : property === "Faction" ? "faction" : property === "Primary" || property === "Secondary" ? "attributes" : property.toLowerCase().replaceAll(" ", "_");
  return `${world}.${companion}.${propertyKey}`;
}

function PlannerMultiSelect<T extends string>({ label, options, selected, onChange }: { label: string; options: readonly T[]; selected: readonly T[]; onChange: (value: T[]) => void }) {
  const toggle = (value: T) => onChange(selected.includes(value) ? selected.filter((entry) => entry !== value) : [...selected, value]);
  return <details className="planner-multiselect"><summary aria-label={`${label} filter`}><span>{label}</span><span className="planner-chips">{selected.map((value) => <button aria-label={`Remove ${value} from ${label}`} className="finite-chip" key={value} onClick={(event) => { event.preventDefault(); event.stopPropagation(); toggle(value); }} type="button">{value} ×</button>)}</span></summary><fieldset><legend className="sr-only">{label}</legend>{options.map((value) => <label key={value}><input checked={selected.includes(value)} onChange={() => toggle(value)} type="checkbox" /> {value}</label>)}</fieldset></details>;
}

function usePlanner() { return useQuery({ queryKey: ["admin", "companion-planner"], queryFn: async () => { const response = await fetch("/api/admin/companion-planner"); const result = await response.json() as PlannerData & { error?: string }; if (!response.ok || !result.companions) throw new Error(result.error ?? "Companion planner could not be loaded."); return result; } }); }

export function CompanionPlannerAttributesPage() {
  const query = usePlanner(); const [selected, setSelected] = useState("A"); const [worldKey, setWorldKey] = useState("CONCORD"); const [message, setMessage] = useState("");
  const [visibleWorlds, setVisibleWorlds] = useState<Array<typeof plannerWorlds[number]>>([...plannerWorlds]);
  const [visibleCompanions, setVisibleCompanions] = useState<string[]>([...companionKeys]);
  const [visibleProperties, setVisibleProperties] = useState<Array<typeof plannerProperties[number]>>([...plannerProperties]);
  const [propertiesOnRows, setPropertiesOnRows] = useState(true);
  const [validationIssues, setValidationIssues] = useState<PlannerValidationIssue[]>([]);
  const companion = query.data?.companions.find((row) => row.companionKey === selected);
  const character = companion ? plannerCharacter(companion, worldKey as typeof plannerWorlds[number]) : undefined;
  const [occupationId, setOccupationId] = useState(""); const [primary, setPrimary] = useState("CHARISMA"); const [secondary, setSecondary] = useState("CHARISMA"); const [faction, setFaction] = useState("CONCORD"); const [gender, setGender] = useState(""); const [age, setAge] = useState(""); const [knowledgeSkill, setKnowledgeSkill] = useState(""); const [awarenessSkill, setAwarenessSkill] = useState(""); const [worldHeirloom, setWorldHeirloom] = useState(""); const [loadedAssignment, setLoadedAssignment] = useState("");
  const assignmentIdentity = companion && character ? `${selected}:${worldKey}:${query.dataUpdatedAt}` : "";
  if (assignmentIdentity && loadedAssignment !== assignmentIdentity) {
    setLoadedAssignment(assignmentIdentity);
    setOccupationId(character?.occupationId ?? "");
    setPrimary(character?.primaryAttribute ?? "CHARISMA");
    setSecondary(character?.secondaryAttribute ?? "CHARISMA");
    setFaction(character?.faction ?? worldKey);
    setGender(character?.gender ?? "");
    setAge(character?.age ?? "");
    setKnowledgeSkill(companion?.knowledgeSkill ?? "");
    setAwarenessSkill(companion?.awarenessSkill ?? "");
    setWorldHeirloom(companion?.heirloom ?? "");
    setMessage("");
  }
  const selectedOccupation = query.data?.occupations.find((entry) => entry.occupationId === occupationId);
  const affinity = selectedOccupation?.affinities.map((entry) => entry.abilityType) ?? [];
  const validate = () => {
    if (!query.data) return;
    const incomplete: PlannerValidationIssue[] = [];
    const assignments: PlannerAssignment[] = [];
    for (const row of query.data.companions) for (const world of plannerWorlds) {
      const value = plannerCharacter(row, world);
      const required = [["breedId", value.breedId], ["occupationId", value.occupationId], ["faction", value.faction], ["primaryAttribute", value.primaryAttribute], ["secondaryAttribute", value.secondaryAttribute]] as const;
      for (const [property, authored] of required) if (!authored) incomplete.push({ cell: `${world}.${row.companionKey}.${property}`, message: `${property} is not authored.` });
      if (required.some(([, authored]) => !authored)) continue;
      assignments.push({ awarenessSkill: row.awarenessSkill, breedId: value.breedId, companionKey: row.companionKey, faction: value.faction as PlannerAssignment["faction"], knowledgeSkill: row.knowledgeSkill, occupationId: value.occupationId!, primaryAttribute: value.primaryAttribute!, secondaryAttribute: value.secondaryAttribute!, worldKey: world });
    }
    const affinities = new Map(query.data.occupations.map((entry) => [entry.occupationId, new Set(entry.affinities.map((affinityEntry) => affinityEntry.abilityType))]));
    setValidationIssues([...incomplete, ...validateCompanionPlanner(assignments, affinities)]);
  };
  return <div className="stack"><section className="card"><div className="action-row action-row--between"><div><h2>Companion attribute matrix</h2><p>World is the outer group. Filters affect the current table dimension without changing authored data.</p></div><div className="action-row"><button className="button" onClick={() => setPropertiesOnRows((current) => !current)} type="button">Pivot: {propertiesOnRows ? "Properties on rows" : "Companions on rows"}</button><button className="button button--gold" onClick={validate} type="button">Validate</button></div></div><div className="planner-filter-grid"><PlannerMultiSelect label="World" onChange={setVisibleWorlds} options={plannerWorlds} selected={visibleWorlds} /><PlannerMultiSelect label="Companion" onChange={setVisibleCompanions} options={companionKeys} selected={visibleCompanions} /><PlannerMultiSelect label="Property Visibility" onChange={setVisibleProperties} options={plannerProperties} selected={visibleProperties} /></div>{query.data && <div className="stack" aria-label="Companion planner matrix">{visibleWorlds.map((world) => <section className={`planner-matrix-group planner-world-${world.toLowerCase()}`} key={world}><h3>{world}</h3><div className="table-scroll"><table className="simple-table planner-matrix"><thead><tr><th>{propertiesOnRows ? "Property" : "Companion"}</th>{(propertiesOnRows ? visibleCompanions : visibleProperties).map((heading) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{(propertiesOnRows ? visibleProperties : visibleCompanions).map((row) => <tr key={row}><th>{row}</th>{(propertiesOnRows ? visibleCompanions : visibleProperties).map((column) => { const companionKey = String(propertiesOnRows ? column : row); const property = (propertiesOnRows ? row : column) as typeof plannerProperties[number]; const plannerCompanion = query.data.companions.find((entry) => entry.companionKey === companionKey); const issueId = cellIssueId(world, companionKey, property); const hasIssue = validationIssues.some((issue) => issue.cell === issueId); return <td className={hasIssue ? "planner-cell-error" : undefined} data-cell-id={issueId} key={String(column)}>{plannerCompanion ? plannerValue(plannerCompanion, world, property, query.data.occupations) : "Missing companion"}</td>; })}</tr>)}</tbody></table></div></section>)}</div>}{validationIssues.length > 0 ? <div className="notice notice--bad" role="alert"><strong>{validationIssues.length} planner issues</strong><ul>{validationIssues.map((issue) => <li key={`${issue.cell}:${issue.message}`}><code>{issue.cell}</code>: {issue.message}</li>)}</ul></div> : <p className="notice" role="status">Select Validate to check all authored restrictions without changing data.</p>}</section><nav aria-label="Companion planner world" className="tabs">{plannerWorlds.map((world) => <button aria-pressed={worldKey === world} className={worldKey === world ? "active" : ""} key={world} onClick={() => setWorldKey(world)}>{world}</button>)}</nav><section className="card"><h2>Twelve-companion roster</h2><div className="action-row">{companionKeys.map((key) => <button aria-pressed={selected === key} className="button" key={key} onClick={() => setSelected(key)}>{key}{query.data?.companions.some((row) => row.companionKey === key) ? "" : " · missing"}</button>)}</div></section>{query.isPending ? <p>Loading…</p> : query.isError ? <p className="notice notice--bad">{query.error.message}</p> : !companion ? <p className="notice notice--warn">Companion {selected} has no authored Character/CompanionDef relationship. Create it through the canonical Data owner before assigning planner attributes.</p> : <section className={`card form-grid planner-world-${worldKey.toLowerCase()}`}><h2 className="span-2">{selected} · {companion.soul.name} · {worldKey}</h2><label className="field">Gender<input className="input" onChange={(event) => setGender(event.target.value)} value={gender} /></label><label className="field">Age<input className="input" onChange={(event) => setAge(event.target.value)} value={age} /></label><label className="field">Faction<select className="select" onChange={(event) => setFaction(event.target.value)} value={faction}>{plannerWorlds.map((entry) => <option key={entry}>{entry}</option>)}</select></label><label className="field">Occupation<select className="select" onChange={(event) => setOccupationId(event.target.value)} value={occupationId}><option value="">Select Occupation</option>{query.data.occupations.map((entry) => <option key={entry.occupationId} value={entry.occupationId}>{entry.name}</option>)}</select></label><label className="field">Primary Attribute<select className="select" onChange={(event) => setPrimary(event.target.value)} value={primary}>{abilityTypes.map((entry) => <option key={entry}>{entry}</option>)}</select></label><label className="field">Secondary Attribute<select className="select" onChange={(event) => setSecondary(event.target.value)} value={secondary}>{abilityTypes.map((entry) => <option key={entry}>{entry}</option>)}</select></label>{occupationId && (!affinity.includes(primary) || !affinity.includes(secondary)) && <p className="notice notice--bad span-2">Both selected attributes must appear in the ordered {selectedOccupation?.name ?? occupationId} affinity.</p>}<button className="button button--gold span-2" disabled={!occupationId || !affinity.includes(primary) || !affinity.includes(secondary) || !gender || !age} onClick={async () => { const response = await fetch("/api/admin/companion-planner", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "assignment", companionKey: selected, worldKey, gender, age, occupationId, faction, primaryAttribute: primary, secondaryAttribute: secondary }) }); const result = await response.json() as { error?: string }; setMessage(response.ok ? "World Character assignment saved." : result.error ?? "Assignment could not be saved."); if (response.ok) await query.refetch(); }}>Save World Character</button><hr className="span-2" /><label className="field">Knowledge Skill<select className="select" onChange={(event) => setKnowledgeSkill(event.target.value)} value={knowledgeSkill}><option value="">Not participating</option>{knowledgeSkills.map((entry) => <option key={entry}>{entry}</option>)}</select></label><label className="field">Awareness Skill<select className="select" onChange={(event) => setAwarenessSkill(event.target.value)} value={awarenessSkill}><option value="">Not participating</option>{awarenessSkills.map((entry) => <option key={entry}>{entry}</option>)}</select></label><label className="field">Heirloom<select className="select" onChange={(event) => setWorldHeirloom(event.target.value)} value={worldHeirloom}><option value="">Select Heirloom</option>{heirloomTypes.map((entry) => <option key={entry}>{entry}</option>)}</select></label><button className="button span-2" disabled={!worldHeirloom} onClick={async () => { const response = await fetch("/api/admin/companion-planner", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "definition", companionKey: selected, knowledgeSkill: knowledgeSkill || null, awarenessSkill: awarenessSkill || null, heirloom: worldHeirloom }) }); const result = await response.json() as { error?: string }; setMessage(response.ok ? "Companion definition saved." : result.error ?? "Definition could not be saved."); if (response.ok) await query.refetch(); }}>Save Companion Definition</button>{message && <p className="notice span-2" role="status">{message}</p>}</section>}</div>;
}

export function TransformationAuthoringPage() {
  const query = usePlanner(); const [companionKey, setCompanionKey] = useState("A"); const [layetteId, setLayetteId] = useState(""); const [loadedBinding, setLoadedBinding] = useState(""); const [saving, setSaving] = useState(false); const [message, setMessage] = useState("");
  const selectedCompanion = query.data?.companions.find((entry) => entry.companionKey === companionKey);
  const bindingIdentity = selectedCompanion ? `${companionKey}:${query.dataUpdatedAt}` : "";
  if (bindingIdentity && loadedBinding !== bindingIdentity) { setLoadedBinding(bindingIdentity); setLayetteId(selectedCompanion?.transformationBinding?.layetteId ?? ""); setMessage(""); }
  return <section className="card"><h2>Transformation authoring</h2><p>The trigger is the end of the first Book assigned to the companion. Completion grants the selected Layette and the irreversible Transformation capability; Awareness remains unavailable until that event.</p>{query.isPending ? <p>Loading…</p> : query.isError ? <p className="notice notice--bad">{query.error.message}</p> : query.data && <div className="form-grid"><label className="field">Companion<select className="select" value={companionKey} onChange={(event) => setCompanionKey(event.target.value)}>{query.data.companions.map((entry) => <option key={entry.companionKey}>{entry.companionKey}</option>)}</select></label><label className="field">Layette<select className="select" value={layetteId} onChange={(event) => setLayetteId(event.target.value)}><option value="">Select Layette</option>{query.data.layettes.map((entry) => <option key={entry.layetteId} value={entry.layetteId}>{entry.name}</option>)}</select></label><button className="button button--gold span-2" disabled={saving || !layetteId} onClick={async () => { setSaving(true); try { const response = await fetch("/api/admin/companion-planner", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "transformation", companionKey, layetteId }) }); const result = await response.json() as { error?: string }; setMessage(response.ok ? "Transformation binding saved." : result.error ?? "Binding could not be saved."); if (response.ok) await query.refetch(); } finally { setSaving(false); } }}>{saving ? "Saving…" : "Save Transformation Binding"}</button></div>}{message && <p className="notice" role="status">{message}</p>}</section>;
}

export function MoneyAuditPage() {
  const query = useQuery({ queryKey: ["admin", "money"], queryFn: async () => { const response = await fetch("/api/admin/money"); const result = await response.json() as { transactions?: Array<Record<string, unknown> & { moneyTransactionId: string; occurredAtGameMinute: string; delta: number; withdrawalAmount: number | null; worldInstance: { worldKey: string }; party: { user: { email: string; name: string } } }>; error?: string }; if (!response.ok || !result.transactions) throw new Error(result.error ?? "Money audit could not be loaded."); return result.transactions; } });
  return <section className="card"><h2>World Transaction Ledger</h2>{query.isPending ? <p>Loading…</p> : query.isError ? <p className="notice notice--bad">{query.error.message}</p> : <div className="table-scroll"><table className="simple-table"><thead><tr><th>Recorded</th><th>Account</th><th>World</th><th>Delta</th><th>Withdrawal</th><th>Game time</th><th>Context</th></tr></thead><tbody>{query.data.map((row) => <tr key={row.moneyTransactionId}><td>{String(row.recordedAt)}</td><td>{row.party.user.name} · {row.party.user.email}</td><td>{row.worldInstance.worldKey}</td><td>{row.delta}</td><td>{row.withdrawalAmount ?? "—"}</td><td>{row.occurredAtGameMinute}</td><td><code>{JSON.stringify(row.context)}</code></td></tr>)}</tbody></table></div>}</section>;
}

interface SettlementSoundtrackData {
  settlement: { name: string | null; soundtrackAssignments: Array<{ settlementSoundtrackAssignmentId: string; soundtrackId: string; category: string; ordinal: number; active: boolean; soundtrack: { displayName: string; soundtrackId?: string } }> };
  soundtracks: Array<{ soundtrackId: string; displayName: string }>;
}

export function SettlementSoundtracksPage({ pathname }: { pathname?: string }) {
  const settlementId = pathname?.match(/^\/admin\/atlas\/settlements\/([^/]+)\/soundtracks$/)?.[1] ?? "";
  const query = useQuery({ queryKey: ["admin", "settlement-soundtracks", settlementId], enabled: Boolean(settlementId), queryFn: async (): Promise<SettlementSoundtrackData> => { const response = await fetch(`/api/admin/settlement-soundtracks?settlementId=${encodeURIComponent(settlementId)}`); const result = await response.json() as Partial<SettlementSoundtrackData> & { error?: string }; if (!response.ok || !result.settlement || !result.soundtracks) throw new Error(result.error ?? "Settlement soundtracks could not be loaded."); return { settlement: result.settlement, soundtracks: result.soundtracks }; } });
  const [soundtrackId, setSoundtrackId] = useState(""); const [category, setCategory] = useState("CITY"); const [ordinal, setOrdinal] = useState(0); const [active, setActive] = useState(true); const [editing, setEditing] = useState(false); const [saving, setSaving] = useState(false); const [message, setMessage] = useState("");
  const reset = () => { setSoundtrackId(""); setCategory("CITY"); setOrdinal(0); setActive(true); setEditing(false); setMessage(""); };
  return <section className="card"><h2>Settlement Soundtracks</h2>{query.isPending ? <p>Loading…</p> : query.data && <><div className="action-row action-row--between"><p>{query.data.settlement.name ?? settlementId}</p><button className="button" onClick={reset} type="button">New Assignment</button></div><div className="table-scroll"><table className="simple-table"><thead><tr><th>Category</th><th>Order</th><th>Soundtrack</th><th>Active</th><th>Action</th></tr></thead><tbody>{query.data.settlement.soundtrackAssignments.map((entry) => <tr key={entry.settlementSoundtrackAssignmentId}><td>{entry.category}</td><td>{entry.ordinal}</td><td>{entry.soundtrack.displayName}</td><td>{String(entry.active)}</td><td><button aria-label={`Edit ${entry.soundtrack.displayName} ${entry.category}`} className="button" onClick={() => { setSoundtrackId(entry.soundtrackId ?? entry.soundtrack.soundtrackId ?? ""); setCategory(entry.category); setOrdinal(entry.ordinal); setActive(entry.active); setEditing(true); setMessage(""); }} type="button">Edit</button></td></tr>)}</tbody></table></div><div className="form-grid"><label className="field">Soundtrack<select className="select" disabled={editing} value={soundtrackId} onChange={(event) => setSoundtrackId(event.target.value)}><option value="">Select managed soundtrack</option>{query.data.soundtracks.map((entry) => <option key={entry.soundtrackId} value={entry.soundtrackId}>{entry.displayName}</option>)}</select></label><label className="field">Category<select className="select" disabled={editing} value={category} onChange={(event) => setCategory(event.target.value)}><option>CITY</option><option>TAVERN</option></select></label><label className="field">Rotation order<input className="input" min={0} type="number" value={ordinal} onChange={(event) => setOrdinal(Number(event.target.value))} /></label><label className="field"><input checked={active} onChange={(event) => setActive(event.target.checked)} type="checkbox" /> Active</label><button className="button button--gold" disabled={saving || !soundtrackId} onClick={async () => { setSaving(true); try { const response = await fetch("/api/admin/settlement-soundtracks", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ settlementId, soundtrackId, category, ordinal, active }) }); const result = await response.json() as { error?: string }; setMessage(response.ok ? "Soundtrack assignment saved." : result.error ?? "Assignment failed."); if (response.ok) { await query.refetch(); setEditing(true); } } finally { setSaving(false); } }}>{saving ? "Saving…" : editing ? "Save Assignment" : "Assign Soundtrack"}</button></div></>}{query.isError && <p className="notice notice--bad">{query.error.message}</p>}{message && <p className="notice" role="status">{message}</p>}</section>;
}
