import { useCallback, useEffect, useMemo, useState } from "react";

import type { PageManifestEntry } from "../../lib/page-manifest";

interface CapabilityParameterView {
  name: string;
  kind: "ENTITY" | "STRING";
  entityType: string | null;
  allowedValues: string[];
  ordinal: number;
}

interface CapabilityVersionView {
  capabilityDefinitionVersionId: string;
  version: number;
  pathPattern: string;
  valueKind: "BOOLEAN" | "SCORE" | "COUNTER" | "ENUM" | "REFERENCE";
  minValue: number | null;
  maxValue: number | null;
  enumValues: string[];
  allowedReferenceEntityTypes: string[];
  allowedOperations: Array<"SET" | "ADD" | "CLEAR">;
  monotonicPolicy: "NONE" | "TRUE_ONLY" | "NONDECREASING" | "NONINCREASING";
  description: string;
  status: "DRAFT" | "ACTIVE" | "RETIRED";
  parameters: CapabilityParameterView[];
}

interface CapabilityDefinitionView {
  capabilityDefinitionId: string;
  code: string;
  versions: CapabilityVersionView[];
}

function useJsonResource<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => {
    setLoading(true);
    setError("");
    setRevision((current) => current + 1);
  }, []);
  useEffect(() => {
    let cancelled = false;
    void fetch(url).then(async (response) => {
      const body = await response.json() as T & { error?: string };
      if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status}).`);
      if (!cancelled) setData(body);
    }).catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Request failed."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [revision, url]);
  return { data, error, loading, reload };
}

function CapabilityTabs() {
  return <nav className="tabs" aria-label="Capability administration">
    <a href="/admin/capabilities">Registry</a>
    <a href="/admin/capabilities/condition-builder">Condition Builder</a>
    <a href="/admin/capabilities/scoring">Scoring Policies</a>
    <a href="/admin/capabilities/inspector">Inspector</a>
  </nav>;
}

function Registry({ definitions }: { definitions: CapabilityDefinitionView[] }) {
  return <section className="card"><div className="action-row action-row--between"><div><h2>Capability Registry</h2><p>Stable definitions and immutable published versions.</p></div><a className="button button--gold" href="/admin/capabilities/new">New Definition</a></div>
    {definitions.length === 0 ? <p className="notice">No capability definitions have been authored.</p> : <table className="simple-table"><thead><tr><th>Code</th><th>Active version</th><th>Value</th><th>Path</th><th>Actions</th></tr></thead><tbody>{definitions.map((definition) => {
      const active = definition.versions.find((version) => version.status === "ACTIVE") ?? definition.versions[0];
      return <tr key={definition.capabilityDefinitionId}><td><strong>{definition.code}</strong></td><td>{active ? `v${active.version} · ${active.status}` : "No version"}</td><td>{active?.valueKind ?? "—"}</td><td><code>{active?.pathPattern ?? "—"}</code></td><td><a href={`/admin/capabilities/${definition.capabilityDefinitionId}`}>Edit / versions</a></td></tr>;
    })}</tbody></table>}
    <p className="notice">DATA030 remains the canonical data-list integration. Definition schema editing is owned by this dedicated registry.</p>
  </section>;
}

function VersionEditor({ definition, reload }: { definition?: CapabilityDefinitionView; reload: () => void }) {
  const latest = definition?.versions[0];
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const submit = async (form: HTMLFormElement) => {
    setMessage(""); setError("");
    const values = new FormData(form);
    try {
      const parameters = JSON.parse(String(values.get("parameters") ?? "[]")) as unknown;
      const response = await fetch("/api/admin/capabilities", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        capabilityDefinitionId: definition?.capabilityDefinitionId,
        code: values.get("code"),
        pathPattern: values.get("pathPattern"),
        valueKind: values.get("valueKind"),
        minValue: values.get("minValue") ? Number(values.get("minValue")) : null,
        maxValue: values.get("maxValue") ? Number(values.get("maxValue")) : null,
        enumValues: String(values.get("enumValues") ?? "").split(",").map((item) => item.trim()).filter(Boolean),
        allowedReferenceEntityTypes: String(values.get("referenceTypes") ?? "").split(",").map((item) => item.trim()).filter(Boolean),
        allowedOperations: values.getAll("allowedOperations"),
        monotonicPolicy: values.get("monotonicPolicy"),
        description: values.get("description"),
        parameters,
      }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Version creation failed.");
      setMessage("Draft version created."); reload();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Version creation failed."); }
  };
  const activate = async (versionId: string) => {
    const response = await fetch(`/api/admin/capabilities/${encodeURIComponent(versionId)}/activate`, { method: "POST" });
    const body = await response.json() as { error?: string };
    if (!response.ok) { setError(body.error ?? "Activation failed."); return; }
    setMessage("Definition version activated."); reload();
  };
  return <div className="split"><form className="card" onSubmit={(event) => { event.preventDefault(); void submit(event.currentTarget); }}><h2>{definition ? `Create version for ${definition.code}` : "Create capability definition"}</h2>
    {definition ? <><div className="account-value"><span className="account-value__label">Stable code</span><span className="account-value__text">{definition.code}</span></div><input name="code" type="hidden" value={definition.code} /></> : <label>Stable code<input name="code" required pattern="[A-Z][A-Z0-9_]*" /></label>}
    <label>Path pattern<input name="pathPattern" required defaultValue={latest?.pathPattern ?? ""} placeholder="location.{SETTLEMENT}.{POINT_OF_INTEREST}.discovered" /></label>
    <label>Description<textarea name="description" required defaultValue={latest?.description ?? ""} /></label>
    <div className="form-grid"><label>Value kind<select name="valueKind" defaultValue={latest?.valueKind ?? "BOOLEAN"}>{["BOOLEAN", "SCORE", "COUNTER", "ENUM", "REFERENCE"].map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>Monotonic policy<select name="monotonicPolicy" defaultValue={latest?.monotonicPolicy ?? "NONE"}>{["NONE", "TRUE_ONLY", "NONDECREASING", "NONINCREASING"].map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>Minimum<input name="minValue" type="number" defaultValue={latest?.minValue ?? ""} /></label><label>Maximum<input name="maxValue" type="number" defaultValue={latest?.maxValue ?? ""} /></label></div>
    <fieldset><legend>Allowed operations</legend>{(["SET", "ADD", "CLEAR"] as const).map((operation) => <label className="inline-control" key={operation}><input type="checkbox" name="allowedOperations" value={operation} defaultChecked={latest?.allowedOperations.includes(operation) ?? operation === "SET"} />{operation}</label>)}</fieldset>
    <label>Enum values (comma-separated)<input name="enumValues" defaultValue={latest?.enumValues.join(", ") ?? ""} /></label>
    <label>Reference entity types (comma-separated)<input name="referenceTypes" defaultValue={latest?.allowedReferenceEntityTypes.join(", ") ?? ""} /></label>
    <label>Parameters (JSON array)<textarea name="parameters" rows={6} defaultValue={JSON.stringify(latest?.parameters.map(({ name, kind, entityType, allowedValues }) => ({ name, kind, entityType, allowedValues })) ?? [], null, 2)} /></label>
    <button className="button button--gold" type="submit">Create Draft Version</button>{message && <p className="notice notice--success">{message}</p>}{error && <p className="notice notice--warn">{error}</p>}
  </form><section className="card"><h2>Version history</h2>{definition?.versions.length ? <table className="simple-table"><tbody>{definition.versions.map((version) => <tr key={version.capabilityDefinitionVersionId}><td>v{version.version}</td><td>{version.status}</td><td>{version.valueKind}</td><td>{version.status === "DRAFT" ? <button className="button" type="button" onClick={() => void activate(version.capabilityDefinitionVersionId)}>Activate</button> : "Immutable"}</td></tr>)}</tbody></table> : <p>No versions yet.</p>}</section></div>;
}

function ConditionBuilder({ definitions }: { definitions: CapabilityDefinitionView[] }) {
  const [condition, setCondition] = useState("{}");
  const [status, setStatus] = useState("Add a fully bound requirement.");
  const add = (form: HTMLFormElement) => {
    try {
      const values = new FormData(form); const definition = definitions.find((item) => item.code === values.get("code")); const version = definition?.versions.find((item) => item.status === "ACTIVE");
      if (!definition || !version) throw new Error("Select a definition with an active version.");
      const bindings = JSON.parse(String(values.get("bindings") ?? "{}")) as Record<string, string>;
      const expected = version.parameters.map((parameter) => parameter.name).sort(); const actual = Object.keys(bindings).sort();
      if (JSON.stringify(expected) !== JSON.stringify(actual)) throw new Error(`Bindings must be exactly: ${expected.join(", ") || "none"}.`);
      const operator = String(values.get("operator")); const rawValue = String(values.get("value") ?? "").trim();
      const requirement = { scope: { scopeType: values.get("scopeType"), scopeId: values.get("scopeId") }, address: { capabilityDefinitionId: definition.capabilityDefinitionId, capabilityDefinitionVersionId: version.capabilityDefinitionVersionId, bindings }, operator, ...(rawValue ? { value: JSON.parse(rawValue) as unknown } : {}) };
      setCondition(JSON.stringify({ all: [requirement] }, null, 2)); setStatus("Condition structure is ready for server-side authoritative validation when attached to a consumer.");
    } catch (reason) { setStatus(reason instanceof Error ? reason.message : "Condition is invalid."); }
  };
  return <div className="split"><form className="card" onSubmit={(event) => { event.preventDefault(); add(event.currentTarget); }}><h2>Address & Condition Builder</h2><label>Definition<select name="code">{definitions.map((definition) => <option key={definition.code}>{definition.code}</option>)}</select></label><div className="form-grid"><label>Scope<select name="scopeType">{["ACCOUNT", "PLAYTHROUGH", "WORLD", "PARTY", "CHARACTER"].map((value) => <option key={value}>{value}</option>)}</select></label><label>Scope ID<input name="scopeId" required /></label></div><label>Bindings JSON<textarea name="bindings" defaultValue="{}" /></label><div className="form-grid"><label>Operator<select name="operator">{["EXISTS", "NOT_EXISTS", "EQ", "NEQ", "GT", "GTE", "LT", "LTE", "IN", "NOT_IN"].map((value) => <option key={value}>{value}</option>)}</select></label><label>Value JSON<input name="value" placeholder={'true or ["COMPLETE"]'} /></label></div><button className="button button--gold">Build Requirement</button><p className="notice">{status}</p></form><section className="card"><h2>Condition tree</h2><pre>{condition}</pre><button className="button" type="button" onClick={() => void navigator.clipboard.writeText(condition)}>Copy Condition</button></section></div>;
}

function ScoringPolicies() {
  const resource = useJsonResource<{ factionPolicies: Array<{ factionStandingScoringPolicyId: string; version: number; status: string; minimumScore: number; maximumScore: number; weights: Array<{ kind: string; weight: number }> }> }>("/api/admin/capabilities/scoring");
  return <section className="card"><h2>Faction Standing Scoring Policies</h2><p>Reward candidate scoring is not a canonical gameplay subsystem. Generic Capability SCORE values and configured faction standing remain available.</p>{resource.loading ? <p>Loading…</p> : resource.error ? <p className="notice notice--warn">{resource.error}</p> : resource.data?.factionPolicies.length ? resource.data.factionPolicies.map((policy) => <article className="inset-card" key={policy.factionStandingScoringPolicyId}><h3>Faction policy v{policy.version} · {policy.status}</h3><p>Range {policy.minimumScore}–{policy.maximumScore}</p></article>) : <p className="notice notice--warn">Faction standing has no owner-authoritative weights. Runtime remains fail-closed.</p>}</section>;
}

function Inspector() {
  const [result, setResult] = useState<{ comparison: { eventCount: number; persistedStateCount: number; rebuiltStateCount: number; mismatches: string[] }; events: Array<{ capabilityEventId: string; sequence: string; operation: string; scopeType: string; scopeId: string }> } | null>(null);
  const [error, setError] = useState("");
  const inspect = async (form?: HTMLFormElement) => { const values = form ? new FormData(form) : new FormData(); const query = new URLSearchParams(); for (const key of ["scopeId", "capabilityAddressId"]) { const value = String(values.get(key) ?? "").trim(); if (value) query.set(key, value); } const response = await fetch(`/api/admin/capabilities/inspector?${query}`); const body = await response.json() as typeof result & { error?: string }; if (!response.ok) { setError(body?.error ?? "Inspection failed."); return; } setResult(body); setError(""); };
  return <section className="card"><h2>Event & Projection Inspector</h2><p>Read-only ledger ordering and projection rebuild comparison.</p><form className="form-grid" onSubmit={(event) => { event.preventDefault(); void inspect(event.currentTarget); }}><label>Scope ID<input name="scopeId" /></label><label>Address ID<input name="capabilityAddressId" /></label><button className="button button--gold">Compare Rebuild</button></form>{error && <p className="notice notice--warn">{error}</p>}{result && <><p className={result.comparison.mismatches.length ? "notice notice--warn" : "notice notice--success"}>Ledger {result.comparison.eventCount} · persisted {result.comparison.persistedStateCount} · rebuilt {result.comparison.rebuiltStateCount} · mismatches {result.comparison.mismatches.length}</p><table className="simple-table"><thead><tr><th>Sequence</th><th>Scope</th><th>Operation</th><th>Event</th></tr></thead><tbody>{result.events.map((event) => <tr key={event.capabilityEventId}><td>{event.sequence}</td><td>{event.scopeType}/{event.scopeId}</td><td>{event.operation}</td><td>{event.capabilityEventId}</td></tr>)}</tbody></table></>}</section>;
}

export function CapabilityAdminPage({ pathname, screen }: { pathname: string; screen: PageManifestEntry }) {
  const resource = useJsonResource<{ definitions: CapabilityDefinitionView[] }>("/api/admin/capabilities");
  const definitions = useMemo(() => resource.data?.definitions ?? [], [resource.data]);
  const selectedId = pathname.split("/")[3];
  const selected = useMemo(() => definitions.find((definition) => definition.capabilityDefinitionId === selectedId), [definitions, selectedId]);
  let content;
  if (screen.screenId === "CAP03") content = <ConditionBuilder definitions={definitions} />;
  else if (screen.screenId === "CAP04") content = <ScoringPolicies />;
  else if (screen.screenId === "CAP05") content = <Inspector />;
  else if (screen.screenId === "CAP02") content = <VersionEditor definition={selected} reload={resource.reload} />;
  else content = <Registry definitions={definitions} />;
  return <><CapabilityTabs />{resource.loading && screen.screenId !== "CAP04" && screen.screenId !== "CAP05" ? <p className="notice">Loading capability authority…</p> : resource.error ? <p className="notice notice--warn">{resource.error}</p> : content}</>;
}
