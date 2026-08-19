import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent } from "react";

import { DataTable, type DataTableColumnDef } from "../../components/DataTable";
import {
  campaignBookSegments,
  campaignBooksForDrop,
  campaignLinkedGroups,
  campaignPlannerColumns,
  campaignPlacementBookSegments,
  defaultDisjointTrilogy,
  linkedCampaignGroup,
  opposingFactionGrouping,
  plannerColumnForObjectType,
  validateDisjointTrilogy,
  type CampaignBookRange,
  type CampaignObjectType,
  type CampaignPlannerColumnId,
  type ProjectedBookGroupingValue,
} from "../../domain/campaign-planner";
import type { WorldKey } from "../../generated/prisma/enums";
import type { PageManifestEntry } from "../../lib/page-manifest";

const campaignWorldScreens = {
  CONCORD: "CAMPAIGN_CONCORD",
  RUIN: "CAMPAIGN_RUIN",
  SCHISM: "CAMPAIGN_SCHISM",
} as const;

interface CampaignPlacementView {
  bookNumbers: number[];
  campaignPlacementId: string;
  label?: string;
  objectId: string;
  objectType: CampaignObjectType;
  ordinal: number;
}

interface CampaignCatalogItem {
  label: string;
  objectId: string;
  objectType: CampaignObjectType;
}

interface CampaignWorkspace {
  campaign: null | { name: string; placements: CampaignPlacementView[] };
  unassigned: Partial<Record<CampaignObjectType, CampaignCatalogItem[]>>;
  bookGroupings: {
    disjoint: ProjectedBookGroupingValue[];
    opposingFaction: ProjectedBookGroupingValue;
  };
}

interface PositionedCampaignPlacement extends CampaignPlacementView {
  columnId: CampaignPlannerColumnId;
  lane: number;
  laneCount: number;
  segments: CampaignBookRange[];
}

const emptyUnassigned: Partial<Record<CampaignObjectType, CampaignCatalogItem[]>> = {};
const widePlannerColumns = new Set<CampaignPlannerColumnId>(["COMPANION", "WITNESS", "ARCHITECT", "LEGENDARY_REWARD", "INTERLUDES"]);

export function plannerColumnWidth(columnId: CampaignPlannerColumnId): number {
  return widePlannerColumns.has(columnId) ? (columnId === "INTERLUDES" ? 220 : 210) : 168;
}

function campaignWorld(screenId: string): WorldKey | null {
  const owned = Object.entries(campaignWorldScreens).find(([, state]) => state === screenId)?.[0] as WorldKey | undefined;
  if (owned) return owned;
  if (["CAM002", "CAM003", "CAM004", "CAM005", "CAM006", "CAM007"].includes(screenId)) return "CONCORD";
  return null;
}

function worldTabs(world: WorldKey | null) {
  return <nav aria-label="Campaign world" className="tabs">{Object.entries(campaignWorldScreens).map(([worldKey, state]) => <a aria-current={world === worldKey ? "page" : undefined} className={world === worldKey ? "active" : ""} href={`/admin/campaign/planner?state=${state}`} key={worldKey}>{worldKey}</a>)}</nav>;
}

function linkedGroupSummary() {
  return campaignLinkedGroups.map((group) => group.required.map((member) => member.count === 1 ? member.objectType : `${member.count} ${member.objectType}`).join(" + ")).join(" · ");
}

function rangesOverlap(left: CampaignBookRange, right: CampaignBookRange) {
  return left.startBook <= right.endBook && right.startBook <= left.endBook;
}

export function positionCampaignPlacements(placements: readonly CampaignPlacementView[]) {
  const invalid: Array<{ campaignPlacementId: string; reason: string }> = [];
  const byColumn = new Map<CampaignPlannerColumnId, Array<CampaignPlacementView & { columnId: CampaignPlannerColumnId; segments: CampaignBookRange[] }>>();
  for (const placement of placements) {
    const columnId = plannerColumnForObjectType(placement.objectType);
    if (!columnId) {
      invalid.push({ campaignPlacementId: placement.campaignPlacementId, reason: "unknown campaign planner column" });
      continue;
    }
    try {
      const group = byColumn.get(columnId) ?? [];
      group.push({ ...placement, columnId, segments: campaignPlacementBookSegments(placement.objectType, placement.bookNumbers) });
      byColumn.set(columnId, group);
    } catch (error) {
      invalid.push({ campaignPlacementId: placement.campaignPlacementId, reason: error instanceof Error ? error.message : "invalid Book range" });
    }
  }
  const positioned: PositionedCampaignPlacement[] = [];
  for (const column of campaignPlannerColumns) {
    const placementsForColumn = (byColumn.get(column.id) ?? []).sort((left, right) =>
      left.ordinal - right.ordinal || left.segments[0]!.startBook - right.segments[0]!.startBook || left.campaignPlacementId.localeCompare(right.campaignPlacementId));
    const lanes: CampaignBookRange[][] = [];
    const allocated = placementsForColumn.map((placement) => {
      let lane = lanes.findIndex((occupied) => placement.segments.every((segment) => occupied.every((range) => !rangesOverlap(segment, range))));
      if (lane < 0) { lane = lanes.length; lanes.push([]); }
      lanes[lane]!.push(...placement.segments);
      return { ...placement, lane };
    });
    positioned.push(...allocated.map((placement) => ({ ...placement, laneCount: Math.max(1, lanes.length) })));
  }
  return { invalid, positioned };
}

