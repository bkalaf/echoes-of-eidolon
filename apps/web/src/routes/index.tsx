import { createFileRoute } from "@tanstack/react-router";

import { HomePage } from "../screens/public/HomePage";

export const Route = createFileRoute("/")({
  component: HomePage,
});
