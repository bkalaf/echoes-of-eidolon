import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RelationAutocomplete } from "../../src/components/RelationAutocomplete";

describe("RelationAutocomplete", () => {
  it("opens on demand, searches the complete collection by label or hidden technical ID, selects, and paginates", () => {
    const records = Array.from({ length: 120 }, (_, index) => ({ breedId: `BRD_${index}`, name: index === 119 ? "Blue whale" : `Breed ${index}`, species: { name: "Mammal" }, culture: null }));
    const onChange = vi.fn();
    render(<RelationAutocomplete disabled={false} idField="breedId" label="Breed" loading={false} nullable records={records} relationType="Breed" value="" onChange={onChange} />);
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    fireEvent.click(screen.getByRole("combobox", { name: "Search Breed" }));
    expect(screen.getByText("120 matches · showing 1–50 of 120")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Search Breed" }), { target: { value: "blue whale" } });
    expect(screen.getByText("1 matches · showing 1–1 of 120")).toBeInTheDocument();
    expect(screen.getByText("Blue whale")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Search Breed" }), { target: { value: "BRD_119" } });
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Search Breed" }), { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("BRD_119");
  });
});