interface ColumnPreferences {
  order: CampaignPlannerColumnId[];
  visibility: Partial<Record<CampaignPlannerColumnId, boolean>>;
}

function readColumnPreferences(storageKey: string): ColumnPreferences {
  const canonical = campaignPlannerColumns.map(({ id }) => id);
  if (typeof window === "undefined") return { order: canonical, visibility: {} };
  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey) ?? "null") as Partial<ColumnPreferences> | null;
    const known = new Set<CampaignPlannerColumnId>(canonical);
    const requested = Array.isArray(stored?.order) ? stored.order.filter((id): id is CampaignPlannerColumnId => known.has(id as CampaignPlannerColumnId)) : [];
    const order = [...new Set([...requested, ...canonical])];
    const visibility = Object.fromEntries(Object.entries(stored?.visibility ?? {}).filter(([id, value]) => known.has(id as CampaignPlannerColumnId) && typeof value === "boolean"));
    return { order, visibility };
  } catch {
    return { order: canonical, visibility: {} };
  }
}

function useCampaignColumnPreferences(world: WorldKey) {
  const storageKey = `echoes.campaign-planner.${world}.columns.v2`;
  const [initial] = useState(() => readColumnPreferences(storageKey));
  const [order, setOrder] = useState(initial.order);
  const [visibility, setVisibility] = useState(initial.visibility);
  useEffect(() => { window.localStorage.setItem(storageKey, JSON.stringify({ order, visibility } satisfies ColumnPreferences)); }, [order, storageKey, visibility]);
  const move = (id: CampaignPlannerColumnId, offset: -1 | 1) => setOrder((current) => {
    const next = [...current]; const from = next.indexOf(id); const to = from + offset;
    if (from < 0 || to < 0 || to >= next.length) return current;
    [next[from], next[to]] = [next[to]!, next[from]!]; return next;
  });
  const moveBefore = (moving: CampaignPlannerColumnId, target: CampaignPlannerColumnId) => setOrder((current) => {
    if (moving === target) return current;
    const next = current.filter((id) => id !== moving); next.splice(next.indexOf(target), 0, moving); return next;
  });
  const reset = () => { setOrder(campaignPlannerColumns.map(({ id }) => id)); setVisibility({}); };
  return { order, visibility, move, moveBefore, reset, setVisibility };
}

function ColumnLayoutManager({ preferences }: { preferences: ReturnType<typeof useCampaignColumnPreferences> }) {
  const visibleCount = preferences.order.filter((id) => preferences.visibility[id] !== false).length;
  return <details className="campaign-column-manager"><summary>Columns {visibleCount}/{campaignPlannerColumns.length}</summary><div className="card"><div className="action-row"><button className="button" type="button" onClick={() => preferences.setVisibility({})}>Show All</button><button className="button" type="button" onClick={preferences.reset}>Reset Layout</button></div>{preferences.order.map((id, index) => { const column = campaignPlannerColumns.find((candidate) => candidate.id === id)!; return <div className="campaign-column-control" key={id}><label><input checked={preferences.visibility[id] !== false} type="checkbox" onChange={(event) => preferences.setVisibility((current) => ({ ...current, [id]: event.target.checked }))} /> {column.label}</label><button aria-label={`Move ${column.label} left`} disabled={index === 0} onClick={() => preferences.move(id, -1)} type="button">←</button><button aria-label={`Move ${column.label} right`} disabled={index === preferences.order.length - 1} onClick={() => preferences.move(id, 1)} type="button">→</button></div>; })}<p className="notice">Column order and visibility are view preferences only. Hidden columns remain in validation, linked moves, and exports.</p></div></details>;
}

function ColumnUnassignedListbox({ columnId, items, selected, toggle }: {
  columnId: CampaignPlannerColumnId;
  items: CampaignCatalogItem[];
  selected: ReadonlySet<string>;
  toggle: (item: CampaignCatalogItem) => void;
}) {
  const column = campaignPlannerColumns.find((candidate) => candidate.id === columnId)!;
  if (columnId === "OPPOSING_FACTION") return <div aria-disabled="true" aria-label="Opposing Unassigned" className="campaign-unassigned locked" role="listbox"><small>Unassigned · —</small><span>Locked · derived</span></div>;
  if (columnId === "DISJOINT_TRILOGY") return <div aria-label="Disjoint 3+3 Unassigned" className="campaign-unassigned" role="listbox"><small>Unassigned · 0</small><span>No unassigned values</span><a href="/admin/campaign/planner?state=CAM006">Edit membership</a></div>;
  return <div aria-label={`${column.label} Unassigned`} className="campaign-unassigned" role="listbox" tabIndex={0}><small>Unassigned · {items.length}</small>{items.length === 0 ? <span>No unassigned records</span> : items.map((item) => <button aria-selected={selected.has(`${item.objectType}:${item.objectId}`)} className={selected.has(`${item.objectType}:${item.objectId}`) ? "selected" : ""} draggable key={`${item.objectType}:${item.objectId}`} onClick={() => toggle(item)} onDragStart={(event) => { event.dataTransfer.setData("application/x-eidolon-campaign", JSON.stringify(item)); event.dataTransfer.effectAllowed = "move"; }} role="option" type="button">{columnId === "INTERLUDES" ? `${item.objectType}: ` : ""}{item.label}</button>)}</div>;
}

