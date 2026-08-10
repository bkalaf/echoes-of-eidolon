import { useRef, useState } from "react";

import { PublicShell } from "../../components/shells/Shells";
import { publicFeatures } from "../../content/public";

export function HomePage() {
  const [activeFeature, setActiveFeature] = useState(0);
  const cards = useRef<Array<HTMLAnchorElement | null>>([]);

  const selectFeature = (index: number) => {
    const wrapped = (index + publicFeatures.length) % publicFeatures.length;
    setActiveFeature(wrapped);
    cards.current[wrapped]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  };

  return (
    <PublicShell>
      <section className="hero" aria-labelledby="home-heading">
        <img src="/assets/landing_hero_background.jpg" alt="" />
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
        <div className="feature-carousel" onKeyDown={(event) => {
          if (event.key === "ArrowLeft") selectFeature(activeFeature - 1);
          if (event.key === "ArrowRight") selectFeature(activeFeature + 1);
        }} role="list" tabIndex={0}>
          {publicFeatures.map((feature, index) => (
            <a aria-current={index === activeFeature ? "true" : undefined} className={`feature-card ${index === activeFeature ? "active" : ""}`} href={`/features/${feature.slug}`} key={feature.slug} onFocus={() => setActiveFeature(index)} ref={(node) => { cards.current[index] = node; }} role="listitem">
              <img src={feature.icon} alt="" />
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
          <h2>Free to play. Open to everyone.</h2>
          <p>A subscription will never be required.</p>
        </div>
        <a className="button button--gold" href="/auth/sign-up">
          Create your account
        </a>
      </section>
    </PublicShell>
  );
}
