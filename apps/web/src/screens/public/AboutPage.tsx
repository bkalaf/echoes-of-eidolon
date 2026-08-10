import { PublicShell } from "../../components/shells/Shells";

export function AboutPage() {
  return <PublicShell><main className="public-page"><header className="page-head"><p className="eyebrow">About Us</p><h1>Eidolon Gaming</h1><p>A long-form game built around meaningful conversation, research, consequence, and a world that keeps moving.</p></header><div className="grid-2"><article className="card"><h2>Four promises</h2><p>A subscription will never be required.</p><ul><li>Never pay-to-win</li><li>Never sell you</li><li>Never waste your time</li></ul></article><article className="card"><h2>How it is made</h2><p>Authored narrative + deterministic systems + constrained AI dialogue + researched source material.</p></article></div><article className="card"><h2>Company</h2><address>Eidolon Gaming<br />5400 Kearny Mesa Rd, 1712<br />San Diego CA 92111</address></article></main></PublicShell>;
}