type CampaignMoveDirection = "UP" | "DOWN";
type CampaignReorderOperation = { beforeCampaignPlacementId: string } | { direction: CampaignMoveDirection };

function CampaignPlacementCard({ canMoveDown, canMoveUp, focusTarget, onDropPlacement, onFocusRestored, onReorder, placement, position, segment, segmentIndex, selected, select, siblingCount, style }: {
  canMoveDown: boolean;
  canMoveUp: boolean;
  focusTarget?: { campaignPlacementId: string; direction: CampaignMoveDirection };
  onDropPlacement: (event: DragEvent<HTMLElement>, target: PositionedCampaignPlacement) => void;
  onFocusRestored: () => void;
  onReorder: (placement: PositionedCampaignPlacement, operation: CampaignReorderOperation) => void;
  placement: PositionedCampaignPlacement;
  position: number;
  segment: CampaignBookRange;
  segmentIndex: number;
  selected: boolean;
  select: () => void;
  siblingCount: number;
  style: CSSProperties;
}) {
  const upRef = useRef<HTMLButtonElement>(null);
  const downRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (segmentIndex !== 0 || focusTarget?.campaignPlacementId !== placement.campaignPlacementId) return;
    (focusTarget.direction === "UP" ? upRef : downRef).current?.focus();
    onFocusRestored();
  }, [focusTarget, onFocusRestored, placement.campaignPlacementId, segmentIndex]);
  const label = `${placement.objectId}, ${placement.objectType}, Book segment ${segmentIndex + 1} of ${placement.segments.length}, Books ${segment.startBook} through ${segment.endBook}`;
  return <div aria-label={label} aria-rowspan={segment.rowSpan} className={`tag campaign-placement-card${selected ? " selected" : ""}`} data-book-span={segment.rowSpan} data-campaign-position={position} data-category={placement.objectType} data-lane={placement.lane} data-lane-count={placement.laneCount} data-logical-placement-id={placement.campaignPlacementId} data-segment-index={segmentIndex} data-start-book={segment.startBook} data-testid={`campaign-placement-${placement.campaignPlacementId}${placement.segments.length > 1 ? `-segment-${segmentIndex}` : ""}`} draggable onClick={select} onDragStart={(event) => { event.dataTransfer.setData("application/x-eidolon-campaign-placement", placement.campaignPlacementId); event.dataTransfer.effectAllowed = "move"; select(); }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => onDropPlacement(event, placement)} onFocusCapture={select} key={`${placement.campaignPlacementId}:${segmentIndex}`} role="cell" style={style}>
    <strong className="campaign-placement-name">{placement.label ?? placement.objectId}</strong>
    {placement.label && placement.label !== placement.objectId && <small className="campaign-placement-id">{placement.objectId}</small>}
    {segmentIndex === 0 && <><button aria-label={`Drag ${placement.objectId} to reorder`} className="campaign-drag-handle" draggable onClick={select} type="button">⠿ Drag</button><div aria-label={`${placement.objectId} movement controls`} className="campaign-placement-controls"><button aria-label="↑ Move up" className="campaign-move-button" disabled={!canMoveUp} onClick={(event) => { event.stopPropagation(); onReorder(placement, { direction: "UP" }); }} ref={upRef} type="button">↑ Move up</button><button aria-label="↓ Move down" className="campaign-move-button" disabled={!canMoveDown} onClick={(event) => { event.stopPropagation(); onReorder(placement, { direction: "DOWN" }); }} ref={downRef} type="button">↓ Move down</button></div><small className="campaign-placement-position">{position} of {siblingCount}</small></>}
  </div>;
}

function stateNotice(screenId: string) {
  if (screenId === "CAM003") return <p className="notice notice--good">Witness drop preview: the required linked group is validated and committed as one transaction.</p>;
  if (screenId === "CAM004") return <p className="notice notice--bad">Invalid Architect drop preview: an incomplete linked group mutates nothing.</p>;
  if (screenId === "CAM005") return <p className="notice notice--good">Reward binding preview: Witness, Architect, Reward, ATROCITY, and required Interludes stay aligned.</p>;
  if (screenId === "CAM007") return <p className="notice">Custom column view: presentation order and visibility are persisted locally without changing campaign or grouping data.</p>;
  return null;
}

