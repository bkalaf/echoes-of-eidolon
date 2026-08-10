import { createFileRoute } from "@tanstack/react-router";

import { AboutPage } from "../screens/public/AboutPage";

export const Route = createFileRoute("/about")({ component: AboutPage });
