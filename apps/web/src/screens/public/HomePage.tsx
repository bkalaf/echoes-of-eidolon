import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { RegionCrest } from "../../components/RegionCrest";
import { PublicShell } from "../../components/shells/Shells";
import { featureCrestPresentation } from "../../content/feature-crests";
import { managedAssetUrl } from "../../content/managed-assets";
import { publicFeatures } from "../../content/public";
import type { AuthorizationRole } from "../../domain/authorization";
import { authClient } from "../../lib/auth-client";

interface PlayerAccess {
  betaEligible: boolean;
  canPlay: boolean;
  role: AuthorizationRole;
}

function AuthenticatedHome({ access }: { access: PlayerAccess }) {
  if (!access.canPlay) {
    return <PublicShell><main className="public-page"><header className="page-head"><p className="eyebrow">Account</p><h1>Player eligibility required</h1><p>This signed-in account does not currently have access to the invite-only beta.</p></header><section className="card"><p>Authorization role and membership entitlement do not grant beta/player eligibility.</p><a className="button" href="/account/profile">Open Account</a></section></main></PublicShell>;
  }
  return <PublicShell><main className="public-page"><header className="page-head"><p className="eyebrow">Invite-only beta</p><h1>Echoes of Eidolon Beta</h1><p>Your authenticated player access has been verified.</p></header><section className="card"><h2>Continue playing</h2><p>Enter the authenticated player shell.</p><a className="button button--gold" href="/game">Enter Game</a></section></main></PublicShell>;
}

export function HomePage() {
  const session = authClient.useSession();
  const playerAccess = useQuery({
    queryKey: ["authorization", "home-player-access", session.data?.user.id],
    enabled: Boolean(session.data),
    queryFn: async () => {
      const response = await fetch("/api/player/access");
      if (!response.ok) throw new Error("Player access could not be verified.");
      return response.json() as Promise<PlayerAccess>;
    },
    retry: false,
  });
  const [activeFeature, setActiveFeature] = useState(0);
  const [carouselPaused, setCarouselPaused] = useState(false);
  const cards = useRef<Array<HTMLAnchorElement | null>>([]);
  const direction = useRef<1 | -1>(1);

  const selectFeature = (index: number) => {
    const wrapped = (index + publicFeatures.length) % publicFeatures.length;
    setActiveFeature(wrapped);
    cards.current[wrapped]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  };

  useEffect(() => {
    const media = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : undefined;
    if (carouselPaused || media?.matches || document.visibilityState !== "visible") return;
    const timer = window.setInterval(() => {
      setActiveFeature((current) => {
        if (current === publicFeatures.length - 1) direction.current = -1;
        else if (current === 0) direction.current = 1;
        const next = current + direction.current;
        cards.current[next]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        return next;
      });
    }, 3_000);
    return () => window.clearInterval(timer);
  }, [carouselPaused]);

  useEffect(() => {
    const onVisibilityChange = () => setCarouselPaused(document.visibilityState !== "visible");
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  if (session.data && playerAccess.isPending) return <PublicShell><main className="public-page"><p className="notice">Checking player eligibility…</p></main></PublicShell>;
  if (session.data && playerAccess.isError) return <PublicShell><main className="public-page"><section className="card"><h1>Player access unavailable</h1><p>Access fails closed when beta/player eligibility cannot be verified.</p></section></main></PublicShell>;
  if (session.data && playerAccess.data) return <AuthenticatedHome access={playerAccess.data} />;

  return (
    <PublicShell>
      <section className="hero" aria-labelledby="home-heading">
        <img src={managedAssetUrl("feature.unique-and-powerful-story")} alt="" />
        <div className="hero-shade" />
        <div className="hero-copy">
          <p className="kicker">Echoes of Eidolon</p>
          <h1 id="home-heading">
            When the moons align,
            <br />
            power can <em>change</em>
            <br />
            <em>hands.</em>
          </h1>
          <p>
            For a thousand years the beacons were silent. Now a distant signal answers the sky.
          </p>
        </div>
      </section>

      <section className="feature-band" aria-label="Features">
        <header className="carousel-head">
          <p aria-live="polite">
            Feature {activeFeature + 1} of {publicFeatures.length}
          </p>
          <div className="action-row">
            <button aria-label="Previous feature" className="carousel-button" onClick={() => selectFeature(activeFeature - 1)}>←</button>
            <button aria-label="Next feature" className="carousel-button" onClick={() => selectFeature(activeFeature + 1)}>→</button>
          </div>
        </header>
        <div className="feature-carousel" onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setCarouselPaused(false);
        }} onFocus={() => setCarouselPaused(true)} onMouseEnter={() => setCarouselPaused(true)} onMouseLeave={() => setCarouselPaused(false)} onKeyDown={(event) => {
          if (event.key === "ArrowLeft") selectFeature(activeFeature - 1);
          if (event.key === "ArrowRight") selectFeature(activeFeature + 1);
        }} role="list" tabIndex={0}>
          {publicFeatures.map((feature, index) => (
            <a aria-current={index === activeFeature ? "true" : undefined} className={`feature-card ${index === activeFeature ? "active" : ""}`} href={`/features/${feature.slug}`} key={feature.slug} onFocus={() => setActiveFeature(index)} ref={(node) => { cards.current[index] = node; }} role="listitem">
              <RegionCrest {...featureCrestPresentation(feature.slug)} />
              <span>
                <strong>{feature.title}</strong>
                <small>{feature.summary}</small>
              </span>
            </a>
          ))}
        </div>
      </section>

      <section className="free-band">
        <div>
          <h2>Free to Play. Open to Everyone.</h2>
          <p>A subscription will never be required.</p>
        </div>
        <a className="button button--gold" href="/auth/sign-up">
          Create your account
        </a>
      </section>
    </PublicShell>
  );
}
