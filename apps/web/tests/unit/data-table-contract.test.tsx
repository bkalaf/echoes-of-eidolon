import { fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { DataTable, type DataTableColumnDef } from "../../src/components/DataTable";

type Row = { createdAt: string; enabled: boolean; id: string; name: string | null; score: number; status: string };

const columns: DataTableColumnDef<Row>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "id", header: "ID", id: "id", meta: { technical: true } },
  { accessorKey: "status", header: "Status" },
  { accessorKey: "enabled", header: "Enabled" },
  { accessorKey: "score", header: "Score" },
  { accessorKey: "createdAt", header: "Created At" },
];
const data = Array.from({ length: 26 }, (_, index) => ({
  createdAt: `2026-08-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`,
  enabled: index % 2 === 0,
  id: `ID_${String(index + 1).padStart(2, "0")}`,
  name: index === 0 ? null : `Item ${index + 1}`,
  score: index + 1,
  status: index % 2 ? "ACTIVE" : "DRAFT",
}));

describe("universal owner data table", () => {
  it("provides quick search, per-column filters, clear filters, counts, sorting, and pagination", () => {
    render(<DataTable columns={columns} data={data} getRowId={(row) => row.id} preferenceKey="contract-test" />);
    expect(screen.getByText("26 total · 26 shown")).toBeInTheDocument();
    expect(screen.getByText("Advanced filters").closest("details")).not.toHaveAttribute("open");
    expect(screen.queryByRole("columnheader", { name: /ID/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Quick search table")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Advanced filters", { exact: true }));
    expect(screen.getByLabelText("Filter Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter ID")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter Status values")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Quick search table"), { target: { value: "Item 26" } });
    expect(screen.getByText("26 total · 1 shown")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByText("Item 26")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByText("26 total · 26 shown")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Quick search table"), { target: { value: "ID_26" } });
    expect(screen.getByText("26 total · 1 shown")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByText("Item 26")).toBeInTheDocument();
  });

  it("has mechanical sticky-header, zebra-row, focus, and horizontal-scroll styling", () => {
    const styles = readFileSync(resolve(import.meta.dirname, "../../src/styles.css"), "utf8");
    expect(styles).toMatch(/\.data-table thead\s*\{[^}]*position:\s*sticky/s);
    expect(styles).toMatch(/\.data-table tbody tr:nth-child\(even\)/);
    expect(styles).toMatch(/\.data-table tbody tr:focus-visible/);
    expect(styles).toMatch(/\.table-scroll\s*\{[^}]*overflow:\s*auto/s);
    expect(styles).toMatch(/\.data-table__identity/);
    expect(styles).not.toMatch(/\.data-table__actions\s*\{[^}]*position:\s*sticky/s);
  });

  it("uses field-appropriate boolean, number, date, enum, and nullable filter controls", () => {
    render(<DataTable columns={columns} data={data} getRowId={(row) => row.id} preferenceKey="typed-filter-test" />);
    fireEvent.click(screen.getByText("Advanced filters", { exact: true }));
    expect(screen.getByLabelText("Filter Status values")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter Enabled")).toHaveRole("combobox");
    expect(screen.getByLabelText("Minimum Score")).toHaveAttribute("type", "number");
    expect(screen.getByLabelText("Maximum Score")).toHaveAttribute("type", "number");
    expect(screen.getByLabelText("Created At from")).toHaveAttribute("type", "date");
    expect(screen.getByLabelText("Created At through")).toHaveAttribute("type", "date");
    expect(screen.getByLabelText("Empty Name")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter Enabled"), { target: { value: "no" } });
    expect(screen.getByText("26 total · 13 shown")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    fireEvent.change(screen.getByLabelText("Minimum Score"), { target: { value: "26" } });
    expect(screen.getByText("26 total · 1 shown")).toBeInTheDocument();
  });

  it("does not truncate the generic Data Registry to a convenient field subset", () => {
    const source = readFileSync(resolve(import.meta.dirname, "../../src/screens/admin/EntityDataAdminPage.tsx"), "utf8");
    expect(source).not.toContain("contract.fields.slice(0, 6)");
    expect(source).toContain("<DataTable");
    expect(source).toContain("contract.auditFields");
  });
});
