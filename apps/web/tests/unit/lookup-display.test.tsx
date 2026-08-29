import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LookupDisplay } from "../../src/components/LookupDisplay";

describe("LookupDisplay", () => {
  it("keeps a searchable technical ID hidden until explicit disclosure", () => {
    const { container } = render(<LookupDisplay presentation={{
      primary: "Aardvark",
      technicalId: "BRD_AARDVARK",
      context: ["Human"],
    }} />);
    expect(screen.getByText("Aardvark")).toHaveClass("lookup-display__primary");
    expect(screen.queryByText("BRD_AARDVARK")).not.toBeInTheDocument();
    expect(container.querySelector(".lookup-display")).toHaveAttribute(
      "data-search-text",
      expect.stringContaining("brd_aardvark"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Technical details" }));
    expect(screen.getByText("BRD_AARDVARK")).toHaveAttribute("data-copy-value", "BRD_AARDVARK");
  });

  it("renders a real null as an em dash", () => {
    render(<LookupDisplay presentation={null} />);
    expect(screen.getByText("—")).toHaveAccessibleName("None");
  });
});
