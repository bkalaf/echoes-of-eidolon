import { useState } from "react";
import type { PageManifestEntry } from "../../lib/page-manifest";
import { PublicShell } from "../../components/shells/Shells";
import { BoundedNumberField, FiniteChipSelection, HardenedSelect } from "../../components/ui/controls";
import { PersonalityFamily } from "../../generated/prisma/enums";

const personalityFamilyTokens = Object.values(PersonalityFamily).sort((left, right) => left.localeCompare(right));
const reviewedMultiSelectTokens = personalityFamilyTokens.slice(0, 12);

function ToolsHead({ screen, description }: { screen: PageManifestEntry; description: string }) {
  return <header className="workspace-page-head"><p className="kicker">REVIEW TOOL · {screen.screenId}</p><h1>{screen.title}</h1><p>{description}</p></header>;
}

function Controls({ screen }: { screen: PageManifestEntry }) {
  const [value, setValue] = useState("");
  const [singleFamily, setSingleFamily] = useState<string[]>([PersonalityFamily.ACCOUNTABILITY]);
  const [multipleFamilies, setMultipleFamilies] = useState<string[]>(reviewedMultiSelectTokens);
  if (screen.screenId === "TOOL002") return <><ToolsHead screen={screen} description="Free-solo text control review." /><section className="form-card"><label className="field">Free-solo value<input className="input" value={value} onChange={(event) => setValue(event.target.value)} /></label><p>Current value: {value || "None"}</p></section></>;
  if (screen.screenId === "TOOL003") return <><ToolsHead screen={screen} description="Hardened finite selects use rounded removable chips. Large enums cycle a stable palette in alphabetical order." /><div className="grid-2"><section className="card"><h2>Single select</h2><FiniteChipSelection allowedTokens={personalityFamilyTokens} label="Personality family" onChange={setSingleFamily} selectedTokens={singleFamily} /><p>Raw enum token is preserved; X clears the current value when the field permits empty.</p></section><section className="card"><h2>Multi select</h2><FiniteChipSelection allowedTokens={personalityFamilyTokens} label="Personality family" multiple onChange={setMultipleFamilies} selectedTokens={multipleFamilies} /><p>Each X removes only that value. Color is supplementary and never the only cue.</p></section></div></>;
  if (screen.screenId === "TOOL004") return <><ToolsHead screen={screen} description="Numeric control boundaries and invalid states." /><section className="form-card"><BoundedNumberField control="gameOrdinalDay" /><BoundedNumberField control="gameHour" /><BoundedNumberField control="gameMinute" /><BoundedNumberField control="gameYear" /><BoundedNumberField control="book" /><BoundedNumberField control="latitude" /><BoundedNumberField control="longitude" /></section></>;
  if (screen.screenId === "TOOL001") return <><ToolsHead screen={screen} description="Hardened lookup controls with visible selected values." /><section className="grid-3"><article className="card"><HardenedSelect label="Breed" value="" onChange={() => undefined}><option value="">Select Breed</option></HardenedSelect></article><article className="card"><HardenedSelect label="Antagonist 1" value="" onChange={() => undefined}><option value="">Select Antagonist</option></HardenedSelect></article><article className="card"><HardenedSelect label="Architect" value="" onChange={() => undefined}><option value="">Select Architect</option></HardenedSelect></article></section></>;
  return <Unavailable screen={screen} />;
}

const componentNames = ["Header", "Footer", "Sidebar", "Page head", "Card", "Form field", "Data table", "Modal", "Map", "Game HUD"];

function Builder({ screen }: { screen: PageManifestEntry }) {
  if (["TOO002"].includes(screen.screenId)) return <><ToolsHead screen={screen} description="Reusable wireframe component library." /><div className="entity-grid">{componentNames.map((name) => <article className="card" key={name}><h2>{name}</h2><span className="tag">Component</span></article>)}</div></>;
  if (screen.screenId === "TOO003") return <><ToolsHead screen={screen} description="Task-specific wireframe templates." /><div className="grid-3">{["Public detail", "Account form", "Admin table", "Admin editor", "Game viewport", "Review control"].map((name) => <article className="card" key={name}><h2>{name}</h2><button className="button">Use template</button></article>)}</div></>;
  if (["TOOL005", "TOO001"].includes(screen.screenId)) return <><ToolsHead screen={screen} description="Compose review wireframes from the current component set." /><div className="builder-layout"><aside className="card"><h2>Components</h2>{componentNames.map((name) => <button key={name}>{name}</button>)}</aside><section className="builder-canvas"><article className="card"><p className="kicker">PAGE HEAD</p><h2>Untitled task</h2><p>Drop components into this review canvas.</p></article></section><aside className="card"><h2>Properties</h2><label className="field">Label<input className="input" /></label><label className="field">Variant<select className="select"><option>Default</option></select></label><button className="button button--gold">Export review</button></aside></div></>;
  return <Unavailable screen={screen} />;
}

function Unavailable({ screen }: { screen: PageManifestEntry }) {
  return <><ToolsHead screen={screen} description="This review-tool screen is not registered." /><section className="card"><h2>Review tool unavailable</h2><p>No review workflow is inferred for an unknown screen.</p></section></>;
}

function NavigationStates({ screen }: { screen: PageManifestEntry }) {
  const capabilities = [
    ["Browse public pages", "yes", "yes", "yes", "yes", "yes"],
    ["Account", "no", "yes", "yes", "yes", "yes"],
    ["Play", "no", "when invited/eligible", "when invited/eligible", "participation-dependent", "yes"],
    ["Member benefits", "no", "no", "yes", "not implicit", "owner policy"],
    ["Administer users/data", "no", "no", "no", "yes", "yes"],
    ["Change authorization roles", "no", "no", "no", "no", "yes"],
  ] as const;
  return <><ToolsHead screen={screen} description="The five displayed access levels and their supplied capability boundaries." /><section className="card"><p>Authorization role, beta/player eligibility, and membership entitlement remain separate.</p><div className="table-scroll"><table aria-label="Access level capabilities" className="simple-table"><thead><tr><th>Capability</th>{["GUEST", "USER", "MEMBER", "ADMIN", "OWNER"].map((level) => <th key={level}>{level}</th>)}</tr></thead><tbody>{capabilities.map(([capability, ...levels]) => <tr key={capability}><th scope="row">{capability}</th>{levels.map((value, index) => <td key={`${capability}-${index}`}>{value}</td>)}</tr>)}</tbody></table></div></section></>;
}

export function ToolsPage({ screen }: { screen: PageManifestEntry }) {
  let page;
  if (["TOOL001", "TOOL002", "TOOL003", "TOOL004"].includes(screen.screenId)) page = <Controls screen={screen} />;
  else if (screen.screenId === "TOOL006") page = <NavigationStates screen={screen} />;
  else if (["TOOL005", "TOO001", "TOO002", "TOO003"].includes(screen.screenId)) page = <Builder screen={screen} />;
  else page = <Unavailable screen={screen} />;
  return <PublicShell><main className="public-page">{page}</main></PublicShell>;
}
