import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { AtlasGlobe } from "../../components/AtlasGlobe";
import { AtlasMapViewport, siteClassificationPresentation } from "../../components/AtlasMapViewport";
import { DataTable, type DataTableColumnDef } from "../../components/DataTable";
import { managedAssetUrl } from "../../content/managed-assets";
import type { PageManifestEntry } from "../../lib/page-manifest";
import { WorldKey, type WorldKey as WorldKeyValue } from "../../generated/prisma/enums";
import type { AtlasCatalogProjection, ProjectedPointOfInterest, ProjectedSettlementSite } from "../../server/atlas";
import { SettlementAdminPage } from "./SettlementAdminPage";

const poiColumns: DataTableColumnDef<ProjectedPointOfInterest>[] = [
  { accessorFn: (point) => point.displayName ?? point.workingLabel, id: "name", header: "Name" },
  { accessorKey: "poiId", header: "POI ID" },
  { accessorKey: "displayName", header: "Display name" },
  { accessorKey: "workingLabel", header: "Working label" },
  { accessorKey: "nameStatus", header: "Status" },
  { accessorKey: "category", header: "Category" },
  { accessorKey: "regionId", header: "Region" },
  { accessorKey: "latticeId", header: "Derived lattice" },
  { accessorKey: "longitude", header: "Longitude" },
  { accessorKey: "latitude", header: "Latitude" },
];

const siteClassifications = ["HAMLET", "VILLAGE", "TOWN", "CITY", "METROPOLIS"] as const;
const atlasRegions = Array.from({ length: 25 }, (_, index) => `R${String(index + 1).padStart(2, "0")}`);

interface SettlementOccupancy {
  settlement: { classification: string; name: string | null; settlementId: string; site: { latitude: number; longitude: number; regionId: string; siteId: string } };
  settlementWorldId: string;
  totalPopulation: number;
  worldKey: WorldKeyValue;
}

type SiteWorkspaceRow = ProjectedSettlementSite & { occupancy: "CANDIDATE" | "FOUNDED"; settlementName: string | null; settlementId: string | null };

async function loadAtlas(): Promise<AtlasCatalogProjection> {
  const response = await fetch("/api/atlas/catalog");
  if (!response.ok) throw new Error("The validated R09 Atlas catalog could not be loaded.");
  return response.json() as Promise<AtlasCatalogProjection>;
}

const currentAtlasWorldKey = "echoes.admin.atlas.current-world";

function initialAtlasWorld(): WorldKeyValue | "" {
  if (typeof window === "undefined") return "";
  const value = window.sessionStorage.getItem(currentAtlasWorldKey);
  return Object.values(WorldKey).includes(value as WorldKeyValue) ? value as WorldKeyValue : "";
}

function AtlasStatus({ children }: { children: string }) {
  return <p className="notice notice--warn" role="status">{children}</p>;
}

function PoiDetail({ atlas, selectedId }: { atlas: AtlasCatalogProjection; selectedId?: string }) {
  if (!selectedId) return <aside className="card"><h2>Point of Interest details</h2><p>Select a Point of Interest from the map or table.</p></aside>;
  const point = atlas.pointsOfInterest.find((candidate) => candidate.poiId === selectedId);
  if (!point) return <AtlasStatus>The selected Point of Interest is not present in the canonical catalog.</AtlasStatus>;
  return <aside className="card"><p className="kicker">{atlas.releaseId}</p><h2>Selected Point of Interest</h2><p><strong>{point.poiId} · {point.displayName ?? point.workingLabel}</strong></p><dl className="detail-list"><dt>Name status</dt><dd>{point.nameStatus}</dd><dt>Kind</dt><dd>{point.category}</dd><dt>Region</dt><dd>{point.regionId}</dd><dt>Derived lattice</dt><dd>{point.latticeId}</dd><dt>Longitude</dt><dd>{point.longitude}</dd><dt>Latitude</dt><dd>{point.latitude}</dd></dl><a className="button button--gold" href={`/admin/data/pointofinterest/${encodeURIComponent(point.poiId)}`}>Open record</a></aside>;
}

