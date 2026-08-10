import type { PageManifestEntry } from "../../lib/page-manifest";
import { GameShell } from "../../components/shells/Shells";

function GameHead({ title, description }: { title: string; description: string }) {
  return <header className="game-page-head"><p className="kicker">PLAYER VIEW</p><h1>{title}</h1><p>{description}</p></header>;
}

function Viewport({ screen }: { screen: PageManifestEntry }) {
  const singleExit = ["GAME010", "GAME_VIEW_SINGLE_EXIT"].includes(screen.screenId);
  const noCountdown = screen.screenId === "GAME_VIEW_NO_COUNTDOWN";
  return <section className="game-viewport"><img src="/assets/landing_hero_background.jpg" alt="Player view over the city beneath three moons" /><div className="game-hud"><div className="dialog"><p className="kicker">Mae'vyri</p><p>“You came back. Did the archive tell you why the Beacon was sealed?”</p><label>Speak or type freely<textarea placeholder="Speak or type your response…" /></label><div className="action-row"><button className="button button--gold">Send</button></div></div>{singleExit && <aside className="exits"><h2>Exit</h2><button>Harbor Gate</button></aside>}</div>{!noCountdown && <div className="countdown"><span>Witness trial</span><strong>18:42 remaining</strong></div>}</section>;
}

function EffectiveViewport({ screen }: { screen: PageManifestEntry }) {
  const nearby = screen.screenId === "GAME008";
  const exits = screen.screenId === "GAME009" || screen.screenId === "GAME010";
  const single = screen.screenId === "GAME010";
  return <section className="sky-viewport"><div className="moons" aria-label="Three moons"><span /><span /><span /></div><div className="sky-copy"><p className="kicker">Effective viewport</p><h1>The sky moves with the world.</h1><p>Foreground story content sits over the deterministic sky renderer. Travel accelerates time.</p></div>{nearby && <aside className="sky-panel left"><h2>Nearby</h2><button>Mae’vyri</button><button>Archivist</button></aside>}{exits && <aside className="sky-panel right"><h2>Exits</h2>{(single ? ["North - Plaza"] : ["North - Plaza", "East - Archive", "Down - Canal"]).map((exit) => <button key={exit}>{exit}</button>)}</aside>}</section>;
}

function Knowledge({ screen }: { screen: PageManifestEntry }) {
  if (screen.screenId === "GAME003") return <><GameHead title={screen.title} description="Inspect one Knowledge Base item without leaving the graph." /><div className="knowledge-graph"><span className="knowledge-node selected">KB-001</span><span className="knowledge-node n2">KB-002</span><span className="knowledge-node n3">KB-003</span><section className="knowledge-detail"><h2>Selected knowledge</h2><p>Title</p><p>Base content and linked records appear here.</p><button className="button">Close</button></section></div></>;
  if (screen.screenId === "GAME016") return <><GameHead title={screen.title} description="View discovered Knowledge Base items against the current timeline." /><div className="timeline-view"><aside>{["Earlier", "Current", "Later"].map((name) => <button key={name}>{name}</button>)}</aside><section>{[1,2,3,4].map((n) => <article className="card" key={n}><span className="tag">KB-{String(n).padStart(3, "0")}</span><h2>Timeline item</h2><p>Discovered context is ordered without revealing undiscovered events.</p></article>)}</section></div></>;
  return <><GameHead title="Knowledge Base Graph" description="Browse discovered knowledge and its visible relationships." /><div className="knowledge-graph"><span className="knowledge-node selected">KB-001</span><span className="knowledge-node n2">KB-002</span><span className="knowledge-node n3">KB-003</span><span className="knowledge-node n4">KB-004</span><div className="graph-line l1" /><div className="graph-line l2" /><aside className="graph-legend"><h2>Visible links</h2><p>Source</p><p>Person</p><p>Place</p><a className="button" href="/game/knowledge?state=GAME016">Timeline</a></aside></div></>;
}

function Bookshelf({ screen }: { screen: PageManifestEntry }) {
  return <><GameHead title={screen.title} description="Read discovered Tomes from the player bookshelf." /><div className="reader"><aside className="books"><h2>Bookshelf</h2>{["Tome I", "Tome II", "Tome III"].map((name, index) => <button className={index === 0 ? "selected" : ""} key={name}>{name}</button>)}</aside><article className="page-paper"><p className="kicker">TOME-001</p><h2>Tome I</h2><p>Discovered Tome content is shown here with readable typography and page navigation.</p><div className="reader-controls"><button className="button">Previous</button><span>Page 1 of 12</span><button className="button">Next</button></div></article></div></>;
}

