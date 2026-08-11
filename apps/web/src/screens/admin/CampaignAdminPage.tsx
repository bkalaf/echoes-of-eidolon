import { useQuery } from "@tanstack/react-query";
import { useState, type CSSProperties } from "react";

import {
  campaignLinkedGroups,
  campaignObjectTypes,
  campaignPlacementBookRange,
  type CampaignBookRange,
  type CampaignObjectType,
} from "../../domain/campaign-planner";
import type { PageManifestEntry } from "../../lib/page-manifest";

const campaignWorldScreens = {
  CONCORD: "CAMPAIGN_CONCORD",
  RUIN: "CAMPAIGN_RUIN",
  SCHISM: "CAMPAIGN_SCHISM",
} as const;

interface CampaignPlacementView {
  bookNumbers: number[];
  campaignPlacementId: string;
  objectId: string;
  objectType: string;
}

interface PositionedCampaignPlacement extends CampaignPlacementView, CampaignBookRange {
  lane: number;
  laneCount: number;
  objectType: CampaignObjectType;
}

function campaignWorld(screenId: string): keyof typeof campaignWorldScreens | null {
  return (Object.entries(campaignWorldScreens).find(([, state]) => state === screenId)?.[0]
    ?? null) as keyof typeof campaignWorldScreens | null;
}

function worldTabs(world: keyof typeof campaignWorldScreens | null) {
  return <nav aria-label="Campaign world" className="tabs">{Object.entries(campaignWorldScreens).map(([worldKey, state]) => <a aria-current={world === worldKey ? "page" : undefined} className={world === worldKey ? "active" : ""} href={`/admin/campaign/planner?state=${state}`} key={worldKey}>{worldKey}</a>)}</nav>;
}

function linkedGroupSummary() {
  return campaignLinkedGroups.map((group) => group.required.map((member) => member.count === 1 ? member.objectType : `${member.count} ${member.objectType}`).join(" + ")).join(" · ");
}

function isCampaignObjectType(value: string): value is CampaignObjectType {
  return campaignObjectTypes.some((objectType) => objectType === value);
}

export function positionCampaignPlacements(placements: readonly CampaignPlacementView[]) {
  const invalid: Array<{ campaignPlacementId: string; reason: string }> = [];
  const byType = new Map<CampaignObjectType, Array<CampaignPlacementView & CampaignBookRange>>();

  for (const placement of placements) {
    if (!isCampaignObjectType(placement.objectType)) {
      invalid.push({ campaignPlacementId: placement.campaignPlacementId, reason: "unknown campaign object type" });
      continue;
    }
    try {
      const range = campaignPlacementBookRange(placement.objectType, placement.bookNumbers);
      const group = byType.get(placement.objectType) ?? [];
      group.push({ ...placement, ...range });
      byType.set(placement.objectType, group);
    } catch (error) {
      invalid.push({ campaignPlacementId: placement.campaignPlacementId, reason: error instanceof Error ? error.message : "invalid Book range" });
    }
  }

  const positioned: PositionedCampaignPlacement[] = [];
  for (const objectType of campaignObjectTypes) {
    const group = (byType.get(objectType) ?? []).sort((left, right) =>
      left.startBook - right.startBook || left.endBook - right.endBook || left.campaignPlacementId.localeCompare(right.campaignPlacementId));
    let laneEnds: number[] = [];
    let clusterEnd = 0;
    let cluster: Array<(CampaignPlacementView & CampaignBookRange) & { lane: number; objectType: CampaignObjectType }> = [];
    const flushCluster = () => {
      positioned.push(...cluster.map((placement) => ({ ...placement, laneCount: laneEnds.length })));
      cluster = [];
      laneEnds = [];
    };
    for (const placement of group) {
      if (cluster.length > 0 && placement.startBook > clusterEnd) flushCluster();
      let lane = laneEnds.findIndex((endBook) => endBook < placement.startBook);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = placement.endBook;
      clusterEnd = Math.max(clusterEnd, placement.endBook);
      cluster.push({ ...placement, lane, objectType });
    }
    flushCluster();
  }
  return { invalid, positioned };
}

function placementStyle(placement: PositionedCampaignPlacement): CSSProperties {
  const laneWidth = 100 / placement.laneCount;
  return {
    gridColumn: campaignObjectTypes.indexOf(placement.objectType) + 2,
    gridRow: `${placement.startBook + 1} / span ${placement.rowSpan}`,
    marginLeft: `calc(${placement.lane * laneWidth}% + 2px)`,
    width: `calc(${laneWidth}% - 4px)`,
  };
}