function PoiAtlas({ atlas, globe }: { atlas: AtlasCatalogProjection; globe: boolean }) {
  const [selectedId, setSelectedId] = useState<string>();
  return <><div className="tabs"><a className={!globe ? "active" : ""} href="/admin/atlas/pois?state=ATLAS_POI_2D">2D Map</a><a className={globe ? "active" : ""} href="/admin/atlas/pois?state=ATLAS_POI_3D">3D Globe</a></div><div className="atlas-layout"><section>{globe ? <AtlasGlobe onSelect={setSelectedId} points={atlas.pointsOfInterest} selectedId={selectedId} /> : <AtlasMapViewport imageAlt="Eidolon world map" imageSrc={managedAssetUrl("atlas.official-world-founding-cities")} onSelect={setSelectedId} points={atlas.pointsOfInterest.map((point) => ({ id: point.poiId, label: `Select ${point.displayName ?? point.workingLabel}`, latitude: point.latitude, longitude: point.longitude }))} selectedId={selectedId} />}</section><PoiDetail atlas={atlas} selectedId={selectedId} /></div><section className="card"><DataTable columns={poiColumns} data={atlas.pointsOfInterest} getRowId={(point) => point.poiId} onRowActivate={(point) => setSelectedId(point.poiId)} preferenceKey="admin.atlas.points-of-interest" rowClassName={(point) => point.poiId === selectedId ? "selected-row" : undefined} /></section><p className="notice">{atlas.pointsOfInterest.length} canonical Points of Interest · {atlas.coordinateReferenceSystem} · {atlas.releaseId}</p></>;
}

