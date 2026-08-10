import { PublicShell } from "../../components/shells/Shells";
import { publicFeatures } from "../../content/public";

export function HomePage() {
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
        <div className="feature-carousel" role="list" tabIndex={0}>
          {publicFeatures.map((feature) => (
            <a className="feature-card" href={`/features/${feature.slug}`} key={feature.slug} role="listitem">
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
