import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PerkAdminPage } from "../../src/screens/admin/PerkAdminPage";

function renderPerks(pathname: string) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><PerkAdminPage pathname={pathname} /></QueryClientProvider>);
}

describe("perk administration", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists both active and inactive persisted perks", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: async () => ({ perks: [
        { description: "Visible benefit", name: "Active benefit", perkId: "PERK-A", status: "ACTIVE" },
        { description: "Retained history", name: "Inactive benefit", perkId: "PERK-I", status: "INACTIVE" },
      ] }),
      ok: true,
    }));
    renderPerks("/admin/perks");

    expect(await screen.findByText("Active benefit")).toBeInTheDocument();
    expect(screen.getByText("Inactive benefit")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "PERK-I" })).toHaveAttribute("href", "/admin/perks/PERK-I");
  });

  it("updates only the authoritative editable fields with a finite status", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        json: async () => ({ perk: { description: "Stored description", name: "Stored name", perkId: "PERK-1", status: "ACTIVE" } }),
        ok: true,
      })
      .mockResolvedValue({
        json: async () => ({ perk: { description: "Changed description", name: "Stored name", perkId: "PERK-1", status: "INACTIVE" } }),
        ok: true,
      });
    vi.stubGlobal("fetch", fetchMock);
    renderPerks("/admin/perks/PERK-1");

    expect(await screen.findByDisplayValue("Stored description")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Changed description" } });
    fireEvent.click(screen.getByRole("button", { name: "Clear Active" }));
    fireEvent.click(screen.getByRole("button", { name: "Select Inactive" }));
    fireEvent.click(screen.getByRole("button", { name: "Save perk" }));

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/perks/PERK-1", expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ description: "Changed description", name: "Stored name", status: "INACTIVE" }),
    })));
  });

  it("does not substitute a list when a detail identifier is absent", () => {
    vi.stubGlobal("fetch", vi.fn());
    renderPerks("/admin/perks/");
    expect(screen.getByRole("alert")).toHaveTextContent("A concrete perk identifier is required.");
    expect(fetch).not.toHaveBeenCalled();
  });
});
