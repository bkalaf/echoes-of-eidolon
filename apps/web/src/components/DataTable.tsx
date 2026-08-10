import {
  columnFilteringFeature,
  columnOrderingFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  tableFeatures,
  useTable,
  type ColumnDef,
  type ColumnOrderState,
  type ColumnVisibilityState,
  type Row,
  type SortingState,
} from "@tanstack/react-table";
import { useEffect, useState } from "react";

interface TablePreferences {
  columnOrder: ColumnOrderState;
  columnVisibility: ColumnVisibilityState;
}

export const dataTableFeatures = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  filterFns: { includesString: filterFn_includesString },
  columnOrderingFeature,
  columnVisibilityFeature,
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
  columns,
  data,
  getRowId,
  onRowActivate,
  preferenceKey,
  rowClassName,
}: {
  columns: DataTableColumnDef<RowData>[];
  data: RowData[];
  getRowId: (row: RowData) => string;
  onRowActivate?: (row: RowData) => void;
  preferenceKey: string;
  rowClassName?: (row: RowData) => string | undefined;
}) {
  const storageKey = `echoes.table.${preferenceKey}.v1`;
  const [preferences] = useState(() => readPreferences(storageKey));
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(preferences.columnOrder);
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>(preferences.columnVisibility);
  const [globalFilter, setGlobalFilter] = useState("");
  const [rowSelection, setRowSelection] = useState({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data,
    enableRowSelection: true,
    getRowId,
    globalFilterFn: "includesString",
    onColumnOrderChange: setColumnOrder,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    state: { columnOrder, columnVisibility, globalFilter, rowSelection, sorting },
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
  return <div className="data-table-engine"><div className="action-row action-row--between"><label className="field">Filter table<input className="input" type="search" value={globalFilter} onChange={(event) => setGlobalFilter(event.target.value)} /></label><span className="tag">{table.getFilteredRowModel().rows.length} rows · {table.getSelectedRowModel().rows.length} selected</span><details><summary>Columns</summary><div className="column-controls">{table.getAllLeafColumns().map((column) => <div key={column.id}><label><input checked={column.getIsVisible()} onChange={column.getToggleVisibilityHandler()} type="checkbox" /> {column.id}</label><button aria-label={`Move ${column.id} left`} onClick={() => moveColumn(column.id, -1)} type="button">←</button><button aria-label={`Move ${column.id} right`} onClick={() => moveColumn(column.id, 1)} type="button">→</button></div>)}</div></details></div><div className="table-scroll"><table className="data-table"><thead>{table.getHeaderGroups().map((group) => <tr key={group.id}><th aria-label="Select rows"><input aria-label="Select all visible rows" checked={table.getIsAllRowsSelected()} onChange={table.getToggleAllRowsSelectedHandler()} type="checkbox" /></th>{group.headers.map((header) => <th aria-sort={header.column.getIsSorted() === "asc" ? "ascending" : header.column.getIsSorted() === "desc" ? "descending" : "none"} key={header.id}><button className="table-sort" disabled={!header.column.getCanSort()} onClick={header.column.getToggleSortingHandler()} type="button">{header.isPlaceholder ? null : <table.FlexRender header={header} />}{header.column.getIsSorted() === "asc" ? " ↑" : header.column.getIsSorted() === "desc" ? " ↓" : ""}</button></th>)}</tr>)}</thead><tbody>{table.getRowModel().rows.map((row) => <tr className={rowClassName?.(row.original)} key={row.id} onClick={() => activate(row)} onKeyDown={(event) => { if (onRowActivate && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); activate(row); } }} tabIndex={onRowActivate ? 0 : undefined}><td><input aria-label={`Select row ${row.id}`} checked={row.getIsSelected()} onChange={row.getToggleSelectedHandler()} onClick={(event) => event.stopPropagation()} type="checkbox" /></td>{row.getVisibleCells().map((cell) => <td key={cell.id}><table.FlexRender cell={cell} /></td>)}</tr>)}</tbody></table></div></div>;
}
