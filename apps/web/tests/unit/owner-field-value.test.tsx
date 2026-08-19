import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OwnerFieldValue } from "../../src/components/OwnerFieldValue";

describe("OwnerFieldValue", () => {
  it("uses the explicit lookup renderer for a to-one relation", () => {
    render(<OwnerFieldValue field={{ isList: false, kind: "relation", name: "species", type: "Species" }} value={{ name: "Human", speciesId: "SPC_HUMAN" }} />);
    expect(screen.getByText("Human")).toHaveClass("lookup-display__primary");
    expect(screen.getByText("SPC_HUMAN")).toHaveAttribute("data-copy-value", "SPC_HUMAN");
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
});
