import { createFileRoute } from "@tanstack/react-router";

import { AboutPage } from "../screens/public/AboutPage";

export const Route = createFileRoute("/about")({
  head: () => ({ meta: [{ title: "About Us | Echoes of Eidolon" }, { name: "robots", content: "index,follow" }] }),
  component: AboutPage,
});
