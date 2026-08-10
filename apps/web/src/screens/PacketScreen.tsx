import type { PageManifestEntry } from "../lib/page-manifest";
import { shellFor } from "../lib/page-manifest";
import { AccountPage } from "./account/AccountPage";
import { AdminPage } from "./admin/AdminPage";
import { AuthPage } from "./auth/AuthPage";
import { PublicPage } from "./public/PublicPage";
import { StorePage } from "./store/StorePage";

export function PacketScreen({ screen }: { screen?: PageManifestEntry }) {
  if (!screen) {
    return (
      <main className="not-found">
        <p className="kicker">404</p>
        <h1>Page not found</h1>
        <a className="button" href="/">Return home</a>
      </main>
    );
  }

  switch (shellFor(screen)) {
    case "auth": return <AuthPage screen={screen} />;
    case "account": return <AccountPage screen={screen} />;
    case "store": return <StorePage screen={screen} />;
    case "public": return <PublicPage screen={screen} />;
    case "admin": return <AdminPage screen={screen} />;
    default:
      return (
        <main className="not-found">
          <p className="kicker">{screen.screenId}</p>
          <h1>{screen.title}</h1>
          <p>This packet screen belongs to a later implementation tranche.</p>
        </main>
      );
  }
}