function PlannerGrid({ columns, focusTarget, groupings, moveColumn, onCreate, onDropItem, onFocusRestored, onReorder, placements, selected, selectedPlacementId, selectPlacement, toggle, unassigned, world }: {
  columns: typeof campaignPlannerColumns[number][];
  focusTarget?: { campaignPlacementId: string; direction: CampaignMoveDirection };
  groupings: CampaignWorkspace["bookGroupings"];
  moveColumn: (moving: CampaignPlannerColumnId, target: CampaignPlannerColumnId) => void;
  onCreate: (objectTypes: readonly CampaignObjectType[]) => void;
  onDropItem: (item: CampaignCatalogItem, book: number) => void;
  onFocusRestored: () => void;
  onReorder: (placement: PositionedCampaignPlacement, operation: CampaignReorderOperation) => void;
  placements: CampaignPlacementView[];
  selected: ReadonlySet<string>;
  selectedPlacementId?: string;
  selectPlacement: (campaignPlacementId: string) => void;
  toggle: (item: CampaignCatalogItem) => void;
  unassigned: Partial<Record<CampaignObjectType, CampaignCatalogItem[]>>;
  world: WorldKey;
}) {
  const books = Array.from({ length: 18 }, (_, index) => index + 1);
  const { invalid, positioned } = positionCampaignPlacements(placements);
  const groupingItems = [...groupings.disjoint, groupings.opposingFaction];
  const columnIndex = new Map(columns.map((column, index) => [column.id, index + 2]));
  const styleFor = (columnId: CampaignPlannerColumnId, segment: CampaignBookRange, lane = 0, laneCount = 1): CSSProperties => ({
    gridColumn: columnIndex.get(columnId),
    gridRow: `${segment.startBook + 1} / span ${segment.rowSpan}`,
    marginLeft: `calc(${lane * (100 / laneCount)}% + 2px)`,
    width: `calc(${100 / laneCount}% - 4px)`,
  });
  const occupied = (columnId: CampaignPlannerColumnId, book: number) => positioned.some((placement) => placement.columnId === columnId && placement.segments.some((segment) => segment.startBook <= book && segment.endBook >= book))
    || groupingItems.some((grouping) => grouping.groupingType === columnId && grouping.segments.some((segment) => segment.startBook <= book && segment.endBook >= book));
  const placementPosition = new Map(positioned.map((placement) => {
    const siblings = positioned.filter((candidate) => candidate.columnId === placement.columnId);
    return [placement.campaignPlacementId, { position: siblings.findIndex((candidate) => candidate.campaignPlacementId === placement.campaignPlacementId) + 1, siblingCount: siblings.length }] as const;
  }));
  const dropPlacement = (event: DragEvent<HTMLElement>, target: PositionedCampaignPlacement) => {
    event.preventDefault();
    const movingId = event.dataTransfer.getData("application/x-eidolon-campaign-placement");
    const moving = positioned.find((placement) => placement.campaignPlacementId === movingId);
    if (moving && moving.campaignPlacementId !== target.campaignPlacementId && moving.columnId === target.columnId) onReorder(moving, { beforeCampaignPlacementId: target.campaignPlacementId });
  };
  const columnWidths = columns.map((column) => plannerColumnWidth(column.id));
  return <>{invalid.length > 0 && <div className="notice notice--bad" role="alert"><strong>{invalid.length} campaign placement{invalid.length === 1 ? "" : "s"} could not be rendered.</strong><span>{invalid.map((placement) => `${placement.campaignPlacementId}: ${placement.reason}`).join(" · ")}</span></div>}<div className="campaign-board-viewport" data-testid="campaign-board-viewport"><div aria-label={`${world} 18-Book campaign planner`} className="campaign-planner-grid" role="table" style={{ gridTemplateColumns: `58px ${columnWidths.map((width) => `minmax(${width}px, ${width}px)`).join(" ")}`, gridTemplateRows: "164px repeat(18, 96px)", minWidth: `${58 + columnWidths.reduce((sum, width) => sum + width, 0)}px` }}><div className="campaign-planner-row" role="row"><div className="campaign-planner-header" role="columnheader" style={{ gridColumn: 1, gridRow: 1 }}>Book</div>{columns.map((column, index) => { const items = column.objectTypes.flatMap((objectType) => unassigned[objectType] ?? []); const authorable = column.objectTypes.filter((objectType) => objectType !== "HOLIDAY"); return <div className="campaign-planner-header campaign-column-header" draggable key={column.id} onDragStart={(event) => event.dataTransfer.setData("application/x-eidolon-column", column.id)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const moving = event.dataTransfer.getData("application/x-eidolon-column") as CampaignPlannerColumnId; if (moving) moveColumn(moving, column.id); }} role="columnheader" style={{ gridColumn: index + 2, gridRow: 1 }}><div className="action-row action-row--between"><strong>{column.label}</strong>{authorable.length > 0 && <button aria-label={`Create ${column.label}`} className="button button--small" onClick={() => onCreate(authorable)} type="button">+</button>}</div><ColumnUnassignedListbox columnId={column.id} items={items} selected={selected} toggle={toggle} /></div>; })}</div>{books.map((book) => <div className="campaign-planner-row" key={book} role="row"><div className="campaign-planner-book" role="rowheader" style={{ gridColumn: 1, gridRow: book + 1 }}>{book}</div>{columns.map((column, index) => { const locked = column.id === "OPPOSING_FACTION" || column.id === "DISJOINT_TRILOGY"; return <div aria-label={`Book ${book} ${column.label}: ${locked ? "grouping-owned" : occupied(column.id, book) ? "assigned" : "drop target"}`} className="campaign-planner-cell" key={column.id} role="cell" style={{ gridColumn: index + 2, gridRow: book + 1 }}>{!locked && !occupied(column.id, book) && <button aria-label={`Book ${book} ${column.label}: empty assignment cell`} className="campaign-drop-target" data-book={book} data-column={column.id} onClick={() => { const item = column.objectTypes.flatMap((objectType) => unassigned[objectType] ?? []).find((candidate) => selected.has(`${candidate.objectType}:${candidate.objectId}`)); if (item) onDropItem(item, book); }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const raw = event.dataTransfer.getData("application/x-eidolon-campaign"); if (raw) onDropItem(JSON.parse(raw) as CampaignCatalogItem, book); }} type="button">Drop</button>}</div>; })}{positioned.flatMap((placement) => placement.segments.map((segment, segmentIndex) => { const order = placementPosition.get(placement.campaignPlacementId)!; return segment.startBook === book && columnIndex.has(placement.columnId) ? <CampaignPlacementCard canMoveDown={order.position < order.siblingCount} canMoveUp={order.position > 1} focusTarget={focusTarget} key={`${placement.campaignPlacementId}:${segmentIndex}`} onDropPlacement={dropPlacement} onFocusRestored={onFocusRestored} onReorder={onReorder} placement={placement} position={order.position} segment={segment} segmentIndex={segmentIndex} selected={selectedPlacementId === placement.campaignPlacementId} select={() => selectPlacement(placement.campaignPlacementId)} siblingCount={order.siblingCount} style={styleFor(placement.columnId, segment, placement.lane, placement.laneCount)} /> : []; }))}{groupingItems.flatMap((grouping) => grouping.segments.map((segment, segmentIndex) => segment.startBook === book && columnIndex.has(grouping.groupingType) ? <span aria-label={`${grouping.logicalKey}, ${grouping.groupingType}, segment ${segmentIndex + 1} of ${grouping.segments.length}`} aria-rowspan={segment.rowSpan} className={`tag campaign-placement-card ${grouping.editability === "LOCKED" ? "locked" : "grouping"}`} data-book-span={segment.rowSpan} data-grouping-value-id={grouping.bookGroupingValueId} data-segment-index={segmentIndex} data-start-book={segment.startBook} data-testid={`book-grouping-${grouping.bookGroupingValueId}-segment-${segmentIndex}`} key={`${grouping.bookGroupingValueId}:${segmentIndex}`} role="cell" style={styleFor(grouping.groupingType, segment)}>{grouping.logicalKey}</span> : []))}</div>)}</div></div></>;
}

