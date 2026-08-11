import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { userSettingsInputSchema } from "../../../domain/user-settings";
import { requireServerSession } from "../../../server/access";
import { getUserSettings, saveUserSettings } from "../../../server/user-settings";

export const Route = createFileRoute("/api/account/settings")({
  server: { handlers: {
    GET: async ({ request }) => {
      try { return Response.json(await getUserSettings((await requireServerSession(request)).userId)); }
      catch (error) { if (error instanceof Response) return error; throw error; }
    },
    PUT: async ({ request }) => {
      try {
        const access = await requireServerSession(request);
        return Response.json(await saveUserSettings(access.userId, userSettingsInputSchema.parse(await request.json())));
      } catch (error) {
        if (error instanceof Response) return error;
        if (error instanceof z.ZodError) return Response.json({ error: "Settings input is invalid." }, { status: 400 });
        throw error;
      }
    },
  } },
});
