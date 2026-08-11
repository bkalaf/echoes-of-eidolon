import { render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { campaignObjectTypes } from "../../src/domain/campaign-planner";
import { pageManifest } from "../../src/lib/page-manifest";
import { CampaignAdminPage } from "../../src/screens/admin/CampaignAdminPage";

function campaignScreen(screenId: string) {
  return pageManifest.find((entry) => entry.screenId === screenId)!;
}

function renderCampaign(screenId: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const rendered = render(<QueryClientProvider client={queryClient}><CampaignAdminPage screen={campaignScreen(screenId)} /></QueryClientProvider>);
  return { ...rendered, queryClient };
}

const placement = (campaignPlacementId: string, objectType: (typeof campaignObjectTypes)[number], bookNumbers: number[]) => ({
  bookNumbers,
  campaignPlacementId,
  objectId: campaignPlacementId,
  objectType,
});

function mockCampaign(placements: ReturnType<typeof placement>[]) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ campaign: { name: "Ruin Campaign", placements } }) }));
}

describe("Campaign Manager structure", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ campaign: null }) })));
  it("requires explicit world selection on the landing state", () => {
    renderCampaign("CAM002");
    expect(screen.getByText(/No world is selected by default\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "CONCORD" })).toHaveAttribute("href", "/admin/campaign/planner?state=CAMPAIGN_CONCORD");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renders 18 Book rows, every exact object-type column, and the three reviewed filters", async () => {
    renderCampaign("CAMPAIGN_RUIN");
    const planner = await screen.findByRole("table", { name: "RUIN 18-Book campaign planner" });
    expect(within(planner).getAllByRole("row")).toHaveLength(19);
    for (const objectType of campaignObjectTypes) {
      expect(within(planner).getByRole("columnheader", { name: objectType })).toBeInTheDocument();
    }
    expect(screen.getByLabelText("World filter: RUIN")).toBeInTheDocument();
    expect(screen.getByLabelText("Book filter: Books 1 through 18")).toBeInTheDocument();
    expect(screen.getByLabelText("Linked-type filter: All linked types")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /empty assignment cell/ })).toHaveLength(18 * campaignObjectTypes.length);
  });

  it("does not copy sample assignment IDs into an empty canonical planner", async () => {
    renderCampaign("CAMPAIGN_CONCORD");
    await screen.findByRole("table", { name: "CONCORD 18-Book campaign planner" });
    expect(screen.queryByText(/PIL-01|WIT-01|ARCH-01|LR-01/)).not.toBeInTheDocument();
  });

  it("renders one card at the inclusive start row for 1, 2, 3, 6, and 9-Book spans", async () => {
    mockCampaign([
      placement("one-book", "WITNESS", [4]),
      placement("two-books", "TRANSITION", [9, 10]),
      placement("three-books", "EXODUS", [4, 5, 6]),
      placement("six-books", "LESSON", [7, 8, 9, 10, 11, 12]),
      placement("nine-books", "PILLAR", [10, 11, 12, 13, 14, 15, 16, 17, 18]),
    ]);
    renderCampaign("CAMPAIGN_RUIN");

    for (const [id, type, startBook, rowSpan] of [
      ["one-book", "WITNESS", 4, 1],
      ["two-books", "TRANSITION", 9, 2],
      ["three-books", "EXODUS", 4, 3],
      ["six-books", "LESSON", 7, 6],
      ["nine-books", "PILLAR", 10, 9],
    ] as const) {
      const card = await screen.findByTestId(`campaign-placement-${id}`);
      expect(card).toHaveAttribute("data-category", type);
      expect(card).toHaveAttribute("data-start-book", String(startBook));
      expect(card).toHaveAttribute("data-book-span", String(rowSpan));
      expect(card).toHaveStyle({ gridColumn: campaignObjectTypes.indexOf(type) + 2, gridRow: `${startBook + 1} / span ${rowSpan}` });
      expect(screen.getAllByText(id)).toHaveLength(1);
    }
  });

  it("keeps adjacent and overlapping placements visible in their category lane", async () => {
    mockCampaign([
      placement("book-four-a", "WITNESS", [4]),
      placement("book-four-b", "WITNESS", [4]),
      placement("book-five", "WITNESS", [5]),
    ]);
    renderCampaign("CAMPAIGN_RUIN");

    const first = await screen.findByTestId("campaign-placement-book-four-a");
    const overlap = screen.getByTestId("campaign-placement-book-four-b");
    const adjacent = screen.getByTestId("campaign-placement-book-five");
    expect(first).toHaveAttribute("data-lane-count", "2");
    expect(overlap).toHaveAttribute("data-lane-count", "2");
    expect(first).not.toHaveAttribute("data-lane", overlap.getAttribute("data-lane"));
    expect(adjacent).toHaveAttribute("data-lane-count", "1");
    expect(adjacent).toHaveStyle({ gridRow: "6 / span 1" });
  });

  it("recalculates placement geometry when canonical range data changes", async () => {
    mockCampaign([placement("changing", "WITNESS", [4])]);
    const { queryClient } = renderCampaign("CAMPAIGN_RUIN");
    const card = await screen.findByTestId("campaign-placement-changing");
    expect(card).toHaveAttribute("data-book-span", "1");

    queryClient.setQueryData(["campaign", "RUIN"], { campaign: { name: "Ruin Campaign", placements: [placement("changing", "EXODUS", [4, 5, 6])] } });
    await waitFor(() => expect(screen.getByTestId("campaign-placement-changing")).toHaveAttribute("data-book-span", "3"));
    expect(screen.getByTestId("campaign-placement-changing")).toHaveStyle({ gridRow: "5 / span 3" });
  });

  it("reports structurally invalid campaign ranges instead of silently rendering them", async () => {
    mockCampaign([
      placement("empty", "WITNESS", []),
      placement("outside", "WITNESS", [19]),
      placement("non-contiguous", "EXODUS", [4, 6]),
    ]);
    renderCampaign("CAMPAIGN_RUIN");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/3 campaign placements could not be rendered/);
    expect(screen.queryByTestId("campaign-placement-empty")).not.toBeInTheDocument();
    expect(screen.queryByTestId("campaign-placement-outside")).not.toBeInTheDocument();
    expect(screen.queryByTestId("campaign-placement-non-contiguous")).not.toBeInTheDocument();
  });
});
