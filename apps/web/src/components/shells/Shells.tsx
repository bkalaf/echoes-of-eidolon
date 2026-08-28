import { useState, type ReactNode } from "react";

import { managedAssetUrl } from "../../content/managed-assets";
import { useNavigationAccess, type NavigationAccessState } from "../../lib/navigation-access";
import { pageManifest, shellFor, type ShellKind } from "../../lib/page-manifest";
import { GameAudioMixer } from "../GameAudioMixer";
import { GameAudioEngine } from "../GameAudioEngine";

const publicNav = [
  ["Features", "/features"],
  ["Gameplay", "/gameplay"],
  ["Merchandise", "/store"],
  ["Game & Server Status", "/status"],
  ["Request an Invite", "/request-invite"],
] as const;

function directoryHref(screenId: string, path: string | null, fallback: string) {
  if (path === null) return `${fallback}?state=${encodeURIComponent(screenId)}`;
  const owner = path.replace(/^Modal in /, "");
  if (path.startsWith("Modal in ")) return `${owner}?state=${encodeURIComponent(screenId)}`;
  if (owner.includes(":")) return null;
  const duplicates = pageManifest.filter((entry) => entry.path === path);
  return duplicates.length > 1 ? `${owner}${owner.includes("?") ? "&" : "?"}state=${encodeURIComponent(screenId)}` : owner;
}

function ManifestNavigationDirectory({ shells, fallback, label }: { shells: ShellKind[]; fallback: string; label: string }) {
  const [open, setOpen] = useState(false);
  const links = pageManifest.flatMap((entry) => {
    if (!shells.includes(shellFor(entry))) return [];
    const href = directoryHref(entry.screenId, entry.path, fallback);
    return href ? [{ href, screenId: entry.screenId, title: entry.title }] : [];
  });
  return <details className="manifest-navigation-directory" onToggle={(event) => setOpen(event.currentTarget.open)}><summary>{label}</summary>{open && <nav aria-label={label}>{links.map((entry) => <a href={entry.href} key={`${entry.screenId}:${entry.href}`}>{entry.title} <small>({entry.screenId})</small></a>)}</nav>}</details>;
}

export function BrandLogo() {
  return <img className="brand-logo" src={managedAssetUrl("brand.logo-alpha")} alt="Echoes of Eidolon" />;
}

export function BrandHomeLink() {
  return <a className="brand-link" href="/" aria-label="Echoes of Eidolon home"><BrandLogo /></a>;
}

function PublicAuthControls({ state }: { state: NavigationAccessState }) {
  const { accessStatus, hydrated, navigation, session } = state;
  if (!hydrated || session.isPending) return <div className="auth-actions" aria-label="Checking account session" />;
  if (session.data) {
    const initial = session.data.user.name?.trim().charAt(0).toUpperCase() ?? "";
    return <div className="auth-actions">
      {accessStatus === "error" && <span className="navigation-status" role="status">Player access is temporarily unavailable.</span>}
      {navigation.administration && <a className="button" href="/admin">Administration</a>}
      {navigation.puzzles && <a className="button" href="/puzzles">Puzzles</a>}
      {navigation.game && <a className="button button--gold" href="/game">Enter Game</a>}
      <a aria-label="Account" className="avatar-link" href="/account/profile"><span aria-hidden="true">{initial}</span></a>
      <a className="button" href="/auth/sign-out">Sign Out</a>
    </div>;
  }
  return <div className="auth-actions"><a className="button button--default" href="/auth/sign-in">Sign In</a><a className="button button--gold" href="/auth/sign-up">Sign Up</a></div>;
}

function ShellFooter({ canPlay = false, children, className = "" }: { canPlay?: boolean; children?: ReactNode; className?: string }) {
  return <footer className={["public-footer", className].filter(Boolean).join(" ")}>
    <nav aria-label="Footer navigation">
      <a href="/about">About Us</a>
      <a href="/contact">Contact Us</a>
      <a href="/legal">Legal</a>
      {canPlay && <a href="/donate">Donate</a>}
    </nav>
    {children}
    <span>© Echoes of Eidolon</span>
  </footer>;
}

