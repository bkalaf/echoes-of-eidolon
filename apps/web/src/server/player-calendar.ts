import type { PrismaClient } from "../generated/prisma/client";
import { projectCalendarOrdinals } from "../domain/calendar";
import { getDatabase } from "./database";

type Database = PrismaClient;

export async function getPlayerCalendar(database: Database = getDatabase()) {
  const ordinals = await database.calendarOrdinal.findMany({ orderBy: { ordinalDay: "asc" } });
  return { months: projectCalendarOrdinals(ordinals) };
}
