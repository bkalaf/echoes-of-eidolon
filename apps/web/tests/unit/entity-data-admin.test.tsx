import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { pageManifest } from "../../src/lib/page-manifest";
import { EntityDataAdminPage } from "../../src/screens/admin/EntityDataAdminPage";
import contractData from "../../src/data/entity-admin-contract.json";

const collection = {
  contract: {
    delegate: "soul",
    fields: [
      { enumValues: [], hasDefault: false, isList: false, isRequired: true, kind: "scalar", name: "soulId", type: "String" },
      { enumValues: [], hasDefault: false, isList: false, isRequired: true, kind: "scalar", name: "name", type: "String" },
    ],
    idField: "soulId",
  },
  entity: "Soul",
  records: [{ soulId: "SOUL-1", name: "First Soul" }, { soulId: "SOUL-2", name: "Second Soul" }],
};

function renderPage(pathname: string, screenId: string) {
  const entry = pageManifest.find((candidate) => candidate.screenId === screenId)!;
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><EntityDataAdminPage pathname={pathname} screen={entry} /></QueryClientProvider>);
}

describe("persisted Data administration", () => {
  it("renders searchable records and a complete create form", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => collection, ok: true }));
    renderPage("/admin/data/soul", "DATA015");
    expect(await screen.findByText("First Soul")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search Soul"), { target: { value: "second" } });
    expect(screen.queryByText("First Soul")).not.toBeInTheDocument();
    expect(screen.getByText("Second Soul")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "New" }));
    const editor = screen.getByRole("heading", { name: "Create Soul" }).closest("section")!;
    expect(within(editor).queryByLabelText("Technical ID *")).not.toBeInTheDocument();
    fireEvent.click(within(editor).getByRole("button", { name: "Technical details" }));
    expect(within(editor).getByLabelText("Technical ID *")).toBeInTheDocument();
    expect(within(editor).getByLabelText("Name *")).toBeInTheDocument();
  });

  it("loads an actual record identity into the reviewed editor state and persists changes", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ json: async () => collection, ok: true })
      .mockResolvedValueOnce({ json: async () => ({ record: { soulId: "SOUL-2", name: "Renamed Soul" } }), ok: true });
    vi.stubGlobal("fetch", fetchMock);
    renderPage("/admin/data/soul/SOUL-2", "DATA_SOUL_EDIT");
    expect(await screen.findByRole("heading", { name: "Second Soul" })).toBeInTheDocument();
    expect(screen.queryByText("SOUL-2")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit Record" }));
    expect(await screen.findByRole("heading", { name: "Edit Soul" })).toBeInTheDocument();
    const name = screen.getByLabelText("Name *");
    expect(name).toHaveValue("Second Soul");
    fireEvent.change(name, { target: { value: "Renamed Soul" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith("/api/admin/data/soul/SOUL-2", expect.objectContaining({ method: "PATCH" })));
    expect(await screen.findByText("Soul saved.")).toBeInTheDocument();
  });

  it("serializes controlled enum arrays from chip selections without JSON authoring", async () => {
    const breedCollection = { entity: "Breed", records: [], contract: { delegate: "breed", idField: "breedId", fields: [
      { enumValues: [], hasDefault: false, isList: false, isRequired: true, kind: "scalar", name: "breedId", type: "String" },
      { enumValues: ["ANIMAL", "PLANT"], hasDefault: true, isList: true, isRequired: true, kind: "enum", name: "foodBroad", type: "FoodBroadCategory" },
    ] } };
    const fetchMock = vi.fn().mockResolvedValueOnce({ json: async () => breedCollection, ok: true }).mockResolvedValueOnce({ json: async () => ({ record: { breedId: "BREED-1", foodBroad: ["ANIMAL"] } }), ok: true });
    vi.stubGlobal("fetch", fetchMock);
    renderPage("/admin/data/breed", "DATA019");
    await screen.findByText("Breed");
    fireEvent.click(screen.getByRole("button", { name: "New" }));
    const editor = screen.getByRole("heading", { name: "Create Breed" }).closest("section")!;
    fireEvent.click(within(editor).getByRole("button", { name: "Technical details" }));
    fireEvent.change(within(editor).getByLabelText("Technical ID *"), { target: { value: "BREED-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Select Animal" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Breed" }));
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith("/api/admin/data/breed", expect.objectContaining({ body: JSON.stringify({ record: { breedId: "BREED-1", foodBroad: ["ANIMAL"] } }) })));
  });

  it("derives canonical WorldBuilding persistence IDs from the finalized name", async () => {
    const speciesCollection = { entity: "Species", records: [], contract: { delegate: "species", idField: "speciesId", fields: [
      { enumValues: [], hasDefault: false, isList: false, isRequired: true, kind: "scalar", name: "speciesId", type: "String" },
      { enumValues: [], hasDefault: false, isList: false, isRequired: true, kind: "scalar", name: "name", type: "String" },
    ] } };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => speciesCollection, ok: true }));
    renderPage("/admin/data/species", "DATA007");
    await screen.findByText("Species");
    fireEvent.click(screen.getByRole("button", { name: "New" }));
    const editor = screen.getByRole("heading", { name: "Create Species" }).closest("section")!;
    fireEvent.change(within(editor).getByLabelText("Name *"), { target: { value: "Greater blue-ringed octopus" } });
    fireEvent.click(within(editor).getByRole("button", { name: "Technical details" }));
    expect(within(editor).getByLabelText("Technical ID *")).toHaveValue("SPC_GREATER_BLUE_RINGED_OCTOPUS");
  });

  it("locks the canonical name and persistence ID together when editing WorldBuilding records", async () => {
    const speciesCollection = { entity: "Species", records: [{ speciesId: "SPC_HUMAN", name: "Human" }], contract: { delegate: "species", idField: "speciesId", fields: [
      { enumValues: [], hasDefault: false, isList: false, isRequired: true, kind: "scalar", name: "speciesId", type: "String" },
      { enumValues: [], hasDefault: false, isList: false, isRequired: true, kind: "scalar", name: "name", type: "String" },
    ] } };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => speciesCollection, ok: true }));
    renderPage("/admin/data/species/SPC_HUMAN", "DATA_SPECIES_EDIT");

    await screen.findByRole("heading", { name: "Human" });
    fireEvent.click(screen.getByRole("button", { name: "Edit Record" }));
    const editor = (await screen.findByRole("heading", { name: "Edit Species" })).closest("section")!;
    fireEvent.click(within(editor).getByRole("button", { name: "Technical details" }));
    expect(within(editor).getByLabelText("Technical ID *")).toBeDisabled();
    expect(within(editor).getByLabelText("Name *")).toBeDisabled();
    expect(screen.getByText(/Canonical WorldBuilding names and persistence IDs are immutable/)).toBeInTheDocument();
  });

  it("clears and disables non-applicable PET presentation fields", async () => {
    const speciesCollection = { entity: "Species", records: [], contract: { delegate: "species", idField: "speciesId", fields: [
      { enumValues: [], hasDefault: false, isList: false, isRequired: true, kind: "scalar", name: "speciesId", type: "String" },
      { enumValues: [], hasDefault: false, isList: false, isRequired: true, kind: "scalar", name: "name", type: "String" },
      { enumValues: ["SAPIENT", "PET"], hasDefault: false, isList: false, isRequired: true, kind: "enum", name: "speciesKind", type: "SpeciesKind" },
      { enumValues: [], hasDefault: false, isList: false, isRequired: false, kind: "scalar", name: "anthropomorphization", type: "String" },
      { enumValues: [], hasDefault: false, isList: false, isRequired: false, kind: "scalar", name: "clothing", type: "String" },
      { enumValues: [], hasDefault: false, isList: false, isRequired: false, kind: "scalar", name: "architecture", type: "String" },
      { enumValues: [], hasDefault: false, isList: false, isRequired: true, kind: "scalar", name: "appearance", type: "String" },
    ] } };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => speciesCollection, ok: true }));
    renderPage("/admin/data/species", "DATA007");
    await screen.findByText("Species");
    fireEvent.click(screen.getByRole("button", { name: "New" }));
    const editor = screen.getByRole("heading", { name: "Create Species" }).closest("section")!;
    fireEvent.change(within(editor).getByLabelText("Civilian"), { target: { value: "Stale clothing" } });
    fireEvent.change(within(editor).getByLabelText("Species Kind *"), { target: { value: "PET" } });

    expect(within(editor).getByLabelText("Anthropomorphization")).toBeDisabled();
    expect(within(editor).getByRole("group", { name: "Clothing" })).toBeDisabled();
    expect(within(editor).getByLabelText("Civilian")).toHaveValue("");
    expect(within(editor).getByLabelText("Architecture")).toBeDisabled();
    expect(screen.getByText(/PET invariant: clothing, architecture, and anthropomorphization remain null/)).toBeInTheDocument();
  });

  it("clears and disables PET-only Breed null fields from populationKind", async () => {
    const breedCollection = { entity: "Breed", records: [], contract: { delegate: "breed", idField: "breedId", fields: [
      { enumValues: [], hasDefault: false, isList: false, isRequired: true, kind: "scalar", name: "breedId", type: "String" },
      { enumValues: ["HUMAN", "BEAST", "MYTHOS", "PET"], hasDefault: false, isList: false, isRequired: true, kind: "enum", name: "populationKind", type: "PopulationKind" },
      { enumValues: [], hasDefault: false, isList: false, isRequired: false, kind: "scalar", name: "cultureId", type: "String" },
      { enumValues: [], hasDefault: false, isList: false, isRequired: false, kind: "scalar", name: "personalityId", type: "String" },
      { enumValues: [], hasDefault: false, isList: false, isRequired: false, kind: "scalar", name: "accent", type: "String" },
      { enumValues: [], hasDefault: false, isList: false, isRequired: false, kind: "scalar", name: "clothing", type: "String" },
      { enumValues: [], hasDefault: false, isList: false, isRequired: false, kind: "scalar", name: "architecture", type: "String" },
      { enumValues: [], hasDefault: false, isList: false, isRequired: false, kind: "scalar", name: "appearance", type: "String" },
      { enumValues: ["ALTRUISTIC"], hasDefault: false, isList: false, isRequired: false, kind: "enum", name: "motivation", type: "Motivation" },
    ] } };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => breedCollection, ok: true }));
    renderPage("/admin/data/breed", "DATA019");
    await screen.findByText("Breed");
    fireEvent.click(screen.getByRole("button", { name: "New" }));
    const editor = screen.getByRole("heading", { name: "Create Breed" }).closest("section")!;
    fireEvent.change(within(editor).getByLabelText("Culture"), { target: { value: "CLT_STALE" } });
    fireEvent.change(within(editor).getByLabelText("Motivation"), { target: { value: "ALTRUISTIC" } });
    fireEvent.change(within(editor).getByLabelText("Population Kind *"), { target: { value: "PET" } });

    expect(within(editor).getByLabelText("Culture")).toBeDisabled();
    expect(within(editor).getByLabelText("Culture")).toHaveValue("");
    expect(within(editor).getByLabelText("Personality")).toBeDisabled();
    expect(within(editor).getByLabelText("Accent")).toBeDisabled();
    expect(within(editor).getByRole("group", { name: "Clothing" })).toBeDisabled();
    expect(within(editor).getByLabelText("Architecture")).toBeDisabled();
    expect(within(editor).getByLabelText("Motivation")).toBeDisabled();
    expect(within(editor).getByLabelText("Appearance")).not.toBeDisabled();
    expect(screen.getByText(/PET population invariant: Culture, Personality, sapient presentation, and governance dimensions remain null/)).toBeInTheDocument();
  });

  it("renders WitnessDef as named sections, a searchable Soul relation, and three spectral percentages", async () => {
    const witnessDefCollection = { entity: "WitnessDef", records: [], contract: contractData.entities.WitnessDef };
    const soulCollection = { entity: "Soul", records: [{ soulId: "SOUL_HANS", name: "Hans Halycon Hohenzollern" }], contract: contractData.entities.Soul };
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => ({
      json: async () => String(input).includes("/soul") ? soulCollection : witnessDefCollection,
      ok: true,
    })));
    renderPage("/admin/data/witness-def", "DATA_WITNESS_DEF");
    await screen.findByRole("heading", { name: "WitnessDef" });
    fireEvent.click(screen.getByRole("button", { name: "New" }));

    expect(screen.getByRole("group", { name: "Identity" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Source Architect / Soul" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Domains" })).toBeInTheDocument();
    const color = screen.getByRole("group", { name: "Spectral Color" });
    expect(within(color).getByLabelText("Spectral violet %")).toHaveAttribute("type", "number");
    expect(within(color).getByLabelText("Green %")).toHaveAttribute("type", "number");
    expect(within(color).getByLabelText("White %")).toHaveAttribute("type", "number");
    expect(within(color).getByLabelText("Spectral color total")).toHaveTextContent("must equal 100%");
    fireEvent.click(screen.getByRole("combobox", { name: "Search Soul" }));
    expect(await screen.findByRole("option", { name: /Hans Halycon Hohenzollern/ })).toBeInTheDocument();
  });

  it("shows every parent Character field inside a Witness subtype editor", async () => {
    const character = { characterId: "CHA_MARA", displayName: "Mara Vale", breedId: null, occupationId: null, worldKey: "CONCORD", soulId: "SOUL_HANS", gender: "Woman", age: "Adult", skinScaleColor: "Brown", hairFurColor: "Black", eyeColor: "Green", clothing: "Civilian: coat", faction: "CONCORD", primaryAttribute: "WISDOM", secondaryAttribute: "CHARISMA" };
    const witnessCollection = { entity: "Witness", records: [{ characterId: "CHA_MARA", witnessDefId: "WDF_EMBERS", trueFlawName: null, architectCharacterId: "CHA_HANS", legendaryRewardId: null, constellationBeforeId: null, constellationAfterId: null, character }], contract: contractData.entities.Witness };
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => ({
      json: async () => String(input).endsWith("/witness") ? witnessCollection : { entity: "Character", records: [], contract: contractData.entities.Character },
      ok: true,
    })));
    renderPage("/admin/data/witness/CHA_MARA", "DATA_WITNESS_EDIT");
    const characterSection = await screen.findByRole("group", { name: "Character" });
    expect(within(characterSection).getAllByText("Mara Vale").length).toBeGreaterThan(0);
    for (const section of ["Character", "Witness definition", "Source Architect", "Soul continuity", "Witness-specific narrative data", "Rewards / constellations", "Technical details"]) expect(screen.getByRole("group", { name: section })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit Record" }));
    expect(await screen.findByLabelText("Display Name *")).toHaveValue("Mara Vale");
  });

  it("uses the owner-curated Witness columns by default", async () => {
    const character = {
      characterId: "CHA_WITNESS_OF_THE_HAMMER", displayName: "The Witness of the Hammer", breedId: "BRD_MINOTAUR",
      occupationId: null, worldKey: "RUIN", soulId: "SOUL_ANDREI", gender: "MALE", age: "53", skinScaleColor: null,
      hairFurColor: null, eyeColor: null, clothing: null, faction: null, primaryAttribute: null, secondaryAttribute: null,
      breed: { breedId: "BRD_MINOTAUR", name: "Minotaur" }, soul: { soulId: "SOUL_ANDREI", name: "Andrei Mihai Popescu" },
    };
    const witness = {
      characterId: character.characterId, witnessDefId: "WDF_WITNESS_OF_THE_HAMMER", trueFlawName: "Retaliation",
      architectCharacterId: "CHA_ANDREI", legendaryRewardId: null, constellationBeforeId: null, constellationAfterId: null,
      character,
      witnessDef: { witnessDefId: "WDF_WITNESS_OF_THE_HAMMER", name: "The Witness of the Hammer", worldKey: "RUIN", bookNumber: 14, kernelKey: "REDRESS" },
      architect: { characterId: "CHA_ANDREI", department: "JUSTICE", character: { characterId: "CHA_ANDREI", displayName: "Andrei Mihai Popescu" } },
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ entity: "Witness", records: [witness], contract: contractData.entities.Witness }), ok: true }));
    renderPage("/admin/data/witness", "DATA004");
    const table = await screen.findByRole("table");
    expect(within(table).getAllByRole("columnheader").map((header) => header.textContent?.replace(/\s+[↕↑↓]$/, "").trim() ?? "")).toEqual([
      "", "Witness", "World", "Book", "Breed", "Age", "Gender", "Witness definition", "Source Architect", "True flaw", "Actions",
    ]);
  });

  it("uses owner-curated WitnessDef columns and humanized enum values by default", async () => {
    const definition = {
      witnessDefId: "WDF_WITNESS_OF_THE_HAMMER", name: "The Witness of the Hammer", department: "JUSTICE", kernelKey: "REDRESS",
      apparentDomain: "Restitution", realDomain: "Retaliation", color: { SPECTRAL_VIOLET: 90, GREEN: 10, WHITE: 0 },
      architectSoulId: "SOUL_ANDREI", worldKey: "RUIN", bookNumber: 14,
      architectSoul: { soulId: "SOUL_ANDREI", name: "Andrei Mihai Popescu" },
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ entity: "WitnessDef", records: [definition], contract: contractData.entities.WitnessDef }), ok: true }));
    renderPage("/admin/data/witness-def", "DATA_WITNESS_DEF");
    const table = await screen.findByRole("table");
    expect(within(table).getAllByRole("columnheader").map((header) => header.textContent?.replace(/\s+[↕↑↓]$/, "").trim() ?? "")).toEqual([
      "", "Witness definition", "World", "Book", "Kernel", "Department", "Source Architect / Soul", "Apparent domain", "Real domain", "Spectral color", "Actions",
    ]);
    expect(within(table).getByText("Ruin")).toBeInTheDocument();
    expect(within(table).getByText("Justice")).toBeInTheDocument();
    expect(within(table).queryByText("RUIN")).not.toBeInTheDocument();
    expect(within(table).queryByText("JUSTICE")).not.toBeInTheDocument();
  });

  it("edits exactly one table row, keeps immutable identity read-only, and saves explicitly", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ json: async () => collection, ok: true })
      .mockResolvedValueOnce({ json: async () => ({ record: { soulId: "SOUL-1", name: "Renamed inline" } }), ok: true });
    vi.stubGlobal("fetch", fetchMock);
    renderPage("/admin/data/soul", "DATA015");
    await screen.findByText("First Soul");

    const editActions = screen.getAllByRole("button", { name: "Edit" });
    fireEvent.click(editActions[0]!);
    expect(screen.getByLabelText("Name *")).toHaveValue("First Soul");
    expect(screen.queryByLabelText("Technical ID *")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Edit" })[0]).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Name *"), { target: { value: "Renamed inline" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Row SOUL-1" }));
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith("/api/admin/data/soul/SOUL-1", expect.objectContaining({
      body: JSON.stringify({ record: { soulId: "SOUL-1", name: "Renamed inline" } }),
      method: "PATCH",
    })));
    expect(await screen.findByText("Renamed inline")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(2);
  });

  it("preserves unsaved row values and edit mode after a server validation failure", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ json: async () => collection, ok: true })
      .mockResolvedValueOnce({ json: async () => ({ error: "Name violates the canonical contract." }), ok: false }));
    renderPage("/admin/data/soul", "DATA015");
    await screen.findByText("First Soul");
    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]!);
    fireEvent.change(screen.getByLabelText("Name *"), { target: { value: "Unsaved owner value" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Row SOUL-1" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Name violates the canonical contract.");
    expect(screen.getByLabelText("Name *")).toHaveValue("Unsaved owner value");
    expect(screen.getByRole("button", { name: "Save Row SOUL-1" })).toBeInTheDocument();
  });

  it("uses an exact enum select and a name-first relation lookup in inline mode", async () => {
    const character = { characterId: "CHA_MARA", displayName: "Mara Vale", breedId: null, occupationId: null, worldKey: "CONCORD", soulId: null, gender: "Woman", age: "Adult", skinScaleColor: "Brown", hairFurColor: "Black", eyeColor: "Green", clothing: "Civilian: coat", faction: "CONCORD", primaryAttribute: "WISDOM", secondaryAttribute: "CHARISMA" };
    const characterCollection = { entity: "Character", records: [character], contract: contractData.entities.Character };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "PATCH") return { json: async () => ({ record: { ...character, breedId: "BRD_AARDVARK", worldKey: "RUIN" } }), ok: true };
      if (String(input).endsWith("/character")) return { json: async () => characterCollection, ok: true };
      if (String(input).endsWith("/breed")) return { json: async () => ({ contract: contractData.entities.Breed, entity: "Breed", records: [{ breedId: "BRD_AARDVARK", name: "Aardvark" }] }), ok: true };
      const lookupEntity = String(input).split("/").at(-1) ?? "Soul";
      const entityName = Object.keys(contractData.entities).find((candidate) => candidate.toLowerCase() === lookupEntity) as keyof typeof contractData.entities | undefined;
      return { json: async () => ({ contract: contractData.entities[entityName ?? "Soul"], entity: entityName ?? "Soul", records: [] }), ok: true };
    });
    vi.stubGlobal("fetch", fetchMock);
    renderPage("/admin/data/character", "DATA003");
    await screen.findByText("Mara Vale");
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const row = screen.getByRole("checkbox", { name: "Select row CHA_MARA" }).closest("tr")!;
    fireEvent.change(within(row).getByLabelText("World Key"), { target: { value: "RUIN" } });
    fireEvent.click(within(row).getByRole("combobox", { name: "Search Breed" }));
    const aardvark = await screen.findByRole("option", { name: /Aardvark/ });
    expect(aardvark).not.toHaveTextContent("BRD_AARDVARK");
    fireEvent.mouseDown(aardvark);
    fireEvent.click(screen.getByRole("button", { name: "Save Row CHA_MARA" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/data/character/CHA_MARA", expect.objectContaining({ method: "PATCH" })));
    const patchCall = fetchMock.mock.calls.find((call) => (call[1] as RequestInit | undefined)?.method === "PATCH")!;
    const request = JSON.parse(String((patchCall[1] as RequestInit).body)) as { record: Record<string, unknown> };
    expect(request.record).toMatchObject({ breedId: "BRD_AARDVARK", worldKey: "RUIN" });
  });

  it("composes Character-owned and Witness-owned changes into one canonical row PATCH", async () => {
    const character = { characterId: "CHA_MARA", displayName: "Mara Vale", breedId: null, occupationId: null, worldKey: "CONCORD", soulId: "SOUL_HANS", gender: "Woman", age: "Adult", skinScaleColor: "Brown", hairFurColor: "Black", eyeColor: "Green", clothing: "Civilian: coat", faction: "CONCORD", primaryAttribute: "WISDOM", secondaryAttribute: "CHARISMA" };
    const witness = { characterId: "CHA_MARA", witnessDefId: "WDF_EMBERS", trueFlawName: null, architectCharacterId: "CHA_HANS", legendaryRewardId: null, constellationBeforeId: null, constellationAfterId: null, character };
    const witnessCollection = { entity: "Witness", records: [witness], contract: contractData.entities.Witness };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "PATCH") return { json: async () => ({ record: { ...witness, trueFlawName: "Pride", character: { ...character, displayName: "Mara Vela" } } }), ok: true };
      if (String(input).endsWith("/witness")) return { json: async () => witnessCollection, ok: true };
      const lookupEntity = String(input).split("/").at(-1) ?? "Character";
      const entityName = Object.keys(contractData.entities).find((candidate) => candidate.toLowerCase() === lookupEntity) as keyof typeof contractData.entities | undefined;
      return { json: async () => ({ contract: contractData.entities[entityName ?? "Character"], entity: entityName ?? "Character", records: [] }), ok: true };
    });
    vi.stubGlobal("fetch", fetchMock);
    renderPage("/admin/data/witness", "DATA004");
    expect((await screen.findAllByText("Mara Vale")).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const row = screen.getByRole("checkbox", { name: "Select row CHA_MARA" }).closest("tr")!;
    fireEvent.change(within(row).getByLabelText("Display Name *"), { target: { value: "Mara Vela" } });
    fireEvent.change(within(row).getByLabelText("True Flaw Name"), { target: { value: "Pride" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Row CHA_MARA" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/data/witness/CHA_MARA", expect.objectContaining({
      body: expect.stringContaining('"parentCharacter"'),
      method: "PATCH",
    })));
    const patchCall = fetchMock.mock.calls.find((call) => (call[1] as RequestInit | undefined)?.method === "PATCH")!;
    const request = JSON.parse(String((patchCall[1] as RequestInit).body)) as { parentCharacter: Record<string, unknown>; record: Record<string, unknown> };
    expect(request.parentCharacter.displayName).toBe("Mara Vela");
    expect(request.record.trueFlawName).toBe("Pride");
  });
});
