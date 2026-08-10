import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { PrismaClient } from "../generated/prisma/client";
import { getDatabaseEnv } from "./env";

interface DatabaseSingleton {
  client?: PrismaClient;
  pool?: Pool;
}

const singleton = globalThis as typeof globalThis & {
  __echoesDatabase?: DatabaseSingleton;
};

const database = (singleton.__echoesDatabase ??= {});

export function getDatabase(): PrismaClient {
  if (database.client) return database.client;

  const { DATABASE_URL } = getDatabaseEnv();
  const pool = new Pool({ connectionString: DATABASE_URL });
  const adapter = new PrismaPg(pool);

  database.pool = pool;
  database.client = new PrismaClient({ adapter });
  return database.client;
}

export async function disconnectDatabase(): Promise<void> {
  await database.client?.$disconnect();
  await database.pool?.end();
  database.client = undefined;
  database.pool = undefined;
}
