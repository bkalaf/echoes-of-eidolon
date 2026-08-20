import { createFileRoute, notFound } from "@tanstack/react-router";

import { screenForPath } from "../../../../lib/page-manifest";
import { PacketScreen } from "../../../../screens/PacketScreen";

function importPath(entityKey: string) {
  return `/admin/data/${encodeURIComponent(entityKey)}/import`;
}

export const Route = createFileRoute("/admin/data/$entityKey/import")({
  beforeLoad: ({ params }) => {
    if (!screenForPath(importPath(params.entityKey))) throw notFound();
  },
  head: ({ params }) => {
    const screen = screenForPath(importPath(params.entityKey));
    return { meta: [{ name: "robots", content: "noindex,nofollow" }, { title: `${screen?.title ?? "Import not found"} | Echoes of Eidolon` }] };
  },
  component: ImportRoute,
});

function ImportRoute() {
  const { entityKey } = Route.useParams();
  const pathname = importPath(entityKey);
  return <PacketScreen pathname={pathname} screen={screenForPath(pathname)} />;
}
