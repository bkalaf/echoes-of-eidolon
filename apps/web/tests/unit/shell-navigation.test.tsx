import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({ useSession: vi.fn() }));

vi.mock("../../src/lib/auth-client", () => ({ authClient: { useSession: authMocks.useSession } }));

import { AccountShell, AdminShell, GameShell, PublicShell } from "../../src/components/shells/Shells";

function access(role: "user" | "member" | "admin" | "owner", canPlay = false) {
  return {
    betaEligible: canPlay,
    canPlay,
    membershipEntitled: role === "member",
    participationEligible: true,
    role,
    voiceWindowSeconds: 60,
  };
}

function renderShell(node: React.ReactNode) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{node}</QueryClientProvider>);
}

describe("application shell navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
  });

  it("keeps the public brand logo keyboard-accessible and linked home", () => {
    authMocks.useSession.mockReturnValue({ data: null, isPending: false });
    renderShell(<PublicShell><p>Public content</p></PublicShell>);

    expect(screen.getByRole("link", { name: "Echoes of Eidolon home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Sign In" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Account" })).not.toBeInTheDocument();
  });

  it("gives an ordinary account Home and Sign Out without Administration or Game", async () => {
    authMocks.useSession.mockReturnValue({ data: { user: { id: "user-1", name: "User" } }, isPending: false });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => access("user") }));
    renderShell(<AccountShell><p>Account content</p></AccountShell>);

    expect(screen.getByRole("link", { name: "Echoes of Eidolon home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Home", exact: true })).toHaveAttribute("href", "/");
    expect(await screen.findByRole("link", { name: "Sign Out" })).toHaveAttribute("href", "/auth/sign-out");
    expect(screen.queryByRole("link", { name: "Administration" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Enter Game" })).not.toBeInTheDocument();
  });

  it.each(["admin", "owner"] as const)("exposes Administration to a non-player %s account", async (role) => {
    authMocks.useSession.mockReturnValue({ data: { user: { id: `${role}-1`, name: role } }, isPending: false });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => access(role) }));
    renderShell(<AccountShell><p>Account content</p></AccountShell>);

    expect(await screen.findByRole("link", { name: "Administration" })).toHaveAttribute("href", "/admin");
    expect(screen.queryByRole("link", { name: "Enter Game" })).not.toBeInTheDocument();
  });

  it("makes Administration an escapable workspace", async () => {
    authMocks.useSession.mockReturnValue({ data: { user: { id: "owner-1", name: "Owner" } }, isPending: false });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => access("owner") }));
    renderShell(<AdminShell><p>Administration content</p></AdminShell>);

    expect(screen.getByRole("link", { name: "Echoes of Eidolon home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Home", exact: true })).toHaveAttribute("href", "/");
    expect(await screen.findByRole("link", { name: "Account" })).toHaveAttribute("href", "/account/profile");
    expect(screen.getByRole("link", { name: "Sign Out" })).toHaveAttribute("href", "/auth/sign-out");
  });

  it("adds authorized exits to the existing game bottom bar", async () => {
    authMocks.useSession.mockReturnValue({ data: { user: { id: "admin-1", name: "Admin" } }, isPending: false });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => access("admin", true) }));
    const { container } = renderShell(<GameShell><p>Game content</p></GameShell>);

    expect(container.querySelectorAll(".game-bottom-bar")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Home", exact: true })).toHaveAttribute("href", "/");
    expect(await screen.findByRole("link", { name: "Account" })).toHaveAttribute("href", "/account/profile");
    expect(screen.getByRole("link", { name: "Administration" })).toHaveAttribute("href", "/admin");
    expect(screen.getByRole("link", { name: "Sign Out" })).toHaveAttribute("href", "/auth/sign-out");
  });
});
