import type { ReactNode } from "react";

import { managedAssetUrl } from "../../content/managed-assets";
import { useNavigationAccess, type NavigationAccessState } from "../../lib/navigation-access";
import { LoginSoundtrackPlayer } from "../LoginSoundtrackPlayer";

const publicNav = [
  ["Features", "/features"],
  ["Gameplay", "/gameplay"],
  ["Merchandise", "/store"],
  ["Game & Server Status", "/status"],
  ["Request an Invite", "/request-invite"],
] as const;

export function BrandLogo() {
  return <img className="brand-logo" src={managedAssetUrl("brand.logo-alpha")} alt="Echoes of Eidolon" />;
}

export function BrandHomeLink() {
  return <a className="brand-link" href="/" aria-label="Echoes of Eidolon home"><BrandLogo /></a>;
}

function PublicAuthControls({ state }: { state: NavigationAccessState }) {
  const { accessStatus, navigation, session } = state;
  if (session.isPending) return <div className="auth-actions" aria-label="Checking account session" />;
  if (session.data) {
    const initial = session.data.user.name?.trim().charAt(0).toUpperCase() ?? "";
    return <div className="auth-actions">
      {accessStatus === "error" && <span className="navigation-status" role="status">Player access is temporarily unavailable.</span>}
      {navigation.administration && <a className="button" href="/admin">Administration</a>}
      {navigation.game && <a className="button button--gold" href="/game">Enter Game</a>}
      <a aria-label="Account" className="avatar-link" href="/account/profile"><span aria-hidden="true">{initial}</span></a>
      <a className="button" href="/auth/sign-out">Sign Out</a>
    </div>;
  }
  return <div className="auth-actions"><a className="button button--default" href="/auth/sign-in">Sign In</a><a className="button button--gold" href="/auth/sign-up">Sign Up</a></div>;
}

function ShellFooter({ canPlay = false, className = "" }: { canPlay?: boolean; className?: string }) {
  return <footer className={["public-footer", className].filter(Boolean).join(" ")}>
    <nav aria-label="Footer navigation">
      <a href="/about">About Us</a>
      <a href="/contact">Contact Us</a>
      <a href="/legal">Legal</a>
      {canPlay && <a href="/donate">Donate</a>}
    </nav>
    <span>© Echoes of Eidolon</span>
  </footer>;
}

export function PublicShell({ children }: { children: ReactNode }) {
  const navigationState = useNavigationAccess();
  return (
    <div className="site-shell">
      <header className="public-header">
        <BrandHomeLink />
        <nav aria-label="Primary navigation">
          {publicNav.map(([label, href]) => (
            <a href={href} key={href}>
              {label}
            </a>
          ))}
        </nav>
        <PublicAuthControls state={navigationState} />
        <LoginSoundtrackPlayer />
      </header>
      <main className="site-main">{children}</main>
      <ShellFooter canPlay={navigationState.navigation.game} />
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
        <LoginSoundtrackPlayer />
      </header>
      <aside className="workspace-sidebar">
        <strong>{label}</strong>
        <a href="/">Home</a>
        {label === "Administration" && authorized.account && <a href="/account/profile">Account</a>}
        {authorized.administration && <a href="/admin">Administration</a>}
        {authorized.game && <a href="/game">Enter Game</a>}
        {navigation.map(([item, href]) => (
          <a href={href} key={href}>{item}</a>
        ))}
        {authorized.signOut && <a href="/auth/sign-out">Sign Out</a>}
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
    <div className="game-shell">
      <LoginSoundtrackPlayer />
      <main>{children}</main>
      <footer className="game-bottom-bar">
        <span>Location unavailable</span>
        <span>Date · Weekday · Time unavailable</span>
        <nav aria-label="Game tools">
          <a href="/game/knowledge">Knowledge</a>
          <a href="/game/bookshelf">Bookshelf</a>
          <a href="/game/maps">Maps</a>
        </nav>
        <nav aria-label="Site navigation">
          <a href="/">Home</a>
          {navigation.account && <a href="/account/profile">Account</a>}
          {navigation.administration && <a href="/admin">Administration</a>}
          {navigation.signOut && <a href="/auth/sign-out">Sign Out</a>}
        </nav>
      </footer>
    </div>
  );
}
