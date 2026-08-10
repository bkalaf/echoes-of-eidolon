import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { pageManifest } from "../lib/page-manifest";
import { PacketScreen } from "../screens/PacketScreen";
import { HomePage } from "../screens/public/HomePage";

export const Route = createFileRoute("/")({
  validateSearch: z.object({ state: z.string().optional() }),
  component: IndexRoute,
});

function IndexRoute() {
  const { state } = Route.useSearch();
  const selected = state ? pageManifest.find((entry) => entry.screenId === state) : undefined;
  return selected ? <PacketScreen screen={selected} /> : <HomePage />;
}