function CampaignCreatePanel({ objectTypes, close, created }: { objectTypes: readonly CampaignObjectType[]; close: () => void; created: () => Promise<unknown> }) {
  const [objectType, setObjectType] = useState(objectTypes[0]!);
  const [payload, setPayload] = useState('{\n  "objectId": "",\n  "name": ""\n}');
  const [message, setMessage] = useState("");
  const submit = async () => { try { const response = await fetch("/api/admin/campaign/catalog", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ objectType, payload: JSON.parse(payload) as unknown }) }); const result = await response.json() as { error?: string }; if (!response.ok) { setMessage(result.error ?? "Campaign object could not be created."); return; } setMessage(`${objectType} created and added to Unassigned.`); await created(); } catch (error) { setMessage(error instanceof Error ? error.message : "Campaign object could not be created."); } };
  return <section className="card" aria-label="Create campaign object"><div className="action-row action-row--between"><h2>Create Campaign Object</h2><button className="button" onClick={close} type="button">Close</button></div><label className="field">Object type<select className="select" value={objectType} onChange={(event) => setObjectType(event.target.value as CampaignObjectType)}>{objectTypes.map((value) => <option key={value}>{value}</option>)}</select></label><label className="field">Canonical create payload JSON<textarea className="textarea" rows={12} value={payload} onChange={(event) => setPayload(event.target.value)} /></label><p className="notice">Witness, Architect, and Companion payloads must include their canonical Character and definition-level records. LegendaryReward accepts only its minimal ID, name, and description.</p><button className="button button--gold" onClick={() => void submit()} type="button">Create {objectType}</button>{message && <p className="notice" role="status">{message}</p>}</section>;
}

