import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { pageManifest } from "../../src/lib/page-manifest";
import { AssetPromptAdminPage } from "../../src/screens/admin/AssetPromptAdminPage";

function renderAdminState(screenId: string) {
  const entry = pageManifest.find((candidate) => candidate.screenId === screenId)!;
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AssetPromptAdminPage screen={entry} /></QueryClientProvider>);
}

function renderUnknownAdminState() {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AssetPromptAdminPage screen={{ originalPage: 0, page: 0, path: "/admin/assets/unknown", reviewOrder: 0, screenId: "UNKNOWN", source: "TEST", title: "Unknown" }} /></QueryClientProvider>);
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
          technicalMetadata: { durationSeconds: 120, kind: "audio", streams: [{ channels: 2, codec_name: "mp3" }] },
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
    fireEvent.click(screen.getByText("ASSET-1"));
    expect(screen.getByRole("heading", { name: "Managed asset detail" })).toBeInTheDocument();
    expect(screen.getByText(/"durationSeconds": 120/)).toBeInTheDocument();
    expect(screen.getByText(/must use the existing sanitized managed-asset import pipeline/)).toBeInTheDocument();
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
          versions: [{ generatedManagedAssetId: null, promptText: "SUPPLIED", promptVersionId: "PV-1", responseContract: { type: "object" }, version: 1 }],
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

  it("creates a prompt only from explicit authored fields and JSON contract", async () => {
    const fetchMock = vi.fn().mockImplementation(async (_request: RequestInfo | URL, init?: RequestInit) => init?.method === "POST"
      ? { json: async () => ({ prompt: { promptRecordId: "PROMPT-NEW" } }), ok: true }
      : { json: async () => ({ prompts: [], total: 0 }), ok: true });
    vi.stubGlobal("fetch", fetchMock);
    renderAdminState("ADM033");
    fireEvent.click(await screen.findByRole("button", { name: "New prompt" }));
    fireEvent.change(screen.getByLabelText("Purpose"), { target: { value: "Owner purpose" } });
    fireEvent.change(screen.getByLabelText("Target type"), { target: { value: "Feature" } });
    fireEvent.change(screen.getByLabelText("Target identifier"), { target: { value: "FEATURE-1" } });
    fireEvent.change(screen.getByLabelText("Prompt text"), { target: { value: "Owner authored text" } });
    fireEvent.change(screen.getByLabelText("Response contract JSON"), { target: { value: '{"type":"object"}' } });
    fireEvent.click(screen.getByRole("button", { name: "Create version 1" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/prompts/", expect.objectContaining({
      body: JSON.stringify({ family: "IMAGE", promptText: "Owner authored text", purpose: "Owner purpose", responseContract: { type: "object" }, status: "OUTSTANDING", targetId: "FEATURE-1", targetType: "Feature" }),
      method: "POST",
    })));
  });

  it("renders honest empty stores without inventing assets or prompts", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ assets: [], total: 0 }), ok: true }));
    renderAdminState("ADM032");
    expect(await screen.findByText("No managed video assets are stored.")).toBeInTheDocument();
    expect(screen.queryByText(/sample|placeholder/i)).not.toBeInTheDocument();
  });

  it("does not reinterpret an unknown asset screen as Prompt Manager", () => {
    vi.stubGlobal("fetch", vi.fn());
    renderUnknownAdminState();
    expect(screen.getByRole("heading", { name: "Asset or prompt workflow unavailable" })).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});
