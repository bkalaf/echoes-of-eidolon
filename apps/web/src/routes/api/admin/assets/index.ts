import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { ManagedAssetMediaKind } from "../../../../generated/prisma/enums";
import { requireAdministration } from "../../../../server/access";
import { getDatabase } from "../../../../server/database";

const mediaKindSchema = z.enum(ManagedAssetMediaKind);

export const Route = createFileRoute("/api/admin/assets/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await requireAdministration(request);
          const value = new URL(request.url).searchParams.get("mediaKind");
          const mediaKind = value == null ? undefined : mediaKindSchema.parse(value);
          const assets = await getDatabase().managedAsset.findMany({
            where: mediaKind ? { mediaKind } : undefined,
            orderBy: { managedAssetId: "asc" },
            select: {
              byteSize: true,
              managedAssetId: true,
              mediaKind: true,
              mimeType: true,
              objectKey: true,
              purposeLinks: { orderBy: { purpose: "asc" }, select: { purpose: true } },
              sha256: true,
              technicalMetadata: true,
            },
          });
          return Response.json({
            assets: assets.map((asset) => ({ ...asset, byteSize: asset.byteSize.toString() })),
            total: assets.length,
          });
        } catch (error) {
          if (error instanceof Response) return error;
          if (error instanceof z.ZodError) return Response.json({ error: "Unknown managed-asset media kind." }, { status: 400 });
          throw error;
        }
      },
    },
  },
});
