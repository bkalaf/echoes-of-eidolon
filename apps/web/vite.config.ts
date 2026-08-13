import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "node:fs";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

const packageVersion = (JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string }).version;

export default defineConfig({
  define: {
    __EIDOLON_BUILD_GIT_SHA__: JSON.stringify(process.env.EIDOLON_BUILD_GIT_SHA ?? null),
    __EIDOLON_BUILD_VERSION__: JSON.stringify(packageVersion),
  },
  server: { port: 3000 },
  resolve: { tsconfigPaths: true },
  plugins: [tanstackStart(), nitro({ noExternals: ["@prisma/client", "tslib"] }), tailwindcss(), viteReact()],
});
