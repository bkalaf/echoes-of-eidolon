import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { managedAssetUrl } from "../../content/managed-assets";
import { WorldKey, type WorldKey as WorldKeyValue } from "../../generated/prisma/enums";

interface SettlementWorldView {
  culture: { cultureId: string; name: string } | null;
  dominantBreed: { breedId: string; name: string } | null;
  latestYear: number;
  populations: Array<{ breedId: string; population: number }>;
  settlement: {
    classification: string;
    name: string | null;
    settlementId: string;
    site: { latitude: number; longitude: number; regionId: string; siteId: string };
  };
  settlementWorldId: string;
  totalPopulation: number;
  worldKey: WorldKeyValue;
}

function WorldSelector({ onChange, value }: { onChange: (world: WorldKeyValue | "") => void; value: WorldKeyValue | "" }) {
  return <label className="field">Current world<select className="input" value={value} onChange={(event) => onChange(event.target.value as WorldKeyValue | "")}><option value="">Select the current world</option>{Object.values(WorldKey).map((world) => <option key={world}>{world}</option>)}</select></label>;
}

export function SettlementAdminPage({ migrate }: { migrate: boolean }) {
  const [worldKey, setWorldKey] = useState<WorldKeyValue | "">("");
  const [originId, setOriginId] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [breedId, setBreedId] = useState("");
  const [amount, setAmount] = useState(1);
  const [year, setYear] = useState(0);
  const [message, setMessage] = useState("");
  const settlements = useQuery({
    queryKey: ["admin", "settlements", worldKey],
    enabled: Boolean(worldKey),
    queryFn: async () => {
      const response = await fetch(`/api/admin/settlements/?world=${worldKey}`);
      const result = await response.json() as { error?: string; settlements?: SettlementWorldView[] };
      if (!response.ok || !result.settlements) throw new Error(result.error ?? "Settlements could not be loaded.");
      return result.settlements;
    },
    retry: false,
  });
  const resetSelections = () => { setOriginId(""); setDestinationId(""); setBreedId(""); setMessage(""); };
  const selectWorld = (world: WorldKeyValue | "") => { setWorldKey(world); resetSelections(); };

  if (!migrate) return <div className="stack">
    <section className="card form-grid"><h2>Settlements</h2><WorldSelector onChange={selectWorld} value={worldKey} /><p className="span-2">Browse persisted Settlements in one explicitly selected current world. Population totals are checked against the append-only Breed event ledger.</p></section>
    {settlements.isPending && worldKey && <p className="notice">Loading current-world Settlements…</p>}
    {settlements.isError && <p className="notice notice--bad" role="alert">{settlements.error.message}</p>}
    {settlements.data && <div className="atlas-layout"><div className="map"><img src={managedAssetUrl("atlas.official-world-founding-cities")} alt="Official Eidolon settlement map" />{settlements.data.map((world) => <a aria-label={`Open ${world.settlement.name ?? world.settlement.settlementId}`} className="map-data-pin" href={`/admin/atlas/settlements/${encodeURIComponent(world.settlement.settlementId)}/migrate`} key={world.settlementWorldId} style={{ left: `${((world.settlement.site.longitude + 180) / 360) * 100}%`, top: `${((90 - world.settlement.site.latitude) / 180) * 100}%` }} />)}</div><section className="card"><h2>{worldKey} Settlement records</h2>{settlements.data.length === 0 ? <p>No Settlements exist in this world.</p> : <div className="table-scroll"><table className="simple-table"><thead><tr><th>Settlement</th><th>Region</th><th>Population</th><th>Dominant Breed</th><th>Culture</th><th /></tr></thead><tbody>{settlements.data.map((world) => <tr key={world.settlementWorldId}><td>{world.settlement.settlementId} · {world.settlement.name ?? "Naming pending"}</td><td>{world.settlement.site.regionId}</td><td>{world.totalPopulation.toLocaleString()}</td><td>{world.dominantBreed?.name ?? "None"}</td><td>{world.culture?.name ?? "None"}</td><td><a href={`/admin/atlas/settlements/${encodeURIComponent(world.settlement.settlementId)}/migrate`}>Migrate</a></td></tr>)}</tbody></table></div>}</section></div>}
  </div>;

  const origin = settlements.data?.find((world) => world.settlement.settlementId === originId);
  const destination = settlements.data?.find((world) => world.settlement.settlementId === destinationId);
  const sourcePopulation = origin?.populations.find((row) => row.breedId === breedId)?.population ?? 0;
  const destinationPopulation = destination?.populations.find((row) => row.breedId === breedId)?.population ?? 0;
  const minimumYear = Math.max(origin?.latestYear ?? 0, destination?.latestYear ?? 0);
  const valid = Boolean(worldKey && origin && destination && origin !== destination && breedId && Number.isSafeInteger(amount) && amount > 0 && amount <= sourcePopulation && Number.isSafeInteger(year) && year >= minimumYear && year <= 4040);

  return <section className="card form-grid"><h2 className="span-2">Migrate Breed population</h2><p className="span-2">Move exact Breed counts between two Settlements in the same selected current world. Ordinary migration has zero transit loss.</p><WorldSelector onChange={selectWorld} value={worldKey} /><label className="field">Year<input className="input" min={minimumYear} max={4040} type="number" value={year} onChange={(event) => setYear(Number(event.target.value))} /></label><label className="field">From<select className="input" disabled={!settlements.data} value={originId} onChange={(event) => { const next = event.target.value; setOriginId(next); const selected = settlements.data?.find((world) => world.settlement.settlementId === next); setYear(selected?.latestYear ?? 0); setBreedId(""); }}><option value="">Select origin</option>{settlements.data?.map((world) => <option key={world.settlementWorldId} value={world.settlement.settlementId}>{world.settlement.settlementId} · {world.settlement.name ?? "Naming pending"}</option>)}</select></label><label className="field">To<select className="input" disabled={!origin} value={destinationId} onChange={(event) => setDestinationId(event.target.value)}><option value="">Select destination</option>{settlements.data?.filter((world) => world.settlement.settlementId !== originId).map((world) => <option key={world.settlementWorldId} value={world.settlement.settlementId}>{world.settlement.settlementId} · {world.settlement.name ?? "Naming pending"}</option>)}</select></label><label className="field">Breed<select className="input" disabled={!origin} value={breedId} onChange={(event) => setBreedId(event.target.value)}><option value="">Select origin Breed</option>{origin?.populations.map((row) => <option key={row.breedId} value={row.breedId}>{row.breedId} · {row.population.toLocaleString()} available</option>)}</select></label><label className="field">Population<input className="input" min={1} max={sourcePopulation || undefined} type="number" value={amount} onChange={(event) => setAmount(Number(event.target.value))} /></label>{origin && destination && breedId && <aside className="card span-2"><h3>Migration preview</h3><p>{origin.settlement.name ?? origin.settlement.settlementId}: {sourcePopulation.toLocaleString()} → {(sourcePopulation - amount).toLocaleString()}</p><p>{destination.settlement.name ?? destination.settlement.settlementId}: {destinationPopulation.toLocaleString()} → {(destinationPopulation + amount).toLocaleString()}</p><p>Total {breedId} population is conserved. Transit loss: 0.</p></aside>}<button className="button button--gold" disabled={!valid} onClick={async () => { const response = await fetch("/api/admin/settlements/migrate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ destinationSettlementId: destinationId, originSettlementId: originId, rows: [{ amount, breedId }], worldKey, year }) }); const result = await response.json() as { error?: string }; setMessage(response.ok ? "Migration committed atomically." : result.error ?? "Migration failed."); if (response.ok) await settlements.refetch(); }}>Commit migration</button><a className="button" href="/admin/atlas/settlements">Cancel</a>{settlements.isPending && worldKey && <p className="notice span-2">Loading current-world Settlements…</p>}{settlements.isError && <p className="notice notice--bad span-2" role="alert">{settlements.error.message}</p>}{message && <p className={`notice span-2 ${message.startsWith("Migration committed") ? "notice--good" : "notice--bad"}`} role="status">{message}</p>}</section>;
}
