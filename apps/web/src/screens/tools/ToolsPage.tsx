import { useState } from "react";
import { pageManifest, type PageManifestEntry } from "../../lib/page-manifest";
import { PublicShell } from "../../components/shells/Shells";
import { BoundedNumberField, FiniteChipSelection, HardenedSelect } from "../../components/ui/controls";
import { PersonalityFamily } from "../../generated/prisma/enums";

const personalityFamilyTokens = Object.values(PersonalityFamily).sort((left, right) => left.localeCompare(right));
const reviewedMultiSelectTokens = personalityFamilyTokens.slice(0, 12);

function ToolsHead({ screen, description }: { screen: PageManifestEntry; description: string }) {
  const title = screen.screenId === "TOO001" ? "Wireframe Review Queue" : screen.title;
  return <header className="workspace-page-head"><p className="kicker">REVIEW TOOL · {screen.screenId}</p><h1>{title}</h1><p>{description}</p></header>;
}

function Controls({ screen }: { screen: PageManifestEntry }) {
  const [value, setValue] = useState("");
  const [singleFamily, setSingleFamily] = useState<string[]>([PersonalityFamily.ACCOUNTABILITY]);
  const [multipleFamilies, setMultipleFamilies] = useState<string[]>(reviewedMultiSelectTokens);
  if (screen.screenId === "TOOL002") return <><ToolsHead screen={screen} description="Free-solo text control review." /><section className="form-card"><label className="field">Free-solo value<input className="input" value={value} onChange={(event) => setValue(event.target.value)} /></label><p>Current value: {value || "None"}</p></section></>;
  if (screen.screenId === "TOOL003") return <><ToolsHead screen={screen} description="Hardened finite selects use rounded removable chips. Large enums cycle a stable palette in alphabetical order." /><div className="grid-2"><section className="card"><h2>Single select</h2><FiniteChipSelection allowedTokens={personalityFamilyTokens} label="Personality family" onChange={setSingleFamily} selectedTokens={singleFamily} /><p>Raw enum token is preserved; X clears the current value when the field permits empty.</p></section><section className="card"><h2>Multi select</h2><FiniteChipSelection allowedTokens={personalityFamilyTokens} label="Personality family" multiple onChange={setMultipleFamilies} selectedTokens={multipleFamilies} /><p>Each X removes only that value. Color is supplementary and never the only cue.</p></section></div></>;
  if (screen.screenId === "TOOL004") return <><ToolsHead screen={screen} description="Numeric control boundaries and invalid states." /><section className="form-card"><BoundedNumberField control="gameOrdinalDay" /><BoundedNumberField control="gameHour" /><BoundedNumberField control="gameMinute" /><BoundedNumberField control="gameYear" /><BoundedNumberField control="book" /><BoundedNumberField control="latitude" /><BoundedNumberField control="longitude" /></section></>;
  if (screen.screenId === "TOOL001") return <><ToolsHead screen={screen} description="Hardened lookup controls with visible selected values." /><section className="grid-3"><article className="card"><HardenedSelect label="Breed" value="" onChange={() => undefined}><option value="">Select Breed</option></HardenedSelect></article><article className="card"><HardenedSelect label="Witness Definition" value="" onChange={() => undefined}><option value="">Select Witness Definition</option></HardenedSelect></article><article className="card"><HardenedSelect label="Architect" value="" onChange={() => undefined}><option value="">Select Architect</option></HardenedSelect></article></section></>;
  return <Unavailable screen={screen} />;
}

const composerComponents = ["Public TopBar", "Hero", "Feature Carousel", "Data Table", "Modal", "Game BottomBar"] as const;
const libraryComponents = [
  ["Top Bar", "Public/admin navigation shell."],
  ["Data Table", "Search, filter, sort, inline-safe editing and selection."],
  ["Lookup Control", "Controlled entity search with exact IDs."],
  ["Modal", "Focused confirmation or short workflow state."],
  ["Map View", "2D Atlas view with synchronized selection."],
  ["Globe View", "3D Atlas view with layered rendering."],
] as const;
const wireframeTemplates = [
  ["Public detail page", "Hero/media, substantive copy, CTA, footer."],
  ["Admin table workspace", "Task-specific table plus selected-record detail."],
  ["Admin editor", "Entity-specific fields, relationships and save actions."],
  ["Split map workspace", "List/detail synchronized with a 2D or 3D map view."],
  ["Campaign planner", "Book rows, assignment columns and compact linked cards."],
  ["Game overlay", "Persistent sky viewport with task-specific player UI."],
] as const;