function CampaignPlannerGrid({ placements, world, selectCell }: {
  placements: readonly CampaignPlacementView[];
  selectCell: (objectType: CampaignObjectType, book: number) => void;
  world: keyof typeof campaignWorldScreens;
}) {
  const books = Array.from({ length: 18 }, (_, index) => index + 1);
  const { invalid, positioned } = positionCampaignPlacements(placements);

  return <>
    {invalid.length > 0 && <div className="notice notice--bad" role="alert"><strong>{invalid.length} campaign placement{invalid.length === 1 ? "" : "s"} could not be rendered.</strong><span>{invalid.map((placement) => `${placement.campaignPlacementId}: ${placement.reason}`).join(" · ")}</span></div>}
    <div className="table-scroll">
      <div aria-label={`${world} 18-Book campaign planner`} className="campaign-planner-grid" role="table">
        <div className="campaign-planner-row" role="row">
          <div className="campaign-planner-header" role="columnheader" style={{ gridColumn: 1, gridRow: 1 }}>Book</div>
          {campaignObjectTypes.map((objectType, index) => <div className="campaign-planner-header" key={objectType} role="columnheader" style={{ gridColumn: index + 2, gridRow: 1 }}>{objectType}</div>)}
        </div>
        {books.map((book) => <div className="campaign-planner-row" key={book} role="row">
          <div className="campaign-planner-book" role="rowheader" style={{ gridColumn: 1, gridRow: book + 1 }}>{book}</div>
          {campaignObjectTypes.map((objectType, index) => {
            const occupied = positioned.some((placement) => placement.objectType === objectType && placement.startBook <= book && placement.endBook >= book);
            return occupied
              ? <div aria-label={`Book ${book} ${objectType}: assigned`} className="campaign-planner-cell" key={objectType} role="cell" style={{ gridColumn: index + 2, gridRow: book + 1 }} />
              : <div className="campaign-planner-cell" key={objectType} role="cell" style={{ gridColumn: index + 2, gridRow: book + 1 }}><button aria-label={`Book ${book} ${objectType}: empty assignment cell`} className="campaign-drop-target" data-book={book} data-object-type={objectType} onClick={() => selectCell(objectType, book)} type="button">Empty</button></div>;
          })}
          {positioned.filter((placement) => placement.startBook === book).map((placement) => <span
            aria-label={`${placement.objectId}, ${placement.objectType}, Books ${placement.startBook} through ${placement.endBook}`}
            aria-rowspan={placement.rowSpan}
            className="tag campaign-placement-card"
            data-book-span={placement.rowSpan}
            data-category={placement.objectType}
            data-lane={placement.lane}
            data-lane-count={placement.laneCount}
            data-start-book={placement.startBook}
            data-testid={`campaign-placement-${placement.campaignPlacementId}`}
            draggable
            key={placement.campaignPlacementId}
            role="cell"
            style={placementStyle(placement)}
            title={`${placement.objectType}: Books ${placement.startBook}–${placement.endBook}`}
          >{placement.objectId}</span>)}
        </div>)}
      </div>
    </div>
  </>;
}

function Planner({ screen, world }: { screen: PageManifestEntry; world: keyof typeof campaignWorldScreens }) {
  const [objectType, setObjectType] = useState<CampaignObjectType>("PILLAR");
  const [objectId, setObjectId] = useState("");
  const [bookInput, setBookInput] = useState("1,2,3,4,5,6,7,8,9");
  const [message, setMessage] = useState("");
  const campaign = useQuery({
    queryKey: ["campaign", world],
    queryFn: async () => {
      const response = await fetch(`/api/admin/campaign?world=${world}`);
      if (!response.ok) throw new Error("Campaign could not be loaded.");
      return response.json() as Promise<{ campaign: null | { name: string; placements: CampaignPlacementView[] } }>;
    },
  });
  const placements = campaign.data?.campaign?.placements ?? [];
  return <div className="stack">
    {worldTabs(world)}
    <div className="toolbar" aria-label="Campaign planner filters"><span className="button" aria-label={`World filter: ${world}`}>{world}</span><span className="button" aria-label="Book filter: Books 1 through 18">Books 1–18</span><span className="button" aria-label="Linked-type filter: All linked types">All linked types</span></div>
    <section className="card form-grid"><h2 className="span-2">Assign canonical campaign object</h2><label className="field">Object type<select className="input" value={objectType} onChange={(event) => setObjectType(event.target.value as CampaignObjectType)}>{campaignObjectTypes.map((type) => <option key={type}>{type}</option>)}</select></label><label className="field">Canonical object ID<input className="input" value={objectId} onChange={(event) => setObjectId(event.target.value)} /></label><label className="field span-2">Books (comma separated)<input className="input" value={bookInput} onChange={(event) => setBookInput(event.target.value)} /></label><button className="button button--gold" disabled={!objectId.trim()} onClick={async () => { const bookNumbers = bookInput.split(",").map((value) => Number(value.trim())).filter(Number.isFinite); const response = await fetch("/api/admin/campaign", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ bookNumbers, name: `${world} Campaign`, objectId, objectType, worldKey: world }) }); const body = await response.json() as { error?: string }; setMessage(response.ok ? "Campaign placement saved." : body.error ?? "Placement could not be saved."); if (response.ok) { setObjectId(""); await campaign.refetch(); } }}>Save placement</button>{message && <p className="notice" role="status">{message}</p>}</section>
    <section className="card campaign-planner-card"><CampaignPlannerGrid placements={placements} selectCell={(selectedType, book) => { setObjectType(selectedType); setBookInput(String(book)); }} world={world} /></section>
    {campaign.isPending && <p className="notice">Loading campaign assignments…</p>}
    {campaign.isError && <p className="notice notice--bad">{campaign.error.message}</p>}
    <section className="card"><h2>Linked drag groups</h2><p>{linkedGroupSummary()}</p><p>HISTORICAL_INTERLUDE is optional and may occur zero or more times in the Witness group.</p></section>
    {['CAM003', 'CAM004', 'CAM005'].includes(screen.screenId) && <p className="notice">The selected record and governed Book span are validated again by the server before persistence.</p>}
  </div>;
}

export function CampaignAdminPage({ screen }: { screen: PageManifestEntry }) {
  const world = campaignWorld(screen.screenId);
  if (!world) return <div className="stack">{worldTabs(null)}<section className="card"><h2>Campaign Manager</h2><p>Select one internal world to open its 18-Book planner. No world is selected by default.</p></section></div>;
  return <Planner screen={screen} world={world} />;
}