function Sites({ atlas }: { atlas: AtlasCatalogProjection }) {
  const [worldKey, setWorldKey] = useState<WorldKeyValue | "">(initialAtlasWorld);
  const [selectedId, setSelectedId] = useState<string>();
  const [classification, setClassification] = useState("");
  const [regionId, setRegionId] = useState("");
  const [occupancyFilter, setOccupancyFilter] = useState<"ALL" | "CANDIDATE" | "FOUNDED">("ALL");
  const [siteSearch, setSiteSearch] = useState("");
  const occupancy = useQuery({
    enabled: Boolean(worldKey),
    queryKey: ["atlas", "settlement-occupancy", worldKey],
    queryFn: async () => {
      const response = await fetch(`/api/admin/settlements/?world=${worldKey}`);
      const result = await response.json() as { error?: string; settlements?: SettlementOccupancy[] };
      if (!response.ok || !result.settlements) throw new Error(result.error ?? "Settlement occupancy could not be loaded.");
      return result.settlements;
    },
  });
  const occupancyBySite = new Map((occupancy.data ?? []).map((entry) => [entry.settlement.site.siteId, entry]));
  const rows: SiteWorkspaceRow[] = atlas.settlementSites.map((site) => {
    const founded = occupancyBySite.get(site.siteId);
    return { ...site, occupancy: founded ? "FOUNDED" : "CANDIDATE", settlementId: founded?.settlement.settlementId ?? null, settlementName: founded?.settlement.name ?? null };
  });
  const filtered = rows.filter((site) => (!classification || site.classification === classification)
    && (!regionId || site.regionId === regionId)
    && (occupancyFilter === "ALL" || site.occupancy === occupancyFilter)
    && (!siteSearch.trim() || site.siteId.toLocaleLowerCase().includes(siteSearch.trim().toLocaleLowerCase())));
  const selected = rows.find((site) => site.siteId === selectedId);
  const selectedOccupancy = selected ? occupancyBySite.get(selected.siteId) : undefined;
  const selectWorld = (next: WorldKeyValue | "") => { setSelectedId(undefined); setWorldKey(next); if (next) window.sessionStorage.setItem(currentAtlasWorldKey, next); else window.sessionStorage.removeItem(currentAtlasWorldKey); };
  const siteColumns: DataTableColumnDef<SiteWorkspaceRow>[] = [
    { accessorKey: "siteId", header: "Site" }, { accessorKey: "regionId", header: "Region" }, { accessorKey: "latticeId", header: "Derived lattice" },
    { accessorKey: "classification", header: "Candidate classification" }, { accessorKey: "occupancy", header: "Occupancy" }, { accessorKey: "settlementName", header: "Settlement name" },
    { accessorKey: "settlementId", header: "Settlement ID" }, { accessorKey: "longitude", header: "Longitude" }, { accessorKey: "latitude", header: "Latitude" },
  ];
  const clearFilters = () => { setSelectedId(undefined); setClassification(""); setRegionId(""); setOccupancyFilter("ALL"); setSiteSearch(""); };
  const searchMatches = siteSearch.trim() ? filtered.slice(0, 10) : [];
  return <><section className="card stack"><h2>Atlas Site workspace</h2><div className="form-grid"><label className="field">Current World context<select className="select" value={worldKey} onChange={(event) => selectWorld(event.target.value as WorldKeyValue | "")}><option value="">Select current World</option>{Object.values(WorldKey).map((world) => <option key={world}>{world}</option>)}</select></label><label className="field">Search Site ID<input className="input" placeholder="SITE-0243 or SITE-0401" type="search" value={siteSearch} onChange={(event) => { setSelectedId(undefined); setSiteSearch(event.target.value); }} /></label><label className="field">Candidate classification<select className="select" value={classification} onChange={(event) => { setSelectedId(undefined); setClassification(event.target.value); }}><option value="">All classifications</option>{siteClassifications.map((value) => <option key={value}>{value}</option>)}</select></label><label className="field">Region<select className="select" value={regionId} onChange={(event) => { setSelectedId(undefined); setRegionId(event.target.value); }}><option value="">All regions</option>{atlasRegions.map((value) => <option key={value}>{value}</option>)}</select></label><label className="field">Occupancy<select className="select" disabled={!worldKey} value={occupancyFilter} onChange={(event) => { setSelectedId(undefined); setOccupancyFilter(event.target.value as typeof occupancyFilter); }}><option value="ALL">All occupancy states</option><option value="CANDIDATE">Candidate / unoccupied</option><option value="FOUNDED">Founded Settlement</option></select></label><label className="field">Base morphology<select className="select" disabled><option>Unavailable in active Site read model</option></select><small>Requires the approved Atlas Capability Reclassification field/import; no morphology is inferred.</small></label></div><div className="action-row"><button className="button" onClick={clearFilters} type="button">Clear Atlas filters</button><span className="tag">{filtered.length} of {rows.length} Sites</span></div>{searchMatches.length > 0 && <div aria-label="Site search results" className="lookup-option-list">{searchMatches.map((site) => <button className="lookup-option" key={site.siteId} onClick={() => setSelectedId(site.siteId)} type="button"><strong>{site.siteId}</strong><small>{site.regionId} · {site.classification} · {site.occupancy}</small></button>)}</div>}<div aria-label="Settlement classification legend" className="atlas-site-legend">{siteClassifications.map((value) => <span key={value}><i aria-hidden style={{ background: siteClassificationPresentation[value].color, width: `${12 * siteClassificationPresentation[value].relativeMarkerSize}px`, height: `${12 * siteClassificationPresentation[value].relativeMarkerSize}px` }} />{value}</span>)}</div><p>Physical Sites remain world-independent. Current World controls only the persisted Settlement occupancy overlay and Found City eligibility.</p></section>{occupancy.error && <p className="notice notice--bad" role="alert">{occupancy.error.message}</p>}<div className="atlas-layout"><AtlasMapViewport imageAlt="Official Eidolon settlement map" imageSrc={managedAssetUrl("atlas.official-world-founding-cities")} onSelect={setSelectedId} points={filtered.map((site) => ({ classification: site.classification, id: site.siteId, label: site.occupancy === "FOUNDED" ? `${site.settlementName ?? "Unnamed Settlement"} — ${site.siteId}` : `Select ${site.siteId}`, latitude: site.latitude, longitude: site.longitude, occupied: site.occupancy === "FOUNDED" }))} selectedId={selectedId} /><aside className="card"><h2>Selected Site</h2>{selected ? <><dl className="detail-list"><dt>Site</dt><dd>{selected.siteId}</dd><dt>Region</dt><dd>{selected.regionId}</dd><dt>Candidate classification</dt><dd>{selected.classification}</dd><dt>Current World</dt><dd>{worldKey || "Not selected"}</dd><dt>Occupancy</dt><dd>{selected.occupancy}</dd>{selectedOccupancy && <><dt>Settlement</dt><dd>{selectedOccupancy.settlement.name ?? "Unnamed Settlement"}</dd><dt>Settlement ID</dt><dd>{selectedOccupancy.settlement.settlementId}</dd><dt>Settlement classification</dt><dd>{selectedOccupancy.settlement.classification}</dd></>}</dl><a aria-disabled={!worldKey || Boolean(selectedOccupancy)} className="button button--gold" href={worldKey && !selectedOccupancy ? `/admin/atlas/sites/${encodeURIComponent(selected.siteId)}` : undefined}>{selectedOccupancy ? "Already founded" : "Found City"}</a></> : <p>Select a Site from the map, search results, or table.</p>}</aside></div><section className="card"><DataTable columns={siteColumns} data={filtered} getRowId={(site) => site.siteId} onRowActivate={(site) => setSelectedId(site.siteId)} preferenceKey="admin.atlas.sites" rowClassName={(site) => site.siteId === selectedId ? "selected-row" : undefined} /></section><p className="notice">{filtered.length} visible physical Sites · {occupancyBySite.size} founded in {worldKey || "no selected World"} · {atlas.releaseId}</p></>;
}

