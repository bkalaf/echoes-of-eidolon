import { useEffect, useState, type ReactNode } from "react";

import { managedAssetUrl } from "../../content/managed-assets";
import { authClient } from "../../lib/auth-client";
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

function PublicAuthControls() {
  const session = authClient.useSession();
  if (session.isPending) return <div className="auth-actions" aria-label="Checking account session" />;
  if (session.data) {
    const initial = session.data.user.name?.trim().charAt(0).toUpperCase() ?? "";
    return <div className="auth-actions"><a aria-label="Account" className="avatar-link" href="/account/profile"><span aria-hidden="true">{initial}</span></a><a className="button button--gold" href="/auth/sign-out">Sign Out</a></div>;
  }
  return <div className="auth-actions"><a className="button button--default" href="/auth/sign-in">Sign In</a><a className="button button--gold" href="/auth/sign-up">Sign Up</a></div>;
}

function EligibleDonateLink() {
  const session = authClient.useSession();
  const userId = session.data?.user.id;
  const [access, setAccess] = useState<{ canPlay: boolean; userId: string }>();

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    if (!userId) return () => controller.abort();

    void fetch("/api/player/access", { signal: controller.signal })
      .then(async (response) => response.ok ? response.json() as Promise<{ canPlay?: unknown }> : undefined)
      .then((result) => { if (active) setAccess({ canPlay: result?.canPlay === true, userId }); })
      .catch(() => { if (active) setAccess({ canPlay: false, userId }); });
    return () => {
      active = false;
      controller.abort();
    };
  }, [userId]);

  return access && access.userId === userId && access.canPlay ? <a href="/donate">Donate</a> : null;
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
        <PublicAuthControls />
        <LoginSoundtrackPlayer />
      </header>
      <main className="site-main">{children}</main>
      <footer className="public-footer">
        <nav aria-label="Footer navigation">
          <a href="/about">About Us</a>
          <a href="/contact">Contact Us</a>
          <a href="/legal">Legal</a>
          <EligibleDonateLink />
        </nav>
        <span>© Echoes of Eidolon</span>
      </footer>
    </div>
  );
}

interface SideShellProps {
  children: ReactNode;
  label: string;
  navigation: ReadonlyArray<readonly [string, string]>;
}

function SideShell({ children, label, navigation }: SideShellProps) {
  return (
    <div className="workspace-shell">
      <header className="workspace-header">
        <BrandLogo />
        <span>{label}</span>
        <LoginSoundtrackPlayer />
      </header>
      <aside className="workspace-sidebar">
        <strong>{label}</strong>
        {navigation.map(([item, href]) => (
          <a href={href} key={href}>{item}</a>
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
      </footer>
    </div>
  );
}
