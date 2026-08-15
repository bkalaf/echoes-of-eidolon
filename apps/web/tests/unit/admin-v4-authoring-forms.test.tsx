import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CompanionPlannerAttributesPage, OccupationAdminPage, SettlementSoundtracksPage, TransformationAuthoringPage } from "../../src/screens/admin/AdminV4Pages";

function renderPage(page: React.ReactNode) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{page}</QueryClientProvider>);
}

afterEach(() => vi.unstubAllGlobals());

describe("V4 admin authoring forms", () => {
  it("constrains Companion heirlooms to the canonical finite values", async () => {
    const character = { age: "28", breedId: "BRD_HUMAN", displayName: "Aster", faction: "CONCORD", gender: "NONBINARY", occupationId: "ORACLE", primaryAttribute: "WISDOM", secondaryAttribute: "CHARISMA", worldKey: "CONCORD" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        companions: [{ awarenessSkill: null, companionKey: "A", concordCharacter: character, heirloom: "RING", knowledgeSkill: null, ruinCharacter: { ...character, worldKey: "RUIN" }, schismCharacter: { ...character, worldKey: "SCHISM" }, soul: { name: "Aster" }, transformationBinding: null }],
        layettes: [],
        occupations: [{ active: true, affinities: [{ abilityType: "WISDOM", ordinal: 0 }, { abilityType: "CHARISMA", ordinal: 1 }], description: null, name: "Oracle", occupationId: "ORACLE" }],
      }),
    }));
    renderPage(<CompanionPlannerAttributesPage />);

    const heirloom = await screen.findByRole("combobox", { name: "Heirloom" });
    expect(heirloom).toHaveValue("RING");
    expect(screen.getByRole("option", { name: "BACKPACK_CLASP" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Heirloom" })).not.toBeInTheDocument();
  });

  it("preserves Occupation activation, locks an existing stable key, and provides an explicit new-record reset", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ occupations: [{ active: false, affinities: [{ abilityType: "WISDOM", ordinal: 0 }], description: "Archived role", name: "Oracle", occupationId: "ORACLE" }] }),
    }));
    renderPage(<OccupationAdminPage />);

    fireEvent.click(await screen.findByRole("button", { name: /Oracle/ }));
    expect(screen.getByRole("textbox", { name: "Stable key" })).toHaveValue("ORACLE");
    expect(screen.getByRole("textbox", { name: "Stable key" })).toHaveAttribute("readonly");
    expect(screen.getByRole("checkbox", { name: "Active" })).not.toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "New Occupation" }));
    expect(screen.getByRole("textbox", { name: "Stable key" })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "Stable key" })).not.toHaveAttribute("readonly");
    expect(screen.getByRole("checkbox", { name: "Active" })).toBeChecked();
  });

  it("loads each companion's existing Transformation binding instead of carrying stale form state", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        companions: [
          { companionKey: "A", transformationBinding: { layetteId: "LAYETTE_A" } },
          { companionKey: "B", transformationBinding: { layetteId: "LAYETTE_B" } },
        ],
        layettes: [{ layetteId: "LAYETTE_A", name: "Aster Layette" }, { layetteId: "LAYETTE_B", name: "Bran Layette" }],
        occupations: [],
      }),
    }));
    renderPage(<TransformationAuthoringPage />);

    expect(await screen.findByRole("combobox", { name: "Layette" })).toHaveValue("LAYETTE_A");
    fireEvent.change(screen.getByRole("combobox", { name: "Companion" }), { target: { value: "B" } });
    expect(screen.getByRole("combobox", { name: "Layette" })).toHaveValue("LAYETTE_B");
  });

  it("edits an existing Settlement Soundtrack assignment including activation and rotation order", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        settlement: { name: "Glass Harbor", soundtrackAssignments: [{ active: false, category: "CITY", ordinal: 2, settlementSoundtrackAssignmentId: "ASSIGNMENT_1", soundtrack: { displayName: "Glass Harbor Theme", soundtrackId: "TRACK_1" }, soundtrackId: "TRACK_1" }] },
        soundtracks: [{ displayName: "Glass Harbor Theme", soundtrackId: "TRACK_1" }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    renderPage(<SettlementSoundtracksPage pathname="/admin/atlas/settlements/SETTLEMENT_1/soundtracks" />);

    fireEvent.click(await screen.findByRole("button", { name: "Edit Glass Harbor Theme CITY" }));
    expect(screen.getByRole("spinbutton", { name: "Rotation order" })).toHaveValue(2);
    expect(screen.getByRole("checkbox", { name: "Active" })).not.toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: "Active" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Rotation order" }), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Assignment" }));

    await waitFor(() => expect(fetchMock.mock.calls.some(([url, options]) => url === "/api/admin/settlement-soundtracks" && options?.method === "PUT")).toBe(true));
    const mutation = fetchMock.mock.calls.find(([url, options]) => url === "/api/admin/settlement-soundtracks" && options?.method === "PUT")?.[1];
    expect(JSON.parse(String(mutation?.body))).toEqual({ active: true, category: "CITY", ordinal: 4, settlementId: "SETTLEMENT_1", soundtrackId: "TRACK_1" });
  });
});