interface FoundingOrigin {
  latestYear: number;
  populations: Array<{ breedId: string; name: string; population: number }>;
  settlement: { name: string | null; settlementId: string };
  settlementWorldId: string;
}

function FoundCity({ pathname }: { pathname?: string }) {
  const siteId = pathname?.match(/^\/admin\/atlas\/sites\/([^/]+)$/)?.[1] ?? "";
  const [worldKey] = useState<WorldKeyValue | "">(initialAtlasWorld);
  const [origins, setOrigins] = useState<FoundingOrigin[]>([]);
  const [originId, setOriginId] = useState("");
  const [breedId, setBreedId] = useState("");
  const [amount, setAmount] = useState(0);
  const [year, setYear] = useState(2000);
  const [departures, setDepartures] = useState<Array<{ amount: number; breedId: string; originSettlementWorldId: string }>>([]);
  const [founding, setFounding] = useState<{ promptText: string; promptVersionId: string; settlementId: string; totalArriving: number; totalDeparting: number }>();
  const [rawResponse, setRawResponse] = useState("");
  const [promptTextResultId, setPromptTextResultId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const totalDeparting = departures.reduce((sum, row) => sum + row.amount, 0);
  const totalArriving = Math.ceil(totalDeparting * 0.9);
  useEffect(() => {
    if (!worldKey) return;
    void fetch(`/api/admin/settlements/?world=${worldKey}`).then(async (response) => {
      const result = await response.json() as { error?: string; settlements?: FoundingOrigin[] };
      if (response.ok && result.settlements) setOrigins(result.settlements);
      else setMessage(result.error ?? "Current-world origins could not be loaded.");
    });
  }, [worldKey]);
  const selectedOrigin = origins.find((origin) => origin.settlementWorldId === originId);
  const selectedPopulation = selectedOrigin?.populations.find((row) => row.breedId === breedId)?.population ?? 0;
  const addDeparture = () => {
    if (!originId || !breedId || !Number.isSafeInteger(amount) || amount < 1 || amount > selectedPopulation) return;
    setDepartures((current) => [...current.filter((row) => !(row.originSettlementWorldId === originId && row.breedId === breedId)), { amount, breedId, originSettlementWorldId: originId }]);
    setAmount(0);
  };
  const found = async () => {
    setBusy(true); setMessage("");
    const response = await fetch("/api/admin/settlements/found-city", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ departures, siteId, worldKey, year }) });
    const result = await response.json() as { error?: string; promptText?: string; promptVersionId?: string; settlementId?: string; totalArriving?: number; totalDeparting?: number };
    setBusy(false);
    if (!response.ok || !result.promptText || !result.promptVersionId || !result.settlementId) setMessage(result.error ?? "Found City failed atomically.");
    else setFounding(result as NonNullable<typeof founding>);
  };
  const validate = async () => {
    setBusy(true); setMessage("");
    const response = await fetch("/api/admin/settlements/complete-naming", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ promptVersionId: founding!.promptVersionId, rawResponse }) });
    const result = await response.json() as { error?: string; promptTextResultId?: string };
    setBusy(false);
    if (!response.ok || !result.promptTextResultId) setMessage(result.error ?? "Naming response did not validate.");
    else { setPromptTextResultId(result.promptTextResultId); setMessage("Response validated. Review it, then apply names."); }
  };
  const apply = async () => {
    setBusy(true); setMessage("");
    const response = await fetch("/api/admin/settlements/apply-naming", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ promptTextResultId }) });
    const result = await response.json() as { error?: string; settlementId?: string };
    setBusy(false);
    setMessage(response.ok ? `Names applied atomically to ${result.settlementId}.` : result.error ?? "Names were not applied.");
  };
  const departureColumns: DataTableColumnDef<(typeof departures)[number]>[] = [
    { accessorFn: (row) => origins.find((origin) => origin.settlementWorldId === row.originSettlementWorldId)?.settlement.name ?? "Unnamed settlement", header: "Origin settlement", id: "originName" },
    { accessorKey: "originSettlementWorldId", header: "Origin SettlementWorld ID" },
    { accessorKey: "breedId", header: "Breed ID" },
    { accessorKey: "amount", header: "Full departure" },
  ];
  if (!worldKey) return <section className="card"><h2>Current World required</h2><p>Return to the Site workspace and select the current World before opening Found City.</p><a className="button" href="/admin/atlas/sites">Back to Sites</a></section>;
  return <div className="stack"><section className="card"><p className="kicker">FOUND CITY · {siteId}</p><h2>Found a city in {worldKey}</h2><p>Current World context is inherited from the Site workspace. This modal has no independent World selector and cannot perform cross-world migration.</p><label className="field">Founding year<input className="input" min={0} max={4040} type="number" value={year} onChange={(event) => setYear(Number(event.target.value))} /></label></section>{!founding ? <><section className="card form-grid"><h2 className="span-2">Breed departures</h2><label className="field">Origin<select className="select" value={originId} onChange={(event) => { setOriginId(event.target.value); setBreedId(""); }}><option value="">Select current-world origin</option>{origins.map((origin) => <option key={origin.settlementWorldId} value={origin.settlementWorldId}>{origin.settlement.name ?? "Naming pending"} · {origin.settlement.settlementId} · {origin.settlementWorldId}</option>)}</select></label><label className="field">Breed<select className="select" value={breedId} onChange={(event) => setBreedId(event.target.value)}><option value="">Select Breed</option>{selectedOrigin?.populations.map((row) => <option key={row.breedId} value={row.breedId}>{row.name} · {row.breedId} · {row.population.toLocaleString()} projected</option>)}</select></label><label className="field">Full departure population<input className="input" min={1} max={selectedPopulation || undefined} type="number" value={amount} onChange={(event) => setAmount(Number(event.target.value))} /></label><button className="button" disabled={!originId || !breedId || amount < 1 || amount > selectedPopulation} onClick={addDeparture}>Add Breed departure</button></section><section className="card"><h2>Founding preview</h2><DataTable columns={departureColumns} data={departures} getRowId={(row) => `${row.originSettlementWorldId}:${row.breedId}`} preferenceKey="admin.atlas.founding-departures" />{departures.length > 0 && <><p><strong>{totalDeparting.toLocaleString()} full departures · {totalArriving.toLocaleString()} destination arrivals · {(totalDeparting - totalArriving).toLocaleString()} founding transit loss.</strong></p><p className="muted">The server apportions the integer 90% arrival total across Breed rows by the canonical largest-remainder rule.</p></>}<button className="button button--gold" disabled={busy || departures.length === 0 || !Number.isSafeInteger(year)} onClick={() => void found()}>{busy ? "Founding atomically…" : "Commit Founding"}</button></section></> : <><section className="card"><h2>Naming handoff</h2><p className="notice notice--good">Naming prompt ready. Click this button to copy it.</p><button className="button button--gold" onClick={() => void navigator.clipboard.writeText(founding.promptText)}>Copy Naming Prompt</button><p>{founding.totalDeparting.toLocaleString()} departed · {founding.totalArriving.toLocaleString()} arrived · {(founding.totalDeparting - founding.totalArriving).toLocaleString()} founding transit loss.</p><details><summary>Exact persisted PromptVersion text</summary><pre className="prompt-preview">{founding.promptText}</pre></details></section><section className="card"><h2>Paste naming response</h2><textarea aria-label="Naming response JSON" className="textarea" value={rawResponse} onChange={(event) => { setRawResponse(event.target.value); setPromptTextResultId(""); }} /><div className="action-row"><button className="button" disabled={busy || !rawResponse.trim()} onClick={() => void validate()}>Validate Response</button><button className="button button--gold" disabled={busy || !promptTextResultId} onClick={() => void apply()}>Apply Names</button></div></section></>}{message && <p className={`notice ${message.includes("applied atomically") || message.startsWith("Response validated") ? "notice--good" : "notice--bad"}`} role="status">{message}</p>}</div>;
}

