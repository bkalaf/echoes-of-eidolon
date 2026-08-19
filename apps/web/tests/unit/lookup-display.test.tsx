import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LookupDisplay } from "../../src/components/LookupDisplay";

describe("LookupDisplay", () => {
  it("renders the human label first and a searchable/copyable canonical ID second", () => {
    const { container } = render(<LookupDisplay presentation={{
      primary: "Aardvark",
      secondary: "BRD_AARDVARK",
      context: ["Human"],
    }} />);
    expect(screen.getByText("Aardvark")).toHaveClass("lookup-display__primary");
    expect(screen.getByText("BRD_AARDVARK")).toHaveAttribute("data-copy-value", "BRD_AARDVARK");
    expect(container.querySelector(".lookup-display")).toHaveAttribute(
      "data-search-text",
      expect.stringContaining("brd_aardvark"),
    );
    expect(container.textContent?.indexOf("Aardvark")).toBeLessThan(container.textContent?.indexOf("BRD_AARDVARK") ?? 0);
  });

  it("renders a real null as an em dash", () => {
    render(<LookupDisplay presentation={null} />);
    expect(screen.getByText("—")).toHaveAccessibleName("None");
  });
});
