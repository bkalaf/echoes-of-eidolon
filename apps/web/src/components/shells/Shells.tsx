import type { ReactNode } from "react";

const publicNav = [
  ["Features", "/features"],
  ["Gameplay", "/gameplay"],
  ["Merchandise", "/store"],
  ["Game & Server Status", "/status"],
  ["Request an Invite", "/request-invite"],
] as const;

export function BrandLogo() {
  return <img className="brand-logo" src="/assets/logo.png" alt="Echoes of Eidolon" />;
}

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="site-shell">
      <header className="public-header">
        <a className="brand-link" href="/" aria-label="Echoes of Eidolon home">
          <BrandLogo />
        </a>
        <nav aria-label="Primary navigation">
          {publicNav.map(([label, href]) => (
            <a href={href} key={href}>
              {label}
            </a>
          ))}
        </nav>
        <div className="auth-actions">
          <a className="button button--default" href="/auth/sign-in">
            Sign In
          </a>
          <a className="button button--gold" href="/auth/sign-up">
            Sign Up
          </a>
        </div>
      </header>
      <main className="site-main">{children}</main>
      <footer className="public-footer">
        <BrandLogo />
        <nav aria-label="Footer navigation">
          <a href="/about">About Us</a>
          <a href="/contact">Contact Us</a>
          <a href="/legal">Legal</a>
          <a href="/status">Status</a>
        </nav>
        <span>ECHOES OF EIDOLON · REVIEW WIREFRAME</span>
      </footer>
    </div>
  );
}

interface SideShellProps {
  children: ReactNode;
  label: string;
  navigation: readonly string[];
}

function SideShell({ children, label, navigation }: SideShellProps) {
  return (
    <div className="workspace-shell">
      <header className="workspace-header">
        <BrandLogo />
        <span>{label}</span>
      </header>
      <aside className="workspace-sidebar">
        <strong>{label}</strong>
        {navigation.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </aside>
      <main className="workspace-main">{children}</main>
    </div>
  );
}

export function AuthShell({ children }: { children: ReactNode }) {
  return <PublicShell>{children}</PublicShell>;
}

export function AccountShell({ children }: { children: ReactNode }) {
  return (
    <SideShell label="Account" navigation={["Profile", "Subscription", "Orders", "Progress", "Support", "Settings"]}>
      {children}
    </SideShell>
  );
}

export function StoreShell({ children }: { children: ReactNode }) {
  return <PublicShell>{children}</PublicShell>;
}

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <SideShell label="Administration" navigation={["Dashboard", "Access", "Store", "Data", "Atlas", "Puzzles", "Campaign", "City Builder", "Operations"]}>
      {children}
    </SideShell>
  );
}

export function GameShell({ children }: { children: ReactNode }) {
  return (
    <div className="game-shell">
      <main>{children}</main>
      <footer className="game-bottom-bar">
        <span>Location</span>
        <span>Date · Weekday · Time</span>
        <nav aria-label="Game tools">
          <a href="/game/knowledge">Knowledge</a>
          <a href="/game/bookshelf">Bookshelf</a>
          <a href="/game/maps">Maps</a>
        </nav>
      </footer>
    </div>
  );
}
