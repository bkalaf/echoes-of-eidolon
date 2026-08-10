import { useState } from "react";
import type { PageManifestEntry } from "../../lib/page-manifest";
import { PublicShell } from "../../components/shells/Shells";
import { HardenedSelect } from "../../components/ui/controls";

function ToolsHead({ screen, description }: { screen: PageManifestEntry; description: string }) {
  return <header className="workspace-page-head"><p className="kicker">REVIEW TOOL · {screen.screenId}</p><h1>{screen.title}</h1><p>{description}</p></header>;
}

function Controls({ screen }: { screen: PageManifestEntry }) {
  const [value, setValue] = useState("");
  if (screen.screenId === "TOOL002") return <><ToolsHead screen={screen} description="Free-solo text control review." /><section className="form-card"><label className="field">Free-solo value<input className="input" value={value} onChange={(event) => setValue(event.target.value)} /></label><p>Current value: {value || "None"}</p></section></>;
  if (screen.screenId === "TOOL003") return <><ToolsHead screen={screen} description="Current controlled enum selectors." /><section className="form-card"><HardenedSelect label="World" value="CONCORD" onChange={() => undefined}><option>CONCORD</option><option>RUIN</option><option>SCHISM</option></HardenedSelect><HardenedSelect label="Species kind" value="HUMAN" onChange={() => undefined}><option>HUMAN</option><option>BEAST</option><option>MYTHOS</option><option>PET</option></HardenedSelect><HardenedSelect label="Timeline event type" value="HISTORICAL" onChange={() => undefined}><option>HISTORICAL</option><option>ATROCITY</option><option>EXODUS</option><option>IN_TRANSIT</option></HardenedSelect></section></>;
  if (screen.screenId === "TOOL004") return <><ToolsHead screen={screen} description="Numeric control boundaries and invalid states." /><section className="form-card"><label className="field">Difficulty tier<input className="input" type="number" min="1" max="5" defaultValue="3" /></label><label className="field">Population<input className="input" type="number" min="0" step="1" /></label><label className="field">Longitude<input className="input" type="number" min="-180" max="180" step="0.001" /></label></section></>;
  return <><ToolsHead screen={screen} description="Hardened lookup controls with visible selected values." /><section className="grid-3"><article className="card"><HardenedSelect label="Breed" value="" onChange={() => undefined}><option value="">Select Breed</option></HardenedSelect></article><article className="card"><HardenedSelect label="Antagonist 1" value="" onChange={() => undefined}><option value="">Select Antagonist</option></HardenedSelect></article><article className="card"><HardenedSelect label="Architect" value="" onChange={() => undefined}><option value="">Select Architect</option></HardenedSelect></article></section></>;
}

const componentNames = ["Header", "Footer", "Sidebar", "Page head", "Card", "Form field", "Data table", "Modal", "Map", "Game HUD"];

function Builder({ screen }: { screen: PageManifestEntry }) {
  if (["TOO002"].includes(screen.screenId)) return <><ToolsHead screen={screen} description="Reusable wireframe component library." /><div className="entity-grid">{componentNames.map((name) => <article className="card" key={name}><h2>{name}</h2><span className="tag">Component</span></article>)}</div></>;
  if (screen.screenId === "TOO003") return <><ToolsHead screen={screen} description="Task-specific wireframe templates." /><div className="grid-3">{["Public detail", "Account form", "Admin table", "Admin editor", "Game viewport", "Review control"].map((name) => <article className="card" key={name}><h2>{name}</h2><button className="button">Use template</button></article>)}</div></>;
  return <><ToolsHead screen={screen} description="Compose review wireframes from the current component set." /><div className="builder-layout"><aside className="card"><h2>Components</h2>{componentNames.map((name) => <button key={name}>{name}</button>)}</aside><section className="builder-canvas"><article className="card"><p className="kicker">PAGE HEAD</p><h2>Untitled task</h2><p>Drop components into this review canvas.</p></article></section><aside className="card"><h2>Properties</h2><label className="field">Label<input className="input" /></label><label className="field">Variant<select className="select"><option>Default</option></select></label><button className="button button--gold">Export review</button></aside></div></>;
}

function NavigationStates({ screen }: { screen: PageManifestEntry }) {
  return <><ToolsHead screen={screen} description="Public navigation across guest, user, member and administrator states." /><div className="stack">{["Guest", "User", "Member", "Administrator"].map((state) => <section className="card nav-state" key={state}><strong>{state}</strong><nav><span>Features</span><span>Gameplay</span><span>Merchandise</span><span>Status</span><span>Request Invite</span></nav><span className="tag">{state.toUpperCase()}</span></section>)}</div></>;
}

export function ToolsPage({ screen }: { screen: PageManifestEntry }) {
  let page;
  if (screen.screenId.startsWith("TOOL00") && screen.screenId !== "TOOL005" && screen.screenId !== "TOOL006") page = <Controls screen={screen} />;
  else if (screen.screenId === "TOOL006") page = <NavigationStates screen={screen} />;
  else page = <Builder screen={screen} />;
  return <PublicShell><main className="public-page">{page}</main></PublicShell>;
}
