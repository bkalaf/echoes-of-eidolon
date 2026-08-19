import {
  columnFilteringFeature,
  columnOrderingFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  tableFeatures,
  useTable,
  type ColumnDef,
  type ColumnFiltersState,
  type ColumnOrderState,
  type ColumnVisibilityState,
  type PaginationState,
  type Row,
  type SortingState,
} from "@tanstack/react-table";
import { Fragment, useEffect, useState } from "react";

export type DataTableFilterVariant = "array" | "boolean" | "date" | "enum" | "number" | "relation" | "text";

interface DataTableColumnMeta {
  filterOptions?: string[];
  filterVariant?: DataTableFilterVariant;
  nullable?: boolean;
}

interface OwnerFilterValue {
  arrayMode?: "all" | "any";
  boolean?: "all" | "no" | "yes";
  empty?: "any" | "empty" | "not-empty";
  from?: string;
  maximum?: string;
  minimum?: string;
  query?: string;
  through?: string;
  values?: string[];
}

function searchable(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function ownerColumnFilter(row: { getValue: (columnId: string) => unknown }, columnId: string, filter: OwnerFilterValue): boolean {
  const value = row.getValue(columnId);
  const empty = value == null || value === "" || (Array.isArray(value) && value.length === 0);
  if (filter.empty === "empty" && !empty) return false;
  if (filter.empty === "not-empty" && empty) return false;
  if (filter.boolean && filter.boolean !== "all" && Boolean(value) !== (filter.boolean === "yes")) return false;
  if (filter.minimum && (typeof value !== "number" || value < Number(filter.minimum))) return false;
  if (filter.maximum && (typeof value !== "number" || value > Number(filter.maximum))) return false;
  if (filter.from) { const time = new Date(String(value)).getTime(); if (!Number.isFinite(time) || time < new Date(filter.from).getTime()) return false; }
  if (filter.through) { const time = new Date(String(value)).getTime(); if (!Number.isFinite(time) || time > new Date(`${filter.through}T23:59:59.999`).getTime()) return false; }
  if (filter.values?.length) {
    const values = Array.isArray(value) ? value.map(String) : [String(value)];
    const matches = filter.values.map((candidate) => values.some((entry) => entry.toLocaleLowerCase().includes(candidate.toLocaleLowerCase())));
    if (filter.arrayMode === "all" ? !matches.every(Boolean) : !matches.some(Boolean)) return false;
  }
  if (filter.query && !searchable(value).toLocaleLowerCase().includes(filter.query.toLocaleLowerCase())) return false;
  return true;
}
ownerColumnFilter.autoRemove = (filter: OwnerFilterValue) => !filter || !filter.query?.trim() && !filter.minimum && !filter.maximum && !filter.from && !filter.through && !filter.values?.length && (!filter.boolean || filter.boolean === "all") && (!filter.empty || filter.empty === "any");

function ownerGlobalFilter(row: { getValue: (columnId: string) => unknown }, columnId: string, filter: string): boolean {
  return searchable(row.getValue(columnId)).toLocaleLowerCase().includes(String(filter).toLocaleLowerCase());
}

interface TablePreferences {
  columnOrder: ColumnOrderState;
  columnVisibility: ColumnVisibilityState;
}

export const dataTableFeatures = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  columnMeta: {} as DataTableColumnMeta,
  filterFns: { includesString: filterFn_includesString, owner: ownerColumnFilter, ownerGlobal: ownerGlobalFilter },
  columnOrderingFeature,
  columnSizingFeature,
  columnResizingFeature,
  columnVisibilityFeature,
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
  rowSelectionFeature,
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric },
});

export type DataTableColumnDef<RowData extends object> = ColumnDef<typeof dataTableFeatures, RowData, unknown>;

function readPreferences(key: string): TablePreferences {
  if (typeof window === "undefined") return { columnOrder: [], columnVisibility: {} };
  try {
    const value = JSON.parse(window.localStorage.getItem(key) ?? "null") as Partial<TablePreferences> | null;
    return {
      columnOrder: Array.isArray(value?.columnOrder) ? value.columnOrder.filter((item): item is string => typeof item === "string") : [],
      columnVisibility: value?.columnVisibility && typeof value.columnVisibility === "object" ? value.columnVisibility : {},
    };
  } catch {
    return { columnOrder: [], columnVisibility: {} };
  }
}

