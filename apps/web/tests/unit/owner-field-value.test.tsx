import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OwnerFieldValue } from "../../src/components/OwnerFieldValue";

describe("OwnerFieldValue", () => {
  it("uses the explicit lookup renderer for a to-one relation", () => {
    render(<OwnerFieldValue field={{ isList: false, kind: "relation", name: "species", type: "Species" }} value={{ name: "Human", speciesId: "SPC_HUMAN" }} />);
    expect(screen.getByText("Human")).toHaveClass("lookup-display__primary");
    expect(screen.queryByText("SPC_HUMAN")).not.toBeInTheDocument();
  });

  it("makes a missing presentation contract visible instead of falling back to a raw ID", () => {
    render(<OwnerFieldValue field={{ isList: false, kind: "relation", name: "asset", type: "ManagedAsset" }} value={{ managedAssetId: "AST_1" }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Missing lookup presentation: ManagedAsset");
  });

  it("renders scalar and null values without literal null or undefined text", () => {
    const { rerender } = render(<OwnerFieldValue field={{ isList: false, kind: "scalar", name: "count", type: "Int" }} value={12} />);
    expect(screen.getByText("12")).toBeInTheDocument();
    rerender(<OwnerFieldValue field={{ isList: false, kind: "scalar", name: "count", type: "Int" }} value={null} />);
    expect(screen.getByText("—")).toHaveAccessibleName("None");
  });

  it("renders a canonical Breed group as its human-readable label", () => {
    render(<OwnerFieldValue field={{ isList: false, kind: "enum", name: "groupId", type: "BreedGroupId" }} value="B07" />);
    expect(screen.getByText("Elephants, Hyraxes & Afrotherians")).toBeInTheDocument();
  });

  it.each([
    ["department", "ArchitectDepartment", "NANOTECHNOLOGY", "Nanotechnology"],
    ["worldKey", "WorldKey", "CONCORD", "Concord"],
    ["color", "Color", "SPECTRAL_VIOLET", "Spectral violet"],
    ["faction", "Faction", "SCHISM", "Schism"],
    ["primaryAttribute", "AbilityType", "CHARISMA", "Charisma"],
  ])("humanizes %s owner-facing tokens", (name, type, value, expected) => {
    render(<OwnerFieldValue field={{ isList: false, kind: "enum", name, type }} value={value} />);
    expect(screen.getByText(expected)).toBeInTheDocument();
    expect(screen.queryByText(value)).not.toBeInTheDocument();
  });

  it("humanizes the persisted String-backed gender vocabulary", () => {
    render(<OwnerFieldValue field={{ isList: false, kind: "scalar", name: "gender", type: "String" }} value="NON_BINARY" />);
    expect(screen.getByText("Non-binary")).toBeInTheDocument();
    expect(screen.queryByText("NON_BINARY")).not.toBeInTheDocument();
  });

  it("humanizes the persisted String-backed Witness kernel vocabulary", () => {
    render(<OwnerFieldValue field={{ isList: false, kind: "scalar", name: "kernelKey", type: "String" }} value="SELF_SACRIFICE" />);
    expect(screen.getByText("Self sacrifice")).toBeInTheDocument();
  });

  it("renders spectral color JSON as owner-facing percentages", () => {
    render(<OwnerFieldValue field={{ isList: false, kind: "json", name: "color", type: "Json" }} value={{ GREEN: 0, WHITE: 100, SPECTRAL_VIOLET: 0 }} />);
    expect(screen.getByText("Spectral violet 0% · Green 0% · White 100%")).toBeInTheDocument();
    expect(screen.queryByText(/SPECTRAL_VIOLET/)).not.toBeInTheDocument();
  });

  it.each([
    ["legendaryReward", "LegendaryReward", "No reward"],
    ["constellationBefore", "Constellation", "No constellation"],
    ["occupation", "Occupation", "Not assigned"],
  ])("uses a field-specific null label for %s", (name, type, expected) => {
    render(<OwnerFieldValue field={{ isList: false, kind: "relation", name, type }} value={null} />);
    expect(screen.getByText(expected)).toBeInTheDocument();
  });
});
