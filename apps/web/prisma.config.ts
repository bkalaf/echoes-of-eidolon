import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // Code generation does not connect. Runtime access still validates DATABASE_URL.
  datasource: {
    url: process.env.DATABASE_URL ?? "postgresql://localhost/echoes_of_eidolon",
  },
});