function Maps({ screen }: { screen: PageManifestEntry }) {
  const globe = ["GAME005", "GAM005", "GAME_GLOBE_PRESENT", "GAME_GLOBE_TIMELINE", "GAME013"].includes(screen.screenId);
  const timeline = screen.screenId === "GAME_GLOBE_TIMELINE";
  const city = screen.screenId === "GAME007";
  return <><GameHead title={screen.title} description={timeline ? "Inspect the player globe at a visible timeline position." : globe ? "Inspect the player globe and discovered locations." : city ? "Navigate the discovered city map." : "Navigate discovered continent and city maps."} /><div className="player-map"><img src={globe ? "/assets/globe.png" : "/assets/world_map.png"} alt={globe ? "Player globe" : "Player map"} /><aside><h2>{timeline ? "Timeline" : "Map layers"}</h2>{timeline ? <><input type="range" min="0" max="100" defaultValue="65" /><p>Visible date only</p></> : ["Discovered places", "Routes", "Current location"].map((name) => <label key={name}><input type="checkbox" defaultChecked /> {name}</label>)}<a className="button" href={globe ? "/game/maps" : "/game/maps/globe"}>{globe ? "Map" : "Globe"}</a></aside></div></>;
}

function WitnessTrial({ screen }: { screen: PageManifestEntry }) {
  return <><GameHead title={screen.title} description="A timed Witness trial begins only after explicit acceptance." /><section className="trial-warning"><p className="kicker">TIMED CHALLENGE</p><h2>Witness Trial</h2><p>The countdown begins only when you accept. Leaving ordinary play does not start this timer.</p><dl><dt>Duration</dt><dd>15 minutes</dd><dt>Hints</dt><dd>Available in sequence</dd><dt>Retry</dt><dd>Available</dd></dl><div className="action-row"><a className="button" href="/game">Not now</a><button className="button button--gold">Accept challenge</button></div></section></>;
}

function Companions({ screen }: { screen: PageManifestEntry }) {
  return <><GameHead title={screen.title} description="Companions link the Concord, Ruin and Schism Protagonists through one Soul and Heirloom." /><div className="grid-3">{["Concord", "Ruin", "Schism"].map((world) => <article className="card" key={world}><p className="kicker">{world}</p><h2>Protagonist</h2><p>Linked companion identity</p></article>)}</div><section className="card companion-link"><span>Soul</span><span>Heirloom</span></section></>;
}

function Calendar({ screen }: { screen: PageManifestEntry }) {
  return <><GameHead title={screen.title} description="Player calendar with current date, weekday and visible events." /><section className="calendar"><header><button className="button">Previous</button><h2>Current Month</h2><button className="button">Next</button></header><div className="calendar-grid">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <strong key={day}>{day}</strong>)}{Array.from({length: 35}, (_, index) => <button className={index === 16 ? "today" : ""} key={index}>{index < 3 || index > 32 ? "" : index - 2}</button>)}</div></section></>;
}

function SettingsOverlay({ screen }: { screen: PageManifestEntry }) {
  return <><Viewport screen={screen} /><div className="modal-backdrop game-modal"><section className="modal-card" role="dialog" aria-modal="true"><p className="kicker">SHARED SETTINGS</p><h2>Game Settings</h2><label><input type="checkbox" defaultChecked /> Show explicit challenge countdowns</label><label><input type="checkbox" /> Reduce motion</label><label className="field">Text size<select className="select"><option>Default</option><option>Large</option></select></label><div className="action-row"><button className="button">Cancel</button><button className="button button--gold">Save settings</button></div></section></div></>;
}

export function GamePage({ screen }: { screen: PageManifestEntry }) {
  let page;
  if (["GAME001", "GAME008", "GAME009", "GAME010"].includes(screen.screenId)) page = <EffectiveViewport screen={screen} />;
  else if (["GAM001", "GAME_VIEW_FULL", "GAME_VIEW_NO_COUNTDOWN", "GAME_VIEW_SINGLE_EXIT"].includes(screen.screenId)) page = <Viewport screen={screen} />;
  else if (["GAME002", "GAME003", "GAME016", "GAM002"].includes(screen.screenId)) page = <Knowledge screen={screen} />;
  else if (["GAME004", "GAM003"].includes(screen.screenId)) page = <Bookshelf screen={screen} />;
  else if (["GAME005", "GAME006", "GAME007", "GAME013", "GAM004", "GAM005", "GAME_GLOBE_PRESENT", "GAME_GLOBE_TIMELINE"].includes(screen.screenId)) page = <Maps screen={screen} />;
  else if (screen.screenId === "GAME011") page = <WitnessTrial screen={screen} />;
  else if (screen.screenId === "GAME012") page = <Companions screen={screen} />;
  else if (screen.screenId === "GAME014") page = <Calendar screen={screen} />;
  else page = <SettingsOverlay screen={screen} />;
  return <GameShell><main className="game-page">{page}</main></GameShell>;
}
