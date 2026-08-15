import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CompanionPlannerAttributesPage } from "../../src/screens/admin/AdminV4Pages";

const character = (worldKey: string, faction: string, primaryAttribute: string, secondaryAttribute: string, companionKey = "A") => ({
  age: 28,
  breedId: `BREED_${worldKey}_${companionKey}`,
  displayName: `${worldKey} Hero ${companionKey}`,
  faction,
  gender: "Woman",
  occupationId: "SCHOLAR",
  primaryAttribute,
  secondaryAttribute,
  worldKey,
});

const planner = {
  companions: [{
    companionKey: "A",
    awarenessSkill: "EMPATHY",
    concordCharacter: character("CONCORD", "CONCORD", "INTELLIGENCE", "INTELLIGENCE"),
    heirloom: "NECKLACE",
    knowledgeSkill: "LORE",
    ruinCharacter: character("RUIN", "RUIN", "WISDOM", "INTELLIGENCE"),
    schismCharacter: character("SCHISM", "SCHISM", "INTELLIGENCE", "WISDOM"),
    soul: { name: "Aster" },
    transformationBinding: null,
  }, {
    companionKey: "B",
    awarenessSkill: "DANGER_SENSE",
    concordCharacter: character("CONCORD", "CONCORD", "CHARISMA", "CHARISMA", "B"),
    heirloom: "RING",
    knowledgeSkill: "RESEARCH",
    ruinCharacter: character("RUIN", "RUIN", "CHARISMA", "WISDOM", "B"),
    schismCharacter: character("SCHISM", "SCHISM", "WISDOM", "CHARISMA", "B"),
    soul: { name: "Bran" },
    transformationBinding: null,
  }],
  layettes: [],
  occupations: [{ active: true, affinities: [{ abilityType: "INTELLIGENCE", ordinal: 0 }, { abilityType: "WISDOM", ordinal: 1 }], description: null, name: "Scholar", occupationId: "SCHOLAR" }],
};

function renderPlanner() {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => planner }));
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><CompanionPlannerAttributesPage /></QueryClientProvider>);
}

afterEach(() => vi.unstubAllGlobals());

describe("Companion Planner V4 controls", () => {
  it("shows actual values, removable filter chips, world tint groups, and a working pivot", async () => {
    const { container } = renderPlanner();
    expect(await screen.findByText("CONCORD Hero A")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove SCHISM from World" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove SCHISM from World" }));
    expect(screen.queryByRole("heading", { name: "SCHISM" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pivot: Properties on rows" }));
    expect(screen.getByRole("button", { name: "Pivot: Companions on rows" })).toBeInTheDocument();
    expect(container.querySelectorAll(".planner-world-concord")).not.toHaveLength(0);
  });

  it("runs non-mutating validation and reports exact authored cells", async () => {
    renderPlanner();
    await screen.findByText("CONCORD Hero A");
    fireEvent.click(screen.getByRole("button", { name: "Validate" }));
    const alert = screen.getByRole("alert");
    expect(within(alert).getByText("RUIN.A.occupationId", { exact: false })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("loads the selected authored assignment and clears stale edits when companion or world changes", async () => {
    renderPlanner();
    await screen.findByText("CONCORD Hero A");
    expect(screen.getByRole("combobox", { name: "Occupation" })).toHaveValue("SCHOLAR");
    expect(screen.getByRole("combobox", { name: "Primary Attribute" })).toHaveValue("INTELLIGENCE");
    expect(screen.getByRole("combobox", { name: "Secondary Attribute" })).toHaveValue("INTELLIGENCE");
    expect(screen.getByRole("combobox", { name: "Knowledge Skill" })).toHaveValue("LORE");
    fireEvent.change(screen.getByRole("textbox", { name: "Gender" }), { target: { value: "Edited only for A" } });
    fireEvent.click(screen.getByRole("button", { name: "B" }));
    expect(screen.getByRole("textbox", { name: "Gender" })).toHaveValue("Woman");
    expect(screen.getByRole("combobox", { name: "Knowledge Skill" })).toHaveValue("RESEARCH");
  });
});
