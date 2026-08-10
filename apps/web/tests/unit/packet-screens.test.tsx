import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { pageManifest } from "../../src/lib/page-manifest";
import { PacketScreen } from "../../src/screens/PacketScreen";

function entry(screenId: string) {
  return pageManifest.find((item) => item.screenId === screenId)!;
}

function renderPacket(screenId: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <PacketScreen screen={entry(screenId)} />
    </QueryClientProvider>,
  );
}

describe("packet screens", () => {
  it.each([
    ["PUB016", "Game & Server Status"],
    ["AUTH01", "Sign In"],
    ["ACC008", "Subscription - Active"],
    ["STORE10", "Order Confirmation"],
    ["DATA_WITNESS_EDIT", "Edit Witness"],
    ["DATA_BREED_IMPORT", "Bulk Import Breed"],
    ["ATLAS_POI_3D", "Points of Interest — 3D View"],
    ["CAMPAIGN_CONCORD", "Main 18-Book Planner — Concord"],
  ])("renders the %s reviewed task", (screenId, heading) => {
    renderPacket(screenId);
    expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
  });

  it("implements every state-only manifest entry", () => {
    for (const item of pageManifest.filter((candidate) => candidate.path === null)) {
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const view = render(
        <QueryClientProvider client={queryClient}>
          <PacketScreen screen={item} />
        </QueryClientProvider>,
      );
      expect(screen.queryByText("This packet screen belongs to a later implementation tranche.")).not.toBeInTheDocument();
      view.unmount();
      cleanup();
    }
  });

  it("renders the locked Personality Family examples instead of invented enum controls", () => {
    renderPacket("TOOL003");

    expect(screen.getAllByRole("button", { name: /Clear / })).toHaveLength(13);
    expect(screen.getAllByRole("button", { name: "Clear Accountability" })).toHaveLength(2);
    expect(screen.queryByText("World")).not.toBeInTheDocument();
    expect(screen.queryByText("Species kind")).not.toBeInTheDocument();
    expect(screen.queryByText("Timeline event type")).not.toBeInTheDocument();
  });

  it("fails closed for an unknown review-tool screen", () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <PacketScreen screen={{ ...entry("TOO001"), screenId: "TOOL_UNKNOWN" }} />
      </QueryClientProvider>,
    );

    expect(screen.getByRole("heading", { name: "Review tool unavailable" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Untitled task" })).not.toBeInTheDocument();
  });

  it("uses the exact five owner-supplied access levels on the navigation-state review", () => {
    renderPacket("TOOL006");

    const accessTable = screen.getByRole("table", { name: "Access level capabilities" });
    for (const level of ["GUEST", "USER", "MEMBER", "ADMIN", "OWNER"]) {
      expect(accessTable).toHaveTextContent(level);
    }
    expect(accessTable).not.toHaveTextContent("Administrator");
    expect(screen.getByText(/Authorization role, beta\/player eligibility, and membership entitlement remain separate/)).toBeInTheDocument();
  });
});
