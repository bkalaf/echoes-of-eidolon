import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { pageManifest } from "../../src/lib/page-manifest";
import { CapabilityAdminPage } from "../../src/screens/admin/CapabilityAdminPage";

const definition = {
  capabilityDefinitionId: "CAP-1",
  code: "LOCATION_DISCOVERED",
  versions: [{
    capabilityDefinitionVersionId: "CAP-1:v1",
    version: 1,
    pathPattern: "location.{SITE}.discovered",
    valueKind: "BOOLEAN",
    minValue: null,
    maxValue: null,
    enumValues: [],
    allowedReferenceEntityTypes: [],
    allowedOperations: ["SET", "CLEAR"],
    monotonicPolicy: "TRUE_ONLY",
    description: "Discovery state.",
    status: "ACTIVE",
    parameters: [{ name: "SITE", kind: "ENTITY", entityType: "SITE", allowedValues: [], ordinal: 0 }],
  }],
};

function entry(screenId: string) {
  return pageManifest.find((candidate) => candidate.screenId === screenId)!;
}

function response(body: unknown, ok = true) {
  return { json: async () => body, ok, status: ok ? 200 : 400 };
}

describe("Capability administration", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/scoring")) return response({ rewardPolicies: [], factionPolicies: [], candidates: [] });
      if (url.includes("/inspector")) return response({ comparison: { eventCount: 0, persistedStateCount: 0, rebuiltStateCount: 0, mismatches: [] }, events: [] });
      return response({ definitions: [definition] });
    }));
  });

  it("renders CAP01 from persisted roots and immutable version history", async () => {
    render(<CapabilityAdminPage pathname="/admin/capabilities" screen={entry("CAP01")} />);
    expect(await screen.findByText("LOCATION_DISCOVERED")).toBeInTheDocument();
    expect(screen.getByText("v1 · ACTIVE")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit / versions" })).toHaveAttribute("href", "/admin/capabilities/CAP-1");
  });

  it("authors a new draft version without overwriting the active version", async () => {
    render(<CapabilityAdminPage pathname="/admin/capabilities/CAP-1" screen={entry("CAP02")} />);
    await screen.findByRole("heading", { name: "Create version for LOCATION_DISCOVERED" });
    expect(screen.getByText("v1").parentElement).toHaveTextContent("ACTIVE");
    fireEvent.click(screen.getByRole("button", { name: "Create Draft Version" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/admin/capabilities", expect.objectContaining({ method: "POST" })));
  });

  it("builds a fully bound scoped condition address", async () => {
    render(<CapabilityAdminPage pathname="/admin/capabilities/condition-builder" screen={entry("CAP03")} />);
    await screen.findByRole("heading", { name: "Address & Condition Builder" });
    fireEvent.change(screen.getByLabelText("Scope ID"), { target: { value: "ACCOUNT-1" } });
    fireEvent.change(screen.getByLabelText("Bindings JSON"), { target: { value: '{"SITE":"SITE-1"}' } });
    fireEvent.change(screen.getByLabelText("Value JSON"), { target: { value: "true" } });
    fireEvent.click(screen.getByRole("button", { name: "Build Requirement" }));
    expect(screen.getByText(/"capabilityDefinitionVersionId": "CAP-1:v1"/)).toBeInTheDocument();
    expect(screen.getByText(/"SITE": "SITE-1"/)).toBeInTheDocument();
  });

  it("keeps CAP05 read-only while exposing rebuild comparison diagnostics", async () => {
    render(<CapabilityAdminPage pathname="/admin/capabilities/inspector" screen={entry("CAP05")} />);
    fireEvent.click(await screen.findByRole("button", { name: "Compare Rebuild" }));
    expect(await screen.findByText(/Ledger 0 · persisted 0 · rebuilt 0 · mismatches 0/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Set|Add|Clear|Repair/i })).not.toBeInTheDocument();
  });
});
