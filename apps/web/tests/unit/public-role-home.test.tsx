import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  getActiveMemberRole: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock("../../src/lib/auth-client", () => ({
  authClient: {
    organization: { getActiveMemberRole: authMocks.getActiveMemberRole },
    useSession: authMocks.useSession,
  },
}));

import { pageManifest } from "../../src/lib/page-manifest";
import { PublicPage } from "../../src/screens/public/PublicPage";

const adminHome = pageManifest.find((entry) => entry.screenId === "PUB_HOME_ADMIN")!;

function renderHome() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <PublicPage screen={adminHome} />
    </QueryClientProvider>,
  );
}

describe("role-specific public home", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not expose role-specific content without a session", () => {
    authMocks.useSession.mockReturnValue({ data: null, isPending: false });
    renderHome();
    expect(screen.getByRole("heading", { name: "Sign in required" })).toBeInTheDocument();
    expect(screen.queryByText(/Admin access|Member access/)).not.toBeInTheDocument();
  });

  it("does not let an admin state request elevate a member", async () => {
    authMocks.useSession.mockReturnValue({ data: { user: { id: "user-1" } }, isPending: false });
    authMocks.getActiveMemberRole.mockResolvedValue({ data: { role: "member" }, error: null });
    renderHome();
    expect(await screen.findByRole("heading", { name: "Member access" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open Administration" })).not.toBeInTheDocument();
  });

  it.each(["admin", "owner"] as const)("shows verified %s access", async (role) => {
    authMocks.useSession.mockReturnValue({ data: { user: { id: "user-1" } }, isPending: false });
    authMocks.getActiveMemberRole.mockResolvedValue({ data: { role }, error: null });
    renderHome();
    expect(await screen.findByRole("heading", { name: role === "owner" ? "Owner access" : "Admin access" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Administration" })).toHaveAttribute("href", "/admin");
  });
});
