import { createFileRoute, notFound } from "@tanstack/react-router";

import { entityForPath } from "../../../../content/entities";
import type { PageManifestEntry } from "../../../../lib/page-manifest";
import { PacketScreen } from "../../../../screens/PacketScreen";

export function recordDetailScreen(entityKey: string): PageManifestEntry | undefined {
  const entity = entityForPath(`/admin/data/${entityKey}`);
  if (!entity) return undefined;
  return {
    originalPage: 0,
    page: 0,
    path: `/admin/data/${entityKey}/sample-record`,
    reviewOrder: 0,
    screenId: `DATA_${entity.toLocaleUpperCase("en-US")}_EDIT`,
    source: "Release 0.3.0 registry-backed record detail route",
    title: `${entity} Record`,
  };
}

export const Route = createFileRoute("/admin/data/$entityKey/$recordId")({
  beforeLoad: ({ params }) => {
    if (!recordDetailScreen(params.entityKey)) throw notFound();
  },
  head: ({ params }) => ({ meta: [{ name: "robots", content: "noindex,nofollow" }, { title: `${recordDetailScreen(params.entityKey)?.title ?? "Record not found"} | Echoes of Eidolon` }] }),
  component: RecordDetailRoute,
});

function RecordDetailRoute() {
  const params = Route.useParams();
  const screen = recordDetailScreen(params.entityKey);
  if (!screen) return <PacketScreen />;
  const pathname = `/admin/data/${encodeURIComponent(params.entityKey)}/${encodeURIComponent(params.recordId)}`;
  return <PacketScreen pathname={pathname} screen={screen} />;
}
