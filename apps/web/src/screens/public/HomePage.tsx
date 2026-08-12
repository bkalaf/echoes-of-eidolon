import { useEffect, useRef, useState } from "react";

import { RegionCrest } from "../../components/RegionCrest";
import { PublicShell } from "../../components/shells/Shells";
import { featureCrestPresentation } from "../../content/feature-crests";
import { managedAssetUrl } from "../../content/managed-assets";
import { publicFeatures } from "../../content/public";
import { authClient } from "../../lib/auth-client";

export function HomePage() {
  const session = authClient.useSession();
  const [activeFeature, setActiveFeature] = useState(0);
  const [carouselPaused, setCarouselPaused] = useState(false);
  const carousel = useRef<HTMLDivElement | null>(null);
  const cards = useRef<Array<HTMLAnchorElement | null>>([]);
  const direction = useRef<1 | -1>(1);

  const scrollFeatureHorizontally = (index: number) => {
    const container = carousel.current;
    const card = cards.current[index];
    if (!container || !card) return;
    const containerRect = container.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const left = Math.max(0, container.scrollLeft + cardRect.left - containerRect.left - (container.clientWidth - cardRect.width) / 2);
    container.scrollTo({ behavior: "smooth", left });
  };

  const selectFeature = (index: number) => {
    const wrapped = (index + publicFeatures.length) % publicFeatures.length;
    setActiveFeature(wrapped);
    scrollFeatureHorizontally(wrapped);
  };

  useEffect(() => {
    const media = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : undefined;
    if (carouselPaused || media?.matches || document.visibilityState !== "visible") return;
    const timer = window.setInterval(() => {
      setActiveFeature((current) => {
        if (current === publicFeatures.length - 1) direction.current = -1;
        else if (current === 0) direction.current = 1;
        const next = current + direction.current;
        scrollFeatureHorizontally(next);
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

  return (
    <PublicShell>
      <div className="home-screen">
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
          <div className="hero-free-cta">
            <div>
              <h2>Free to Play. Open to Everyone.</h2>
              <p>A subscription will never be required.</p>
            </div>
            {session.data
              ? <a className="button button--gold" href="/account/profile">Open Account</a>
              : <a className="button button--gold" href="/auth/sign-up">Create your account</a>}
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
          }} ref={carousel} role="list" tabIndex={0}>
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

      </div>
    </PublicShell>
  );
}
