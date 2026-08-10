import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { AtlasGlobe } from "../../components/AtlasGlobe";
import { DataTable, type DataTableColumnDef } from "../../components/DataTable";
import { managedAssetUrl } from "../../content/managed-assets";
import type { PageManifestEntry } from "../../lib/page-manifest";
import type { AtlasCatalog, CanonicalPointOfInterest, CanonicalSettlementSite } from "../../server/atlas";

const poiColumns: DataTableColumnDef<CanonicalPointOfInterest>[] = [
  { accessorKey: "poiId", header: "POI" },
  { accessorFn: (point) => point.displayName ?? point.workingLabel, id: "name", header: "Name" },
  { accessorKey: "nameStatus", header: "Status" },
  { accessorKey: "category", header: "Category" },
  { accessorKey: "regionId", header: "Region" },
];

const siteColumns: DataTableColumnDef<CanonicalSettlementSite>[] = [
  { accessorKey: "siteId", header: "Site" },
  { accessorKey: "regionId", header: "Region" },
  { accessorKey: "classification", header: "Classification" },
  { accessorKey: "longitude", header: "Longitude" },
  { accessorKey: "latitude", header: "Latitude" },
];

async function loadAtlas(): Promise<AtlasCatalog> {
  const response = await fetch("/api/atlas/catalog");
  if (!response.ok) throw new Error("The validated R08 Atlas catalog could not be loaded.");
  return response.json() as Promise<AtlasCatalog>;
}

function AtlasStatus({ children }: { children: string }) {
  return <p className="notice notice--warn" role="status">{children}</p>;
}

function PoiDetail({ atlas, selectedId }: { atlas: AtlasCatalog; selectedId?: string }) {
  if (!selectedId) return <aside className="card"><h2>Point of Interest details</h2><p>Select a Point of Interest from the map or table.</p></aside>;
  const point = atlas.pointsOfInterest.find((candidate) => candidate.poiId === selectedId);
  if (!point) return <AtlasStatus>The selected Point of Interest is not present in the canonical catalog.</AtlasStatus>;
  return <aside className="card"><p className="kicker">{atlas.releaseId}</p><h2>Selected Point of Interest</h2><p><strong>{point.poiId} · {point.displayName ?? point.workingLabel}</strong></p><dl className="detail-list"><dt>Name status</dt><dd>{point.nameStatus}</dd><dt>Kind</dt><dd>{point.category}</dd><dt>Region</dt><dd>{point.regionId}</dd><dt>Longitude</dt><dd>{point.longitude}</dd><dt>Latitude</dt><dd>{point.latitude}</dd></dl><a className="button button--gold" href={`/admin/data/pointofinterest/${encodeURIComponent(point.poiId)}`}>Open record</a></aside>;
}

function PoiAtlas({ atlas, globe }: { atlas: AtlasCatalog; globe: boolean }) {
  const [selectedId, setSelectedId] = useState<string>();
  return <><div className="tabs"><a className={!globe ? "active" : ""} href="/admin/atlas/pois?state=ATLAS_POI_2D">2D Map</a><a className={globe ? "active" : ""} href="/admin/atlas/pois?state=ATLAS_POI_3D">3D Globe</a></div><div className="atlas-layout"><section>{globe ? <AtlasGlobe onSelect={setSelectedId} points={atlas.pointsOfInterest} selectedId={selectedId} /> : <div className="map"><img src={managedAssetUrl("atlas.official-world-founding-cities")} alt="Eidolon world map" />{atlas.pointsOfInterest.map((point) => <button aria-label={`Select ${point.displayName ?? point.workingLabel}`} className={`map-data-pin ${point.poiId === selectedId ? "selected" : ""}`} key={point.poiId} onClick={() => setSelectedId(point.poiId)} style={{ left: `${((point.longitude + 180) / 360) * 100}%`, top: `${((90 - point.latitude) / 180) * 100}%` }} />)}</div>}</section><PoiDetail atlas={atlas} selectedId={selectedId} /></div><section className="card"><DataTable columns={poiColumns} data={atlas.pointsOfInterest} getRowId={(point) => point.poiId} onRowActivate={(point) => setSelectedId(point.poiId)} preferenceKey="admin.atlas.points-of-interest" rowClassName={(point) => point.poiId === selectedId ? "selected-row" : undefined} /></section><p className="notice">{atlas.pointsOfInterest.length} canonical Points of Interest · {atlas.coordinateReferenceSystem} · {atlas.releaseId}</p></>;
}

function Sites({ atlas }: { atlas: AtlasCatalog }) {
  return <><section className="card"><DataTable columns={siteColumns} data={atlas.settlementSites} getRowId={(site) => site.siteId} preferenceKey="admin.atlas.sites" /></section><p className="notice">{atlas.settlementSites.length} canonical settlement candidates · {atlas.releaseId}</p></>;
}

type AtlasView = "found-city" | "overview" | "poi-2d" | "poi-3d" | "settlements" | "sites";

function AtlasCatalogPage({ view }: { view: AtlasView }) {
  const atlas = useQuery({ queryKey: ["atlas", "catalog", "R08"], queryFn: loadAtlas, retry: false });
  if (atlas.isPending) return <p className="notice">Validating the R08 Atlas release…</p>;
  if (atlas.isError) return <p className="notice notice--bad" role="alert">{atlas.error.message}</p>;
  if (view === "poi-2d" || view === "poi-3d") return <PoiAtlas atlas={atlas.data} globe={view === "poi-3d"} />;
  if (view === "sites") return <Sites atlas={atlas.data} />;
  if (view === "found-city") return <AtlasStatus>The 90% ceiling and largest-remainder founding rules are specified. City founding remains unavailable until the atomic settlement persistence service is connected.</AtlasStatus>;
  if (view === "settlements") return <AtlasStatus>Settlement persistence and exact Breed-conserving migration require the typed settlement repository.</AtlasStatus>;
  return <div className="grid-3"><a className="card" href="/admin/atlas/pois"><h2>Points of Interest</h2><p>{atlas.data.pointsOfInterest.length} canonical R08 records.</p></a><a className="card" href="/admin/atlas/sites"><h2>Sites</h2><p>{atlas.data.settlementSites.length} canonical R08 candidates.</p></a><article className="card"><h2>Settlements</h2><p>Canonical Site mirrors are read-only until the typed import repository is connected.</p></article></div>;
}

export function AtlasAdminPage({ screen }: { screen: PageManifestEntry }) {
  if (["AT002", "ADM032", "ATLAS_POI_2D"].includes(screen.screenId)) return <AtlasCatalogPage view="poi-2d" />;
  if (["AT003", "ATLAS_POI_3D"].includes(screen.screenId)) return <AtlasCatalogPage view="poi-3d" />;
  if (["AT004", "ADM033"].includes(screen.screenId)) return <AtlasCatalogPage view="sites" />;
  if (screen.screenId === "AT004_FOUND_CITY") return <AtlasCatalogPage view="found-city" />;
  if (["AT005", "ADM034", "AT005_SETTLEMENT_DETAIL"].includes(screen.screenId)) return <AtlasCatalogPage view="settlements" />;
  if (screen.screenId === "ADM031") return <AtlasCatalogPage view="overview" />;
  return <section className="card"><h2>Atlas workflow unavailable</h2><p>No Atlas workflow is inferred for this screen.</p></section>;
}
