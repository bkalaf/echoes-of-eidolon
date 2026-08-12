import type { PageManifestEntry } from "../lib/page-manifest";
import { shellFor } from "../lib/page-manifest";
import { AccountPage } from "./account/AccountPage";
import { AdminPage } from "./admin/AdminPage";
import { AuthPage } from "./auth/AuthPage";
import { PublicPage } from "./public/PublicPage";
import { StorePage } from "./store/StorePage";
import { GamePage } from "./game/GamePage";
import { ToolsPage } from "./tools/ToolsPage";

export function PacketScreen({ pathname, screen }: { pathname?: string; screen?: PageManifestEntry }) {
  if (!screen) {
    return (
      <main className="not-found">
        <p className="kicker">404</p>
        <h1>Page not found</h1>
        <a className="button" href="/">Return home</a>
      </main>
    );
  }

  if (screen.screenId === "ACC030") {
    return <AccountPage pathname={pathname} screen={screen} />;
  }
  if (screen.screenId.startsWith("GAME") || screen.screenId.startsWith("GAM")) {
    return <GamePage screen={screen} />;
  }
  if (screen.screenId.startsWith("TOOL") || screen.screenId.startsWith("TOO")) {
    return <ToolsPage screen={screen} />;
  }
  if (screen.screenId === "CAM006") {
    return <AdminPage pathname={pathname} screen={screen} />;
  }

  switch (shellFor(screen)) {
    case "auth": return <AuthPage screen={screen} />;
    case "account": return <AccountPage pathname={pathname} screen={screen} />;
    case "store": return <StorePage pathname={pathname} screen={screen} />;
    case "public": return <PublicPage pathname={pathname} screen={screen} />;
    case "admin": return <AdminPage pathname={pathname} screen={screen} />;
    case "game": return <GamePage screen={screen} />;
    case "tools-review": return <ToolsPage screen={screen} />;
    default:
      return (
        <main className="not-found">
          <p className="kicker">{screen.screenId}</p>
          <h1>{screen.title}</h1>
          <p>No shell owner is registered for this manifest entry.</p>
        </main>
      );
  }
}
