import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { requireAdministration } from "../../../../server/access";
import { getDatabase } from "../../../../server/database";

const searchSchema = z.string().trim().max(100).catch("");

export const Route = createFileRoute("/api/admin/accounts/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await requireAdministration(request);
          const search = searchSchema.parse(new URL(request.url).searchParams.get("search") ?? "");
          const where = search
            ? {
              OR: [
                { email: { contains: search, mode: "insensitive" as const } },
                { name: { contains: search, mode: "insensitive" as const } },
                { username: { contains: search, mode: "insensitive" as const } },
              ],
            }
            : undefined;
          const [accounts, total] = await getDatabase().$transaction([
            getDatabase().user.findMany({
              where,
              orderBy: { createdAt: "desc" },
              take: 20,
              select: {
                id: true,
                name: true,
                username: true,
                email: true,
                role: true,
                betaEligible: true,
                banned: true,
                createdAt: true,
              },
            }),
            getDatabase().user.count({ where }),
          ]);
          return Response.json({
            accounts: accounts.map(({ id, ...account }) => ({ ...account, userId: id })),
            total,
          });
        } catch (error) {
          if (error instanceof Response) return error;
          if (error instanceof z.ZodError) return Response.json({ error: "Invalid account search." }, { status: 400 });
          throw error;
        }
      },
    },
  },
});
