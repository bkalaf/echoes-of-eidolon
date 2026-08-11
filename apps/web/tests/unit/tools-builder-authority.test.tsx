import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { pageManifest } from "../../src/lib/page-manifest";
import { ToolsPage } from "../../src/screens/tools/ToolsPage";

function renderTool(screenId: string) {
  render(<ToolsPage screen={pageManifest.find((entry) => entry.screenId === screenId)!} />);
}

describe("wireframe tool authority", () => {
  it("uses the locked Component Composer palette", () => {
    renderTool("TOOL005");
    for (const name of ["Public TopBar", "Hero", "Feature Carousel", "Data Table", "Modal", "Game BottomBar"]) expect(screen.getByRole("button", { name })).toBeInTheDocument();
    expect(screen.queryByText("Untitled task")).not.toBeInTheDocument();
  });

  it("uses the locked shared component library", () => {
    renderTool("TOO002");
    for (const name of ["Top Bar", "Data Table", "Lookup Control", "Modal", "Map View", "Globe View"]) expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Game HUD" })).not.toBeInTheDocument();
  });

  it("uses the locked template names", () => {
    renderTool("TOO003");
    for (const name of ["Public detail page", "Admin table workspace", "Admin editor", "Split map workspace", "Campaign planner", "Game overlay"]) expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Account form" })).not.toBeInTheDocument();
  });

  it("does not substitute the composer for the review queue", () => {
    renderTool("TOO001");
    expect(screen.getByRole("heading", { name: "Wireframe Review Queue" })).toBeInTheDocument();
    expect(screen.getByText("AT004_FOUND_CITY")).toBeInTheDocument();
    expect(screen.getByText(`${pageManifest.length} of ${pageManifest.length}`)).toBeInTheDocument();
    expect(screen.queryByText("Untitled task")).not.toBeInTheDocument();
  });
});