export function DataTable<RowData extends object>({
  ariaLabel,
  columns,
  data,
  getRowId,
  onRowActivate,
  preferenceKey,
  rowClassName,
  searchLabel = "Quick search table",
}: {
  ariaLabel?: string;
  columns: DataTableColumnDef<RowData>[];
  data: RowData[];
  getRowId: (row: RowData) => string;
  onRowActivate?: (row: RowData) => void;
  preferenceKey: string;
  rowClassName?: (row: RowData) => string | undefined;
  searchLabel?: string;
}) {
  const storageKey = `echoes.table.${preferenceKey}.v1`;
  const [preferences] = useState(() => readPreferences(storageKey));
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(preferences.columnOrder);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>(preferences.columnVisibility);
  const [globalFilter, setGlobalFilter] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 25 });
  const [rowSelection, setRowSelection] = useState({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data,
    defaultColumn: { filterFn: "owner" },
    enableRowSelection: true,
    getRowId,
    globalFilterFn: "ownerGlobal",
    onColumnFiltersChange: setColumnFilters,
    onColumnOrderChange: setColumnOrder,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    state: { columnFilters, columnOrder, columnVisibility, globalFilter, pagination, rowSelection, sorting },
  });

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify({ columnOrder, columnVisibility } satisfies TablePreferences));
  }, [columnOrder, columnVisibility, storageKey]);

  const moveColumn = (columnId: string, offset: -1 | 1) => {
    const order = table.getAllLeafColumns().map((column) => column.id);
    const current = order.indexOf(columnId);
    const target = current + offset;
    if (current < 0 || target < 0 || target >= order.length) return;
    [order[current], order[target]] = [order[target]!, order[current]!];
    setColumnOrder(order);
  };

  const activate = (row: Row<typeof dataTableFeatures, RowData>) => onRowActivate?.(row.original);
  const filteredCount = table.getFilteredRowModel().rows.length;
  const clearFilters = () => {
    setGlobalFilter("");
    setColumnFilters([]);
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  };
  const headerLabel = (column: (typeof table.getAllLeafColumns extends () => Array<infer T> ? T : never)) => {
    const header = column.columnDef.header;
    return typeof header === "string" ? header : column.id;
  };
  const filterDetails = (column: (typeof table.getAllLeafColumns extends () => Array<infer T> ? T : never)) => {
    const values = table.getCoreRowModel().rows.map((row) => row.getValue(column.id));
    const present = values.filter((value) => value != null && value !== "");
    const meta = column.columnDef.meta;
    const label = headerLabel(column);
    const distinct = [...new Set(present.map((value) => String(value)))].sort((left, right) => left.localeCompare(right));
    const enumLike = /status|state|type|kind|category|classification|role|source|operation|department|world|lifecycle/i.test(`${column.id} ${label}`)
      || distinct.length > 0 && distinct.length <= 20 && distinct.every((value) => /^[A-Z][A-Z0-9_ -]*$/.test(value));
    const dateLike = /(?:At|Date|Time|Created|Updated|Occurred|Expires|Recorded|Start|End)\b/i.test(`${column.id} ${label}`)
      && present.some((value) => Number.isFinite(new Date(String(value)).getTime()));
    const variant = meta?.filterVariant
      ?? (present.some(Array.isArray) ? "array" : present.some((value) => typeof value === "boolean") ? "boolean" : present.some((value) => typeof value === "number") ? "number" : dateLike ? "date" : enumLike ? "enum" : "text");
    return { label, nullable: meta?.nullable ?? values.some((value) => value == null || value === ""), options: meta?.filterOptions ?? distinct, variant };
  };
  const setTypedFilter = (column: (typeof table.getAllLeafColumns extends () => Array<infer T> ? T : never), changes: Partial<OwnerFilterValue>) => {
    column.setFilterValue({ ...((column.getFilterValue() as OwnerFilterValue | undefined) ?? {}), ...changes });
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  };
  const filterControl = (column: (typeof table.getAllLeafColumns extends () => Array<infer T> ? T : never)) => {
    const { label, nullable, options, variant } = filterDetails(column);
    const value = (column.getFilterValue() as OwnerFilterValue | undefined) ?? {};
    const emptyControl = nullable && <select aria-label={`Empty ${label}`} className="select input--compact" value={value.empty ?? "any"} onChange={(event) => setTypedFilter(column, { empty: event.target.value as OwnerFilterValue["empty"] })}><option value="any">Any value</option><option value="empty">Is empty</option><option value="not-empty">Is not empty</option></select>;
    let primary;
    if (variant === "boolean") primary = <select aria-label={`Filter ${label}`} className="select input--compact" value={value.boolean ?? "all"} onChange={(event) => setTypedFilter(column, { boolean: event.target.value as OwnerFilterValue["boolean"] })}><option value="all">All</option><option value="yes">Yes</option><option value="no">No</option></select>;
    else if (variant === "number") primary = <div className="data-table-range"><input aria-label={`Minimum ${label}`} className="input input--compact" type="number" value={value.minimum ?? ""} onChange={(event) => setTypedFilter(column, { minimum: event.target.value })} /><input aria-label={`Maximum ${label}`} className="input input--compact" type="number" value={value.maximum ?? ""} onChange={(event) => setTypedFilter(column, { maximum: event.target.value })} /></div>;
    else if (variant === "date") primary = <div className="data-table-range"><input aria-label={`${label} from`} className="input input--compact" type="date" value={value.from ?? ""} onChange={(event) => setTypedFilter(column, { from: event.target.value })} /><input aria-label={`${label} through`} className="input input--compact" type="date" value={value.through ?? ""} onChange={(event) => setTypedFilter(column, { through: event.target.value })} /></div>;
    else if (variant === "enum") primary = <select aria-label={`Filter ${label} values`} className="select input--compact" multiple value={value.values ?? []} onChange={(event) => setTypedFilter(column, { values: Array.from(event.target.selectedOptions, (option) => option.value) })}>{options.map((option) => <option key={option}>{option}</option>)}</select>;
    else if (variant === "array") primary = <div className="data-table-range"><input aria-label={`Filter ${label}`} className="input input--compact" placeholder="Comma-separated values" type="search" value={value.values?.join(", ") ?? ""} onChange={(event) => setTypedFilter(column, { values: event.target.value.split(",").map((entry) => entry.trim()).filter(Boolean) })} /><select aria-label={`${label} match mode`} className="select input--compact" value={value.arrayMode ?? "any"} onChange={(event) => setTypedFilter(column, { arrayMode: event.target.value as OwnerFilterValue["arrayMode"] })}><option value="any">Contains any</option><option value="all">Contains all</option></select></div>;
    else primary = <input aria-label={`Filter ${label}`} className="input input--compact" placeholder={variant === "relation" ? "Search name or ID" : undefined} type="search" value={value.query ?? ""} onChange={(event) => setTypedFilter(column, { query: event.target.value })} />;
    return <div className="data-table-filter-control">{primary}{emptyControl}</div>;
  };
  const stickyCell = (columnId: string, index: number) => columnId === "actions" ? { className: "data-table__actions", style: { right: 0 } } : index < 2 ? { className: `data-table__identity data-table__identity--${index + 1}`, style: { left: 42 + table.getVisibleLeafColumns().slice(0, index).reduce((sum, column) => sum + column.getSize(), 0) } } : { className: undefined, style: undefined };
  return <div className="data-table-engine">
    <div className="action-row action-row--between data-table-toolbar">
      <label className="field">{searchLabel}<input aria-label={searchLabel} className="input" type="search" value={globalFilter} onChange={(event) => setGlobalFilter(event.target.value)} /></label>
      <button className="button button--small" onClick={clearFilters} type="button">Clear filters</button>
      <span className="tag">{data.length} total · {filteredCount} shown</span>
      <span className="tag">{table.getSelectedRowModel().rows.length} selected</span>
      <details><summary>Columns</summary><div className="column-controls">{table.getAllLeafColumns().map((column) => <div key={column.id}><span><input aria-label={`Show ${column.id} column`} checked={column.getIsVisible()} onChange={column.getToggleVisibilityHandler()} type="checkbox" /> {column.id}</span><button aria-label={`Move ${column.id} left`} onClick={() => moveColumn(column.id, -1)} type="button">←</button><button aria-label={`Move ${column.id} right`} onClick={() => moveColumn(column.id, 1)} type="button">→</button></div>)}</div></details>
    </div>
    <div className="table-scroll"><table aria-label={ariaLabel} className="data-table" style={{ width: table.getTotalSize() }}>
      <thead>{table.getHeaderGroups().map((group) => <Fragment key={group.id}><tr><th aria-label="Select rows" className="data-table__selection" rowSpan={2}><input aria-label="Select all visible rows" checked={table.getIsAllRowsSelected()} onChange={table.getToggleAllRowsSelectedHandler()} type="checkbox" /></th>{group.headers.map((header, index) => { const sticky = stickyCell(header.column.id, index); return <th aria-sort={header.column.getIsSorted() === "asc" ? "ascending" : header.column.getIsSorted() === "desc" ? "descending" : "none"} className={sticky.className} key={header.id} style={{ ...sticky.style, width: header.getSize() }}><button aria-label={`${header.column.getCanSort() ? "Sort by" : "Column"} ${headerLabel(header.column)}`} className="table-sort" disabled={!header.column.getCanSort()} onClick={header.column.getToggleSortingHandler()} type="button">{header.isPlaceholder ? null : <table.FlexRender header={header} />}{header.column.getIsSorted() === "asc" ? " ↑" : header.column.getIsSorted() === "desc" ? " ↓" : ""}</button>{header.column.getCanResize() && <span aria-label={`Resize ${headerLabel(header.column)} column`} className={`column-resizer${header.column.getIsResizing() ? " is-resizing" : ""}`} onMouseDown={header.getResizeHandler()} onTouchStart={header.getResizeHandler()} role="separator" />}</th>; })}</tr><tr className="data-table-filters">{group.headers.map((header, index) => { const sticky = stickyCell(header.column.id, index); return <th className={sticky.className} key={`${header.id}-filter`} style={sticky.style}>{header.column.getCanFilter() && filterControl(header.column)}</th>; })}</tr></Fragment>)}</thead>
      <tbody>{table.getRowModel().rows.map((row) => <tr aria-selected={row.getIsSelected()} className={rowClassName?.(row.original)} key={row.id} onClick={() => activate(row)} onKeyDown={(event) => { if (onRowActivate && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); activate(row); } }} tabIndex={onRowActivate ? 0 : undefined}><td className="data-table__selection"><input aria-label={`Select row ${row.id}`} checked={row.getIsSelected()} onChange={row.getToggleSelectedHandler()} onClick={(event) => event.stopPropagation()} type="checkbox" /></td>{row.getVisibleCells().map((cell, index) => { const sticky = stickyCell(cell.column.id, index); return <td className={sticky.className} key={cell.id} style={sticky.style}><table.FlexRender cell={cell} /></td>; })}</tr>)}</tbody>
    </table></div>
    {filteredCount === 0 && <p className="empty-state">{data.length === 0 ? "No records." : "No records match the current filters."}</p>}
    <div className="action-row action-row--between data-table-pagination"><label className="field">Rows per page<select aria-label="Rows per page" className="select" value={pagination.pageSize} onChange={(event) => table.setPageSize(Number(event.target.value))}>{[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}</select></label><span>Page {pagination.pageIndex + 1} of {Math.max(table.getPageCount(), 1)}</span><div className="action-row"><button aria-label="First page" className="button button--small" disabled={!table.getCanPreviousPage()} onClick={() => table.firstPage()} type="button">First</button><button aria-label="Previous page" className="button button--small" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()} type="button">Previous</button><button aria-label="Next page" className="button button--small" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()} type="button">Next</button><button aria-label="Last page" className="button button--small" disabled={!table.getCanNextPage()} onClick={() => table.lastPage()} type="button">Last</button></div></div>
  </div>;
}
