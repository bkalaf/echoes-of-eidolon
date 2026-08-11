import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

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
  objectId: string;
  objectType: CampaignObjectType;
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
      left.segments[0]!.startBook - right.segments[0]!.startBook || left.campaignPlacementId.localeCompare(right.campaignPlacementId));
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

function stateNotice(screenId: string) {
  if (screenId === "CAM003") return <p className="notice notice--good">Witness drop preview: the required linked group is validated and committed as one transaction.</p>;
  if (screenId === "CAM004") return <p className="notice notice--bad">Invalid Architect drop preview: an incomplete linked group mutates nothing.</p>;
  if (screenId === "CAM005") return <p className="notice notice--good">Reward binding preview: Witness, Architect, Reward, ATROCITY, and required Interludes stay aligned.</p>;
  if (screenId === "CAM007") return <p className="notice">Custom column view: presentation order and visibility are persisted locally without changing campaign or grouping data.</p>;
  return null;
}

function PlannerGrid({ columns, groupings, moveColumn, onDropItem, placements, selected, toggle, unassigned, world }: {
  columns: typeof campaignPlannerColumns[number][];
  groupings: CampaignWorkspace["bookGroupings"];
  moveColumn: (moving: CampaignPlannerColumnId, target: CampaignPlannerColumnId) => void;
  onDropItem: (item: CampaignCatalogItem, book: number) => void;
  placements: CampaignPlacementView[];
  selected: ReadonlySet<string>;
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
  return <>{invalid.length > 0 && <div className="notice notice--bad" role="alert"><strong>{invalid.length} campaign placement{invalid.length === 1 ? "" : "s"} could not be rendered.</strong><span>{invalid.map((placement) => `${placement.campaignPlacementId}: ${placement.reason}`).join(" · ")}</span></div>}<div className="table-scroll"><div aria-label={`${world} 18-Book campaign planner`} className="campaign-planner-grid" role="table" style={{ gridTemplateColumns: `58px repeat(${columns.length}, minmax(118px, 1fr))`, gridTemplateRows: "126px repeat(18, 44px)", minWidth: `${58 + columns.length * 118}px` }}><div className="campaign-planner-row" role="row"><div className="campaign-planner-header" role="columnheader" style={{ gridColumn: 1, gridRow: 1 }}>Book</div>{columns.map((column, index) => { const items = column.objectTypes.flatMap((objectType) => unassigned[objectType] ?? []); return <div className="campaign-planner-header campaign-column-header" draggable key={column.id} onDragStart={(event) => event.dataTransfer.setData("application/x-eidolon-column", column.id)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const moving = event.dataTransfer.getData("application/x-eidolon-column") as CampaignPlannerColumnId; if (moving) moveColumn(moving, column.id); }} role="columnheader" style={{ gridColumn: index + 2, gridRow: 1 }}><strong>{column.label}</strong><ColumnUnassignedListbox columnId={column.id} items={items} selected={selected} toggle={toggle} /></div>; })}</div>{books.map((book) => <div className="campaign-planner-row" key={book} role="row"><div className="campaign-planner-book" role="rowheader" style={{ gridColumn: 1, gridRow: book + 1 }}>{book}</div>{columns.map((column, index) => { const locked = column.id === "OPPOSING_FACTION" || column.id === "DISJOINT_TRILOGY"; return <div aria-label={`Book ${book} ${column.label}: ${locked ? "grouping-owned" : occupied(column.id, book) ? "assigned" : "drop target"}`} className="campaign-planner-cell" key={column.id} role="cell" style={{ gridColumn: index + 2, gridRow: book + 1 }}>{!locked && !occupied(column.id, book) && <button aria-label={`Book ${book} ${column.label}: empty assignment cell`} className="campaign-drop-target" data-book={book} data-column={column.id} onClick={() => { const item = column.objectTypes.flatMap((objectType) => unassigned[objectType] ?? []).find((candidate) => selected.has(`${candidate.objectType}:${candidate.objectId}`)); if (item) onDropItem(item, book); }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const raw = event.dataTransfer.getData("application/x-eidolon-campaign"); if (raw) onDropItem(JSON.parse(raw) as CampaignCatalogItem, book); }} type="button">Drop</button>}</div>; })}{positioned.flatMap((placement) => placement.segments.map((segment, segmentIndex) => segment.startBook === book && columnIndex.has(placement.columnId) ? <span aria-label={`${placement.objectId}, ${placement.objectType}, Book segment ${segmentIndex + 1} of ${placement.segments.length}, Books ${segment.startBook} through ${segment.endBook}`} aria-rowspan={segment.rowSpan} className="tag campaign-placement-card" data-book-span={segment.rowSpan} data-category={placement.objectType} data-lane={placement.lane} data-lane-count={placement.laneCount} data-logical-placement-id={placement.campaignPlacementId} data-segment-index={segmentIndex} data-start-book={segment.startBook} data-testid={`campaign-placement-${placement.campaignPlacementId}${placement.segments.length > 1 ? `-segment-${segmentIndex}` : ""}`} draggable key={`${placement.campaignPlacementId}:${segmentIndex}`} role="cell" style={styleFor(placement.columnId, segment, placement.lane, placement.laneCount)}>{placement.objectId}</span> : []))}{groupingItems.flatMap((grouping) => grouping.segments.map((segment, segmentIndex) => segment.startBook === book && columnIndex.has(grouping.groupingType) ? <span aria-label={`${grouping.logicalKey}, ${grouping.groupingType}, segment ${segmentIndex + 1} of ${grouping.segments.length}`} aria-rowspan={segment.rowSpan} className={`tag campaign-placement-card ${grouping.editability === "LOCKED" ? "locked" : "grouping"}`} data-book-span={segment.rowSpan} data-grouping-value-id={grouping.bookGroupingValueId} data-segment-index={segmentIndex} data-start-book={segment.startBook} data-testid={`book-grouping-${grouping.bookGroupingValueId}-segment-${segmentIndex}`} key={`${grouping.bookGroupingValueId}:${segmentIndex}`} role="cell" style={styleFor(grouping.groupingType, segment)}>{grouping.logicalKey}</span> : []))}</div>)}</div></div></>;
}

