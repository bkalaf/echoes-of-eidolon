import { createFileRoute, notFound } from "@tanstack/react-router";
import { z } from "zod";

import publicReleaseArtifact from "../data/public-release-notes.generated.json";
import { isCrawlablePath } from "../lib/crawlability";
import { screenForPath } from "../lib/page-manifest";
import { PacketScreen } from "../screens/PacketScreen";

const screenSearchSchema = z.object({ state: z.string().optional() });
const publicReleases = publicReleaseArtifact.releases as Array<{ title: string; version: string }>;

export const Route = createFileRoute("/$")({
  validateSearch: screenSearchSchema,
  beforeLoad: ({ params }) => {
    const pathname = `/${params._splat ?? ""}`;
    const releaseVersion = /^\/status\/releases\/([^/]+)$/.exec(pathname)?.[1];
    if (releaseVersion && !publicReleases.some((release) => release.version === releaseVersion)) {
      throw notFound();
    }
  },
  notFoundComponent: () => <PacketScreen />,
  head: ({ params }) => {
    const pathname = `/${params._splat ?? ""}`;
    const screen = screenForPath(pathname);
    const releaseVersion = /^\/status\/releases\/([^/]+)$/.exec(pathname)?.[1];
    const release = publicReleases.find((entry) => entry.version === releaseVersion);
    return {
      meta: [
        { title: release ? `${release.title} | Echoes of Eidolon` : screen ? `${screen.title} | Echoes of Eidolon` : "Page not found | Echoes of Eidolon" },
        { name: "robots", content: isCrawlablePath(pathname) ? "index,follow" : "noindex,nofollow" },
      ],
      links: release ? [{ rel: "canonical", href: `https://app.eidolon-gaming.com${pathname}` }] : [],
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
