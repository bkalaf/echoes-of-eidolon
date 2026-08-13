import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  campaignObjectTypes,
  campaignPlannerColumns,
  defaultDisjointTrilogy,
  opposingFactionGrouping,
  plannerColumnForObjectType,
  validateDisjointTrilogy,
} from "../../src/domain/campaign-planner";
import type { WorldKey } from "../../src/generated/prisma/enums";
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

function workspace(placements: ReturnType<typeof placement>[] = [], world: WorldKey = "RUIN") {
  return {
    campaign: placements.length > 0 ? { name: `${world} Campaign`, placements } : null,
    unassigned: {},
    bookGroupings: {
      disjoint: validateDisjointTrilogy(defaultDisjointTrilogy(world), world),
      opposingFaction: opposingFactionGrouping(world),
    },
  };
}

function mockCampaign(placements: ReturnType<typeof placement>[]) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => workspace(placements) }));
}

function columnNumber(objectType: (typeof campaignObjectTypes)[number]) {
  const columnId = plannerColumnForObjectType(objectType)!;
  return campaignPlannerColumns.findIndex((column) => column.id === columnId) + 2;
}

describe("Campaign Manager structure", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => workspace([], "CONCORD") }));
  });

  it("renders the revised CAM001 authority summary and explicit world entry points", () => {
    renderCampaign("CAM001");
    expect(screen.getByRole("region", { name: "Campaign authority summary" })).toBeInTheDocument();
    expect(screen.getByText("Book grouping types")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open CONCORD planner" })).toHaveAttribute("href", "/admin/campaign/planner?state=CAMPAIGN_CONCORD");
    expect(screen.getByRole("cell", { name: "Mirrored Duology" })).toBeInTheDocument();
  });

  it("uses CAM002 as the reviewed default CONCORD planner state", async () => {
    renderCampaign("CAM002");
    expect(await screen.findByRole("table", { name: "CONCORD 18-Book campaign planner" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "CONCORD" })).toHaveAttribute("aria-current", "page");
  });

  it("renders the reviewed fourteen columns, 18 Book rows, independent pools, and filters", async () => {
    renderCampaign("CAMPAIGN_RUIN");
    const planner = await screen.findByRole("table", { name: "RUIN 18-Book campaign planner" });
    expect(within(planner).getAllByRole("row")).toHaveLength(19);
    for (const column of campaignPlannerColumns) {
      expect(within(planner).getByRole("columnheader", { name: (name) => name === column.label || name === `${column.label} +` })).toBeInTheDocument();
      expect(within(planner).getByRole("listbox", { name: `${column.label} Unassigned` })).toBeInTheDocument();
    }
    expect(screen.getByRole("listbox", { name: "Opposing Unassigned" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByLabelText("World filter: RUIN")).toBeInTheDocument();
    expect(screen.getByLabelText("Book filter: Books 1 through 18")).toBeInTheDocument();
    expect(screen.getByLabelText("Linked-type filter: All linked types")).toBeInTheDocument();
    const assignableColumns = campaignPlannerColumns.filter((column) => !["DISJOINT_TRILOGY", "OPPOSING_FACTION"].includes(column.id));
    expect(screen.getAllByRole("button", { name: /empty assignment cell/ })).toHaveLength(18 * assignableColumns.length);
    for (const column of campaignPlannerColumns.filter((column) => column.objectTypes.some((type) => type !== "HOLIDAY"))) expect(within(planner).getByRole("button", { name: `Create ${column.label}` })).toBeInTheDocument();
    expect(within(planner).queryByRole("button", { name: "Create Disjoint 3+3" })).not.toBeInTheDocument();
    expect(within(planner).queryByRole("button", { name: "Create Opposing" })).not.toBeInTheDocument();
  }, 10_000);

  it("creates through the owning Campaign adapter and refreshes the Unassigned catalog", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => String(input) === "/api/admin/campaign/catalog"
      ? { ok: true, json: async () => ({ record: { pillarId: "PIL-NEW" } }) }
      : { ok: true, json: async () => workspace([], "CONCORD") });
    vi.stubGlobal("fetch", fetchMock);
    renderCampaign("CAMPAIGN_CONCORD");
    fireEvent.click(await screen.findByRole("button", { name: "Create Pillar" }));
    expect(screen.getByRole("region", { name: "Create campaign object" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Canonical create payload JSON"), { target: { value: '{"objectId":"PIL-NEW","name":"New Pillar"}' } });
    fireEvent.click(screen.getByRole("button", { name: "Create PILLAR" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/campaign/catalog", expect.objectContaining({ method: "POST" })));
    await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("/api/admin/campaign?world=CONCORD"))).toHaveLength(2));
  });

  it("does not copy sample assignment IDs into an empty canonical planner", async () => {
    renderCampaign("CAMPAIGN_CONCORD");
    await screen.findByRole("table", { name: "CONCORD 18-Book campaign planner" });
    expect(screen.queryByText(/PIL-01|WIT-01|ARCH-01|LR-01/)).not.toBeInTheDocument();
  });

  it("renders one card at the inclusive start row for 1, 3, 6, and 9-Book canonical spans", async () => {
    mockCampaign([
      placement("one-book", "WITNESS", [4]),
      placement("three-books", "EXODUS", [4, 5, 6]),
      placement("six-books", "LESSON", [7, 8, 9, 10, 11, 12]),
      placement("nine-books", "PILLAR", [10, 11, 12, 13, 14, 15, 16, 17, 18]),
    ]);
    renderCampaign("CAMPAIGN_RUIN");

    for (const [id, type, startBook, rowSpan] of [
      ["one-book", "WITNESS", 4, 1],
      ["three-books", "EXODUS", 4, 3],
      ["six-books", "LESSON", 7, 6],
      ["nine-books", "PILLAR", 10, 9],
    ] as const) {
      const card = await screen.findByTestId(`campaign-placement-${id}`);
      expect(card).toHaveAttribute("data-category", type);
      expect(card).toHaveAttribute("data-start-book", String(startBook));
      expect(card).toHaveAttribute("data-book-span", String(rowSpan));
      expect(card).toHaveStyle({ gridColumn: columnNumber(type), gridRow: `${startBook + 1} / span ${rowSpan}` });
      expect(screen.getAllByText(id)).toHaveLength(1);
    }
  });

  it("renders one duology placement as two exact logical segments rather than filling intervening Books", async () => {
    mockCampaign([placement("mirrored-companion", "COMPANION", [4, 15])]);
    renderCampaign("CAMPAIGN_RUIN");
    const segments = await screen.findAllByText("mirrored-companion");
    expect(segments).toHaveLength(2);
    expect(segments.map((segment) => segment.getAttribute("data-start-book"))).toEqual(["4", "15"]);
    expect(segments.every((segment) => segment.getAttribute("data-book-span") === "1")).toBe(true);
    expect(segments.every((segment) => segment.getAttribute("data-logical-placement-id") === "mirrored-companion")).toBe(true);
  });

  it("keeps adjacent and overlapping placements visible in stable lanes", async () => {
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
    expect(adjacent).toHaveAttribute("data-lane-count", "2");
    expect(adjacent).toHaveStyle({ gridRow: "6 / span 1" });
  });

  it("renders one logical Disjoint value as separate three-row segments and leaves the gap empty", async () => {
    renderCampaign("CAMPAIGN_RUIN");
    const first = await screen.findByTestId("book-grouping-BOOK-GROUPING-DISJOINT-RUIN-A-segment-0");
    const second = screen.getByTestId("book-grouping-BOOK-GROUPING-DISJOINT-RUIN-A-segment-1");
    expect(first).toHaveAttribute("data-start-book", "1");
    expect(first).toHaveAttribute("data-book-span", "3");
    expect(second).toHaveAttribute("data-start-book", "10");
    expect(second).toHaveAttribute("data-book-span", "3");
    expect(screen.getByLabelText("Book 4 Disjoint 3+3: grouping-owned")).toBeInTheDocument();
  });

  it("recalculates placement geometry when authoritative membership changes", async () => {
    mockCampaign([placement("changing", "WITNESS", [4])]);
    const { queryClient } = renderCampaign("CAMPAIGN_RUIN");
    expect(await screen.findByTestId("campaign-placement-changing")).toHaveAttribute("data-book-span", "1");

    queryClient.setQueryData(["campaign", "RUIN"], workspace([placement("changing", "EXODUS", [4, 5, 6])]));
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

  it("persists column visibility as view state without mutating campaign data", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => workspace([], "CONCORD") });
    vi.stubGlobal("fetch", fetchMock);
    renderCampaign("CAM007");
    await screen.findByRole("table", { name: "CONCORD 18-Book campaign planner" });
    fireEvent.click(screen.getByLabelText("Pillar"));
    await waitFor(() => expect(screen.queryByRole("columnheader", { name: /^Pillar(?: \+)?$/ })).not.toBeInTheDocument());
    expect(window.localStorage.getItem("echoes.campaign-planner.CONCORD.columns.v2")).toContain('"PILLAR":false');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/campaign?world=CONCORD");
  });

  it("moves a complete column with its independent pool while the Book rail stays fixed", async () => {
    renderCampaign("CAMPAIGN_CONCORD");
    const planner = await screen.findByRole("table", { name: "CONCORD 18-Book campaign planner" });
    fireEvent.click(screen.getByRole("button", { name: "Move Lesson left" }));
    const headers = within(planner).getAllByRole("columnheader");
    expect(headers.slice(0, 3).map((header) => (header.getAttribute("aria-label") ?? header.textContent?.split("Unassigned")[0])?.replace(/\s*\+$/, ""))).toEqual(["Book", "Lesson", "Pillar"]);
    expect(within(headers[1]!).getByRole("listbox", { name: "Lesson Unassigned" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Book", { selector: "input[type=checkbox]" })).not.toBeInTheDocument();
    expect(window.localStorage.getItem("echoes.campaign-planner.CONCORD.columns.v2")).toContain('"LESSON","PILLAR"');
  });

  it("keeps hidden columns in validation and gives locked columns no assignment drag origin", async () => {
    window.localStorage.setItem("echoes.campaign-planner.RUIN.columns.v2", JSON.stringify({
      order: campaignPlannerColumns.map(({ id }) => id),
      visibility: { PILLAR: false },
    }));
    mockCampaign([placement("invalid-hidden-pillar", "PILLAR", [2, 3, 4, 5, 6, 7, 8, 9, 10])]);
    renderCampaign("CAMPAIGN_RUIN");
    expect(await screen.findByRole("alert")).toHaveTextContent(/invalid-hidden-pillar/);
    expect(screen.queryByRole("columnheader", { name: /^Pillar(?: \+)?$/ })).not.toBeInTheDocument();
    const lockedPool = screen.getByRole("listbox", { name: "Opposing Unassigned" });
    expect(lockedPool).toHaveAttribute("aria-disabled", "true");
    expect(within(lockedPool).queryByRole("option")).not.toBeInTheDocument();
  });

  it("submits all three editable grouping values through the single CAM006 transaction", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => workspace([], "CONCORD") });
    vi.stubGlobal("fetch", fetchMock);
    renderCampaign("CAM006");
    await screen.findByRole("heading", { name: "Book Grouping Membership Editor" });
    fireEvent.click(screen.getByRole("button", { name: "Book 4 assigned to B" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply grouping" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/campaign/groupings", expect.objectContaining({ method: "PUT" })));
    const update = fetchMock.mock.calls.find(([url]) => url === "/api/admin/campaign/groupings")![1] as RequestInit;
    const payload = JSON.parse(String(update.body)) as { values: Array<{ bookNumbers: number[] }>; worldKey: string };
    expect(payload.worldKey).toBe("CONCORD");
    expect(payload.values).toHaveLength(3);
    expect(payload.values[0]!.bookNumbers).toEqual([1, 2, 3, 4, 10, 11, 12]);
    expect(payload.values[1]!.bookNumbers).toEqual([5, 6, 13, 14, 15]);
  });

  it.each([
    ["CAM003", /Witness drop preview/],
    ["CAM004", /Invalid Architect drop preview/],
    ["CAM005", /Reward binding preview/],
    ["CAM007", /Custom column view/],
  ])("preserves the reviewed %s planner state", async (screenId, text) => {
    renderCampaign(screenId);
    expect(await screen.findByText(text)).toBeInTheDocument();
  });
});
