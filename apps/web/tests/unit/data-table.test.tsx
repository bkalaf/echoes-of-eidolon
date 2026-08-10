import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DataTable, type DataTableColumnDef } from "../../src/components/DataTable";

interface RowData { name: string; rowId: string; status: string }
const columns: DataTableColumnDef<RowData>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "status", header: "Status" },
];

describe("shared TanStack table engine", () => {
  it("filters, sorts, selects, and stores only namespaced column preferences", () => {
    render(<DataTable columns={columns} data={[{ name: "Beta", rowId: "2", status: "Open" }, { name: "Alpha", rowId: "1", status: "Closed" }]} getRowId={(row) => row.rowId} preferenceKey="test.records" />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Filter table" }), { target: { value: "Alpha" } });
    expect(screen.getByText("1 rows · 0 selected")).toBeInTheDocument();
    expect(screen.queryByText("Beta")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Select row 1" }));
    expect(screen.getByText("1 rows · 1 selected")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Name" }));
    expect(within(screen.getByRole("table")).getByText("Alpha")).toBeInTheDocument();
    const stored = window.localStorage.getItem("echoes.table.test.records.v1") ?? "";
    expect(stored).toContain("columnVisibility");
    expect(stored).not.toMatch(/Alpha|Beta|Closed|Open/);
  });
});
