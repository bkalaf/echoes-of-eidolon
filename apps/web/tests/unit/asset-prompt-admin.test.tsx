import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { pageManifest } from "../../src/lib/page-manifest";
import { AssetPromptAdminPage } from "../../src/screens/admin/AssetPromptAdminPage";

function renderAdminState(screenId: string) {
  const entry = pageManifest.find((candidate) => candidate.screenId === screenId)!;
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AssetPromptAdminPage screen={entry} /></QueryClientProvider>);
}

describe("managed asset and prompt administration", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requests only the selected media kind and shows final-byte object identity", async () => {
    const objectKey = `${"a".repeat(64)}.mp3`;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: async () => ({
        assets: [{
          byteSize: "1234",
          managedAssetId: "ASSET-1",
          mediaKind: "AUDIO",
          mimeType: "audio/mpeg",
          objectKey,
          purposeLinks: [{ purpose: "login.soundtrack" }],
          sha256: "a".repeat(64),
        }],
        total: 1,
      }),
      ok: true,
    }));
    renderAdminState("ADM031");
    expect(await screen.findByText("ASSET-1")).toBeInTheDocument();
    expect(screen.getByText(objectKey)).toBeInTheDocument();
    expect(screen.getByText("login.soundtrack")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/admin/assets/?mediaKind=AUDIO");
    expect(screen.getByText(/Storage credentials and workstation paths are not returned/)).toBeInTheDocument();
  });

  it("uses the explicit OUTSTANDING filter and projects only stored prompt rows", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: async () => ({
        prompts: [{
          family: "NAMING",
          promptRecordId: "PROMPT-1",
          purpose: "SUPPLIED_PURPOSE",
          status: "OUTSTANDING",
          targetId: "SW-1",
          targetType: "SettlementWorld",
          versions: [{ generatedManagedAssetId: null, promptText: "SUPPLIED", promptVersionId: "PV-1", version: 1 }],
        }],
        total: 1,
      }),
      ok: true,
    }));
    renderAdminState("ADM034");
    expect(await screen.findByText("PROMPT-1")).toBeInTheDocument();
    expect(screen.getByText("SUPPLIED_PURPOSE")).toBeInTheDocument();
    expect(screen.getByText("SettlementWorld · SW-1")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/admin/prompts/?status=OUTSTANDING");
  });

  it("renders honest empty stores without inventing assets or prompts", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ assets: [], total: 0 }), ok: true }));
    renderAdminState("ADM032");
    expect(await screen.findByText("No managed video assets are stored.")).toBeInTheDocument();
    expect(screen.queryByText(/sample|placeholder/i)).not.toBeInTheDocument();
  });
});
