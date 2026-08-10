import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  useSession: vi.fn(),
}));

vi.mock("../../src/lib/auth-client", () => ({
  authClient: {
    useSession: authMocks.useSession,
  },
}));

import { pageManifest } from "../../src/lib/page-manifest";
import { PublicPage } from "../../src/screens/public/PublicPage";

const adminHome = pageManifest.find((entry) => entry.screenId === "PUB_HOME_ADMIN")!;
const donate = pageManifest.find((entry) => entry.screenId === "PUB021")!;

function renderPublic(screenEntry = adminHome) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <PublicPage screen={screenEntry} />
    </QueryClientProvider>,
  );
}

describe("role-specific public home", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not expose role-specific content without a session", () => {
    authMocks.useSession.mockReturnValue({ data: null, isPending: false });
    renderPublic();
    expect(screen.getByRole("heading", { name: "Sign in required" })).toBeInTheDocument();
    expect(screen.queryByText(/Admin access|Member access/)).not.toBeInTheDocument();
  });

  it("does not let a member account enter administration", async () => {
    authMocks.useSession.mockReturnValue({ data: { user: { id: "user-1", role: "member" } }, isPending: false });
    renderPublic();
    expect(await screen.findByRole("heading", { name: "Member access level" })).toBeInTheDocument();
    expect(screen.getByText(/does not establish beta\/player eligibility/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open Administration" })).not.toBeInTheDocument();
  });

  it.each(["admin", "owner"] as const)("shows verified %s access", async (role) => {
    authMocks.useSession.mockReturnValue({ data: { user: { id: "user-1", role } }, isPending: false });
    renderPublic();
    expect(await screen.findByRole("heading", { name: role === "owner" ? "Owner access" : "Admin access" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Administration" })).toHaveAttribute("href", "/admin");
  });

  it("does not normalize an unknown stored role into a supplied access level", async () => {
    authMocks.useSession.mockReturnValue({ data: { user: { id: "user-1", role: "unexpected" } }, isPending: false });
    renderPublic();

    expect(await screen.findByRole("heading", { name: "Authorization unavailable" })).toBeInTheDocument();
    expect(screen.queryByText(/User access|Member access level|Admin access|Owner access/)).not.toBeInTheDocument();
  });

  it("opens donation checkout only after live participant eligibility is verified", async () => {
    authMocks.useSession.mockReturnValue({ data: { user: { id: "user-1", role: "user" } }, isPending: false });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ canPlay: true }) }));

    renderPublic(donate);

    expect(await screen.findByRole("heading", { name: "Eligible participant" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continue to donation checkout" })).toHaveAttribute("href", "/donate/checkout");
  });
});
