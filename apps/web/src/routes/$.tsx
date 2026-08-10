import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { screenForPath } from "../lib/page-manifest";
import { PacketScreen } from "../screens/PacketScreen";

const screenSearchSchema = z.object({ state: z.string().optional() });

export const Route = createFileRoute("/$")({
  validateSearch: screenSearchSchema,
  component: PacketRoute,
});

function PacketRoute() {
  const { _splat = "" } = Route.useParams();
  const { state } = Route.useSearch();
  const screen = screenForPath(`/${_splat}`, state);
  return <PacketScreen screen={screen} />;
}