function Planner({ screen, world }: { screen: PageManifestEntry; world: WorldKey }) {
  const campaign = useQuery({ queryKey: ["campaign", world], queryFn: async () => { const response = await fetch(`/api/admin/campaign?world=${world}`); if (!response.ok) throw new Error("Campaign could not be loaded."); return response.json() as Promise<CampaignWorkspace>; } });
  const preferences = useCampaignColumnPreferences(world);
  const visibleColumns = preferences.order.filter((id) => preferences.visibility[id] !== false).map((id) => campaignPlannerColumns.find((column) => column.id === id)!);
  const [selectedItems, setSelectedItems] = useState<CampaignCatalogItem[]>([]);
  const [message, setMessage] = useState("");
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
  const fallbackGroupings = { disjoint: validateDisjointTrilogy(defaultDisjointTrilogy(world), world), opposingFaction: opposingFactionGrouping(world) };
  const workspace = campaign.data;
  return <div className="stack">{worldTabs(world)}<div className="toolbar" aria-label="Campaign planner filters"><span className="button" aria-label={`World filter: ${world}`}>{world}</span><span className="button" aria-label="Book filter: Books 1 through 18">Books 1–18</span><span className="button" aria-label="Linked-type filter: All linked types">All linked types</span><ColumnLayoutManager preferences={preferences} /></div>{stateNotice(screen.screenId)}<section className="card campaign-planner-card"><PlannerGrid columns={visibleColumns} groupings={workspace?.bookGroupings ?? fallbackGroupings} moveColumn={preferences.moveBefore} onDropItem={(item, book) => void commitDrop(item, book)} placements={workspace?.campaign?.placements ?? []} selected={selected} toggle={toggle} unassigned={workspace?.unassigned ?? emptyUnassigned} world={world} /></section>{campaign.isPending && <p className="notice">Loading campaign assignments…</p>}{campaign.isError && <p className="notice notice--bad">{campaign.error.message}</p>}{message && <p className="notice" role="status">{message}</p>}<section className="card"><h2>Linked drag groups</h2><p>{linkedGroupSummary()}</p><p>Choose required records in their typed Unassigned listboxes, then drop once. The server commits the complete group or nothing.</p></section></div>;
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
  return <div className="stack"><div className="workspace-page-head"><h2>Campaign Manager</h2><p>Author one 18-Book world spine at a time. Group membership may be contiguous, mirrored, or disjoint.</p></div><section className="service-grid" aria-label="Campaign authority summary">{[
    ["Books", "18", "per internal world campaign"],
    ["Book grouping types", "8", "six canonical groupings plus two overlays"],
    ["Disjoint overlays", "2", "editable 3+3 and locked opposing faction"],
    ["World spines", "3", "Concord, Ruin, and Schism"],
  ].map(([label, value, detail]) => <article className="card" key={label}><p className="kicker">{label}</p><p className="stat">{value}</p><p>{detail}</p></article>)}</section><div className="split"><section className="card"><h2>Continue authoring</h2><p>Planner cards span the exact Book rows they own. Each authorable campaign column has its own typed Unassigned listbox.</p><div className="action-row">{Object.entries(campaignWorldScreens).map(([world, state]) => <a className="button button--gold" href={`/admin/campaign/planner?state=${state}`} key={world}>Open {world} planner</a>)}</div></section><section className="card"><h2>Current Book-grouping overlays</h2><table className="data-table"><thead><tr><th>Grouping</th><th>Shape</th><th>Editability</th></tr></thead><tbody><tr><td>Disjoint Trilogy</td><td>two disconnected segments</td><td>Editable</td></tr><tr><td>Opposing Faction</td><td>Books 1–6 + 13–18</td><td>Locked · derived</td></tr><tr><td>Mirrored Duology</td><td>partner = 19 − Book</td><td>Canonical</td></tr></tbody></table></section></div></div>;
}

export function CampaignAdminPage({ screen }: { screen: PageManifestEntry }) {
  const world = campaignWorld(screen.screenId);
  if (screen.screenId === "CAM006") return <div className="stack">{worldTabs(world)}<GroupingEditor world={world ?? "CONCORD"} /></div>;
  if (!world) return <CampaignManagerLanding />;
  return <Planner screen={screen} world={world} />;
}
