import { campaignLinkedGroups, campaignObjectTypes } from "../../domain/campaign-planner";
import type { PageManifestEntry } from "../../lib/page-manifest";

const campaignWorldScreens = {
  CONCORD: "CAMPAIGN_CONCORD",
  RUIN: "CAMPAIGN_RUIN",
  SCHISM: "CAMPAIGN_SCHISM",
} as const;

function campaignWorld(screenId: string): keyof typeof campaignWorldScreens | null {
  return (Object.entries(campaignWorldScreens).find(([, state]) => state === screenId)?.[0]
    ?? null) as keyof typeof campaignWorldScreens | null;
}

function worldTabs(world: keyof typeof campaignWorldScreens | null) {
  return <nav aria-label="Campaign world" className="tabs">{Object.entries(campaignWorldScreens).map(([worldKey, state]) => <a aria-current={world === worldKey ? "page" : undefined} className={world === worldKey ? "active" : ""} href={`/admin/campaign/planner?state=${state}`} key={worldKey}>{worldKey}</a>)}</nav>;
}

function linkedGroupSummary() {
  return campaignLinkedGroups.map((group) => group.required.map((member) => member.count === 1 ? member.objectType : `${member.count} ${member.objectType}`).join(" + ")).join(" · ");
}

function Planner({ screen, world }: { screen: PageManifestEntry; world: keyof typeof campaignWorldScreens }) {
  const books = Array.from({ length: 18 }, (_, index) => index + 1);
  return <div className="stack">{worldTabs(world)}<div className="toolbar" aria-label="Campaign planner filters"><span className="button" aria-label={`World filter: ${world}`}>{world}</span><span className="button" aria-label="Book filter: Books 1 through 18">Books 1–18</span><span className="button" aria-label="Linked-type filter: All linked types">All linked types</span></div><section className="card"><div className="table-scroll"><table aria-label={`${world} 18-Book campaign planner`} className="simple-table"><thead><tr><th scope="col">Book</th>{campaignObjectTypes.map((objectType) => <th scope="col" key={objectType}>{objectType}</th>)}</tr></thead><tbody>{books.map((book) => <tr key={book}><th scope="row">{book}</th>{campaignObjectTypes.map((objectType) => <td key={objectType}><button aria-label={`Book ${book} ${objectType}: empty assignment cell`} className="campaign-drop-target" data-book={book} data-object-type={objectType} disabled type="button">Empty</button></td>)}</tr>)}</tbody></table></div></section><p className="notice" role="status">No campaign assignment records are stored. Empty cells remain visible, but drag/drop is unavailable until the assignment persistence contract exists.</p><section className="card"><h2>Linked drag groups</h2><p>{linkedGroupSummary()}</p><p>HISTORICAL_INTERLUDE is optional and may occur zero or more times in the Witness group.</p></section>{["CAM003", "CAM004", "CAM005"].includes(screen.screenId) && <p className="notice notice--warn">This reviewed drag state cannot be reconstructed without canonical assignment records and the dragged record identity.</p>}</div>;
}

export function CampaignAdminPage({ screen }: { screen: PageManifestEntry }) {
  const world = campaignWorld(screen.screenId);
  if (!world) return <div className="stack">{worldTabs(null)}<section className="card"><h2>Campaign Manager</h2><p>Select one internal world to open its 18-Book planner. No world is selected by default.</p></section></div>;
  return <Planner screen={screen} world={world} />;
}