function ComponentComposer({ screen }: { screen: PageManifestEntry }) {
  return <><ToolsHead screen={screen} description="The builder uses the same 0.2.0 component/state catalog as the approval screens." /><div className="builder-layout"><aside className="card"><h2>Component Palette</h2>{composerComponents.map((name) => <button key={name}>{name}</button>)}</aside><section className="builder-canvas"><article className="card"><h2>TopBar</h2></article><article className="card"><h2>Selected component: Feature Carousel</h2><p>Drag/reorder or select to edit. Desktop/mobile preview uses the same content.</p></article><div className="action-row"><button className="button">Undo</button><button className="button">Save Local</button><button className="button button--gold">Export HTML</button></div></section><aside className="card"><h2>Properties</h2><dl className="detail-list"><dt>Role</dt><dd>GUEST</dd><dt>State</dt><dd>DEFAULT</dd><dt>Width</dt><dd>Desktop</dd></dl><p>JSON import/export · local saves · standalone HTML</p></aside></div></>;
}

function ReviewQueue({ screen }: { screen: PageManifestEntry }) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const rows = pageManifest.filter((entry) => !normalizedQuery || [entry.screenId, entry.title, entry.path ?? "state-only"].some((value) => value.toLowerCase().includes(normalizedQuery)));
  return <><ToolsHead screen={screen} description={`All ${pageManifest.length} active base-plus-amendment screen/state records, backed directly by the application registry.`} /><section className="card"><div className="toolbar"><label className="field grow">Find screen, title, or route<input className="input" value={query} onChange={(event) => setQuery(event.target.value)} /></label><span className="tag">{rows.length} of {pageManifest.length}</span></div><div className="table-scroll"><table className="simple-table"><thead><tr><th>Order</th><th>Screen/state</th><th>Title</th><th>Route or modal owner</th><th>Revision</th><th>Review</th></tr></thead><tbody>{rows.map((entry) => { const ownedPath = entry.path?.replace(/^Modal in /, ""); const href = ownedPath ? `${ownedPath}${ownedPath.includes("?") ? "&" : "?"}state=${encodeURIComponent(entry.screenId)}` : `/tools/wireframe-builder?state=${encodeURIComponent(entry.screenId)}`; return <tr key={`${entry.reviewOrder}-${entry.screenId}`}><td>{entry.reviewOrder}</td><td>{entry.screenId}</td><td>{entry.title}</td><td>{entry.path ?? "Owned state; no standalone route"}</td><td>{entry.source.startsWith("V3_REMEDIATION") ? "V3 amendment" : "v11.3 base"}</td><td><a className="button" href={href}>Open rendered UI</a></td></tr>; })}</tbody></table></div></section></>;
}

function Builder({ screen }: { screen: PageManifestEntry }) {
  if (screen.screenId === "TOOL005") return <ComponentComposer screen={screen} />;
  if (screen.screenId === "TOO001") return <ReviewQueue screen={screen} />;
  if (screen.screenId === "TOO002") return <><ToolsHead screen={screen} description="Shared wireframe tooling without replacing task-specific page topology." /><div className="grid-3">{libraryComponents.map(([name, description]) => <article className="card" key={name}><h2>{name}</h2><p>{description}</p><span className="tag">Shared primitive</span></article>)}</div></>;
  if (screen.screenId === "TOO003") return <><ToolsHead screen={screen} description="Shared wireframe tooling without replacing task-specific page topology." /><div className="grid-3">{wireframeTemplates.map(([name, description]) => <article className="card" key={name}><h2>{name}</h2><p>{description}</p></article>)}</div></>;
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
