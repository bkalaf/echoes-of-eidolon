import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { isCrawlablePath } from "../lib/crawlability";
import { screenForPath } from "../lib/page-manifest";
import { PacketScreen } from "../screens/PacketScreen";

const screenSearchSchema = z.object({ state: z.string().optional() });

export const Route = createFileRoute("/$")({
  validateSearch: screenSearchSchema,
  head: ({ params }) => {
    const pathname = `/${params._splat ?? ""}`;
    const screen = screenForPath(pathname);
    return {
      meta: [
        { title: screen ? `${screen.title} | Echoes of Eidolon` : "Page not found | Echoes of Eidolon" },
        { name: "robots", content: isCrawlablePath(pathname) ? "index,follow" : "noindex,nofollow" },
      ],
    };
  },
  component: PacketRoute,
});

function PacketRoute() {
  const { _splat = "" } = Route.useParams();
  const { state } = Route.useSearch();
  const screen = screenForPath(`/${_splat}`, state);
  return <PacketScreen pathname={`/${_splat}`} screen={screen} />;
}