export function PublicShell({ children, immersive = false }: { children: ReactNode; immersive?: boolean }) {
  const navigationState = useNavigationAccess();
  return (
    <div className={`site-shell${immersive ? " site-shell--immersive" : ""}`}>
      {!immersive && <header className="public-header">
        <BrandHomeLink />
        <nav aria-label="Primary navigation">
          {publicNav.map(([label, href]) => (
            <a href={href} key={href}>
              {label}
            </a>
          ))}
        </nav>
        <PublicAuthControls state={navigationState} />
      </header>}
      <main className="site-main">{children}</main>
      {!immersive && <ShellFooter canPlay={navigationState.navigation.game}><ManifestNavigationDirectory fallback="/" label="Public page directory" shells={["public", "store", "auth"]} /></ShellFooter>}
    </div>
  );
}

interface SideShellProps {
  children: ReactNode;
  label: string;
  navigation: ReadonlyArray<readonly [string, string]>;
}

function SideShell({ children, label, navigation }: SideShellProps) {
  const navigationState = useNavigationAccess();
  const authorized = navigationState.navigation;
  return (
    <div className="workspace-shell">
      <header className="workspace-header">
        <BrandHomeLink />
        <span>{label}</span>
      </header>
      <aside className="workspace-sidebar">
        <strong>{label}</strong>
        <a href="/">Home</a>
        {label === "Administration" && authorized.account && <a href="/account/profile">Account</a>}
        {authorized.administration && <a href="/admin">Administration</a>}
        {authorized.puzzles && <a href="/puzzles">Puzzles</a>}
        {authorized.game && <a href="/game">Enter Game</a>}
        {navigation.map(([item, href]) => (
          <a href={href} key={href}>{item}</a>
        ))}
        {authorized.signOut && <a href="/auth/sign-out">Sign Out</a>}
        <ManifestNavigationDirectory fallback={label === "Administration" ? "/admin" : "/account/profile"} label={`${label} page directory`} shells={label === "Administration" ? ["admin", "tools-review"] : ["account"]} />
      </aside>
      <main className="workspace-main">{children}</main>
      <ShellFooter canPlay={authorized.game} className="workspace-footer" />
    </div>
  );
}

export function AuthShell({ children }: { children: ReactNode }) {
  return <PublicShell>{children}</PublicShell>;
}

export function AccountShell({ children }: { children: ReactNode }) {
  return (
    <SideShell label="Account" navigation={[["Profile", "/account/profile"], ["Subscription", "/account/subscription"], ["Orders", "/account/orders"], ["Settings", "/account/settings"], ["Progress", "/account/progress"], ["Achievements", "/account/achievements"], ["Support", "/account/support"], ["Invitations", "/account/invitations/request"]]}>
      {children}
    </SideShell>
  );
}

export function StoreShell({ children }: { children: ReactNode }) {
  return <PublicShell>{children}</PublicShell>;
}

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <SideShell label="Administration" navigation={[["Dashboard", "/admin"], ["Access", "/admin/access"], ["Store", "/admin/store"], ["Data", "/admin/data"], ["Atlas", "/admin/atlas"], ["Puzzles", "/admin/puzzles"], ["Campaign", "/admin/campaign"], ["City Builder", "/admin/city-builder"], ["Operations", "/admin/operations"]]}>
      {children}
    </SideShell>
  );
}

export function GameShell({ children }: { children: ReactNode }) {
  const navigationState = useNavigationAccess();
  const navigation = navigationState.navigation;
  return (
    <GameAudioEngine><div className="game-shell">
      <main>{children}</main>
      <footer className="game-bottom-bar">
        <span>Location unavailable</span>
        <span>Date · Weekday · Time unavailable</span>
        <nav aria-label="Game tools">
          <a href="/game/knowledge">Knowledge</a>
          <a href="/game/bookshelf">Bookshelf</a>
          <a href="/game/maps">Maps</a>
          <a href="/game?state=GAME_HEALTH01_PARTY_HEALTH">Party Health</a>
          <a href="/game?state=GAME_INV01_CONCORD">Inventory</a>
          <a href="/game?state=GAME_LED01_CONCORD">Withdrawals</a>
        </nav>
        <nav aria-label="Site navigation">
          <a href="/">Home</a>
          {navigation.account && <a href="/account/profile">Account</a>}
          {navigation.administration && <a href="/admin">Administration</a>}
          {navigation.puzzles && <a href="/puzzles">Puzzles</a>}
          {navigation.signOut && <a href="/auth/sign-out">Sign Out</a>}
        </nav>
        <GameAudioMixer />
        <ManifestNavigationDirectory fallback="/game" label="Game screen directory" shells={["game"]} />
      </footer>
    </div></GameAudioEngine>
  );
}
