import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { AtlasAdminPage } from "../../src/screens/admin/AtlasAdminPage";

it("does not reinterpret an unknown Atlas screen as the Atlas overview", () => {
  vi.stubGlobal("fetch", vi.fn());
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AtlasAdminPage screen={{ originalPage: 0, page: 0, path: "/admin/atlas/unknown", reviewOrder: 0, screenId: "UNKNOWN", source: "TEST", title: "Unknown" }} /></QueryClientProvider>);
  expect(screen.getByRole("heading", { name: "Atlas workflow unavailable" })).toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});