function Planner({ screen, world }: { screen: PageManifestEntry; world: WorldKey }) {
  const campaign = useQuery({ queryKey: ["campaign", world], queryFn: async () => { const response = await fetch(`/api/admin/campaign?world=${world}`); if (!response.ok) throw new Error("Campaign could not be loaded."); return response.json() as Promise<CampaignWorkspace>; } });
  const preferences = useCampaignColumnPreferences(world);
  const visibleColumns = preferences.order.filter((id) => preferences.visibility[id] !== false).map((id) => campaignPlannerColumns.find((column) => column.id === id)!);
  const [selectedItems, setSelectedItems] = useState<CampaignCatalogItem[]>([]);
  const [selectedPlacementId, setSelectedPlacementId] = useState<string>();
  const [focusTarget, setFocusTarget] = useState<{ campaignPlacementId: string; direction: CampaignMoveDirection }>();
  const [message, setMessage] = useState("");
  const [createTypes, setCreateTypes] = useState<readonly CampaignObjectType[]>();
  const selected = useMemo(() => new Set(selectedItems.map((item) => `${item.objectType}:${item.objectId}`)), [selectedItems]);
  const toggle = (item: CampaignCatalogItem) => setSelectedItems((current) => current.some((candidate) => candidate.objectType === item.objectType && candidate.objectId === item.objectId) ? current.filter((candidate) => candidate.objectType !== item.objectType || candidate.objectId !== item.objectId) : [...current, item]);
  const commitDrop = async (source: CampaignCatalogItem, book: number) => {
    try {
      const chosen = selected.has(`${source.objectType}:${source.objectId}`) ? selectedItems : [...selectedItems, source];
      const rule = linkedCampaignGroup(source.objectType);
      let endpoint = "/api/admin/campaign";
      let body: unknown;
      if (rule) {
        for (const requirement of rule.required) {
          if (chosen.filter((item) => item.objectType === requirement.objectType).length !== requirement.count) {
            setMessage(`Select exactly ${requirement.count} ${requirement.objectType} record(s) before the linked drop.`); return;
          }
        }
        const allowed = new Set([...rule.required, ...rule.optional].map((member) => member.objectType));
        const linked = chosen.filter((item) => allowed.has(item.objectType));
        const sixBookGroup = rule.required.some((member) => member.objectType === "LESSON");
        const sixBooks = sixBookGroup ? campaignBooksForDrop("LESSON", book) : [];
        const exodus = linked.filter((item) => item.objectType === "EXODUS").sort((left, right) => left.objectId.localeCompare(right.objectId));
        body = { placements: linked.map((item) => ({
          bookNumbers: item.objectType === "EXODUS" && sixBookGroup
            ? sixBooks.slice(exodus.findIndex((candidate) => candidate.objectId === item.objectId) * 3, exodus.findIndex((candidate) => candidate.objectId === item.objectId) * 3 + 3)
            : campaignBooksForDrop(item.objectType, book),
          name: `${world} Campaign`, objectId: item.objectId, objectType: item.objectType, worldKey: world,
        })) };
        endpoint = "/api/admin/campaign/linked-move";
      } else {
        body = { bookNumbers: campaignBooksForDrop(source.objectType, book), name: `${world} Campaign`, objectId: source.objectId, objectType: source.objectType, worldKey: world };
      }
      const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json() as { error?: string };
      setMessage(response.ok ? "Campaign placement transaction committed." : result.error ?? "Campaign placement was not changed.");
      if (response.ok) { setSelectedItems([]); await campaign.refetch(); }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Campaign placement was not changed.");
    }
  };
  const commitReorder = async (placement: PositionedCampaignPlacement, operation: CampaignReorderOperation) => {
    try {
      const current = [...(campaign.data?.campaign?.placements ?? [])].sort((left, right) => left.ordinal - right.ordinal);
      const siblings = current.filter((candidate) => plannerColumnForObjectType(candidate.objectType) === placement.columnId);
      const from = siblings.findIndex((candidate) => candidate.campaignPlacementId === placement.campaignPlacementId);
      let nextPosition = from + 1;
      if ("direction" in operation) nextPosition += operation.direction === "UP" ? -1 : 1;
      else {
        const target = siblings.findIndex((candidate) => candidate.campaignPlacementId === operation.beforeCampaignPlacementId);
        nextPosition = from < target ? target : target + 1;
      }
      const response = await fetch("/api/admin/campaign/reorder", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ campaignPlacementId: placement.campaignPlacementId, ...operation, worldKey: world }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) { setMessage(result.error ?? "Campaign placement order was not changed."); return; }
      setSelectedPlacementId(placement.campaignPlacementId);
      await campaign.refetch();
      const direction = "direction" in operation ? operation.direction : "UP";
      setFocusTarget({ campaignPlacementId: placement.campaignPlacementId, direction });
      const columnLabel = campaignPlannerColumns.find((column) => column.id === placement.columnId)!.label;
      setMessage(`${placement.objectId} moved to position ${nextPosition} of ${siblings.length} in ${columnLabel}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Campaign placement order was not changed.");
    }
  };
  const fallbackGroupings = { disjoint: validateDisjointTrilogy(defaultDisjointTrilogy(world), world), opposingFaction: opposingFactionGrouping(world) };
  const workspace = campaign.data;
  return <div className="stack">{worldTabs(world)}<div className="toolbar" aria-label="Campaign planner filters"><span className="button" aria-label={`World filter: ${world}`}>{world}</span><span className="button" aria-label="Book filter: Books 1 through 18">Books 1–18</span><span className="button" aria-label="Linked-type filter: All linked types">All linked types</span><ColumnLayoutManager preferences={preferences} /></div>{stateNotice(screen.screenId)}<section className="card campaign-planner-card"><PlannerGrid columns={visibleColumns} focusTarget={focusTarget} groupings={workspace?.bookGroupings ?? fallbackGroupings} moveColumn={preferences.moveBefore} onCreate={setCreateTypes} onDropItem={(item, book) => void commitDrop(item, book)} onFocusRestored={() => setFocusTarget(undefined)} onReorder={(placement, operation) => void commitReorder(placement, operation)} placements={workspace?.campaign?.placements ?? []} selected={selected} selectedPlacementId={selectedPlacementId} selectPlacement={setSelectedPlacementId} toggle={toggle} unassigned={workspace?.unassigned ?? emptyUnassigned} world={world} /></section>{createTypes && <CampaignCreatePanel close={() => setCreateTypes(undefined)} created={() => campaign.refetch()} objectTypes={createTypes} />}{campaign.isPending && <p className="notice">Loading campaign assignments…</p>}{campaign.isError && <p className="notice notice--bad">{campaign.error.message}</p>}{message && <p aria-live="polite" className="notice" role="status">{message}</p>}<section className="card"><h2>Linked drag groups</h2><p>{linkedGroupSummary()}</p><p>Choose required records in their typed Unassigned listboxes, then drop once. The server commits the complete group or nothing.</p></section></div>;
}

function GroupingEditorForm({ initial, world, refetch }: { initial: ProjectedBookGroupingValue[]; world: WorldKey; refetch: () => Promise<unknown> }) {
  const [values, setValues] = useState(() => initial.map((value) => ({ ...value, bookNumbers: [...value.bookNumbers] })));
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [message, setMessage] = useState("");
  const opposing = opposingFactionGrouping(world);
  const selectedValue = values[selectedIndex]!;
  const moveBook = (book: number) => setValues((current) => {
    const sourceIndex = current.findIndex((value) => value.bookNumbers.includes(book));
    if (sourceIndex === selectedIndex || sourceIndex < 0) return current;
    if (current[sourceIndex]!.bookNumbers.length === 1) { setMessage("Each logical grouping value must retain at least one Book."); return current; }
    setMessage("");
    return current.map((value, index) => ({
      ...value,
      bookNumbers: index === selectedIndex
        ? [...value.bookNumbers, book].sort((left, right) => left - right)
        : value.bookNumbers.filter((candidate) => index !== sourceIndex || candidate !== book),
    }));
  });
  const apply = async () => { const response = await fetch("/api/admin/campaign/groupings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ worldKey: world, values: values.map(({ bookGroupingValueId, logicalKey, bookNumbers, ordinal, valueRefType, valueRefId }) => ({ bookGroupingValueId, logicalKey, bookNumbers, ordinal, valueRefType, valueRefId })) }) }); const result = await response.json() as { error?: string }; setMessage(response.ok ? "Book grouping membership committed atomically." : result.error ?? "Grouping membership was not changed."); if (response.ok) await refetch(); };
  const labelRanges = (bookNumbers: readonly number[]) => campaignBookSegments(bookNumbers).map((segment) => `${segment.startBook}–${segment.endBook}`).join(" + ");
  return <div className="campaign-grouping-editor"><section className="card"><h2>Grouping values</h2><div className="campaign-grouping-records">{values.map((value, index) => <button aria-pressed={selectedIndex === index} className={selectedIndex === index ? "selected" : ""} key={value.bookGroupingValueId} onClick={() => setSelectedIndex(index)} type="button"><strong>DG-{value.logicalKey} · Unnamed</strong><span>{labelRanges(value.bookNumbers)}</span></button>)}</div><p className="notice">One logical value may own multiple disconnected ranges. Membership stays explicit and is never collapsed to a minimum/maximum span.</p><h3>Locked overlay</h3><div className="campaign-grouping-locked"><strong>Opposing Faction · {opposing.logicalKey}</strong><span>🔒 {labelRanges(opposing.bookNumbers)}</span><small>Derived from {world} control. No editable faction choice is persisted.</small></div></section><section className="card"><h2>DG-{selectedValue.logicalKey} membership</h2><p>Select a Book to move it from its current logical value into DG-{selectedValue.logicalKey}. All 18 Books remain represented exactly once.</p><div aria-label={`DG-${selectedValue.logicalKey} Book membership`} className="campaign-grouping-books">{Array.from({ length: 18 }, (_, index) => index + 1).map((book) => <button aria-label={`Book ${book} assigned to ${values.find((value) => value.bookNumbers.includes(book))?.logicalKey}`} aria-pressed={selectedValue.bookNumbers.includes(book)} className={selectedValue.bookNumbers.includes(book) ? "selected" : ""} key={book} onClick={() => moveBook(book)} type="button"><small>{book}</small>{selectedValue.bookNumbers.includes(book) ? "●" : ""}</button>)}</div><p className="notice notice--good">{campaignBookSegments(selectedValue.bookNumbers).length} visual segment(s), one logical grouping ID: {labelRanges(selectedValue.bookNumbers)}.</p><h2>Opposing Faction preview — read only</h2><div aria-label="Opposing Faction Book membership" className="campaign-grouping-books locked">{Array.from({ length: 18 }, (_, index) => index + 1).map((book) => <span className={opposing.bookNumbers.includes(book) ? "selected" : ""} key={book}><small>{book}</small>{opposing.bookNumbers.includes(book) ? "●" : ""}</span>)}</div><p>Books 7–12 remain intentionally empty.</p><div className="action-row"><a className="button" href={`/admin/campaign/planner?state=${campaignWorldScreens[world]}`}>Cancel</a><button className="button button--gold" type="button" onClick={() => void apply()}>Apply grouping</button></div>{message && <p className="notice" role="status">{message}</p>}</section></div>;
}

function GroupingEditor({ world }: { world: WorldKey }) {
  const workspace = useQuery({ queryKey: ["campaign", world], queryFn: async () => { const response = await fetch(`/api/admin/campaign?world=${world}`); if (!response.ok) throw new Error("Book groupings could not be loaded."); return response.json() as Promise<CampaignWorkspace>; } });
  if (workspace.isPending) return <p className="notice">Loading Book grouping authority…</p>;
  if (workspace.isError) return <p className="notice notice--bad">{workspace.error.message}</p>;
  const initial = workspace.data.bookGroupings?.disjoint ?? validateDisjointTrilogy(defaultDisjointTrilogy(world), world);
  return <><div className="workspace-page-head"><h2>Book Grouping Membership Editor</h2><p>State-only editor for the editable Disjoint Trilogy overlay.</p></div><GroupingEditorForm initial={initial} key={initial.map((value) => value.bookNumbers.join(",")).join("|")} refetch={() => workspace.refetch()} world={world} /></>;
}

function CampaignManagerLanding() {
  const overlays = [
    { editability: "Editable", grouping: "Disjoint Trilogy", shape: "two disconnected segments" },
    { editability: "Locked · derived", grouping: "Opposing Faction", shape: "Books 1–6 + 13–18" },
    { editability: "Canonical", grouping: "Mirrored Duology", shape: "partner = 19 − Book" },
  ];
  const overlayColumns: DataTableColumnDef<(typeof overlays)[number]>[] = [
    { accessorKey: "grouping", header: "Grouping" },
    { accessorKey: "shape", header: "Shape" },
    { accessorKey: "editability", header: "Editability" },
  ];
  return <div className="stack"><div className="workspace-page-head"><h2>Campaign Manager</h2><p>Author one 18-Book world spine at a time. Group membership may be contiguous, mirrored, or disjoint.</p></div><section className="service-grid" aria-label="Campaign authority summary">{[
    ["Books", "18", "per internal world campaign"],
    ["Book grouping types", "8", "six canonical groupings plus two overlays"],
    ["Disjoint overlays", "2", "editable 3+3 and locked opposing faction"],
    ["World spines", "3", "Concord, Ruin, and Schism"],
  ].map(([label, value, detail]) => <article className="card" key={label}><p className="kicker">{label}</p><p className="stat">{value}</p><p>{detail}</p></article>)}</section><div className="split"><section className="card"><h2>Continue authoring</h2><p>Planner cards span the exact Book rows they own. Each authorable campaign column has its own typed Unassigned listbox.</p><div className="action-row">{Object.entries(campaignWorldScreens).map(([world, state]) => <a className="button button--gold" href={`/admin/campaign/planner?state=${state}`} key={world}>Open {world} planner</a>)}</div></section><section className="card"><h2>Current Book-grouping overlays</h2><DataTable columns={overlayColumns} data={overlays} getRowId={(row) => row.grouping} preferenceKey="admin.campaign.overlays" /></section></div></div>;
}

function CampaignDocumentWorkflow({ screen }: { screen: PageManifestEntry }) {
  const isCorpus = screen.screenId === "CAMPAIGN_DOCUMENT_CORPUS";
  return <div className="stack"><div className="workspace-page-head"><h2>{screen.title}</h2><p>{isCorpus ? "Review the active campaign's historical document corpus in campaign context." : "Plan document quests and their research work in campaign context."}</p></div><section className="card"><h2>{isCorpus ? "Campaign-owned document corpus" : "Campaign-owned research planning"}</h2><p>This surface replaces the unauthorized global Document Bucket workflow. It does not create a parallel document persistence model.</p><a className="button" href="/admin/campaign">Return to Campaign Manager</a></section></div>;
}

export function CampaignAdminPage({ screen }: { screen: PageManifestEntry }) {
  if (["CAMPAIGN_DOCUMENT_CORPUS", "CAMPAIGN_DOCUMENT_QUESTS"].includes(screen.screenId)) return <CampaignDocumentWorkflow screen={screen} />;
  const world = campaignWorld(screen.screenId);
  if (screen.screenId === "CAM006") return <div className="stack">{worldTabs(world)}<GroupingEditor world={world ?? "CONCORD"} /></div>;
  if (!world) return <CampaignManagerLanding />;
  return <Planner screen={screen} world={world} />;
}
