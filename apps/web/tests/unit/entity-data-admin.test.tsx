import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { pageManifest } from "../../src/lib/page-manifest";
import { EntityDataAdminPage } from "../../src/screens/admin/EntityDataAdminPage";

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
    expect(screen.getByRole("heading", { name: "Create Soul" })).toBeInTheDocument();
    expect(screen.getByLabelText("soulId *")).toBeInTheDocument();
    expect(screen.getByLabelText("name *")).toBeInTheDocument();
  });

  it("loads an actual record identity into the reviewed editor state and persists changes", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ json: async () => collection, ok: true })
      .mockResolvedValueOnce({ json: async () => ({ record: { soulId: "SOUL-2", name: "Renamed Soul" } }), ok: true });
    vi.stubGlobal("fetch", fetchMock);
    renderPage("/admin/data/soul/SOUL-2", "DATA_SOUL_EDIT");
    expect(await screen.findByRole("heading", { name: "Edit Soul" })).toBeInTheDocument();
    const name = screen.getByLabelText("name *");
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
    fireEvent.change(screen.getByLabelText("breedId *"), { target: { value: "BREED-1" } });
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
    fireEvent.change(screen.getByLabelText("name *"), { target: { value: "Greater blue-ringed octopus" } });
    expect(screen.getByLabelText("speciesId *")).toHaveValue("SPC_GREATER_BLUE_RINGED_OCTOPUS");
  });

  it("locks the canonical name and persistence ID together when editing WorldBuilding records", async () => {
    const speciesCollection = { entity: "Species", records: [{ speciesId: "SPC_HUMAN", name: "Human" }], contract: { delegate: "species", idField: "speciesId", fields: [
      { enumValues: [], hasDefault: false, isList: false, isRequired: true, kind: "scalar", name: "speciesId", type: "String" },
      { enumValues: [], hasDefault: false, isList: false, isRequired: true, kind: "scalar", name: "name", type: "String" },
    ] } };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => speciesCollection, ok: true }));
    renderPage("/admin/data/species/SPC_HUMAN", "DATA_SPECIES_EDIT");

    expect(await screen.findByLabelText("speciesId *")).toBeDisabled();
    expect(screen.getByLabelText("name *")).toBeDisabled();
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
    fireEvent.change(screen.getByLabelText("Civilian"), { target: { value: "Stale clothing" } });
    fireEvent.change(screen.getByLabelText("speciesKind *"), { target: { value: "PET" } });

    expect(screen.getByLabelText("anthropomorphization")).toBeDisabled();
    expect(screen.getByRole("group", { name: "clothing" })).toBeDisabled();
    expect(screen.getByLabelText("Civilian")).toHaveValue("");
    expect(screen.getByLabelText("architecture")).toBeDisabled();
    expect(screen.getByText(/PET invariant: clothing, architecture, and anthropomorphization remain null/)).toBeInTheDocument();
  });
});
