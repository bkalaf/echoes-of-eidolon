import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import type { PageManifestEntry } from "../../lib/page-manifest";

interface SettlementWorldSummary {
  settlement: {
    classification: string;
    name: string | null;
    settlementId: string;
    site: { regionId: string; siteId: string };
  };
  settlementWorldId: string;
  worldKey: string;
}

interface GeometryRecord { geometry: unknown }
interface ParcelView extends GeometryRecord { parcelId: string }
interface StreetView extends GeometryRecord { streetId: string }
interface BuildingView extends GeometryRecord { buildingId: string; parcelId: string | null }

interface CityProject {
  buildings: BuildingView[];
  cityId: string;
  geometryVersion: number;
  name: string;
  parcels: ParcelView[];
  settlementWorld: SettlementWorldSummary;
  streets: StreetView[];
}

interface CityProjectIndex {
  availableSettlementWorlds: SettlementWorldSummary[];
  cities: CityProject[];
}

async function responseJson<T>(response: Response, fallback: string): Promise<T> {
  const result = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(result.error ?? fallback);
  return result;
}

function cityIdFromPath(pathname: string): string | undefined {
  const match = pathname.match(/^\/admin\/cities\/([^/]+)\//);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

function CityProjectList() {
  const client = useQueryClient();
  const [message, setMessage] = useState("");
  const projects = useQuery({
    queryKey: ["admin", "city-projects"],
    queryFn: async () => responseJson<CityProjectIndex>(await fetch("/api/admin/cities/"), "City projects could not be loaded."),
    retry: false,
  });
  const create = async (settlementWorldId: string) => {
    setMessage("");
    try {
      await responseJson(await fetch("/api/admin/cities/", { body: JSON.stringify({ settlementWorldId }), headers: { "content-type": "application/json" }, method: "POST" }), "City project could not be created.");
      setMessage("City geometry project created from the canonical SettlementWorld.");
      await client.invalidateQueries({ queryKey: ["admin", "city-projects"] });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "City project could not be created.");
    }
  };

  if (projects.isPending) return <p className="notice">Loading City geometry projects…</p>;
  if (projects.isError) return <p className="notice notice--bad" role="alert">{projects.error.message}</p>;
  return <div className="stack"><section className="card"><h2>Canonical City geometry projects</h2><p>Each project is owned by one persisted SettlementWorld. Parcel, street, and building edits share one City geometry version.</p>{projects.data.cities.length === 0 ? <p>No City geometry projects exist.</p> : <div className="table-scroll"><table className="simple-table"><thead><tr><th>City</th><th>World</th><th>Region</th><th>Version</th><th>Geometry records</th><th /></tr></thead><tbody>{projects.data.cities.map((city) => <tr key={city.cityId}><td>{city.name}</td><td>{city.settlementWorld.worldKey}</td><td>{city.settlementWorld.settlement.site.regionId}</td><td>{city.geometryVersion}</td><td>{city.parcels.length} parcels · {city.streets.length} streets · {city.buildings.length} buildings</td><td><a href={`/admin/cities/${encodeURIComponent(city.cityId)}/streets`}>Open</a></td></tr>)}</tbody></table></div>}</section><section className="card"><h2>Available named Settlements</h2><p>Create the single City project for a named SettlementWorld. The City name is copied from that canonical Settlement record.</p>{projects.data.availableSettlementWorlds.length === 0 ? <p>No eligible SettlementWorld records are available.</p> : <div className="table-scroll"><table className="simple-table"><thead><tr><th>Settlement</th><th>World</th><th>Region</th><th /></tr></thead><tbody>{projects.data.availableSettlementWorlds.map((world) => <tr key={world.settlementWorldId}><td>{world.settlement.name ?? "Naming required"}</td><td>{world.worldKey}</td><td>{world.settlement.site.regionId}</td><td><button className="button" disabled={!world.settlement.name} onClick={() => void create(world.settlementWorldId)}>Create geometry project</button></td></tr>)}</tbody></table></div>}{message && <p className={`notice ${message.startsWith("City geometry") ? "notice--good" : "notice--bad"}`} role="status">{message}</p>}</section></div>;
}

function GeometryEditor({ action, city, idLabel, idValue, parcelValue }: { action: "upsertBuilding" | "upsertParcel" | "upsertStreet"; city: CityProject; idLabel: string; idValue?: string; parcelValue?: string | null }) {
  const client = useQueryClient();
  const [identifier, setIdentifier] = useState(idValue ?? "");
  const [parcelId, setParcelId] = useState(parcelValue ?? "");
  const [geometry, setGeometry] = useState("{}");
  const [message, setMessage] = useState("");
  const save = async () => {
    setMessage("");
    try {
      const parsed = JSON.parse(geometry) as unknown;
      if (parsed === null || typeof parsed !== "object") throw new Error("Geometry must be a JSON object or array.");
      const idKey = action === "upsertParcel" ? "parcelId" : action === "upsertStreet" ? "streetId" : "buildingId";
      const payload = action === "upsertBuilding"
        ? { action, buildingId: identifier, geometry: parsed, parcelId: parcelId || null }
        : { action, [idKey]: identifier, geometry: parsed };
      await responseJson(await fetch(`/api/admin/cities/${encodeURIComponent(city.cityId)}`, { body: JSON.stringify(payload), headers: { "content-type": "application/json" }, method: "PUT" }), "Geometry could not be saved.");
      setMessage(`${idLabel} geometry saved. City geometry version advanced.`);
      await client.invalidateQueries({ queryKey: ["admin", "city-project", city.cityId] });
      await client.invalidateQueries({ queryKey: ["admin", "city-projects"] });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Geometry could not be saved.");
    }
  };
  return <section className="card form-grid"><h3 className="span-2">Add or update {idLabel}</h3><label className="field">{idLabel} ID<input className="input" value={identifier} onChange={(event) => setIdentifier(event.target.value)} /></label>{action === "upsertBuilding" && <label className="field">Parcel<select className="input" value={parcelId} onChange={(event) => setParcelId(event.target.value)}><option value="">No parcel association</option>{city.parcels.map((parcel) => <option key={parcel.parcelId}>{parcel.parcelId}</option>)}</select></label>}<label className="field span-2">Canonical geometry JSON<textarea className="input code-input" rows={8} value={geometry} onChange={(event) => setGeometry(event.target.value)} /></label><p className="muted span-2">The repository defines the persisted geometry owner but no narrower coordinate/shape schema. This editor preserves authored JSON without inventing geometry fields.</p><button className="button button--gold" disabled={!identifier.trim()} onClick={() => void save()}>Save geometry</button>{message && <p className={`notice span-2 ${message.includes("saved") ? "notice--good" : "notice--bad"}`} role="status">{message}</p>}</section>;
}

function GeometryTable({ records, type }: { records: Array<BuildingView | ParcelView | StreetView>; type: "Building" | "Parcel" | "Street" }) {
  const recordId = (record: BuildingView | ParcelView | StreetView) => type === "Building" ? (record as BuildingView).buildingId : type === "Parcel" ? (record as ParcelView).parcelId : (record as StreetView).streetId;
  return <section className="card"><h3>{type}s</h3>{records.length === 0 ? <p>No {type.toLowerCase()} geometry is stored.</p> : <div className="table-scroll"><table className="simple-table"><thead><tr><th>ID</th>{type === "Building" && <th>Parcel</th>}<th>Geometry</th></tr></thead><tbody>{records.map((record) => <tr key={recordId(record)}><td>{recordId(record)}</td>{type === "Building" && <td>{(record as BuildingView).parcelId ?? "Unassigned"}</td>}<td><code>{JSON.stringify(record.geometry)}</code></td></tr>)}</tbody></table></div>}</section>;
}

function CityProjectDetail({ pathname, screen }: { pathname: string; screen: PageManifestEntry }) {
  const cityId = cityIdFromPath(pathname);
  const project = useQuery({
    queryKey: ["admin", "city-project", cityId],
    enabled: Boolean(cityId),
    queryFn: async () => responseJson<{ city: CityProject }>(await fetch(`/api/admin/cities/${encodeURIComponent(cityId!)}`), "City project could not be loaded."),
    retry: false,
  });
  if (!cityId) return <p className="notice notice--bad" role="alert">The route does not identify a City project.</p>;
  if (project.isPending) return <p className="notice">Loading City geometry…</p>;
  if (project.isError) return <p className="notice notice--bad" role="alert">{project.error.message}</p>;
  const city = project.data.city;
  const links = <nav className="tabs" aria-label="City Builder views"><a href={`/admin/cities/${encodeURIComponent(city.cityId)}/streets`}>Parcels & streets</a><a href={`/admin/cities/${encodeURIComponent(city.cityId)}/exteriors`}>Buildings</a><a href={`/admin/cities/${encodeURIComponent(city.cityId)}/interiors`}>Interiors</a><a href={`/admin/cities/${encodeURIComponent(city.cityId)}/preview`}>Preview</a></nav>;
  if (screen.screenId === "CITY02") return <div className="stack">{links}<section className="card"><h2>{city.name} · geometry v{city.geometryVersion}</h2><p>Parcel and street graph records share this canonical City owner.</p></section><div className="split-grid"><GeometryTable records={city.parcels} type="Parcel" /><GeometryTable records={city.streets} type="Street" /></div><div className="split-grid"><GeometryEditor action="upsertParcel" city={city} idLabel="Parcel" /><GeometryEditor action="upsertStreet" city={city} idLabel="Street" /></div></div>;
  if (screen.screenId === "CITY03") return <div className="stack">{links}<section className="card"><h2>{city.name} · building geometry</h2><p>Buildings may reference an existing Parcel in this City. Exterior renders, frontage, entrances, and occupancy shapes are not inferred from the generic geometry record.</p></section><GeometryTable records={city.buildings} type="Building" /><GeometryEditor action="upsertBuilding" city={city} idLabel="Building" /></div>;
  if (screen.screenId === "CITY04") return <div className="stack">{links}<section className="card"><h2>{city.name} · interiors unavailable</h2><p className="notice notice--warn">No canonical Interior, Room, Passage, floor, or reachability model exists in the supplied repository authority. Building geometry is not repurposed as an interior model.</p></section></div>;
  return <div className="stack">{links}<section className="card"><h2>{city.name} · canonical geometry preview</h2><dl className="detail-list"><dt>Geometry version</dt><dd>{city.geometryVersion}</dd><dt>Parcels</dt><dd>{city.parcels.length}</dd><dt>Streets</dt><dd>{city.streets.length}</dd><dt>Buildings</dt><dd>{city.buildings.length}</dd></dl><p className="notice notice--warn">No canonical district-overlay or rendered 2D/3D output contract exists. The stored structural geometry is reported without pretending this summary is a spatial render.</p></section></div>;
}

export function CityBuilderAdminPage({ pathname, screen }: { pathname: string; screen: PageManifestEntry }) {
  if (["CITY01", "ADM037"].includes(screen.screenId)) return <CityProjectList />;
  if (["CITY02", "CITY03", "CITY04", "CITY05"].includes(screen.screenId)) return <CityProjectDetail pathname={pathname} screen={screen} />;
  return <section className="card"><h2>City Builder unavailable</h2><p>No City Builder workflow is owned for this screen.</p></section>;
}