type AtlasView = "found-city" | "migrate" | "overview" | "poi-2d" | "poi-3d" | "settlements" | "sites";

function AtlasCatalogPage({ pathname, view }: { pathname?: string; view: AtlasView }) {
  const atlas = useQuery({ queryKey: ["atlas", "catalog", "R09"], queryFn: loadAtlas, retry: false });
  if (atlas.isPending) return <p className="notice">Validating the R09 Atlas release…</p>;
  if (atlas.isError) return <p className="notice notice--bad" role="alert">{atlas.error.message}</p>;
  if (view === "poi-2d" || view === "poi-3d") return <PoiAtlas atlas={atlas.data} globe={view === "poi-3d"} />;
  if (view === "sites") return <Sites atlas={atlas.data} />;
  if (view === "found-city") return <FoundCity pathname={pathname} />;
  if (view === "settlements") return <SettlementAdminPage migrate={false} />;
  if (view === "migrate") return <SettlementAdminPage migrate />;
  return <div className="grid-3"><a className="card" href="/admin/atlas/pois"><h2>Points of Interest</h2><p>{atlas.data.pointsOfInterest.length} canonical R09 records.</p></a><a className="card" href="/admin/atlas/sites"><h2>Sites</h2><p>{atlas.data.settlementSites.length} canonical R09 candidates.</p></a><article className="card"><h2>Region Mapping and topology</h2><p>{atlas.data.regionMappings.length} locked mappings · {atlas.data.connections.length} locked Lattice connections. Lattice values are derived at read time.</p></article></div>;
}

export function AtlasAdminPage({ pathname, screen }: { pathname?: string; screen: PageManifestEntry }) {
  if (["AT002", "ADM032", "ATLAS_POI_2D"].includes(screen.screenId)) return <AtlasCatalogPage view="poi-2d" />;
  if (["AT003", "ATLAS_POI_3D"].includes(screen.screenId)) return <AtlasCatalogPage view="poi-3d" />;
  if (["AT004", "ADM033"].includes(screen.screenId)) return <AtlasCatalogPage view="sites" />;
  if (screen.screenId === "AT004_FOUND_CITY") return <AtlasCatalogPage pathname={pathname} view="found-city" />;
  if (screen.screenId === "AT005_SETTLEMENT_DETAIL") return <AtlasCatalogPage view="migrate" />;
  if (["AT005", "ADM034"].includes(screen.screenId)) return <AtlasCatalogPage view="settlements" />;
  if (screen.screenId === "ADM031") return <AtlasCatalogPage view="overview" />;
  return <section className="card"><h2>Atlas workflow unavailable</h2><p>No Atlas workflow is inferred for this screen.</p></section>;
}
